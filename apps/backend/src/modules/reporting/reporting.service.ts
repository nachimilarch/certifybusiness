import { getDb } from "../../core/database";
import type { UserRole, UserPermissions } from "../../core/types";

export interface DashboardStats {
  leads: {
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    newToday: number;
    newThisWeek: number;
  };
  calls: {
    total: number;
    today: number;
    thisWeek: number;
    byOutcome: Record<string, number>;
    conversionRate: number;
  };
  followUps: {
    overdue: number;
    dueToday: number;
  };
  tasks: {
    overdue: number;
    dueToday: number;
  };
}

export async function getDashboardStats(
  orgId: string,
  actorId: string,
  role: UserRole,
  permissions: UserPermissions
): Promise<DashboardStats> {
  const db = getDb();
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // Resolve lead scope
  const isAdmin = role === "super_admin" || role === "admin";
  const canViewAll = isAdmin || permissions.view_all_leads;
  const canViewTeam = !canViewAll && (role === "manager" && permissions.view_team_leads);

  // Get team member IDs for managers
  let memberIds: string[] = [actorId];
  if (canViewTeam) {
    const reports = await db("users")
      .where({ manager_id: actorId, organisation_id: orgId })
      .select("id");
    memberIds = [actorId, ...reports.map((r: any) => r.id)];
  }

  function leadScope(q: ReturnType<typeof db>) {
    q.where("leads.organisation_id", orgId);
    if (!canViewAll) {
      if (canViewTeam) q.whereIn("leads.assigned_to", memberIds);
      else q.where("leads.assigned_to", actorId);
    }
    return q;
  }

  function callScope(q: ReturnType<typeof db>) {
    q.where("call_logs.organisation_id", orgId);
    if (!canViewAll) {
      if (canViewTeam) q.whereIn("call_logs.user_id", memberIds);
      else q.where("call_logs.user_id", actorId);
    }
    return q;
  }

  const [
    leadTotal,
    leadByStatus,
    leadBySource,
    leadToday,
    leadThisWeek,
    callTotal,
    callToday,
    callThisWeek,
    callByOutcome,
    callConverted,
    overdueFollowUps,
    dueTodayFollowUps,
    overdueTasks,
    dueTodayTasks,
  ] = await Promise.all([
    leadScope(db("leads")).count("id as total").first(),
    leadScope(db("leads")).select("status").count("id as count").groupBy("status"),
    leadScope(db("leads")).select("source").count("id as count").groupBy("source"),
    leadScope(db("leads")).where("leads.created_at", ">=", todayStart).count("id as total").first(),
    leadScope(db("leads")).where("leads.created_at", ">=", weekStart).count("id as total").first(),
    callScope(db("call_logs")).count("id as total").first(),
    callScope(db("call_logs")).where("call_logs.called_at", ">=", todayStart).count("id as total").first(),
    callScope(db("call_logs")).where("call_logs.called_at", ">=", weekStart).count("id as total").first(),
    callScope(db("call_logs")).where("call_logs.called_at", ">=", weekStart).select("outcome").count("id as count").groupBy("outcome"),
    callScope(db("call_logs")).where("call_logs.called_at", ">=", weekStart).where("converted_to_lead", true).count("id as total").first(),
    // Overdue call follow-ups
    db("call_logs")
      .where("organisation_id", orgId)
      .where("user_id", actorId)
      .whereNotNull("follow_up_at")
      .where("follow_up_at", "<", todayStart)
      .count("id as total")
      .first(),
    db("call_logs")
      .where("organisation_id", orgId)
      .where("user_id", actorId)
      .whereNotNull("follow_up_at")
      .whereBetween("follow_up_at", [todayStart, todayEnd])
      .count("id as total")
      .first(),
    db("tasks")
      .where("organisation_id", orgId)
      .where("assigned_to", actorId)
      .whereNull("completed_at")
      .where("due_at", "<", now)
      .count("id as total")
      .first(),
    db("tasks")
      .where("organisation_id", orgId)
      .where("assigned_to", actorId)
      .whereNull("completed_at")
      .whereBetween("due_at", [todayStart, todayEnd])
      .count("id as total")
      .first(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of leadByStatus as any[]) byStatus[r.status] = Number(r.count);

  const bySource: Record<string, number> = {};
  for (const r of leadBySource as any[]) bySource[r.source] = Number(r.count);

  const byOutcome: Record<string, number> = {};
  for (const r of callByOutcome as any[]) byOutcome[r.outcome] = Number(r.count);

  const totalCallsWeek = Number((callThisWeek as any)?.total ?? 0);
  const convertedCallsWeek = Number((callConverted as any)?.total ?? 0);

  return {
    leads: {
      total: Number((leadTotal as any)?.total ?? 0),
      byStatus,
      bySource,
      newToday: Number((leadToday as any)?.total ?? 0),
      newThisWeek: Number((leadThisWeek as any)?.total ?? 0),
    },
    calls: {
      total: Number((callTotal as any)?.total ?? 0),
      today: Number((callToday as any)?.total ?? 0),
      thisWeek: totalCallsWeek,
      byOutcome,
      conversionRate:
        totalCallsWeek > 0
          ? Math.round((convertedCallsWeek / totalCallsWeek) * 100)
          : 0,
    },
    followUps: {
      overdue: Number((overdueFollowUps as any)?.total ?? 0),
      dueToday: Number((dueTodayFollowUps as any)?.total ?? 0),
    },
    tasks: {
      overdue: Number((overdueTasks as any)?.total ?? 0),
      dueToday: Number((dueTodayTasks as any)?.total ?? 0),
    },
  };
}

export async function getTeamPerformance(orgId: string, managerId: string) {
  const db = getDb();
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);

  const members = await db("users")
    .where({ manager_id: managerId, organisation_id: orgId })
    .select("id", "first_name", "last_name");

  const memberIds = members.map((m: any) => m.id);
  if (memberIds.length === 0) return [];

  const [callCounts, leadCounts] = await Promise.all([
    db("call_logs")
      .whereIn("user_id", memberIds)
      .where("organisation_id", orgId)
      .where("called_at", ">=", weekStart)
      .select("user_id")
      .count("id as calls")
      .groupBy("user_id"),
    db("leads")
      .whereIn("assigned_to", memberIds)
      .where("organisation_id", orgId)
      .select("assigned_to")
      .count("id as leads")
      .groupBy("assigned_to"),
  ]);

  const callMap: Record<string, number> = {};
  for (const r of callCounts as any[]) callMap[r.user_id] = Number(r.calls);
  const leadMap: Record<string, number> = {};
  for (const r of leadCounts as any[]) leadMap[r.assigned_to] = Number(r.leads);

  return members.map((m: any) => ({
    userId: m.id,
    name: `${m.first_name} ${m.last_name}`.trim(),
    callsThisWeek: callMap[m.id] ?? 0,
    leadsAssigned: leadMap[m.id] ?? 0,
  }));
}

export interface CampaignSummaryItem {
  id: string;
  name: string;
  channel: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  repliedCount: number;
  bouncedCount: number;
  openedCount: number;
  createdAt: Date;
}

export interface CampaignSummaryStats {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalReplied: number;
  campaigns: CampaignSummaryItem[];
}

interface DateRange { from?: Date; to?: Date }

function applyDateRange(q: ReturnType<typeof import("../../core/database").getDb>, col: string, range?: DateRange) {
  if (range?.from) q.where(col, ">=", range.from);
  if (range?.to) q.where(col, "<=", range.to);
  return q;
}

export async function getLeadsByChannel(
  orgId: string,
  range?: DateRange
): Promise<{ source: string; count: number }[]> {
  const db = getDb();
  let q = db("leads").where("organisation_id", orgId).select("source").count("id as count").groupBy("source");
  if (range?.from) q = q.where("created_at", ">=", range.from);
  if (range?.to) q = q.where("created_at", "<=", range.to);
  const rows = await q;
  return rows.map((r: any) => ({ source: r.source, count: Number(r.count) }));
}

export async function getLeadsByEmployee(
  orgId: string,
  range?: DateRange
): Promise<{ userId: string; name: string; count: number }[]> {
  const db = getDb();
  let q = db("leads as l")
    .leftJoin("users as u", "u.id", "l.assigned_to")
    .where("l.organisation_id", orgId)
    .whereNotNull("l.assigned_to")
    .select(
      "l.assigned_to as userId",
      db.raw("CONCAT(u.first_name, ' ', u.last_name) as name")
    )
    .count("l.id as count")
    .groupBy("l.assigned_to", "u.first_name", "u.last_name")
    .orderBy("count", "desc")
    .limit(20);
  if (range?.from) q = q.where("l.created_at", ">=", range.from);
  if (range?.to) q = q.where("l.created_at", "<=", range.to);
  const rows = await q;
  return rows.map((r: any) => ({ userId: r.userId, name: r.name?.trim() || "Unknown", count: Number(r.count) }));
}

const FUNNEL_STATUSES = ["new", "contacted", "interested", "follow_up", "converted", "dead", "do_not_contact"];

export async function getConversionFunnel(
  orgId: string,
  range?: DateRange
): Promise<{ status: string; count: number }[]> {
  const db = getDb();
  let q = db("leads").where("organisation_id", orgId).select("status").count("id as count").groupBy("status");
  if (range?.from) q = q.where("created_at", ">=", range.from);
  if (range?.to) q = q.where("created_at", "<=", range.to);
  const rows = await q;
  const map: Record<string, number> = {};
  for (const r of rows as any[]) map[r.status] = Number(r.count);
  return FUNNEL_STATUSES.map((s) => ({ status: s, count: map[s] ?? 0 }));
}

export async function getCallActivity(
  orgId: string,
  range?: DateRange
): Promise<{ userId: string; name: string; total: number; byOutcome: Record<string, number> }[]> {
  const db = getDb();
  let q = db("call_logs as cl")
    .leftJoin("users as u", "u.id", "cl.user_id")
    .where("cl.organisation_id", orgId)
    .select(
      "cl.user_id",
      db.raw("CONCAT(u.first_name, ' ', u.last_name) as name"),
      "cl.outcome"
    )
    .count("cl.id as count")
    .groupBy("cl.user_id", "u.first_name", "u.last_name", "cl.outcome");
  if (range?.from) q = q.where("cl.called_at", ">=", range.from);
  if (range?.to) q = q.where("cl.called_at", "<=", range.to);
  const rows = await q;

  const byUser: Record<string, { userId: string; name: string; total: number; byOutcome: Record<string, number> }> = {};
  for (const r of rows as any[]) {
    if (!byUser[r.user_id]) {
      byUser[r.user_id] = { userId: r.user_id, name: r.name?.trim() || "Unknown", total: 0, byOutcome: {} };
    }
    const n = Number(r.count);
    byUser[r.user_id].total += n;
    byUser[r.user_id].byOutcome[r.outcome] = n;
  }
  return Object.values(byUser).sort((a, b) => b.total - a.total);
}

export async function getCampaignSummary(orgId: string): Promise<CampaignSummaryStats> {
  const db = getDb();

  const [rows, aggRow] = await Promise.all([
    db("campaigns")
      .where("organisation_id", orgId)
      .orderBy("created_at", "desc")
      .limit(50)
      .select(
        "id", "name", "channel", "status",
        "total_contacts", "sent_count", "delivered_count",
        "replied_count", "bounced_count", "opened_count", "created_at"
      ),
    db("campaigns")
      .where("organisation_id", orgId)
      .select(
        db.raw("COUNT(id) as total_campaigns"),
        db.raw("SUM(sent_count) as total_sent"),
        db.raw("SUM(delivered_count) as total_delivered"),
        db.raw("SUM(replied_count) as total_replied")
      )
      .first(),
  ]);

  return {
    totalCampaigns: Number((aggRow as any)?.total_campaigns ?? 0),
    totalSent: Number((aggRow as any)?.total_sent ?? 0),
    totalDelivered: Number((aggRow as any)?.total_delivered ?? 0),
    totalReplied: Number((aggRow as any)?.total_replied ?? 0),
    campaigns: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      status: r.status,
      totalContacts: r.total_contacts,
      sentCount: r.sent_count,
      deliveredCount: r.delivered_count,
      repliedCount: r.replied_count,
      bouncedCount: r.bounced_count,
      openedCount: r.opened_count,
      createdAt: r.created_at,
    })),
  };
}
