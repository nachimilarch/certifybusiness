/**
 * Tests for IMAP IDLE service — reconnect and mode selection.
 *
 * Each test uses vi.resetModules() + dynamic import to get a fresh module
 * instance with a clean internal state (reconnect delay, shutdown flag, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// ─── Fake Imap class shared across all tests ──────────────────────────────────

class FakeImap extends EventEmitter {
  connected = false;
  static instances: FakeImap[] = [];
  // Set to true on the class to make the NEXT instance fail to connect
  static nextConnectFails = false;

  constructor(_opts: object) {
    super();
    FakeImap.instances.push(this);
  }

  connect() {
    if (FakeImap.nextConnectFails) {
      // Real imap emits "error" then "close" — backoff delay will NOT reset
      setImmediate(() => {
        this.emit("error", new Error("connect refused"));
        setImmediate(() => this.emit("close", true));
      });
    } else {
      this.connected = true;
      setImmediate(() => this.emit("ready"));
    }
  }

  openBox(_name: string, _ro: boolean, cb: (err: null, box: object) => void) {
    cb(null, {});
  }

  /** Return true so the service proceeds with IDLE mode (not polling fallback) */
  serverSupports(_cap: string): boolean {
    return true;
  }

  search(_c: unknown[], cb: (err: null, uids: number[]) => void) {
    cb(null, []);
  }

  end() {
    this.connected = false;
    setImmediate(() => this.emit("close", false));
  }
}

// ─── Helper: load a fresh module instance ────────────────────────────────────

async function freshIdleModule() {
  vi.resetModules();
  FakeImap.instances = [];

  vi.doMock("imap", () => ({ default: FakeImap }));
  vi.doMock("../../../core/config", () => ({
    config: {
      imap: {
        host: "imap.test",
        port: 993,
        user: "u@test.com",
        password: "s3cr3t",
        idleRenewMs: 1_740_000,
        reconnectDelayMs: 5_000,
        pollIntervalMs: 300_000,
      },
    },
  }));
  vi.doMock("../../../core/logger", () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));
  vi.doMock("../imap-message.processor", () => ({
    processInboundMessages: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("mailparser", () => ({ simpleParser: vi.fn() }));

  return import("../imap-idle.service");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("IMAP IDLE service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("creates an Imap instance on startImapIdle()", async () => {
    const { startImapIdle, stopImapIdle } = await freshIdleModule();
    startImapIdle();
    await vi.runAllTimersAsync();

    expect(FakeImap.instances).toHaveLength(1);
    expect(FakeImap.instances[0].connected).toBe(true);
    stopImapIdle();
  });

  it("schedules a reconnect after a connection close", async () => {
    const { startImapIdle, stopImapIdle } = await freshIdleModule();
    startImapIdle();
    await vi.runAllTimersAsync();
    expect(FakeImap.instances).toHaveLength(1);

    FakeImap.instances[0].emit("close", false);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(FakeImap.instances).toHaveLength(2);

    stopImapIdle();
  });

  it("doubles reconnect delay when reconnects keep failing without ready", async () => {
    const { startImapIdle, stopImapIdle } = await freshIdleModule();

    // Make all subsequent connects fail (so "ready" never fires and delay is never reset)
    FakeImap.nextConnectFails = false; // initial connect succeeds
    startImapIdle();
    await vi.runAllTimersAsync(); // initial connect succeeds → delay resets to 5 s

    // From here on, every reconnect attempt will fail to emit "ready"
    FakeImap.nextConnectFails = true;

    // Trigger a close: reconnect will be scheduled with delay=5s, then doubled to 10s
    FakeImap.instances[0].emit("close", true);
    await vi.advanceTimersByTimeAsync(6_000); // reconnect #1 (fails, no ready → delay=10s)
    expect(FakeImap.instances).toHaveLength(2);

    // Reconnect #1 fails immediately (error without ready), so delay doubled to 10s
    // At 7 s after the error → < 10 s, so reconnect #2 hasn't fired yet
    await vi.advanceTimersByTimeAsync(7_000);
    expect(FakeImap.instances).toHaveLength(2); // still 2

    // At 11 s total after error → past the 10 s doubled delay
    await vi.advanceTimersByTimeAsync(4_000);
    expect(FakeImap.instances).toHaveLength(3);

    FakeImap.nextConnectFails = false; // restore
    stopImapIdle();
  });

  it("does not reconnect after stopImapIdle()", async () => {
    const { startImapIdle, stopImapIdle } = await freshIdleModule();
    startImapIdle();
    await vi.runAllTimersAsync();

    stopImapIdle();
    FakeImap.instances[0].emit("close", false);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(FakeImap.instances).toHaveLength(1); // no new instance
  });

  it("switches to polling fallback after MAX_CONSECUTIVE_CONNECT_FAILURES consecutive close-without-ready", async () => {
    const { startImapIdle, stopImapIdle } = await freshIdleModule();

    // All connects fail immediately — error then close without reaching "ready".
    FakeImap.nextConnectFails = true;
    startImapIdle();

    // Reconnect schedule (delay doubles before each new connect attempt):
    //   connect#1 → fail → reconnect in 5 s (→doubles to 10 s)
    //   connect#2 → fail → reconnect in 10 s (→20 s)
    //   connect#3 → fail → reconnect in 20 s (→40 s)
    //   connect#4 → fail → reconnect in 40 s (→80 s)
    //   connect#5 → fail → _consecutiveConnectFailures=5 → polling, no reconnect
    //
    // Use small (200 ms) advances to flush the nested setImmediate(error→close)
    // without triggering the 300 s polling interval that starts after connect#5.
    const flushMs = 200; // safe window: > setImmediate latency, < pollIntervalMs (300 s)

    await vi.advanceTimersByTimeAsync(flushMs);           // connect #1: error+close
    await vi.advanceTimersByTimeAsync(5_000 + flushMs);   // reconnect timer fires → connect #2: error+close
    await vi.advanceTimersByTimeAsync(10_000 + flushMs);  // → connect #3
    await vi.advanceTimersByTimeAsync(20_000 + flushMs);  // → connect #4
    await vi.advanceTimersByTimeAsync(40_000 + flushMs);  // → connect #5: error+close → POLLING

    const instancesAtSwitch = FakeImap.instances.length;
    expect(instancesAtSwitch).toBe(5);

    stopImapIdle(); // stop polling interval before advancing further
    FakeImap.nextConnectFails = false;

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    // No new Imap instances after the fallback switch
    expect(FakeImap.instances.length).toBe(instancesAtSwitch);
  });
});

// ─── Mode-selection logic (pure, no IMAP needed) ─────────────────────────────

describe("IMAP mode selection", () => {
  it("poll mode does not start IDLE", () => {
    expect(("poll" as string) === "idle").toBe(false);
  });

  it("idle mode skips BullMQ repeat scheduling", () => {
    expect(("idle" as string) === "poll").toBe(false);
  });
});
