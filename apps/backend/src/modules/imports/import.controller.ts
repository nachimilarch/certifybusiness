import { Request, Response, NextFunction } from "express";
import * as svc from "./import.service";
import * as schema from "./import.schema";
import { ok, created, paginated, noContent, parsePagination } from "../../core/response";
import { ValidationError, ForbiddenError } from "../../core/errors";
import { checkPermission } from "../../core/middleware/rbac.middleware";
import type { Channel, UserPermissions } from "../../core/types";
import type { ApprovalStatus } from "./import.service";

export async function uploadList(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ValidationError("CSV file is required");

    const parsed = schema.UploadListQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    }

    const permKey = `upload_${parsed.data.channel}_data` as keyof UserPermissions;
    if (!checkPermission(req.user!, permKey)) {
      throw new ForbiddenError(`Missing permission: ${permKey}`);
    }

    const list = await svc.createUploadedList(
      req.user!.organisationId,
      req.user!.id,
      req.file,
      parsed.data.channel as Channel,
      parsed.data.name,
      req.user!.role
    );

    const message = list.requiresApproval
      ? "Upload submitted for admin approval"
      : "Upload queued for processing";
    created(res, list, message);
  } catch (err) {
    next(err);
  }
}

export async function getLists(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = schema.ListUploadsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query params");

    const { lists, total } = await svc.listUploads(req.user!.organisationId, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      channel: parsed.data.channel as Channel | undefined,
      status: parsed.data.status,
      approvalStatus: parsed.data.approvalStatus as ApprovalStatus | undefined,
    });

    paginated(res, lists, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await svc.getListById(req.params.id, req.user!.organisationId);
    ok(res, list);
  } catch (err) {
    next(err);
  }
}

export async function getContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = schema.ListContactsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query params");

    const isValid =
      parsed.data.isValid === "true" ? true : parsed.data.isValid === "false" ? false : undefined;
    const isSuppressed =
      parsed.data.isSuppressed === "true"
        ? true
        : parsed.data.isSuppressed === "false"
        ? false
        : undefined;

    const { contacts, total } = await svc.getListContacts(
      req.params.id,
      req.user!.organisationId,
      { page: parsed.data.page, limit: parsed.data.limit, isValid, isSuppressed }
    );

    paginated(res, contacts, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllContactsController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = schema.AllContactsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query params");

    const isValid =
      parsed.data.isValid === "true" ? true : parsed.data.isValid === "false" ? false : undefined;
    const isSuppressed =
      parsed.data.isSuppressed === "true"
        ? true
        : parsed.data.isSuppressed === "false"
        ? false
        : undefined;

    const { contacts, total } = await svc.getAllContacts(req.user!.organisationId, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      listId: parsed.data.listId,
      channel: parsed.data.channel as Channel | undefined,
      isValid,
      isSuppressed,
    });

    paginated(res, contacts, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) {
    next(err);
  }
}

export async function removeList(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteList(req.params.id, req.user!.organisationId);
    noContent(res);
  } catch (err) {
    next(err);
  }
}

export async function approveUploadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = schema.ApproveUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(", "));
    }

    const list = await svc.approveUpload(
      req.params.id,
      req.user!.organisationId,
      req.user!.id,
      parsed.data.action,
      parsed.data.rejectionReason
    );

    const verb = parsed.data.action === "approve" ? "approved" : "rejected";
    ok(res, list, `Upload ${verb} successfully`);
  } catch (err) {
    next(err);
  }
}

export async function getPendingApprovalsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = schema.ListUploadsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new ValidationError("Invalid query params");

    const { lists, total } = await svc.getPendingApprovals(req.user!.organisationId, {
      page: parsed.data.page,
      limit: parsed.data.limit,
    });

    paginated(res, lists, {
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
      pages: Math.ceil(total / parsed.data.limit),
    });
  } catch (err) {
    next(err);
  }
}
