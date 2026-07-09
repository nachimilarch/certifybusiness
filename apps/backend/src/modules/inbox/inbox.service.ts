import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import { getDb } from "../../core/database";
import { decrypt } from "../../core/encryption";
import { config } from "../../core/config";
import { logger } from "../../core/logger";
import { NotFoundError, ForbiddenError, ConflictError } from "../../core/errors";
import { sendSms } from "../../core/senders/sms.sender";
import { createNotification } from "../notifications/notification.service";
import { broadcastToUser, broadcastToOrg } from "../../core/sse";
import type { ListConversationsInput, ReplyInput, AssignInput } from "./inbox.schema";
import type { UserRole, LeadSource } from "../../core/types";

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface ConversationMessageDTO {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  channel: "email" | "whatsapp" | "sms";
  senderAddress: string | null;
  recipientAddress: string | null;
  senderPhone: string | null;
  recipientPhone: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  sentByUserId: string | null;
  sentByName: string | null;
  providerMessageId: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export interface AssignmentHistoryDTO {
  id: string;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string;
  toUserName: string | null;
  changedByUserId: string;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  organisationId: string;
  channel: "email" | "whatsapp" | "sms";
  contactEmail: string | null;
  contactPhone: string | null;
  contactName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadStatus: string | null;
  campaignId: string | null;
  campaignName: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  status: "open" | "awaiting_employee" | "awaiting_customer" | "closed";
  source: "cold_email_reply" | "whatsapp_reply" | "sms_reply" | "manual" | "inbound_email";
  subject: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  messageCount: number;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetailDTO extends ConversationDTO {
  messages: ConversationMessageDTO[];
  assignments: AssignmentHistoryDTO[];
}

export interface InboxStatsDTO {
  total: number;
  awaitingEmployee: number;
  awaitingCustomer: number;
  open: number;
  unreadTotal: number;
  byChannel: { channel: string; count: number }[];
}

// ─── Row mappers ───────────────────────────────────────────────────────────────

function rowToConversationDTO(row: Record<string, unknown>): ConversationDTO {
  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    channel: row.channel as ConversationDTO["channel"],
    contactEmail: (row.contact_email as string) ?? null,
    contactPhone: (row.contact_phone as string) ?? null,
    contactName: (row.contact_name as string) ?? null,
    leadId: (row.lead_id as string) ?? null,
    leadName: (row.lead_name as string) ?? null,
    leadStatus: (row.lead_status as string) ?? null,
    campaignId: (row.campaign_id as string) ?? null,
    campaignName: (row.campaign_name as string) ?? null,
    ownerUserId: (row.owner_user_id as string) ?? null,
    ownerName: row.owner_first_name
      ? `${row.owner_first_name} ${row.owner_last_name ?? ""}`.trim()
      : null,
    status: row.status as ConversationDTO["status"],
    source: row.source as ConversationDTO["source"],
    subject: (row.subject as string) ?? null,
    lastMessageAt: row.last_message_at
      ? new Date(row.last_message_at as Date).toISOString()
      : null,
    lastInboundAt: row.last_inbound_at
      ? new Date(row.last_inbound_at as Date).toISOString()
      : null,
    messageCount: Number(row.message_count),
    unreadCount: Number(row.unread_count),
    createdAt: new Date(row.created_at as Date).toISOString(),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
  };
}

function rowToMessageDTO(row: Record<string, unknown>): ConversationMessageDTO {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    direction: row.direction as "inbound" | "outbound",
    channel: row.channel as "email" | "whatsapp" | "sms",
    senderAddress: (row.sender_address as string) ?? null,
    recipientAddress: (row.recipient_address as string) ?? null,
    senderPhone: (row.sender_phone as string) ?? null,
    recipientPhone: (row.recipient_phone as string) ?? null,
    subject: (row.subject as string) ?? null,
    bodyText: (row.body_text as string) ?? null,
    bodyHtml: (row.body_html as string) ?? null,
    sentByUserId: (row.sent_by_user_id as string) ?? null,
    sentByName: row.sent_by_first_name
      ? `${row.sent_by_first_name} ${row.sent_by_last_name ?? ""}`.trim()
      : null,
    providerMessageId: (row.provider_message_id as string) ?? null,
    receivedAt: row.received_at
      ? new Date(row.received_at as Date).toISOString()
      : null,
    createdAt: new Date(row.created_at as Date).toISOString(),
  };
}

// ─── Base query ────────────────────────────────────────────────────────────────

function conversationBaseQuery(db: ReturnType<typeof getDb>) {
  return db("conversations as cv")
    .leftJoin("leads as l", "l.id", "cv.lead_id")
    .leftJoin("campaigns as c", "c.id", "cv.campaign_id")
    .leftJoin("users as ou", "ou.id", "cv.owner_user_id")
    .select(
      "cv.*",
      "l.name as lead_name",
      "l.status as lead_status",
      "c.name as campaign_name",
      "ou.first_name as owner_first_name",
      "ou.last_name as owner_last_name"
    );
}

// ─── Access guard ──────────────────────────────────────────────────────────────

function canAccessConversation(
  row: Record<string, unknown>,
  userId: string,
  role: UserRole
): boolean {
  if (role === "super_admin" || role === "admin") return true;
  return row.owner_user_id === userId;
}

// ─── List ──────────────────────────────────────────────────────────────────────

