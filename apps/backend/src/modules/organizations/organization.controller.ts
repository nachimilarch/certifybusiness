import { Request, Response, NextFunction } from "express";
import * as OrgService from "./organization.service";
import { ok, created, paginated, parsePagination } from "../../core/response";
import { writeAuditLog } from "../../core/middleware/audit.middleware";

export async function listOrgs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { orgs, total } = await OrgService.listOrgs(page, limit);
    paginated(res, orgs, { total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

export async function createOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const org = await OrgService.createOrg(req.body);
    await writeAuditLog(req, "org.create", "organisation", org.id, undefined, { name: org.name });
    created(res, org, "Organisation created");
  } catch (err) {
    next(err);
  }
}

export async function getOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Non-super_admins can only see their own org
    const orgId =
      req.user!.role === "super_admin" ? req.params.id : req.user!.organisationId;
    const org = await OrgService.getOrgById(orgId);
    ok(res, org);
  } catch (err) {
    next(err);
  }
}

export async function updateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId =
      req.user!.role === "super_admin" ? req.params.id : req.user!.organisationId;
    const old = await OrgService.getOrgById(orgId);
    const updated = await OrgService.updateOrg(orgId, req.body);
    await writeAuditLog(req, "org.update", "organisation", orgId, old, updated);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
}
