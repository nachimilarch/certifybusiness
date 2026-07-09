import { Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "../../core/senders/whatsapp.sender";
import { logger } from "../../core/logger";
import type { WaSendJobData } from "../../modules/campaigns/campaign.service";

export async function processWhatsAppSend(job: Job<WaSendJobData>): Promise<void> {
  const {
    campaignContactId,
    campaignId,
    orgId,
    recipientPhone,
    body,
    templateName,
    phoneNumberId,
    accessToken,
    senderIdentityId,
    leadId,
  } = job.data;

  const db = getDb();
  const now = new Date();

  await db("campaign_contacts")
    .where("id", campaignContactId)
    .update({ status: "in_progress", last_sent_at: now, updated_at: now });

  const result = templateName
    ? await sendWhatsAppTemplate({ phoneNumberId, accessToken, recipient: recipientPhone, templateName })
    : await sendWhatsAppText({ phoneNumberId, accessToken, recipient: recipientPhone, body });

  const waRecord = {
    id: uuidv4(),
    organisation_id: orgId,
    campaign_id: campaignId,
    campaign_contact_id: campaignContactId,
    lead_id: leadId,
    sender_identity_id: senderIdentityId,
    wa_message_id: result.waMessageId,
    direction: "outbound",
    recipient_phone: recipientPhone,
    message_type: templateName ? "template" : "text",
    body,
    status: result.success ? "sent" : "failed",
    sent_at: result.success ? now : null,
    created_at: now,
  };

  await db("whatsapp_messages").insert(waRecord);

  if (result.success) {
    await db("campaign_contacts").where("id", campaignContactId).update({ status: "completed", updated_at: now });
    await db("campaigns").where("id", campaignId).update({ sent_count: db.raw("sent_count + 1"), updated_at: now });
  } else {
    await db("campaign_contacts").where("id", campaignContactId).update({ status: "failed", updated_at: now });
    await db("campaigns").where("id", campaignId).update({ failed_count: db.raw("failed_count + 1"), updated_at: now });
    logger.warn("[wa-send] failed", { campaignContactId, error: result.error });
  }
}
