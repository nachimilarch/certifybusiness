import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateOrgSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(100).regex(slugRegex, "Slug must be lowercase with hyphens only"),
  plan: z.enum(["starter", "growth", "enterprise"]).default("starter"),
  // First admin user created together with the org
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
  adminPassword: z.string().min(8),
});

export const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(["starter", "growth", "enterprise"]).optional(),
  settings: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type UpdateOrgInput = z.infer<typeof UpdateOrgSchema>;
