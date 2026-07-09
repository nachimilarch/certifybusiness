import { z } from "zod";

// ─── Sender Identities ────────────────────────────────────────────────────────

export const CreateSenderIdentitySchema = z.object({
  channel: z.enum(["email", "whatsapp", "sms"]),
  name: z.string().min(1).max(255),
  // Email
  fromAddress: z.string().email().optional().nullable(),
  // WhatsApp
  whatsappNumber: z.string().optional().nullable(),
  whatsappWabaId: z.string().optional().nullable(),
  whatsappPhoneNumberId: z.string().optional().nullable(),
  // SMS
  smsSenderId: z.string().max(11).optional().nullable(),
  // Credentials (will be encrypted): JSON object
  credentials: z.record(z.string()).optional().nullable(),
});

export const UpdateSenderIdentitySchema = CreateSenderIdentitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Templates ────────────────────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  channel: z.enum(["email", "whatsapp", "sms"]),
  name: z.string().min(1).max(255),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().min(1),
  // WhatsApp specific
  whatsappTemplateName: z.string().optional().nullable(),
  whatsappTemplateId: z.string().optional().nullable(),
  // SMS DLT
  dltTemplateId: z.string().optional().nullable(),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateSenderIdentityInput = z.infer<typeof CreateSenderIdentitySchema>;
export type UpdateSenderIdentityInput = z.infer<typeof UpdateSenderIdentitySchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
