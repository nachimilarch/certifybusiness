import type { Knex } from "knex";

// Add a unique index so that duplicate email_events rows (same SMTP Message-ID
// within an org) are rejected at the DB level.  Each outbound email produces
// exactly one email_events row; SES/webhook handlers UPDATE that row's
// event_type rather than inserting a new row, so this constraint is safe for
// existing data.
//
// message_id is nullable — MySQL allows multiple NULL values in a unique index.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("email_events", (t) => {
    t.unique(["organisation_id", "message_id"], {
      indexName: "uq_email_events_org_msg_id",
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("email_events", (t) => {
    t.dropUnique(["organisation_id", "message_id"], "uq_email_events_org_msg_id");
  });
}
