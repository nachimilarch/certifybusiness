import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import type { NotificationType } from "../../core/types";

export interface NotificationDTO {
  id: string;
  organisationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationJobData {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

function toDTO(row: any): NotificationDTO {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    isRead: Boolean(row.is_read),
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

export async function createNotification(data: NotificationJobData): Promise<void> {
  const db = getDb();
  await db("notifications").insert({
    id: uuidv4(),
    organisation_id: data.orgId,
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    metadata: JSON.stringify(data.metadata ?? {}),
    is_read: 0,
    read_at: null,
    created_at: new Date(),
  });
}

export async function listNotifications(
  orgId: string,
  userId: string,
  page = 1,
  limit = 20
): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;

  const [rows, countRow, unreadRow] = await Promise.all([
    db("notifications")
      .where({ organisation_id: orgId, user_id: userId })
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset),
    db("notifications").where({ organisation_id: orgId, user_id: userId }).count("id as total"),
    db("notifications")
      .where({ organisation_id: orgId, user_id: userId, is_read: 0 })
      .count("id as total"),
  ]);

  return {
    notifications: rows.map(toDTO),
    total: Number((countRow[0] as any).total),
    unreadCount: Number((unreadRow[0] as any).total),
  };
}

export async function getUnreadCount(orgId: string, userId: string): Promise<number> {
  const db = getDb();
  const row = await db("notifications")
    .where({ organisation_id: orgId, user_id: userId, is_read: 0 })
    .count("id as total")
    .first();
  return Number((row as any)?.total ?? 0);
}

export async function markRead(orgId: string, userId: string, id: string): Promise<void> {
  const db = getDb();
  await db("notifications")
    .where({ id, organisation_id: orgId, user_id: userId })
    .update({ is_read: 1, read_at: new Date() });
}

export async function markAllRead(orgId: string, userId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db("notifications")
    .where({ organisation_id: orgId, user_id: userId, is_read: 0 })
    .update({ is_read: 1, read_at: now });
}
