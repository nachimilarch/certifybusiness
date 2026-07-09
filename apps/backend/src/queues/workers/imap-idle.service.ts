/**
 * IMAP IDLE service — near real-time inbound email ingestion.
 *
 * Guarantees:
 * - Persistent IMAP connection; reacts to "mail" events within seconds.
 * - Keepalive: sends NOOP every 10 s and re-enters IDLE every IMAP_IDLE_RENEW_MS.
 * - IDLE capability probe: if the server does NOT advertise IDLE support,
 *   falls back to a periodic fetch on REPLY_INBOX_POLL_INTERVAL_MS interval.
 * - Exponential back-off on reconnect (IMAP_RECONNECT_DELAY_MS → … → 5 min cap).
 * - Back-off resets on a successful connection.
 * - Initial unseen scan on connect to catch mail that arrived while disconnected.
 * - Clean shutdown via stopImapIdle() — called from server.ts SIGTERM handler.
 *
 * Enable: set REPLY_INBOX_MODE=idle in .env
 */

import Imap from "imap";
import { simpleParser } from "mailparser";
import { Readable } from "stream";
import { config } from "../../core/config";
import { logger } from "../../core/logger";
import type { ParsedImapMessage } from "./imap-message.processor";
import { processInboundMessages } from "./imap-message.processor";

// ─── State ─────────────────────────────────────────────────────────────────────

let _imap: Imap | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _fallbackTimer: ReturnType<typeof setInterval> | null = null;
let _mailDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _isShuttingDown = false;
let _reconnectDelayMs: number; // initialised in startImapIdle()
const MAX_RECONNECT_DELAY_MS = 5 * 60_000; // 5 min hard cap
// When a batch of messages arrives, GoDaddy can fire multiple rapid-fire
// "mail" events before the first _fetchUnseen() completes.  Debouncing
// collapses them into a single fetch so we never run concurrent unseen scans.
const MAIL_DEBOUNCE_MS = 300;

// Track whether the current IMAP connection ever emitted "ready".
// Used to distinguish a graceful reconnect from a failed connect attempt.
let _readyFiredOnCurrentConn = false;
// Number of consecutive attempts that never reached "ready".
// When this exceeds the threshold the service gives up on IDLE and falls
// back to polling for the remainder of the process lifetime.
let _consecutiveConnectFailures = 0;
const MAX_CONSECUTIVE_CONNECT_FAILURES = 5;

// ─── Metrics (in-process counters; expose via /health or Prometheus scrape) ───

export const imapMetrics = {
  connectAttempts: 0,
  connectSuccess: 0,   // "ready" fired
  disconnects: 0,
  idleRenews: 0,
  newMailEvents: 0,
  errors: 0,
  pollingFallbacks: 0, // switched to polling mode
};

// ─── Public API ────────────────────────────────────────────────────────────────

export function startImapIdle(): void {
  _isShuttingDown = false;
  _reconnectDelayMs = config.imap.reconnectDelayMs;

  if (!config.imap.host || !config.imap.user || !config.imap.password) {
    logger.warn("[imap-idle] credentials not configured — IDLE mode disabled");
    return;
  }
  _connect();
}

export function stopImapIdle(): void {
  _isShuttingDown = true;
  _cancelReconnect();
  _cancelFallback();
  if (_mailDebounceTimer) { clearTimeout(_mailDebounceTimer); _mailDebounceTimer = null; }
  if (_imap) {
    try { _imap.end(); } catch { /* ignore */ }
    _imap = null;
  }
  logger.info("[imap-idle] stopped");
}

// ─── Connection ────────────────────────────────────────────────────────────────

