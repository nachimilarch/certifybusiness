import { Job } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { logger } from "../../core/logger";
import { handleInboundWhatsAppMessage, handleInboundSmsMessage } from "../../modules/inbox/inbox.service";
import type { WebhookJobData } from "../../modules/webhooks/webhook.service";

export async function processWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { type, payload } = job.data;
  const db = getDb();

  try {
    if (type === "whatsapp_status") {
      await processWhatsAppWebhook(db, payload);
    } else if (type === "ses_notification") {
      await processSesNotification(db, payload);
    } else if (type === "sms_delivery") {
      await processSmsDelivery(db, payload);
    } else if (type === "sms_inbound") {
      await processSmsInbound(db, payload);
    }
  } catch (err) {
    logger.error("[webhook-process] error", { type, err });
    throw err;
  }
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

async function processWhatsAppWebhook(
  db: ReturnType<typeof import("../../core/database").getDb>,
  payload: Record<string, unknown>
): Promise<void> {
  const entries: unknown[] = (payload.entry as unknown[]) ?? [];

  for (const entry of entries) {
    const changes: unknown[] = ((entry as Record<string, unknown>).changes as unknown[]) ?? [];
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown>;
      if (!value) continue;

      // Status updates (sent/delivered/read)
      const statuses: unknown[] = (value.statuses as unknown[]) ?? [];
      for (const status of statuses) {
        const s = status as Record<string, unknown>;
        const waMessageId = s.id as string;
        const newStatus = s.status as string;
        const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();

        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === "delivered") updates.delivered_at = ts;
        if (newStatus === "read") updates.read_at = ts;

        await db("whatsapp_messages").where("wa_message_id", waMessageId).update(updates);

        if (newStatus === "delivered") {
          const msg = await db("whatsapp_messages").where("wa_message_id", waMessageId).first();
          if (msg?.campaign_id) {
            await db("campaigns").where("id", msg.campaign_id).update({
              delivered_count: db.raw("delivered_count + 1"),
            });
          }
        }
        if (newStatus === "read") {
          const msg = await db("whatsapp_messages").where("wa_message_id", waMessageId).first();
          if (msg?.campaign_id) {
            await db("campaigns").where("id", msg.campaign_id).update({
              opened_count: db.raw("opened_count + 1"),
            });
          }
        }
      }

      // Inbound messages (replies)
      const messages: unknown[] = (value.messages as unknown[]) ?? [];
      for (const msg of messages) {
        const m = msg as Record<string, unknown>;
        const senderPhone = m.from as string;
        const waId = m.id as string;
        const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
        const text =
          m.type === "text"
            ? ((m.text as Record<string, unknown>)?.body as string) ?? null
            : null;

        // ── Correlation ────────────────────────────────────────────────────
        // Strategy 1 (highest confidence): Meta provides a "context" field
        // when the user explicitly replies to a specific message. Use that
        // WA message ID to find the exact outbound row.
        const contextId = (m.context as Record<string, unknown> | undefined)?.id as string | undefined;
        let correlationMethod = "none";
        let outbound: Record<string, unknown> | null = null;

        if (contextId) {
          outbound = await db("whatsapp_messages")
            .where("wa_message_id", contextId)
            .where("direction", "outbound")
            .first() ?? null;
          if (outbound) correlationMethod = "context_id";
        }

        // Strategy 2 (fallback): most recent outbound message to this phone number
        if (!outbound) {
          outbound = await db("whatsapp_messages")
            .where("recipient_phone", senderPhone)
            .where("direction", "outbound")
            .orderBy("created_at", "desc")
            .first() ?? null;
          if (outbound) correlationMethod = "phone_recency";
        }

        logger.info("[webhook-process] WA inbound correlation", {
          waId, senderPhone, contextId: contextId ?? null, correlationMethod,
        });

        // ── Dedup: skip if this WA message ID was already processed ────────
        const orgId = (outbound?.organisation_id as string) ?? "";
        if (orgId && waId) {
          const alreadyExists = await db("whatsapp_messages")
            .where({ organisation_id: orgId, wa_message_id: waId })
            .first();
          if (alreadyExists) {
            logger.info("[webhook-process] duplicate WA inbound ignored", { waId });
            continue;
          }
        }

        const waDbId = uuidv4();
        // ON DUPLICATE KEY IGNORE as DB-level safety net
        await db("whatsapp_messages")
          .insert({
            id: waDbId,
            organisation_id: orgId,
            campaign_id: outbound?.campaign_id ?? null,
            lead_id: outbound?.lead_id ?? null,
            sender_identity_id: outbound?.sender_identity_id ?? null,
            wa_message_id: waId,
            direction: "inbound",
            sender_phone: senderPhone,
            recipient_phone: null,
            message_type: (m.type as string) ?? "text",
            body: text,
            status: "replied",
            replied_at: ts,
            created_at: ts,
          })
          .onConflict(["organisation_id", "wa_message_id"])
          .ignore();

        if (outbound?.campaign_id) {
          await db("campaigns").where("id", outbound.campaign_id).update({
            replied_count: db.raw("replied_count + 1"),
          });
        }

        // Create/update conversation in shared inbox
        if (orgId) {
          await handleInboundWhatsAppMessage(db, {
            orgId,
            senderPhone,
            waMessageId: waId,
            waMessageDbId: waDbId,
            campaignId: (outbound?.campaign_id as string) ?? null,
            campaignContactId: (outbound?.campaign_contact_id as string) ?? null,
            leadId: (outbound?.lead_id as string) ?? null,
            senderIdentityId: (outbound?.sender_identity_id as string) ?? null,
            bodyText: text,
            messageType: (m.type as string) ?? "text",
            receivedAt: ts,
            correlationMethod,
          }).catch((err) => logger.warn("[webhook-process] conversation creation failed", { err }));
        }
      }
    }
  }
}

