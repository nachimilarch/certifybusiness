import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

export async function seed(knex: Knex): Promise<void> {
  const orgId = "00000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-0000-0000-000000000002";

  // Idempotent — skip if already seeded
  const existing = await knex("organisations").where("id", orgId).first();
  if (existing) return;

  await knex("organisations").insert({
    id: orgId,
    name: "CertifyBusiness HQ",
    slug: "certifybusiness-hq",
    plan: "enterprise",
    is_active: true,
    settings: JSON.stringify({}),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const passwordHash = await bcrypt.hash("Admin@123456", 12);

  await knex("users").insert({
    id: userId,
    organisation_id: orgId,
    email: "superadmin@certifybusiness.io",
    password_hash: passwordHash,
    first_name: "Super",
    last_name: "Admin",
    role: "super_admin",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log(`
  ✅ Seed complete.
     Super Admin: superadmin@certifybusiness.io
     Password:    Admin@123456   (change immediately after first login)
  `);
}