export async function listConversations(
  orgId: string,
  userId: string,
  role: UserRole,
  input: ListConversationsInput
): Promise<{ conversations: ConversationDTO[]; total: number }> {
  const db = getDb();
  const offset = (input.page - 1) * input.limit;

  let q = conversationBaseQuery(db).where("cv.organisation_id", orgId);

  // RBAC: employees see only their assigned conversations
  if (role !== "super_admin" && role !== "admin") {
    q = q.where("cv.owner_user_id", userId);
  }

  if (input.channel) q = q.where("cv.channel", input.channel);
  if (input.status) q = q.where("cv.status", input.status);
  if (input.ownerUserId && (role === "admin" || role === "super_admin")) {
    q = q.where("cv.owner_user_id", input.ownerUserId);
  }
  if (input.campaignId) q = q.where("cv.campaign_id", input.campaignId);
  if (input.unassigned === "true") q = q.whereNull("cv.owner_user_id");
  if (input.search) {
    const like = `%${input.search}%`;
    q = q.where((qb) =>
      qb
        .orWhere("cv.contact_email", "like", like)
        .orWhere("cv.contact_name", "like", like)
        .orWhere("cv.contact_phone", "like", like)
        .orWhere("cv.subject", "like", like)
        .orWhere("l.name", "like", like)
    );
  }

  const [rows, countRows] = await Promise.all([
    q.clone().orderBy("cv.last_message_at", "desc").limit(input.limit).offset(offset),
    q.clone().clearSelect().count("cv.id as total"),
  ]);

  const total = Number((countRows[0] as unknown as { total: string | number }).total);
  return { conversations: rows.map(rowToConversationDTO), total };
}

// ─── Get detail ────────────────────────────────────────────────────────────────

