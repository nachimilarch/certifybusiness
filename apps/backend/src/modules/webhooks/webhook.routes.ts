import { Router } from "express";
import * as ctrl from "./webhook.controller";

export const webhookRouter = Router();

// Raw body is needed for WhatsApp HMAC verification — set before body-parser
webhookRouter.get("/whatsapp", ctrl.whatsappVerify);
webhookRouter.post("/whatsapp", ctrl.whatsappEvent);

webhookRouter.post("/ses", ctrl.sesNotification);
webhookRouter.post("/sms/delivery", ctrl.smsDelivery);
webhookRouter.post("/sms/inbound", ctrl.smsInbound);
