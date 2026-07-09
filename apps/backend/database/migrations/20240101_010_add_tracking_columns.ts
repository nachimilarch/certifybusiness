import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (table) => {
    table.timestamp("opened_at").nullable().defaultTo(null);
    table.timestamp("clicked_at").nullable().defaultTo(null);
    table.timestamp("unsubscribed_at").nullable().defaultTo(null);
  });

  await knex.schema.alterTable("campaigns", (table) => {
    table.integer("unsubscribed_count").notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (table) => {
    table.dropColumn("opened_at");
    table.dropColumn("clicked_at");
    table.dropColumn("unsubscribed_at");
  });

  await knex.schema.alterTable("campaigns", (table) => {
    table.dropColumn("unsubscribed_count");
  });
}
