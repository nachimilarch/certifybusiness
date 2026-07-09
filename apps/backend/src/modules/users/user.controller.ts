import { Request, Response, NextFunction } from "express";
import * as UserService from "./user.service";
import { ok, created, paginated, noContent, parsePagination } from "../../core/response";
import { writeAuditLog } from "../../core/middleware/audit.middleware";
import { ForbiddenError } from "../../core/errors";
import type { UserRole } from "../../core/types";

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const { users, total } = await UserService.listUsers(req.user!.organisationId, {
      page,
      limit,
      role: q.role as UserRole | undefined,
      isActive: q.isActive !== undefined ? q.isActive === "true" : undefined,
      search: q.search,
      managerId: q.managerId,
    });
    paginated(res, users, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.createUser(
      req.user!.organisationId,
      req.body,
      req.user!.id
    );
    await writeAuditLog(req, "user.create", "user", user.id, undefined, {
      email: user.email,
      role: user.role,
    });
    created(res, user, "User created");
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.getUserById(
      req.params.id,
      req.user!.organisationId
    );
    ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserService.updateUser(
      req.params.id,
      req.user!.organisationId,
      req.body,
      req.user!.role
    );
    await writeAuditLog(req, "user.update", "user", req.params.id, undefined, req.body);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function adminResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.adminResetPassword(
      req.params.id,
      req.user!.organisationId,
      req.body.newPassword
    );
    await writeAuditLog(req, "user.admin_reset_password", "user", req.params.id);
    ok(res, null, "Password reset. User sessions revoked.");
  } catch (err) {
    next(err);
  }
}

// ─── Designations ─────────────────────────────────────────────────────────────

export async function listDesignations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.listDesignations(req.user!.organisationId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createDesignation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.createDesignation(req.user!.organisationId, req.body);
    created(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deleteDesignation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.deleteDesignation(req.params.id, req.user!.organisationId);
    await writeAuditLog(req, "designation.delete", "designation", req.params.id);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

// ─── Permission Templates ────────────────────────────────────────────────────

export async function listPermissionTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.listPermissionTemplates(req.user!.organisationId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createPermissionTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.createPermissionTemplate(
      req.user!.organisationId,
      req.body,
      req.user!.id
    );
    created(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updatePermissionTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.updatePermissionTemplate(
      req.params.id,
      req.user!.organisationId,
      req.body
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deletePermissionTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.deletePermissionTemplate(req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function applyPermissionTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.applyPermissionTemplate(
      req.params.id,
      req.user!.organisationId,
      req.body.userIds
    );
    ok(res, null, "Template applied");
  } catch (err) {
    next(err);
  }
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export async function listTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.listTeams(req.user!.organisationId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.getTeamWithMembers(req.params.id, req.user!.organisationId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.createTeam(req.user!.organisationId, req.body);
    created(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await UserService.updateTeam(req.params.id, req.user!.organisationId, req.body);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.deleteTeam(req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function addTeamMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.addTeamMembers(req.params.id, req.user!.organisationId, req.body.userIds);
    ok(res, null, "Members added");
  } catch (err) {
    next(err);
  }
}

export async function removeTeamMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await UserService.removeTeamMember(req.params.teamId, req.params.userId, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}
