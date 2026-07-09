import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { getQueue, Queues } from "../../queues";
import { NotFoundError, ConflictError, ForbiddenError } from "../../core/errors";
import { parsePagination } from "../../core/response";
import { checkPermission } from "../../core/middleware/rbac.middleware";
import type { AuthUser, UserPermissions } from "../../core/types";
import type { CreateCampaignInput, UpdateCampaignInput } from "./campaign.schema";

function requireSendPermission(channel: string, user: AuthUser): void {
  const permKey = `send_${channel}_campaigns` as keyof UserPermissions;
  if (!checkPermission(user, permKey)) {
    throw new ForbiddenError(`Missing permission: ${permKey}`);
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CampaignStepDTO {
  id: string;
  campaignId: string;
  stepNumber: number;
  templateId: string | null;
  templateName: string | null;
  subject: string | null;
  body: string | null;
  delayDays: number;
  delayHours: number;
}

export interface CampaignDTO {
  id: string;
  organisationId: string;
  createdBy: string;
  createdByName: string;
  name: string;
  channel: "email" | "whatsapp" | "sms";
  senderIdentityId: string | null;
  senderName: string | null;
  listId: string | null;
  listName: string | null;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "failed";
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
  failedCount: number;
  unsubscribedCount: number;
  settings: Record<string, unknown> | null;
  steps: CampaignStepDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSendJobData {
  campaignId: string;
  orgId: string;
}

export interface EmailSendJobData {
  campaignContactId: string;
  campaignId: string;
  orgId: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  fromAddress: string;
  senderIdentityId: string;
  leadId: string | null;
}

export interface WaSendJobData {
  campaignContactId: string;
  campaignId: string;
  orgId: string;
  recipientPhone: string;
  body: string;
  templateName: string | null;
  phoneNumberId: string;
  accessToken: string;
  senderIdentityId: string;
  leadId: string | null;
}

export interface SmsSendJobData {
  campaignContactId: string;
  campaignId: string;
  orgId: string;
  recipientPhone: string;
  body: string;
  senderId: string;
  dltTemplateId: string | null;
  credentials: Record<string, string>;
  senderIdentityId: string;
  leadId: string | null;
}

function rowToCampaignDTO(
  row: Record<string, unknown>,
  steps: CampaignStepDTO[] = []
): CampaignDTO {
  let settings: Record<string, unknown> | null = null;
  try {
    settings = row.settings
      ? typeof row.settings === "string"
        ? JSON.parse(row.settings)
        : (row.settings as Record<string, unknown>)
      : null;
  } catch {}

  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    createdBy: row.created_by as string,
    createdByName: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.user_email as string),
    name: row.name as string,
    channel: row.channel as CampaignDTO["channel"],
    senderIdentityId: (row.sender_identity_id as string) ?? null,
    senderName: (row.sender_name as string) ?? null,
    listId: (row.list_id as string) ?? null,
    listName: (row.list_name as string) ?? null,
    status: row.status as CampaignDTO["status"],
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as Date).toISOString() : null,
    startedAt: row.started_at ? new Date(row.started_at as Date).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at as Date).toISOString() : null,
    totalContacts: Number(row.total_contacts),
    sentCount: Number(row.sent_count),
    deliveredCount: Number(row.delivered_count),
    openedCount: Number(row.opened_count),
    clickedCount: Number(row.clicked_count),
    repliedCount: Number(row.replied_count),
    bouncedCount: Number(row.bounced_count),
    failedCount: Number(row.failed_count),
    unsubscribedCount: Number(row.unsubscribed_count ?? 0),
    settings,
    steps,
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
  };
}

async function fetchCampaignRow(id: string, orgId: string) {
  const db = getDb();
  return db("campaigns as c")
    .leftJoin("users as u", "u.id", "c.created_by")
    .leftJoin("sender_identities as si", "si.id", "c.sender_identity_id")
    .leftJoin("uploaded_lists as ul", "ul.id", "c.list_id")
    .where("c.id", id)
    .where("c.organisation_id", orgId)
    .select(
      "c.*",
      "u.first_name",
      "u.last_name",
      "u.email as user_email",
      "si.name as sender_name",
      "ul.name as list_name"
    )
    .first();
}

