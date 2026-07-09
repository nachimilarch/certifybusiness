/**
 * Tests for inbound message deduplication in inbox.service.ts
 *
 * We mock the database using a simple in-memory record store so these run
 * without a real MySQL connection.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// ─── Mock DB builder ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeDb(seed: { [table: string]: Row[] } = {}) {
  const tables: { [table: string]: Row[] } = { ...seed };

  // Minimal Knex query-builder stub that covers the patterns used in the service
  function table(name: string) {
    if (!tables[name]) tables[name] = [];
    const rows = tables[name];

    const builder: any = {
      _filters: [] as Array<(r: Row) => boolean>,
      _orderCol: null as string | null,
      _orderDir: "asc" as "asc" | "desc",
      _limitN: Infinity,
      _selectCols: null as string[] | null,
      _insertData: null as Row | null,
      _updateData: null as Row | null,
      _onConflictCols: null as string[] | null,
      _ignoreConflict: false,
      _pluckCol: null as string | null,

      where(colOrObj: string | Record<string, unknown>, val?: unknown) {
        if (typeof colOrObj === "object") {
          for (const [k, v] of Object.entries(colOrObj)) {
            this._filters.push((r: Row) => r[k] === v);
          }
        } else {
          this._filters.push((r: Row) => r[colOrObj] === val);
        }
        return this;
      },
      whereIn(col: string, vals: unknown[]) {
        this._filters.push((r: Row) => vals.includes(r[col]));
        return this;
      },
      whereNotNull(col: string) {
        this._filters.push((r: Row) => r[col] != null);
        return this;
      },
      whereNull(col: string) {
        this._filters.push((r: Row) => r[col] == null);
        return this;
      },
      whereRaw() { return this; }, // no-op in tests
      orderBy(col: string, dir: "asc" | "desc" = "asc") {
        this._orderCol = col; this._orderDir = dir; return this;
      },
      limit(n: number) { this._limitN = n; return this; },
      select(...cols: unknown[]) {
        this._selectCols = cols.flat() as string[];
        return this;
      },
      pluck(col: string) { this._pluckCol = col; return this; },

      // join / leftJoin — no-op in this stub (caller filters manually)
      join(_t: string, _c1: string, _c2: string) { return this; },
      leftJoin(_t: string, _c1: string, _c2: string) { return this; },

      onConflict(cols: string[]) {
        this._onConflictCols = cols;
        return this;
      },
      ignore() {
        this._ignoreConflict = true;
        return this;
      },

      insert(data: Row) {
        this._insertData = data;
        return this;
      },
      update(data: Row) {
        this._updateData = data;
        return this;
      },

      // Execute
      async first(): Promise<Row | null> {
        let result = rows.filter((r) => this._filters.every((f: (r: Row) => boolean) => f(r)));
        if (this._orderCol) {
          const col = this._orderCol;
          result = [...result].sort((a, b) => {
            const av = a[col] as any, bv = b[col] as any;
            return this._orderDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
          });
        }
        return result[0] ?? null;
      },

      // Called when the builder itself is awaited (insert/update)
      then(resolve: (v: unknown) => void) {
        if (this._insertData) {
          const data = this._insertData;
          if (this._ignoreConflict && this._onConflictCols) {
            const isDup = rows.some((r) =>
              this._onConflictCols!.every((c: string) => r[c] !== undefined && r[c] === data[c])
            );
            if (isDup) { resolve([]); return; }
          }
          rows.push({ ...data });
          resolve([data]);
          return;
        }
        if (this._updateData) {
          const updated: Row[] = [];
          for (const r of rows) {
            if (this._filters.every((f: (r: Row) => boolean) => f(r))) {
              const resolved: Row = {};
              for (const [k, v] of Object.entries(this._updateData)) {
                // Resolve db.raw("col + N") arithmetic expressions
                if (v && typeof v === "object" && typeof (v as any).toSQL === "function") {
                  const sql: string = (v as any).toSQL();
                  const incMatch = sql.match(/^(\w+)\s*\+\s*(\d+)$/);
                  if (incMatch) {
                    resolved[k] = Number(r[incMatch[1]] ?? 0) + Number(incMatch[2]);
                  } else {
                    resolved[k] = v;
                  }
                } else {
                  resolved[k] = v;
                }
              }
              Object.assign(r, resolved);
              updated.push(r);
            }
          }
          resolve(updated.length);
          return;
        }
        if (this._pluckCol) {
          const col = this._pluckCol;
          const result = rows
            .filter((r) => this._filters.every((f: (r: Row) => boolean) => f(r)))
            .map((r) => r[col]);
          resolve(result);
          return;
        }
        // Default: return matching rows
        const result = rows.filter((r) => this._filters.every((f: (r: Row) => boolean) => f(r)));
        resolve(result);
      },
    };

    return builder;
  }

  const db: any = (name: string) => table(name);
  db.raw = (expr: string, bindings: unknown[] = []) => ({ toSQL: () => expr, bindings });
  db._tables = tables;
  return db;
}

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("../../../core/database", () => ({ getDb: () => mockDb }));
vi.mock("../../../core/config", () => ({
  config: {
    smtp: { host: "smtp.test", port: 465, secure: true, user: "u", pass: "p", fromName: "Test", fromEmail: "test@test.com" },
    whatsapp: { apiVersion: "v19.0" },
    appUrl: "http://localhost:4000",
  },
}));
vi.mock("../../../core/encryption", () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));
vi.mock("../../../core/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../notifications/notification.service", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
// Mock nodemailer so we don't actually send email
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: "<sent-msg-id@test>" }),
    }),
  },
}));

let mockDb: ReturnType<typeof makeDb>;

// ─── Import after mocks (dynamic to avoid top-level await) ───────────────────

type InboxSvc = typeof import("../inbox.service");
let handleInboundEmailReply: InboxSvc["handleInboundEmailReply"];
let handleInboundWhatsAppMessage: InboxSvc["handleInboundWhatsAppMessage"];

beforeAll(async () => {
  const svc = await import("../inbox.service");
  handleInboundEmailReply = svc.handleInboundEmailReply;
  handleInboundWhatsAppMessage = svc.handleInboundWhatsAppMessage;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleInboundEmailReply — deduplication", () => {
  beforeEach(() => {
    mockDb = makeDb({
      conversations: [],
      conversation_messages: [],
      campaigns: [{ id: "camp-1", created_by: "user-1", replied_count: 0 }],
      leads: [],
      lead_emails: [],
      lead_activities: [],
      lead_phones: [],
      notifications: [],
    });
  });

  it("creates a conversation and message on first inbound", async () => {
    await handleInboundEmailReply(mockDb, {
      orgId: "org-1",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      fromEmail: "contact@example.com",
      messageId: "<msg-001@example.com>",
      inReplyTo: null,
      subject: "Re: Hello",
      bodyText: "Yes, interested!",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    });

    const convs = mockDb._tables.conversations as Row[];
    expect(convs).toHaveLength(1);
    expect(convs[0].contact_email).toBe("contact@example.com");
    expect(convs[0].status).toBe("awaiting_employee");

    const msgs = mockDb._tables.conversation_messages as Row[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].provider_message_id).toBe("<msg-001@example.com>");
    expect(msgs[0].direction).toBe("inbound");
  });

  it("ignores a duplicate inbound with the same provider_message_id", async () => {
    const opts = {
      orgId: "org-1",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      fromEmail: "contact@example.com",
      messageId: "<msg-001@example.com>",
      inReplyTo: null,
      subject: "Re: Hello",
      bodyText: "Yes, interested!",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    };

    await handleInboundEmailReply(mockDb, opts);
    await handleInboundEmailReply(mockDb, opts); // second call — same message ID

    const msgs = mockDb._tables.conversation_messages as Row[];
    // Only one message should exist
    expect(msgs.filter((m) => m.provider_message_id === "<msg-001@example.com>")).toHaveLength(1);
  });

  it("appends a second reply to the same conversation without duplication", async () => {
    const base = {
      orgId: "org-1",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      fromEmail: "contact@example.com",
      subject: "Re: Hello",
      inReplyTo: null,
      receivedAt: new Date("2026-06-01T10:00:00Z"),
      bodyText: "First reply",
    };

    await handleInboundEmailReply(mockDb, { ...base, messageId: "<msg-001@example.com>" });
    await handleInboundEmailReply(mockDb, {
      ...base,
      messageId: "<msg-002@example.com>",
      inReplyTo: "<msg-001@example.com>",
      bodyText: "Second reply",
      receivedAt: new Date("2026-06-01T11:00:00Z"),
    });

    const convs = mockDb._tables.conversations as Row[];
    expect(convs).toHaveLength(1); // still one conversation
    expect(convs[0].message_count).toBe(2);

    const msgs = mockDb._tables.conversation_messages as Row[];
    expect(msgs).toHaveLength(2);
  });

  it("stores the contact's References chain for later threading", async () => {
    await handleInboundEmailReply(mockDb, {
      orgId: "org-1",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      fromEmail: "contact@example.com",
      messageId: "<msg-001@example.com>",
      inReplyTo: "<orig-outbound@certifybusiness.com>",
      contactReferences: ["<orig-outbound@certifybusiness.com>"],
      subject: "Re: Hello",
      bodyText: "Reply",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    });

    const msgs = mockDb._tables.conversation_messages as Row[];
    const payload = JSON.parse(msgs[0].raw_payload as string);
    expect(payload.references).toContain("<orig-outbound@certifybusiness.com>");
  });
});

// ─── WhatsApp deduplication ───────────────────────────────────────────────────

describe("handleInboundWhatsAppMessage — deduplication", () => {
  beforeEach(() => {
    mockDb = makeDb({
      conversations: [],
      conversation_messages: [],
      campaigns: [{ id: "camp-1", created_by: "user-1", replied_count: 0 }],
      leads: [],
      lead_phones: [],
      lead_activities: [],
      notifications: [],
    });
  });

  it("creates a conversation on first inbound WA message", async () => {
    await handleInboundWhatsAppMessage(mockDb, {
      orgId: "org-1",
      senderPhone: "919876543210",
      waMessageId: "wamid.abc001",
      waMessageDbId: "db-wa-001",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      bodyText: "Hello, I'm interested",
      messageType: "text",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    });

    const convs = mockDb._tables.conversations as Row[];
    expect(convs).toHaveLength(1);
    expect(convs[0].contact_phone).toBe("919876543210");
    expect(convs[0].channel).toBe("whatsapp");
  });

  it("ignores a duplicate WA inbound with the same wa_message_id", async () => {
    const opts = {
      orgId: "org-1",
      senderPhone: "919876543210",
      waMessageId: "wamid.abc001",
      waMessageDbId: "db-wa-001",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      bodyText: "Hello",
      messageType: "text",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    };

    await handleInboundWhatsAppMessage(mockDb, opts);
    await handleInboundWhatsAppMessage(mockDb, opts); // duplicate

    const msgs = mockDb._tables.conversation_messages as Row[];
    expect(msgs.filter((m) => m.provider_message_id === "wamid.abc001")).toHaveLength(1);
  });

  it("records correlation method in raw_payload", async () => {
    await handleInboundWhatsAppMessage(mockDb, {
      orgId: "org-1",
      senderPhone: "919876543210",
      waMessageId: "wamid.abc001",
      waMessageDbId: "db-wa-001",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      bodyText: "Hello",
      messageType: "text",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
      correlationMethod: "context_id",
    });

    const msgs = mockDb._tables.conversation_messages as Row[];
    const payload = JSON.parse(msgs[0].raw_payload as string);
    expect(payload.correlationMethod).toBe("context_id");
  });

  it("does not inflate conversation counters when WA message is a duplicate (TOCTOU fix)", async () => {
    const opts = {
      orgId: "org-1",
      senderPhone: "919876543210",
      waMessageId: "wamid.toctou001",
      waMessageDbId: "db-wa-toc",
      campaignId: "camp-1",
      campaignContactId: "cc-toc",
      leadId: null,
      senderIdentityId: null,
      bodyText: "Duplicate test",
      messageType: "text",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    };

    await handleInboundWhatsAppMessage(mockDb, opts);
    const convBefore = (mockDb._tables.conversations as Row[]).find(
      (c) => c.contact_phone === "919876543210"
    )!;
    const countBefore = Number(convBefore.unread_count);
    const msgCountBefore = Number(convBefore.message_count);

    // Replay the same message — should be caught by pre-check, no counter change
    await handleInboundWhatsAppMessage(mockDb, opts);

    const convAfter = (mockDb._tables.conversations as Row[]).find(
      (c) => c.contact_phone === "919876543210"
    )!;
    expect(Number(convAfter.unread_count)).toBe(countBefore);
    expect(Number(convAfter.message_count)).toBe(msgCountBefore);
  });
});

// ─── TOCTOU: email duplicate does not inflate conversation counters ────────────

describe("handleInboundEmailReply — TOCTOU counter fix", () => {
  beforeEach(() => {
    mockDb = makeDb({
      conversations: [],
      conversation_messages: [],
      campaigns: [{ id: "camp-1", created_by: "user-1", replied_count: 0 }],
      leads: [],
      lead_emails: [],
      lead_activities: [],
      lead_phones: [],
      notifications: [],
    });
  });

  it("does not inflate unread_count or message_count on replay (IMAP reconnect scenario)", async () => {
    const opts = {
      orgId: "org-1",
      campaignId: "camp-1",
      campaignContactId: "cc-1",
      leadId: null,
      senderIdentityId: null,
      fromEmail: "contact@example.com",
      messageId: "<toctou-001@example.com>",
      inReplyTo: null,
      subject: "Re: Hello",
      bodyText: "First and only reply",
      receivedAt: new Date("2026-06-01T10:00:00Z"),
    };

    await handleInboundEmailReply(mockDb, opts);

    const convs = mockDb._tables.conversations as Row[];
    expect(convs).toHaveLength(1);
    const unreadAfterFirst = Number(convs[0].unread_count);
    const msgCountAfterFirst = Number(convs[0].message_count);
    expect(unreadAfterFirst).toBe(1);
    expect(msgCountAfterFirst).toBe(1);

    // Simulate IMAP reconnect replaying the same UID
    await handleInboundEmailReply(mockDb, opts);
    await handleInboundEmailReply(mockDb, opts);

    expect(Number(convs[0].unread_count)).toBe(unreadAfterFirst);   // still 1
    expect(Number(convs[0].message_count)).toBe(msgCountAfterFirst); // still 1
    // Only one message row exists
    expect((mockDb._tables.conversation_messages as Row[]).filter(
      (m) => m.provider_message_id === "<toctou-001@example.com>"
    )).toHaveLength(1);
  });
});
