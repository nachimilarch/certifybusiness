/**
 * Tests for Redis pub/sub SSE event propagation.
 *
 * Verifies that:
 *  1. broadcastToUser publishes to the sse:user:{id} Redis channel.
 *  2. broadcastToOrg publishes to the sse:org:{id} Redis channel.
 *  3. The pSubscribe handler routes messages to the correct local HTTP clients.
 *  4. In-process fallback works when Redis is unavailable (pub is null).
 *  5. Dead connections are skipped without throwing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Redis mock factory ───────────────────────────────────────────────────────

type PSubscribeHandler = (message: string, channel: string) => void;

function makeRedisMock() {
  const published: { channel: string; message: string }[] = [];
  let pHandler: PSubscribeHandler | null = null;

  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    publish: vi.fn((channel: string, message: string) => {
      published.push({ channel, message });
      // Simulate local delivery (same process — pSubscribe fires synchronously in tests)
      if (pHandler) pHandler(message, channel);
      return Promise.resolve(1);
    }),
    pSubscribe: vi.fn((pattern: string, handler: PSubscribeHandler) => {
      pHandler = handler;
      return Promise.resolve();
    }),
    pUnsubscribe: vi.fn().mockResolvedValue(undefined),
  };

  return { client, published, triggerMessage: (channel: string, msg: string) => pHandler?.(msg, channel) };
}

// ─── Fake express Response ────────────────────────────────────────────────────

function makeRes() {
  const written: string[] = [];
  let closed = false;
  return {
    write: vi.fn((chunk: string) => {
      if (closed) throw new Error("write after close");
      written.push(chunk);
      return true;
    }),
    written,
    simulateClose: () => { closed = true; },
  };
}

// ─── Module under test (re-imported fresh per suite) ─────────────────────────

async function loadSse(redisMock: ReturnType<typeof makeRedisMock>) {
  vi.resetModules();
  vi.doMock("redis", () => ({
    createClient: () => redisMock.client,
  }));
  vi.doMock("../../../core/config", () => ({
    config: { redis: { url: "redis://localhost:6379" } },
  }));
  vi.doMock("../../../core/logger", () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));
  return import("../../../core/sse");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SSE Redis pub/sub — broadcastToUser", () => {
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(async () => {
    redis = makeRedisMock();
  });

  it("publishes to sse:user:{userId} and delivers to registered client", async () => {
    const { initSse, registerSseClient, broadcastToUser, unregisterSseClient } =
      await loadSse(redis);

    await initSse();

    const res = makeRes();
    registerSseClient("org-1", "user-1", res as any);

    broadcastToUser("user-1", "inbox:new", { conversationId: "conv-1" });

    // Allow microtask queue to flush
    await Promise.resolve();

    expect(redis.published).toHaveLength(1);
    expect(redis.published[0].channel).toBe("sse:user:user-1");
    const payload = JSON.parse(redis.published[0].message);
    expect(payload.event).toBe("inbox:new");
    expect(payload.data.conversationId).toBe("conv-1");

    // pSubscribe handler should have delivered the SSE frame to the local client
    expect(res.written).toHaveLength(1);
    expect(res.written[0]).toContain("event: inbox:new");
    expect(res.written[0]).toContain("conv-1");

    unregisterSseClient("org-1", "user-1", res as any);
  });
});

describe("SSE Redis pub/sub — broadcastToOrg", () => {
  it("publishes to sse:org:{orgId} and delivers to all clients in that org", async () => {
    const redis = makeRedisMock();
    const { initSse, registerSseClient, broadcastToOrg } = await loadSse(redis);

    await initSse();

    const res1 = makeRes();
    const res2 = makeRes();
    registerSseClient("org-5", "user-A", res1 as any);
    registerSseClient("org-5", "user-B", res2 as any);

    broadcastToOrg("org-5", "inbox:update", { conversationId: "cv-99", event: "assigned" });
    await Promise.resolve();

    expect(redis.published[0].channel).toBe("sse:org:org-5");
    // Both org clients must receive the frame
    expect(res1.written).toHaveLength(1);
    expect(res2.written).toHaveLength(1);
  });
});

describe("SSE in-process fallback (no Redis)", () => {
  it("delivers locally when _pub is null", async () => {
    vi.resetModules();
    // createClient throws to simulate Redis unavailable
    vi.doMock("redis", () => ({
      createClient: () => ({ connect: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")), on: vi.fn() }),
    }));
    vi.doMock("../../../core/config", () => ({
      config: { redis: { url: "redis://localhost:6379" } },
    }));
    vi.doMock("../../../core/logger", () => ({
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    const { initSse, registerSseClient, broadcastToUser } = await import("../../../core/sse");
    await initSse(); // will warn + leave _pub = null

    const res = makeRes();
    registerSseClient("org-x", "user-x", res as any);
    broadcastToUser("user-x", "inbox:new", { conversationId: "local-only" });

    expect(res.written).toHaveLength(1);
    expect(res.written[0]).toContain("local-only");
  });
});

describe("SSE — dead connection tolerance", () => {
  it("skips a closed connection without throwing", async () => {
    const redis = makeRedisMock();
    const { initSse, registerSseClient, broadcastToUser } = await loadSse(redis);
    await initSse();

    const res = makeRes();
    registerSseClient("org-1", "user-dead", res as any);
    res.simulateClose(); // res.write() will throw from here on

    expect(() => {
      broadcastToUser("user-dead", "inbox:new", {});
      // Redis handler fires synchronously via mock
    }).not.toThrow();
  });
});
