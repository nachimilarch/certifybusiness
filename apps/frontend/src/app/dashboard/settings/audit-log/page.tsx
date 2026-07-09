"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAuditLogs, useAuditActions } from "../../../../hooks/useAudit";
import { useUsers } from "../../../../hooks/useUsers";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { Modal } from "../../../../components/ui/Modal";
import type { AuditLogDTO } from "../../../../types/api";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function ActionBadge({ action }: { action: string }) {
  const verb = action.split(".").pop() ?? action;
  const color =
    verb === "delete" || verb === "reject"
      ? "bg-red-100 text-red-700"
      : verb === "create" || verb === "approve" || verb === "launch"
      ? "bg-green-100 text-green-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {action}
    </span>
  );
}

function DetailModal({ log, onClose }: { log: AuditLogDTO; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Audit Log Entry" size="lg">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 uppercase">Action</p>
            <p className="font-medium text-gray-900">{log.action}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">When</p>
            <p className="font-medium text-gray-900">{formatDate(log.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">User</p>
            <p className="font-medium text-gray-900">{log.userName ?? log.userEmail ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">IP Address</p>
            <p className="font-medium text-gray-900">{log.ipAddress ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Resource</p>
            <p className="font-medium text-gray-900">
              {log.resourceType ?? "—"} {log.resourceId ? `(${log.resourceId})` : ""}
            </p>
          </div>
        </div>
        {(log.oldValue != null || log.newValue != null) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Before</p>
              <pre className="rounded-lg bg-gray-50 p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {log.oldValue != null ? JSON.stringify(log.oldValue, null, 2) : "—"}
              </pre>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">After / Submitted</p>
              <pre className="rounded-lg bg-gray-50 p-3 text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {log.newValue != null ? JSON.stringify(log.newValue, null, 2) : "—"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditLogDTO | null>(null);

  const { data: users } = useUsers({ limit: 100 });
  const { data: actions } = useAuditActions();

  const { data, isLoading } = useAuditLogs({
    page,
    limit: 50,
    userId: userId || undefined,
    action: action || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });

  function resetAndSet<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const hasFilters = userId || action || from || to;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every action taken by your team — who did what, when, and from where.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <select
          className="input w-44"
          value={userId}
          onChange={(e) => resetAndSet(setUserId)(e.target.value)}
        >
          <option value="">All users</option>
          {users?.data.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
        <select
          className="input w-48"
          value={action}
          onChange={(e) => resetAndSet(setAction)(e.target.value)}
        >
          <option value="">All actions</option>
          {actions?.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="date"
          className="input w-36"
          value={from}
          onChange={(e) => resetAndSet(setFrom)(e.target.value)}
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          className="input w-36"
          value={to}
          onChange={(e) => resetAndSet(setTo)(e.target.value)}
        />
        {hasFilters && (
          <button
            onClick={() => { setUserId(""); setAction(""); setFrom(""); setTo(""); setPage(1); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
        <p className="ml-auto text-xs text-gray-400">{data?.meta.total ?? 0} entries</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["When", "User", "Action", "Resource", "IP Address"].map((h) => (
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
              {data?.data.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {log.userName ?? log.userEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {log.resourceType ?? "—"}
                    {log.resourceId && (
                      <span className="text-gray-400"> #{log.resourceId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No matching audit log entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {data && data.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, data.meta.total)} of {data.meta.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === data.meta.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && <DetailModal log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
