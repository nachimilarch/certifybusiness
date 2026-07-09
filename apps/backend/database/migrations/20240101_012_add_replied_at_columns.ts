import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (t) => {
    t.timestamp("replied_at").nullable().defaultTo(null);
  });
  await knex.schema.alterTable("email_events", (t) => {
    t.timestamp("replied_at").nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("campaign_contacts", (t) => {
    t.dropColumn("replied_at");
  });
  await knex.schema.alterTable("email_events", (t) => {
    t.dropColumn("replied_at");
  });
}
