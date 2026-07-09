import { Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { sendEmail } from "../../core/senders/email.sender";
import { logger } from "../../core/logger";
import { config } from "../../core/config";
import type { EmailSendJobData } from "../../modules/campaigns/campaign.service";

const APP_URL = config.appUrl ?? "https://app.certifybusiness.com";

function injectTracking(html: string, campaignContactId: string): string {
  // Wrap all href links for click tracking
  const tracked = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, url) =>
      `href="${APP_URL}/track/click?c=${campaignContactId}&url=${encodeURIComponent(url)}"`
  );

  // Inject open pixel + unsubscribe footer before </body>
  const pixel = `<img src="${APP_URL}/track/open?c=${campaignContactId}" width="1" height="1" style="display:none" alt="" />`;
  const unsubFooter = `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      <a href="${APP_URL}/track/unsubscribe?c=${campaignContactId}" style="color:#6b7280;">Unsubscribe</a>
    </div>`;

  if (/<\/body>/i.test(tracked)) {
    return tracked.replace(/<\/body>/i, `${pixel}${unsubFooter}</body>`);
  }
  return tracked + pixel + unsubFooter;
}

function buildReplyTo(campaignContactId: string): string {
  const hostname = new URL(APP_URL).hostname;
  // In local development, localhost is not a valid reply-to domain.
  // Fall back to the configured sender email so replies arrive in the real inbox.
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return config.smtp.fromEmail;
  }
  return `reply+${campaignContactId}@${hostname}`;
}

export async function processEmailSend(job: Job<EmailSendJobData>): Promise<void> {
  const {
    campaignContactId,
    campaignId,
    orgId,
    recipientEmail,
    subject,
    htmlBody,
    fromAddress,
    senderIdentityId,
    leadId,
  } = job.data;

  const db = getDb();

  // Mark contact in_progress
  await db("campaign_contacts")
    .where("id", campaignContactId)
    .update({ status: "in_progress", last_sent_at: new Date(), updated_at: new Date() });

  const trackedHtml = injectTracking(htmlBody, campaignContactId);
  const replyTo = buildReplyTo(campaignContactId);

  const result = await sendEmail({
    to: recipientEmail,
    from: fromAddress,
    subject,
    htmlBody: trackedHtml,
    replyTo,
  });

  const now = new Date();

  // Record email_event
  await db("email_events").insert({
    id: uuidv4(),
    organisation_id: orgId,
    campaign_id: campaignId,
    campaign_contact_id: campaignContactId,
    lead_id: leadId,
    sender_identity_id: senderIdentityId,
    message_id: result.messageId,
    event_type: result.success ? "sent" : "bounced",
    recipient_email: recipientEmail,
    subject,
    occurred_at: now,
    created_at: now,
  });

  if (result.success) {
    await db("campaign_contacts")
      .where("id", campaignContactId)
      .update({ status: "completed", updated_at: now });
    await db("campaigns")
      .where("id", campaignId)
      .update({ sent_count: db.raw("sent_count + 1"), updated_at: now });
  } else {
    await db("campaign_contacts")
      .where("id", campaignContactId)
      .update({ status: "failed", updated_at: now });
    await db("campaigns")
      .where("id", campaignId)
      .update({ failed_count: db.raw("failed_count + 1"), updated_at: now });
    logger.warn("[email-send] failed", { campaignContactId, error: result.error });
  }

  // Mark campaign completed when all contacts have been processed
  await maybeCampaignCompleted(db, campaignId);
}

async function maybeCampaignCompleted(
  db: ReturnType<typeof import("../../core/database").getDb>,
  campaignId: string
): Promise<void> {
  try {
    const [row] = await db("campaign_contacts")
      .where("campaign_id", campaignId)
      .whereIn("status", ["pending", "in_progress"])
      .count("id as remaining");

    const remaining = Number((row as unknown as { remaining: string | number }).remaining);
    if (remaining === 0) {
      await db("campaigns")
        .where("id", campaignId)
        .where("status", "running")
        .update({ status: "completed", completed_at: new Date(), updated_at: new Date() });
      logger.info("[email-send] campaign completed", { campaignId });
    }
  } catch (err) {
    logger.warn("[email-send] completion check failed", { campaignId, err });
  }
}
