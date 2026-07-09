import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("leads", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("assigned_to", 36).nullable();
    t.string("created_by", 36).nullable();
    t.string("name", 255).notNullable();
    t.string("company", 255).nullable();
    t.string("designation", 255).nullable();
    t.enu("source", [
      "cold_call",
      "cold_email",
      "whatsapp",
      "sms",
      "website_inbound",
      "manual",
    ])
      .notNullable()
      .defaultTo("manual");
    t.enu("status", [
      "new",
      "contacted",
      "interested",
      "follow_up",
      "converted",
      "dead",
      "do_not_contact",
    ])
      .notNullable()
      .defaultTo("new");
    t.json("tags").nullable();
    t.text("notes").nullable();
    t.timestamp("last_activity_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("RESTRICT");
    t.foreign("assigned_to").references("id").inTable("users").onDelete("SET NULL");
    t.foreign("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("assigned_to");
    t.index("status");
    t.index("source");
    t.index("last_activity_at");
  });

  await knex.schema.createTable("lead_phones", (t) => {
    t.string("id", 36).primary();
    t.string("lead_id", 36).notNullable();
    t.string("phone", 50).notNullable();
    t.boolean("is_primary").notNullable().defaultTo(false);
    t.boolean("is_whatsapp").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("lead_id").references("id").inTable("leads").onDelete("CASCADE");
    t.index("lead_id");
    t.index("phone");
  });

  await knex.schema.createTable("lead_emails", (t) => {
    t.string("id", 36).primary();
    t.string("lead_id", 36).notNullable();
    t.string("email", 255).notNullable();
    t.boolean("is_primary").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("lead_id").references("id").inTable("leads").onDelete("CASCADE");
    t.index("lead_id");
    t.index("email");
  });

  await knex.schema.createTable("lead_activities", (t) => {
    t.string("id", 36).primary();
    t.string("lead_id", 36).notNullable();
    t.string("organisation_id", 36).notNullable();
    t.string("user_id", 36).nullable();
    t.enu("type", [
      "call",
      "email_sent",
      "email_reply",
      "whatsapp_sent",
      "whatsapp_reply",
      "sms_sent",
      "sms_reply",
      "note",
      "task",
      "status_change",
      "assignment",
    ]).notNullable();
    t.string("subject", 500).nullable();
    t.text("body").nullable();
    t.json("metadata").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("lead_id").references("id").inTable("leads").onDelete("CASCADE");
    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.index("lead_id");
    t.index("organisation_id");
    t.index("type");
    t.index("created_at");
  });

  await knex.schema.createTable("tasks", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("lead_id", 36).nullable();
    t.string("assigned_to", 36).nullable();
    t.string("created_by", 36).nullable();
    t.string("title", 500).notNullable();
    t.text("description").nullable();
    t.timestamp("due_at").nullable();
    t.timestamp("completed_at").nullable();
    t.enu("type", ["call", "email", "whatsapp", "sms", "follow_up", "general"])
      .notNullable()
      .defaultTo("general");
    t.enu("priority", ["low", "medium", "high"]).notNullable().defaultTo("medium");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.foreign("assigned_to").references("id").inTable("users").onDelete("SET NULL");
    t.foreign("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.index("assigned_to");
    t.index("lead_id");
    t.index("due_at");
    t.index("completed_at");
    t.index("organisation_id");
  });

  await knex.schema.createTable("call_logs", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("user_id", 36).notNullable();
    t.string("lead_id", 36).nullable();
    t.string("uploaded_contact_id", 36).nullable();
    t.timestamp("called_at").notNullable();
    t.integer("duration_seconds").notNullable().defaultTo(0);
    t.enu("outcome", [
      "connected",
      "no_answer",
      "busy",
      "wrong_number",
      "callback_requested",
      "interested",
      "not_interested",
      "do_not_call",
    ]).notNullable();
    t.timestamp("follow_up_at").nullable();
    t.text("notes").nullable();
    t.boolean("converted_to_lead").notNullable().defaultTo(false);
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("RESTRICT");
    t.foreign("user_id").references("id").inTable("users").onDelete("RESTRICT");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.index("user_id");
    t.index("lead_id");
    t.index("called_at");
    t.index("organisation_id");
    t.index("outcome");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("call_logs");
  await knex.schema.dropTableIfExists("tasks");
  await knex.schema.dropTableIfExists("lead_activities");
  await knex.schema.dropTableIfExists("lead_emails");
  await knex.schema.dropTableIfExists("lead_phones");
  await knex.schema.dropTableIfExists("leads");
}
