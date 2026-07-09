import axios from "axios";
import { config } from "../config";
import { logger } from "../logger";

export interface WaSendTemplateOptions {
  phoneNumberId: string;   // Meta phone number ID for the sending number
  accessToken: string;     // WABA access token (decrypted from credentials)
  recipient: string;       // E.164 phone number without leading +
  templateName: string;    // Approved template name in Meta
  languageCode?: string;   // e.g. "en_US"
  components?: object[];   // Template components (header/body params)
}

export interface WaSendTextOptions {
  phoneNumberId: string;
  accessToken: string;
  recipient: string;
  body: string;
}

export interface WaSendResult {
  waMessageId: string | null;
  success: boolean;
  error?: string;
}

const BASE = `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}`;

export async function sendWhatsAppTemplate(opts: WaSendTemplateOptions): Promise<WaSendResult> {
  const url = `${BASE}/${opts.phoneNumberId}/messages`;
  try {
    const res = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: opts.recipient,
        type: "template",
        template: {
          name: opts.templateName,
          language: { code: opts.languageCode ?? "en_US" },
          ...(opts.components ? { components: opts.components } : {}),
        },
      },
      { headers: { Authorization: `Bearer ${opts.accessToken}` } }
    );
    const waMessageId: string | null = res.data?.messages?.[0]?.id ?? null;
    logger.debug("[wa-sender] template sent", { to: opts.recipient, waMessageId });
    return { waMessageId, success: true };
  } catch (err: unknown) {
    const msg =
      axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data ?? err.message)
        : String(err);
    logger.error("[wa-sender] template failed", { to: opts.recipient, err: msg });
    return { waMessageId: null, success: false, error: msg };
  }
}

export async function sendWhatsAppText(opts: WaSendTextOptions): Promise<WaSendResult> {
  const url = `${BASE}/${opts.phoneNumberId}/messages`;
  try {
    const res = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: opts.recipient,
        type: "text",
        text: { body: opts.body, preview_url: false },
      },
      { headers: { Authorization: `Bearer ${opts.accessToken}` } }
    );
    const waMessageId: string | null = res.data?.messages?.[0]?.id ?? null;
    logger.debug("[wa-sender] text sent", { to: opts.recipient, waMessageId });
    return { waMessageId, success: true };
  } catch (err: unknown) {
    const msg =
      axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data ?? err.message)
        : String(err);
    logger.error("[wa-sender] text failed", { to: opts.recipient, err: msg });
    return { waMessageId: null, success: false, error: msg };
  }
}
