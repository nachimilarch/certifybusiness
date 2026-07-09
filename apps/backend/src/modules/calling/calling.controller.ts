import { Request, Response, NextFunction } from "express";
import * as CallingService from "./calling.service";
import { ok, created, paginated, parsePagination } from "../../core/response";
import type { CallOutcome } from "../../core/types";

export async function getCallQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const { contacts, total } = await CallingService.getCallQueue(
      req.user!.id,
      req.user!.organisationId,
      { listId: q.listId, status: q.status, page, limit }
    );
    paginated(res, contacts, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function logCall(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await CallingService.logCall(
      req.user!.organisationId,
      req.user!.id,
      req.body
    );
    created(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listCallLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const { logs, total } = await CallingService.listCallLogs(req.user!.organisationId, {
      page,
      limit,
      userId: q.userId,
      outcome: q.outcome as CallOutcome | undefined,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
    paginated(res, logs, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getFollowUps(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { followUps, total } = await CallingService.getFollowUps(
      req.user!.organisationId,
      req.user!.id,
      page,
      limit
    );
    paginated(res, followUps, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await CallingService.getMyStats(req.user!.id, req.user!.organisationId);
    ok(res, stats);
  } catch (err) {
    next(err);
  }
}
