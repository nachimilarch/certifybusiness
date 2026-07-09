import { Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { sendSms } from "../../core/senders/sms.sender";
import { logger } from "../../core/logger";
import type { SmsSendJobData } from "../../modules/campaigns/campaign.service";

export async function processSmsSend(job: Job<SmsSendJobData>): Promise<void> {
  const {
    campaignContactId,
    campaignId,
    orgId,
    recipientPhone,
    body,
    senderId,
    dltTemplateId,
    credentials,
    senderIdentityId,
    leadId,
  } = job.data;

  const db = getDb();
  const now = new Date();

  await db("campaign_contacts")
    .where("id", campaignContactId)
    .update({ status: "in_progress", last_sent_at: now, updated_at: now });

  const result = await sendSms({
    recipient: recipientPhone,
    senderId,
    body,
    dltTemplateId,
    credentials: {
      provider: (credentials.provider as "exotel" | "generic") ?? "generic",
      apiKey: credentials.apiKey ?? "",
      apiSecret: credentials.apiSecret,
      accountSid: credentials.accountSid,
      baseUrl: credentials.baseUrl ?? "",
    },
  });

  const smsRecord = {
    id: uuidv4(),
    organisation_id: orgId,
    campaign_id: campaignId,
    campaign_contact_id: campaignContactId,
    lead_id: leadId,
    sender_identity_id: senderIdentityId,
    provider_message_id: result.providerMessageId,
    direction: "outbound",
    recipient_phone: recipientPhone,
    sender_id: senderId,
    body,
    dlt_template_id: dltTemplateId,
    status: result.success ? "sent" : "failed",
    sent_at: result.success ? now : null,
    created_at: now,
  };

  await db("sms_messages").insert(smsRecord);

  if (result.success) {
    await db("campaign_contacts").where("id", campaignContactId).update({ status: "completed", updated_at: now });
    await db("campaigns").where("id", campaignId).update({ sent_count: db.raw("sent_count + 1"), updated_at: now });
  } else {
    await db("campaign_contacts").where("id", campaignContactId).update({ status: "failed", updated_at: now });
    await db("campaigns").where("id", campaignId).update({ failed_count: db.raw("failed_count + 1"), updated_at: now });
    logger.warn("[sms-send] failed", { campaignContactId, error: result.error });
  }
}
