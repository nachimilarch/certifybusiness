import { Request, Response, NextFunction } from "express";
import * as NotificationService from "./notification.service";
import { ok } from "../../core/response";

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const limit = parseInt((req.query.limit as string) ?? "20", 10);
    const result = await NotificationService.listNotifications(
      req.user!.organisationId,
      req.user!.id,
      page,
      limit
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const count = await NotificationService.getUnreadCount(req.user!.organisationId, req.user!.id);
    ok(res, { count });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await NotificationService.markRead(req.user!.organisationId, req.user!.id, req.params.id);
    ok(res, null);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await NotificationService.markAllRead(req.user!.organisationId, req.user!.id);
    ok(res, null);
  } catch (err) {
    next(err);
  }
}
