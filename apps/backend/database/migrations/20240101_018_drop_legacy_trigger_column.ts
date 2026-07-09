import type { Knex } from "knex";

// automation_rules carries a legacy `trigger` column (varchar(50), NOT NULL,
// no default) left over from before this table's trigger column was renamed
// to `trigger_type` (now an enum) in migration 008. Because 008 was edited
// in place rather than superseded by a new migration, knex never re-ran it
// against already-migrated databases, so `trigger` survived here with no
// default and nothing in the app ever writes to it — every insert into
// automation_rules fails with ER_NO_DEFAULT_FOR_FIELD. The table is empty,
// so dropping it is safe.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("automation_rules", (t) => {
    t.dropColumn("trigger");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("automation_rules", (t) => {
    // Restored nullable (not NOT-NULL-with-no-default) so a rollback
    // doesn't immediately re-introduce the insert failure this fixes.
    t.string("trigger", 50).nullable();
  });
}
