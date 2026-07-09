"use client";

import type { ActivityDTO, ActivityType } from "../../types/api";

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email_sent: "Email sent",
  email_reply: "Email reply",
  whatsapp_sent: "WhatsApp sent",
  whatsapp_reply: "WhatsApp reply",
  sms_sent: "SMS sent",
  sms_reply: "SMS reply",
  note: "Note",
  task: "Task",
  status_change: "Status changed",
  assignment: "Assigned",
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call: "bg-blue-100 text-blue-700",
  email_sent: "bg-purple-100 text-purple-700",
  email_reply: "bg-purple-100 text-purple-700",
  whatsapp_sent: "bg-green-100 text-green-700",
  whatsapp_reply: "bg-green-100 text-green-700",
  sms_sent: "bg-yellow-100 text-yellow-700",
  sms_reply: "bg-yellow-100 text-yellow-700",
  note: "bg-gray-100 text-gray-700",
  task: "bg-orange-100 text-orange-700",
  status_change: "bg-indigo-100 text-indigo-700",
  assignment: "bg-teal-100 text-teal-700",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

interface ActivityTimelineProps {
  activities: ActivityDTO[];
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {activities.map((a) => (
        <li key={a.id} className="ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
            <span
              className={`text-xs font-bold ${ACTIVITY_COLORS[a.type].split(" ")[1]}`}
            >
              {a.type[0].toUpperCase()}
            </span>
          </span>
          <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTIVITY_COLORS[a.type]}`}
              >
                {ACTIVITY_LABELS[a.type]}
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatDate(a.createdAt)}</span>
            </div>
            {a.subject && (
              <p className="mt-1 text-sm font-medium text-gray-800">{a.subject}</p>
            )}
            {a.body && (
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
            )}
            {a.userName && (
              <p className="mt-1.5 text-xs text-gray-400">by {a.userName}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
