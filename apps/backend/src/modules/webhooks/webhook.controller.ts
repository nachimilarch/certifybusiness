import { Request, Response, NextFunction } from "express";
import { config } from "../../core/config";
import { logger } from "../../core/logger";
import * as svc from "./webhook.service";

// ─── WhatsApp Cloud API ────────────────────────────────────────────────────────

/** GET /webhooks/whatsapp — Meta hub.challenge verification */
export function whatsappVerify(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    logger.info("[webhook] WhatsApp hub verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

/** POST /webhooks/whatsapp — Inbound messages + status updates */
export async function whatsappEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const sig = req.headers["x-hub-signature-256"] as string | undefined;
    if (sig && !svc.verifyWhatsAppSignature(req.body as Buffer, sig)) {
      return void res.sendStatus(401);
    }
    const payload = JSON.parse((req.body as Buffer).toString("utf-8"));
    await svc.enqueueWhatsAppEvent(payload);
    res.sendStatus(200);
  } catch (err) { next(err); }
}

// ─── Amazon SES / SNS ────────────────────────────────────────────────────────

/** POST /webhooks/ses — SNS delivery/bounce/complaint notifications */
export async function sesNotification(req: Request, res: Response, next: NextFunction) {
  try {
    // SNS sends JSON with optional SubscribeURL for confirmation
    const body = req.body as Record<string, unknown>;

    if (body.Type === "SubscriptionConfirmation") {
      // Auto-confirm SNS subscription — fetch the confirm URL
      const axios = await import("axios");
      if (typeof body.SubscribeURL === "string") {
        await axios.default.get(body.SubscribeURL).catch(() => {});
      }
      logger.info("[webhook] SNS subscription confirmed");
      return void res.sendStatus(200);
    }

    if (body.Type === "Notification") {
      const message = typeof body.Message === "string" ? JSON.parse(body.Message) : body.Message;
      await svc.enqueueSesNotification(message as Record<string, unknown>);
    }

    res.sendStatus(200);
  } catch (err) { next(err); }
}

// ─── SMS delivery reports ────────────────────────────────────────────────────

/** POST /webhooks/sms/delivery — Generic SMS delivery callback */
export async function smsDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.enqueueSmsDelivery(req.body as Record<string, unknown>);
    res.sendStatus(200);
  } catch (err) { next(err); }
}

/**
 * POST /webhooks/sms/inbound — Inbound SMS replies. Field names vary by
 * provider (Exotel/Twilio/etc); exact mapping is finalized once a provider
 * is configured — see processSmsInbound() in webhook-process.worker.ts.
 */
export async function smsInbound(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.enqueueSmsInbound(req.body as Record<string, unknown>);
    res.sendStatus(200);
  } catch (err) { next(err); }
}
