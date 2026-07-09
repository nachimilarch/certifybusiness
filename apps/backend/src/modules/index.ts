import { Express, Router } from "express";
import { authRouter } from "./auth/auth.routes";
import { orgRouter } from "./organizations/organization.routes";
import {
  userRouter,
  designationRouter,
  permissionTemplateRouter,
  teamRouter,
} from "./users/user.routes";
import { leadRouter } from "./leads/lead.routes";
import { callingRouter } from "./calling/calling.routes";
import { reportingRouter } from "./reporting/reporting.routes";
import { importRouter } from "./imports/import.routes";
import { channelRouter } from "./channels/channel.routes";
import { campaignRouter } from "./campaigns/campaign.routes";
import { webhookRouter } from "./webhooks/webhook.routes";
import { automationRouter } from "./automation/automation.routes";
import { notificationRouter } from "./notifications/notification.routes";
import { trackingRouter } from "./tracking/tracking.routes";
import { inboxRouter } from "./inbox/inbox.routes";
import { auditRouter } from "./audit/audit.routes";

export function registerRoutes(app: Express): void {
  const api = Router();

  // ── Phase B ──────────────────────────────────────────────────────────────
  api.use("/auth", authRouter);
  api.use("/orgs", orgRouter);
  api.use("/users", userRouter);
  api.use("/designations", designationRouter);
  api.use("/permission-templates", permissionTemplateRouter);
  api.use("/teams", teamRouter);

  // ── Phase C ──────────────────────────────────────────────────────────────
  api.use("/leads", leadRouter);
  api.use("/calling", callingRouter);
  api.use("/reporting", reportingRouter);
  api.use("/imports", importRouter);

  // ── Phase E ──────────────────────────────────────────────────────────────
  api.use("/channels", channelRouter);
  api.use("/campaigns", campaignRouter);

  // ── Phase F ──────────────────────────────────────────────────────────────
  api.use("/automation", automationRouter);
  api.use("/notifications", notificationRouter);
  api.use("/inbox", inboxRouter);
  api.use("/audit-logs", auditRouter);

  // Webhooks bypass /api/v1 prefix so external services can reach them easily
  app.use("/webhooks", webhookRouter);

  // Email tracking (open pixel, click redirect, unsubscribe) — no auth required
  app.use("/track", trackingRouter);

  app.use("/api/v1", api);
}
