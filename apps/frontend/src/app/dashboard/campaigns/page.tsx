"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Eye, Mail, MessageSquare, MessageCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useCampaigns, useCreateCampaign, useDeleteCampaign } from "../../../hooks/useCampaigns";
import { useSenders } from "../../../hooks/useChannels";
import { useTemplates } from "../../../hooks/useChannels";
import { useImportLists } from "../../../hooks/useImports";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { PageSpinner } from "../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { CampaignDTO, CampaignStatus, ChannelType } from "../../../types/api";

// ─── Display helpers ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-purple-600" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-600" />,
  sms: <MessageCircle className="h-4 w-4 text-blue-600" />,
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

// ─── Empty-state helper ────────────────────────────────────────────────────────

function EmptyCTA({ text, href, linkText }: { text: string; href: string; linkText: string }) {
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
      <p className="text-xs text-amber-700">
        {text}{" "}
        <a href={href} className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:text-amber-900">
          {linkText}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </p>
    </div>
  );
}

// ─── Create campaign schema ───────────────────────────────────────────────────

const stepSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  delayDays: z.coerce.number().int().min(0).default(0),
  delayHours: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  channel: z.enum(["email", "whatsapp", "sms"]),
  senderIdentityId: z.string().optional(),
  listId: z.string().optional(),
  steps: z.array(stepSchema).min(1),
});

type CreateForm = z.infer<typeof createSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const [channelFilter, setChannelFilter] = useState<ChannelType | "">("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignDTO | null>(null);
  const [apiError, setApiError] = useState("");

  const { data, isLoading } = useCampaigns({
    page, limit: 20,
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
  });

  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { channel: "email", steps: [{ delayDays: 0, delayHours: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });
  const watchedChannel = form.watch("channel");

  const { data: senders } = useSenders(watchedChannel);
  const { data: templates } = useTemplates(watchedChannel);
  // Fetch only completed (approved + processed) lists for the selected channel server-side
  const { data: lists } = useImportLists({ channel: watchedChannel, status: "completed" });

  async function handleCreate(values: CreateForm) {
    setApiError("");
    try {
      const campaign = await createCampaign.mutateAsync({
        name: values.name,
        channel: values.channel,
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
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCampaign.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  // Only show active sender identities in campaign creation
  const activeSenders = senders?.filter((s) => s.isActive) ?? [];
  const senderOptions = [
    { value: "", label: "Select sender…" },
    ...activeSenders.map((s) => ({ value: s.id, label: s.isVerified ? s.name : `${s.name} (unverified)` })),
  ];

  const templateOptions = [
    { value: "", label: "Select template…" },
    ...(templates?.map((t) => ({ value: t.id, label: t.name })) ?? []),
  ];

  // Only show lists with at least one valid contact
  const usableLists = lists?.data.filter((l) => l.validRows > 0) ?? [];
  const listOptions = [
    { value: "", label: "Select list…" },
    ...usableLists.map((l) => ({ value: l.id, label: `${l.name} (${l.validRows.toLocaleString()} contacts)` })),
  ];

  const noSenders = activeSenders.length === 0;
  const noLists = usableLists.length === 0;
  const noTemplates = (templates?.length ?? 0) === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} campaigns total</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { form.reset({ channel: "email", steps: [{ delayDays: 0, delayHours: 0 }] }); setCreateOpen(true); }}>
          New Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <select className="input w-40" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as ChannelType | "")}>
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}>
          <option value="">All statuses</option>
          {(["draft","scheduled","running","paused","completed","failed"] as CampaignStatus[]).map(s => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <PageSpinner /> : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>{["Campaign", "Channel", "Status", "Contacts", "Sent", "Delivered", "Replies", "Created", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div>
                      {c.name}
                      {c.listName && <p className="text-xs text-gray-400 font-normal">{c.listName}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{CHANNEL_ICONS[c.channel]}</td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-gray-600">{c.totalContacts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{c.sentCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-700">{c.deliveredCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-blue-700">{c.repliedCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => router.push(`/dashboard/campaigns/${c.id}`)} className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Eye className="h-4 w-4" /></button>
                      {["draft","scheduled","paused"].includes(c.status) && (
                        <button onClick={() => setDeleteTarget(c)} className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No campaigns yet. Click "New Campaign" to get started.</td></tr>
              )}
            </tbody>
          </table>
        )}
        {data && data.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">{(page-1)*20+1}–{Math.min(page*20,data.meta.total)} of {data.meta.total}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page===1} onClick={() => setPage(p => p-1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page===data.meta.pages} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Campaign Modal ──────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setApiError(""); }} title="New Campaign" size="xl"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={createCampaign.isPending} onClick={form.handleSubmit(handleCreate)}>Create Campaign</Button></>}
      >
        {apiError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{apiError}</div>}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Campaign Name" required error={form.formState.errors.name?.message} {...form.register("name")} />
            <Select label="Channel" options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }]} {...form.register("channel")} />
          </div>

          {/* Sender Identity */}
          <div>
            <Select
              label="Sender Identity"
              hint="The mailbox or number this campaign will send from"
              options={senderOptions}
              {...form.register("senderIdentityId")}
            />
            {noSenders && senders !== undefined && (
              <EmptyCTA
                text="No active sender identities for this channel."
                href="/dashboard/settings/senders"
                linkText="Add a sender identity"
              />
            )}
          </div>

          {/* Contact List */}
          <div>
            <Select
              label="Contact List"
              hint="Choose a successfully processed CSV import for this channel"
              options={listOptions}
              {...form.register("listId")}
            />
            {noLists && lists !== undefined && (
              <EmptyCTA
                text="No processed contact lists for this channel."
                href="/dashboard/imports"
                linkText="Upload a CSV contact list"
              />
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Campaign Steps</p>
                <p className="text-xs text-gray-400 mt-0.5">Each step sends a message. Multi-step sequences add a delay between steps.</p>
              </div>
              <button type="button" onClick={() => append({ delayDays: 1, delayHours: 0 })} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Step</button>
            </div>
            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">Step {idx + 1}</p>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                    )}
                  </div>
                  {idx > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input label="Delay (days)" type="number" min={0} hint="Days after the previous step" {...form.register(`steps.${idx}.delayDays`)} />
                      <Input label="Delay (hours)" type="number" min={0} hint="Additional hours" {...form.register(`steps.${idx}.delayHours`)} />
                    </div>
                  )}
                  <div>
                    <Select
                      label="Template"
                      hint="Reusable message content for this step"
                      options={templateOptions}
                      {...form.register(`steps.${idx}.templateId`)}
                    />
                    {noTemplates && templates !== undefined && (
                      <EmptyCTA
                        text="No templates for this channel."
                        href="/dashboard/settings/templates"
                        linkText="Create a template"
                      />
                    )}
                  </div>
                  {watchedChannel === "email" && (
                    <div className="mt-3">
                      <Input label="Subject override" placeholder="Leave blank to use template subject" hint="Overrides the template subject for this step only" {...form.register(`steps.${idx}.subject`)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Campaign" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={deleteCampaign.isPending} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Delete campaign <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