function _connect(): void {
  if (_isShuttingDown) return;

  imapMetrics.connectAttempts++;
  _readyFiredOnCurrentConn = false;

  logger.info("[imap-idle] connecting", {
    host: config.imap.host,
    port: config.imap.port,
    mode: "IDLE",
    attempt: imapMetrics.connectAttempts,
    consecutiveFailures: _consecutiveConnectFailures,
  });

  const imap = new Imap({
    user: config.imap.user!,
    password: config.imap.password!,
    host: config.imap.host!,
    port: config.imap.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    // Built-in keepalive: NOOP heartbeat + periodic IDLE re-issue
    keepalive: {
      interval: 10_000,                      // NOOP every 10 s
      idleInterval: config.imap.idleRenewMs, // re-enter IDLE per IMAP_IDLE_RENEW_MS
      forceNoop: false,                      // prefer IDLE, fall back to NOOP
    },
  });

  _imap = imap;
  imap.once("ready", _onReady);
  imap.on("mail", _onMail);
  imap.once("error", _onError);
  imap.once("close", _onClose);
  imap.connect();
}

function _onReady(this: Imap): void {
  _readyFiredOnCurrentConn = true;
  _consecutiveConnectFailures = 0;
  _reconnectDelayMs = config.imap.reconnectDelayMs; // reset backoff on success
  imapMetrics.connectSuccess++;
  logger.info("[imap-idle] authenticated, opening INBOX", {
    connectSuccess: imapMetrics.connectSuccess,
  });

  _imap!.openBox("INBOX", false, (err) => {
    if (err) {
      logger.error("[imap-idle] failed to open INBOX", { err: err.message });
      _imap!.end();
      return;
    }

    // ── IDLE capability probe ──────────────────────────────────────────────
    const supportsIdle = _imap!.serverSupports("IDLE");
    if (!supportsIdle) {
      logger.warn("[imap-idle] server does not support IDLE — falling back to polling", {
        intervalMs: config.imap.pollIntervalMs,
      });
      _startFallbackPolling();
      return;
    }

    logger.info("[imap-idle] INBOX open — IDLE active, waiting for new mail", {
      idleRenewMs: config.imap.idleRenewMs,
      mode: "idle",
    });
    imapMetrics.idleRenews++;

    // Catch any mail that arrived while we were offline
    _fetchUnseen().catch((e: unknown) =>
      logger.warn("[imap-idle] initial unseen scan failed", { err: (e as Error).message })
    );
  });
}

function _onMail(numNew: number): void {
  imapMetrics.newMailEvents++;
  logger.info("[imap-idle] ← new mail signal", { numNew, totalMailEvents: imapMetrics.newMailEvents });

  // Debounce: if multiple mail events arrive in quick succession (e.g. GoDaddy
  // delivering a backlog), collapse them into one _fetchUnseen() call.
  if (_mailDebounceTimer) clearTimeout(_mailDebounceTimer);
  _mailDebounceTimer = setTimeout(() => {
    _mailDebounceTimer = null;
    _fetchUnseen().catch((e: unknown) =>
      logger.warn("[imap-idle] on-mail fetch failed", { err: (e as Error).message })
    );
  }, MAIL_DEBOUNCE_MS);
}

function _onError(err: Error): void {
  imapMetrics.errors++;
  logger.error("[imap-idle] connection error", {
    err: err.message,
    errors: imapMetrics.errors,
    consecutiveFailures: _consecutiveConnectFailures,
  });
  // _onClose will also fire after an error — let _onClose drive reconnect logic
  // so we don't double-schedule or double-count.
}

function _onClose(hadError: boolean): void {
  if (_isShuttingDown) return;

  imapMetrics.disconnects++;

  // Only count as a consecutive failure if this connection never became ready.
  // A healthy connect-then-close (e.g. server-side idle timeout) resets the counter.
  if (!_readyFiredOnCurrentConn) {
    _consecutiveConnectFailures++;
  } else {
    _consecutiveConnectFailures = 0;
  }

  logger.warn("[imap-idle] connection closed", {
    hadError,
    disconnects: imapMetrics.disconnects,
    consecutiveFailures: _consecutiveConnectFailures,
  });

  _cancelFallback();

  if (_consecutiveConnectFailures >= MAX_CONSECUTIVE_CONNECT_FAILURES) {
    imapMetrics.pollingFallbacks++;
    logger.warn("[imap-idle] too many consecutive failures — switching to polling for this session", {
      failures: _consecutiveConnectFailures,
      intervalMs: config.imap.pollIntervalMs,
    });
    _startFallbackPolling();
    return; // do not attempt reconnect
  }

  _scheduleReconnect();
}

// ─── Reconnect ─────────────────────────────────────────────────────────────────

