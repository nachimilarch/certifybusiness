import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("campaigns", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("created_by", 36).notNullable();
    t.string("name", 255).notNullable();
    t.enu("channel", ["email", "whatsapp", "sms"]).notNullable();
    t.string("sender_identity_id", 36).nullable();
    t.string("list_id", 36).nullable();
    t.enu("status", ["draft", "scheduled", "running", "paused", "completed", "failed"])
      .notNullable()
      .defaultTo("draft");
    t.timestamp("scheduled_at").nullable();
    t.timestamp("started_at").nullable();
    t.timestamp("completed_at").nullable();
    // Aggregate counters (updated via background workers)
    t.integer("total_contacts").notNullable().defaultTo(0);
    t.integer("sent_count").notNullable().defaultTo(0);
    t.integer("delivered_count").notNullable().defaultTo(0);
    t.integer("opened_count").notNullable().defaultTo(0);
    t.integer("clicked_count").notNullable().defaultTo(0);
    t.integer("replied_count").notNullable().defaultTo(0);
    t.integer("bounced_count").notNullable().defaultTo(0);
    t.integer("failed_count").notNullable().defaultTo(0);
    // Channel-specific settings (sending window, daily cap, reply-to, etc.)
    t.json("settings").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("created_by").references("id").inTable("users").onDelete("RESTRICT");
    t.foreign("sender_identity_id").references("id").inTable("sender_identities").onDelete("SET NULL");
    t.foreign("list_id").references("id").inTable("uploaded_lists").onDelete("SET NULL");
    t.index("organisation_id");
    t.index("status");
    t.index("channel");
    t.index("scheduled_at");
  });

  // Steps for email sequences (step 1 → wait N days → step 2 → …)
  await knex.schema.createTable("campaign_steps", (t) => {
    t.string("id", 36).primary();
    t.string("campaign_id", 36).notNullable();
    t.integer("step_number").notNullable();
    t.string("template_id", 36).nullable();
    // Delay from previous step (for sequences)
    t.integer("delay_days").notNullable().defaultTo(0);
    t.integer("delay_hours").notNullable().defaultTo(0);
    // Allow per-step subject/body override (email)
    t.string("subject", 500).nullable();
    t.text("body").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("CASCADE");
    t.foreign("template_id").references("id").inTable("templates").onDelete("SET NULL");
    t.unique(["campaign_id", "step_number"]);
    t.index("campaign_id");
  });

  // Per-contact status tracking within a campaign
  await knex.schema.createTable("campaign_contacts", (t) => {
    t.string("id", 36).primary();
    t.string("campaign_id", 36).notNullable();
    t.string("organisation_id", 36).notNullable();
    t.string("uploaded_contact_id", 36).nullable();
    t.string("lead_id", 36).nullable();
    t.integer("current_step").notNullable().defaultTo(0);
    t.enu("status", [
      "pending",
      "in_progress",
      "completed",
      "failed",
      "unsubscribed",
      "bounced",
      "opted_out",
    ])
      .notNullable()
      .defaultTo("pending");
    t.timestamp("last_sent_at").nullable();
    t.timestamp("next_send_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("campaign_id").references("id").inTable("campaigns").onDelete("CASCADE");
    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("uploaded_contact_id").references("id").inTable("uploaded_contacts").onDelete("SET NULL");
    t.foreign("lead_id").references("id").inTable("leads").onDelete("SET NULL");
    t.index("campaign_id");
    t.index("status");
    t.index("next_send_at");
    t.index("organisation_id");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("campaign_contacts");
  await knex.schema.dropTableIfExists("campaign_steps");
  await knex.schema.dropTableIfExists("campaigns");
}
