"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Eye, Trash2, Mail, MessageSquare, MessageCircle, AlertCircle, ExternalLink,
} from "lucide-react";
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from "../../hooks/useCampaigns";
import { useSenders, useTemplates } from "../../hooks/useChannels";
import { useImportLists } from "../../hooks/useImports";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageSpinner } from "../ui/Spinner";
import { isAxiosError } from "axios";
import type { CampaignDTO, CampaignStatus, ChannelType } from "../../types/api";

// ─── Channel config ───────────────────────────────────────────────────────────

interface ChannelConfig {
  label: string;
  icon: React.ReactNode;
  headerIcon: React.ReactNode;
  accentClass: string;
  channelImportType: "email" | "whatsapp" | "sms" | "calling";
  description: string;
}

const CHANNEL_CONFIG: Record<ChannelType, ChannelConfig> = {
  email: {
    label: "Email",
    icon: <Mail className="h-4 w-4 text-purple-600" />,
    headerIcon: <Mail className="h-6 w-6 text-purple-600" />,
    accentClass: "text-purple-700",
    channelImportType: "email",
    description: "Send cold email campaigns via SMTP",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: <MessageSquare className="h-4 w-4 text-green-600" />,
    headerIcon: <MessageSquare className="h-6 w-6 text-green-600" />,
    accentClass: "text-green-700",
    channelImportType: "whatsapp",
    description: "Send WhatsApp campaigns via Meta Cloud API",
  },
  sms: {
    label: "SMS",
    icon: <MessageCircle className="h-4 w-4 text-blue-600" />,
    headerIcon: <MessageCircle className="h-6 w-6 text-blue-600" />,
    accentClass: "text-blue-700",
    channelImportType: "sms",
    description: "Send SMS campaigns via your configured provider",
  },
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

// ─── Create form schema ───────────────────────────────────────────────────────

const stepSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  delayDays: z.coerce.number().int().min(0).default(0),
  delayHours: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  senderIdentityId: z.string().optional(),
  listId: z.string().optional(),
  steps: z.array(stepSchema).min(1),
});

type CreateForm = z.infer<typeof createSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  channel: ChannelType;
}