export async function getConversation(
  id: string,
  orgId: string,
  userId: string,
  role: UserRole
): Promise<ConversationDetailDTO> {
  const db = getDb();

  const row = await conversationBaseQuery(db)
    .where("cv.id", id)
    .where("cv.organisation_id", orgId)
    .first();

  if (!row) throw new NotFoundError("Conversation not found");
  if (!canAccessConversation(row, userId, role)) throw new ForbiddenError();

  const [msgRows, assignRows] = await Promise.all([
    db("conversation_messages as m")
      .leftJoin("users as u", "u.id", "m.sent_by_user_id")
      .where("m.conversation_id", id)
      .select("m.*", "u.first_name as sent_by_first_name", "u.last_name as sent_by_last_name")
      .orderBy("m.created_at", "asc"),

    db("conversation_assignments as ca")
      .leftJoin("users as fu", "fu.id", "ca.from_user_id")
      .leftJoin("users as tu", "tu.id", "ca.to_user_id")
      .leftJoin("users as cu", "cu.id", "ca.changed_by_user_id")
      .where("ca.conversation_id", id)
      .select(
        "ca.*",
        "fu.first_name as from_first", "fu.last_name as from_last",
        "tu.first_name as to_first", "tu.last_name as to_last",
        "cu.first_name as by_first", "cu.last_name as by_last"
      )
      .orderBy("ca.created_at", "asc"),
  ]);

  const messages = msgRows.map(rowToMessageDTO);

  const assignments: AssignmentHistoryDTO[] = assignRows.map((r) => ({
    id: r.id as string,
    fromUserId: (r.from_user_id as string) ?? null,
    fromUserName: r.from_first ? `${r.from_first} ${r.from_last ?? ""}`.trim() : null,
    toUserId: r.to_user_id as string,
    toUserName: r.to_first ? `${r.to_first} ${r.to_last ?? ""}`.trim() : null,
    changedByUserId: r.changed_by_user_id as string,
    changedByName: r.by_first ? `${r.by_first} ${r.by_last ?? ""}`.trim() : null,
    reason: (r.reason as string) ?? null,
    createdAt: new Date(r.created_at as Date).toISOString(),
  }));

  // Mark as read and broadcast instantly so unread badges update without polling
  const prevUnread = Number(row.unread_count);
  if (role === "admin" || role === "super_admin" || row.owner_user_id === userId) {
    if (prevUnread > 0) {
      await db("conversations")
        .where("id", id)
        .update({ unread_count: 0, updated_at: new Date() });

      const ssePayload = { conversationId: id, event: "read", orgId };
      if (row.owner_user_id) {
        broadcastToUser(row.owner_user_id as string, "inbox:update", ssePayload);
      }
      broadcastToOrg(orgId, "inbox:update", ssePayload);
    }
  }

  return { ...rowToConversationDTO(row), messages, assignments };
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export async function getInboxStats(
  orgId: string,
  userId: string,
  role: UserRole
): Promise<InboxStatsDTO> {
  const db = getDb();

  let q = db("conversations").where("organisation_id", orgId);
  if (role !== "super_admin" && role !== "admin") {
    q = q.where("owner_user_id", userId);
  }

  const [rows, byChannel] = await Promise.all([
    q.clone().select(
      db.raw("COUNT(*) as total"),
      db.raw("SUM(CASE WHEN status = 'awaiting_employee' THEN 1 ELSE 0 END) as awaiting_employee"),
      db.raw("SUM(CASE WHEN status = 'awaiting_customer' THEN 1 ELSE 0 END) as awaiting_customer"),
      db.raw("SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count"),
      db.raw("SUM(unread_count) as unread_total"),
    ).first(),
    q.clone().select("channel", db.raw("COUNT(*) as count")).groupBy("channel"),
  ]);

  const r = rows as any;
  return {
    total: Number(r?.total ?? 0),
    awaitingEmployee: Number(r?.awaiting_employee ?? 0),
    awaitingCustomer: Number(r?.awaiting_customer ?? 0),
    open: Number(r?.open_count ?? 0),
    unreadTotal: Number(r?.unread_total ?? 0),
    byChannel: (byChannel as any[]).map((x) => ({ channel: x.channel as string, count: Number(x.count) })),
  };
}

// ─── Reply ─────────────────────────────────────────────────────────────────────

export async function replyToConversation(
  id: string,
  orgId: string,
  userId: string,
  role: UserRole,
  input: ReplyInput
): Promise<ConversationMessageDTO> {
  const db = getDb();

  const conv = await db("conversations").where({ id, organisation_id: orgId }).first();
  if (!conv) throw new NotFoundError("Conversation not found");
  if (!canAccessConversation(conv, userId, role)) throw new ForbiddenError();
  if (conv.status === "closed") {
    // Auto-reopen on reply
    await db("conversations").where("id", id).update({ status: "open", updated_at: new Date() });
  }

  const sender = conv.sender_identity_id
    ? await db("sender_identities").where("id", conv.sender_identity_id).first()
    : null;

  const msgId = uuidv4();
  const now = new Date();

  if (conv.channel === "email") {
    await sendEmailReply(db, conv, sender, userId, input, msgId, now);
  } else if (conv.channel === "whatsapp") {
    await sendWhatsAppReply(db, conv, sender, userId, input, msgId, now);
  } else if (conv.channel === "sms") {
    await sendSmsReply(db, conv, sender, userId, input, msgId, now);
  }

  // Update conversation
  await db("conversations").where("id", id).update({
    status: "awaiting_customer",
    last_message_at: now,
    message_count: db.raw("message_count + 1"),
    updated_at: now,
  });

  const row = await db("conversation_messages as m")
    .leftJoin("users as u", "u.id", "m.sent_by_user_id")
    .where("m.id", msgId)
    .select("m.*", "u.first_name as sent_by_first_name", "u.last_name as sent_by_last_name")
    .first();

  return rowToMessageDTO(row);
}

async function sendEmailReply(
  db: ReturnType<typeof getDb>,
  conv: Record<string, unknown>,
  sender: Record<string, unknown> | null,
  userId: string,
  input: ReplyInput,
  msgId: string,
  now: Date
): Promise<void> {
  // Build SMTP config: prefer per-sender smtp_config, fall back to global
  const smtpCfg = sender?.smtp_config
    ? (typeof sender.smtp_config === "string"
        ? JSON.parse(sender.smtp_config as string)
        : sender.smtp_config) as Record<string, unknown>
    : null;

  const transporter = nodemailer.createTransport({
    host: (smtpCfg?.host as string) ?? config.smtp.host,
    port: (smtpCfg?.port as number) ?? config.smtp.port,
    secure: smtpCfg?.secure !== undefined ? Boolean(smtpCfg.secure) : config.smtp.secure,
    auth: {
      user: (smtpCfg?.user as string) ?? config.smtp.user,
      pass: (smtpCfg?.pass as string) ?? config.smtp.pass,
    },
    tls: { rejectUnauthorized: false },
  });

  const fromAddress = (sender?.from_address as string) ?? config.smtp.fromEmail;
  const fromName = (sender?.name as string) ?? config.smtp.fromName;
  const subject = conv.subject
    ? String(conv.subject).startsWith("Re:") ? String(conv.subject) : `Re: ${conv.subject}`
    : "Re: Your enquiry";

  // ── Build RFC 2822-compliant threading headers ────────────────────────────
  // In-Reply-To: should reference the LAST message the contact sent (inbound).
  // References: full chain – all message IDs in the thread, oldest first.
  //   We also include any IDs from the contact's own References header
  //   (stored in raw_payload.references) so the chain stays intact even when
  //   our DB is missing older messages.
  const lastInbound = await db("conversation_messages")
    .where({ conversation_id: conv.id as string, direction: "inbound", channel: "email" })
    .orderBy("created_at", "desc")
    .select("provider_message_id", "raw_payload")
    .first();

  const dbMessageIds: string[] = await db("conversation_messages")
    .where({ conversation_id: conv.id as string, channel: "email" })
    .whereNotNull("provider_message_id")
    .orderBy("created_at", "asc")
    .pluck("provider_message_id") as string[];

  // Merge in the contact's own References chain from the last inbound message
  const contactRefs: string[] = (() => {
    try {
      const payload = lastInbound?.raw_payload;
      if (!payload) return [];
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      return Array.isArray(parsed.references) ? parsed.references : [];
    } catch { return []; }
  })();

  // De-duplicate while preserving order: contact refs first, then DB IDs
  const seen = new Set<string>();
  const referencesChain: string[] = [];
  for (const id of [...contactRefs, ...dbMessageIds]) {
    if (id && !seen.has(id)) { seen.add(id); referencesChain.push(id); }
  }

  const headers: Record<string, string> = {};
  if (lastInbound?.provider_message_id) {
    headers["In-Reply-To"] = lastInbound.provider_message_id as string;
  }
  if (referencesChain.length > 0) {
    headers["References"] = referencesChain.join(" ");
  }

  const result = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: conv.contact_email as string,
    subject,
    text: input.body,
    html: input.bodyHtml ?? `<div style="white-space:pre-wrap">${input.body}</div>`,
    headers,
  });

  const providerMsgId: string = result.messageId ?? null;

  // Record in email_events
  await db("email_events").insert({
    id: uuidv4(),
    organisation_id: conv.organisation_id,
    campaign_id: conv.campaign_id ?? null,
    campaign_contact_id: conv.campaign_contact_id ?? null,
    lead_id: conv.lead_id ?? null,
    sender_identity_id: conv.sender_identity_id ?? null,
    message_id: providerMsgId,
    event_type: "sent",
    recipient_email: conv.contact_email,
    subject,
    occurred_at: now,
    created_at: now,
  });

  await db("conversation_messages").insert({
    id: msgId,
    conversation_id: conv.id,
    organisation_id: conv.organisation_id,
    direction: "outbound",
    channel: "email",
    provider_message_id: providerMsgId,
    in_reply_to_id: lastInbound?.provider_message_id ?? null,
    sender_address: fromAddress,
    recipient_address: conv.contact_email,
    subject,
    body_text: input.body,
    body_html: input.bodyHtml ?? null,
    sent_by_user_id: userId,
    created_at: now,
  });
}

