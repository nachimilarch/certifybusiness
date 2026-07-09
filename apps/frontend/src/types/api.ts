// Mirror of backend DTOs — keep in sync when backend changes

// ─── Enums ───────────────────────────────────────────────────────────────────

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

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "busy"
  | "wrong_number"
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "do_not_call";

export type QueueStatus =
  | "not_called"
  | "follow_up_due"
  | "follow_up_today"
  | "in_progress"
  | "done";

// ─── Lead DTOs ────────────────────────────────────────────────────────────────

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
  lastActivityAt: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  leadId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  type: string;
  priority: string;
  createdAt: string;
}

export interface LeadFullDTO extends LeadDTO {
  phones: PhoneDTO[];
  emails: EmailDTO[];
  activities: ActivityDTO[];
  tasks: TaskDTO[];
}

// ─── Calling DTOs ─────────────────────────────────────────────────────────────

export interface CallLogDTO {
  id: string;
  userId: string;
  userName: string;
  leadId: string | null;
  uploadedContactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  calledAt: string;
  durationSeconds: number;
  outcome: CallOutcome;
  followUpAt: string | null;
  notes: string | null;
  convertedToLead: boolean;
  createdAt: string;
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
  queueStatus: QueueStatus;
  lastOutcome: CallOutcome | null;
  lastCalledAt: string | null;
  followUpAt: string | null;
  lastNotes: string | null;
}

export interface FollowUpDTO {
  id: string;
  contactName: string;
  contactPhone: string | null;
  leadId: string | null;
  leadName: string | null;
  followUpAt: string;
  lastOutcome: CallOutcome;
  notes: string | null;
  isOverdue: boolean;
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────

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
  followUps: { overdue: number; dueToday: number };
  tasks: { overdue: number; dueToday: number };
}

export type UserRole = "super_admin" | "admin" | "manager" | "employee";

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

export interface AuthUser {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: UserPermissions;
  designationName?: string;
}

export interface UserDTO {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  designationId: string | null;
  designationName: string | null;
  managerId: string | null;
  managerName: string | null;
  permissions: UserPermissions;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationDTO {
  id: string;
  name: string;
  created_at: string;
}

export interface PermissionTemplateDTO {
  id: string;
  name: string;
  permissions: UserPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDTO {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDetailDTO extends Omit<TeamDTO, "memberCount"> {
  members: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
    designation_name: string | null;
  }>;
}

export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  user_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Channel DTOs ─────────────────────────────────────────────────────────────

export type ChannelType = "email" | "whatsapp" | "sms";

export interface SenderIdentityDTO {
  id: string;
  organisationId: string;
  channel: ChannelType;
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
  channel: ChannelType;
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

// ─── Campaign DTOs ────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "failed";

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
  channel: ChannelType;
  senderIdentityId: string | null;
  senderName: string | null;
  listId: string | null;
  listName: string | null;
  status: CampaignStatus;
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

// ─── Import DTOs ──────────────────────────────────────────────────────────────

export type ImportChannel = "calling" | "email" | "whatsapp" | "sms";
export type ImportStatus = "pending" | "processing" | "completed" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

export interface UploadedListDTO {
  id: string;
  organisationId: string;
  uploadedBy: string;
  uploadedByName: string;
  name: string;
  channel: ImportChannel;
  originalFilename: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  suppressedRows: number;
  status: ImportStatus;
  approvalStatus: ApprovalStatus;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface UploadedContactDTO {
  id: string;
  listId: string;
  rowNumber: number | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  company: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  extraData: Record<string, string> | null;
  isValid: boolean;
  validationErrors: string[] | null;
  isSuppressed: boolean;
  isDuplicate: boolean;
  leadId: string | null;
}

export interface ContactWithListDTO extends UploadedContactDTO {
  listName: string;
  listChannel: ImportChannel;
  listOriginalFilename: string | null;
}

// ─── Notification DTOs ────────────────────────────────────────────────────────

export type NotificationType =
  | "new_lead"
  | "lead_assigned"
  | "reply_received"
  | "follow_up_due"
  | "campaign_complete"
  | "task_due"
  | "system";

export interface NotificationDTO {
  id: string;
  organisationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

// ─── Automation DTOs ──────────────────────────────────────────────────────────

export type AutomationTrigger =
  | "lead_created"
  | "email_reply"
  | "whatsapp_reply"
  | "sms_reply"
  | "call_logged"
  | "no_activity"
  | "status_changed"
  | "tag_added";

export interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "in" | "not_in";
  value: string | string[];
}

export type AutomationAction =
  | { type: "create_task"; title: string; description?: string; dueOffsetDays: number; priority: "low" | "medium" | "high" }
  | { type: "add_tag"; tag: string }
  | { type: "change_status"; status: string }
  | { type: "assign_to_user"; userId: string }
  | { type: "send_notification"; targetUserId?: string; title: string; body: string };

export interface AutomationRuleDTO {
  id: string;
  organisationId: string;
  name: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Automation logs ──────────────────────────────────────────────────────────

export interface AutomationLogDTO {
  id: string;
  ruleId: string;
  ruleName: string;
  organisationId: string;
  leadId: string | null;
  triggerData: Record<string, unknown>;
  actionsExecuted: AutomationAction[];
  status: "success" | "partial" | "failed";
  errorMessage: string | null;
  executedAt: string;
}

// ─── Reporting DTOs ───────────────────────────────────────────────────────────

export interface CampaignSummaryItem {
  id: string;
  name: string;
  channel: ChannelType;
  status: CampaignStatus;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  repliedCount: number;
  bouncedCount: number;
  openedCount: number;
  createdAt: string;
}

export interface CampaignSummaryStats {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalReplied: number;
  campaigns: CampaignSummaryItem[];
}

export interface LeadsByChannelItem {
  source: string;
  count: number;
}

export interface LeadsByEmployeeItem {
  userId: string;
  name: string;
  count: number;
}

export interface ConversionFunnelItem {
  status: string;
  count: number;
}

export interface CallActivityItem {
  userId: string;
  name: string;
  total: number;
  byOutcome: Record<string, number>;
}

// ─── Inbox / Conversations ────────────────────────────────────────────────────

export type ConversationStatus = "open" | "awaiting_employee" | "awaiting_customer" | "closed";
export type ConversationSource = "cold_email_reply" | "whatsapp_reply" | "sms_reply" | "manual" | "inbound_email";

export interface ConversationDTO {
  id: string;
  organisationId: string;
  channel: ChannelType;
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
  status: ConversationStatus;
  source: ConversationSource;
  subject: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  messageCount: number;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageDTO {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  channel: ChannelType;
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

// ─── Audit Log ────────────────────────────────────────────────────────────────

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

// API response wrappers
export interface ApiOk<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  errors?: Array<{ path: string; message: string }>;
}
