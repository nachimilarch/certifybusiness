"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import {
  useAutomationRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useAutomationLogs,
} from "../../../hooks/useAutomation";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { PageSpinner } from "../../../components/ui/Spinner";
import { Tabs, TabList, Tab, TabPanel } from "../../../components/ui/Tabs";
import { isAxiosError } from "axios";
import type { AutomationRuleDTO, AutomationTrigger, AutomationLogDTO } from "../../../types/api";

// ─── Options ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  lead_created: "Lead Created",
  email_reply: "Email Reply Received",
  whatsapp_reply: "WhatsApp Reply Received",
  sms_reply: "SMS Reply Received",
  call_logged: "Call Logged",
  no_activity: "No Activity (7 days)",
  status_changed: "Status Changed",
  tag_added: "Tag Added",
};

const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));

const ACTION_TYPE_OPTIONS = [
  { value: "add_tag", label: "Add Tag" },
  { value: "change_status", label: "Change Status" },
  { value: "create_task", label: "Create Task" },
  { value: "assign_to_user", label: "Assign to User" },
  { value: "send_notification", label: "Send Notification" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "interested", label: "Interested" },
  { value: "follow_up", label: "Follow Up" },
  { value: "converted", label: "Converted" },
  { value: "dead", label: "Dead" },
  { value: "do_not_contact", label: "Do Not Contact" },
];

// ─── Form schema ──────────────────────────────────────────────────────────────

const actionSchema = z.object({
  type: z.string(),
  tag: z.string().optional(),
  status: z.string().optional(),
  title: z.string().optional(),
  dueOffsetDays: z.coerce.number().int().min(0).default(1),
  priority: z.string().optional(),
  userId: z.string().optional(),
  targetUserId: z.string().optional(),
  notificationTitle: z.string().optional(),
  body: z.string().optional(),
});

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  trigger: z.string().min(1, "Required"),
  actions: z.array(actionSchema).min(1, "At least one action"),
});
type FormValues = z.infer<typeof formSchema>;

// ─── Logs panel ───────────────────────────────────────────────────────────────

const LOG_STATUS_CONFIG = {
  success: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, cls: "text-green-700 bg-green-50" },
  partial: { icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, cls: "text-yellow-700 bg-yellow-50" },
  failed: { icon: <XCircle className="h-4 w-4 text-red-500" />, cls: "text-red-700 bg-red-50" },
};

function LogsPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAutomationLogs(page);

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  }

  return (
    <div className="card overflow-hidden">
      {isLoading ? (
        <PageSpinner />
      ) : (
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Rule", "Status", "Actions Ran", "Lead", "Executed At"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data?.data.map((log: AutomationLogDTO) => {
              const cfg = LOG_STATUS_CONFIG[log.status];
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{log.ruleName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                      {cfg.icon} {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.actionsExecuted.length}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {log.leadId ? log.leadId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(log.executedAt)}</td>
                </tr>
              );
            })}
            {data?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No automation runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {data && data.meta.pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">
            Page {page} of {data.meta.pages} · {data.meta.total} total
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button variant="secondary" size="sm" disabled={page === data.meta.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AutomationRuleDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRuleDTO | null>(null);
  const [apiError, setApiError] = useState("");

  const { data: rules, isLoading } = useAutomationRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { trigger: "lead_created", actions: [{ type: "add_tag", dueOffsetDays: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "actions" });

  function openCreate() {
    form.reset({ trigger: "lead_created", actions: [{ type: "add_tag", dueOffsetDays: 1 }] });
    setApiError("");
    setCreateOpen(true);
  }

  function openEdit(rule: AutomationRuleDTO) {
    setEditTarget(rule);
    form.reset({
      name: rule.name,
      trigger: rule.trigger,
      actions: rule.actions.map((a) => ({
        type: a.type,
        tag: a.type === "add_tag" ? a.tag : undefined,
        status: a.type === "change_status" ? a.status : undefined,
        title: a.type === "create_task" ? a.title : undefined,
        dueOffsetDays: a.type === "create_task" ? a.dueOffsetDays : 1,
        priority: a.type === "create_task" ? a.priority : undefined,
        userId: a.type === "assign_to_user" ? a.userId : undefined,
        targetUserId: a.type === "send_notification" ? (a.targetUserId ?? "") : undefined,
        notificationTitle: a.type === "send_notification" ? a.title : undefined,
        body: a.type === "send_notification" ? a.body : undefined,
      })),
    });
    setApiError("");
  }

  function buildActions(values: FormValues) {
    return values.actions.map((a) => {
      if (a.type === "add_tag") return { type: "add_tag" as const, tag: a.tag ?? "" };
      if (a.type === "change_status") return { type: "change_status" as const, status: a.status ?? "new" };
      if (a.type === "create_task")
        return {
          type: "create_task" as const,
          title: a.title ?? "Follow up",
          dueOffsetDays: a.dueOffsetDays ?? 1,
          priority: (a.priority ?? "medium") as "low" | "medium" | "high",
        };
      if (a.type === "assign_to_user") return { type: "assign_to_user" as const, userId: a.userId ?? "" };
      return {
        type: "send_notification" as const,
        targetUserId: a.targetUserId || undefined,
        title: a.notificationTitle ?? "Notification",
        body: a.body ?? "",
      };
    });
  }

  async function handleSubmit(values: FormValues) {
    setApiError("");
    try {
      const payload = {
        name: values.name,
        trigger: values.trigger as AutomationTrigger,
        conditions: [],
        actions: buildActions(values),
      };
      if (editTarget) {
        await updateRule.mutateAsync({ id: editTarget.id, data: payload });
        setEditTarget(null);
      } else {
        await createRule.mutateAsync(payload);
        setCreateOpen(false);
      }
      form.reset();
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleToggle(rule: AutomationRuleDTO) {
    await updateRule.mutateAsync({ id: rule.id, data: { isActive: !rule.isActive } });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRule.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const isOpen = createOpen || !!editTarget;
  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
          <p className="text-sm text-gray-500 mt-1">Rules that fire automatically based on CRM events</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          New Rule
        </Button>
      </div>

      <Tabs defaultTab="rules">
        <TabList className="mb-5">
          <Tab id="rules">Rules</Tab>
          <Tab id="logs">Execution Log</Tab>
        </TabList>

        <TabPanel id="rules">
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-3">
          {rules?.map((rule) => (
            <div key={rule.id} className="card p-4 flex items-start gap-4">
              <div className={`mt-0.5 flex-shrink-0 rounded-lg p-2 ${rule.isActive ? "bg-brand-50" : "bg-gray-100"}`}>
                <Zap className={`h-5 w-5 ${rule.isActive ? "text-brand-600" : "text-gray-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{rule.name}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium">Trigger:</span> {TRIGGER_LABELS[rule.trigger]}
                  {" · "}
                  <span className="font-medium">Actions:</span> {rule.actions.length}
                  {rule.runCount > 0 && ` · Ran ${rule.runCount} time${rule.runCount !== 1 ? "s" : ""}`}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rule.actions.map((a, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                      {a.type === "add_tag" && `add_tag: ${a.tag}`}
                      {a.type === "change_status" && `→ ${a.status}`}
                      {a.type === "create_task" && `create_task: ${a.title}`}
                      {a.type === "assign_to_user" && `assign`}
                      {a.type === "send_notification" && `notify: ${a.title}`}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggle(rule)}
                  className="rounded p-1.5 hover:bg-gray-100 text-gray-400"
                  title={rule.isActive ? "Disable" : "Enable"}
                >
                  {rule.isActive
                    ? <ToggleRight className="h-5 w-5 text-green-500" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button onClick={() => openEdit(rule)} className="rounded p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteTarget(rule)} className="rounded p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {rules?.length === 0 && (
            <div className="card p-12 text-center text-gray-400">
              No automation rules yet. Create your first rule to automate CRM actions.
            </div>
          )}
        </div>
      )}
        </TabPanel>

        <TabPanel id="logs">
          <LogsPanel />
        </TabPanel>
      </Tabs>

      {/* Create / Edit modal */}
      <Modal
        open={isOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); setApiError(""); }}
        title={editTarget ? "Edit Rule" : "New Automation Rule"}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setEditTarget(null); }}>Cancel</Button>
            <Button loading={isPending} onClick={form.handleSubmit(handleSubmit)}>
              {editTarget ? "Save" : "Create Rule"}
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{apiError}</div>
        )}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rule Name" required error={form.formState.errors.name?.message} {...form.register("name")} />
            <Select
              label="Trigger"
              options={TRIGGER_OPTIONS}
              {...form.register("trigger")}
            />
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Actions</p>
              <button
                type="button"
                onClick={() => append({ type: "add_tag", dueOffsetDays: 1 })}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Action
              </button>
            </div>
            <div className="space-y-3">
              {fields.map((field, idx) => {
                const actionType = form.watch(`actions.${idx}.type`);
                return (
                  <div key={field.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Select
                        label="Action Type"
                        options={ACTION_TYPE_OPTIONS}
                        {...form.register(`actions.${idx}.type`)}
                      />
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="ml-3 mt-5 text-xs text-red-500 hover:underline flex-shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {actionType === "add_tag" && (
                      <Input label="Tag" placeholder="e.g. hot-lead" {...form.register(`actions.${idx}.tag`)} />
                    )}
                    {actionType === "change_status" && (
                      <Select label="New Status" options={STATUS_OPTIONS} {...form.register(`actions.${idx}.status`)} />
                    )}
                    {actionType === "create_task" && (
                      <div className="space-y-3">
                        <Input label="Task Title" {...form.register(`actions.${idx}.title`)} />
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Due in (days)" type="number" min={0} {...form.register(`actions.${idx}.dueOffsetDays`)} />
                          <Select label="Priority" options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} {...form.register(`actions.${idx}.priority`)} />
                        </div>
                      </div>
                    )}
                    {actionType === "assign_to_user" && (
                      <Input label="User ID" placeholder="User UUID" {...form.register(`actions.${idx}.userId`)} />
                    )}
                    {actionType === "send_notification" && (
                      <div className="space-y-3">
                        <Input label="Notification Title" {...form.register(`actions.${idx}.notificationTitle`)} />
                        <Textarea label="Body" rows={2} {...form.register(`actions.${idx}.body`)} />
                        <Input label="Target User ID (optional)" hint="Leave blank to notify the lead owner" {...form.register(`actions.${idx}.targetUserId`)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Rule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteRule.isPending} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Delete rule <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
