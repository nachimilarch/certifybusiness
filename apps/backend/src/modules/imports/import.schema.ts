import { z } from "zod";

export const UploadListQuerySchema = z.object({
  channel: z.enum(["calling", "email", "whatsapp", "sms"]),
  name: z.string().min(1).max(255),
});

export const ListContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  isValid: z.enum(["true", "false"]).optional(),
  isSuppressed: z.enum(["true", "false"]).optional(),
});

export const AllContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  listId: z.string().min(1).optional(),
  channel: z.enum(["calling", "email", "whatsapp", "sms"]).optional(),
  isValid: z.enum(["true", "false"]).optional(),
  isSuppressed: z.enum(["true", "false"]).optional(),
});

export const ListUploadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.enum(["calling", "email", "whatsapp", "sms"]).optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected", "auto_approved"]).optional(),
});

export const ApproveUploadSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    rejectionReason: z.string().min(5).max(500).optional(),
  })
  .refine((d) => !(d.action === "reject" && !d.rejectionReason), {
    message: "Rejection reason is required when rejecting an upload",
    path: ["rejectionReason"],
  });
