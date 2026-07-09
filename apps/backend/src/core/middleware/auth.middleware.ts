import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AuthError } from "../errors";
import type { AuthUser } from "../types";

// ─── One-time stream token helpers ────────────────────────────────────────────

const STREAM_TOKEN_TTL_S = 30;

/** Issue a short-lived opaque stream token backed by Redis. */
export async function issueStreamToken(
  userId: string,
  orgId: string,
  role: string,
  permissions: Record<string, boolean>
): Promise<string> {
  const { getRedis } = await import("../redis");
  const token = randomUUID();
  await getRedis().set(
    `sse:token:${token}`,
    JSON.stringify({ userId, orgId, role, permissions }),
    { EX: STREAM_TOKEN_TTL_S }
  );
  return token;
}

/** Express middleware: validates a one-time stream token from `?t=` query param.
 *  Deletes the token from Redis on first use (getDel) to prevent replay. */
export async function authenticateSseToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = typeof req.query.t === "string" ? req.query.t : null;
    if (!token) throw new AuthError("Missing stream token");

    const { getRedis } = await import("../redis");
    const raw = await getRedis().getDel(`sse:token:${token}`);
    if (!raw) throw new AuthError("Invalid or expired stream token");

    const { userId, orgId, role, permissions } = JSON.parse(raw) as {
      userId: string;
      orgId: string;
      role: string;
      permissions: Record<string, boolean>;
    };

    req.user = {
      id: userId,
      organisationId: orgId,
      email: "",
      role: role as AuthUser["role"],
      permissions: permissions as AuthUser["permissions"],
    };
    req.organisationId = orgId;
    next();
  } catch (err) {
    if (err instanceof AuthError) return next(err);
    next(new AuthError("Invalid or expired stream token"));
  }
}

export interface AccessTokenPayload {
  sub: string;
  orgId: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
  iat: number;
  exp: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AuthError("Missing Bearer token");

    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;

    req.user = {
      id: payload.sub,
      organisationId: payload.orgId,
      email: payload.email,
      role: payload.role as AuthUser["role"],
      permissions: payload.permissions as AuthUser["permissions"],
    };
    req.organisationId = payload.orgId;
    next();
  } catch (err) {
    if (err instanceof AuthError) return next(err);
    next(new AuthError("Invalid or expired token"));
  }
}

/** SSE variant: also accepts token from ?token= query param (EventSource can't send headers). */
export function authenticateSse(req: Request, res: Response, next: NextFunction): void {
  try {
    // Try Authorization header first, then ?token query param
    const header = req.headers.authorization;
    const rawToken = header?.startsWith("Bearer ")
      ? header.slice(7)
      : typeof req.query.token === "string"
      ? req.query.token
      : null;

    if (!rawToken) throw new AuthError("Missing token");

    const payload = jwt.verify(rawToken, config.jwt.accessSecret) as AccessTokenPayload;
    req.user = {
      id: payload.sub,
      organisationId: payload.orgId,
      email: payload.email,
      role: payload.role as AuthUser["role"],
      permissions: payload.permissions as AuthUser["permissions"],
    };
    req.organisationId = payload.orgId;
    next();
  } catch (err) {
    if (err instanceof AuthError) return next(err);
    next(new AuthError("Invalid or expired token"));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const payload = jwt.verify(
      header.slice(7),
      config.jwt.accessSecret
    ) as AccessTokenPayload;
    req.user = {
      id: payload.sub,
      organisationId: payload.orgId,
      email: payload.email,
      role: payload.role as AuthUser["role"],
      permissions: payload.permissions as AuthUser["permissions"],
    };
    req.organisationId = payload.orgId;
  } catch {
    // intentionally ignore — optional auth
  }
  next();
}
