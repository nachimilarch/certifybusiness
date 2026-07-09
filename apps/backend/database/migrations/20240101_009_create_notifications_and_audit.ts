import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("notifications", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("user_id", 36).notNullable();
    t.enu("type", [
      "new_lead",
      "lead_assigned",
      "reply_received",
      "follow_up_due",
      "campaign_complete",
      "task_due",
      "system",
    ]).notNullable();
    t.string("title", 500).notNullable();
    t.text("body").nullable();
    t.string("link", 1000).nullable();
    t.boolean("is_read").notNullable().defaultTo(false);
    t.timestamp("read_at").nullable();
    t.json("metadata").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.index("user_id");
    t.index("is_read");
    t.index("created_at");
    t.index("organisation_id");
  });

  // Immutable audit trail for sensitive actions
  await knex.schema.createTable("audit_logs", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).nullable();
    t.string("user_id", 36).nullable();
    t.string("action", 255).notNullable();
    t.string("resource_type", 100).nullable();
    t.string("resource_id", 36).nullable();
    t.json("old_value").nullable();
    t.json("new_value").nullable();
    t.string("ip_address", 50).nullable();
    t.string("user_agent", 500).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    // No FK on user_id / organisation_id — audit logs must persist even after deletion
    t.index("organisation_id");
    t.index("user_id");
    t.index(["resource_type", "resource_id"]);
    t.index("created_at");
    t.index("action");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_logs");
  await knex.schema.dropTableIfExists("notifications");
}
