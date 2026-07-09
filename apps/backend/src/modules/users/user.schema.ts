import { z } from "zod";

const PermissionsSchema = z
  .object({
    upload_calling_data: z.boolean().optional(),
    log_calls: z.boolean().optional(),
    upload_email_data: z.boolean().optional(),
    send_email_campaigns: z.boolean().optional(),
    upload_whatsapp_data: z.boolean().optional(),
    send_whatsapp_campaigns: z.boolean().optional(),
    upload_sms_data: z.boolean().optional(),
    send_sms_campaigns: z.boolean().optional(),
    view_assigned_leads: z.boolean().optional(),
    view_team_leads: z.boolean().optional(),
    view_all_leads: z.boolean().optional(),
    export_data: z.boolean().optional(),
    view_reports: z.boolean().optional(),
    manage_users: z.boolean().optional(),
    manage_templates: z.boolean().optional(),
    manage_sender_identities: z.boolean().optional(),
    manage_automation: z.boolean().optional(),
    manage_org_settings: z.boolean().optional(),
  })
  .optional();

export const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8, "Minimum 8 characters"),
  role: z.enum(["admin", "manager", "employee"]),
  designationId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  permissions: PermissionsSchema,
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  designationId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  permissions: PermissionsSchema,
  isActive: z.boolean().optional(),
});

export const AdminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Minimum 8 characters"),
});

export const UserListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  managerId: z.string().optional(),
});

// ─── Designations ─────────────────────────────────────────────────────────────

export const CreateDesignationSchema = z.object({
  name: z.string().min(1).max(100),
});

// ─── Permission Templates ────────────────────────────────────────────────────

export const CreatePermissionTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: PermissionsSchema.unwrap().required(),
});

export const UpdatePermissionTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: PermissionsSchema.unwrap().optional(),
});

export const ApplyTemplateSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

// ─── Teams ───────────────────────────────────────────────────────────────────

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  managerId: z.string().uuid().optional().nullable(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  managerId: z.string().uuid().optional().nullable(),
});

export const AddTeamMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateDesignationInput = z.infer<typeof CreateDesignationSchema>;
export type CreatePermissionTemplateInput = z.infer<typeof CreatePermissionTemplateSchema>;
export type UpdatePermissionTemplateInput = z.infer<typeof UpdatePermissionTemplateSchema>;
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
