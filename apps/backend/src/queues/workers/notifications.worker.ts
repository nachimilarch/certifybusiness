import { Job } from "bullmq";
import { createNotification, type NotificationJobData } from "../../modules/notifications/notification.service";
import { logger } from "../../core/logger";

export async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  try {
    await createNotification(job.data);
  } catch (err) {
    logger.error("[notifications] failed to save notification", { jobId: job.id, err });
    throw err;
  }
}
