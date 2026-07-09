import { z } from "zod";

export const ListAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  resourceType: z.string().min(1).optional(),
  from: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date").optional(),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date").optional(),
});
