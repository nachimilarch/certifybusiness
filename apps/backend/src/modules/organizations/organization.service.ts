import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { ConflictError, NotFoundError } from "../../core/errors";
import { hashPassword } from "../auth/auth.service";
import type { CreateOrgInput, UpdateOrgInput } from "./organization.schema";

export interface OrgWithStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  user_count: number;
  created_at: Date;
  updated_at: Date;
}

export async function createOrg(input: CreateOrgInput): Promise<OrgWithStats> {
  const db = getDb();

  const existing = await db("organisations").where("slug", input.slug).first();
  if (existing) throw new ConflictError(`Slug "${input.slug}" is already taken`);

  const emailTaken = await db("users")
    .where("email", input.adminEmail.toLowerCase())
    .first();
  if (emailTaken) throw new ConflictError(`Email "${input.adminEmail}" is already registered`);

  const orgId = uuidv4();
  const adminId = uuidv4();
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("organisations").insert({
      id: orgId,
      name: input.name,
      slug: input.slug,
      plan: input.plan,
      is_active: true,
      settings: JSON.stringify({}),
      created_at: now,
      updated_at: now,
    });

    const passwordHash = await hashPassword(input.adminPassword);
    await trx("users").insert({
      id: adminId,
      organisation_id: orgId,
      email: input.adminEmail.toLowerCase(),
      password_hash: passwordHash,
      first_name: input.adminFirstName,
      last_name: input.adminLastName,
      role: "admin",
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  });

  return getOrgById(orgId);
}

export async function listOrgs(page: number, limit: number): Promise<{ orgs: OrgWithStats[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;

  const [orgs, [{ total }]] = await Promise.all([
    db("organisations")
      .select(
        "organisations.*",
        db.raw("COUNT(users.id) as user_count")
      )
      .leftJoin("users", "users.organisation_id", "organisations.id")
      .groupBy("organisations.id")
      .orderBy("organisations.created_at", "desc")
      .limit(limit)
      .offset(offset),
    db("organisations").count("id as total"),
  ]);

  return { orgs: orgs as OrgWithStats[], total: Number(total) };
}

export async function getOrgById(id: string): Promise<OrgWithStats> {
  const db = getDb();
  const org = await db("organisations")
    .select("organisations.*", db.raw("COUNT(users.id) as user_count"))
    .leftJoin("users", "users.organisation_id", "organisations.id")
    .where("organisations.id", id)
    .groupBy("organisations.id")
    .first();

  if (!org) throw new NotFoundError("Organisation");
  return org as OrgWithStats;
}

export async function updateOrg(id: string, input: UpdateOrgInput): Promise<OrgWithStats> {
  const db = getDb();
  const org = await db("organisations").where("id", id).first();
  if (!org) throw new NotFoundError("Organisation");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.plan !== undefined) updates.plan = input.plan;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.settings !== undefined) {
    const current = org.settings ? JSON.parse(org.settings) : {};
    updates.settings = JSON.stringify({ ...current, ...input.settings });
  }

  await db("organisations").where("id", id).update(updates);
  return getOrgById(id);
}
