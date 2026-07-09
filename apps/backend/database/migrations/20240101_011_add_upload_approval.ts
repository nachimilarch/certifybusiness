import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("uploaded_lists", (t) => {
    t.enu("approval_status", ["pending", "approved", "rejected", "auto_approved"])
      .notNullable()
      .defaultTo("pending")
      .after("status");
    t.boolean("requires_approval").notNullable().defaultTo(true).after("approval_status");
    t.string("approved_by", 36).nullable().after("requires_approval");
    t.timestamp("approved_at").nullable().after("approved_by");
    t.text("rejection_reason").nullable().after("approved_at");

    t.index("approval_status", "idx_uploaded_lists_approval_status");
    t.foreign("approved_by").references("id").inTable("users").onDelete("SET NULL");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("uploaded_lists", (t) => {
    t.dropForeign(["approved_by"]);
    t.dropIndex([], "idx_uploaded_lists_approval_status");
    t.dropColumn("rejection_reason");
    t.dropColumn("approved_at");
    t.dropColumn("approved_by");
    t.dropColumn("requires_approval");
    t.dropColumn("approval_status");
  });
}
