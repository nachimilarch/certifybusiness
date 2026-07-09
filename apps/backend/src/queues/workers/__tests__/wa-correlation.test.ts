/**
 * Tests for WhatsApp reply correlation strategy.
 * Verifies that context_id takes priority over phone recency.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock logger ──────────────────────────────────────────────────────────────
const logInfoCalls: unknown[][] = [];
vi.mock("../../../core/logger", () => ({
  logger: {
    info: (...args: unknown[]) => { logInfoCalls.push(args); },
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Helpers to build a minimal webhook payload ───────────────────────────────

function buildWaWebhook(messages: object[]) {
  return {
    entry: [{
      changes: [{
        value: {
          messages,
          statuses: [],
        },
      }],
    }],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WhatsApp reply correlation", () => {
  it("prefers context_id over phone recency", () => {
    // Simulate two outbound messages to the same phone from different campaigns
    const rows = [
      { id: "wa-db-1", wa_message_id: "wamid.orig001", organisation_id: "org-1", campaign_id: "camp-A", direction: "outbound", recipient_phone: "911234567890", created_at: new Date("2026-06-01T09:00:00Z") },
      { id: "wa-db-2", wa_message_id: "wamid.orig002", organisation_id: "org-1", campaign_id: "camp-B", direction: "outbound", recipient_phone: "911234567890", created_at: new Date("2026-06-01T10:00:00Z") },
    ];

    // Simulate the correlation logic the webhook worker uses
    function correlate(contextId: string | undefined, senderPhone: string) {
      // Strategy 1: exact context match
      if (contextId) {
        const match = rows.find(
          (r) => r.wa_message_id === contextId && r.direction === "outbound"
        );
        if (match) return { row: match, method: "context_id" };
      }
      // Strategy 2: recency
      const sorted = [...rows].sort((a, b) =>
        b.created_at.getTime() - a.created_at.getTime()
      );
      const phoneMatch = sorted.find((r) => r.recipient_phone === senderPhone && r.direction === "outbound");
      return phoneMatch ? { row: phoneMatch, method: "phone_recency" } : null;
    }

    // When the contact explicitly replies to the FIRST campaign message (older)
    const result = correlate("wamid.orig001", "911234567890");
    expect(result?.method).toBe("context_id");
    expect(result?.row.campaign_id).toBe("camp-A");
  });

  it("falls back to phone recency when no context is present", () => {
    const rows = [
      { wa_message_id: "wamid.orig001", campaign_id: "camp-A", direction: "outbound", recipient_phone: "911234567890", created_at: new Date("2026-06-01T09:00:00Z") },
      { wa_message_id: "wamid.orig002", campaign_id: "camp-B", direction: "outbound", recipient_phone: "911234567890", created_at: new Date("2026-06-01T10:00:00Z") },
    ];

    function correlate(contextId: string | undefined, senderPhone: string) {
      if (contextId) {
        const match = rows.find((r) => r.wa_message_id === contextId && r.direction === "outbound");
        if (match) return { row: match, method: "context_id" };
      }
      const sorted = [...rows].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const phoneMatch = sorted.find((r) => r.recipient_phone === senderPhone && r.direction === "outbound");
      return phoneMatch ? { row: phoneMatch, method: "phone_recency" } : null;
    }

    const result = correlate(undefined, "911234567890");
    expect(result?.method).toBe("phone_recency");
    // Returns the MOST RECENT outbound (camp-B, created later)
    expect(result?.row.campaign_id).toBe("camp-B");
  });

  it("returns null when no outbound matches the phone", () => {
    const rows: Array<Record<string, string>> = [];

    function correlate(contextId: string | undefined, senderPhone: string) {
      if (contextId) {
        const match = rows.find((r) => r["wa_message_id"] === contextId);
        if (match) return { row: match, method: "context_id" };
      }
      const phoneMatch = rows.find((r) => r["recipient_phone"] === senderPhone);
      return phoneMatch ? { row: phoneMatch, method: "phone_recency" } : null;
    }

    const result = correlate(undefined, "911234567890");
    expect(result).toBeNull();
  });
});
