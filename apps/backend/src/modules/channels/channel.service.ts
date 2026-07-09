import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { encrypt, decrypt } from "../../core/encryption";
import { extractVariables } from "../../core/senders/template";
import { NotFoundError } from "../../core/errors";
import { config } from "../../core/config";
import type {
  CreateSenderIdentityInput,
  UpdateSenderIdentityInput,
  CreateTemplateInput,
  UpdateTemplateInput,
} from "./channel.schema";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SenderIdentityDTO {
  id: string;
  organisationId: string;
  channel: "email" | "whatsapp" | "sms";
  name: string;
  fromAddress: string | null;
  whatsappNumber: string | null;
  whatsappWabaId: string | null;
  whatsappPhoneNumberId: string | null;
  smsSenderId: string | null;
  hasCredentials: boolean;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateDTO {
  id: string;
  organisationId: string;
  channel: "email" | "whatsapp" | "sms";
  name: string;
  subject: string | null;
  body: string;
  variables: string[];
  whatsappTemplateName: string | null;
  whatsappTemplateId: string | null;
  whatsappApprovalStatus: "pending" | "approved" | "rejected" | null;
  dltTemplateId: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

function rowToSenderDTO(row: Record<string, unknown>): SenderIdentityDTO {
  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    channel: row.channel as SenderIdentityDTO["channel"],
    name: row.name as string,
    fromAddress: (row.from_address as string) ?? null,
    whatsappNumber: (row.whatsapp_number as string) ?? null,
    whatsappWabaId: (row.whatsapp_waba_id as string) ?? null,
    whatsappPhoneNumberId: (row.whatsapp_phone_number_id as string) ?? null,
    smsSenderId: (row.sms_sender_id as string) ?? null,
    hasCredentials: !!row.credentials_encrypted,
    isVerified: Boolean(row.is_verified),
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as Date).toISOString(),
  };
}

function rowToTemplateDTO(row: Record<string, unknown>): TemplateDTO {
  let variables: string[] = [];
  try {
    variables = row.variables
      ? typeof row.variables === "string"
        ? JSON.parse(row.variables)
        : (row.variables as string[])
      : [];
  } catch {}
  return {
    id: row.id as string,
    organisationId: row.organisation_id as string,
    channel: row.channel as TemplateDTO["channel"],
    name: row.name as string,
    subject: (row.subject as string) ?? null,
    body: row.body as string,
    variables,
    whatsappTemplateName: (row.whatsapp_template_name as string) ?? null,
    whatsappTemplateId: (row.whatsapp_template_id as string) ?? null,
    whatsappApprovalStatus: (row.whatsapp_approval_status as TemplateDTO["whatsappApprovalStatus"]) ?? null,
    dltTemplateId: (row.dlt_template_id as string) ?? null,
    isActive: Boolean(row.is_active),
    createdBy: (row.created_by as string) ?? null,
    createdAt: new Date(row.created_at as Date).toISOString(),
  };
}

// ─── Sender Identities ────────────────────────────────────────────────────────

export async function listSenderIdentities(
  orgId: string,
  channel?: string
): Promise<SenderIdentityDTO[]> {
  const db = getDb();
  let q = db("sender_identities").where("organisation_id", orgId);
  if (channel) q = q.where("channel", channel);
  const rows = await q.orderBy("created_at", "desc");
  return rows.map(rowToSenderDTO);
}

export async function getSenderIdentity(id: string, orgId: string): Promise<SenderIdentityDTO> {
  const db = getDb();
  const row = await db("sender_identities").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Sender identity not found");
  return rowToSenderDTO(row);
}

export async function getDecryptedCredentials(
  id: string,
  orgId: string
): Promise<Record<string, string> | null> {
  const db = getDb();
  const row = await db("sender_identities")
    .where({ id, organisation_id: orgId })
    .select("credentials_encrypted")
    .first();
  if (!row?.credentials_encrypted) return null;
  try {
    return JSON.parse(decrypt(row.credentials_encrypted));
  } catch {
    return null;
  }
}

