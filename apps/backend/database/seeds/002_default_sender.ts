import type { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  const orgId = "00000000-0000-0000-0000-000000000001";

  const existing = await knex("sender_identities")
    .where({ organisation_id: orgId, from_address: "info@certifybusiness.com", channel: "email" })
    .first();
  if (existing) return;

  await knex("sender_identities").insert({
    id: uuidv4(),
    organisation_id: orgId,
    channel: "email",
    name: "CertifyBusiness",
    from_address: "info@certifybusiness.com",
    smtp_config: JSON.stringify({
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      user: "info@certifybusiness.com",
    }),
    is_verified: true,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log("✅ Default sender seeded: info@certifybusiness.com");
}
