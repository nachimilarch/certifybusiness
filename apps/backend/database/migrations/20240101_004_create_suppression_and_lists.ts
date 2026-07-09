import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Global suppression list — enforced at upload and send time
  await knex.schema.createTable("suppression_list", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.enu("type", ["email", "phone", "whatsapp"]).notNullable();
    t.string("value", 255).notNullable();
    t.enu("reason", [
      "unsubscribe",
      "bounce",
      "do_not_contact",
      "opt_out",
      "spam_complaint",
      "manual",
    ]).notNullable();
    t.string("source", 100).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.unique(["organisation_id", "type", "value"]);
    t.index("organisation_id");
    t.index(["type", "value"]);
  });

  // Uploaded lists (one per CSV upload per channel)
  await knex.schema.createTable("uploaded_lists", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("uploaded_by", 36).notNullable();
    t.string("name", 255).notNullable();
    t.enu("channel", ["calling", "email", "whatsapp", "sms"]).notNullable();
    t.string("original_filename", 500).nullable();
    t.string("file_path", 1000).nullable();
    t.integer("total_rows").notNullable().defaultTo(0);
    t.integer("valid_rows").notNullable().defaultTo(0);
    t.integer("invalid_rows").notNullable().defaultTo(0);
    t.integer("duplicate_rows").notNullable().defaultTo(0);
    t.integer("suppressed_rows").notNullable().defaultTo(0);
    t.enu("status", ["pending", "processing", "completed", "failed"])
      .notNullable()
      .defaultTo("pending");
    t.text("error_message").nullable();
    t.timestamp("processed_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("uploaded_by").references("id").inTable("users").onDelete("RESTRICT");
    t.index("organisation_id");
    t.index("channel");
    t.index("status");
    t.index("uploaded_by");
  });

  // Individual contacts within a list
  await knex.schema.createTable("uploaded_contacts", (t) => {
    t.string("id", 36).primary();
    t.string("list_id", 36).notNullable();
    t.string("organisation_id", 36).notNullable();
    t.integer("row_number").nullable();
    t.string("first_name", 100).nullable();
    t.string("last_name", 100).nullable();
    t.string("company", 255).nullable();
    t.string("designation", 255).nullable();
    t.string("phone", 50).nullable();
    t.string("email", 255).nullable();
    // Channel-specific extra columns stored as JSON (template variables, etc.)
    t.json("extra_data").nullable();
    t.boolean("is_valid").notNullable().defaultTo(true);
    t.json("validation_errors").nullable();
    t.boolean("is_suppressed").notNullable().defaultTo(false);
    t.boolean("is_duplicate").notNullable().defaultTo(false);
    t.string("lead_id", 36).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("list_id").references("id").inTable("uploaded_lists").onDelete("CASCADE");
    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.index("list_id");
    t.index("phone");
    t.index("email");
    t.index("organisation_id");
    t.index("is_valid");
  });

  // Add FK from call_logs.uploaded_contact_id — deferred here to avoid circular ordering
  await knex.schema.alterTable("call_logs", (t) => {
    t.foreign("uploaded_contact_id")
      .references("id")
      .inTable("uploaded_contacts")
      .onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("call_logs", (t) => {
    t.dropForeign(["uploaded_contact_id"]);
  });
  await knex.schema.dropTableIfExists("uploaded_contacts");
  await knex.schema.dropTableIfExists("uploaded_lists");
  await knex.schema.dropTableIfExists("suppression_list");
}
