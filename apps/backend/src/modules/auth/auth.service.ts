import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { config } from "../../core/config";
import { hashToken } from "../../core/encryption";
import { computeEffectivePermissions } from "../../core/permissions";
import { AuthError, NotFoundError } from "../../core/errors";
import type { UserRow, UserRole, UserPermissions } from "../../core/types";

const BCRYPT_ROUNDS = 12;

// ─── Token helpers ────────────────────────────────────────────────────────────

function parseStoredPermissions(raw: UserRow["permissions"]): UserPermissions | null {
  if (!raw) return null;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as UserPermissions;
}

function buildAccessToken(user: UserRow): string {
  const perms = computeEffectivePermissions(user.role, parseStoredPermissions(user.permissions));
  return jwt.sign(
    {
      sub: user.id,
      orgId: user.organisation_id,
      email: user.email,
      role: user.role,
      permissions: perms,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"] }
  );
}

async function storeRefreshToken(
  userId: string,
  rawToken: string,
  ip?: string,
  ua?: string
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
  await db("refresh_tokens").insert({
    id: uuidv4(),
    user_id: userId,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt,
    ip_address: ip ?? null,
    user_agent: ua ?? null,
    created_at: new Date(),
  });
}

async function rotateRefreshToken(
  userId: string,
  oldRaw: string,
  ip?: string,
  ua?: string
): Promise<string> {
  const db = getDb();
  // Delete old token
  await db("refresh_tokens").where("token_hash", hashToken(oldRaw)).delete();
  // Issue new one
  const newRaw = crypto.randomBytes(64).toString("hex");
  await storeRefreshToken(userId, newRaw, ip, ua);
  return newRaw;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: SafeUser;
}

export interface SafeUser {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: UserPermissions;
}

function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    permissions: computeEffectivePermissions(row.role, parseStoredPermissions(row.permissions)),
  };
}

export async function login(
  email: string,
  password: string,
  ip?: string,
  ua?: string
): Promise<LoginResult> {
  const db = getDb();

  const user = await db<UserRow>("users")
    .where({ email: email.toLowerCase().trim() })
    .first();

  if (!user || !user.is_active) throw new AuthError("Invalid email or password");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AuthError("Invalid email or password");

  // Update last_login_at
  await db("users").where("id", user.id).update({ last_login_at: new Date() });

  const rawRefresh = crypto.randomBytes(64).toString("hex");
  await storeRefreshToken(user.id, rawRefresh, ip, ua);

  return {
    accessToken: buildAccessToken(user),
    refreshToken: rawRefresh,
    user: toSafeUser(user),
  };
}

export async function refreshTokens(
  rawRefreshToken: string,
  ip?: string,
  ua?: string
): Promise<AuthTokens> {
  const db = getDb();

  const stored = await db("refresh_tokens")
    .where("token_hash", hashToken(rawRefreshToken))
    .where("expires_at", ">", new Date())
    .first();

  if (!stored) throw new AuthError("Invalid or expired refresh token");

  const user = await db<UserRow>("users")
    .where({ id: stored.user_id, is_active: true })
    .first();

  if (!user) throw new AuthError("User not found or inactive");

  const newRawRefresh = await rotateRefreshToken(user.id, rawRefreshToken, ip, ua);

  return {
    accessToken: buildAccessToken(user),
    refreshToken: newRawRefresh,
  };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await getDb()("refresh_tokens")
    .where("token_hash", hashToken(rawRefreshToken))
    .delete();
}

export async function logoutAll(userId: string): Promise<void> {
  await getDb()("refresh_tokens").where("user_id", userId).delete();
}

export async function getMe(userId: string): Promise<SafeUser & { designationName?: string }> {
  const db = getDb();
  const row = await db<UserRow>("users")
    .leftJoin("designations", "users.designation_id", "designations.id")
    .select("users.*", "designations.name as designation_name")
    .where("users.id", userId)
    .first();

  if (!row) throw new NotFoundError("User");
  return { ...toSafeUser(row), designationName: (row as any).designation_name ?? undefined };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = getDb();
  const user = await db<UserRow>("users").where("id", userId).first();
  if (!user) throw new NotFoundError("User");

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new AuthError("Current password is incorrect");

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db("users").where("id", userId).update({ password_hash: hash, updated_at: new Date() });
  // Revoke all refresh tokens (force re-login everywhere)
  await logoutAll(userId);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
