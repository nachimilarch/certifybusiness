import type { Knex } from "knex";

// Adds DB-enforced idempotency guards for inbound message ingestion.
// conversation_messages: prevents the same provider message ID being inserted
//   twice for the same org (e.g. IMAP poll race or duplicate webhook delivery).
// whatsapp_messages: prevents duplicate WhatsApp webhook events.
// Both columns are nullable – MySQL allows multiple NULL values in a unique
// index, so rows without a provider ID are unaffected.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("conversation_messages", (t) => {
    t.unique(["organisation_id", "provider_message_id"], {
      indexName: "uq_conv_msg_org_provider_id",
    });
  });

  await knex.schema.alterTable("whatsapp_messages", (t) => {
    t.unique(["organisation_id", "wa_message_id"], {
      indexName: "uq_wa_msg_org_wa_id",
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("conversation_messages", (t) => {
    t.dropUnique(["organisation_id", "provider_message_id"], "uq_conv_msg_org_provider_id");
  });
  await knex.schema.alterTable("whatsapp_messages", (t) => {
    t.dropUnique(["organisation_id", "wa_message_id"], "uq_wa_msg_org_wa_id");
  });
}
