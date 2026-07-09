import { Queue, Worker, QueueEvents } from "bullmq";
import { config } from "../core/config";
import { logger } from "../core/logger";

const connection = { url: config.redis.url };

// ─── Queue definitions ───────────────────────────────────────────────────────

export const Queues = {
  CSV_IMPORT: "csv-import",
  CAMPAIGN_SEND: "campaign-send",
  EMAIL_SEND: "email-send",
  WHATSAPP_SEND: "whatsapp-send",
  SMS_SEND: "sms-send",
  WEBHOOK_PROCESS: "webhook-process",
  AUTOMATION: "automation",
  NOTIFICATIONS: "notifications",
  IMAP_POLL: "imap-poll",
} as const;

export type QueueName = (typeof Queues)[keyof typeof Queues];

let queues: Record<string, Queue> = {};
let workers: Worker[] = [];
let events: QueueEvents[] = [];

export function getQueue(name: QueueName): Queue {
  if (!queues[name]) throw new Error(`Queue "${name}" not initialised`);
  return queues[name];
}

export async function initQueues(): Promise<void> {
  for (const name of Object.values(Queues)) {
    queues[name] = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  // Register workers (imported lazily to avoid circular deps)
  const { registerWorkers } = await import("./workers");
  workers = await registerWorkers(connection);

  logger.info("BullMQ queues and workers initialised", {
    queues: Object.values(Queues),
  });
}

export async function closeQueues(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(events.map((e) => e.close()));
  await Promise.all(Object.values(queues).map((q) => q.close()));
  queues = {};
  workers = [];
  events = [];
  logger.info("BullMQ queues closed");
}
