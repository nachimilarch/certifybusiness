"use client";

import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  useImportLists,
  useImportList,
  useImportContacts,
  useAllImportContacts,
  useUploadList,
  useDeleteImportList,
  useApproveUpload,
} from "../../../hooks/useImports";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { PageSpinner } from "../../../components/ui/Spinner";
import { Tabs, TabList, Tab, TabPanel } from "../../../components/ui/Tabs";
import { isAxiosError } from "axios";
import { useAuthStore } from "../../../lib/auth-store";
import type { UploadedListDTO, ImportChannel, ImportStatus, ApprovalStatus } from "../../../types/api";

// ─── Display helpers ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ImportStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-gray-100 text-gray-600",
  },
  processing: {
    label: "Processing",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: "bg-blue-100 text-blue-700",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-green-100 text-green-700",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: "bg-red-100 text-red-700",
  },
};

const CHANNEL_LABELS: Record<ImportChannel, string> = {
  calling: "Cold Calling",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

function StatusBadge({ status }: { status: ImportStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

const APPROVAL_CONFIG: Record<
  ApprovalStatus,
  { label: string; className: string }
> = {
  pending: { label: "Awaiting approval", className: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  auto_approved: { label: "Auto-approved", className: "bg-blue-100 text-blue-700" },
};

function ApprovalBadge({
  status,
  approvedByName,
  rejectionReason,
}: {
  status: ApprovalStatus;
  approvedByName: string | null;
  rejectionReason: string | null;
}) {
  const cfg = APPROVAL_CONFIG[status];
  const title =
    status === "rejected" && rejectionReason
      ? `Rejected: ${rejectionReason}`
      : status === "approved" && approvedByName
      ? `Approved by ${approvedByName}`
      : undefined;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-default ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Upload form schema ───────────────────────────────────────────────────────

const uploadSchema = z.object({
  name: z.string().min(1, "List name is required"),
  channel: z.enum(["calling", "email", "whatsapp", "sms"]),
});

type UploadForm = z.infer<typeof uploadSchema>;

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && (dropped.name.endsWith(".csv") || dropped.name.endsWith(".txt"))) {
        onChange(dropped);
      }
    },
    [onChange]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
        dragOver
          ? "border-brand-400 bg-brand-50"
          : file
          ? "border-green-400 bg-green-50"
          : "border-gray-300 hover:border-gray-400 bg-gray-50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <FileText className="h-8 w-8 text-green-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-green-500">
              {(file.size / 1024).toFixed(1)} KB — click to change
            </p>
          </div>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Drop a CSV file here</p>
            <p className="text-xs text-gray-400">or click to browse — max 50 MB</p>
          </div>
          <p className="text-xs text-gray-400 bg-white rounded px-2 py-1 border border-gray-200">
            Accepts: .csv, .txt
          </p>
        </>
      )}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function ListDetailModal({
  listId,
  open,
  onClose,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [validFilter, setValidFilter] = useState<"" | "true" | "false">("");
  const [suppFilter, setSuppFilter] = useState<"" | "true" | "false">("");

  const { data: list } = useImportList(listId);
  const { data: contacts, isLoading } = useImportContacts(listId, {
    page,
    limit: 50,
    isValid: validFilter === "" ? undefined : validFilter === "true",
    isSuppressed: suppFilter === "" ? undefined : suppFilter === "true",
  });

  if (!list) return null;

  return (
    <Modal open={open} onClose={onClose} title={list.name} size="xl">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {(
          [
            ["Total", list.totalRows, "text-gray-700"],
            ["Valid", list.validRows, "text-green-700"],
            ["Invalid", list.invalidRows, "text-red-700"],
            ["Duplicate", list.duplicateRows, "text-yellow-700"],
            ["Suppressed", list.suppressedRows, "text-orange-700"],
          ] as [string, number, string][]
        ).map(([label, val, cls]) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
            <p className={`text-xl font-bold ${cls}`}>{val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={validFilter}
          onChange={(e) => { setValidFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
        >
          <option value="">All validity</option>
          <option value="true">Valid only</option>
          <option value="false">Invalid only</option>
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          value={suppFilter}
          onChange={(e) => { setSuppFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
        >
          <option value="">All contacts</option>
          <option value="false">Not suppressed</option>
          <option value="true">Suppressed only</option>
        </select>
        {contacts && (
          <p className="text-xs text-gray-400 ml-auto">{contacts.meta.total} matching contacts</p>
        )}
      </div>

      {/* Contacts table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["#", "Name", "Phone", "Email", "Company", "Valid", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {contacts?.data.map((c) => (
                <tr key={c.id} className={!c.isValid ? "bg-red-50" : c.isSuppressed ? "bg-orange-50" : ""}>
                  <td className="px-3 py-2 text-gray-400 text-xs">{c.rowNumber}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {c.fullName}
                    {c.isDuplicate && (
                      <span className="ml-1.5 text-xs text-yellow-600 bg-yellow-100 rounded px-1">dup</span>
                    )}
                    {c.isSuppressed && (
                      <span className="ml-1.5 text-xs text-orange-600 bg-orange-100 rounded px-1">suppressed</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 font-mono text-xs">{c.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{c.email ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{c.company ?? "—"}</td>
                  <td className="px-3 py-2">
                    {c.isValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.validationErrors && c.validationErrors.length > 0 && (
                      <span title={c.validationErrors.join("; ")} className="cursor-help">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {contacts?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No contacts match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {contacts && contacts.meta.pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            Page {page} of {contacts.meta.pages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === contacts.meta.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── All Contacts panel (browse contacts across every import, filterable) ────

function AllContactsPanel() {
  const [page, setPage] = useState(1);
  const [listIdFilter, setListIdFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState<ImportChannel | "">("");
  const [validFilter, setValidFilter] = useState<"" | "true" | "false">("");
  const [suppFilter, setSuppFilter] = useState<"" | "true" | "false">("");

  // Only completed imports have processed contacts worth filtering to
  const { data: listsData } = useImportLists({ page: 1, limit: 100 });
  const importOptions = (listsData?.data ?? []).filter((l) => l.status === "completed");

  const { data: contacts, isLoading } = useAllImportContacts({
    page,
    limit: 50,
    listId: listIdFilter || undefined,
    channel: channelFilter || undefined,
    isValid: validFilter === "" ? undefined : validFilter === "true",
    isSuppressed: suppFilter === "" ? undefined : suppFilter === "true",
  });

  function filterByList(listId: string) {
    setListIdFilter(listId);
    setPage(1);
  }

  return (
    <div>
      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select
          className="input w-56"
          value={listIdFilter}
          onChange={(e) => filterByList(e.target.value)}
        >
          <option value="">All imports</option>
          {importOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          className="input w-40"
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value as ImportChannel | ""); setPage(1); }}
        >
          <option value="">All channels</option>
          {(Object.keys(CHANNEL_LABELS) as ImportChannel[]).map((c) => (
            <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
          ))}
        </select>
        <select
          className="input w-36"
          value={validFilter}
          onChange={(e) => { setValidFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
        >
          <option value="">All validity</option>
          <option value="true">Valid only</option>
          <option value="false">Invalid only</option>
        </select>
        <select
          className="input w-40"
          value={suppFilter}
          onChange={(e) => { setSuppFilter(e.target.value as "" | "true" | "false"); setPage(1); }}
        >
          <option value="">All contacts</option>
          <option value="false">Not suppressed</option>
          <option value="true">Suppressed only</option>
        </select>
        <p className="ml-auto text-xs text-gray-400">
          {contacts?.meta.total ?? 0} matching contacts
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Phone", "Email", "Company", "Imported From", "Channel", "Valid", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {contacts?.data.map((c) => (
                <tr key={c.id} className={!c.isValid ? "bg-red-50" : c.isSuppressed ? "bg-orange-50" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {c.fullName}
                    {c.isDuplicate && (
                      <span className="ml-1.5 text-xs text-yellow-600 bg-yellow-100 rounded px-1">dup</span>
                    )}
                    {c.isSuppressed && (
                      <span className="ml-1.5 text-xs text-orange-600 bg-orange-100 rounded px-1">suppressed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => filterByList(c.listId)}
                      className="text-left hover:underline"
                      title="Filter to this import"
                    >
                      <p className="truncate text-gray-700 text-xs font-medium">{c.listName}</p>
                      {c.listOriginalFilename && (
                        <p className="truncate text-gray-400 text-xs">{c.listOriginalFilename}</p>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{CHANNEL_LABELS[c.listChannel]}</td>
                  <td className="px-4 py-3">
                    {c.isValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.validationErrors && c.validationErrors.length > 0 && (
                      <span title={c.validationErrors.join("; ")} className="cursor-help">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {contacts?.data.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No contacts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {contacts && contacts.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, contacts.meta.total)} of {contacts.meta.total}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === contacts.meta.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [apiError, setApiError] = useState("");
  const [viewListId, setViewListId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UploadedListDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<UploadedListDTO | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [channelFilter, setChannelFilter] = useState<ImportChannel | "">("");
  const [statusFilter, setStatusFilter] = useState<ImportStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useImportLists({
    page,
    limit: 20,
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
  });

  const uploadList = useUploadList();
  const deleteList = useDeleteImportList();
  const approveUpload = useApproveUpload();

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { channel: "calling" },
  });

  function handleUploadOpen() {
    setFile(null);
    setFileError("");
    setApiError("");
    form.reset({ channel: "calling" });
    setUploadOpen(true);
  }

  async function handleUpload(values: UploadForm) {
    if (!file) { setFileError("Please select a CSV file"); return; }
    setFileError("");
    setApiError("");
    try {
      await uploadList.mutateAsync({ ...values, file });
      setUploadOpen(false);
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Upload failed");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteList.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handleApprove(list: UploadedListDTO) {
    try {
      await approveUpload.mutateAsync({ id: list.id, action: "approve" });
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Failed to approve upload");
    }
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return;
    if (!rejectionReason.trim()) {
      setRejectError("Rejection reason is required");
      return;
    }
    try {
      setRejectError("");
      await approveUpload.mutateAsync({
        id: rejectTarget.id,
        action: "reject",
        rejectionReason: rejectionReason.trim(),
      });
      setRejectTarget(null);
      setRejectionReason("");
    } catch (err) {
      setRejectError(
        isAxiosError(err) ? (err.response?.data as any)?.message : "Failed to reject"
      );
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CSV Imports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload contact lists for calling, email, WhatsApp, and SMS campaigns
          </p>
        </div>
        <Button leftIcon={<Upload className="h-4 w-4" />} onClick={handleUploadOpen}>
          Upload CSV
        </Button>
      </div>

      {/* Page-level error banner */}
      {apiError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{apiError}</span>
          <button onClick={() => setApiError("")} className="ml-4 text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}

      <Tabs defaultTab="uploads">
        <TabList className="mb-5">
          <Tab id="uploads">Uploads</Tab>
          <Tab id="contacts">All Contacts</Tab>
        </TabList>

        <TabPanel id="uploads">
      {/* CSV format guide */}
      <div className="card p-4 mb-5 bg-brand-50 border-brand-200">
        <p className="text-sm font-medium text-brand-800 mb-1">Expected CSV columns</p>
        <p className="text-xs text-brand-600">
          Required: <code className="bg-brand-100 rounded px-1">first_name</code> or{" "}
          <code className="bg-brand-100 rounded px-1">last_name</code> +{" "}
          <code className="bg-brand-100 rounded px-1">phone</code> (calling/WhatsApp/SMS) /{" "}
          <code className="bg-brand-100 rounded px-1">email</code> (email channel).
          Optional: <code className="bg-brand-100 rounded px-1">company</code>,{" "}
          <code className="bg-brand-100 rounded px-1">designation</code> and any{" "}
          <code className="bg-brand-100 rounded px-1">extra_*</code> columns for template variables.
          Column headers are flexible — common aliases like <em>mobile</em>, <em>first name</em>,{" "}
          <em>organisation</em> are accepted.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select
          className="input w-40"
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value as ImportChannel | ""); setPage(1); }}
        >
          <option value="">All channels</option>
          {(Object.keys(CHANNEL_LABELS) as ImportChannel[]).map((c) => (
            <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
          ))}
        </select>
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ImportStatus | ""); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <p className="ml-auto text-xs text-gray-400">
          {data?.meta.total ?? 0} uploads total
        </p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["List Name", "Channel", "Status", "Total", "Valid", "Invalid", "Duplicate", "Suppressed", "Uploaded", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((list) => (
                <tr key={list.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                    <div className="truncate">
                      {list.name}
                      {list.originalFilename && (
                        <p className="text-xs text-gray-400 font-normal truncate">{list.originalFilename}</p>
                      )}
                      {isAdmin && list.approvalStatus === "pending" && (
                        <p className="text-xs text-yellow-600 font-normal">by {list.uploadedByName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{CHANNEL_LABELS[list.channel]}</td>
                  <td className="px-4 py-3">
                    {list.approvalStatus === "pending" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="h-3.5 w-3.5" />
                        Awaiting Approval
                      </span>
                    ) : list.approvalStatus === "rejected" ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Rejected
                        </span>
                        {list.rejectionReason && (
                          <p
                            className="text-xs text-red-500 mt-0.5 max-w-[180px] truncate"
                            title={list.rejectionReason}
                          >
                            {list.rejectionReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <StatusBadge status={list.status} />
                        {list.approvalStatus === "auto_approved" && (
                          <p className="text-xs text-blue-500 mt-0.5">Auto-approved</p>
                        )}
                        {list.errorMessage && (
                          <p
                            className="text-xs text-red-500 mt-0.5 max-w-xs truncate"
                            title={list.errorMessage}
                          >
                            {list.errorMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{list.totalRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-700 font-medium">{list.validRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-red-600">{list.invalidRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-yellow-600">{list.duplicateRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-orange-600">{list.suppressedRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    <div>
                      <p>{formatDate(list.createdAt)}</p>
                      <p className="text-gray-300">by {list.uploadedByName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isAdmin && list.approvalStatus === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(list)}
                            disabled={approveUpload.isPending}
                            className="rounded p-1 hover:bg-green-50 text-gray-400 hover:text-green-600 disabled:opacity-40"
                            title="Approve upload"
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(list);
                              setRejectionReason("");
                              setRejectError("");
                            }}
                            disabled={approveUpload.isPending}
                            className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-40"
                            title="Reject upload"
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {list.status === "completed" && (
                        <button
                          onClick={() => setViewListId(list.id)}
                          className="rounded p-1 hover:bg-brand-50 text-gray-400 hover:text-brand-600"
                          title="View contacts"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(list)}
                        className="rounded p-1 hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="Delete list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    No uploads yet. Click "Upload CSV" to get started.
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
        </TabPanel>

        <TabPanel id="contacts">
          <AllContactsPanel />
        </TabPanel>
      </Tabs>

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload CSV Contact List"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={uploadList.isPending}
              onClick={form.handleSubmit(handleUpload)}
            >
              {isAdmin ? "Upload & Process" : "Submit for Approval"}
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}
        <div className="space-y-4">
          <Input
            label="List Name"
            required
            placeholder="e.g. Mumbai B2B Q2 2025"
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <Select
            label="Channel"
            required
            options={[
              { value: "calling", label: "Cold Calling" },
              { value: "email", label: "Email" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "sms", label: "SMS" },
            ]}
            {...form.register("channel")}
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">CSV File <span className="text-red-500">*</span></p>
            <DropZone file={file} onChange={setFile} />
            {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
          </div>
        </div>
      </Modal>

      {/* ── Detail modal ───────────────────────────────────────────────────── */}
      {viewListId && (
        <ListDetailModal
          listId={viewListId}
          open={!!viewListId}
          onClose={() => setViewListId(null)}
        />
      )}

      {/* ── Delete confirm modal ────────────────────────────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete List"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteList.isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <strong>{deleteTarget?.name}</strong>?{" "}
          This will permanently remove all{" "}
          {deleteTarget?.totalRows.toLocaleString()} contacts and cannot be undone.
        </p>
      </Modal>

      {/* ── Reject modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectionReason(""); setRejectError(""); }}
        title="Reject Upload"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setRejectTarget(null); setRejectionReason(""); setRejectError(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={approveUpload.isPending}
              onClick={handleRejectConfirm}
            >
              Reject Upload
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          Rejecting <strong>{rejectTarget?.name}</strong> will prevent its contacts from
          being processed. The uploader will see the rejection reason.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={4}
            placeholder="Explain why this upload is being rejected..."
            value={rejectionReason}
            onChange={(e) => { setRejectionReason(e.target.value); setRejectError(""); }}
          />
          {rejectError && <p className="mt-1 text-xs text-red-600">{rejectError}</p>}
        </div>
      </Modal>
    </div>
  );
}
