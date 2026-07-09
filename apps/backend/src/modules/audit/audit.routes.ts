import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireMinRole } from "../../core/middleware/rbac.middleware";
import * as ctrl from "./audit.controller";

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(requireMinRole("admin"));

auditRouter.get("/", ctrl.getAuditLogs);
auditRouter.get("/actions", ctrl.getAuditActions);