export async function createSenderIdentity(
  orgId: string,
  input: CreateSenderIdentityInput
): Promise<SenderIdentityDTO> {
  const db = getDb();
  const id = uuidv4();
  const credentialsEncrypted = input.credentials
    ? encrypt(JSON.stringify(input.credentials))
    : null;

  await db("sender_identities").insert({
    id,
    organisation_id: orgId,
    channel: input.channel,
    name: input.name,
    from_address: input.fromAddress ?? null,
    whatsapp_number: input.whatsappNumber ?? null,
    whatsapp_waba_id: input.whatsappWabaId ?? null,
    whatsapp_phone_number_id: input.whatsappPhoneNumberId ?? null,
    sms_sender_id: input.smsSenderId ?? null,
    credentials_encrypted: credentialsEncrypted,
    is_verified: false,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return getSenderIdentity(id, orgId);
}

export async function updateSenderIdentity(
  id: string,
  orgId: string,
  input: UpdateSenderIdentityInput
): Promise<SenderIdentityDTO> {
  const db = getDb();
  const existing = await db("sender_identities").where({ id, organisation_id: orgId }).first();
  if (!existing) throw new NotFoundError("Sender identity not found");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.fromAddress !== undefined) updates.from_address = input.fromAddress;
  if (input.whatsappNumber !== undefined) updates.whatsapp_number = input.whatsappNumber;
  if (input.whatsappWabaId !== undefined) updates.whatsapp_waba_id = input.whatsappWabaId;
  if (input.whatsappPhoneNumberId !== undefined) updates.whatsapp_phone_number_id = input.whatsappPhoneNumberId;
  if (input.smsSenderId !== undefined) updates.sms_sender_id = input.smsSenderId;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.credentials !== undefined && input.credentials !== null) {
    updates.credentials_encrypted = encrypt(JSON.stringify(input.credentials));
  }

  await db("sender_identities").where({ id, organisation_id: orgId }).update(updates);
  return getSenderIdentity(id, orgId);
}

export async function deleteSenderIdentity(id: string, orgId: string): Promise<void> {
  const db = getDb();
  const row = await db("sender_identities").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Sender identity not found");
  await db("sender_identities").where({ id, organisation_id: orgId }).delete();
}

export interface TestResult {
  success: boolean;
  message: string;
}

