import { Request, Response, NextFunction } from "express";
import * as svc from "./audit.service";
import * as schema from "./audit.schema";
import { ok, paginated } from "../../core/response";
import { ValidationError } from "../../core/errors";

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = schema.ListAuditLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    }

    const { logs, total } = await svc.listAuditLogs(req.user!.organisationId, parsed.data);

    paginated(res, logs, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAuditActions(req: Request, res: Response, next: NextFunction) {
  try {
    const actions = await svc.listDistinctActions(req.user!.organisationId);
    ok(res, actions);
  } catch (err) {
    next(err);
  }
}
