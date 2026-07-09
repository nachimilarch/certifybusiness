"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Filter } from "lucide-react";
import { useLeads, useCreateLead } from "../../../hooks/useLeads";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Badge } from "../../../components/ui/Badge";
import { PageSpinner } from "../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { LeadStatus, LeadSource, LeadDTO } from "../../../types/api";

// ─── Status / source display helpers ─────────────────────────────────────────

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-green-100 text-green-700",
  follow_up: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  dead: "bg-gray-100 text-gray-500",
  do_not_contact: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  follow_up: "Follow-up",
  converted: "Converted",
  dead: "Dead",
  do_not_contact: "DNC",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  cold_call: "Cold Call",
  cold_email: "Cold Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  website_inbound: "Website",
  manual: "Manual",
};

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

// ─── Create lead schema ────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  company: z.string().optional(),
  designation: z.string().optional(),
  source: z.enum([
    "cold_call",
    "cold_email",
    "whatsapp",
    "sms",
    "website_inbound",
    "manual",
  ]).default("manual"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [apiError, setApiError] = useState("");

  const { data, isLoading } = useLeads({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
  });

  const createLead = useCreateLead();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { source: "manual" },
  });

  async function handleCreate(values: CreateForm) {
    setApiError("");
    try {
      const phones =
        values.phone
          ? [{ phone: values.phone, isPrimary: true }]
          : undefined;
      const emails =
        values.email
          ? [{ email: values.email, isPrimary: true }]
          : undefined;
      const lead = await createLead.mutateAsync({
        name: values.name,
        company: values.company || null,
        designation: values.designation || null,
        source: values.source,
        notes: values.notes || null,
        phones,
        emails,
      });
      setCreateOpen(false);
      form.reset();
      router.push(`/dashboard/leads/${lead.id}`);
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error creating lead");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total leads</p>
        </div>
        <Button
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search name, company, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as LeadStatus | ""); setPage(1); }}
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          className="input w-40"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value as LeadSource | ""); setPage(1); }}
        >
          <option value="">All sources</option>
          {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
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
                {["Name", "Status", "Source", "Phone", "Email", "Assigned To", "Last Activity", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    <div>
                      {lead.name}
                      {lead.company && (
                        <p className="text-xs text-gray-400 font-normal">{lead.company}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {SOURCE_LABELS[lead.source]}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lead.primaryPhone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.primaryEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.assignedToName ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(lead.lastActivityAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/leads/${lead.id}`); }}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No leads found. Add your first lead to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {data && data.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} of{" "}
              {data.meta.total}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === data.meta.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Lead Modal ──────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); form.reset(); setApiError(""); }}
        title="Add New Lead"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createLead.isPending} onClick={form.handleSubmit(handleCreate)}>
              Create Lead
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Full Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </div>
          <Input label="Company" {...form.register("company")} />
          <Input label="Designation / Title" {...form.register("designation")} />
          <Input label="Phone" type="tel" {...form.register("phone")} />
          <Input
            label="Email"
            type="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <div className="col-span-2">
            <Select
              label="Source"
              options={[
                { value: "manual", label: "Manual" },
                { value: "cold_call", label: "Cold Call" },
                { value: "cold_email", label: "Cold Email" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "sms", label: "SMS" },
                { value: "website_inbound", label: "Website Inbound" },
              ]}
              {...form.register("source")}
            />
          </div>
          <div className="col-span-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Any initial notes…"
                {...form.register("notes")}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
