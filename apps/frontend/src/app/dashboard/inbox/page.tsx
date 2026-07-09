"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail, MessageSquare, MessageCircle, Inbox, Users, Clock, AlertCircle, RefreshCw,
} from "lucide-react";
import { useConversations, useInboxStats, useInboxSSE } from "../../../hooks/useInbox";
import { useCurrentUser } from "../../../hooks/useAuth";
import { PageSpinner } from "../../../components/ui/Spinner";
import type { ConversationStatus, ChannelType, ConversationDTO } from "../../../types/api";
import type { ListConversationsParams } from "../../../lib/api/inbox";

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ConversationStatus, string> = {
  open: "bg-blue-100 text-blue-700",
  awaiting_employee: "bg-amber-100 text-amber-700",
  awaiting_customer: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Open",
  awaiting_employee: "Needs reply",
  awaiting_customer: "Awaiting customer",
  closed: "Closed",
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-purple-500" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-500" />,
  sms: <MessageCircle className="h-4 w-4 text-blue-500" />,
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "all" | "awaiting_employee" | "open" | "awaiting_customer" | "closed";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "awaiting_employee", label: "Needs Reply" },
  { id: "open", label: "Open" },
  { id: "awaiting_customer", label: "Awaiting Customer" },
  { id: "closed", label: "Closed" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>("all");
  const [channel, setChannel] = useState<ChannelType | "">("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const params: ListConversationsParams = {
    page,
    limit: 30,
    ...(tab !== "all" ? { status: tab as ConversationStatus } : {}),
    ...(channel ? { channel: channel as ChannelType } : {}),
    ...(ownerFilter && isAdmin ? { ownerUserId: ownerFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, refetch } = useConversations(params);
  const { data: stats } = useInboxStats();

  // Real-time: SSE pushes inbox:new / inbox:update → React Query invalidates automatically
  useInboxSSE();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shared Inbox</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Email, WhatsApp, and SMS replies from contacts
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-gray-500">Needs reply:</span>
            <strong className="text-amber-700">{stats.awaitingEmployee}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-gray-500">Open:</span>
            <strong className="text-blue-700">{stats.open}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-400" />
            <span className="text-gray-500">Awaiting customer:</span>
            <strong className="text-green-700">{stats.awaitingCustomer}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">Total:</span>
            <strong className="text-gray-700">{stats.total}</strong>
          </div>
          {stats.unreadTotal > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                {stats.unreadTotal}
              </span>
              <span className="text-gray-500">unread</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs + filters */}
      <div className="card p-3 mb-4 flex flex-col gap-3">
        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
              {t.id === "awaiting_employee" && stats?.awaitingEmployee
                ? <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-xs px-1">
                    {stats.awaitingEmployee}
                  </span>
                : null}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-36 text-sm"
            value={channel}
            onChange={(e) => { setChannel(e.target.value as ChannelType | ""); setPage(1); }}
          >
            <option value="">All channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>

          <input
            className="input flex-1 min-w-40 text-sm"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="card overflow-hidden flex-1">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Contact", "Channel", "Status", "Campaign", "Owner", "Last Activity", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data?.data.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    onClick={() => router.push(`/dashboard/inbox/${c.id}`)}
                  />
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Inbox className="h-8 w-8" />
                        <p className="font-medium">No conversations</p>
                        <p className="text-sm">Inbound email, WhatsApp, and SMS replies appear here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  {(page - 1) * 30 + 1}–{Math.min(page * 30, data.meta.total)} of {data.meta.total}
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                    disabled={page === data.meta.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ConversationRow({ conv, onClick }: { conv: ConversationDTO; onClick: () => void }) {
  const contactLabel =
    conv.contactName ??
    conv.contactEmail ??
    conv.contactPhone ??
    "Unknown contact";

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {conv.unreadCount > 0 && (
            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-brand-500" />
          )}
          <div>
            <p className="font-medium text-gray-900 leading-tight">{contactLabel}</p>
            {conv.leadName && (
              <p className="text-xs text-gray-400">{conv.leadName}</p>
            )}
            {conv.subject && (
              <p className="text-xs text-gray-400 truncate max-w-48">{conv.subject}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1">
          {CHANNEL_ICON[conv.channel] ?? null}
          <span className="text-gray-500 capitalize">{conv.channel}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[conv.status]}`}>
          {STATUS_LABEL[conv.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {conv.campaignName ?? "—"}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {conv.ownerName ?? <span className="text-amber-600">Unassigned</span>}
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        {formatRelative(conv.lastMessageAt)}
      </td>
      <td className="px-4 py-3">
        {conv.unreadCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {conv.unreadCount}
          </span>
        )}
      </td>
    </tr>
  );
}
