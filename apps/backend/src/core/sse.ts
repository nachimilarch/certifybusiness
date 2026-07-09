/**
 * SSE broadcaster — Redis pub/sub edition.
 *
 * Architecture
 * ─────────────
 * • broadcastToUser / broadcastToOrg  →  publish to Redis channel
 * • One shared pSubscribe("sse:*") per process  →  delivers to local HTTP
 *   connections stored in _localUserClients / _localOrgClients
 *
 * Multi-process safety
 * ─────────────────────
 * Each Node process has its own SSE connection pool.  Redis pub/sub bridges
 * the gap: a broadcast on process A is published to Redis and re-delivered
 * on every other process that holds matching connections.
 *
 * Single-process / no-Redis fallback
 * ────────────────────────────────────
 * If initSse() has not been called (or Redis is unavailable), broadcasts fall
 * back to in-process delivery only.  This keeps single-process / local-dev
 * setups working without any Redis change.
 *
 * Channel naming
 * ───────────────
 *   sse:user:{userId}  — events for a specific employee
 *   sse:org:{orgId}    — events for all admins watching an org inbox
 *
 * Event names (preserve existing frontend contract)
 *   inbox:new     – new inbound message received
 *   inbox:update  – conversation assigned / closed / read
 *   inbox:stats   – unread counts changed (triggers stats cache invalidation)
 */

import type { Response } from "express";
import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger";
import { config } from "./config";

// ─── Local connection pools (per-process) ─────────────────────────────────────

const _localUserClients = new Map<string, Set<Response>>();
const _localOrgClients = new Map<string, Set<Response>>();

// ─── Redis pub/sub ────────────────────────────────────────────────────────────

let _pub: ReturnType<typeof createClient> | null = null;
let _sub: ReturnType<typeof createClient> | null = null;

export async function initSse(): Promise<void> {
  try {
    _pub = createClient({ url: config.redis.url });
    _sub = createClient({ url: config.redis.url });

    _pub.on("error", (e: Error) =>
      logger.error("[sse] pub Redis error", { err: e.message })
    );
    _sub.on("error", (e: Error) =>
      logger.error("[sse] sub Redis error", { err: e.message })
    );

    await _pub.connect();
    await _sub.connect();

    // Pattern-subscribe: match sse:user:* and sse:org:*
    await (_sub as any).pSubscribe("sse:*", (message: string, channel: string) => {
      try {
        const payload = JSON.parse(message) as { event: string; data: unknown };
        _deliverLocally(channel, payload.event, payload.data);
      } catch {
        logger.warn("[sse] malformed pub/sub message", { channel });
      }
    });

    logger.info("[sse] Redis pub/sub ready");
  } catch (err) {
    logger.warn("[sse] Redis init failed — falling back to in-process SSE only", {
      err: (err as Error).message,
    });
    _pub = null;
    _sub = null;
  }
}

export async function closeSse(): Promise<void> {
  try {
    await (_sub as any)?.pUnsubscribe();
    await _sub?.quit();
    await _pub?.quit();
  } catch { /* ignore on shutdown */ }
  _sub = null;
  _pub = null;
}

// ─── Registration ──────────────────────────────────────────────────────────────

export function registerSseClient(orgId: string, userId: string, res: Response): void {
  if (!_localUserClients.has(userId)) _localUserClients.set(userId, new Set());
  _localUserClients.get(userId)!.add(res);

  if (!_localOrgClients.has(orgId)) _localOrgClients.set(orgId, new Set());
  _localOrgClients.get(orgId)!.add(res);

  logger.debug("[sse] client registered", {
    orgId,
    userId,
    localUsers: _localUserClients.size,
    localOrgs: _localOrgClients.size,
  });
}

export function unregisterSseClient(orgId: string, userId: string, res: Response): void {
  _localUserClients.get(userId)?.delete(res);
  _localOrgClients.get(orgId)?.delete(res);

  // Prune empty sets to avoid memory leaks over time
  if (_localUserClients.get(userId)?.size === 0) _localUserClients.delete(userId);
  if (_localOrgClients.get(orgId)?.size === 0) _localOrgClients.delete(orgId);

  logger.debug("[sse] client unregistered", { orgId, userId });
}

// ─── Broadcast (publish → Redis → all processes) ──────────────────────────────

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  if (_pub) {
    (_pub as RedisClientType).publish(
      `sse:user:${userId}`,
      JSON.stringify({ event, data })
    ).catch((e: Error) =>
      logger.warn("[sse] publish to user failed", { userId, err: e.message })
    );
  } else {
    // In-process fallback (no Redis)
    _deliverLocally(`sse:user:${userId}`, event, data);
  }
}

export function broadcastToOrg(orgId: string, event: string, data: unknown): void {
  if (_pub) {
    (_pub as RedisClientType).publish(
      `sse:org:${orgId}`,
      JSON.stringify({ event, data })
    ).catch((e: Error) =>
      logger.warn("[sse] publish to org failed", { orgId, err: e.message })
    );
  } else {
    _deliverLocally(`sse:org:${orgId}`, event, data);
  }
}

// ─── Local delivery (called by pSubscribe handler OR in-process fallback) ─────

function _deliverLocally(channel: string, event: string, data: unknown): void {
  const raw = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  if (channel.startsWith("sse:user:")) {
    const userId = channel.slice("sse:user:".length);
    _writeToSet(_localUserClients.get(userId), raw);
  } else if (channel.startsWith("sse:org:")) {
    const orgId = channel.slice("sse:org:".length);
    _writeToSet(_localOrgClients.get(orgId), raw);
  }
}

function _writeToSet(clients: Set<Response> | undefined, raw: string): void {
  if (!clients?.size) return;
  for (const res of clients) {
    try { res.write(raw); } catch { /* connection already closed */ }
  }
}
