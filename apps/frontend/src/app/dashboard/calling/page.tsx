"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, PhoneCall, PhoneOff, Clock, BarChart2, AlertCircle } from "lucide-react";
import { useCallQueue, useLogCall, useMyStats, useFollowUps } from "../../../hooks/useCalling";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Tabs, TabList, Tab, TabPanel } from "../../../components/ui/Tabs";
import { PageSpinner } from "../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { CallQueueItemDTO, CallOutcome, FollowUpDTO } from "../../../types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Connected",
  no_answer: "No Answer",
  busy: "Busy",
  wrong_number: "Wrong Number",
  callback_requested: "Callback Requested",
  interested: "Interested",
  not_interested: "Not Interested",
  do_not_call: "Do Not Call",
};

const OUTCOME_COLORS: Record<CallOutcome, string> = {
  connected: "bg-blue-100 text-blue-700",
  no_answer: "bg-gray-100 text-gray-500",
  busy: "bg-yellow-100 text-yellow-700",
  wrong_number: "bg-red-100 text-red-700",
  callback_requested: "bg-purple-100 text-purple-700",
  interested: "bg-green-100 text-green-700",
  not_interested: "bg-orange-100 text-orange-700",
  do_not_call: "bg-red-200 text-red-800",
};

const QUEUE_STATUS_LABELS = {
  not_called: "Never Called",
  follow_up_due: "Follow-up Overdue",
  follow_up_today: "Follow-up Today",
  in_progress: "In Progress",
  done: "Done",
};

const QUEUE_STATUS_COLORS = {
  not_called: "bg-gray-100 text-gray-600",
  follow_up_due: "bg-red-100 text-red-700",
  follow_up_today: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Log Call schema ──────────────────────────────────────────────────────────

const logCallSchema = z.object({
  outcome: z.enum([
    "connected",
    "no_answer",
    "busy",
    "wrong_number",
    "callback_requested",
    "interested",
    "not_interested",
    "do_not_call",
  ]),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  followUpAt: z.string().optional(),
  notes: z.string().optional(),
  convertToLead: z.boolean().default(false),
});

type LogCallForm = z.infer<typeof logCallSchema>;

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Queue row ────────────────────────────────────────────────────────────────

function QueueRow({
  item,
  onCall,
}: {
  item: CallQueueItemDTO;
  onCall: (item: CallQueueItemDTO) => void;
}) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">{item.fullName}</p>
          {item.company && <p className="text-xs text-gray-400">{item.company}</p>}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{item.phone ?? "—"}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{item.listName}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            QUEUE_STATUS_COLORS[item.queueStatus]
          }`}
        >
          {QUEUE_STATUS_LABELS[item.queueStatus]}
        </span>
      </td>
      <td className="px-4 py-3">
        {item.lastOutcome ? (
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              OUTCOME_COLORS[item.lastOutcome]
            }`}
          >
            {OUTCOME_LABELS[item.lastOutcome]}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(item.lastCalledAt)}</td>
      <td className="px-4 py-3">
        <Button
          size="sm"
          leftIcon={<PhoneCall className="h-3.5 w-3.5" />}
          onClick={() => onCall(item)}
          disabled={!item.phone}
        >
          Log Call
        </Button>
      </td>
    </tr>
  );
}

// ─── Follow-up row ────────────────────────────────────────────────────────────

