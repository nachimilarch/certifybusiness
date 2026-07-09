import { z } from "zod";

export const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "in", "not_in"]),
  value: z.union([z.string(), z.array(z.string())]),
});

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    title: z.string(),
    description: z.string().optional(),
    dueOffsetDays: z.number().int().min(0).default(1),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  }),
  z.object({
    type: z.literal("add_tag"),
    tag: z.string(),
  }),
  z.object({
    type: z.literal("change_status"),
    status: z.enum(["new", "contacted", "interested", "follow_up", "converted", "dead", "do_not_contact"]),
  }),
  z.object({
    type: z.literal("assign_to_user"),
    userId: z.string(),
  }),
  z.object({
    type: z.literal("send_notification"),
    targetUserId: z.string().optional(),
    title: z.string(),
    body: z.string(),
  }),
]);

export const CreateAutomationRuleSchema = z.object({
  name: z.string().min(1, "Required"),
  trigger: z.enum([
    "lead_created",
    "email_reply",
    "whatsapp_reply",
    "sms_reply",
    "call_logged",
    "no_activity",
    "status_changed",
    "tag_added",
  ]),
  conditions: z.array(ConditionSchema).optional().default([]),
  actions: z.array(ActionSchema).min(1, "At least one action required"),
});

export const UpdateAutomationRuleSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(ConditionSchema).optional(),
  actions: z.array(ActionSchema).min(1).optional(),
});

export type CreateAutomationRuleInput = z.infer<typeof CreateAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof UpdateAutomationRuleSchema>;
export type AutomationAction = z.infer<typeof ActionSchema>;
export type AutomationCondition = z.infer<typeof ConditionSchema>;
