import { Job } from "bullmq";
import { evaluateAndRun, type AutomationJobData } from "../../modules/automation/automation.service";
import { logger } from "../../core/logger";

export async function processAutomation(job: Job<AutomationJobData>): Promise<void> {
  try {
    await evaluateAndRun(job.data);
  } catch (err) {
    logger.error("[automation] failed to process job", { jobId: job.id, err });
    throw err;
  }
}
