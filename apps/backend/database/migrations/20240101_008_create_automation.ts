import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("automation_rules", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("created_by", 36).nullable();
    t.string("name", 255).notNullable();
    t.text("description").nullable();
    t.enu("trigger_type", [
      "lead_created",
      "email_reply",
      "whatsapp_reply",
      "sms_reply",
      "call_logged",
      "no_activity",
      "status_changed",
      "tag_added",
    ]).notNullable();
    // JSON config for the trigger (e.g. { outcome: "interested" } for call_logged)
    t.json("trigger_config").nullable();
    // Array of condition objects: [{ field, operator, value }]
    t.json("conditions").nullable();
    // Array of action objects: [{ type, config }]
    t.json("actions").notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.integer("run_count").notNullable().defaultTo(0);
    t.timestamp("last_run_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("trigger_type");
    t.index("is_active");
  });

  await knex.schema.createTable("automation_logs", (t) => {
    t.string("id", 36).primary();
    t.string("rule_id", 36).notNullable();
    t.string("organisation_id", 36).notNullable();
    t.string("lead_id", 36).nullable();
    t.json("trigger_data").nullable();
    t.json("actions_executed").nullable();
    t.enu("status", ["success", "partial", "failed"]).notNullable();
    t.text("error_message").nullable();
    t.timestamp("executed_at").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("rule_id").references("id").inTable("automation_rules").onDelete("CASCADE");
    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.index("rule_id");
    t.index("lead_id");
    t.index("executed_at");
    t.index("status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("automation_logs");
  await knex.schema.dropTableIfExists("automation_rules");
}
