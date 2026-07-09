import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireMinRole, requirePermission } from "../../core/middleware/rbac.middleware";
import * as ctrl from "./channel.controller";

export const channelRouter = Router();
channelRouter.use(authenticate);

// ─── Sender Identities ────────────────────────────────────────────────────────
channelRouter.get("/senders", ctrl.listSenders);
channelRouter.get("/senders/:id", ctrl.getSender);
channelRouter.post("/senders", requireMinRole("admin"), ctrl.createSender);
channelRouter.patch("/senders/:id", requireMinRole("admin"), ctrl.updateSender);
channelRouter.delete("/senders/:id", requireMinRole("admin"), ctrl.deleteSender);
channelRouter.post("/senders/:id/test", requireMinRole("admin"), ctrl.testSender);

// ─── Webhook URLs ─────────────────────────────────────────────────────────────
channelRouter.get("/webhook-urls", requireMinRole("admin"), ctrl.getWebhookUrls);

// ─── Templates ────────────────────────────────────────────────────────────────
channelRouter.get("/templates", ctrl.listTemplates);
channelRouter.get("/templates/:id", ctrl.getTemplate);
channelRouter.post("/templates", requirePermission("manage_templates"), ctrl.createTemplate);
channelRouter.patch("/templates/:id", requirePermission("manage_templates"), ctrl.updateTemplate);
channelRouter.delete("/templates/:id", requirePermission("manage_templates"), ctrl.deleteTemplate);
