import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../core/database";
import { getQueue, Queues } from "../../queues";
import { NotFoundError } from "../../core/errors";
import type { CreateAutomationRuleInput, UpdateAutomationRuleInput, AutomationCondition, AutomationAction } from "./automation.schema";
import type { AutomationTrigger } from "../../core/types";

export interface AutomationRuleDTO {
  id: string;
  organisationId: string;
  name: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationJobData {
  trigger: AutomationTrigger;
  orgId: string;
  context: {
    leadId?: string;
    actorId?: string;
    campaignId?: string;
    extra?: Record<string, unknown>;
  };
}

function toDTO(row: any): AutomationRuleDTO {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    isActive: Boolean(row.is_active),
    trigger: row.trigger_type,           // DB column is trigger_type
    conditions: typeof row.conditions === "string" ? JSON.parse(row.conditions) : (row.conditions ?? []),
    actions: typeof row.actions === "string" ? JSON.parse(row.actions) : (row.actions ?? []),
    runCount: row.run_count ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRules(orgId: string): Promise<AutomationRuleDTO[]> {
  const db = getDb();
  const rows = await db("automation_rules")
    .where("organisation_id", orgId)
    .orderBy("created_at", "asc");
  return rows.map(toDTO);
}

export async function getRule(orgId: string, id: string): Promise<AutomationRuleDTO> {
  const db = getDb();
  const row = await db("automation_rules").where({ id, organisation_id: orgId }).first();
  if (!row) throw new NotFoundError("Automation rule");
  return toDTO(row);
}

export async function createRule(
  orgId: string,
  createdBy: string,
  input: CreateAutomationRuleInput
): Promise<AutomationRuleDTO> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date();
  await db("automation_rules").insert({
    id,
    organisation_id: orgId,
    name: input.name,
    is_active: 1,
    trigger_type: input.trigger,
    conditions: JSON.stringify(input.conditions),
    actions: JSON.stringify(input.actions),
    run_count: 0,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  });
  return getRule(orgId, id);
}

export async function updateRule(
  orgId: string,
  id: string,
  input: UpdateAutomationRuleInput
): Promise<AutomationRuleDTO> {
  const db = getDb();
  const existing = await db("automation_rules").where({ id, organisation_id: orgId }).first();
  if (!existing) throw new NotFoundError("Automation rule");

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.isActive !== undefined) updates.is_active = input.isActive ? 1 : 0;
  if (input.conditions !== undefined) updates.conditions = JSON.stringify(input.conditions);
  if (input.actions !== undefined) updates.actions = JSON.stringify(input.actions);

  await db("automation_rules").where({ id, organisation_id: orgId }).update(updates);
  return getRule(orgId, id);
}

export async function deleteRule(orgId: string, id: string): Promise<void> {
  const db = getDb();
  const deleted = await db("automation_rules").where({ id, organisation_id: orgId }).delete();
  if (!deleted) throw new NotFoundError("Automation rule");
}

// ─── Trigger helper ───────────────────────────────────────────────────────────

export async function fireTrigger(
  trigger: AutomationTrigger,
  orgId: string,
  context: AutomationJobData["context"]
): Promise<void> {
  try {
    const q = getQueue(Queues.AUTOMATION);
    await q.add("evaluate", { trigger, orgId, context } satisfies AutomationJobData, {
      attempts: 2,
      removeOnComplete: { count: 500 },
    });
  } catch {
    // Never let automation failure block the main flow
  }
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

function evaluateCondition(condition: AutomationCondition, lead: Record<string, unknown>): boolean {
  const fieldValue = String(lead[condition.field] ?? "").toLowerCase();
  const cmpValue = typeof condition.value === "string"
    ? condition.value.toLowerCase()
    : (condition.value as string[]).map((v) => v.toLowerCase());

  switch (condition.operator) {
    case "equals":
      return fieldValue === cmpValue;
    case "not_equals":
      return fieldValue !== cmpValue;
    case "contains":
      return fieldValue.includes(cmpValue as string);
    case "in":
      return (cmpValue as string[]).includes(fieldValue);
    case "not_in":
      return !(cmpValue as string[]).includes(fieldValue);
    default:
      return true;
  }
}

export interface AutomationLogDTO {
  id: string;
  ruleId: string;
  ruleName: string;
  organisationId: string;
  leadId: string | null;
  triggerData: Record<string, unknown>;
  actionsExecuted: AutomationAction[];
  status: "success" | "partial" | "failed";
  errorMessage: string | null;
  executedAt: string;
}

export async function listLogs(
  orgId: string,
  page: number,
  limit: number
): Promise<{ logs: AutomationLogDTO[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db("automation_logs as al")
      .leftJoin("automation_rules as ar", "ar.id", "al.rule_id")
      .where("al.organisation_id", orgId)
      .orderBy("al.executed_at", "desc")
      .limit(limit)
      .offset(offset)
      .select("al.*", "ar.name as rule_name"),
    db("automation_logs").where("organisation_id", orgId).count("id as total"),
  ]);

  const logs: AutomationLogDTO[] = rows.map((r: any) => ({
    id: r.id,
    ruleId: r.rule_id,
    ruleName: r.rule_name ?? "Deleted rule",
    organisationId: r.organisation_id,
    leadId: r.lead_id ?? null,
    triggerData: typeof r.trigger_data === "string" ? JSON.parse(r.trigger_data) : (r.trigger_data ?? {}),
    actionsExecuted: typeof r.actions_executed === "string" ? JSON.parse(r.actions_executed) : (r.actions_executed ?? []),
    status: r.status,
    errorMessage: r.error_message ?? null,
    executedAt: new Date(r.executed_at).toISOString(),
  }));

  return { logs, total: Number(total) };
}

