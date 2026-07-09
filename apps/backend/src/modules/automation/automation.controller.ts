import { Request, Response, NextFunction } from "express";
import { validate } from "../../core/middleware/validate.middleware";
import { CreateAutomationRuleSchema, UpdateAutomationRuleSchema } from "./automation.schema";
import * as AutomationService from "./automation.service";
import { ok } from "../../core/response";
import { ValidationError } from "../../core/errors";

export async function listRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await AutomationService.listRules(req.user!.organisationId);
    ok(res, rules);
  } catch (err) {
    next(err);
  }
}

export async function getRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rule = await AutomationService.getRule(req.user!.organisationId, req.params.id);
    ok(res, rule);
  } catch (err) {
    next(err);
  }
}

export async function createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = CreateAutomationRuleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    const rule = await AutomationService.createRule(req.user!.organisationId, req.user!.id, parsed.data);
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
}

export async function updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = UpdateAutomationRuleSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    const rule = await AutomationService.updateRule(req.user!.organisationId, req.params.id, parsed.data);
    ok(res, rule);
  } catch (err) {
    next(err);
  }
}

export async function deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AutomationService.deleteRule(req.user!.organisationId, req.params.id);
    ok(res, null);
  } catch (err) {
    next(err);
  }
}

export async function listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
    const { logs, total } = await AutomationService.listLogs(req.user!.organisationId, page, limit);
    res.json({ success: true, data: logs, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}
