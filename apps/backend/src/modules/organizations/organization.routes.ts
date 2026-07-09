import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireRole, requireMinRole } from "../../core/middleware/rbac.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { CreateOrgSchema, UpdateOrgSchema } from "./organization.schema";
import * as ctrl from "./organization.controller";

export const orgRouter = Router();

orgRouter.use(authenticate);

// Super admin: list + create orgs
orgRouter.get("/", requireRole("super_admin"), ctrl.listOrgs);
orgRouter.post("/", requireRole("super_admin"), validate(CreateOrgSchema), ctrl.createOrg);

// Admin+: get + update their own org (super_admin can target any)
orgRouter.get("/:id", requireMinRole("admin"), ctrl.getOrg);
orgRouter.patch("/:id", requireMinRole("admin"), validate(UpdateOrgSchema), ctrl.updateOrg);
