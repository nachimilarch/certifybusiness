import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { getDb } from "../../core/database";
import { getQueue } from "../../queues";
import { Queues } from "../../queues";
import { NotFoundError, ValidationError } from "../../core/errors";
import type { Channel } from "../../core/types";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

export interface UploadedListDTO {
  id: string;
  organisationId: string;
  uploadedBy: string;
  uploadedByName: string;
  name: string;
  channel: Channel;
  originalFilename: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  suppressedRows: number;
  status: "pending" | "processing" | "completed" | "failed";
  approvalStatus: ApprovalStatus;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface UploadedContactDTO {
  id: string;
  listId: string;
  rowNumber: number | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  company: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  extraData: Record<string, string> | null;
  isValid: boolean;
  validationErrors: string[] | null;
  isSuppressed: boolean;
  isDuplicate: boolean;
  leadId: string | null;
}

export interface CsvImportJobData {
  listId: string;
  orgId: string;
  filePath: string;
  channel: Channel;
}

function rowToListDTO(row: Record<string, unknown>): UploadedListDTO {
  const approverFirst = (row.approver_first_name as string) ?? "";
  const approverLast = (row.approver_last_name as string) ?? "";
  const approvedByName = row.approved_by
    ? ([approverFirst, approverLast].filter(Boolean).join(" ") || (row.approver_email as string) || null)
    : null;

  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    uploadedBy: row.uploaded_by as string,
    uploadedByName:
      `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.uploader_email as string),
    name: row.name as string,
    channel: row.channel as Channel,
    originalFilename: (row.original_filename as string) ?? null,
    totalRows: Number(row.total_rows),
    validRows: Number(row.valid_rows),
    invalidRows: Number(row.invalid_rows),
    duplicateRows: Number(row.duplicate_rows),
    suppressedRows: Number(row.suppressed_rows),
    status: row.status as UploadedListDTO["status"],
    approvalStatus: (row.approval_status as ApprovalStatus) ?? "pending",
    requiresApproval: Boolean(row.requires_approval),
    approvedBy: (row.approved_by as string) ?? null,
    approvedByName,
    approvedAt: row.approved_at ? new Date(row.approved_at as Date).toISOString() : null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    processedAt: row.processed_at ? new Date(row.processed_at as Date).toISOString() : null,
    createdAt: new Date(row.created_at as Date).toISOString(),
  };
}

function rowToContactDTO(row: Record<string, unknown>): UploadedContactDTO {
  const firstName = (row.first_name as string) ?? null;
  const lastName = (row.last_name as string) ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
  let extraData: Record<string, string> | null = null;
  if (row.extra_data) {
    try {
      extraData =
        typeof row.extra_data === "string"
          ? JSON.parse(row.extra_data)
          : (row.extra_data as Record<string, string>);
    } catch {}
  }
  let validationErrors: string[] | null = null;
  if (row.validation_errors) {
    try {
      validationErrors =
        typeof row.validation_errors === "string"
          ? JSON.parse(row.validation_errors)
          : (row.validation_errors as string[]);
    } catch {}
  }
  return {
    id: row.id as string,
    listId: row.list_id as string,
    rowNumber: row.row_number != null ? Number(row.row_number) : null,
    firstName,
    lastName,
    fullName,
    company: (row.company as string) ?? null,
    designation: (row.designation as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    extraData,
    isValid: Boolean(row.is_valid),
    validationErrors,
    isSuppressed: Boolean(row.is_suppressed),
    isDuplicate: Boolean(row.is_duplicate),
    leadId: (row.lead_id as string) ?? null,
  };
}

// Base query that joins uploader and approver
function listBaseQuery(db: ReturnType<typeof getDb>) {
  return db("uploaded_lists as ul")
    .leftJoin("users as u", "u.id", "ul.uploaded_by")
    .leftJoin("users as ap", "ap.id", "ul.approved_by")
    .select(
      "ul.*",
      "u.first_name",
      "u.last_name",
      "u.email as uploader_email",
      "ap.first_name as approver_first_name",
      "ap.last_name as approver_last_name",
      "ap.email as approver_email"
    );
}

async function enqueueImport(
  listId: string,
  orgId: string,
  filePath: string,
  channel: Channel
): Promise<void> {
  const queue = getQueue(Queues.CSV_IMPORT);
  await queue.add(
    "process-csv",
    { listId, orgId, filePath, channel } satisfies CsvImportJobData,
    { jobId: `csv-import-${listId}` }
  );
}

export async function createUploadedList(
  orgId: string,
  uploadedBy: string,
  file: Express.Multer.File,
  channel: Channel,
  name: string,
  userRole: string
): Promise<UploadedListDTO> {
  const db = getDb();
  const listId = uuidv4();
  const now = new Date();

  // Check org settings for auto-approval
  const org = await db("organisations").where("id", orgId).select("settings").first();
  const settings: Record<string, unknown> =
    typeof org?.settings === "string" ? JSON.parse(org.settings) : (org?.settings ?? {});

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const autoApproveAdmins = Boolean(settings.auto_approve_admin_uploads);

  const requiresApproval = !(isAdmin && autoApproveAdmins);
  const approvalStatus: ApprovalStatus =
    isAdmin && autoApproveAdmins ? "auto_approved" : "pending";

  await db("uploaded_lists").insert({
    id: listId,
    organisation_id: orgId,
    uploaded_by: uploadedBy,
    name,
    channel,
    original_filename: file.originalname,
    file_path: file.path,
    status: "pending",
    approval_status: approvalStatus,
    requires_approval: requiresApproval ? 1 : 0,
    total_rows: 0,
    valid_rows: 0,
    invalid_rows: 0,
    duplicate_rows: 0,
    suppressed_rows: 0,
    created_at: now,
  });

  if (!requiresApproval) {
    await enqueueImport(listId, orgId, file.path, channel);
  }

  const row = await listBaseQuery(db).where("ul.id", listId).first();
  return rowToListDTO(row);
}

export async function approveUpload(
  listId: string,
  orgId: string,
  approvedBy: string,
  action: "approve" | "reject",
  rejectionReason?: string
): Promise<UploadedListDTO> {
  const db = getDb();

  const upload = await db("uploaded_lists")
    .where({ id: listId, organisation_id: orgId })
    .first();
  if (!upload) throw new NotFoundError("Upload not found");

  if (upload.approval_status === "approved" || upload.approval_status === "rejected") {
    throw new ValidationError(`Upload has already been ${upload.approval_status}`);
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    approved_by: approvedBy,
    approved_at: now,
  };

  if (action === "approve") {
    updates.approval_status = "approved";
  } else {
    updates.approval_status = "rejected";
    updates.rejection_reason = rejectionReason;
    updates.status = "failed";
  }

  await db("uploaded_lists").where("id", listId).update(updates);

  if (action === "approve") {
    await enqueueImport(listId, orgId, upload.file_path, upload.channel);
  }

  return getListById(listId, orgId);
}

export async function getPendingApprovals(
  orgId: string,
  query: { page: number; limit: number }
): Promise<{ lists: UploadedListDTO[]; total: number }> {
  const db = getDb();
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const base = db("uploaded_lists as ul")
    .leftJoin("users as u", "u.id", "ul.uploaded_by")
    .leftJoin("users as ap", "ap.id", "ul.approved_by")
    .where("ul.organisation_id", orgId)
    .where("ul.approval_status", "pending");

  const [rows, countRows] = await Promise.all([
    base
      .clone()
      .select(
        "ul.*",
        "u.first_name",
        "u.last_name",
        "u.email as uploader_email",
        "ap.first_name as approver_first_name",
        "ap.last_name as approver_last_name",
        "ap.email as approver_email"
      )
      .orderBy("ul.created_at", "asc")
      .limit(limit)
      .offset(offset),
    base.clone().count("ul.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { lists: rows.map(rowToListDTO), total };
}

export async function listUploads(
  orgId: string,
  query: {
    page: number;
    limit: number;
    channel?: Channel;
    status?: string;
    approvalStatus?: ApprovalStatus;
  }
): Promise<{ lists: UploadedListDTO[]; total: number }> {
  const db = getDb();
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  let baseQ = db("uploaded_lists as ul")
    .leftJoin("users as u", "u.id", "ul.uploaded_by")
    .leftJoin("users as ap", "ap.id", "ul.approved_by")
    .where("ul.organisation_id", orgId);

  if (query.channel) baseQ = baseQ.where("ul.channel", query.channel);
  if (query.status) baseQ = baseQ.where("ul.status", query.status);
  if (query.approvalStatus) baseQ = baseQ.where("ul.approval_status", query.approvalStatus);

  const [rows, countRows] = await Promise.all([
    baseQ
      .clone()
      .select(
        "ul.*",
        "u.first_name",
        "u.last_name",
        "u.email as uploader_email",
        "ap.first_name as approver_first_name",
        "ap.last_name as approver_last_name",
        "ap.email as approver_email"
      )
      .orderBy("ul.created_at", "desc")
      .limit(limit)
      .offset(offset),
    baseQ.clone().count("ul.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { lists: rows.map(rowToListDTO), total };
}

export async function getListById(listId: string, orgId: string): Promise<UploadedListDTO> {
  const db = getDb();
  const row = await listBaseQuery(db)
    .where("ul.id", listId)
    .where("ul.organisation_id", orgId)
    .first();
  if (!row) throw new NotFoundError("Uploaded list not found");
  return rowToListDTO(row);
}

export async function getListContacts(
  listId: string,
  orgId: string,
  query: {
    page: number;
    limit: number;
    isValid?: boolean;
    isSuppressed?: boolean;
  }
): Promise<{ contacts: UploadedContactDTO[]; total: number }> {
  const db = getDb();
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const list = await db("uploaded_lists")
    .where({ id: listId, organisation_id: orgId })
    .first();
  if (!list) throw new NotFoundError("Uploaded list not found");

  let baseQ = db("uploaded_contacts").where("list_id", listId);
  if (query.isValid !== undefined) baseQ = baseQ.where("is_valid", query.isValid);
  if (query.isSuppressed !== undefined) baseQ = baseQ.where("is_suppressed", query.isSuppressed);

  const [rows, countRows] = await Promise.all([
    baseQ.clone().orderBy("row_number", "asc").limit(limit).offset(offset),
    baseQ.clone().count("id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { contacts: rows.map(rowToContactDTO), total };
}

export interface ContactWithListDTO extends UploadedContactDTO {
  listName: string;
  listChannel: Channel;
  listOriginalFilename: string | null;
}

function rowToContactWithListDTO(row: Record<string, unknown>): ContactWithListDTO {
  return {
    ...rowToContactDTO(row),
    listName: row.list_name as string,
    listChannel: row.list_channel as Channel,
    listOriginalFilename: (row.list_original_filename as string) ?? null,
  };
}

export async function getAllContacts(
  orgId: string,
  query: {
    page: number;
    limit: number;
    listId?: string;
    channel?: Channel;
    isValid?: boolean;
    isSuppressed?: boolean;
  }
): Promise<{ contacts: ContactWithListDTO[]; total: number }> {
  const db = getDb();
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  let baseQ = db("uploaded_contacts as uc")
    .join("uploaded_lists as ul", "ul.id", "uc.list_id")
    .where("uc.organisation_id", orgId);

  if (query.listId) baseQ = baseQ.where("uc.list_id", query.listId);
  if (query.channel) baseQ = baseQ.where("ul.channel", query.channel);
  if (query.isValid !== undefined) baseQ = baseQ.where("uc.is_valid", query.isValid);
  if (query.isSuppressed !== undefined) baseQ = baseQ.where("uc.is_suppressed", query.isSuppressed);

  const [rows, countRows] = await Promise.all([
    baseQ
      .clone()
      .select(
        "uc.*",
        "ul.name as list_name",
        "ul.channel as list_channel",
        "ul.original_filename as list_original_filename"
      )
      .orderBy("uc.created_at", "desc")
      .limit(limit)
      .offset(offset),
    baseQ.clone().count("uc.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { contacts: rows.map(rowToContactWithListDTO), total };
}

export async function deleteList(listId: string, orgId: string): Promise<void> {
  const db = getDb();
  const list = await db("uploaded_lists")
    .where({ id: listId, organisation_id: orgId })
    .first();
  if (!list) throw new NotFoundError("Uploaded list not found");

  await db("uploaded_contacts").where("list_id", listId).delete();
  await db("uploaded_lists").where("id", listId).delete();

  if (list.file_path && fs.existsSync(list.file_path)) {
    fs.unlink(list.file_path, () => {});
  }
}
