import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Email delivery & engagement events (from SES webhooks / IMAP polling)
  await knex.schema.createTable("email_events", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("campaign_id", 36).nullable();
    t.string("campaign_contact_id", 36).nullable();
    t.string("lead_id", 36).nullable();
    t.string("sender_identity_id", 36).nullable();
    // SES message-id / SMTP message-id
    t.string("message_id", 500).nullable();
    t.enu("event_type", [
      "sent",
      "delivered",
      "opened",
      "clicked",
      "bounced",
      "complained",
      "unsubscribed",
      "replied",
    ]).notNullable();
    t.string("recipient_email", 255).nullable();
    t.string("subject", 500).nullable();
    t.string("clicked_url", 2000).nullable();
    t.json("metadata").nullable();
    t.timestamp("occurred_at").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("SET NULL");
    t.foreign("campaign_contact_id").references("id").inTable("campaign_contacts").onDelete("SET NULL");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.foreign("sender_identity_id").references("id").inTable("sender_identities").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("campaign_id");
    t.index("event_type");
    t.index("message_id");
    t.index("recipient_email");
    t.index("occurred_at");
  });

  // WhatsApp individual messages (both outbound campaigns and inbound replies)
  await knex.schema.createTable("whatsapp_messages", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("campaign_id", 36).nullable();
    t.string("campaign_contact_id", 36).nullable();
    t.string("lead_id", 36).nullable();
    t.string("sender_identity_id", 36).nullable();
    t.string("wa_message_id", 500).nullable();
    t.enu("direction", ["outbound", "inbound"]).notNullable();
    t.string("recipient_phone", 50).nullable();
    t.string("sender_phone", 50).nullable();
    t.string("template_id", 36).nullable();
    t.string("message_type", 50).notNullable().defaultTo("text");
    t.text("body").nullable();
    t.enu("status", ["pending", "sent", "delivered", "read", "failed", "replied"])
      .notNullable()
      .defaultTo("pending");
    t.json("metadata").nullable();
    t.timestamp("sent_at").nullable();
    t.timestamp("delivered_at").nullable();
    t.timestamp("read_at").nullable();
    t.timestamp("replied_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("SET NULL");
    t.foreign("campaign_contact_id").references("id").inTable("campaign_contacts").onDelete("SET NULL");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.foreign("sender_identity_id").references("id").inTable("sender_identities").onDelete("SET NULL");
    t.foreign("template_id").references("id").inTable("templates").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("campaign_id");
    t.index("wa_message_id");
    t.index("recipient_phone");
    t.index("direction");
    t.index("status");
  });

  // SMS individual messages
  await knex.schema.createTable("sms_messages", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("campaign_id", 36).nullable();
    t.string("campaign_contact_id", 36).nullable();
    t.string("lead_id", 36).nullable();
    t.string("sender_identity_id", 36).nullable();
    t.string("provider_message_id", 500).nullable();
    t.enu("direction", ["outbound", "inbound"]).notNullable();
    t.string("recipient_phone", 50).nullable();
    t.string("sender_id", 100).nullable();
    t.string("template_id", 36).nullable();
    t.text("body").nullable();
    t.string("dlt_template_id", 100).nullable();
    t.enu("status", ["pending", "sent", "delivered", "failed", "replied"])
      .notNullable()
      .defaultTo("pending");
    t.json("metadata").nullable();
    t.timestamp("sent_at").nullable();
    t.timestamp("delivered_at").nullable();
    t.timestamp("replied_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("SET NULL");
    t.foreign("campaign_contact_id").references("id").inTable("campaign_contacts").onDelete("SET NULL");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.foreign("sender_identity_id").references("id").inTable("sender_identities").onDelete("SET NULL");
    t.foreign("template_id").references("id").inTable("templates").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("campaign_id");
    t.index("provider_message_id");
    t.index("recipient_phone");
    t.index("direction");
    t.index("status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sms_messages");
  await knex.schema.dropTableIfExists("whatsapp_messages");
  await knex.schema.dropTableIfExists("email_events");
}