function FollowUpRow({ item }: { item: FollowUpDTO }) {
  return (
    <tr className={item.isOverdue ? "bg-red-50" : "hover:bg-gray-50"}>
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">{item.contactName}</p>
          {item.leadName && (
            <p className="text-xs text-gray-400">Lead: {item.leadName}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{item.contactPhone ?? "—"}</td>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-medium ${
            item.isOverdue ? "text-red-700" : "text-gray-700"
          }`}
        >
          {item.isOverdue && <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
          {formatDateTime(item.followUpAt)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            OUTCOME_COLORS[item.lastOutcome]
          }`}
        >
          {OUTCOME_LABELS[item.lastOutcome]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{item.notes ?? "—"}</td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallingPage() {
  const [queuePage, setQueuePage] = useState(1);
  const [fuPage, setFuPage] = useState(1);
  const [activeContact, setActiveContact] = useState<CallQueueItemDTO | null>(null);
  const [apiError, setApiError] = useState("");

  const { data: queue, isLoading: queueLoading } = useCallQueue({ page: queuePage, limit: 25 });
  const { data: followUps, isLoading: fuLoading } = useFollowUps({ page: fuPage, limit: 25 });
  const { data: stats } = useMyStats();
  const logCall = useLogCall();

  const form = useForm<LogCallForm>({
    resolver: zodResolver(logCallSchema),
    defaultValues: { outcome: "no_answer", durationSeconds: 0, convertToLead: false },
  });

  async function handleLogCall(values: LogCallForm) {
    if (!activeContact) return;
    setApiError("");
    try {
      await logCall.mutateAsync({
        uploadedContactId: activeContact.id,
        calledPhone: activeContact.phone ?? undefined,
        outcome: values.outcome,
        durationSeconds: values.durationSeconds,
        followUpAt: values.followUpAt
          ? new Date(values.followUpAt).toISOString()
          : null,
        notes: values.notes || null,
        convertToLead: values.convertToLead,
      });
      setActiveContact(null);
      form.reset();
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error logging call");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cold Calling</h1>
        <p className="text-sm text-gray-500 mt-1">Work your call queue and log outcomes</p>
      </div>

      {/* My stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Phone className="h-5 w-5" />}
            label="Today"
            value={stats.callsToday}
          />
          <StatCard
            icon={<BarChart2 className="h-5 w-5" />}
            label="This Week"
            value={stats.callsThisWeek}
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Overdue Follow-ups"
            value={stats.overdueFollowUps}
          />
          <StatCard
            icon={<PhoneOff className="h-5 w-5" />}
            label="Connected"
            value={stats.outcomeBreakdown["connected"] ?? 0}
            sub="this week"
          />
        </div>
      )}

      {/* Tabs: Queue / Follow-ups */}
      <Tabs defaultTab="queue">
        <TabList className="mb-5">
          <Tab id="queue">
            Call Queue
            {queue && (
              <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5">
                {queue.meta.total}
              </span>
            )}
          </Tab>
          <Tab id="followups">
            Follow-ups
            {followUps && followUps.meta.total > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 text-red-700 text-xs px-1.5 py-0.5">
                {followUps.meta.total}
              </span>
            )}
          </Tab>
        </TabList>

        {/* ── Queue tab ─────────────────────────────────────────────────────── */}
        <TabPanel id="queue">
          <div className="card overflow-hidden">
            {queueLoading ? (
              <PageSpinner />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Contact", "Phone", "List", "Queue Status", "Last Outcome", "Last Called", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {queue?.data.map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      onCall={(c) => {
                        setActiveContact(c);
                        form.reset({ outcome: "no_answer", durationSeconds: 0, convertToLead: false });
                      }}
                    />
                  ))}
                  {queue?.data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        Queue is empty. Upload a contact list to start calling.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {queue && queue.meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  {(queuePage - 1) * 25 + 1}–{Math.min(queuePage * 25, queue.meta.total)} of{" "}
                  {queue.meta.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={queuePage === 1}
                    onClick={() => setQueuePage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={queuePage === queue.meta.pages}
                    onClick={() => setQueuePage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabPanel>

        {/* ── Follow-ups tab ─────────────────────────────────────────────────── */}
        <TabPanel id="followups">
          <div className="card overflow-hidden">
            {fuLoading ? (
              <PageSpinner />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Contact", "Phone", "Follow-up At", "Last Outcome", "Notes"].map((h) => (
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
                  {followUps?.data.map((fu) => (
                    <FollowUpRow key={fu.id} item={fu} />
                  ))}
                  {followUps?.data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                        No follow-ups scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {followUps && followUps.meta.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  {(fuPage - 1) * 25 + 1}–{Math.min(fuPage * 25, followUps.meta.total)} of{" "}
                  {followUps.meta.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={fuPage === 1}
                    onClick={() => setFuPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={fuPage === followUps.meta.pages}
                    onClick={() => setFuPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>

      {/* ── Log Call Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={!!activeContact}
        onClose={() => { setActiveContact(null); setApiError(""); }}
        title={`Log Call — ${activeContact?.fullName ?? ""}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveContact(null)}>
              Cancel
            </Button>
            <Button loading={logCall.isPending} onClick={form.handleSubmit(handleLogCall)}>
              Save Call Log
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {activeContact && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
            <strong>{activeContact.fullName}</strong>
            {activeContact.phone && (
              <span className="ml-2 font-mono">{activeContact.phone}</span>
            )}
            {activeContact.company && (
              <span className="ml-2 text-blue-600">· {activeContact.company}</span>
            )}
          </div>
        )}

        <div className="space-y-4">
          <Select
            label="Outcome"
            required
            options={[
              { value: "connected", label: "Connected" },
              { value: "no_answer", label: "No Answer" },
              { value: "busy", label: "Busy" },
              { value: "wrong_number", label: "Wrong Number" },
              { value: "callback_requested", label: "Callback Requested" },
              { value: "interested", label: "Interested" },
              { value: "not_interested", label: "Not Interested" },
              { value: "do_not_call", label: "Do Not Call (DNC)" },
            ]}
            error={form.formState.errors.outcome?.message}
            {...form.register("outcome")}
          />
          <Input
            label="Duration (seconds)"
            type="number"
            min={0}
            {...form.register("durationSeconds", { valueAsNumber: true })}
          />
          <Input
            label="Schedule Follow-up"
            type="datetime-local"
            hint="Optional — schedules a follow-up task"
            {...form.register("followUpAt")}
          />
          <Textarea
            label="Notes"
            placeholder="What was discussed?"
            {...form.register("notes")}
          />
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="convertToLead"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...form.register("convertToLead")}
            />
            <label htmlFor="convertToLead" className="text-sm text-gray-700">
              Convert to Lead (creates or updates a lead record)
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
