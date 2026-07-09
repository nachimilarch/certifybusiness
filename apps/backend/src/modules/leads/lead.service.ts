import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { NotFoundError, ForbiddenError, ConflictError } from "../../core/errors";
import type {
  CreateLeadInput,
  UpdateLeadInput,
  AddNoteInput,
  CreateTaskInput,
} from "./lead.schema";
import type { LeadSource, LeadStatus, ActivityType, UserRole } from "../../core/types";
import { fireTrigger } from "../automation/automation.service";

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface PhoneDTO {
  id: string;
  phone: string;
  isPrimary: boolean;
  isWhatsapp: boolean;
}

export interface EmailDTO {
  id: string;
  email: string;
  isPrimary: boolean;
}

export interface LeadDTO {
  id: string;
  organisationId: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  name: string;
  company: string | null;
  designation: string | null;
  source: LeadSource;
  status: LeadStatus;
  tags: string[];
  notes: string | null;
  lastActivityAt: Date | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadFullDTO extends LeadDTO {
  phones: PhoneDTO[];
  emails: EmailDTO[];
  activities: ActivityDTO[];
  tasks: TaskDTO[];
}

export interface ActivityDTO {
  id: string;
  leadId: string;
  userId: string | null;
  userName: string | null;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface TaskDTO {
  id: string;
  leadId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  title: string;
  description: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  type: string;
  priority: string;
  createdAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTags(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function rowToLeadDTO(row: any): LeadDTO {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    assignedTo: row.assigned_to ?? null,
    assignedToName: row.assigned_first_name
      ? `${row.assigned_first_name} ${row.assigned_last_name}`.trim()
      : null,
    createdBy: row.created_by ?? null,
    createdByName: row.creator_first_name
      ? `${row.creator_first_name} ${row.creator_last_name}`.trim()
      : null,
    name: row.name,
    company: row.company ?? null,
    designation: row.designation ?? null,
    source: row.source,
    status: row.status,
    tags: parseTags(row.tags),
    notes: row.notes ?? null,
    lastActivityAt: row.last_activity_at ?? null,
    primaryPhone: row.primary_phone ?? null,
    primaryEmail: row.primary_email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_SELECT = (db: ReturnType<typeof getDb>) => [
  "leads.id",
  "leads.organisation_id",
  "leads.assigned_to",
  "leads.created_by",
  "leads.name",
  "leads.company",
  "leads.designation",
  "leads.source",
  "leads.status",
  "leads.tags",
  "leads.notes",
  "leads.last_activity_at",
  "leads.created_at",
  "leads.updated_at",
  "a.first_name as assigned_first_name",
  "a.last_name as assigned_last_name",
  "c.first_name as creator_first_name",
  "c.last_name as creator_last_name",
  db.raw(
    `(SELECT phone FROM lead_phones WHERE lead_id = leads.id AND is_primary = 1 LIMIT 1) as primary_phone`
  ),
  db.raw(
    `(SELECT email FROM lead_emails WHERE lead_id = leads.id AND is_primary = 1 LIMIT 1) as primary_email`
  ),
];

function baseLeadQuery(db: ReturnType<typeof getDb>) {
  return db("leads")
    .leftJoin("users as a", "leads.assigned_to", "a.id")
    .leftJoin("users as c", "leads.created_by", "c.id")
    .select(LEAD_SELECT(db));
}

// ─── Scope resolution ─────────────────────────────────────────────────────────

export type LeadScope =
  | { type: "all" }
  | { type: "team"; memberIds: string[] }
  | { type: "assigned"; userId: string };

export function resolveLeadScope(
  role: UserRole,
  permissions: Record<string, boolean>,
  actorId: string,
  teamMemberIds: string[]
): LeadScope {
  if (role === "super_admin" || role === "admin") return { type: "all" };
  if (permissions.view_all_leads) return { type: "all" };
  if (permissions.view_team_leads && role === "manager") {
    return { type: "team", memberIds: [actorId, ...teamMemberIds] };
  }
  return { type: "assigned", userId: actorId };
}

// ─── Lead CRUD ────────────────────────────────────────────────────────────────

export async function createLead(
  orgId: string,
  input: CreateLeadInput,
  createdBy: string
): Promise<LeadFullDTO> {
  const db = getDb();

  // Check suppression list for all provided phones/emails
  const suppressed = await checkSuppression(
    orgId,
    input.phones.map((p) => p.phone),
    input.emails.map((e) => e.email)
  );
  if (suppressed) {
    throw new ConflictError(
      `This contact is on the suppression list (${suppressed.type}: ${suppressed.value})`
    );
  }

  const id = uuidv4();
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("leads").insert({
      id,
      organisation_id: orgId,
      assigned_to: input.assignedTo ?? createdBy,
      created_by: createdBy,
      name: input.name,
      company: input.company ?? null,
      designation: input.designation ?? null,
      source: input.source,
      status: input.status,
      tags: JSON.stringify(input.tags),
      notes: input.notes ?? null,
      last_activity_at: now,
      created_at: now,
      updated_at: now,
    });

    // Phones
    if (input.phones.length > 0) {
      await trx("lead_phones").insert(
        input.phones.map((p, i) => ({
          id: uuidv4(),
          lead_id: id,
          phone: p.phone,
          is_primary: p.isPrimary || i === 0,
          is_whatsapp: p.isWhatsapp,
          created_at: now,
        }))
      );
    }

    // Emails
    if (input.emails.length > 0) {
      await trx("lead_emails").insert(
        input.emails.map((e, i) => ({
          id: uuidv4(),
          lead_id: id,
          email: e.email.toLowerCase(),
          is_primary: e.isPrimary || i === 0,
          created_at: now,
        }))
      );
    }

    // Activity: lead created
    await trx("lead_activities").insert({
      id: uuidv4(),
      lead_id: id,
      organisation_id: orgId,
      user_id: createdBy,
      type: "status_change",
      subject: "Lead created",
      body: null,
      metadata: JSON.stringify({ status: input.status, source: input.source }),
      created_at: now,
    });
  });

  const lead = await getLeadById(id, orgId);
  fireTrigger("lead_created", orgId, { leadId: id, actorId: createdBy });
  return lead;
}

export async function listLeads(
  orgId: string,
  filters: {
    status?: LeadStatus;
    source?: LeadSource;
    assignedTo?: string;
    search?: string;
    tag?: string;
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    limit?: number;
  },
  scope: LeadScope
): Promise<{ leads: LeadDTO[]; total: number }> {
  const db = getDb();
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  function applyFilters(q: ReturnType<typeof db>) {
    q.where("leads.organisation_id", orgId);

    // RBAC scoping
    if (scope.type === "assigned") {
      q.where("leads.assigned_to", scope.userId);
    } else if (scope.type === "team") {
      q.whereIn("leads.assigned_to", scope.memberIds);
    }

    if (filters.status) q.where("leads.status", filters.status);
    if (filters.source) q.where("leads.source", filters.source);
    if (filters.assignedTo) q.where("leads.assigned_to", filters.assignedTo);
    if (filters.createdFrom) q.where("leads.created_at", ">=", new Date(filters.createdFrom));
    if (filters.createdTo) q.where("leads.created_at", "<=", new Date(filters.createdTo));

    if (filters.tag) {
      q.whereRaw("JSON_CONTAINS(leads.tags, ?)", [JSON.stringify(filters.tag)]);
    }

    if (filters.search) {
      const like = `%${filters.search}%`;
      q.where((w) =>
        w
          .whereLike("leads.name", like)
          .orWhereLike("leads.company", like)
          .orWhereExists(
            db("lead_phones")
              .whereRaw("lead_phones.lead_id = leads.id")
              .whereLike("lead_phones.phone", like)
          )
          .orWhereExists(
            db("lead_emails")
              .whereRaw("lead_emails.lead_id = leads.id")
              .whereLike("lead_emails.email", like)
          )
      );
    }
    return q;
  }

  const [rows, countRows] = await Promise.all([
    applyFilters(baseLeadQuery(db))
      .orderBy("leads.last_activity_at", "desc")
      .limit(limit)
      .offset(offset),
    applyFilters(db("leads")).count("leads.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { leads: rows.map(rowToLeadDTO), total };
}

export async function getLeadById(id: string, orgId: string): Promise<LeadFullDTO> {
  const db = getDb();
  const row = await baseLeadQuery(db).where("leads.id", id).first();
  if (!row || row.organisation_id !== orgId) throw new NotFoundError("Lead");

  const [phones, emails, activities, tasks] = await Promise.all([
    db("lead_phones")
      .where("lead_id", id)
      .orderBy("is_primary", "desc")
      .select("id", "phone", "is_primary", "is_whatsapp"),
    db("lead_emails")
      .where("lead_id", id)
      .orderBy("is_primary", "desc")
      .select("id", "email", "is_primary"),
    db("lead_activities")
      .leftJoin("users", "lead_activities.user_id", "users.id")
      .where("lead_activities.lead_id", id)
      .orderBy("lead_activities.created_at", "desc")
      .limit(100)
      .select(
        "lead_activities.*",
        "users.first_name as user_first_name",
        "users.last_name as user_last_name"
      ),
    db("tasks")
      .leftJoin("users as a", "tasks.assigned_to", "a.id")
      .where("tasks.lead_id", id)
      .whereNull("tasks.completed_at")
      .orderBy("tasks.due_at", "asc")
      .select(
        "tasks.*",
        "a.first_name as assigned_first_name",
        "a.last_name as assigned_last_name"
      ),
  ]);

  return {
    ...rowToLeadDTO(row),
    phones: phones.map((p: any) => ({
      id: p.id,
      phone: p.phone,
      isPrimary: Boolean(p.is_primary),
      isWhatsapp: Boolean(p.is_whatsapp),
    })),
    emails: emails.map((e: any) => ({
      id: e.id,
      email: e.email,
      isPrimary: Boolean(e.is_primary),
    })),
    activities: activities.map((a: any) => ({
      id: a.id,
      leadId: a.lead_id,
      userId: a.user_id ?? null,
      userName: a.user_first_name
        ? `${a.user_first_name} ${a.user_last_name}`.trim()
        : null,
      type: a.type,
      subject: a.subject ?? null,
      body: a.body ?? null,
      metadata: typeof a.metadata === "string" ? JSON.parse(a.metadata) : (a.metadata ?? {}),
      createdAt: a.created_at,
    })),
    tasks: tasks.map((t: any) => ({
      id: t.id,
      leadId: t.lead_id ?? null,
      assignedTo: t.assigned_to ?? null,
      assignedToName: t.assigned_first_name
        ? `${t.assigned_first_name} ${t.assigned_last_name}`.trim()
        : null,
      title: t.title,
      description: t.description ?? null,
      dueAt: t.due_at ?? null,
      completedAt: t.completed_at ?? null,
      type: t.type,
      priority: t.priority,
      createdAt: t.created_at,
    })),
  };
}

export async function updateLead(
  id: string,
  orgId: string,
  input: UpdateLeadInput,
  actorId: string
): Promise<LeadDTO> {
  const db = getDb();
  const lead = await db("leads").where({ id, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");

  const now = new Date();
  const updates: Record<string, unknown> = { updated_at: now };
  const activities: Array<{ type: ActivityType; subject: string; metadata: Record<string, unknown> }> = [];

  if (input.name !== undefined) updates.name = input.name;
  if (input.company !== undefined) updates.company = input.company;
  if (input.designation !== undefined) updates.designation = input.designation;
  if (input.source !== undefined) updates.source = input.source;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);

  if (input.status !== undefined && input.status !== lead.status) {
    updates.status = input.status;
    updates.last_activity_at = now;
    activities.push({
      type: "status_change",
      subject: `Status changed to ${input.status.replace(/_/g, " ")}`,
      metadata: { from: lead.status, to: input.status },
    });
  }

  if ("assignedTo" in input && input.assignedTo !== lead.assigned_to) {
    updates.assigned_to = input.assignedTo ?? null;
    updates.last_activity_at = now;
    activities.push({
      type: "assignment",
      subject: "Lead reassigned",
      metadata: { from: lead.assigned_to, to: input.assignedTo },
    });
  }

  await db.transaction(async (trx) => {
    await trx("leads").where("id", id).update(updates);
    if (activities.length > 0) {
      await trx("lead_activities").insert(
        activities.map((a) => ({
          id: uuidv4(),
          lead_id: id,
          organisation_id: orgId,
          user_id: actorId,
          type: a.type,
          subject: a.subject,
          body: null,
          metadata: JSON.stringify(a.metadata),
          created_at: now,
        }))
      );
    }
  });

  const full = await getLeadById(id, orgId);
  const { phones, emails, activities: _acts, tasks: _tasks, ...dto } = full;

  if (input.status !== undefined && input.status !== lead.status) {
    fireTrigger("status_changed", orgId, { leadId: id, actorId });
  }
  if (input.tags !== undefined) {
    fireTrigger("tag_added", orgId, { leadId: id, actorId });
  }

  return dto;
}

// ─── Phone & Email management ─────────────────────────────────────────────────

export async function addPhone(
  leadId: string,
  orgId: string,
  phone: string,
  isPrimary: boolean,
  isWhatsapp: boolean
): Promise<PhoneDTO> {
  const db = getDb();
  const lead = await db("leads").where({ id: leadId, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");

  if (isPrimary) {
    await db("lead_phones").where("lead_id", leadId).update({ is_primary: false });
  }

  const id = uuidv4();
  await db("lead_phones").insert({
    id,
    lead_id: leadId,
    phone,
    is_primary: isPrimary,
    is_whatsapp: isWhatsapp,
    created_at: new Date(),
  });
  return { id, phone, isPrimary, isWhatsapp };
}

export async function deletePhone(
  phoneId: string,
  leadId: string,
  orgId: string
): Promise<void> {
  const db = getDb();
  const lead = await db("leads").where({ id: leadId, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");
  await db("lead_phones").where({ id: phoneId, lead_id: leadId }).delete();
}

export async function addEmail(
  leadId: string,
  orgId: string,
  email: string,
  isPrimary: boolean
): Promise<EmailDTO> {
  const db = getDb();
  const lead = await db("leads").where({ id: leadId, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");

  if (isPrimary) {
    await db("lead_emails").where("lead_id", leadId).update({ is_primary: false });
  }

  const id = uuidv4();
  await db("lead_emails").insert({
    id,
    lead_id: leadId,
    email: email.toLowerCase(),
    is_primary: isPrimary,
    created_at: new Date(),
  });
  return { id, email, isPrimary };
}

export async function deleteEmail(
  emailId: string,
  leadId: string,
  orgId: string
): Promise<void> {
  const db = getDb();
  const lead = await db("leads").where({ id: leadId, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");
  await db("lead_emails").where({ id: emailId, lead_id: leadId }).delete();
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function addActivity(
  leadId: string,
  orgId: string,
  userId: string,
  type: ActivityType,
  data: { subject?: string; body?: string; metadata?: Record<string, unknown> }
): Promise<ActivityDTO> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx("lead_activities").insert({
      id,
      lead_id: leadId,
      organisation_id: orgId,
      user_id: userId,
      type,
      subject: data.subject ?? null,
      body: data.body ?? null,
      metadata: JSON.stringify(data.metadata ?? {}),
      created_at: now,
    });
    await trx("leads")
      .where("id", leadId)
      .update({ last_activity_at: now, updated_at: now });
  });

  const user = await db("users")
    .where("id", userId)
    .select("first_name", "last_name")
    .first();

  return {
    id,
    leadId,
    userId,
    userName: user ? `${user.first_name} ${user.last_name}`.trim() : null,
    type,
    subject: data.subject ?? null,
    body: data.body ?? null,
    metadata: data.metadata ?? {},
    createdAt: now,
  };
}

export async function addNote(
  leadId: string,
  orgId: string,
  userId: string,
  input: AddNoteInput
): Promise<{ activity: ActivityDTO; task?: TaskDTO }> {
  const db = getDb();
  const lead = await db("leads").where({ id: leadId, organisation_id: orgId }).first();
  if (!lead) throw new NotFoundError("Lead");

  const activity = await addActivity(leadId, orgId, userId, "note", {
    subject: "Note added",
    body: input.body,
  });

  let task: TaskDTO | undefined;
  if (input.followUpAt) {
    task = await createTask(leadId, orgId, userId, {
      title: "Follow up",
      description: input.body,
      dueAt: input.followUpAt,
      type: "follow_up",
      priority: "medium",
      assignedTo: userId,
    });
  }

  return { activity, task };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function createTask(
  leadId: string,
  orgId: string,
  createdBy: string,
  input: CreateTaskInput
): Promise<TaskDTO> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date();

  await db("tasks").insert({
    id,
    organisation_id: orgId,
    lead_id: leadId,
    assigned_to: input.assignedTo ?? createdBy,
    created_by: createdBy,
    title: input.title,
    description: input.description ?? null,
    due_at: input.dueAt ? new Date(input.dueAt) : null,
    type: input.type,
    priority: input.priority,
    created_at: now,
    updated_at: now,
  });

  await addActivity(leadId, orgId, createdBy, "task", {
    subject: `Task created: ${input.title}`,
    metadata: { taskId: id, dueAt: input.dueAt },
  });

  const assignee = input.assignedTo ?? createdBy;
  const user = await db("users").where("id", assignee).select("first_name", "last_name").first();

  return {
    id,
    leadId,
    assignedTo: assignee,
    assignedToName: user ? `${user.first_name} ${user.last_name}`.trim() : null,
    title: input.title,
    description: input.description ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    completedAt: null,
    type: input.type,
    priority: input.priority,
    createdAt: now,
  };
}

export async function completeTask(taskId: string, orgId: string): Promise<void> {
  const db = getDb();
  const task = await db("tasks").where({ id: taskId, organisation_id: orgId }).first();
  if (!task) throw new NotFoundError("Task");

  const now = new Date();
  await db("tasks").where("id", taskId).update({ completed_at: now, updated_at: now });

  if (task.lead_id) {
    await addActivity(task.lead_id, orgId, task.assigned_to ?? task.created_by, "task", {
      subject: `Task completed: ${task.title}`,
      metadata: { taskId },
    });
  }
}

// ─── Deduplication & suppression ─────────────────────────────────────────────

export async function findDuplicate(
  orgId: string,
  phones: string[],
  emails: string[]
): Promise<{ leadId: string; leadName: string; matchedOn: string } | null> {
  const db = getDb();

  if (phones.length > 0) {
    const match = await db("lead_phones")
      .join("leads", "lead_phones.lead_id", "leads.id")
      .whereIn("lead_phones.phone", phones)
      .where("leads.organisation_id", orgId)
      .select("leads.id as leadId", "leads.name as leadName", "lead_phones.phone")
      .first();
    if (match) return { leadId: match.leadId, leadName: match.leadName, matchedOn: `phone: ${match.phone}` };
  }

  if (emails.length > 0) {
    const match = await db("lead_emails")
      .join("leads", "lead_emails.lead_id", "leads.id")
      .whereIn("lead_emails.email", emails.map((e) => e.toLowerCase()))
      .where("leads.organisation_id", orgId)
      .select("leads.id as leadId", "leads.name as leadName", "lead_emails.email")
      .first();
    if (match) return { leadId: match.leadId, leadName: match.leadName, matchedOn: `email: ${match.email}` };
  }

  return null;
}

async function checkSuppression(orgId: string, phones: string[], emails: string[]) {
  const db = getDb();
  if (phones.length > 0) {
    const hit = await db("suppression_list")
      .where("organisation_id", orgId)
      .whereIn("type", ["phone", "whatsapp"])
      .whereIn("value", phones)
      .first();
    if (hit) return hit;
  }
  if (emails.length > 0) {
    const hit = await db("suppression_list")
      .where("organisation_id", orgId)
      .where("type", "email")
      .whereIn("value", emails.map((e) => e.toLowerCase()))
      .first();
    if (hit) return hit;
  }
  return null;
}

// ─── Team member IDs helper (used by controller for scope) ────────────────────

export async function getDirectReportIds(managerId: string, orgId: string): Promise<string[]> {
  const rows = await getDb()("users")
    .where({ manager_id: managerId, organisation_id: orgId })
    .select("id");
  return rows.map((r: any) => r.id);
}
