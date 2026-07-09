import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission, requireMinRole } from "../../core/middleware/rbac.middleware";
import * as ctrl from "./automation.controller";

export const automationRouter = Router();
automationRouter.use(authenticate);
automationRouter.use(requirePermission("manage_automation"));

automationRouter.get("/rules", ctrl.listRules);
automationRouter.get("/rules/:id", ctrl.getRule);
automationRouter.post("/rules", ctrl.createRule);
automationRouter.patch("/rules/:id", ctrl.updateRule);
automationRouter.delete("/rules/:id", ctrl.deleteRule);

automationRouter.get("/logs", ctrl.listLogs);
