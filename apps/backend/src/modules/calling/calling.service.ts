import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { NotFoundError } from "../../core/errors";
import { createLead, addActivity, findDuplicate } from "../leads/lead.service";
import { fireTrigger } from "../automation/automation.service";
import type { LogCallInput } from "./calling.schema";
import type { CallOutcome } from "../../core/types";

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CallLogDTO {
  id: string;
  userId: string;
  userName: string;
  leadId: string | null;
  uploadedContactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  calledAt: Date;
  durationSeconds: number;
  outcome: CallOutcome;
  followUpAt: Date | null;
  notes: string | null;
  convertedToLead: boolean;
  createdAt: Date;
}

export interface CallQueueItemDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string | null;
  designation: string | null;
  phone: string | null;
  listId: string;
  listName: string;
  leadId: string | null;
  queueStatus: "not_called" | "follow_up_due" | "follow_up_today" | "in_progress" | "done";
  lastOutcome: CallOutcome | null;
  lastCalledAt: Date | null;
  followUpAt: Date | null;
  lastNotes: string | null;
}

export interface FollowUpDTO {
  id: string;
  contactName: string;
  contactPhone: string | null;
  leadId: string | null;
  leadName: string | null;
  followUpAt: Date;
  lastOutcome: CallOutcome;
  notes: string | null;
  isOverdue: boolean;
}

// ─── Call queue ───────────────────────────────────────────────────────────────

