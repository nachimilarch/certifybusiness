import { z } from "zod";

export const ListConversationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  channel: z.enum(["email", "whatsapp", "sms"]).optional(),
  status: z.enum(["open", "awaiting_employee", "awaiting_customer", "closed"]).optional(),
  ownerUserId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  unassigned: z.enum(["true", "false"]).optional(),
  search: z.string().max(200).optional(),
});

export const ReplySchema = z.object({
  body: z.string().min(1).max(100_000),
  bodyHtml: z.string().max(500_000).optional().nullable(),
});

export const AssignSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export type ListConversationsInput = z.infer<typeof ListConversationsSchema>;
export type ReplyInput = z.infer<typeof ReplySchema>;
export type AssignInput = z.infer<typeof AssignSchema>;
