import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission, requireMinRole } from "../../core/middleware/rbac.middleware";
import * as ctrl from "./reporting.controller";

export const reportingRouter = Router();
reportingRouter.use(authenticate);

reportingRouter.get("/dashboard", ctrl.getDashboard);
reportingRouter.get("/team-performance", requireMinRole("manager"), ctrl.getTeamPerformance);
reportingRouter.get(
  "/team-performance/:managerId",
  requireMinRole("admin"),
  ctrl.getTeamPerformance
);
reportingRouter.get("/campaigns", requireMinRole("manager"), ctrl.getCampaignSummary);

reportingRouter.get("/leads-by-channel", requirePermission("view_reports"), ctrl.getLeadsByChannel);
reportingRouter.get("/leads-by-employee", requireMinRole("manager"), ctrl.getLeadsByEmployee);
reportingRouter.get("/conversion-funnel", requirePermission("view_reports"), ctrl.getConversionFunnel);
reportingRouter.get("/call-activity", requireMinRole("manager"), ctrl.getCallActivity);
