import axios from "axios";
import { logger } from "../logger";

/**
 * Generic SMS sender abstraction.
 * Credentials object shape (stored encrypted in sender_identities):
 * { apiKey: string, apiSecret?: string, baseUrl: string, provider: "exotel" | "generic" }
 *
 * Exotel: POST https://{apiKey}:{apiToken}@api.exotel.com/v1/Accounts/{sid}/Sms/send
 * Generic: POST baseUrl with { apiKey, from, to, body, dltTemplateId? }
 */

export interface SmsSendOptions {
  recipient: string;   // E.164 phone
  senderId: string;    // DLT registered sender ID
  body: string;
  dltTemplateId?: string | null;
  credentials: {
    provider: "exotel" | "generic";
    apiKey: string;
    apiSecret?: string;
    accountSid?: string; // Exotel only
    baseUrl: string;
  };
}

export interface SmsSendResult {
  providerMessageId: string | null;
  success: boolean;
  error?: string;
}

export async function sendSms(opts: SmsSendOptions): Promise<SmsSendResult> {
  const { credentials } = opts;

  try {
    if (credentials.provider === "exotel") {
      return await sendExotel(opts);
    }
    return await sendGeneric(opts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[sms-sender] failed", { to: opts.recipient, err: msg });
    return { providerMessageId: null, success: false, error: msg };
  }
}

async function sendExotel(opts: SmsSendOptions): Promise<SmsSendResult> {
  const { credentials } = opts;
  const url = `${credentials.baseUrl}/v1/Accounts/${credentials.accountSid}/Sms/send`;
  const res = await axios.post(
    url,
    new URLSearchParams({
      From: opts.senderId,
      To: opts.recipient,
      Body: opts.body,
      ...(opts.dltTemplateId ? { DltTemplateId: opts.dltTemplateId } : {}),
    }),
    {
      auth: { username: credentials.apiKey, password: credentials.apiSecret ?? "" },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  const sid: string | null = res.data?.SMSMessage?.Sid ?? null;
  logger.debug("[sms-sender] exotel sent", { to: opts.recipient, sid });
  return { providerMessageId: sid, success: true };
}

async function sendGeneric(opts: SmsSendOptions): Promise<SmsSendResult> {
  const { credentials } = opts;
  const res = await axios.post(credentials.baseUrl, {
    apiKey: credentials.apiKey,
    from: opts.senderId,
    to: opts.recipient,
    body: opts.body,
    ...(opts.dltTemplateId ? { dltTemplateId: opts.dltTemplateId } : {}),
  });
  const id: string | null =
    res.data?.messageId ?? res.data?.id ?? res.data?.message_id ?? null;
  logger.debug("[sms-sender] generic sent", { to: opts.recipient, id });
  return { providerMessageId: id, success: true };
}