export async function testSenderIdentity(id: string, orgId: string, toEmail?: string): Promise<TestResult> {
  const db = getDb();
  const row = await db("sender_identities").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Sender identity not found");

  if (!row.credentials_encrypted && row.channel !== "email") {
    return { success: false, message: "No credentials stored for this sender" };
  }

  try {
    if (row.channel === "email") {
      const nodemailer = await import("nodemailer");
      const smtpCfg = row.smtp_config
        ? (typeof row.smtp_config === "string" ? JSON.parse(row.smtp_config) : row.smtp_config) as Record<string, unknown>
        : null;

      const smtpHost = (smtpCfg?.host as string) ?? config.smtp.host;
      const smtpPort = (smtpCfg?.port as number) ?? config.smtp.port;
      const smtpSecure = smtpCfg?.secure !== undefined ? Boolean(smtpCfg.secure) : config.smtp.secure;
      const smtpUser = (smtpCfg?.user as string) ?? config.smtp.user;
      const smtpPass = (smtpCfg?.pass as string) ?? config.smtp.pass;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      });

      // Always verify the connection first
      await transporter.verify();

      // If a recipient was provided, send a real test email
      if (toEmail) {
        const fromAddress = (row.from_address as string | null) ?? config.smtp.fromEmail;
        const senderName = (row.name as string) ?? config.smtp.fromName;
        await transporter.sendMail({
          from: `"${senderName}" <${fromAddress}>`,
          to: toEmail,
          subject: `✅ Test email from ${senderName}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px">
              <h2 style="color:#111827">Test Email Successful</h2>
              <p style="color:#374151">This is a test email sent from <strong>${senderName}</strong> (${fromAddress}).</p>
              <p style="color:#374151">Your SMTP configuration is working correctly.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
              <p style="color:#9ca3af;font-size:12px">Sent at ${new Date().toISOString()}</p>
            </div>`,
          text: `Test email from ${senderName} (${fromAddress}). Sent at ${new Date().toISOString()}.`,
        });
        return { success: true, message: `Test email sent to ${toEmail}` };
      }

      return { success: true, message: "SMTP connection verified successfully" };
    }

    if (row.channel === "whatsapp") {
      const creds = JSON.parse(decrypt(row.credentials_encrypted)) as Record<string, string>;
      const token = creds.accessToken ?? creds.token;
      if (!token || !row.whatsapp_phone_number_id) {
        return { success: false, message: "Missing access token or phone number ID" };
      }
      const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${row.whatsapp_phone_number_id}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as Record<string, unknown>;
        const errMsg = (body as any)?.error?.message ?? `HTTP ${r.status}`;
        return { success: false, message: `WhatsApp API error: ${errMsg}` };
      }
      return { success: true, message: "WhatsApp credentials verified" };
    }

    if (row.channel === "sms") {
      const creds = JSON.parse(decrypt(row.credentials_encrypted)) as Record<string, string>;
      if (!creds.apiKey || !creds.apiSecret) {
        return { success: false, message: "Missing API key or secret" };
      }
      return { success: true, message: "SMS credentials present and well-formed" };
    }

    return { success: false, message: "Unknown channel" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export function getWebhookUrls(appUrl: string): Record<string, string> {
  return {
    ses_notification: `${appUrl}/webhook/ses`,
    whatsapp_verify: `${appUrl}/webhook/whatsapp`,
    whatsapp_events: `${appUrl}/webhook/whatsapp`,
    sms_delivery: `${appUrl}/webhook/sms/delivery`,
  };
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(
  orgId: string,
  channel?: string
): Promise<TemplateDTO[]> {
  const db = getDb();
  let q = db("templates").where("organisation_id", orgId).where("is_active", true);
  if (channel) q = q.where("channel", channel);
  const rows = await q.orderBy("created_at", "desc");
  return rows.map(rowToTemplateDTO);
}

export async function getTemplate(id: string, orgId: string): Promise<TemplateDTO> {
  const db = getDb();
  const row = await db("templates").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Template not found");
  return rowToTemplateDTO(row);
}

export async function createTemplate(
  orgId: string,
  createdBy: string,
  input: CreateTemplateInput
): Promise<TemplateDTO> {
  const db = getDb();
  const id = uuidv4();
  const variables = extractVariables(input.body);
  if (input.subject) variables.push(...extractVariables(input.subject));

  await db("templates").insert({
    id,
    organisation_id: orgId,
    channel: input.channel,
    name: input.name,
    subject: input.subject ?? null,
    body: input.body,
    variables: JSON.stringify([...new Set(variables)]),
    whatsapp_template_name: input.whatsappTemplateName ?? null,
    whatsapp_template_id: input.whatsappTemplateId ?? null,
    dlt_template_id: input.dltTemplateId ?? null,
    is_active: true,
    created_by: createdBy,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return getTemplate(id, orgId);
}

export async function updateTemplate(
  id: string,
  orgId: string,
  input: UpdateTemplateInput
): Promise<TemplateDTO> {
  const db = getDb();
  const existing = await db("templates").where({ id, organisation_id: orgId }).first();
  if (!existing) throw new NotFoundError("Template not found");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.body !== undefined) {
    updates.body = input.body;
    const vars = extractVariables(input.body);
    if (input.subject) vars.push(...extractVariables(input.subject));
    updates.variables = JSON.stringify([...new Set(vars)]);
  }
  if (input.whatsappTemplateName !== undefined) updates.whatsapp_template_name = input.whatsappTemplateName;
  if (input.whatsappTemplateId !== undefined) updates.whatsapp_template_id = input.whatsappTemplateId;
  if (input.dltTemplateId !== undefined) updates.dlt_template_id = input.dltTemplateId;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  await db("templates").where({ id, organisation_id: orgId }).update(updates);
  return getTemplate(id, orgId);
}

export async function deleteTemplate(id: string, orgId: string): Promise<void> {
  const db = getDb();
  const row = await db("templates").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Template not found");
  await db("templates").where({ id, organisation_id: orgId }).update({ is_active: false, updated_at: new Date() });
}
