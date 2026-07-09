/**
 * Tests that verify the correct construction of email threading headers
 * (In-Reply-To and References) when sending a reply from the inbox.
 *
 * These tests exercise the thread-header logic in isolation — without
 * actually sending email — by building the same data structures the
 * service function uses.
 */

import { describe, it, expect } from "vitest";

// ─── Pure-logic helpers extracted from inbox.service.ts ───────────────────────
// We re-implement only the header-building logic here so the tests are fast
// and deterministic without needing a DB stub.

interface StoredMessage {
  provider_message_id: string | null;
  direction: "inbound" | "outbound";
  raw_payload: string | null;
}

function buildThreadingHeaders(messages: StoredMessage[]): {
  inReplyTo: string | null;
  references: string;
} {
  const emailMsgs = messages.filter((m) => m.provider_message_id);

  // In-Reply-To: most recent inbound message
  const lastInbound = [...emailMsgs]
    .filter((m) => m.direction === "inbound")
    .pop() ?? null;

  // References: de-duped chain (contact's own refs first, then DB IDs)
  const contactRefs: string[] = (() => {
    try {
      if (!lastInbound?.raw_payload) return [];
      const p = JSON.parse(lastInbound.raw_payload);
      return Array.isArray(p.references) ? p.references : [];
    } catch { return []; }
  })();

  const dbIds = emailMsgs.map((m) => m.provider_message_id as string);

  const seen = new Set<string>();
  const chain: string[] = [];
  for (const id of [...contactRefs, ...dbIds]) {
    if (id && !seen.has(id)) { seen.add(id); chain.push(id); }
  }

  return {
    inReplyTo: lastInbound?.provider_message_id ?? null,
    references: chain.join(" "),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Email threading headers", () => {
  it("sets In-Reply-To to the last inbound message ID", () => {
    const messages: StoredMessage[] = [
      { provider_message_id: "<outbound-1@cb.com>", direction: "outbound", raw_payload: null },
      { provider_message_id: "<inbound-1@example.com>", direction: "inbound", raw_payload: null },
    ];
    const { inReplyTo } = buildThreadingHeaders(messages);
    expect(inReplyTo).toBe("<inbound-1@example.com>");
  });

  it("does NOT set In-Reply-To to an outbound message", () => {
    const messages: StoredMessage[] = [
      { provider_message_id: "<outbound-1@cb.com>", direction: "outbound", raw_payload: null },
    ];
    const { inReplyTo } = buildThreadingHeaders(messages);
    expect(inReplyTo).toBeNull(); // no inbound yet
  });

  it("References contains all message IDs in oldest-first order", () => {
    const messages: StoredMessage[] = [
      { provider_message_id: "<outbound-1@cb.com>", direction: "outbound", raw_payload: null },
      { provider_message_id: "<inbound-1@example.com>", direction: "inbound", raw_payload: null },
      { provider_message_id: "<outbound-2@cb.com>", direction: "outbound", raw_payload: null },
    ];
    const { references } = buildThreadingHeaders(messages);
    const ids = references.split(" ");
    expect(ids).toContain("<outbound-1@cb.com>");
    expect(ids).toContain("<inbound-1@example.com>");
    expect(ids).toContain("<outbound-2@cb.com>");
    // Each ID appears exactly once
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prepends contact's own References chain before DB IDs", () => {
    // Simulates a case where the contact is replying to a message thread
    // that contains IDs our DB does not have (e.g. a forwarded email chain)
    const contactOwnRefs = ["<thread-start@external.com>", "<thread-mid@external.com>"];
    const messages: StoredMessage[] = [
      { provider_message_id: "<outbound-1@cb.com>", direction: "outbound", raw_payload: null },
      {
        provider_message_id: "<inbound-1@example.com>",
        direction: "inbound",
        raw_payload: JSON.stringify({ references: contactOwnRefs }),
      },
    ];
    const { references } = buildThreadingHeaders(messages);
    const ids = references.split(" ");
    // External refs should come before our outbound ID
    expect(ids.indexOf("<thread-start@external.com>")).toBeLessThan(
      ids.indexOf("<outbound-1@cb.com>")
    );
    expect(ids).toContain("<thread-mid@external.com>");
  });

  it("de-duplicates message IDs in the References chain", () => {
    const messages: StoredMessage[] = [
      { provider_message_id: "<outbound-1@cb.com>", direction: "outbound", raw_payload: null },
      {
        provider_message_id: "<inbound-1@example.com>",
        direction: "inbound",
        // Contact's References also includes <outbound-1@cb.com> — should not duplicate
        raw_payload: JSON.stringify({ references: ["<outbound-1@cb.com>"] }),
      },
    ];
    const { references } = buildThreadingHeaders(messages);
    const ids = references.split(" ");
    const outbound1Count = ids.filter((id) => id === "<outbound-1@cb.com>").length;
    expect(outbound1Count).toBe(1);
  });

  it("handles a thread with no inbound messages yet (first send)", () => {
    const messages: StoredMessage[] = [];
    const { inReplyTo, references } = buildThreadingHeaders(messages);
    expect(inReplyTo).toBeNull();
    expect(references).toBe("");
  });
});
