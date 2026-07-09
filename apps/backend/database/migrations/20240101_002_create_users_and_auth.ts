import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("users", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("email", 255).notNullable().unique();
    t.string("password_hash", 255).notNullable();
    t.string("first_name", 100).notNullable();
    t.string("last_name", 100).notNullable();
    t.enu("role", ["super_admin", "admin", "manager", "employee"]).notNullable();
    t.string("designation_id", 36).nullable();
    t.string("manager_id", 36).nullable();
    // Per-user permission overrides (JSON); null = inherit from role defaults
    t.json("permissions").nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("last_login_at").nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("RESTRICT");
    t.foreign("designation_id").references("id").inTable("designations").onDelete("SET NULL");
    // Self-referential FK added post-table creation to avoid ordering issue
    t.index("organisation_id");
    t.index("role");
    t.index("manager_id");
  });

  // Self-referential FK
  await knex.schema.alterTable("users", (t) => {
    t.foreign("manager_id").references("id").inTable("users").onDelete("SET NULL");
  });

  await knex.schema.createTable("teams", (t) => {
    t.string("id", 36).primary();
    t.string("organisation_id", 36).notNullable();
    t.string("name", 100).notNullable();
    t.string("manager_id", 36).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("organisation_id").references("id").inTable("organisations").onDelete("CASCADE");
    t.foreign("manager_id").references("id").inTable("users").onDelete("SET NULL");
    t.index("organisation_id");
  });

  await knex.schema.createTable("team_members", (t) => {
    t.string("team_id", 36).notNullable();
    t.string("user_id", 36).notNullable();
    t.timestamp("joined_at").notNullable().defaultTo(knex.fn.now());

    t.primary(["team_id", "user_id"]);
    t.foreign("team_id").references("id").inTable("teams").onDelete("CASCADE");
    t.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
  });

  await knex.schema.createTable("refresh_tokens", (t) => {
    t.string("id", 36).primary();
    t.string("user_id", 36).notNullable();
    t.string("token_hash", 64).notNullable();
    t.timestamp("expires_at").notNullable();
    t.string("ip_address", 50).nullable();
    t.string("user_agent", 500).nullable();
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.index("user_id");
    t.index("token_hash");
    t.index("expires_at");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("refresh_tokens");
  await knex.schema.dropTableIfExists("team_members");
  await knex.schema.dropTableIfExists("teams");
  await knex.schema.alterTable("users", (t) => {
    t.dropForeign(["manager_id"]);
  });
  await knex.schema.dropTableIfExists("users");
}
