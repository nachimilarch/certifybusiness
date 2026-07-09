"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Mail, MessageSquare, MessageCircle, Code } from "lucide-react";
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "../../../../hooks/useChannels";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Textarea } from "../../../../components/ui/Textarea";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { TemplateDTO, ChannelType } from "../../../../types/api";

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-600" />,
  sms: <MessageCircle className="h-4 w-4 text-blue-600" />,
};

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email: "Email", whatsapp: "WhatsApp", sms: "SMS",
};

const formSchema = z.object({
  channel: z.enum(["email", "whatsapp", "sms"]),
  name: z.string().min(1, "Required"),
  subject: z.string().optional(),
  body: z.string().min(1, "Body is required"),
  whatsappTemplateName: z.string().optional(),
  dltTemplateId: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export default function TemplatesPage() {
  const [channelFilter, setChannelFilter] = useState<ChannelType | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateDTO | null>(null);
  const [apiError, setApiError] = useState("");

  const { data: templates, isLoading } = useTemplates(channelFilter || undefined);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { channel: "email" },
  });
  const channel = form.watch("channel");

  function handleEditOpen(t: TemplateDTO) {
    setEditTarget(t);
    form.reset({
      channel: t.channel,
      name: t.name,
      subject: t.subject ?? "",
      body: t.body,
      whatsappTemplateName: t.whatsappTemplateName ?? "",
      dltTemplateId: t.dltTemplateId ?? "",
    });
    setApiError("");
  }

  async function handleSubmit(values: FormValues) {
    setApiError("");
    try {
      if (editTarget) {
        await updateTemplate.mutateAsync({ id: editTarget.id, data: values });
        setEditTarget(null);
      } else {
        await createTemplate.mutateAsync(values);
        setCreateOpen(false);
      }
      form.reset({ channel: "email" });
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteTemplate.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const isOpen = createOpen || !!editTarget;
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Reusable templates for email, WhatsApp, and SMS</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { form.reset({ channel: "email" }); setCreateOpen(true); }}>
          New Template
        </Button>
      </div>

      {/* Filter */}
      <div className="card p-4 mb-5 flex gap-3">
        <select className="input w-40" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as ChannelType | "")}>
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((t) => (
            <div key={t.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {CHANNEL_ICONS[t.channel]}
                  <span className="text-xs font-medium text-gray-500 uppercase">{CHANNEL_LABELS[t.channel]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEditOpen(t)} className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteTarget(t)} className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                {t.subject && <p className="text-xs text-gray-500 mt-0.5">Subject: {t.subject}</p>}
              </div>
              <p className="text-sm text-gray-600 line-clamp-3 flex-1">{t.body}</p>
              {t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span key={v} className="flex items-center gap-0.5 rounded bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5">
                      <Code className="h-3 w-3" />{`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {templates?.length === 0 && (
            <div className="col-span-3 card p-12 text-center text-gray-400">
              No templates yet. Create your first template to use in campaigns.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={isOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); setApiError(""); }}
        title={editTarget ? "Edit Template" : "New Template"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setCreateOpen(false); setEditTarget(null); }}>Cancel</Button>
            <Button loading={isPending} onClick={form.handleSubmit(handleSubmit)}>
              {editTarget ? "Save Changes" : "Create Template"}
            </Button>
          </>
        }
      >
        {apiError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{apiError}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Channel" options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }]} {...form.register("channel")} />
            <Input label="Template Name" required error={form.formState.errors.name?.message} {...form.register("name")} />
          </div>
          {channel === "email" && (
            <Input label="Subject Line" placeholder="Use {{first_name}} for variables" {...form.register("subject")} />
          )}
          <Textarea
            label="Body"
            required
            rows={6}
            placeholder={"Hi {{first_name}},\n\nYour message here..."}
            error={form.formState.errors.body?.message}
            {...form.register("body")}
          />
          <p className="text-xs text-gray-400">
            Use <code className="bg-gray-100 rounded px-1">{"{{variable_name}}"}</code> for personalisation. Available: first_name, last_name, company, designation, phone, email, or any extra_ column from your CSV.
          </p>
          {channel === "whatsapp" && (
            <Input label="WhatsApp Template Name (Meta)" hint="Exact name of the approved template in Meta Business Manager" {...form.register("whatsappTemplateName")} />
          )}
          {channel === "sms" && (
            <Input label="DLT Template ID" hint="India DLT-registered template ID" {...form.register("dltTemplateId")} />
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Template" footer={
        <><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={deleteTemplate.isPending} onClick={handleDelete}>Delete</Button></>
      }>
        <p className="text-sm text-gray-600">Delete template <strong>{deleteTarget?.name}</strong>? Campaigns using this template will not be affected.</p>
      </Modal>
    </div>
  );
}