async function sendWhatsAppReply(
  db: ReturnType<typeof getDb>,
  conv: Record<string, unknown>,
  sender: Record<string, unknown> | null,
  userId: string,
  input: ReplyInput,
  msgId: string,
  now: Date
): Promise<void> {
  let accessToken: string | null = null;
  let phoneNumberId: string | null = null;

  if (sender?.credentials_encrypted) {
    try {
      const creds = JSON.parse(decrypt(sender.credentials_encrypted as string)) as Record<string, string>;
      accessToken = creds.accessToken ?? creds.token ?? null;
      phoneNumberId = (sender.whatsapp_phone_number_id as string) ?? null;
    } catch {
      logger.warn("[inbox] failed to decrypt WA credentials", { senderId: sender.id });
    }
  }

  if (!accessToken || !phoneNumberId || !conv.contact_phone) {
    throw new ConflictError(
      "WhatsApp sender has no credentials configured. Add the Meta access token in Settings → Senders before replying."
    );
  }

  let waMessageId: string | null = null;
  try {
    const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.contact_phone,
        type: "text",
        text: { body: input.body },
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error) {
      const errMsg = (data.error as Record<string, unknown> | undefined)?.message as string | undefined;
      throw new Error(errMsg ?? `WhatsApp API returned HTTP ${res.status}`);
    }
    waMessageId = ((data.messages as unknown[])?.[0] as Record<string, unknown>)?.id as string ?? null;
    if (!waMessageId) throw new Error("WhatsApp API did not return a message id");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[inbox] WA reply send failed", { err: msg });
    throw new ConflictError(`WhatsApp message failed to send: ${msg}`);
  }

  // Only reached on confirmed delivery to Meta — record in whatsapp_messages
  const waDbId = uuidv4();
  await db("whatsapp_messages").insert({
    id: waDbId,
    organisation_id: conv.organisation_id,
    campaign_id: conv.campaign_id ?? null,
    lead_id: conv.lead_id ?? null,
    sender_identity_id: conv.sender_identity_id ?? null,
    wa_message_id: waMessageId,
    direction: "outbound",
    recipient_phone: conv.contact_phone,
    message_type: "text",
    body: input.body,
    status: "sent",
    sent_at: now,
    created_at: now,
  });

  await db("conversation_messages").insert({
    id: msgId,
    conversation_id: conv.id,
    organisation_id: conv.organisation_id,
    direction: "outbound",
    channel: "whatsapp",
    provider_message_id: waMessageId,
    recipient_phone: conv.contact_phone,
    body_text: input.body,
    sent_by_user_id: userId,
    wa_message_db_id: waDbId,
    created_at: now,
  });
}

async function sendSmsReply(
  db: ReturnType<typeof getDb>,
  conv: Record<string, unknown>,
  sender: Record<string, unknown> | null,
  userId: string,
  input: ReplyInput,
  msgId: string,
  now: Date
): Promise<void> {
  let credentials: Record<string, string> | null = null;
  if (sender?.credentials_encrypted) {
    try {
      credentials = JSON.parse(decrypt(sender.credentials_encrypted as string)) as Record<string, string>;
    } catch {
      logger.warn("[inbox] failed to decrypt SMS credentials", { senderId: sender.id });
    }
  }

  if (!credentials || !sender?.sms_sender_id || !conv.contact_phone) {
    throw new ConflictError(
      "SMS sender has no credentials configured. Add the SMS API credentials in Settings → Senders before replying."
    );
  }

  const result = await sendSms({
    recipient: conv.contact_phone as string,
    senderId: sender.sms_sender_id as string,
    body: input.body,
    dltTemplateId: null,
    credentials: {
      provider: (credentials.provider as "exotel" | "generic") ?? "generic",
      apiKey: credentials.apiKey ?? "",
      apiSecret: credentials.apiSecret,
      accountSid: credentials.accountSid,
      baseUrl: credentials.baseUrl ?? "",
    },
  });

  if (!result.success) {
    throw new ConflictError(`SMS message failed to send: ${result.error ?? "unknown error"}`);
  }

  // Only reached on confirmed provider acceptance — record in sms_messages
  await db("sms_messages").insert({
    id: uuidv4(),
    organisation_id: conv.organisation_id,
    campaign_id: conv.campaign_id ?? null,
    lead_id: conv.lead_id ?? null,
    sender_identity_id: conv.sender_identity_id ?? null,
    provider_message_id: result.providerMessageId,
    direction: "outbound",
    recipient_phone: conv.contact_phone,
    sender_id: sender.sms_sender_id,
    body: input.body,
    status: "sent",
    sent_at: now,
    created_at: now,
  });

  await db("conversation_messages").insert({
    id: msgId,
    conversation_id: conv.id,
    organisation_id: conv.organisation_id,
    direction: "outbound",
    channel: "sms",
    provider_message_id: result.providerMessageId,
    recipient_phone: conv.contact_phone,
    body_text: input.body,
    sent_by_user_id: userId,
    created_at: now,
  });
}

