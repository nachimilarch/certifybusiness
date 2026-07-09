import { z } from "zod";

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  channel: z.enum(["email", "whatsapp", "sms"]),
  senderIdentityId: z.string().uuid().optional().nullable(),
  listId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
  steps: z.array(
    z.object({
      stepNumber: z.number().int().min(1),
      templateId: z.string().uuid().optional().nullable(),
      subject: z.string().max(500).optional().nullable(),
      body: z.string().optional().nullable(),
      delayDays: z.number().int().min(0).default(0),
      delayHours: z.number().int().min(0).default(0),
    })
  ).min(1, "At least one step is required"),
});

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  senderIdentityId: z.string().uuid().optional().nullable(),
  listId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
});

export const LaunchCampaignSchema = z.object({
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type LaunchCampaignInput = z.infer<typeof LaunchCampaignSchema>;
