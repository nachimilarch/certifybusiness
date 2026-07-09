"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, FlaskConical } from "lucide-react";
import { useSenders, useCreateSender, useUpdateSender, useDeleteSender, useTestSender } from "../../../../hooks/useChannels";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Textarea } from "../../../../components/ui/Textarea";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { SenderIdentityDTO, ChannelType } from "../../../../types/api";

const formSchema = z.object({
  channel: z.enum(["email", "whatsapp", "sms"]),
  name: z.string().min(1, "Required"),
  fromAddress: z.string().email().optional().or(z.literal("")),
  whatsappNumber: z.string().optional(),
  whatsappWabaId: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  smsSenderId: z.string().max(11).optional(),
  credentialsJson: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const CHANNEL_LABELS: Record<ChannelType, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };

export default function SendersPage() {
  const [channelFilter, setChannelFilter] = useState<ChannelType | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SenderIdentityDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SenderIdentityDTO | null>(null);
  const [apiError, setApiError] = useState("");
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const { data: senders, isLoading } = useSenders(channelFilter || undefined);
  const createSender = useCreateSender();
  const updateSender = useUpdateSender();
  const deleteSender = useDeleteSender();
  const testSender = useTestSender();

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { channel: "email" } });
  const channel = form.watch("channel");

  function handleEditOpen(s: SenderIdentityDTO) {
    setEditTarget(s);
    form.reset({ channel: s.channel, name: s.name, fromAddress: s.fromAddress ?? "", whatsappNumber: s.whatsappNumber ?? "", whatsappWabaId: s.whatsappWabaId ?? "", whatsappPhoneNumberId: s.whatsappPhoneNumberId ?? "", smsSenderId: s.smsSenderId ?? "", credentialsJson: "" });
    setApiError("");
  }

  async function handleSubmit(values: FormValues) {
    setApiError("");
    let credentials: Record<string, string> | null = null;
    if (values.credentialsJson?.trim()) {
      try { credentials = JSON.parse(values.credentialsJson); }
      catch { setApiError("Credentials must be valid JSON"); return; }
    }
    try {
      const payload = {
        channel: values.channel,
        name: values.name,
        fromAddress: values.fromAddress || null,
        whatsappNumber: values.whatsappNumber || null,
        whatsappWabaId: values.whatsappWabaId || null,
        whatsappPhoneNumberId: values.whatsappPhoneNumberId || null,
        smsSenderId: values.smsSenderId || null,
        credentials,
      };
      if (editTarget) {
        await updateSender.mutateAsync({ id: editTarget.id, data: payload });
        setEditTarget(null);
      } else {
        await createSender.mutateAsync(payload);
        setCreateOpen(false);
      }
      form.reset({ channel: "email" });
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteSender.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleTest(id: string) {
    setTestResults((prev) => ({ ...prev, [id]: { success: false, message: "Testing…" } }));
    try {
      const result = await testSender.mutateAsync(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: msg } }));
    }
  }

  const isOpen = createOpen || !!editTarget;
  const isPending = createSender.isPending || updateSender.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sender Identities</h1>
          <p className="text-sm text-gray-500 mt-1">Email addresses, WhatsApp numbers, and SMS sender IDs</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { form.reset({ channel: "email" }); setCreateOpen(true); }}>
          Add Sender
        </Button>
      </div>

      <div className="card p-4 mb-5 flex gap-3">
        <select className="input w-40" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as ChannelType | "")}>
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <PageSpinner /> : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>{["Name", "Channel", "From / Number / Sender ID", "Credentials", "Status", "Test", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {senders?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{CHANNEL_LABELS[s.channel]}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {s.fromAddress ?? s.whatsappNumber ?? s.smsSenderId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.hasCredentials ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5"><ShieldCheck className="h-3 w-3" />Stored</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5"><ShieldAlert className="h-3 w-3" />None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleTest(s.id)}
                        disabled={testSender.isPending}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <FlaskConical className="h-3 w-3" />Test
                      </button>
                      {testResults[s.id] && (
                        <span className={`text-xs ${testResults[s.id].success ? "text-green-600" : "text-red-600"}`}>
                          {testResults[s.id].message}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditOpen(s)} className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {senders?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No sender identities yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={isOpen} onClose={() => { setCreateOpen(false); setEditTarget(null); setApiError(""); }} title={editTarget ? "Edit Sender" : "Add Sender"} size="lg"
        footer={<><Button variant="secondary" onClick={() => { setCreateOpen(false); setEditTarget(null); }}>Cancel</Button><Button loading={isPending} onClick={form.handleSubmit(handleSubmit)}>{editTarget ? "Save" : "Create"}</Button></>}
      >
        {apiError && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{apiError}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Channel" options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }]} {...form.register("channel")} />
            <Input label="Display Name" required error={form.formState.errors.name?.message} {...form.register("name")} />
          </div>
          {channel === "email" && <Input label="From Address" type="email" placeholder="noreply@yourdomain.com" error={form.formState.errors.fromAddress?.message} {...form.register("fromAddress")} />}
          {channel === "whatsapp" && (
            <>
              <Input label="WhatsApp Number" placeholder="+91XXXXXXXXXX" {...form.register("whatsappNumber")} />
              <Input label="WABA ID" hint="WhatsApp Business Account ID from Meta" {...form.register("whatsappWabaId")} />
              <Input label="Phone Number ID" hint="Meta phone number ID (not the phone number)" {...form.register("whatsappPhoneNumberId")} />
            </>
          )}
          {channel === "sms" && <Input label="Sender ID" placeholder="MYBRND (max 11 chars)" {...form.register("smsSenderId")} />}
          <Textarea
            label="Credentials (JSON)"
            rows={5}
            placeholder={
              channel === "whatsapp"
                ? '{\n  "accessToken": "EAAxxxxxxx..."\n}'
                : channel === "sms"
                ? '{\n  "apiKey": "...",\n  "apiSecret": "...",\n  "baseUrl": "https://api.yourprovider.com"\n}'
                : '{\n  "host": "smtpout.secureserver.net",\n  "port": 465,\n  "secure": true,\n  "user": "info@certifybusiness.com",\n  "pass": "your_password"\n}'
            }
            hint={
              channel === "whatsapp"
                ? (editTarget?.hasCredentials ? "Leave blank to keep existing. Token comes from Meta → System Users." : "WhatsApp requires a permanent System User access token from Meta Business Manager. Must have whatsapp_business_messaging permission.")
                : channel === "sms"
                ? (editTarget?.hasCredentials ? "Leave blank to keep existing credentials" : "API credentials from your SMS provider")
                : (editTarget?.hasCredentials ? "Leave blank to keep existing SMTP credentials" : "Leave blank to use global SMTP credentials from server .env (SMTP_HOST, SMTP_USER, SMTP_PASS)")
            }
            {...form.register("credentialsJson")}
          />
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Sender" footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={deleteSender.isPending} onClick={handleDelete}>Delete</Button></>}>
        <p className="text-sm text-gray-600">Delete sender <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
