import { z } from "zod";

export const LogCallSchema = z.object({
  uploadedContactId: z.string().uuid().optional().nullable(),
  calledPhone: z.string().min(5).max(20).optional(),
  calledAt: z.string().datetime({ offset: true }).optional(),
  durationSeconds: z.number().int().min(0).default(0),
  outcome: z.enum([
    "connected",
    "no_answer",
    "busy",
    "wrong_number",
    "callback_requested",
    "interested",
    "not_interested",
    "do_not_call",
  ]),
  followUpAt: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(3000).optional().nullable(),
  convertToLead: z.boolean().default(false),
});

export const CallQueueQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  listId: z.string().uuid().optional(),
  status: z
    .enum(["all", "not_called", "follow_up_due", "in_progress", "done"])
    .optional()
    .default("all"),
});

export const CallLogQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  userId: z.string().uuid().optional(),
  outcome: z
    .enum([
      "connected",
      "no_answer",
      "busy",
      "wrong_number",
      "callback_requested",
      "interested",
      "not_interested",
      "do_not_call",
    ])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type LogCallInput = z.infer<typeof LogCallSchema>;