function _scheduleReconnect(): void {
  if (_isShuttingDown || _reconnectTimer) return;

  logger.info("[imap-idle] reconnect scheduled", { delayMs: _reconnectDelayMs });
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    _reconnectDelayMs = Math.min(_reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    _connect();
  }, _reconnectDelayMs);
}

function _cancelReconnect(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
}

// ─── Fallback polling (when IDLE not supported) ────────────────────────────────

function _startFallbackPolling(): void {
  if (_fallbackTimer) return;
  _fallbackTimer = setInterval(() => {
    _fetchUnseen().catch((e: unknown) =>
      logger.warn("[imap-idle] fallback poll failed", { err: (e as Error).message })
    );
  }, config.imap.pollIntervalMs);
  logger.info("[imap-idle] fallback polling started", { intervalMs: config.imap.pollIntervalMs });
}

function _cancelFallback(): void {
  if (_fallbackTimer) { clearInterval(_fallbackTimer); _fallbackTimer = null; }
}

// ─── Message fetch + parse ─────────────────────────────────────────────────────

async function _fetchUnseen(): Promise<void> {
  if (!_imap) return;

  const uids = await new Promise<number[]>((resolve, reject) => {
    _imap!.search(["UNSEEN"], (err, results) => {
      if (err) reject(err);
      else resolve(results ?? []);
    });
  });

  if (uids.length === 0) {
    logger.debug("[imap-idle] no unseen messages");
    return;
  }

  logger.info("[imap-idle] fetching unseen messages", { count: uids.length });
  const messages = await _parseMessages(uids);
  logger.info("[imap-idle] parsed messages", { parsed: messages.length, fetched: uids.length });
  const processed = await processInboundMessages(messages, config.imap.orgId ?? undefined);
  logger.info("[imap-idle] processing complete", { processed, parsed: messages.length });
}

function _parseMessages(uids: number[]): Promise<ParsedImapMessage[]> {
  return new Promise((resolve, reject) => {
    const results: ParsedImapMessage[] = [];
    // Each message body is parsed asynchronously. Collect the per-message
    // promises so we can wait for all of them in fetch.once("end") — without
    // this, fetch.once("end") resolves before any simpleParser call completes
    // and results is always empty.
    const pending: Promise<void>[] = [];
    const fetch = _imap!.fetch(uids, { bodies: "", markSeen: true });

    fetch.on("message", (msg) => {
      const chunks: Buffer[] = [];
      msg.on("body", (stream) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      });

      const msgPromise = new Promise<void>((msgResolve) => {
        msg.once("end", async () => {
          try {
            const parsed = await simpleParser(Readable.from(Buffer.concat(chunks)));

            const refsRaw = parsed.references;
            const refs: string[] = Array.isArray(refsRaw)
              ? refsRaw
              : typeof refsRaw === "string"
              ? refsRaw.split(/\s+/).filter(Boolean)
              : [];

            const toAddresses: string[] = [];
            if (parsed.to) {
              const toArr = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
              for (const addrObj of toArr) {
                if (addrObj && typeof addrObj === "object" && "value" in addrObj) {
                  for (const a of (addrObj as any).value) {
                    if (a.address) toAddresses.push(a.address as string);
                  }
                }
              }
            }

            results.push({
              from: parsed.from?.value?.[0]?.address ?? parsed.from?.text ?? "",
              to: toAddresses,
              inReplyTo: (parsed.inReplyTo ?? null) as string | null,
              references: refs,
              subject: parsed.subject ?? "",
              text: parsed.text ?? null,
              html: typeof parsed.html === "string" ? parsed.html : null,
              messageId: parsed.messageId ?? null,
            });
          } catch (parseErr) {
            logger.warn("[imap-idle] failed to parse message", { err: parseErr });
          } finally {
            msgResolve();
          }
        });
      });

      pending.push(msgPromise);
    });

    fetch.once("error", reject);
    // All IMAP wire bytes have been received, but simpleParser calls are still
    // in flight. Wait for every pending parser before resolving.
    fetch.once("end", () => {
      Promise.all(pending).then(() => resolve(results)).catch(reject);
    });
  });
}
