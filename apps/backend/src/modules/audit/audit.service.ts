import { getDb } from "../../core/database";

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  oldValue: unknown | null;
  newValue: unknown | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ListAuditLogsQuery {
  page: number;
  limit: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

function parseJsonColumn(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rowToDTO(row: Record<string, unknown>): AuditLogDTO {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    userName:
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || null,
    userEmail: (row.user_email as string) ?? null,
    action: row.action as string,
    resourceType: (row.resource_type as string) ?? null,
    resourceId: (row.resource_id as string) ?? null,
    oldValue: parseJsonColumn(row.old_value),
    newValue: parseJsonColumn(row.new_value),
    ipAddress: (row.ip_address as string) ?? null,
    createdAt: new Date(row.created_at as Date).toISOString(),
  };
}

export async function listAuditLogs(
  orgId: string,
  query: ListAuditLogsQuery
): Promise<{ logs: AuditLogDTO[]; total: number }> {
  const db = getDb();
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  let baseQ = db("audit_logs as al")
    .leftJoin("users as u", "u.id", "al.user_id")
    .where("al.organisation_id", orgId);

  if (query.userId) baseQ = baseQ.where("al.user_id", query.userId);
  if (query.action) baseQ = baseQ.where("al.action", query.action);
  if (query.resourceType) baseQ = baseQ.where("al.resource_type", query.resourceType);
  if (query.from) baseQ = baseQ.where("al.created_at", ">=", new Date(query.from));
  if (query.to) baseQ = baseQ.where("al.created_at", "<=", new Date(query.to));

  const [rows, countRows] = await Promise.all([
    baseQ
      .clone()
      .select(
        "al.*",
        "u.first_name",
        "u.last_name",
        "u.email as user_email"
      )
      .orderBy("al.created_at", "desc")
      .limit(limit)
      .offset(offset),
    baseQ.clone().count("al.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { logs: rows.map(rowToDTO), total };
}

/** Distinct action names seen for this org, for the filter dropdown. */
export async function listDistinctActions(orgId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db("audit_logs")
    .where("organisation_id", orgId)
    .distinct("action")
    .orderBy("action", "asc");
  return rows.map((r) => r.action as string);
}