// ─── Assign ────────────────────────────────────────────────────────────────────

export async function assignConversation(
  id: string,
  orgId: string,
  changedByUserId: string,
  changedByRole: UserRole,
  input: AssignInput
): Promise<ConversationDTO> {
  const db = getDb();

  const conv = await db("conversations").where({ id, organisation_id: orgId }).first();
  if (!conv) throw new NotFoundError("Conversation not found");

  // Only admins can assign to other users; employees can only self-assign
  if (changedByRole !== "admin" && changedByRole !== "super_admin") {
    if (input.userId !== changedByUserId) {
      throw new ForbiddenError("Employees can only assign conversations to themselves");
    }
  }

  const prevOwner = conv.owner_user_id as string | null;

  await db("conversations").where("id", id).update({
    owner_user_id: input.userId,
    updated_at: new Date(),
  });

  // Record assignment history
  await db("conversation_assignments").insert({
    id: uuidv4(),
    conversation_id: id,
    from_user_id: prevOwner,
    to_user_id: input.userId,
    changed_by_user_id: changedByUserId,
    reason: input.reason ?? null,
    created_at: new Date(),
  });

  // Notify the new owner (if different from actor) + SSE push
  if (input.userId !== changedByUserId) {
    const contactLabel = (conv.contact_name as string) ?? (conv.contact_email as string) ?? (conv.contact_phone as string) ?? "a contact";
    await createNotification({
      orgId,
      userId: input.userId,
      type: "lead_assigned",
      title: "Conversation assigned to you",
      body: `A ${conv.channel} conversation with ${contactLabel} has been assigned to you.`,
      metadata: { conversationId: id },
    }).catch(() => {});
    broadcastToUser(input.userId, "inbox:update", { conversationId: id, event: "assigned" });
  }
  broadcastToOrg(orgId, "inbox:update", { conversationId: id, event: "assigned" });

  const row = await conversationBaseQuery(db)
    .where("cv.id", id)
    .where("cv.organisation_id", orgId)
    .first();
  return rowToConversationDTO(row);
}

// ─── Close / Reopen ────────────────────────────────────────────────────────────

export async function closeConversation(
  id: string,
  orgId: string,
  userId: string,
  role: UserRole
): Promise<ConversationDTO> {
  const db = getDb();
  const conv = await db("conversations").where({ id, organisation_id: orgId }).first();
  if (!conv) throw new NotFoundError("Conversation not found");
  if (!canAccessConversation(conv, userId, role)) throw new ForbiddenError();

  await db("conversations")
    .where("id", id)
    .update({ status: "closed", updated_at: new Date() });

  const row = await conversationBaseQuery(db).where("cv.id", id).first();
  return rowToConversationDTO(row);
}

export async function reopenConversation(
  id: string,
  orgId: string,
  userId: string,
  role: UserRole
): Promise<ConversationDTO> {
  const db = getDb();
  const conv = await db("conversations").where({ id, organisation_id: orgId }).first();
  if (!conv) throw new NotFoundError("Conversation not found");
  if (!canAccessConversation(conv, userId, role)) throw new ForbiddenError();

  await db("conversations")
    .where("id", id)
    .update({ status: "awaiting_employee", updated_at: new Date() });

  const row = await conversationBaseQuery(db).where("cv.id", id).first();
  return rowToConversationDTO(row);
}

// ─── Worker helpers (called from IMAP + webhook workers) ──────────────────────

export interface InboundEmailReplyOpts {
  orgId: string;
  campaignId: string | null;
  campaignContactId: string | null;
  leadId: string | null;
  senderIdentityId: string | null;
  fromEmail: string;
  toEmail?: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  /** Full References chain from the incoming message's own headers.
   *  Propagated so outbound replies can build a complete thread header. */
  contactReferences?: string[];
  subject: string;
  bodyText: string | null;
  /** Raw HTML body, if the inbound message had an HTML part. */
  bodyHtml?: string | null;
  receivedAt: Date;
  // Contact info from uploaded_contacts (may be enriched by caller)
  contactName?: string | null;
  contactCompany?: string | null;
  campaignOwnerUserId?: string | null;
  /** Override the source value for new conversations. Defaults to "cold_email_reply". */
  sourceOverride?: "cold_email_reply" | "inbound_email";
  /** Override the initial status for new conversations. Defaults to "awaiting_employee". */
  statusOverride?: "awaiting_employee" | "open";
}

