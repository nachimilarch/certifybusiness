import { Worker, Queue } from "bullmq";
import { Queues } from "../index";
import { logger } from "../../core/logger";
import { config } from "../../core/config";
import { processCsvImport } from "./csv-import.worker";
import { processCampaignSend } from "./campaign-send.worker";
import { processEmailSend } from "./email-send.worker";
import { processWhatsAppSend } from "./whatsapp-send.worker";
import { processSmsSend } from "./sms-send.worker";
import { processWebhook } from "./webhook-process.worker";
import { processAutomation } from "./automation.worker";
import { processNotification } from "./notifications.worker";
import { pollImap } from "./imap-poll.worker";
import { startImapIdle } from "./imap-idle.service";

export async function registerWorkers(
  connection: { url: string }
): Promise<Worker[]> {
  const opts = { connection, concurrency: 5 };

  const workers = [
    new Worker(Queues.CSV_IMPORT, processCsvImport, { ...opts, concurrency: 2 }),
    new Worker(Queues.CAMPAIGN_SEND, processCampaignSend, { ...opts, concurrency: 2 }),
    new Worker(Queues.EMAIL_SEND, processEmailSend, { ...opts, concurrency: 10 }),
    new Worker(Queues.WHATSAPP_SEND, processWhatsAppSend, { ...opts, concurrency: 10 }),
    new Worker(Queues.SMS_SEND, processSmsSend, { ...opts, concurrency: 10 }),
    new Worker(Queues.WEBHOOK_PROCESS, processWebhook, { ...opts, concurrency: 5 }),
    new Worker(Queues.AUTOMATION, processAutomation, { ...opts, concurrency: 2 }),
    new Worker(Queues.NOTIFICATIONS, processNotification, opts),
    new Worker(Queues.IMAP_POLL, async () => { await pollImap(); }, { connection, concurrency: 1 }),
  ];

  // Schedule IMAP ingestion: IDLE (persistent connection) or poll (BullMQ repeat)
  if (config.imap.host) {
    if (config.imap.mode === "idle") {
      // Start the persistent IMAP IDLE service — does NOT use the BullMQ queue.
      logger.info("[workers] IMAP mode=idle, starting IDLE service");
      startImapIdle();
    } else {
      // Default poll mode: schedule a repeating BullMQ job.
      logger.info("[workers] IMAP mode=poll, scheduling repeating job", {
        intervalMs: config.imap.pollIntervalMs,
      });
      const imapQueue = new Queue(Queues.IMAP_POLL, { connection });
      await imapQueue.add(
        "poll",
        {},
        {
          repeat: { every: config.imap.pollIntervalMs },
          jobId: "imap-poll-cron",
          removeOnComplete: { count: 10 },
        }
      );
      await imapQueue.close();
    }
  }

  for (const w of workers) {
    w.on("failed", (job, err) => {
      logger.error("Worker job failed", { queue: w.name, jobId: job?.id, err: err.message });
    });
    w.on("completed", (job) => {
      logger.debug("Worker job completed", { queue: w.name, jobId: job.id });
    });
  }

  return workers;
}