export async function getCallQueue(
  userId: string,
  orgId: string,
  filters: {
    listId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ contacts: CallQueueItemDTO[]; total: number }> {
  const db = getDb();
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  // Get contacts from lists uploaded by this user
  let q = db("uploaded_contacts as uc")
    .join("uploaded_lists as ul", "uc.list_id", "ul.id")
    .leftJoin(
      db("call_logs")
        .select("uploaded_contact_id")
        .max("called_at as last_called_at")
        .groupBy("uploaded_contact_id")
        .as("lc"),
      "uc.id",
      "lc.uploaded_contact_id"
    )
    .leftJoin(
      "call_logs as cl",
      function () {
        this.on("uc.id", "cl.uploaded_contact_id").on(
          db.raw("cl.called_at = lc.last_called_at")
        );
      }
    )
    .leftJoin("leads as l", "uc.lead_id", "l.id")
    .where("ul.uploaded_by", userId)
    .where("ul.organisation_id", orgId)
    .where("ul.channel", "calling")
    .where("uc.is_valid", true)
    .where("uc.is_suppressed", false)
    .select(
      "uc.id",
      "uc.first_name",
      "uc.last_name",
      "uc.company",
      "uc.designation",
      "uc.phone",
      "uc.lead_id",
      "ul.id as list_id",
      "ul.name as list_name",
      "cl.outcome as last_outcome",
      "cl.called_at as last_called_at",
      "cl.follow_up_at",
      "cl.notes as last_notes"
    );

  if (filters.listId) q = q.where("ul.id", filters.listId);

  // Status filter
  if (filters.status && filters.status !== "all") {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (filters.status === "not_called") {
      q = q.whereNull("cl.id");
    } else if (filters.status === "follow_up_due") {
      q = q.where("cl.follow_up_at", "<=", today).whereNotNull("cl.follow_up_at");
    } else if (filters.status === "done") {
      q = q.whereIn("cl.outcome", ["not_interested", "do_not_call", "interested"]);
    } else if (filters.status === "in_progress") {
      q = q.whereIn("cl.outcome", ["connected", "no_answer", "busy", "wrong_number", "callback_requested"]);
    }
  }

  const countQ = db("uploaded_contacts as uc")
    .join("uploaded_lists as ul", "uc.list_id", "ul.id")
    .where("ul.uploaded_by", userId)
    .where("ul.organisation_id", orgId)
    .where("ul.channel", "calling")
    .where("uc.is_valid", true)
    .where("uc.is_suppressed", false);
  if (filters.listId) countQ.where("ul.id", filters.listId);

  const [rows, countRows] = await Promise.all([
    q
      .orderByRaw(`
        CASE
          WHEN cl.follow_up_at IS NOT NULL AND cl.follow_up_at <= NOW() THEN 0
          WHEN cl.follow_up_at IS NOT NULL AND DATE(cl.follow_up_at) = CURDATE() THEN 1
          WHEN cl.id IS NULL THEN 2
          WHEN cl.outcome IN ('callback_requested', 'connected') THEN 3
          ELSE 4
        END ASC,
        cl.follow_up_at ASC,
        uc.created_at ASC
      `)
      .limit(limit)
      .offset(offset),
    countQ.count("uc.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  const now = new Date();

  const contacts: CallQueueItemDTO[] = rows.map((r: any) => {
    let queueStatus: CallQueueItemDTO["queueStatus"] = "not_called";
    if (r.last_outcome) {
      const isOverdue =
        r.follow_up_at && new Date(r.follow_up_at) < now;
      const isDueToday =
        r.follow_up_at &&
        new Date(r.follow_up_at).toDateString() === now.toDateString();
      if (isOverdue) queueStatus = "follow_up_due";
      else if (isDueToday) queueStatus = "follow_up_today";
      else if (["not_interested", "do_not_call", "interested"].includes(r.last_outcome))
        queueStatus = "done";
      else queueStatus = "in_progress";
    }

    return {
      id: r.id,
      firstName: r.first_name ?? "",
      lastName: r.last_name ?? "",
      fullName: [r.first_name, r.last_name].filter(Boolean).join(" "),
      company: r.company ?? null,
      designation: r.designation ?? null,
      phone: r.phone ?? null,
      listId: r.list_id,
      listName: r.list_name,
      leadId: r.lead_id ?? null,
      queueStatus,
      lastOutcome: r.last_outcome ?? null,
      lastCalledAt: r.last_called_at ?? null,
      followUpAt: r.follow_up_at ?? null,
      lastNotes: r.last_notes ?? null,
    };
  });

  return { contacts, total };
}

// ─── Log a call ───────────────────────────────────────────────────────────────

export interface LogCallResult {
  callLog: CallLogDTO;
  leadId: string | null;
  leadCreated: boolean;
}

export async function logCall(
  orgId: string,
  userId: string,
  input: LogCallInput
): Promise<LogCallResult> {
  const db = getDb();
  const now = new Date();
  const calledAt = input.calledAt ? new Date(input.calledAt) : now;

  // If an uploaded_contact_id is given, load its data
  let contact: any = null;
  if (input.uploadedContactId) {
    contact = await db("uploaded_contacts as uc")
      .join("uploaded_lists as ul", "uc.list_id", "ul.id")
      .where("uc.id", input.uploadedContactId)
      .where("uc.organisation_id", orgId)
      .select("uc.*", "ul.name as list_name")
      .first();
  }

  // Add to suppression list for DNC outcome
  if (input.outcome === "do_not_call" && (contact?.phone || input.calledPhone)) {
    await db("suppression_list")
      .insert({
        id: uuidv4(),
        organisation_id: orgId,
        type: "phone",
        value: contact?.phone || input.calledPhone,
        reason: "do_not_contact",
        source: "call_log",
        created_at: now,
      })
      .onConflict(["organisation_id", "type", "value"])
      .ignore();

    if (contact) {
      await db("uploaded_contacts")
        .where("id", input.uploadedContactId!)
        .update({ is_suppressed: true });
    }
  }

  let leadId: string | null = null;
  let leadCreated = false;

  // Convert to lead when outcome indicates interest
  if (
    input.convertToLead &&
    ["interested", "callback_requested", "connected"].includes(input.outcome)
  ) {
    const phone = contact?.phone || input.calledPhone;
    const dupe = phone
      ? await findDuplicate(orgId, [phone], [])
      : null;

    if (dupe) {
      leadId = dupe.leadId;
      // Add call activity to existing lead
      await addActivity(leadId, orgId, userId, "call", {
        subject: `Call logged: ${input.outcome.replace(/_/g, " ")}`,
        body: input.notes ?? undefined,
        metadata: { outcome: input.outcome, duration: input.durationSeconds },
      });

      // Update status if appropriate
      if (input.outcome === "interested") {
        await db("leads")
          .where({ id: leadId, organisation_id: orgId })
          .where("status", "new")
          .update({ status: "interested", updated_at: now });
      } else if (input.outcome === "callback_requested") {
        await db("leads")
          .where({ id: leadId, organisation_id: orgId })
          .whereIn("status", ["new", "contacted"])
          .update({ status: "follow_up", updated_at: now });
      }
    } else if (contact) {
      // Create new lead from contact data
      const newLead = await createLead(
        orgId,
        {
          name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown",
          company: contact.company ?? undefined,
          designation: contact.designation ?? undefined,
          source: "cold_call",
          status:
            input.outcome === "interested"
              ? "interested"
              : input.outcome === "callback_requested"
              ? "follow_up"
              : "contacted",
          assignedTo: userId,
          phones: contact.phone ? [{ phone: contact.phone, isPrimary: true, isWhatsapp: false }] : [],
          emails: contact.email ? [{ email: contact.email, isPrimary: true }] : [],
          tags: [],
          notes: input.notes ?? undefined,
        },
        userId
      );
      leadId = newLead.id;
      leadCreated = true;

      // Link uploaded_contact to lead
      await db("uploaded_contacts")
        .where("id", input.uploadedContactId!)
        .update({ lead_id: leadId });
    }

    // Create follow-up task if follow-up date given
    if (leadId && input.followUpAt) {
      const { createTask } = await import("../leads/lead.service");
      await createTask(leadId, orgId, userId, {
        title: `Follow up call with ${contact?.first_name ?? "contact"}`,
        dueAt: input.followUpAt,
        type: "call",
        priority: "medium",
        assignedTo: userId,
      });
    }
  }

  // Insert call_log
  const callLogId = uuidv4();
  await db("call_logs").insert({
    id: callLogId,
    organisation_id: orgId,
    user_id: userId,
    lead_id: leadId,
    uploaded_contact_id: input.uploadedContactId ?? null,
    called_at: calledAt,
    duration_seconds: input.durationSeconds,
    outcome: input.outcome,
    follow_up_at: input.followUpAt ? new Date(input.followUpAt) : null,
    notes: input.notes ?? null,
    converted_to_lead: Boolean(leadId) && input.convertToLead,
    created_at: now,
  });

  // If there's a lead but we didn't just create it, also log the call activity
  if (leadId && !leadCreated) {
    // already done above
  }

  const user = await db("users")
    .where("id", userId)
    .select("first_name", "last_name")
    .first();

  const result: LogCallResult = {
    callLog: {
      id: callLogId,
      userId,
      userName: user ? `${user.first_name} ${user.last_name}`.trim() : "",
      leadId,
      uploadedContactId: input.uploadedContactId ?? null,
      contactName: contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
        : null,
      contactPhone: contact?.phone ?? input.calledPhone ?? null,
      calledAt,
      durationSeconds: input.durationSeconds,
      outcome: input.outcome,
      followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      notes: input.notes ?? null,
      convertedToLead: leadCreated || (!!leadId && input.convertToLead),
      createdAt: now,
    },
    leadId,
    leadCreated,
  };

  fireTrigger("call_logged", orgId, { leadId: leadId ?? undefined, actorId: userId });

  return result;
}

// ─── Call log list ────────────────────────────────────────────────────────────

export async function listCallLogs(
  orgId: string,
  filters: {
    userId?: string;
    outcome?: CallOutcome;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ logs: CallLogDTO[]; total: number }> {
  const db = getDb();
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  function applyFilters(q: ReturnType<typeof db>) {
    q.where("call_logs.organisation_id", orgId);
    if (filters.userId) q.where("call_logs.user_id", filters.userId);
    if (filters.outcome) q.where("call_logs.outcome", filters.outcome);
    if (filters.dateFrom)
      q.where("call_logs.called_at", ">=", new Date(filters.dateFrom));
    if (filters.dateTo) q.where("call_logs.called_at", "<=", new Date(filters.dateTo));
    return q;
  }

  const [rows, countRows] = await Promise.all([
    applyFilters(
      db("call_logs")
        .join("users", "call_logs.user_id", "users.id")
        .leftJoin("uploaded_contacts as uc", "call_logs.uploaded_contact_id", "uc.id")
    )
      .select(
        "call_logs.*",
        "users.first_name as u_first",
        "users.last_name as u_last",
        "uc.first_name as c_first",
        "uc.last_name as c_last",
        "uc.phone as c_phone"
      )
      .orderBy("call_logs.called_at", "desc")
      .limit(limit)
      .offset(offset),
    applyFilters(db("call_logs")).count("id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);

  return {
    logs: rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userName: `${r.u_first} ${r.u_last}`.trim(),
      leadId: r.lead_id ?? null,
      uploadedContactId: r.uploaded_contact_id ?? null,
      contactName: r.c_first
        ? [r.c_first, r.c_last].filter(Boolean).join(" ")
        : null,
      contactPhone: r.c_phone ?? null,
      calledAt: r.called_at,
      durationSeconds: r.duration_seconds,
      outcome: r.outcome,
      followUpAt: r.follow_up_at ?? null,
      notes: r.notes ?? null,
      convertedToLead: Boolean(r.converted_to_lead),
      createdAt: r.created_at,
    })),
    total,
  };
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export async function getFollowUps(
  orgId: string,
  userId: string,
  page = 1,
  limit = 20
): Promise<{ followUps: FollowUpDTO[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;
  const now = new Date();

  const q = db("call_logs as cl")
    .leftJoin("uploaded_contacts as uc", "cl.uploaded_contact_id", "uc.id")
    .leftJoin("leads as l", "cl.lead_id", "l.id")
    .where("cl.organisation_id", orgId)
    .where("cl.user_id", userId)
    .whereNotNull("cl.follow_up_at")
    .whereNull("cl.lead_id") // only un-converted follow-ups (lead follow-ups are in tasks)
    .where("cl.follow_up_at", ">=", now);

  const [rows, countRows] = await Promise.all([
    q
      .clone()
      .select(
        "cl.id",
        "cl.follow_up_at",
        "cl.outcome as last_outcome",
        "cl.notes",
        "cl.lead_id",
        "uc.first_name as c_first",
        "uc.last_name as c_last",
        "uc.phone as c_phone",
        "l.name as lead_name"
      )
      .orderBy("cl.follow_up_at", "asc")
      .limit(limit)
      .offset(offset),
    q.clone().count("cl.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);

  return {
    followUps: rows.map((r: any) => ({
      id: r.id,
      contactName: [r.c_first, r.c_last].filter(Boolean).join(" ") || "Unknown",
      contactPhone: r.c_phone ?? null,
      leadId: r.lead_id ?? null,
      leadName: r.lead_name ?? null,
      followUpAt: r.follow_up_at,
      lastOutcome: r.last_outcome,
      notes: r.notes ?? null,
      isOverdue: new Date(r.follow_up_at) < now,
    })),
    total,
  };
}

// ─── My calling stats ─────────────────────────────────────────────────────────

export async function getMyStats(userId: string, orgId: string) {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [today, week, byOutcome, overdue] = await Promise.all([
    db("call_logs")
      .where({ user_id: userId, organisation_id: orgId })
      .where("called_at", ">=", todayStart)
      .count("id as total")
      .first(),
    db("call_logs")
      .where({ user_id: userId, organisation_id: orgId })
      .where("called_at", ">=", weekStart)
      .count("id as total")
      .first(),
    db("call_logs")
      .where({ user_id: userId, organisation_id: orgId })
      .where("called_at", ">=", weekStart)
      .select("outcome")
      .count("id as count")
      .groupBy("outcome"),
    db("call_logs")
      .where({ user_id: userId, organisation_id: orgId })
      .whereNotNull("follow_up_at")
      .where("follow_up_at", "<", new Date())
      .whereNull("lead_id")
      .count("id as total")
      .first(),
  ]);

  const outcomeMap: Record<string, number> = {};
  for (const row of byOutcome as any[]) {
    outcomeMap[row.outcome] = Number(row.count);
  }

  return {
    callsToday: Number((today as any)?.total ?? 0),
    callsThisWeek: Number((week as any)?.total ?? 0),
    outcomeBreakdown: outcomeMap,
    overdueFollowUps: Number((overdue as any)?.total ?? 0),
  };
}