export async function evaluateAndRun(job: AutomationJobData): Promise<void> {
  const db = getDb();
  const { trigger, orgId, context } = job;

  const rules = await db("automation_rules").where({
    organisation_id: orgId,
    trigger_type: trigger,
    is_active: 1,
  });

  if (rules.length === 0) return;

  // Load lead context if available
  let lead: Record<string, unknown> = {};
  if (context.leadId) {
    const row = await db("leads").where({ id: context.leadId, organisation_id: orgId }).first();
    if (row) {
      lead = {
        status: row.status,
        source: row.source,
        tags: typeof row.tags === "string" ? JSON.parse(row.tags) : (row.tags ?? []),
        assigned_to: row.assigned_to ?? null,
        company: row.company ?? null,
      };
    }
  }

  for (const ruleRow of rules) {
    const conditions: AutomationCondition[] =
      typeof ruleRow.conditions === "string"
        ? JSON.parse(ruleRow.conditions)
        : (ruleRow.conditions ?? []);

    const actions: AutomationAction[] =
      typeof ruleRow.actions === "string"
        ? JSON.parse(ruleRow.actions)
        : (ruleRow.actions ?? []);

    const passes = conditions.every((c) => evaluateCondition(c, lead));
    if (!passes) continue;

    const executedActions: AutomationAction[] = [];
    let status: "success" | "partial" | "failed" = "success";
    let errorMessage: string | null = null;
    const now = new Date();

    for (const action of actions) {
      try {
        await executeAction(action, db, orgId, context);
        executedActions.push(action);
      } catch (err) {
        status = executedActions.length > 0 ? "partial" : "failed";
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    await Promise.all([
      db("automation_rules").where("id", ruleRow.id).update({ run_count: db.raw("run_count + 1") }),
      db("automation_logs").insert({
        id: uuidv4(),
        rule_id: ruleRow.id,
        organisation_id: orgId,
        lead_id: context.leadId ?? null,
        trigger_data: JSON.stringify({ trigger, context }),
        actions_executed: JSON.stringify(executedActions),
        status,
        error_message: errorMessage,
        executed_at: now,
        created_at: now,
      }),
    ]);
  }
}

async function executeAction(
  action: AutomationAction,
  db: ReturnType<typeof getDb>,
  orgId: string,
  context: AutomationJobData["context"]
): Promise<void> {
  const leadId = context.leadId;
  const now = new Date();

  if (action.type === "add_tag" && leadId) {
    const lead = await db("leads").where({ id: leadId }).first();
    if (!lead) return;
    const tags: string[] = typeof lead.tags === "string" ? JSON.parse(lead.tags) : (lead.tags ?? []);
    if (!tags.includes(action.tag)) {
      tags.push(action.tag);
      await db("leads").where("id", leadId).update({ tags: JSON.stringify(tags), updated_at: now });
      await db("lead_activities").insert({
        id: uuidv4(),
        lead_id: leadId,
        organisation_id: orgId,
        user_id: null,
        type: "general",
        subject: `Automation: tag "${action.tag}" added`,
        body: null,
        metadata: JSON.stringify({ tag: action.tag, automation: true }),
        created_at: now,
      });
    }
  }

  if (action.type === "change_status" && leadId) {
    await db("leads")
      .where({ id: leadId })
      .update({ status: action.status, last_activity_at: now, updated_at: now });
    await db("lead_activities").insert({
      id: uuidv4(),
      lead_id: leadId,
      organisation_id: orgId,
      user_id: null,
      type: "status_change",
      subject: `Automation: status changed to ${action.status}`,
      body: null,
      metadata: JSON.stringify({ to: action.status, automation: true }),
      created_at: now,
    });
  }

  if (action.type === "assign_to_user" && leadId) {
    await db("leads")
      .where({ id: leadId })
      .update({ assigned_to: action.userId, last_activity_at: now, updated_at: now });
    await db("lead_activities").insert({
      id: uuidv4(),
      lead_id: leadId,
      organisation_id: orgId,
      user_id: null,
      type: "general",
      subject: `Automation: lead assigned to user`,
      body: null,
      metadata: JSON.stringify({ assigned_to: action.userId, automation: true }),
      created_at: now,
    });
  }

  if (action.type === "create_task" && leadId) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + action.dueOffsetDays);
    const lead = await db("leads").where({ id: leadId }).first();
    await db("tasks").insert({
      id: uuidv4(),
      organisation_id: orgId,
      lead_id: leadId,
      assigned_to: lead?.assigned_to ?? context.actorId ?? null,
      title: action.title,
      description: action.description ?? null,
      due_at: dueAt,
      type: "follow_up",
      priority: action.priority ?? "medium",
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  if (action.type === "send_notification") {
    const targetUserId = action.targetUserId ?? context.actorId;
    if (!targetUserId) return;
    const q = getQueue(Queues.NOTIFICATIONS);
    await q.add(
      "notify",
      {
        orgId,
        userId: targetUserId,
        type: "system" as const,
        title: action.title,
        body: action.body,
        metadata: { leadId, trigger: context.extra?.trigger },
      },
      { removeOnComplete: { count: 1000 } }
    );
  }
}
