import { Request, Response, NextFunction } from "express";
import * as ReportingService from "./reporting.service";
import { ok } from "../../core/response";

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await ReportingService.getDashboardStats(
      req.user!.organisationId,
      req.user!.id,
      req.user!.role,
      req.user!.permissions
    );
    ok(res, stats);
  } catch (err) {
    next(err);
  }
}

export async function getTeamPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getTeamPerformance(
      req.user!.organisationId,
      req.params.managerId ?? req.user!.id
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getCampaignSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getCampaignSummary(req.user!.organisationId);
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

function parseDateRange(q: Record<string, string>) {
  return {
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  };
}

export async function getLeadsByChannel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getLeadsByChannel(
      req.user!.organisationId,
      parseDateRange(req.query as Record<string, string>)
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getLeadsByEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getLeadsByEmployee(
      req.user!.organisationId,
      parseDateRange(req.query as Record<string, string>)
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getConversionFunnel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getConversionFunnel(
      req.user!.organisationId,
      parseDateRange(req.query as Record<string, string>)
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getCallActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await ReportingService.getCallActivity(
      req.user!.organisationId,
      parseDateRange(req.query as Record<string, string>)
    );
    ok(res, data);
  } catch (err) {
    next(err);
  }
}
