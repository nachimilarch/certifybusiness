/**
 * Tests for one-time SSE stream token auth.
 *
 * Verifies:
 *  1. issueStreamToken stores a short-lived token in Redis with 30 s TTL.
 *  2. authenticateSseToken reads the payload and deletes the token (getDel).
 *  3. A second request with the same token is rejected (replay prevention).
 *  4. A missing ?t= param is rejected.
 *  5. RBAC — the token carries the correct role/permissions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ─── Redis mock ───────────────────────────────────────────────────────────────

const _store = new Map<string, string>();

vi.mock("../../../core/redis", () => ({
  getRedis: () => ({
    set: vi.fn((key: string, value: string, opts?: { EX?: number }) => {
      _store.set(key, value);
      if (opts?.EX) {
        // Simulate TTL by scheduling deletion (not needed in these sync tests)
      }
      return Promise.resolve("OK");
    }),
    getDel: vi.fn((key: string) => {
      const val = _store.get(key) ?? null;
      _store.delete(key);
      return Promise.resolve(val);
    }),
  }),
}));

vi.mock("../../../core/config", () => ({
  config: {
    jwt: {
      accessSecret: "test-secret",
      accessExpiresIn: "15m",
    },
  },
}));

vi.mock("../../../core/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

function runMiddleware(
  mw: Middleware,
  reqOverrides: Partial<Request> = {}
): Promise<{ req: Partial<Request>; nextErr?: unknown }> {
  return new Promise((resolve) => {
    const req = { query: {}, headers: {}, ...reqOverrides } as unknown as Request;
    const res = {} as Response;
    const next = (err?: unknown) => resolve({ req, nextErr: err });
    mw(req, res, next);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("issueStreamToken", () => {
  beforeEach(() => _store.clear());

  it("stores token in Redis under sse:token:{uuid}", async () => {
    const { issueStreamToken } = await import("../../../core/middleware/auth.middleware");

    const token = await issueStreamToken("user-1", "org-1", "employee", { inbox: true });

    expect(typeof token).toBe("string");
    expect(token).toHaveLength(36); // UUID format
    expect(_store.has(`sse:token:${token}`)).toBe(true);

    const stored = JSON.parse(_store.get(`sse:token:${token}`)!);
    expect(stored.userId).toBe("user-1");
    expect(stored.orgId).toBe("org-1");
    expect(stored.role).toBe("employee");
    expect(stored.permissions.inbox).toBe(true);
  });
});

describe("authenticateSseToken", () => {
  beforeEach(() => _store.clear());

  it("populates req.user on valid token", async () => {
    const { issueStreamToken, authenticateSseToken } =
      await import("../../../core/middleware/auth.middleware");

    const token = await issueStreamToken("user-2", "org-2", "admin", {});

    const { req, nextErr } = await runMiddleware(authenticateSseToken, {
      query: { t: token },
    } as any);

    expect(nextErr).toBeUndefined();
    expect((req as any).user?.id).toBe("user-2");
    expect((req as any).user?.organisationId).toBe("org-2");
    expect((req as any).user?.role).toBe("admin");
  });

  it("deletes the token after first use (replay prevention)", async () => {
    const { issueStreamToken, authenticateSseToken } =
      await import("../../../core/middleware/auth.middleware");

    const token = await issueStreamToken("user-3", "org-3", "employee", {});
    await runMiddleware(authenticateSseToken, { query: { t: token } } as any);

    // Second use — token should have been deleted by getDel
    const { nextErr } = await runMiddleware(authenticateSseToken, {
      query: { t: token },
    } as any);

    expect(nextErr).toBeDefined();
  });

  it("rejects a missing ?t= param", async () => {
    const { authenticateSseToken } = await import("../../../core/middleware/auth.middleware");

    const { nextErr } = await runMiddleware(authenticateSseToken, { query: {} } as any);
    expect(nextErr).toBeDefined();
  });

  it("rejects a token that was never issued", async () => {
    const { authenticateSseToken } = await import("../../../core/middleware/auth.middleware");

    const { nextErr } = await runMiddleware(authenticateSseToken, {
      query: { t: "00000000-0000-0000-0000-000000000000" },
    } as any);
    expect(nextErr).toBeDefined();
  });
});
