import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors";
import { computeEffectivePermissions } from "../../core/permissions";
import { hashPassword } from "../auth/auth.service";
import type { UserRole, UserPermissions } from "../../core/types";
import type {
  CreateUserInput,
  UpdateUserInput,
  CreateDesignationInput,
  CreatePermissionTemplateInput,
  UpdatePermissionTemplateInput,
  CreateTeamInput,
  UpdateTeamInput,
} from "./user.schema";

// ─── Shared shape ─────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  designationId: string | null;
  designationName: string | null;
  managerId: string | null;
  managerName: string | null;
  permissions: UserPermissions;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToDTO(row: any): UserDTO {
  const rawPerms = row.permissions
    ? typeof row.permissions === "string"
      ? JSON.parse(row.permissions)
      : row.permissions
    : null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    role: row.role,
    designationId: row.designation_id ?? null,
    designationName: row.designation_name ?? null,
    managerId: row.manager_id ?? null,
    managerName:
      row.manager_first_name
        ? `${row.manager_first_name} ${row.manager_last_name}`.trim()
        : null,
    permissions: computeEffectivePermissions(row.role as UserRole, rawPerms),
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_SELECT = [
  "users.id",
  "users.organisation_id",
  "users.email",
  "users.first_name",
  "users.last_name",
  "users.role",
  "users.designation_id",
  "users.manager_id",
  "users.permissions",
  "users.is_active",
  "users.last_login_at",
  "users.created_at",
  "users.updated_at",
  "designations.name as designation_name",
  "managers.first_name as manager_first_name",
  "managers.last_name as manager_last_name",
];

function baseQuery(db: ReturnType<typeof getDb>) {
  return db("users")
    .leftJoin("designations", "users.designation_id", "designations.id")
    .leftJoin("users as managers", "users.manager_id", "managers.id")
    .select(USER_SELECT);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUser(
  orgId: string,
  input: CreateUserInput,
  createdBy: string
): Promise<UserDTO> {
  const db = getDb();

  const emailTaken = await db("users").where("email", input.email.toLowerCase()).first();
  if (emailTaken) throw new ConflictError(`Email "${input.email}" is already registered`);

  // Validate designation belongs to org
  if (input.designationId) {
    const des = await db("designations")
      .where({ id: input.designationId, organisation_id: orgId })
      .first();
    if (!des) throw new NotFoundError("Designation");
  }

  // Validate manager belongs to org
  if (input.managerId) {
    const mgr = await db("users")
      .where({ id: input.managerId, organisation_id: orgId })
      .first();
    if (!mgr) throw new NotFoundError("Manager");
  }

  const id = uuidv4();
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  await db("users").insert({
    id,
    organisation_id: orgId,
    email: input.email.toLowerCase(),
    password_hash: passwordHash,
    first_name: input.firstName,
    last_name: input.lastName,
    role: input.role,
    designation_id: input.designationId ?? null,
    manager_id: input.managerId ?? null,
    permissions: input.permissions ? JSON.stringify(input.permissions) : null,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return getUserById(id, orgId);
}

export async function listUsers(
  orgId: string,
  filters: {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
    managerId?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ users: UserDTO[]; total: number }> {
  const db = getDb();
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  function applyFilters(q: ReturnType<typeof db>) {
    q.where("users.organisation_id", orgId);
    if (filters.role) q.where("users.role", filters.role);
    if (filters.isActive !== undefined) q.where("users.is_active", filters.isActive);
    if (filters.managerId) q.where("users.manager_id", filters.managerId);
    if (filters.search) {
      const like = `%${filters.search}%`;
      q.where((w) =>
        w
          .whereLike("users.first_name", like)
          .orWhereLike("users.last_name", like)
          .orWhereLike("users.email", like)
      );
    }
    return q;
  }

  const [rows, countRows] = await Promise.all([
    applyFilters(baseQuery(db))
      .orderBy("users.created_at", "desc")
      .limit(limit)
      .offset(offset),
    applyFilters(db("users")).count("users.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { users: rows.map(rowToDTO), total };
}

export async function getUserById(id: string, orgId: string): Promise<UserDTO> {
  const db = getDb();
  const row = await baseQuery(db).where("users.id", id).first();
  if (!row || (row.organisation_id !== orgId && orgId !== "*")) {
    throw new NotFoundError("User");
  }
  return rowToDTO(row);
}

export async function updateUser(
  id: string,
  orgId: string,
  input: UpdateUserInput,
  actorRole: UserRole
): Promise<UserDTO> {
  const db = getDb();
  const user = await db("users").where({ id, organisation_id: orgId }).first();
  if (!user) throw new NotFoundError("User");

  // Prevent elevating to a role equal/above your own (admin can manage up to employee/manager)
  if (input.role && actorRole === "manager" && input.role !== "employee") {
    throw new ForbiddenError("Managers can only manage employee roles");
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.firstName !== undefined) updates.first_name = input.firstName;
  if (input.lastName !== undefined) updates.last_name = input.lastName;
  if (input.role !== undefined) updates.role = input.role;
  if ("designationId" in input) updates.designation_id = input.designationId ?? null;
  if ("managerId" in input) updates.manager_id = input.managerId ?? null;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.permissions !== undefined) {
    updates.permissions = input.permissions ? JSON.stringify(input.permissions) : null;
  }

  await db("users").where("id", id).update(updates);
  return getUserById(id, orgId);
}

export async function adminResetPassword(
  id: string,
  orgId: string,
  newPassword: string
): Promise<void> {
  const db = getDb();
  const user = await db("users").where({ id, organisation_id: orgId }).first();
  if (!user) throw new NotFoundError("User");

  const hash = await hashPassword(newPassword);
  await db.transaction(async (trx) => {
    await trx("users").where("id", id).update({ password_hash: hash, updated_at: new Date() });
    // Invalidate all existing sessions
    await trx("refresh_tokens").where("user_id", id).delete();
  });
}

// ─── Designations ─────────────────────────────────────────────────────────────

export async function listDesignations(orgId: string) {
  return getDb()("designations")
    .where("organisation_id", orgId)
    .orderBy("name")
    .select("id", "name", "created_at");
}

export async function createDesignation(orgId: string, input: CreateDesignationInput) {
  const db = getDb();
  const existing = await db("designations")
    .where({ organisation_id: orgId, name: input.name })
    .first();
  if (existing) throw new ConflictError(`Designation "${input.name}" already exists`);

  const id = uuidv4();
  await db("designations").insert({
    id,
    organisation_id: orgId,
    name: input.name,
    created_at: new Date(),
  });
  return { id, name: input.name };
}

export async function deleteDesignation(id: string, orgId: string): Promise<void> {
  const db = getDb();
  const des = await db("designations").where({ id, organisation_id: orgId }).first();
  if (!des) throw new NotFoundError("Designation");

  // Unlink users before deleting
  await db("users").where({ designation_id: id, organisation_id: orgId }).update({
    designation_id: null,
    updated_at: new Date(),
  });
  await db("designations").where("id", id).delete();
}

// ─── Permission Templates ────────────────────────────────────────────────────

export interface PermissionTemplateDTO {
  id: string;
  name: string;
  permissions: UserPermissions;
  createdAt: Date;
  updatedAt: Date;
}

export async function listPermissionTemplates(orgId: string): Promise<PermissionTemplateDTO[]> {
  const rows = await getDb()("permission_templates")
    .where("organisation_id", orgId)
    .orderBy("name")
    .select("id", "name", "permissions", "created_at", "updated_at");

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    permissions:
      typeof r.permissions === "string" ? JSON.parse(r.permissions) : r.permissions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createPermissionTemplate(
  orgId: string,
  input: CreatePermissionTemplateInput,
  createdBy: string
): Promise<PermissionTemplateDTO> {
  const db = getDb();
  const existing = await db("permission_templates")
    .where({ organisation_id: orgId, name: input.name })
    .first();
  if (existing) throw new ConflictError(`Template "${input.name}" already exists`);

  const id = uuidv4();
  const now = new Date();
  await db("permission_templates").insert({
    id,
    organisation_id: orgId,
    name: input.name,
    permissions: JSON.stringify(input.permissions),
    created_at: now,
    updated_at: now,
  });

  return { id, name: input.name, permissions: input.permissions, createdAt: now, updatedAt: now };
}

export async function updatePermissionTemplate(
  id: string,
  orgId: string,
  input: UpdatePermissionTemplateInput
): Promise<PermissionTemplateDTO> {
  const db = getDb();
  const tpl = await db("permission_templates").where({ id, organisation_id: orgId }).first();
  if (!tpl) throw new NotFoundError("Permission template");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name) updates.name = input.name;
  if (input.permissions) updates.permissions = JSON.stringify(input.permissions);

  await db("permission_templates").where("id", id).update(updates);
  const updated = await db("permission_templates").where("id", id).first();
  return {
    id: updated.id,
    name: updated.name,
    permissions:
      typeof updated.permissions === "string"
        ? JSON.parse(updated.permissions)
        : updated.permissions,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

export async function deletePermissionTemplate(id: string, orgId: string): Promise<void> {
  const db = getDb();
  const tpl = await db("permission_templates").where({ id, organisation_id: orgId }).first();
  if (!tpl) throw new NotFoundError("Permission template");
  await db("permission_templates").where("id", id).delete();
}

export async function applyPermissionTemplate(
  templateId: string,
  orgId: string,
  userIds: string[]
): Promise<void> {
  const db = getDb();
  const tpl = await db("permission_templates")
    .where({ id: templateId, organisation_id: orgId })
    .first();
  if (!tpl) throw new NotFoundError("Permission template");

  const permissions = typeof tpl.permissions === "string"
    ? tpl.permissions
    : JSON.stringify(tpl.permissions);

  await db("users")
    .whereIn("id", userIds)
    .where("organisation_id", orgId)
    .update({ permissions, updated_at: new Date() });
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export interface TeamDTO {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listTeams(orgId: string): Promise<TeamDTO[]> {
  const db = getDb();
  const rows = await db("teams")
    .leftJoin("users as mgr", "teams.manager_id", "mgr.id")
    .leftJoin("team_members as tm", "teams.id", "tm.team_id")
    .where("teams.organisation_id", orgId)
    .groupBy("teams.id", "mgr.first_name", "mgr.last_name")
    .select(
      "teams.id",
      "teams.name",
      "teams.manager_id",
      "teams.created_at",
      "teams.updated_at",
      "mgr.first_name as manager_first_name",
      "mgr.last_name as manager_last_name",
      db.raw("COUNT(tm.user_id) as member_count")
    )
    .orderBy("teams.name");

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    managerId: r.manager_id ?? null,
    managerName: r.manager_first_name
      ? `${r.manager_first_name} ${r.manager_last_name}`.trim()
      : null,
    memberCount: Number(r.member_count),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getTeamWithMembers(id: string, orgId: string) {
  const db = getDb();
  const team = await db("teams").where({ id, organisation_id: orgId }).first();
  if (!team) throw new NotFoundError("Team");

  const members = await db("team_members")
    .join("users", "team_members.user_id", "users.id")
    .leftJoin("designations", "users.designation_id", "designations.id")
    .where("team_members.team_id", id)
    .select(
      "users.id",
      "users.first_name",
      "users.last_name",
      "users.email",
      "users.role",
      "designations.name as designation_name"
    );

  return {
    id: team.id,
    name: team.name,
    managerId: team.manager_id ?? null,
    members,
    createdAt: team.created_at,
    updatedAt: team.updated_at,
  };
}

export async function createTeam(orgId: string, input: CreateTeamInput): Promise<TeamDTO> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("teams").insert({
      id,
      organisation_id: orgId,
      name: input.name,
      manager_id: input.managerId ?? null,
      created_at: now,
      updated_at: now,
    });

    if (input.memberIds?.length) {
      await trx("team_members").insert(
        input.memberIds.map((userId) => ({ team_id: id, user_id: userId, joined_at: now }))
      );
    }
  });

  const teams = await listTeams(orgId);
  return teams.find((t) => t.id === id)!;
}

export async function updateTeam(id: string, orgId: string, input: UpdateTeamInput): Promise<TeamDTO> {
  const db = getDb();
  const team = await db("teams").where({ id, organisation_id: orgId }).first();
  if (!team) throw new NotFoundError("Team");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name) updates.name = input.name;
  if ("managerId" in input) updates.manager_id = input.managerId ?? null;

  await db("teams").where("id", id).update(updates);
  const teams = await listTeams(orgId);
  return teams.find((t) => t.id === id)!;
}

export async function deleteTeam(id: string, orgId: string): Promise<void> {
  const db = getDb();
  const team = await db("teams").where({ id, organisation_id: orgId }).first();
  if (!team) throw new NotFoundError("Team");
  await db("teams").where("id", id).delete();
}

export async function addTeamMembers(
  teamId: string,
  orgId: string,
  userIds: string[]
): Promise<void> {
  const db = getDb();
  const team = await db("teams").where({ id: teamId, organisation_id: orgId }).first();
  if (!team) throw new NotFoundError("Team");

  const now = new Date();
  // Ignore duplicates with ignore strategy
  for (const userId of userIds) {
    await db("team_members")
      .insert({ team_id: teamId, user_id: userId, joined_at: now })
      .onConflict(["team_id", "user_id"])
      .ignore();
  }
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
  orgId: string
): Promise<void> {
  const db = getDb();
  const team = await db("teams").where({ id: teamId, organisation_id: orgId }).first();
  if (!team) throw new NotFoundError("Team");
  await db("team_members").where({ team_id: teamId, user_id: userId }).delete();
}
