import { createClient, type RedisClientType } from "redis";
import { config } from "./config";
import { logger } from "./logger";

let _client: RedisClientType | null = null;

export async function initRedis(): Promise<RedisClientType> {
  if (_client) return _client;

  _client = createClient({ url: config.redis.url }) as RedisClientType;

  _client.on("error", (err) => logger.error("Redis error", { err }));
  _client.on("reconnecting", () => logger.warn("Redis reconnecting"));

  await _client.connect();
  logger.info("Redis connected", { url: config.redis.url });
  return _client;
}

export function getRedis(): RedisClientType {
  if (!_client) throw new Error("Redis not initialised — call initRedis() first");
  return _client;
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
    logger.info("Redis connection closed");
  }
}
