import { z } from "zod";

const phoneSchema = z.object({
  phone: z.string().min(5).max(20),
  isPrimary: z.boolean().default(false),
  isWhatsapp: z.boolean().default(false),
});

const emailSchema = z.object({
  email: z.string().email(),
  isPrimary: z.boolean().default(false),
});

export const CreateLeadSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional().nullable(),
  designation: z.string().max(255).optional().nullable(),
  source: z.enum([
    "cold_call",
    "cold_email",
    "whatsapp",
    "sms",
    "website_inbound",
    "manual",
  ]).default("manual"),
  status: z.enum([
    "new",
    "contacted",
    "interested",
    "follow_up",
    "converted",
    "dead",
    "do_not_contact",
  ]).default("new"),
  assignedTo: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
  phones: z.array(phoneSchema).optional().default([]),
  emails: z.array(emailSchema).optional().default([]),
});

export const UpdateLeadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional().nullable(),
  designation: z.string().max(255).optional().nullable(),
  source: z
    .enum(["cold_call", "cold_email", "whatsapp", "sms", "website_inbound", "manual"])
    .optional(),
  status: z
    .enum([
      "new",
      "contacted",
      "interested",
      "follow_up",
      "converted",
      "dead",
      "do_not_contact",
    ])
    .optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export const LeadListQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum([
      "new",
      "contacted",
      "interested",
      "follow_up",
      "converted",
      "dead",
      "do_not_contact",
    ])
    .optional(),
  source: z
    .enum(["cold_call", "cold_email", "whatsapp", "sms", "website_inbound", "manual"])
    .optional(),
  assignedTo: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
});

export const AddNoteSchema = z.object({
  body: z.string().min(1).max(5000),
  followUpAt: z.string().datetime().optional().nullable(),
});

export const AddPhoneSchema = z.object({
  phone: z.string().min(5).max(20),
  isPrimary: z.boolean().default(false),
  isWhatsapp: z.boolean().default(false),
});

export const AddEmailSchema = z.object({
  email: z.string().email(),
  isPrimary: z.boolean().default(false),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  type: z
    .enum(["call", "email", "whatsapp", "sms", "follow_up", "general"])
    .default("general"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignedTo: z.string().uuid().optional().nullable(),
});

export const AssignLeadSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type AddNoteInput = z.infer<typeof AddNoteSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
