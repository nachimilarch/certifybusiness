import { Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { getQueue, Queues } from "../index";
import { decrypt } from "../../core/encryption";
import { renderTemplate } from "../../core/senders/template";
import { logger } from "../../core/logger";
import { config } from "../../core/config";
import type { CampaignSendJobData } from "../../modules/campaigns/campaign.service";

const BATCH = 200;

export async function processCampaignSend(job: Job<CampaignSendJobData>): Promise<void> {
  const { campaignId, orgId } = job.data;
  const db = getDb();

  const campaign = await db("campaigns as c")
    .leftJoin("sender_identities as si", "si.id", "c.sender_identity_id")
    .where("c.id", campaignId)
    .where("c.organisation_id", orgId)
    .select(
      "c.*",
      "si.name as sender_name",
      "si.from_address",
      "si.whatsapp_phone_number_id",
      "si.sms_sender_id",
      "si.credentials_encrypted",
    )
    .first();

  if (!campaign) {
    logger.warn("[campaign-send] campaign not found", { campaignId });
    return;
  }
  if (!["running"].includes(campaign.status)) {
    logger.warn("[campaign-send] campaign not running", { campaignId, status: campaign.status });
    return;
  }

  // Get step 1 (only step 1 for now — sequences in Phase F)
  const step = await db("campaign_steps as cs")
    .leftJoin("templates as t", "t.id", "cs.template_id")
    .where("cs.campaign_id", campaignId)
    .where("cs.step_number", 1)
    .select("cs.*", "t.body as tpl_body", "t.subject as tpl_subject",
      "t.whatsapp_template_name", "t.dlt_template_id")
    .first();

  if (!step) {
    logger.warn("[campaign-send] no step 1 found", { campaignId });
    return;
  }

  // Decrypt sender credentials
  let credentials: Record<string, string> = {};
  if (campaign.credentials_encrypted) {
    try {
      credentials = JSON.parse(decrypt(campaign.credentials_encrypted));
    } catch {}
  }

  // Load valid contacts from the list that haven't been enrolled yet
  const enrolledIds = await db("campaign_contacts")
    .where("campaign_id", campaignId)
    .pluck("uploaded_contact_id");
  const enrolledSet = new Set(enrolledIds.filter(Boolean) as string[]);

  const contacts = await db("uploaded_contacts")
    .where("list_id", campaign.list_id)
    .where("is_valid", true)
    .where("is_suppressed", false)
    .where("is_duplicate", false)
    .select("*");

  const newContacts = contacts.filter((c: { id: string }) => !enrolledSet.has(c.id));

  if (newContacts.length === 0) {
    logger.info("[campaign-send] no new contacts to enroll", { campaignId });
    await db("campaigns").where("id", campaignId).update({
      status: "completed",
      completed_at: new Date(),
      updated_at: new Date(),
    });
    return;
  }

  // Enroll contacts in batches
  const channelQueue =
    campaign.channel === "email"
      ? getQueue(Queues.EMAIL_SEND)
      : campaign.channel === "whatsapp"
      ? getQueue(Queues.WHATSAPP_SEND)
      : getQueue(Queues.SMS_SEND);

  const body = step.body ?? step.tpl_body ?? "";
  const subject = step.subject ?? step.tpl_subject ?? "";

  let totalEnrolled = 0;

  for (let i = 0; i < newContacts.length; i += BATCH) {
    const batch = newContacts.slice(i, i + BATCH);

    const ccRows = batch.map((c: Record<string, unknown>) => ({
      id: uuidv4(),
      campaign_id: campaignId,
      organisation_id: orgId,
      uploaded_contact_id: c.id,
      lead_id: c.lead_id ?? null,
      current_step: 1,
      status: "pending",
      next_send_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await db("campaign_contacts").insert(ccRows);

    const jobs = batch.map((c: Record<string, unknown>, idx: number) => {
      const vars: Record<string, string> = {
        first_name: (c.first_name as string) ?? "",
        last_name: (c.last_name as string) ?? "",
        company: (c.company as string) ?? "",
        designation: (c.designation as string) ?? "",
        phone: (c.phone as string) ?? "",
        email: (c.email as string) ?? "",
        ...(c.extra_data
          ? typeof c.extra_data === "string"
            ? JSON.parse(c.extra_data)
            : (c.extra_data as Record<string, string>)
          : {}),
      };

      const renderedBody = renderTemplate(body, vars);
      const ccId = ccRows[idx].id;

      if (campaign.channel === "email") {
        const rawFrom = campaign.from_address ?? config.smtp.fromEmail;
        const senderName = campaign.sender_name ?? config.smtp.fromName;
        const formattedFrom = `"${senderName}" <${rawFrom}>`;
        return {
          name: "send-email",
          data: {
            campaignContactId: ccId,
            campaignId,
            orgId,
            recipientEmail: c.email as string,
            subject: renderTemplate(subject, vars),
            htmlBody: renderedBody,
            fromAddress: formattedFrom,
            senderIdentityId: campaign.sender_identity_id ?? "",
            leadId: (c.lead_id as string) ?? null,
          },
        };
      } else if (campaign.channel === "whatsapp") {
        return {
          name: "send-whatsapp",
          data: {
            campaignContactId: ccId,
            campaignId,
            orgId,
            recipientPhone: (c.phone as string)?.replace(/\D/g, "") ?? "",
            body: renderedBody,
            templateName: step.whatsapp_template_name ?? null,
            phoneNumberId: campaign.whatsapp_phone_number_id ?? "",
            accessToken: credentials.accessToken ?? "",
            senderIdentityId: campaign.sender_identity_id ?? "",
            leadId: (c.lead_id as string) ?? null,
          },
        };
      } else {
        return {
          name: "send-sms",
          data: {
            campaignContactId: ccId,
            campaignId,
            orgId,
            recipientPhone: (c.phone as string)?.replace(/\D/g, "") ?? "",
            body: renderedBody,
            senderId: campaign.sms_sender_id ?? "",
            dltTemplateId: step.dlt_template_id ?? null,
            credentials,
            senderIdentityId: campaign.sender_identity_id ?? "",
            leadId: (c.lead_id as string) ?? null,
          },
        };
      }
    });

    await channelQueue.addBulk(jobs);
    totalEnrolled += batch.length;
  }

  await db("campaigns").where("id", campaignId).update({
    total_contacts: db.raw("total_contacts + ?", [totalEnrolled]),
    updated_at: new Date(),
  });

  logger.info("[campaign-send] dispatched", { campaignId, totalEnrolled });
}
