import { Request, Response, NextFunction } from "express";
import { ForbiddenError, AuthError } from "../errors";
import type { UserRole, UserPermissions } from "../types";

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

/** Require the caller to have at least the given role */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    const ok = roles.some((r) => ROLE_RANK[req.user!.role] >= ROLE_RANK[r]);
    if (!ok) return next(new ForbiddenError(`Requires role: ${roles.join(" or ")}`));
    next();
  };
}

/** Require the caller to have AT LEAST as high a role as `minRole` */
export function requireMinRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return next(new ForbiddenError(`Requires ${minRole} or above`));
    }
    next();
  };
}

/** Whether the user holds the given permission. Admins and above bypass per-user toggles. */
export function checkPermission(
  user: { role: UserRole; permissions: UserPermissions },
  key: keyof UserPermissions
): boolean {
  if (ROLE_RANK[user.role] >= ROLE_RANK["admin"]) return true;
  return Boolean(user.permissions[key]);
}

/** Require a specific permission key to be truthy on the calling user */
export function requirePermission(key: keyof UserPermissions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    if (!checkPermission(req.user, key)) {
      return next(new ForbiddenError(`Missing permission: ${key}`));
    }
    next();
  };
}

/** Ensure the resource's organisation_id matches the caller's org */
export function sameOrg(orgId: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthError());
    if (req.user.role === "super_admin") return next();
    if (req.user.organisationId !== orgId) return next(new ForbiddenError());
    next();
  };
}
