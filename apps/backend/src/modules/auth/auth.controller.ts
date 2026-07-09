import { Request, Response, NextFunction } from "express";
import * as AuthService from "./auth.service";
import { ok } from "../../core/response";
import { writeAuditLog } from "../../core/middleware/audit.middleware";

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await AuthService.login(
      req.body.email,
      req.body.password,
      req.ip,
      req.get("user-agent")
    );
    await writeAuditLog(
      { ...req, user: { id: result.user.id, organisationId: result.user.organisationId } } as any,
      "auth.login",
      "user",
      result.user.id
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tokens = await AuthService.refreshTokens(
      req.body.refreshToken,
      req.ip,
      req.get("user-agent")
    );
    ok(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AuthService.logout(req.body.refreshToken);
    ok(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AuthService.logoutAll(req.user!.id);
    ok(res, null, "All sessions revoked");
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await AuthService.getMe(req.user!.id);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AuthService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    ok(res, null, "Password changed. Please log in again.");
  } catch (err) {
    next(err);
  }
}