// ─── SES notifications ────────────────────────────────────────────────────────

async function processSesNotification(
  db: ReturnType<typeof import("../../core/database").getDb>,
  payload: Record<string, unknown>
): Promise<void> {
  const notifType = payload.notificationType as string;
  const now = new Date();

  if (notifType === "Delivery") {
    const mail = payload.mail as Record<string, unknown>;
    const messageId = mail?.messageId as string;
    await db("email_events")
      .where("message_id", messageId)
      .update({ event_type: "delivered" });

    const event = await db("email_events").where("message_id", messageId).first();
    if (event?.campaign_id) {
      await db("campaigns").where("id", event.campaign_id).update({
        delivered_count: db.raw("delivered_count + 1"),
      });
    }
  } else if (notifType === "Bounce") {
    const bounce = payload.bounce as Record<string, unknown>;
    const mail = payload.mail as Record<string, unknown>;
    const messageId = mail?.messageId as string;
    await db("email_events").where("message_id", messageId).update({ event_type: "bounced" });

    const event = await db("email_events").where("message_id", messageId).first();
    if (event?.campaign_id) {
      await db("campaigns").where("id", event.campaign_id).update({
        bounced_count: db.raw("bounced_count + 1"),
      });
    }
    // Add to suppression list
    const bouncedRecipients = (bounce?.bouncedRecipients as Record<string, unknown>[]) ?? [];
    for (const r of bouncedRecipients) {
      const email = r.emailAddress as string;
      if (!email || !event?.organisation_id) continue;
      await db("suppression_list")
        .insert({
          id: uuidv4(),
          organisation_id: event.organisation_id,
          type: "email",
          value: email.toLowerCase(),
          reason: "bounce",
          source: "ses",
          created_at: now,
        })
        .onConflict(["organisation_id", "type", "value"])
        .ignore();
    }
  } else if (notifType === "Complaint") {
    const mail = payload.mail as Record<string, unknown>;
    const messageId = mail?.messageId as string;
    const complaint = payload.complaint as Record<string, unknown>;

    await db("email_events").where("message_id", messageId).update({ event_type: "complained" });

    const event = await db("email_events").where("message_id", messageId).first();
    const complainedRecipients = (complaint?.complainedRecipients as Record<string, unknown>[]) ?? [];
    for (const r of complainedRecipients) {
      const email = r.emailAddress as string;
      if (!email || !event?.organisation_id) continue;
      await db("suppression_list")
        .insert({
          id: uuidv4(),
          organisation_id: event.organisation_id,
          type: "email",
          value: email.toLowerCase(),
          reason: "spam_complaint",
          source: "ses",
          created_at: now,
        })
        .onConflict(["organisation_id", "type", "value"])
        .ignore();
    }
  }
}