export async function handleInboundEmailReply(
  db: ReturnType<typeof getDb>,
  opts: InboundEmailReplyOpts
): Promise<void> {
  // Skip unmatched messages with no org context — we have no tenant to attach to
  if (!opts.orgId) return;

  // Early dedup guard: check BEFORE mutating conversation counters.
  // The DB unique constraint + .onConflict.ignore() handles true concurrent
  // races, but this pre-check prevents counter inflation on the common case
  // of IMAP reconnect replaying already-processed messages.
  if (opts.messageId) {
    const alreadyProcessed = await db("conversation_messages")
      .where({ organisation_id: opts.orgId, provider_message_id: opts.messageId })
      .first();
    if (alreadyProcessed) {
      logger.info("[inbox] duplicate inbound email ignored (pre-check)", {
        orgId: opts.orgId,
        messageId: opts.messageId,
      });
      return;
    }
  }

  const now = opts.receivedAt;

  // 1. Find existing conversation for this campaign contact or email thread
  let conv = opts.campaignContactId
    ? await db("conversations")
        .where({ campaign_contact_id: opts.campaignContactId, channel: "email" })
        .first()
    : null;

  if (!conv && opts.campaignId && opts.fromEmail) {
    conv = await db("conversations")
      .where({ campaign_id: opts.campaignId, contact_email: opts.fromEmail, channel: "email" })
      .first();
  }

  // 2. Determine owner: campaign creator
  const ownerUserId =
    opts.campaignOwnerUserId ??
    (opts.campaignId
      ? ((await db("campaigns").where("id", opts.campaignId).select("created_by").first())?.created_by ?? null)
      : null);

  // 3. Ensure lead exists
  const leadId = await ensureLeadForEmail(db, opts.orgId, ownerUserId, opts);

  const convSource = opts.sourceOverride ?? "cold_email_reply";
  const convStatus = opts.statusOverride ?? "awaiting_employee";

  // 4. Create conversation if new
  if (!conv) {
    const convId = uuidv4();
    await db("conversations").insert({
      id: convId,
      organisation_id: opts.orgId,
      channel: "email",
      contact_email: opts.fromEmail,
      contact_name: opts.contactName ?? null,
      lead_id: leadId,
      campaign_id: opts.campaignId ?? null,
      campaign_contact_id: opts.campaignContactId ?? null,
      sender_identity_id: opts.senderIdentityId ?? null,
      owner_user_id: ownerUserId,
      status: convStatus,
      source: convSource,
      subject: opts.subject ?? null,
      last_message_at: now,
      last_inbound_at: now,
      message_count: 1,
      unread_count: 1,
      created_at: now,
      updated_at: now,
    });
    conv = { id: convId, unread_count: 0 }; // minimal shape for updates below
  } else {
    // Update existing conversation
    await db("conversations").where("id", conv.id as string).update({
      status: convStatus,
      last_message_at: now,
      last_inbound_at: now,
      message_count: db.raw("message_count + 1"),
      unread_count: db.raw("unread_count + 1"),
      lead_id: leadId ?? conv.lead_id,
      updated_at: now,
    });
  }

  // 5. Store the message (ON DUPLICATE KEY IGNORE for DB-level dedup)
  const msgInserted = await db("conversation_messages")
    .insert({
      id: uuidv4(),
      conversation_id: conv.id as string,
      organisation_id: opts.orgId,
      direction: "inbound",
      channel: "email",
      provider_message_id: opts.messageId,
      in_reply_to_id: opts.inReplyTo,
      // Store the contact's References chain so outbound replies can build
      // a complete References header spanning the full thread.
      raw_payload: opts.contactReferences?.length
        ? JSON.stringify({ references: opts.contactReferences })
        : null,
      sender_address: opts.fromEmail,
      recipient_address: opts.toEmail ?? null,
      subject: opts.subject,
      body_text: opts.bodyText,
      body_html: opts.bodyHtml ?? null,
      received_at: now,
      created_at: now,
    })
    .onConflict(["organisation_id", "provider_message_id"])
    .ignore();

  // If the DB ignored the insert (duplicate), skip counter updates
  if (opts.messageId && Array.isArray(msgInserted) && msgInserted.length === 0) {
    logger.info("[inbox] duplicate inbound email ignored", {
      orgId: opts.orgId,
      messageId: opts.messageId,
    });
    return;
  }

  // 6. Notify owner + push SSE events for real-time frontend updates
  const convId = conv.id as string;
  const ssePayload = { conversationId: convId, channel: "email", orgId: opts.orgId };

  // Push to the owning employee immediately
  if (ownerUserId) {
    const contactLabel = opts.contactName ?? opts.fromEmail;
    await createNotification({
      orgId: opts.orgId,
      userId: ownerUserId,
      type: "reply_received",
      title: "New email reply",
      body: `${contactLabel} replied to your email.`,
      metadata: { conversationId: convId, campaignId: opts.campaignId },
    }).catch(() => {});
    broadcastToUser(ownerUserId, "inbox:new", ssePayload);
  }
  // Also push to any admin watching the org-level inbox
  broadcastToOrg(opts.orgId, "inbox:new", ssePayload);
}

export interface InboundWhatsAppOpts {
  orgId: string;
  senderPhone: string;
  waMessageId: string;
  waMessageDbId: string;
  campaignId: string | null;
  campaignContactId: string | null;
  leadId: string | null;
  senderIdentityId: string | null;
  bodyText: string | null;
  messageType: string;
  receivedAt: Date;
  ownerUserId?: string | null;
  contactName?: string | null;
  /** Which strategy matched this inbound message to a campaign/conversation. */
  correlationMethod?: string;
}

