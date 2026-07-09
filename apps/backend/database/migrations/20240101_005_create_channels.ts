import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Sender identities: one row per sending address/number/sender-id
  await knex.schema.createTable("sender_identities", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("assigned_to", 36).nullable();
    t.enu("channel", ["email", "whatsapp", "sms"]).notNullable();
    t.string("name", 255).notNullable();
    // Email
    t.string("from_address", 255).nullable();
    t.json("smtp_config").nullable();
    t.json("ses_config").nullable();
    // WhatsApp
    t.string("whatsapp_number", 50).nullable();
    t.string("whatsapp_waba_id", 255).nullable();
    t.string("whatsapp_phone_number_id", 255).nullable();
    // SMS
    t.string("sms_sender_id", 100).nullable();
    // Encrypted provider credentials (API keys etc.)
    t.text("credentials_encrypted").nullable();
    t.boolean("is_verified").notNullable().defaultTo(false);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("assigned_to").references("id").inTable("users").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("channel");
    t.index("assigned_to");
  });

  // Message templates for email / WhatsApp / SMS
  await knex.schema.createTable("templates", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.enu("channel", ["email", "whatsapp", "sms"]).notNullable();
    t.string("name", 255).notNullable();
    t.string("subject", 500).nullable();
    t.text("body").notNullable();
    // List of variable names used in the template body
    t.json("variables").nullable();
    // WhatsApp specific
    t.string("whatsapp_template_name", 255).nullable();
    t.string("whatsapp_template_id", 255).nullable();
    t.enu("whatsapp_approval_status", ["pending", "approved", "rejected"])
      .nullable()
      .defaultTo("pending");
    // SMS DLT (India)
    t.string("dlt_template_id", 100).nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.string("created_by", 36).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("channel");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("templates");
  await knex.schema.dropTableIfExists("sender_identities");
}
