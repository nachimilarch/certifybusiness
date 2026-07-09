import type { Knex } from "knex";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const base: Knex.Config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "secret",
    database: process.env.DB_NAME || "certifybusiness",
    charset: "utf8mb4",
    timezone: "+00:00",
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: path.join(__dirname, "database/migrations"),
    tableName: "knex_migrations",
    extension: "ts",
  },
  seeds: {
    directory: path.join(__dirname, "database/seeds"),
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...base,
    debug: false,
  },
  test: {
    ...base,
    connection: {
      ...(base.connection as object),
      database: `${process.env.DB_NAME || "certifybusiness"}_test`,
    },
  },
  production: {
    ...base,
    pool: { min: 2, max: 20 },
    debug: false,
  },
};

module.exports = config;
export default config;
