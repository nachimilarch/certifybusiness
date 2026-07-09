import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { getQueue, Queues } from "../../queues";
import { config } from "../../core/config";
import { logger } from "../../core/logger";

// ─── Webhook job data ─────────────────────────────────────────────────────────

export interface WebhookJobData {
  type: "whatsapp_status" | "whatsapp_inbound" | "ses_notification" | "sms_delivery" | "sms_inbound";
  payload: Record<string, unknown>;
  receivedAt: string;
}

// ─── WhatsApp webhook ─────────────────────────────────────────────────────────

export function verifyWhatsAppSignature(rawBody: Buffer, signature: string): boolean {
  if (!config.whatsapp.appSecret) return true; // skip in dev
  const expected = crypto
    .createHmac("sha256", config.whatsapp.appSecret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace("sha256=", ""), "hex"),
    Buffer.from(expected, "hex")
  );
}

export async function enqueueWhatsAppEvent(payload: Record<string, unknown>): Promise<void> {
  const queue = getQueue(Queues.WEBHOOK_PROCESS);
  await queue.add("whatsapp-event", {
    type: "whatsapp_status",
    payload,
    receivedAt: new Date().toISOString(),
  } satisfies WebhookJobData);
}

// ─── SES / SNS webhook ───────────────────────────────────────────────────────

export async function enqueueSesNotification(payload: Record<string, unknown>): Promise<void> {
  const queue = getQueue(Queues.WEBHOOK_PROCESS);
  await queue.add("ses-notification", {
    type: "ses_notification",
    payload,
    receivedAt: new Date().toISOString(),
  } satisfies WebhookJobData);
}

// ─── SMS delivery webhook ─────────────────────────────────────────────────────

export async function enqueueSmsDelivery(payload: Record<string, unknown>): Promise<void> {
  const queue = getQueue(Queues.WEBHOOK_PROCESS);
  await queue.add("sms-delivery", {
    type: "sms_delivery",
    payload,
    receivedAt: new Date().toISOString(),
  } satisfies WebhookJobData);
}

// ─── SMS inbound webhook ──────────────────────────────────────────────────────

export async function enqueueSmsInbound(payload: Record<string, unknown>): Promise<void> {
  const queue = getQueue(Queues.WEBHOOK_PROCESS);
  await queue.add("sms-inbound", {
    type: "sms_inbound",
    payload,
    receivedAt: new Date().toISOString(),
  } satisfies WebhookJobData);
}
