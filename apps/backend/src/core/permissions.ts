import type { UserRole, UserPermissions } from "./types";

const ALL_TRUE: UserPermissions = {
  upload_calling_data: true,
  log_calls: true,
  upload_email_data: true,
  send_email_campaigns: true,
  upload_whatsapp_data: true,
  send_whatsapp_campaigns: true,
  upload_sms_data: true,
  send_sms_campaigns: true,
  view_assigned_leads: true,
  view_team_leads: true,
  view_all_leads: true,
  export_data: true,
  view_reports: true,
  manage_users: true,
  manage_templates: true,
  manage_sender_identities: true,
  manage_automation: true,
  manage_org_settings: true,
};

export const ROLE_DEFAULTS: Record<UserRole, UserPermissions> = {
  super_admin: { ...ALL_TRUE },
  admin: { ...ALL_TRUE },
  manager: {
    upload_calling_data: true,
    log_calls: true,
    upload_email_data: true,
    send_email_campaigns: true,
    upload_whatsapp_data: true,
    send_whatsapp_campaigns: true,
    upload_sms_data: true,
    send_sms_campaigns: true,
    view_assigned_leads: true,
    view_team_leads: true,
    view_all_leads: false,
    export_data: true,
    view_reports: true,
    manage_users: false,
    manage_templates: true,
    manage_sender_identities: false,
    manage_automation: true,
    manage_org_settings: false,
  },
  employee: {
    upload_calling_data: false,
    log_calls: true,
    upload_email_data: false,
    send_email_campaigns: false,
    upload_whatsapp_data: false,
    send_whatsapp_campaigns: false,
    upload_sms_data: false,
    send_sms_campaigns: false,
    view_assigned_leads: true,
    view_team_leads: false,
    view_all_leads: false,
    export_data: false,
    view_reports: false,
    manage_users: false,
    manage_templates: false,
    manage_sender_identities: false,
    manage_automation: false,
    manage_org_settings: false,
  },
};

/** Merge role defaults with per-user JSON overrides stored in the DB. */
export function computeEffectivePermissions(
  role: UserRole,
  overrides: UserPermissions | null
): UserPermissions {
  if (role === "super_admin" || role === "admin") return { ...ALL_TRUE };
  const defaults = ROLE_DEFAULTS[role];
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}
