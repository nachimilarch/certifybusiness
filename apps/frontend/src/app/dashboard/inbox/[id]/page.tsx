"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mail, MessageSquare, User, Tag, RotateCcw,
  XCircle, Send, CheckCircle2, ExternalLink,
} from "lucide-react";
import {
  useConversation,
  useReplyConversation,
  useAssignConversation,
  useCloseConversation,
  useReopenConversation,
} from "../../../../hooks/useInbox";
import { useCurrentUser } from "../../../../hooks/useAuth";
import { useUsers } from "../../../../hooks/useUsers";
import { Button } from "../../../../components/ui/Button";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { ConversationStatus, ConversationMessageDTO } from "../../../../types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatTs(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ConversationMessageDTO }) {
  const isInbound = msg.direction === "inbound";
  return (
    <div className={`flex ${isInbound ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isInbound
            ? "bg-gray-100 text-gray-900 rounded-tl-sm"
            : "bg-brand-600 text-white rounded-tr-sm"
        }`}
      >
        {/* Sender label */}
        <p className={`text-xs font-semibold mb-1 ${isInbound ? "text-gray-500" : "text-brand-200"}`}>
          {isInbound
            ? (msg.senderAddress ?? msg.senderPhone ?? "Contact")
            : (msg.sentByName ?? "You")}
        </p>

        {/* Body */}
        {msg.bodyHtml && isInbound ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.bodyText ?? "(no content)"}</p>
        )}

        {/* Timestamp */}
        <p className={`text-xs mt-1.5 ${isInbound ? "text-gray-400" : "text-brand-300"}`}>
          {formatTs(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: conv, isLoading } = useConversation(id);
  const { data: usersData } = useUsers({ limit: 100 });
  const replyMutation = useReplyConversation();
  const assignMutation = useAssignConversation();
  const closeMutation = useCloseConversation();
  const reopenMutation = useReopenConversation();

  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [showAssign, setShowAssign] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages?.length]);

  async function handleReply() {
    if (!replyBody.trim()) return;
    setReplyError("");
    try {
      await replyMutation.mutateAsync({ id, body: replyBody.trim() });
      setReplyBody("");
    } catch (err) {
      setReplyError(isAxiosError(err) ? (err.response?.data as any)?.message : "Failed to send reply");
    }
  }

  async function handleAssign() {
    if (!assignUserId) return;
    await assignMutation.mutateAsync({ id, userId: assignUserId, reason: assignReason || undefined });
    setShowAssign(false);
    setAssignUserId("");
    setAssignReason("");
  }

  if (isLoading || !conv) return <PageSpinner />;

  const isClosed = conv.status === "closed";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => router.push("/dashboard/inbox")}
          className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to inbox
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {conv.channel === "email"
              ? <Mail className="h-5 w-5 text-purple-500 flex-shrink-0" />
              : <MessageSquare className="h-5 w-5 text-green-500 flex-shrink-0" />}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {conv.contactName ?? conv.contactEmail ?? conv.contactPhone ?? "Unknown contact"}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[conv.status]}`}>
                  {STATUS_LABEL[conv.status]}
                </span>
                {conv.campaignName && (
                  <span className="text-xs text-gray-400">· {conv.campaignName}</span>
                )}
                {conv.subject && (
                  <span className="text-xs text-gray-400 truncate max-w-xs">· {conv.subject}</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isClosed && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<XCircle className="h-4 w-4" />}
                loading={closeMutation.isPending}
                onClick={() => closeMutation.mutateAsync(id)}
              >
                Close
              </Button>
            )}
            {isClosed && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="h-4 w-4" />}
                loading={reopenMutation.isPending}
                onClick={() => reopenMutation.mutateAsync(id)}
              >
                Reopen
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Thread */}
        <div className="flex flex-1 flex-col card overflow-hidden">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto p-4">
            {conv.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                No messages yet.
              </div>
            ) : (
              conv.messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply composer */}
          {!isClosed && (
            <div className="border-t border-gray-200 p-4">
              {replyError && (
                <div className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {replyError}
                </div>
              )}
              <textarea
                className="input w-full resize-none text-sm"
                rows={3}
                placeholder={`Reply via ${conv.channel}…`}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">⌘Enter to send</p>
                <Button
                  size="sm"
                  leftIcon={<Send className="h-3.5 w-3.5" />}
                  loading={replyMutation.isPending}
                  disabled={!replyBody.trim()}
                  onClick={handleReply}
                >
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Owner / Assign */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned to</p>
              {(isAdmin || !conv.ownerUserId || conv.ownerUserId === user?.id) && (
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => setShowAssign((v) => !v)}
                >
                  {showAssign ? "Cancel" : "Reassign"}
                </button>
              )}
            </div>
            {showAssign ? (
              <div className="space-y-2">
                <select
                  className="input w-full text-sm"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                >
                  <option value="">Select user…</option>
                  {usersData?.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
                <input
                  className="input w-full text-sm"
                  placeholder="Reason (optional)"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  loading={assignMutation.isPending}
                  disabled={!assignUserId}
                  onClick={handleAssign}
                >
                  Assign
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <span className="text-sm text-gray-700">
                  {conv.ownerName ?? <span className="text-amber-600">Unassigned</span>}
                </span>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
            <div className="space-y-1.5 text-sm">
              {conv.contactName && <p className="font-medium text-gray-900">{conv.contactName}</p>}
              {conv.contactEmail && (
                <p className="text-gray-500 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {conv.contactEmail}
                </p>
              )}
              {conv.contactPhone && (
                <p className="text-gray-500 flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {conv.contactPhone}
                </p>
              )}
            </div>
          </div>

          {/* Lead card */}
          {conv.leadId && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</p>
                <a
                  href={`/dashboard/leads/${conv.leadId}`}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-0.5"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-gray-900">{conv.leadName}</p>
                {conv.leadStatus && (
                  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                    {conv.leadStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Campaign */}
          {conv.campaignId && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</p>
                <a
                  href={`/dashboard/campaigns/${conv.campaignId}`}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-0.5"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-sm text-gray-700">{conv.campaignName}</p>
            </div>
          )}

          {/* Assignment history */}
          {conv.assignments.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Assignment history
              </p>
              <div className="space-y-2">
                {conv.assignments.map((a) => (
                  <div key={a.id} className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{a.changedByName ?? "System"}</span>
                    {" → "}
                    <span className="font-medium text-gray-700">{a.toUserName}</span>
                    {a.reason && <span className="italic"> "{a.reason}"</span>}
                    <span className="block text-gray-400">{formatTs(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
