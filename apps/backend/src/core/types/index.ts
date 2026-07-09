// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "manager" | "employee";

export type LeadSource =
  | "cold_call"
  | "cold_email"
  | "whatsapp"
  | "sms"
  | "website_inbound"
  | "manual";

export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "follow_up"
  | "converted"
  | "dead"
  | "do_not_contact";

export type ActivityType =
  | "call"
  | "email_sent"
  | "email_reply"
  | "whatsapp_sent"
  | "whatsapp_reply"
  | "sms_sent"
  | "sms_reply"
  | "note"
  | "task"
  | "status_change"
  | "assignment";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type Channel = "email" | "whatsapp" | "sms" | "calling";

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "busy"
  | "wrong_number"
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "do_not_call";

export type SuppressionReason =
  | "unsubscribe"
  | "bounce"
  | "do_not_contact"
  | "opt_out"
  | "spam_complaint"
  | "manual";

export type NotificationType =
  | "new_lead"
  | "lead_assigned"
  | "reply_received"
  | "follow_up_due"
  | "campaign_complete"
  | "task_due"
  | "system";

export type AutomationTrigger =
  | "lead_created"
  | "email_reply"
  | "whatsapp_reply"
  | "sms_reply"
  | "call_logged"
  | "no_activity"
  | "status_changed"
  | "tag_added";

// ─── Permission keys ──────────────────────────────────────────────────────────

export interface UserPermissions {
  upload_calling_data?: boolean;
  log_calls?: boolean;
  upload_email_data?: boolean;
  send_email_campaigns?: boolean;
  upload_whatsapp_data?: boolean;
  send_whatsapp_campaigns?: boolean;
  upload_sms_data?: boolean;
  send_sms_campaigns?: boolean;
  view_assigned_leads?: boolean;
  view_team_leads?: boolean;
  view_all_leads?: boolean;
  export_data?: boolean;
  view_reports?: boolean;
  manage_users?: boolean;
  manage_templates?: boolean;
  manage_sender_identities?: boolean;
  manage_automation?: boolean;
  manage_org_settings?: boolean;
}

// ─── DB row shapes (raw DB results) ──────────────────────────────────────────

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: 0 | 1;
  settings: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow {
  id: string;
  organisation_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  designation_id: string | null;
  manager_id: string | null;
  permissions: string | null;
  is_active: 0 | 1;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LeadRow {
  id: string;
  organisation_id: string;
  assigned_to: string | null;
  name: string;
  company: string | null;
  designation: string | null;
  source: LeadSource;
  status: LeadStatus;
  tags: string | null;
  notes: string | null;
  last_activity_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── Express request extensions ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  organisationId: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      organisationId?: string;
    }
  }
}
