import { Request, Response, NextFunction } from "express";
import * as LeadService from "./lead.service";
import { ok, created, noContent, paginated, parsePagination } from "../../core/response";
import { writeAuditLog } from "../../core/middleware/audit.middleware";
import type { LeadSource, LeadStatus } from "../../core/types";

function buildScope(req: Request) {
  const { user } = req;
  if (!user) throw new Error("No user");
  return LeadService.resolveLeadScope(
    user.role,
    user.permissions as Record<string, boolean>,
    user.id,
    [] // direct report IDs pre-fetched in a few endpoints below
  );
}

async function buildScopeWithTeam(req: Request) {
  const { user } = req;
  if (!user) throw new Error("No user");
  const teamIds = await LeadService.getDirectReportIds(user.id, user.organisationId);
  return LeadService.resolveLeadScope(
    user.role,
    user.permissions as Record<string, boolean>,
    user.id,
    teamIds
  );
}

// ─── Leads CRUD ───────────────────────────────────────────────────────────────

export async function listLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const scope = await buildScopeWithTeam(req);

    const { leads, total } = await LeadService.listLeads(
      req.user!.organisationId,
      {
        page,
        limit,
        status: q.status as LeadStatus | undefined,
        source: q.source as LeadSource | undefined,
        assignedTo: q.assignedTo,
        search: q.search,
        tag: q.tag,
        createdFrom: q.createdFrom,
        createdTo: q.createdTo,
      },
      scope
    );
    paginated(res, leads, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await LeadService.createLead(
      req.user!.organisationId,
      req.body,
      req.user!.id
    );
    await writeAuditLog(req, "lead.create", "lead", lead.id, undefined, { name: lead.name });
    created(res, lead, "Lead created");
  } catch (err) {
    next(err);
  }
}

export async function getLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await LeadService.getLeadById(req.params.id, req.user!.organisationId);
    ok(res, lead);
  } catch (err) {
    next(err);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await LeadService.updateLead(
      req.params.id,
      req.user!.organisationId,
      req.body,
      req.user!.id
    );
    ok(res, lead);
  } catch (err) {
    next(err);
  }
}

export async function assignLead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lead = await LeadService.updateLead(
      req.params.id,
      req.user!.organisationId,
      { assignedTo: req.body.userId },
      req.user!.id
    );
    ok(res, lead, "Lead assigned");
  } catch (err) {
    next(err);
  }
}

export async function checkDuplicate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { phones = [], emails = [] } = req.body as { phones: string[]; emails: string[] };
    const duplicate = await LeadService.findDuplicate(req.user!.organisationId, phones, emails);
    ok(res, { duplicate });
  } catch (err) {
    next(err);
  }
}

// ─── Phones & Emails ──────────────────────────────────────────────────────────

export async function addPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const phone = await LeadService.addPhone(
      req.params.id,
      req.user!.organisationId,
      req.body.phone,
      req.body.isPrimary ?? false,
      req.body.isWhatsapp ?? false
    );
    created(res, phone);
  } catch (err) {
    next(err);
  }
}

export async function deletePhone(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await LeadService.deletePhone(req.params.phoneId, req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function addEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = await LeadService.addEmail(
      req.params.id,
      req.user!.organisationId,
      req.body.email,
      req.body.isPrimary ?? false
    );
    created(res, email);
  } catch (err) {
    next(err);
  }
}

export async function deleteEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await LeadService.deleteEmail(req.params.emailId, req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await LeadService.addNote(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.body
    );
    created(res, result);
  } catch (err) {
    next(err);
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await LeadService.createTask(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      req.body
    );
    created(res, task);
  } catch (err) {
    next(err);
  }
}

export async function completeTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await LeadService.completeTask(req.params.taskId, req.user!.organisationId);
    ok(res, null, "Task completed");
  } catch (err) {
    next(err);
  }
}
