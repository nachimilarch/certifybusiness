import type { Knex } from "knex";

// Add bounce tracking columns to campaign_contacts.
// bounced_at  — timestamp when the bounce was detected by the IMAP processor.
// bounce_reason — short reason string (usually the bounce email subject, max 500 chars).
//
// These columns are populated by imap-message.processor.ts when a
// mailer-daemon bounce email is detected for a campaign contact.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (t) => {
    t.timestamp("bounced_at").nullable().after("replied_at");
    t.string("bounce_reason", 500).nullable().after("bounced_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (t) => {
    t.dropColumn("bounce_reason");
    t.dropColumn("bounced_at");
  });
}
