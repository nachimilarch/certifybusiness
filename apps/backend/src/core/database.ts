import Knex from "knex";
import { config } from "./config";
import { logger } from "./logger";

let _db: Knex.Knex | null = null;

export function getDb(): Knex.Knex {
  if (!_db) throw new Error("Database not initialised — call initDb() first");
  return _db;
}

export async function initDb(): Promise<Knex.Knex> {
  if (_db) return _db;

  _db = Knex({
    client: "mysql2",
    connection: {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      charset: "utf8mb4",
      timezone: "+00:00",
      // Keep connection alive
      connectTimeout: 10000,
    },
    pool: {
      min: config.isProd ? 2 : 1,
      max: config.isProd ? 20 : 5,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    debug: false,
  });

  // Verify connection
  await _db.raw("SELECT 1");
  logger.info("MySQL connected", { host: config.db.host, db: config.db.name });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
    logger.info("MySQL connection pool closed");
  }
}

// Shorthand – modules can do: import { db } from '@core/database'
export const db = new Proxy({} as Knex.Knex, {
  get(_target, prop) {
    return getDb()[prop as keyof Knex.Knex];
  },
});
