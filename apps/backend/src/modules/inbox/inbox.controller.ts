import { Request, Response, NextFunction } from "express";
import * as svc from "./inbox.service";
import {
  ListConversationsSchema,
  ReplySchema,
  AssignSchema,
} from "./inbox.schema";
import { ok, paginated } from "../../core/response";
import { ValidationError } from "../../core/errors";
import { registerSseClient, unregisterSseClient } from "../../core/sse";
import { issueStreamToken } from "../../core/middleware/auth.middleware";

export async function getStreamToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId, organisationId: orgId, role, permissions } = req.user!;
    const token = await issueStreamToken(
      userId,
      orgId,
      role,
      permissions as unknown as Record<string, boolean>
    );
    ok(res, { token });
  } catch (err) { next(err); }
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ListConversationsSchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));

    const { conversations, total } = await svc.listConversations(
      req.user!.organisationId,
      req.user!.id,
      req.user!.role,
      parsed.data
    );
    paginated(res, conversations, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) { next(err); }
}

export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const detail = await svc.getConversation(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.user!.role
    );
    ok(res, detail);
  } catch (err) { next(err); }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await svc.getInboxStats(
      req.user!.organisationId,
      req.user!.id,
      req.user!.role
    );
    ok(res, stats);
  } catch (err) { next(err); }
}

export async function replyConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ReplySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));

    const msg = await svc.replyToConversation(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.user!.role,
      parsed.data
    );
    ok(res, msg, "Reply sent");
  } catch (err) { next(err); }
}

export async function assignConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = AssignSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));

    const conv = await svc.assignConversation(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.user!.role,
      parsed.data
    );
    ok(res, conv, "Conversation assigned");
  } catch (err) { next(err); }
}

export async function closeConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const conv = await svc.closeConversation(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.user!.role
    );
    ok(res, conv, "Conversation closed");
  } catch (err) { next(err); }
}

export async function reopenConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const conv = await svc.reopenConversation(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.user!.role
    );
    ok(res, conv, "Conversation reopened");
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/inbox/stream
 * Server-Sent Events endpoint for real-time inbox updates.
 * Auth via ?token=<jwt> query param (EventSource cannot send headers).
 *
 * Events:
 *   connected   – handshake, sent immediately
 *   inbox:new   – a new inbound message arrived; data: { conversationId, channel, orgId }
 *   inbox:update – a conversation was reassigned/closed; data: { conversationId, event }
 *   heartbeat   – keepalive ping every 25 s
 */
export function streamInbox(req: Request, res: Response): void {
  const { id: userId, organisationId: orgId } = req.user!;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering
  res.flushHeaders();

  // Handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, orgId })}\n\n`);

  // Keepalive heartbeat every 25 s (some proxies kill idle SSE connections)
  const heartbeat = setInterval(() => {
    try { res.write("event: heartbeat\ndata: {}\n\n"); } catch { /* dead */ }
  }, 25_000);

  registerSseClient(orgId, userId, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterSseClient(orgId, userId, res);
  });
}
