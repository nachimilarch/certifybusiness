import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("conversations", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.enu("channel", ["email", "whatsapp", "sms"]).notNullable();

    // Contact identifiers
    t.string("contact_email", 255).nullable();
    t.string("contact_phone", 50).nullable();
    t.string("contact_name", 255).nullable();

    // Links to existing data
    t.string("lead_id", 36).nullable();
    t.string("campaign_id", 36).nullable();
    t.string("campaign_contact_id", 36).nullable();
    t.string("sender_identity_id", 36).nullable();
    t.string("owner_user_id", 36).nullable();

    // State
    t.enu("status", ["open", "awaiting_employee", "awaiting_customer", "closed"])
      .notNullable()
      .defaultTo("open");
    t.enu("source", ["cold_email_reply", "whatsapp_reply", "sms_reply", "manual"])
      .notNullable()
      .defaultTo("manual");

    // Email thread subject
    t.string("subject", 500).nullable();

    // Counters / timing
    t.timestamp("last_message_at").nullable();
    t.timestamp("last_inbound_at").nullable();
    t.integer("message_count").notNullable().defaultTo(0);
    t.integer("unread_count").notNullable().defaultTo(0);

    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("SET NULL");
    t.foreign("campaign_contact_id").references("id").inTable("campaign_contacts").onDelete("SET NULL");
    t.foreign("owner_user_id").references("id").inTable("users").onDelete("SET NULL");

    t.index("organisation_id");
    t.index("owner_user_id");
    t.index("channel");
    t.index("status");
    t.index("contact_email");
    t.index("contact_phone");
    t.index("campaign_id");
    t.index("last_message_at");
  });

  await knex.schema.createTable("conversation_messages", (t) => {
    t.string("id", 36).primary();
    t.string("conversation_id", 36).notNullable();
    t.string("organisation_id", 36).notNullable();
    t.enu("direction", ["inbound", "outbound"]).notNullable();
    t.enu("channel", ["email", "whatsapp", "sms"]).notNullable();

    // Provider-level identifiers
    t.string("provider_message_id", 500).nullable();
    t.string("in_reply_to_id", 500).nullable();

    // Email addressing
    t.string("sender_address", 255).nullable();
    t.string("recipient_address", 255).nullable();
    t.string("subject", 500).nullable();
    t.text("body_text").nullable();
    t.specificType("body_html", "mediumtext").nullable();

    // WhatsApp addressing
    t.string("sender_phone", 50).nullable();
    t.string("recipient_phone", 50).nullable();

    // Authorship (for outbound replies from UI)
    t.string("sent_by_user_id", 36).nullable();
    // Back-references to existing event tables
    t.string("email_event_id", 36).nullable();
    t.string("wa_message_db_id", 36).nullable();

    t.json("raw_payload").nullable();
    t.timestamp("received_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("conversation_id").references("id").inTable("conversations").onDelete("CASCADE");
    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("sent_by_user_id").references("id").inTable("users").onDelete("SET NULL");

    t.index("conversation_id");
    t.index("direction");
    t.index("provider_message_id");
    t.index("created_at");
  });

  await knex.schema.createTable("conversation_assignments", (t) => {
    t.string("id", 36).primary();
    t.string("conversation_id", 36).notNullable();
    t.string("from_user_id", 36).nullable();
    t.string("to_user_id", 36).notNullable();
    t.string("changed_by_user_id", 36).notNullable();
    t.string("reason", 500).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("conversation_id").references("id").inTable("conversations").onDelete("CASCADE");

    t.index("conversation_id");
    t.index("to_user_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("conversation_assignments");
  await knex.schema.dropTableIfExists("conversation_messages");
  await knex.schema.dropTableIfExists("conversations");
}