export async function handleInboundWhatsAppMessage(
  db: ReturnType<typeof getDb>,
  opts: InboundWhatsAppOpts
): Promise<void> {
  // Early dedup guard for WhatsApp messages — same reasoning as email handler.
  if (opts.waMessageId) {
    const alreadyProcessed = await db("conversation_messages")
      .where({ organisation_id: opts.orgId, provider_message_id: opts.waMessageId })
      .first();
    if (alreadyProcessed) {
      logger.info("[inbox] duplicate inbound WA message ignored (pre-check)", {
        orgId: opts.orgId,
        waMessageId: opts.waMessageId,
      });
      return;
    }
  }

  const now = opts.receivedAt;

  // 1. Find open conversation by phone
  let conv = await db("conversations")
    .where({ contact_phone: opts.senderPhone, organisation_id: opts.orgId, channel: "whatsapp" })
    .whereIn("status", ["open", "awaiting_employee", "awaiting_customer"])
    .orderBy("last_message_at", "desc")
    .first();

  // Determine owner
  const ownerUserId =
    opts.ownerUserId ??
    (opts.campaignId
      ? ((await db("campaigns").where("id", opts.campaignId).select("created_by").first())?.created_by ?? null)
      : null);

  // Ensure lead
  const leadId = await ensureLeadForPhone(db, opts.orgId, ownerUserId, opts, "whatsapp");

  if (!conv) {
    const convId = uuidv4();
    await db("conversations").insert({
      id: convId,
      organisation_id: opts.orgId,
      channel: "whatsapp",
      contact_phone: opts.senderPhone,
      contact_name: opts.contactName ?? null,
      lead_id: leadId,
      campaign_id: opts.campaignId ?? null,
      campaign_contact_id: opts.campaignContactId ?? null,
      sender_identity_id: opts.senderIdentityId ?? null,
      owner_user_id: ownerUserId,
      status: "awaiting_employee",
      source: "whatsapp_reply",
      last_message_at: now,
      last_inbound_at: now,
      message_count: 1,
      unread_count: 1,
      created_at: now,
      updated_at: now,
    });
    conv = { id: convId };
  } else {
    await db("conversations").where("id", conv.id as string).update({
      status: "awaiting_employee",
      last_message_at: now,
      last_inbound_at: now,
      message_count: db.raw("message_count + 1"),
      unread_count: db.raw("unread_count + 1"),
      lead_id: leadId ?? conv.lead_id,
      updated_at: now,
    });
  }

  const waInserted = await db("conversation_messages")
    .insert({
      id: uuidv4(),
      conversation_id: conv.id as string,
      organisation_id: opts.orgId,
      direction: "inbound",
      channel: "whatsapp",
      provider_message_id: opts.waMessageId,
      sender_phone: opts.senderPhone,
      body_text: opts.bodyText,
      wa_message_db_id: opts.waMessageDbId,
      raw_payload: opts.correlationMethod
        ? JSON.stringify({ correlationMethod: opts.correlationMethod })
        : null,
      received_at: now,
      created_at: now,
    })
    .onConflict(["organisation_id", "provider_message_id"])
    .ignore();

  if (Array.isArray(waInserted) && waInserted.length === 0) {
    logger.info("[inbox] duplicate inbound WA message ignored", {
      orgId: opts.orgId,
      waMessageId: opts.waMessageId,
    });
    return;
  }

  const waConvId = conv.id as string;
  const waSsePayload = { conversationId: waConvId, channel: "whatsapp", orgId: opts.orgId };

  if (ownerUserId) {
    const contactLabel = opts.contactName ?? opts.senderPhone;
    await createNotification({
      orgId: opts.orgId,
      userId: ownerUserId,
      type: "reply_received",
      title: "New WhatsApp message",
      body: `${contactLabel} sent you a WhatsApp message.`,
      metadata: { conversationId: waConvId, campaignId: opts.campaignId },
    }).catch(() => {});
    broadcastToUser(ownerUserId, "inbox:new", waSsePayload);
  }
  broadcastToOrg(opts.orgId, "inbox:new", waSsePayload);
}

export interface InboundSmsOpts {
  orgId: string;
  senderPhone: string;
  providerMessageId: string | null;
  campaignId: string | null;
  campaignContactId: string | null;
  leadId: string | null;
  senderIdentityId: string | null;
  bodyText: string | null;
  receivedAt: Date;
  ownerUserId?: string | null;
  contactName?: string | null;
  correlationMethod?: string;
}

export async function handleInboundSmsMessage(
  db: ReturnType<typeof getDb>,
  opts: InboundSmsOpts
): Promise<void> {
  if (opts.providerMessageId) {
    const alreadyProcessed = await db("conversation_messages")
      .where({ organisation_id: opts.orgId, provider_message_id: opts.providerMessageId })
      .first();
    if (alreadyProcessed) {
      logger.info("[inbox] duplicate inbound SMS message ignored (pre-check)", {
        orgId: opts.orgId,
        providerMessageId: opts.providerMessageId,
      });
      return;
    }
  }

  const now = opts.receivedAt;

  let conv = await db("conversations")
    .where({ contact_phone: opts.senderPhone, organisation_id: opts.orgId, channel: "sms" })
    .whereIn("status", ["open", "awaiting_employee", "awaiting_customer"])
    .orderBy("last_message_at", "desc")
    .first();

  const ownerUserId =
    opts.ownerUserId ??
    (opts.campaignId
      ? ((await db("campaigns").where("id", opts.campaignId).select("created_by").first())?.created_by ?? null)
      : null);

  const leadId = await ensureLeadForPhone(db, opts.orgId, ownerUserId, opts, "sms");

  if (!conv) {
    const convId = uuidv4();
    await db("conversations").insert({
      id: convId,
      organisation_id: opts.orgId,
      channel: "sms",
      contact_phone: opts.senderPhone,
      contact_name: opts.contactName ?? null,
      lead_id: leadId,
      campaign_id: opts.campaignId ?? null,
      campaign_contact_id: opts.campaignContactId ?? null,
      sender_identity_id: opts.senderIdentityId ?? null,
      owner_user_id: ownerUserId,
      status: "awaiting_employee",
      source: "sms_reply",
      last_message_at: now,
      last_inbound_at: now,
      message_count: 1,
      unread_count: 1,
      created_at: now,
      updated_at: now,
    });
    conv = { id: convId };
  } else {
    await db("conversations").where("id", conv.id as string).update({
      status: "awaiting_employee",
      last_message_at: now,
      last_inbound_at: now,
      message_count: db.raw("message_count + 1"),
      unread_count: db.raw("unread_count + 1"),
      lead_id: leadId ?? conv.lead_id,
      updated_at: now,
    });
  }

  const smsInserted = await db("conversation_messages")
    .insert({
      id: uuidv4(),
      conversation_id: conv.id as string,
      organisation_id: opts.orgId,
      direction: "inbound",
      channel: "sms",
      provider_message_id: opts.providerMessageId,
      sender_phone: opts.senderPhone,
      body_text: opts.bodyText,
      raw_payload: opts.correlationMethod
        ? JSON.stringify({ correlationMethod: opts.correlationMethod })
        : null,
      received_at: now,
      created_at: now,
    })
    .onConflict(["organisation_id", "provider_message_id"])
    .ignore();

  if (Array.isArray(smsInserted) && smsInserted.length === 0) {
    logger.info("[inbox] duplicate inbound SMS message ignored", {
      orgId: opts.orgId,
      providerMessageId: opts.providerMessageId,
    });
    return;
  }

  const smsConvId = conv.id as string;
  const smsSsePayload = { conversationId: smsConvId, channel: "sms", orgId: opts.orgId };

  if (ownerUserId) {
    const contactLabel = opts.contactName ?? opts.senderPhone;
    await createNotification({
      orgId: opts.orgId,
      userId: ownerUserId,
      type: "reply_received",
      title: "New SMS message",
      body: `${contactLabel} sent you an SMS.`,
      metadata: { conversationId: smsConvId, campaignId: opts.campaignId },
    }).catch(() => {});
    broadcastToUser(ownerUserId, "inbox:new", smsSsePayload);
  }
  broadcastToOrg(opts.orgId, "inbox:new", smsSsePayload);
}

