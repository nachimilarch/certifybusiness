import { Request, Response, NextFunction } from "express";
import * as svc from "./channel.service";
import {
  CreateSenderIdentitySchema,
  UpdateSenderIdentitySchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
} from "./channel.schema";
import { ok, created, noContent } from "../../core/response";
import { ValidationError } from "../../core/errors";
import { config } from "../../core/config";

// ─── Sender Identities ────────────────────────────────────────────────────────

export async function listSenders(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = req.query.channel as string | undefined;
    const list = await svc.listSenderIdentities(req.user!.organisationId, channel);
    ok(res, list);
  } catch (err) { next(err); }
}

export async function getSender(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await svc.getSenderIdentity(req.params.id, req.user!.organisationId);
    ok(res, item);
  } catch (err) { next(err); }
}

export async function createSender(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateSenderIdentitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const item = await svc.createSenderIdentity(req.user!.organisationId, parsed.data);
    created(res, item);
  } catch (err) { next(err); }
}

export async function updateSender(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdateSenderIdentitySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const item = await svc.updateSenderIdentity(req.params.id, req.user!.organisationId, parsed.data);
    ok(res, item);
  } catch (err) { next(err); }
}

export async function deleteSender(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteSenderIdentity(req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) { next(err); }
}

export async function testSender(req: Request, res: Response, next: NextFunction) {
  try {
    const toEmail = (req.body?.to as string | undefined) || req.user!.email;
    const result = await svc.testSenderIdentity(req.params.id, req.user!.organisationId, toEmail);
    ok(res, result);
  } catch (err) { next(err); }
}

export async function getWebhookUrls(_req: Request, res: Response, next: NextFunction) {
  try {
    const urls = svc.getWebhookUrls(config.appUrl);
    ok(res, urls);
  } catch (err) { next(err); }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = req.query.channel as string | undefined;
    const list = await svc.listTemplates(req.user!.organisationId, channel);
    ok(res, list);
  } catch (err) { next(err); }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await svc.getTemplate(req.params.id, req.user!.organisationId);
    ok(res, item);
  } catch (err) { next(err); }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateTemplateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const item = await svc.createTemplate(req.user!.organisationId, req.user!.id, parsed.data);
    created(res, item);
  } catch (err) { next(err); }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdateTemplateSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const item = await svc.updateTemplate(req.params.id, req.user!.organisationId, parsed.data);
    ok(res, item);
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteTemplate(req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) { next(err); }
}
