import { createApp } from "./app";
import { initDb, closeDb } from "./core/database";
import { initRedis, closeRedis } from "./core/redis";
import { initQueues, closeQueues } from "./queues";
import { logger } from "./core/logger";
import { config } from "./core/config";
import { stopImapIdle } from "./queues/workers/imap-idle.service";
import { initSse, closeSse } from "./core/sse";
import fs from "fs";

async function bootstrap() {
  // Ensure storage directories exist
  fs.mkdirSync(config.storage.uploadDir, { recursive: true });
  fs.mkdirSync(config.storage.exportDir, { recursive: true });

  await initDb();
  await initRedis();
  await initSse();   // Redis pub/sub for multi-process SSE
  await initQueues();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`CertifyBusiness API listening`, {
      port: config.port,
      env: config.env,
    });
  });

  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);
    // Stop the IMAP IDLE connection before draining the queue workers
    if (config.imap.mode === "idle") stopImapIdle();
    server.close(async () => {
      await closeQueues();
      await closeSse();
      await closeRedis();
      await closeDb();
      logger.info("Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { err });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