export function ChannelCampaignsPage({ channel }: Props) {
  const router = useRouter();
  const cfg = CHANNEL_CONFIG[channel];

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignDTO | null>(null);
  const [apiError, setApiError] = useState("");

  const { data, isLoading } = useCampaigns({
    page,
    limit: 20,
    channel,
    status: statusFilter || undefined,
  });

  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const { data: senders } = useSenders(channel);
  const { data: templates } = useTemplates(channel);
  // Fetch only completed (approved + processed) lists server-side
  const { data: lists } = useImportLists({ channel: cfg.channelImportType, status: "completed" });

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { steps: [{ delayDays: 0, delayHours: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });

  async function handleCreate(values: CreateForm) {
    setApiError("");
    try {
      const campaign = await createCampaign.mutateAsync({
        name: values.name,
        channel,
        senderIdentityId: values.senderIdentityId || null,
        listId: values.listId || null,
        steps: values.steps.map((s, i) => ({
          stepNumber: i + 1,
          templateId: s.templateId || null,
          subject: s.subject || null,
          body: s.body || null,
          delayDays: s.delayDays,
          delayHours: s.delayHours,
        })),
      });
      setCreateOpen(false);
      form.reset();
      router.push(`/dashboard/campaigns/${campaign.id}`);
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error creating campaign");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCampaign.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const activeSenders = senders?.filter((s) => s.isActive) ?? [];
  const senderOptions = [
    { value: "", label: "Select sender…" },
    ...activeSenders.map((s) => ({ value: s.id, label: s.isVerified ? s.name : `${s.name} (unverified)` })),
  ];
  const templateOptions = [
    { value: "", label: "Select template…" },
    ...(templates?.map((t) => ({ value: t.id, label: t.name })) ?? []),
  ];
  // Filter out lists with no valid contacts
  const usableLists = lists?.data.filter((l) => l.validRows > 0) ?? [];
  const listOptions = [
    { value: "", label: "Select list…" },
    ...usableLists.map((l) => ({ value: l.id, label: `${l.name} (${l.validRows.toLocaleString()} contacts)` })),
  ];

  const noSenders = senders !== undefined && activeSenders.length === 0;
  const noLists = lists !== undefined && usableLists.length === 0;
  const noTemplates = templates !== undefined && templates.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {cfg.headerIcon}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cfg.label} Campaigns</h1>
            <p className="text-sm text-gray-500 mt-0.5">{cfg.description}</p>
          </div>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => {
            form.reset({ steps: [{ delayDays: 0, delayHours: 0 }] });
            setApiError("");
            setCreateOpen(true);
          }}
        >
          New Campaign
        </Button>
      </div>

      {/* Summary strip */}
      {data && (
        <div className="card p-4 mb-5 flex flex-wrap gap-6 text-sm text-gray-600">
          <span><strong className="text-gray-900">{data.meta.total}</strong> total campaigns</span>
          {(["running", "scheduled", "completed"] as CampaignStatus[]).map((s) => {
            const count = data.data.filter((c) => c.status === s).length;
            if (!count) return null;
            return (
              <span key={s}>
                <strong className="text-gray-900">{count}</strong>{" "}
                <span className={STATUS_COLORS[s].split(" ")[1]}>{s}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Filter */}
      <div className="card p-4 mb-5 flex gap-3">
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as CampaignStatus | ""); setPage(1); }}
        >
          <option value="">All statuses</option>
          {(["draft", "scheduled", "running", "paused", "completed", "failed"] as CampaignStatus[]).map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Campaign", "Status", "Contacts",
                  "Sent", "Delivered", "Replies",
                  ...(channel === "email" ? ["Opened", "Clicked"] : []),
                  "Created", "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div>
                      {c.name}
                      {c.listName && (
                        <p className="text-xs text-gray-400 font-normal">{c.listName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.totalContacts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.sentCount.toLocaleString()}
                    {c.totalContacts > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({pct(c.sentCount, c.totalContacts)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-green-700">
                    {c.deliveredCount.toLocaleString()}
                    {c.sentCount > 0 && (
                      <span className="ml-1 text-xs text-green-500">
                        ({pct(c.deliveredCount, c.sentCount)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-indigo-700">
                    {c.repliedCount.toLocaleString()}
                  </td>
                  {channel === "email" && (
                    <>
                      <td className="px-4 py-3 text-purple-700">
                        {c.openedCount.toLocaleString()}
                        {c.deliveredCount > 0 && (
                          <span className="ml-1 text-xs text-purple-400">
                            ({pct(c.openedCount, c.deliveredCount)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-teal-700">
                        {c.clickedCount.toLocaleString()}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                        className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {["draft", "scheduled", "paused"].includes(c.status) && (
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={channel === "email" ? 10 : 8}
                    className="px-4 py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      {cfg.headerIcon}
                      <p className="font-medium">No {cfg.label} campaigns yet</p>
                      <p className="text-sm">Create your first campaign to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {data && data.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} of {data.meta.total}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page === data.meta.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Campaign Modal ──────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setApiError(""); }}
        title={`New ${cfg.label} Campaign`}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createCampaign.isPending}
              disabled={noSenders || noLists}
              onClick={form.handleSubmit(handleCreate)}
            >
              Create Campaign
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <div className="space-y-5">
          {/* Name + channel indicator */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
            {cfg.icon}
            <span className="text-sm font-medium text-gray-700">{cfg.label} campaign</span>
          </div>

          <Input
            label="Campaign Name"
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select
                label="Sender Identity"
                hint="The mailbox or number this campaign sends from"
                options={senderOptions}
                {...form.register("senderIdentityId")}
              />
              {noSenders && (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700">
                    No active senders.{" "}
                    <a href="/dashboard/settings/senders" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
                      Add one <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </p>
                </div>
              )}
            </div>
            <div>
              <Select
                label="Contact List"
                hint="Processed CSV import for this channel"
                options={listOptions}
                {...form.register("listId")}
              />
              {noLists && (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700">
                    No lists ready.{" "}
                    <a href="/dashboard/imports" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
                      Upload CSV <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Campaign Steps</p>
              <button
                type="button"
                onClick={() => append({ delayDays: 1, delayHours: 0 })}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Follow-up Step
              </button>
            </div>
            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      {idx === 0 ? "Initial message" : `Follow-up ${idx}`}
                    </p>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {idx > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Delay (days)"
                        type="number"
                        min={0}
                        hint="Days after previous step"
                        {...form.register(`steps.${idx}.delayDays`)}
                      />
                      <Input
                        label="Delay (hours)"
                        type="number"
                        min={0}
                        {...form.register(`steps.${idx}.delayHours`)}
                      />
                    </div>
                  )}

                  <div>
                    <Select
                      label="Template"
                      hint="Reusable message content for this step"
                      options={templateOptions}
                      {...form.register(`steps.${idx}.templateId`)}
                    />
                    {noTemplates && (
                      <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700">
                          No templates yet.{" "}
                          <a href="/dashboard/settings/templates" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
                            Create one <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </p>
                      </div>
                    )}
                  </div>

                  {channel === "email" && (
                    <Input
                      label="Subject override"
                      placeholder="Leave blank to use template subject"
                      {...form.register(`steps.${idx}.subject`)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Campaign"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteCampaign.isPending} onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Delete campaign <strong>{deleteTarget?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