// ─── Lead auto-creation helpers ────────────────────────────────────────────────

async function ensureLeadForEmail(
  db: ReturnType<typeof getDb>,
  orgId: string,
  ownerUserId: string | null,
  opts: InboundEmailReplyOpts
): Promise<string | null> {
  if (opts.leadId) return opts.leadId;

  // Look up by email
  const existing = await db("lead_emails")
    .join("leads", "leads.id", "lead_emails.lead_id")
    .where("lead_emails.email", opts.fromEmail.toLowerCase())
    .where("leads.organisation_id", orgId)
    .select("leads.id")
    .first();

  if (existing) return existing.id as string;
  if (!ownerUserId) return null;

  // Create minimal lead
  const leadId = uuidv4();
  const now = opts.receivedAt;
  const name = opts.contactName ?? opts.fromEmail;

  await db("leads").insert({
    id: leadId,
    organisation_id: orgId,
    assigned_to: ownerUserId,
    created_by: ownerUserId,
    name,
    company: opts.contactCompany ?? null,
    source: "cold_email",
    status: "contacted",
    tags: JSON.stringify([]),
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  });

  await db("lead_emails").insert({
    id: uuidv4(),
    lead_id: leadId,
    email: opts.fromEmail.toLowerCase(),
    is_primary: 1,
    created_at: now,
  });

  await db("lead_activities").insert({
    id: uuidv4(),
    lead_id: leadId,
    organisation_id: orgId,
    user_id: ownerUserId,
    type: "email_reply",
    subject: `Lead created from email reply: ${opts.subject}`,
    body: opts.bodyText ? opts.bodyText.slice(0, 2000) : null,
    metadata: JSON.stringify({ campaignId: opts.campaignId }),
    created_at: now,
  });

  return leadId;
}

interface PhoneLeadOpts {
  senderPhone: string;
  contactName?: string | null;
  leadId: string | null;
  receivedAt: Date;
  bodyText: string | null;
  campaignId: string | null;
}

async function ensureLeadForPhone(
  db: ReturnType<typeof getDb>,
  orgId: string,
  ownerUserId: string | null,
  opts: PhoneLeadOpts,
  channel: "whatsapp" | "sms"
): Promise<string | null> {
  if (opts.leadId) return opts.leadId;

  const existing = await db("lead_phones")
    .join("leads", "leads.id", "lead_phones.lead_id")
    .where("lead_phones.phone", opts.senderPhone)
    .where("leads.organisation_id", orgId)
    .select("leads.id")
    .first();

  if (existing) return existing.id as string;
  if (!ownerUserId) return null;

  const leadId = uuidv4();
  const now = opts.receivedAt;
  const name = opts.contactName ?? opts.senderPhone;
  const source: LeadSource = channel === "whatsapp" ? "whatsapp" : "sms";
  const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS";

  await db("leads").insert({
    id: leadId,
    organisation_id: orgId,
    assigned_to: ownerUserId,
    created_by: ownerUserId,
    name,
    source,
    status: "contacted",
    tags: JSON.stringify([]),
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  });

  await db("lead_phones").insert({
    id: uuidv4(),
    lead_id: leadId,
    phone: opts.senderPhone,
    is_primary: 1,
    is_whatsapp: channel === "whatsapp" ? 1 : 0,
    created_at: now,
  });

  await db("lead_activities").insert({
    id: uuidv4(),
    lead_id: leadId,
    organisation_id: orgId,
    user_id: ownerUserId,
    type: channel === "whatsapp" ? "whatsapp_reply" : "sms_reply",
    subject: `Lead created from ${channelLabel} reply`,
    body: opts.bodyText ? opts.bodyText.slice(0, 2000) : null,
    metadata: JSON.stringify({ campaignId: opts.campaignId }),
    created_at: now,
  });

  return leadId;
}
