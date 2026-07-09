import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/rbac.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { LogCallSchema } from "./calling.schema";
import * as ctrl from "./calling.controller";

export const callingRouter = Router();
callingRouter.use(authenticate);

callingRouter.get("/queue", requirePermission("log_calls"), ctrl.getCallQueue);
callingRouter.post("/logs", requirePermission("log_calls"), validate(LogCallSchema), ctrl.logCall);
callingRouter.get("/logs", ctrl.listCallLogs);
callingRouter.get("/follow-ups", ctrl.getFollowUps);
callingRouter.get("/stats/me", ctrl.getMyStats);