// ─── SMS inbound ──────────────────────────────────────────────────────────────
//
// Field names are provider-specific. Exotel's inbound-SMS callback uses
// capitalized fields (From/To/Body/SmsSid); Twilio/generic gateways tend to
// use lowercase. Parsed defensively here so the pipeline is ready the moment
// a real provider + webhook URL are configured — confirm exact field names
// against that provider's docs once chosen.

async function processSmsInbound(
  db: ReturnType<typeof import("../../core/database").getDb>,
  payload: Record<string, unknown>
): Promise<void> {
  const senderPhone = (payload.From ?? payload.from ?? payload.Sender ?? payload.sender) as
    | string
    | undefined;
  const body = (payload.Body ?? payload.body ?? payload.Text ?? payload.text) as string | undefined;
  const providerMessageId =
    (payload.SmsSid ?? payload.MessageSid ?? payload.sid ?? payload.messageId ?? payload.message_id) as
      | string
      | undefined;

  if (!senderPhone) {
    logger.warn("[webhook-process] SMS inbound missing sender phone", { payload });
    return;
  }

  const ts = new Date();

  // Correlation: most recent outbound SMS to this phone number (same
  // approach as WhatsApp's phone-recency fallback — no per-message context
  // id exists for SMS the way Meta provides one for WhatsApp).
  const outbound = await db("sms_messages")
    .where("recipient_phone", senderPhone)
    .where("direction", "outbound")
    .orderBy("created_at", "desc")
    .first();
  const correlationMethod = outbound ? "phone_recency" : "none";
  const orgId = (outbound?.organisation_id as string) ?? "";

  if (!orgId) {
    logger.warn("[webhook-process] SMS inbound has no correlated org — dropped", { senderPhone });
    return;
  }

  // Dedup by provider message id within the org
  if (providerMessageId) {
    const alreadyExists = await db("sms_messages")
      .where({ organisation_id: orgId, provider_message_id: providerMessageId, direction: "inbound" })
      .first();
    if (alreadyExists) {
      logger.info("[webhook-process] duplicate SMS inbound ignored", { providerMessageId });
      return;
    }
  }

  await db("sms_messages").insert({
    id: uuidv4(),
    organisation_id: orgId,
    campaign_id: outbound?.campaign_id ?? null,
    lead_id: outbound?.lead_id ?? null,
    sender_identity_id: outbound?.sender_identity_id ?? null,
    provider_message_id: providerMessageId ?? null,
    direction: "inbound",
    recipient_phone: senderPhone,
    body: body ?? null,
    status: "replied",
    replied_at: ts,
    created_at: ts,
  });

  if (outbound?.campaign_id) {
    await db("campaigns").where("id", outbound.campaign_id).update({
      replied_count: db.raw("replied_count + 1"),
    });
  }

  await handleInboundSmsMessage(db, {
    orgId,
    senderPhone,
    providerMessageId: providerMessageId ?? null,
    campaignId: (outbound?.campaign_id as string) ?? null,
    campaignContactId: (outbound?.campaign_contact_id as string) ?? null,
    leadId: (outbound?.lead_id as string) ?? null,
    senderIdentityId: (outbound?.sender_identity_id as string) ?? null,
    bodyText: body ?? null,
    receivedAt: ts,
    correlationMethod,
  }).catch((err) => logger.warn("[webhook-process] SMS conversation creation failed", { err }));
}

// ─── SMS delivery ─────────────────────────────────────────────────────────────

async function processSmsDelivery(
  db: ReturnType<typeof import("../../core/database").getDb>,
  payload: Record<string, unknown>
): Promise<void> {
  const providerMessageId =
    (payload.messageId ?? payload.message_id ?? payload.sid) as string | undefined;
  if (!providerMessageId) return;

  const status = (payload.status ?? payload.Status ?? payload.smsStatus) as string | undefined;
  if (!status) return;

  const mapped =
    status.toLowerCase() === "delivered"
      ? "delivered"
      : status.toLowerCase().includes("fail")
      ? "failed"
      : undefined;

  if (!mapped) return;

  await db("sms_messages")
    .where("provider_message_id", providerMessageId)
    .update({
      status: mapped,
      ...(mapped === "delivered" ? { delivered_at: new Date() } : {}),
    });

  if (mapped === "delivered") {
    const msg = await db("sms_messages").where("provider_message_id", providerMessageId).first();
    if (msg?.campaign_id) {
      await db("campaigns").where("id", msg.campaign_id).update({
        delivered_count: db.raw("delivered_count + 1"),
      });
    }
  }
}
