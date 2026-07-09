import type { Knex } from "knex";

// Extend the conversations.source ENUM to include "inbound_email" for emails
// that arrived at the monitored inbox but could not be correlated to any
// outbound campaign (no reply+alias, no matching In-Reply-To/References, no
// recent outbound to the same address).
//
// MySQL ENUM extension is a metadata-only operation — it does not rewrite
// existing rows, so this is safe to run on a populated table.

export async function up(knex: Knex): Promise<void> {
  // MySQL ENUM extension via raw ALTER TABLE — Knex's .enu().alter() API
  // requires the useNative/enumName pair which isn't applicable for MySQL.
  await knex.raw(`
    ALTER TABLE conversations
    MODIFY COLUMN source
      ENUM('cold_email_reply','whatsapp_reply','sms_reply','manual','inbound_email')
      NOT NULL DEFAULT 'manual'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Reclassify any unmatched-inbound rows before narrowing the ENUM.
  await knex("conversations").where("source", "inbound_email").update({ source: "manual" });
  await knex.raw(`
    ALTER TABLE conversations
    MODIFY COLUMN source
      ENUM('cold_email_reply','whatsapp_reply','sms_reply','manual')
      NOT NULL DEFAULT 'manual'
  `);
}
