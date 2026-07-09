import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("organisations", (t) => {
    t.string("id", 36).primary();
    t.string("name", 255).notNullable();
    t.string("slug", 100).notNullable().unique();
    t.string("plan", 50).notNullable().defaultTo("starter");
    t.boolean("is_active").notNullable().defaultTo(true);
    t.json("settings").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("designations", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("name", 100).notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.index("organisation_id");
    t.unique(["organisation_id", "name"]);
  });

  await knex.schema.createTable("permission_templates", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("name", 100).notNullable();
    t.json("permissions").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.index("organisation_id");
  });

  // Encrypted external service credentials (SES, WhatsApp, SMS) per org
  await knex.schema.createTable("org_credentials", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.enu("service", ["ses", "whatsapp", "sms"]).notNullable();
    t.text("credentials_encrypted").notNullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.unique(["organisation_id", "service"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("org_credentials");
  await knex.schema.dropTableIfExists("permission_templates");
  await knex.schema.dropTableIfExists("designations");
  await knex.schema.dropTableIfExists("organisations");
}
