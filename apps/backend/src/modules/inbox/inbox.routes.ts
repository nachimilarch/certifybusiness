import { Router } from "express";
import { authenticate, authenticateSseToken } from "../../core/middleware/auth.middleware";
import * as ctrl from "./inbox.controller";

export const inboxRouter = Router();

// Issue a short-lived one-time stream token (requires normal JWT auth).
// The frontend fetches this before opening EventSource so the full JWT
// never appears in the SSE URL or server access logs.
inboxRouter.post("/stream-token", authenticate, ctrl.getStreamToken);

// SSE stream — validates a one-time token from ?t= (EventSource cannot send headers).
// Token is deleted from Redis on first use to prevent replay.
inboxRouter.get("/stream", authenticateSseToken, ctrl.streamInbox);

// All other inbox routes use standard header-based auth
inboxRouter.use(authenticate);

inboxRouter.get("/stats", ctrl.getStats);
inboxRouter.get("/", ctrl.listConversations);
inboxRouter.get("/:id", ctrl.getConversation);
inboxRouter.post("/:id/reply", ctrl.replyConversation);
inboxRouter.post("/:id/assign", ctrl.assignConversation);
inboxRouter.post("/:id/close", ctrl.closeConversation);
inboxRouter.post("/:id/reopen", ctrl.reopenConversation);