async function fetchSteps(campaignId: string): Promise<CampaignStepDTO[]> {
  const db = getDb();
  const rows = await db("campaign_steps as cs")
    .leftJoin("templates as t", "t.id", "cs.template_id")
    .where("cs.campaign_id", campaignId)
    .orderBy("cs.step_number", "asc")
    .select("cs.*", "t.name as template_name");
  return rows.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    stepNumber: r.step_number,
    templateId: r.template_id ?? null,
    templateName: r.template_name ?? null,
    subject: r.subject ?? null,
    body: r.body ?? null,
    delayDays: r.delay_days,
    delayHours: r.delay_hours,
  }));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listCampaigns(
  orgId: string,
  query: { page: number; limit: number; channel?: string; status?: string }
): Promise<{ campaigns: CampaignDTO[]; total: number }> {
  const db = getDb();
  const offset = (query.page - 1) * query.limit;

  let baseQ = db("campaigns as c")
    .leftJoin("users as u", "u.id", "c.created_by")
    .leftJoin("sender_identities as si", "si.id", "c.sender_identity_id")
    .leftJoin("uploaded_lists as ul", "ul.id", "c.list_id")
    .where("c.organisation_id", orgId);

  if (query.channel) baseQ = baseQ.where("c.channel", query.channel);
  if (query.status) baseQ = baseQ.where("c.status", query.status);

  const [rows, countRows] = await Promise.all([
    baseQ
      .clone()
      .select("c.*", "u.first_name", "u.last_name", "u.email as user_email", "si.name as sender_name", "ul.name as list_name")
      .orderBy("c.created_at", "desc")
      .limit(query.limit)
      .offset(offset),
    baseQ.clone().count("c.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  const campaigns = rows.map((r) => rowToCampaignDTO(r, []));
  return { campaigns, total };
}

export async function getCampaign(id: string, orgId: string): Promise<CampaignDTO> {
  const [row, steps] = await Promise.all([
    fetchCampaignRow(id, orgId),
    fetchSteps(id),
  ]);
  if (!row) throw new NotFoundError("Campaign not found");
  return rowToCampaignDTO(row, steps);
}

export async function createCampaign(
  orgId: string,
  createdBy: string,
  input: CreateCampaignInput
): Promise<CampaignDTO> {
  const db = getDb();
  const campaignId = uuidv4();

  await db.transaction(async (trx) => {
    await trx("campaigns").insert({
      id: campaignId,
      organisation_id: orgId,
      created_by: createdBy,
      name: input.name,
      channel: input.channel,
      sender_identity_id: input.senderIdentityId ?? null,
      list_id: input.listId ?? null,
      status: "draft",
      scheduled_at: input.scheduledAt ? new Date(input.scheduledAt) : null,
      settings: input.settings ? JSON.stringify(input.settings) : null,
      total_contacts: 0,
      sent_count: 0,
      delivered_count: 0,
      opened_count: 0,
      clicked_count: 0,
      replied_count: 0,
      bounced_count: 0,
      failed_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const stepRows = input.steps.map((s) => ({
      id: uuidv4(),
      campaign_id: campaignId,
      step_number: s.stepNumber,
      template_id: s.templateId ?? null,
      subject: s.subject ?? null,
      body: s.body ?? null,
      delay_days: s.delayDays,
      delay_hours: s.delayHours,
      created_at: new Date(),
    }));
    await trx("campaign_steps").insert(stepRows);
  });

  return getCampaign(campaignId, orgId);
}

export async function updateCampaign(
  id: string,
  orgId: string,
  input: UpdateCampaignInput,
  user: AuthUser
): Promise<CampaignDTO> {
  const db = getDb();
  const row = await db("campaigns").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Campaign not found");
  requireSendPermission(row.channel, user);
  if (!["draft", "scheduled"].includes(row.status)) {
    throw new ConflictError("Only draft/scheduled campaigns can be edited");
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.senderIdentityId !== undefined) updates.sender_identity_id = input.senderIdentityId;
  if (input.listId !== undefined) updates.list_id = input.listId;
  if (input.scheduledAt !== undefined) updates.scheduled_at = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.settings !== undefined) updates.settings = input.settings ? JSON.stringify(input.settings) : null;

  await db("campaigns").where({ id, organisation_id: orgId }).update(updates);
  return getCampaign(id, orgId);
}

export async function deleteCampaign(id: string, orgId: string, user: AuthUser): Promise<void> {
  const db = getDb();
  const row = await db("campaigns").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Campaign not found");
  requireSendPermission(row.channel, user);
  if (row.status === "running") throw new ConflictError("Cannot delete a running campaign — pause it first");
  await db("campaigns").where({ id, organisation_id: orgId }).delete();
}

export async function launchCampaign(
  id: string,
  orgId: string,
  scheduledAt: string | null | undefined,
  user: AuthUser
): Promise<CampaignDTO> {
  const db = getDb();
  const row = await db("campaigns").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Campaign not found");
  requireSendPermission(row.channel, user);
  if (!["draft", "scheduled"].includes(row.status)) {
    throw new ConflictError(`Campaign is already ${row.status}`);
  }
  if (!row.sender_identity_id) throw new ConflictError("Assign a sender identity before launching");
  if (!row.list_id) throw new ConflictError("Assign a contact list before launching");

  const steps = await db("campaign_steps").where("campaign_id", id);
  if (steps.length === 0) throw new ConflictError("Add at least one step before launching");

  const sender = await db("sender_identities").where("id", row.sender_identity_id).first();

  if (row.channel === "email") {
    if (!sender?.from_address) {
      throw new ConflictError(
        "Sender has no From Address configured. Edit the sender in Settings → Senders and add the email address."
      );
    }
  }

  if (row.channel === "whatsapp" || row.channel === "sms") {
    if (!sender?.credentials_encrypted) {
      const label = row.channel === "whatsapp" ? "Meta access token" : "SMS API credentials";
      throw new ConflictError(
        `Sender has no credentials stored. Add the ${label} in Settings → Senders before launching.`
      );
    }
  }

  const now = new Date();
  const launchAt = scheduledAt ? new Date(scheduledAt) : now;
  const isImmediate = launchAt <= now;

  await db("campaigns").where({ id, organisation_id: orgId }).update({
    status: isImmediate ? "running" : "scheduled",
    scheduled_at: launchAt,
    started_at: isImmediate ? now : null,
    updated_at: now,
  });

  if (isImmediate) {
    const queue = getQueue(Queues.CAMPAIGN_SEND);
    await queue.add(
      "dispatch-campaign",
      { campaignId: id, orgId } satisfies CampaignSendJobData,
      { jobId: `campaign-${id}` }
    );
  }

  return getCampaign(id, orgId);
}

export async function pauseCampaign(id: string, orgId: string, user: AuthUser): Promise<CampaignDTO> {
  const db = getDb();
  const row = await db("campaigns").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Campaign not found");
  requireSendPermission(row.channel, user);
  if (row.status !== "running") throw new ConflictError("Only running campaigns can be paused");
  await db("campaigns").where({ id, organisation_id: orgId }).update({ status: "paused", updated_at: new Date() });
  return getCampaign(id, orgId);
}

export async function resumeCampaign(id: string, orgId: string, user: AuthUser): Promise<CampaignDTO> {
  const db = getDb();
  const row = await db("campaigns").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Campaign not found");
  requireSendPermission(row.channel, user);
  if (row.status !== "paused") throw new ConflictError("Only paused campaigns can be resumed");

  await db("campaigns").where({ id, organisation_id: orgId }).update({ status: "running", updated_at: new Date() });

  const queue = getQueue(Queues.CAMPAIGN_SEND);
  await queue.add(
    "dispatch-campaign",
    { campaignId: id, orgId } satisfies CampaignSendJobData,
    { jobId: `campaign-resume-${id}-${Date.now()}` }
  );

  return getCampaign(id, orgId);
}
