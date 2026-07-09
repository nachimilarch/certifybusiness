import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { requireMinRole, requirePermission } from "../../core/middleware/rbac.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import {
  CreateUserSchema,
  UpdateUserSchema,
  AdminResetPasswordSchema,
  CreateDesignationSchema,
  CreatePermissionTemplateSchema,
  UpdatePermissionTemplateSchema,
  ApplyTemplateSchema,
  CreateTeamSchema,
  UpdateTeamSchema,
  AddTeamMembersSchema,
} from "./user.schema";
import * as ctrl from "./user.controller";

export const userRouter = Router();

userRouter.use(authenticate);

// ─── Users ────────────────────────────────────────────────────────────────────
userRouter.get("/", requireMinRole("manager"), ctrl.listUsers);
userRouter.post("/", requireMinRole("admin"), validate(CreateUserSchema), ctrl.createUser);
userRouter.get("/:id", requireMinRole("manager"), ctrl.getUser);
userRouter.patch("/:id", requireMinRole("admin"), validate(UpdateUserSchema), ctrl.updateUser);
userRouter.post(
  "/:id/reset-password",
  requireMinRole("admin"),
  validate(AdminResetPasswordSchema),
  ctrl.adminResetPassword
);

// ─── Designations ─────────────────────────────────────────────────────────────
export const designationRouter = Router();
designationRouter.use(authenticate);

designationRouter.get("/", ctrl.listDesignations);
designationRouter.post("/", requireMinRole("admin"), validate(CreateDesignationSchema), ctrl.createDesignation);
designationRouter.delete("/:id", requireMinRole("admin"), ctrl.deleteDesignation);

// ─── Permission Templates ────────────────────────────────────────────────────
export const permissionTemplateRouter = Router();
permissionTemplateRouter.use(authenticate);

permissionTemplateRouter.get("/", requireMinRole("admin"), ctrl.listPermissionTemplates);
permissionTemplateRouter.post("/", requireMinRole("admin"), validate(CreatePermissionTemplateSchema), ctrl.createPermissionTemplate);
permissionTemplateRouter.patch("/:id", requireMinRole("admin"), validate(UpdatePermissionTemplateSchema), ctrl.updatePermissionTemplate);
permissionTemplateRouter.delete("/:id", requireMinRole("admin"), ctrl.deletePermissionTemplate);
permissionTemplateRouter.post("/:id/apply", requireMinRole("admin"), validate(ApplyTemplateSchema), ctrl.applyPermissionTemplate);

// ─── Teams ───────────────────────────────────────────────────────────────────
export const teamRouter = Router();
teamRouter.use(authenticate);

teamRouter.get("/", requireMinRole("manager"), ctrl.listTeams);
teamRouter.post("/", requireMinRole("admin"), validate(CreateTeamSchema), ctrl.createTeam);
teamRouter.get("/:id", requireMinRole("manager"), ctrl.getTeam);
teamRouter.patch("/:id", requireMinRole("admin"), validate(UpdateTeamSchema), ctrl.updateTeam);
teamRouter.delete("/:id", requireMinRole("admin"), ctrl.deleteTeam);
teamRouter.post("/:id/members", requireMinRole("admin"), validate(AddTeamMembersSchema), ctrl.addTeamMembers);
teamRouter.delete("/:teamId/members/:userId", requireMinRole("admin"), ctrl.removeTeamMember);
