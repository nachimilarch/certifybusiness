import { Request, Response, NextFunction } from "express";
import * as svc from "./campaign.service";
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  LaunchCampaignSchema,
} from "./campaign.schema";
import { ok, created, noContent, paginated, parsePagination } from "../../core/response";
import { ValidationError, ForbiddenError } from "../../core/errors";
import { checkPermission } from "../../core/middleware/rbac.middleware";
import type { UserPermissions } from "../../core/types";

export async function listCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req.query);
    const { campaigns, total } = await svc.listCampaigns(req.user!.organisationId, {
      page,
      limit,
      channel: req.query.channel as string | undefined,
      status: req.query.status as string | undefined,
    });
    paginated(res, campaigns, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

export async function getCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await svc.getCampaign(req.params.id, req.user!.organisationId);
    ok(res, campaign);
  } catch (err) { next(err); }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const permKey = `send_${parsed.data.channel}_campaigns` as keyof UserPermissions;
    if (!checkPermission(req.user!, permKey)) {
      throw new ForbiddenError(`Missing permission: ${permKey}`);
    }
    const campaign = await svc.createCampaign(req.user!.organisationId, req.user!.id, parsed.data);
    created(res, campaign);
  } catch (err) { next(err); }
}

export async function updateCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdateCampaignSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const campaign = await svc.updateCampaign(req.params.id, req.user!.organisationId, parsed.data, req.user!);
    ok(res, campaign);
  } catch (err) { next(err); }
}

export async function deleteCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteCampaign(req.params.id, req.user!.organisationId, req.user!);
    noContent(res);
  } catch (err) { next(err); }
}

export async function launchCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = LaunchCampaignSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map(e => e.message).join(", "));
    const campaign = await svc.launchCampaign(
      req.params.id,
      req.user!.organisationId,
      parsed.data.scheduledAt,
      req.user!
    );
    ok(res, campaign);
  } catch (err) { next(err); }
}

export async function pauseCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await svc.pauseCampaign(req.params.id, req.user!.organisationId, req.user!);
    ok(res, campaign);
  } catch (err) { next(err); }
}

export async function resumeCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaign = await svc.resumeCampaign(req.params.id, req.user!.organisationId, req.user!);
    ok(res, campaign);
  } catch (err) { next(err); }
}
