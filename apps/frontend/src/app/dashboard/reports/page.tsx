"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Mail, MessageSquare, MessageCircle, TrendingUp, Send, CheckCircle2,
  MessageCircle as ReplyIcon, Download, Users, PhoneCall, BarChart2,
} from "lucide-react";
import { Tabs, TabList, Tab, TabPanel } from "../../../components/ui/Tabs";
import {
  useCampaignSummary, useTeamPerformance, useLeadsByChannel,
  useLeadsByEmployee, useConversionFunnel, useCallActivity,
} from "../../../hooks/useReporting";
import { PageSpinner } from "../../../components/ui/Spinner";
import type { CampaignStatus, ChannelType } from "../../../types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const CHANNEL_ICONS: Record<ChannelType, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-purple-500" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-500" />,
  sms: <MessageCircle className="h-4 w-4 text-blue-500" />,
};

const FUNNEL_COLORS: Record<string, string> = {
  new: "#6366f1",
  contacted: "#3b82f6",
  interested: "#0ea5e9",
  follow_up: "#f59e0b",
  converted: "#10b981",
  dead: "#9ca3af",
  do_not_contact: "#ef4444",
};

const CALL_OUTCOME_COLORS: Record<string, string> = {
  connected: "#10b981",
  no_answer: "#9ca3af",
  busy: "#f59e0b",
  wrong_number: "#ef4444",
  callback_requested: "#3b82f6",
  interested: "#6366f1",
  not_interested: "#f97316",
  do_not_call: "#dc2626",
};

const BAR_COLORS = ["#6366f1", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#8b5cf6", "#ec4899"];

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RateBar({ value, total, color }: { value: number; total: number; color: string }) {
  const p = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{p}%</span>
    </div>
  );
}

function DateRangePicker({
  from, to, onChange,
}: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={() => onChange("", "")}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SectionHeader({
  title, icon, onExport,
}: {
  title: string; icon: React.ReactNode; onExport?: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      {onExport && (
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: summary, isLoading } = useCampaignSummary();
  const { data: team } = useTeamPerformance();

  if (isLoading) return <PageSpinner />;

  function handleExportCampaigns() {
    if (!summary) return;
    exportCsv(
      "campaigns.csv",
      ["Name", "Channel", "Status", "Contacts", "Sent", "Delivered", "Replied", "Bounced"],
      summary.campaigns.map((c) => [c.name, c.channel, c.status, c.totalContacts, c.sentCount, c.deliveredCount, c.repliedCount, c.bouncedCount]),
    );
  }

  function handleExportTeam() {
    if (!team) return;
    exportCsv(
      "team-performance.csv",
      ["Name", "Calls This Week", "Leads Assigned"],
      team.map((m) => [m.name, m.callsThisWeek, m.leadsAssigned]),
    );
  }

  return (
    <div className="space-y-6 pt-6">
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Campaigns", value: summary.totalCampaigns, icon: <TrendingUp className="h-5 w-5 text-gray-500" /> },
              { label: "Total Sent", value: summary.totalSent.toLocaleString(), icon: <Send className="h-5 w-5 text-blue-500" /> },
              { label: "Total Delivered", value: summary.totalDelivered.toLocaleString(), icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> },
              { label: "Total Replies", value: summary.totalReplied.toLocaleString(), icon: <ReplyIcon className="h-5 w-5 text-indigo-500" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="card p-4 flex items-center gap-3">
                <div className="rounded-lg bg-gray-50 p-2 flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <SectionHeader
              title="Campaign Performance"
              icon={<Send className="h-4 w-4 text-gray-400" />}
              onExport={handleExportCampaigns}
            />
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Campaign", "Ch", "Status", "Contacts", "Sent rate", "Delivery rate", "Reply rate"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {summary.campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{c.name}</td>
                    <td className="px-4 py-3">{CHANNEL_ICONS[c.channel]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.totalContacts.toLocaleString()}</td>
                    <td className="px-4 py-3 w-32">
                      <RateBar value={c.sentCount} total={c.totalContacts} color="bg-blue-400" />
                    </td>
                    <td className="px-4 py-3 w-32">
                      <RateBar value={c.deliveredCount} total={c.sentCount} color="bg-green-400" />
                    </td>
                    <td className="px-4 py-3 w-32">
                      <RateBar value={c.repliedCount} total={c.deliveredCount} color="bg-indigo-400" />
                    </td>
                  </tr>
                ))}
                {summary.campaigns.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No campaigns yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {team && team.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader
            title="Team Performance (last 7 days)"
            icon={<Users className="h-4 w-4 text-gray-400" />}
            onExport={handleExportTeam}
          />
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Calls this week", "Leads assigned"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {team.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.callsThisWeek}</td>
                  <td className="px-4 py-3 text-gray-600">{m.leadsAssigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Leads Tab ────────────────────────────────────────────────────────────────

function LeadsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: byChannel } = useLeadsByChannel(from || undefined, to || undefined);
  const { data: byEmployee } = useLeadsByEmployee(from || undefined, to || undefined);
  const { data: funnel } = useConversionFunnel(from || undefined, to || undefined);

  const funnelMax = funnel ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  function handleExportChannel() {
    if (!byChannel) return;
    exportCsv("leads-by-channel.csv", ["Source", "Count"], byChannel.map((r) => [r.source, r.count]));
  }
  function handleExportEmployee() {
    if (!byEmployee) return;
    exportCsv("leads-by-employee.csv", ["Name", "Count"], byEmployee.map((r) => [r.name, r.count]));
  }
  function handleExportFunnel() {
    if (!funnel) return;
    exportCsv("conversion-funnel.csv", ["Status", "Count"], funnel.map((r) => [r.status, r.count]));
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Date range</h3>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by channel */}
        <div className="card overflow-hidden">
          <SectionHeader
            title="Leads by Source"
            icon={<BarChart2 className="h-4 w-4 text-gray-400" />}
            onExport={handleExportChannel}
          />
          <div className="p-4">
            {byChannel && byChannel.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byChannel} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {byChannel.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </div>
        </div>

        {/* Leads by employee */}
        <div className="card overflow-hidden">
          <SectionHeader
            title="Leads by Employee"
            icon={<Users className="h-4 w-4 text-gray-400" />}
            onExport={handleExportEmployee}
          />
          <div className="p-4">
            {byEmployee && byEmployee.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={byEmployee}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 60 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {byEmployee.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="card overflow-hidden">
        <SectionHeader
          title="Conversion Funnel"
          icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
          onExport={handleExportFunnel}
        />
        <div className="p-6">
          {funnel && funnel.length > 0 ? (
            <div className="space-y-3">
              {funnel.map((item) => {
                const barWidth = Math.max(4, Math.round((item.count / funnelMax) * 100));
                const color = FUNNEL_COLORS[item.status] ?? "#6366f1";
                return (
                  <div key={item.status} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-medium text-gray-600 capitalize text-right flex-shrink-0">
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="h-7 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                        >
                          {barWidth > 20 && (
                            <span className="text-xs font-semibold text-white">{item.count.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      {barWidth <= 20 && (
                        <span className="text-xs font-semibold text-gray-700 w-10">{item.count.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calls Tab ────────────────────────────────────────────────────────────────

function CallsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: callActivity } = useCallActivity(from || undefined, to || undefined);

  const chartData = callActivity?.map((r) => ({ name: r.name, total: r.total })) ?? [];

  function handleExport() {
    if (!callActivity) return;
    const allOutcomes = Array.from(
      new Set(callActivity.flatMap((r) => Object.keys(r.byOutcome)))
    );
    exportCsv(
      "call-activity.csv",
      ["Name", "Total", ...allOutcomes],
      callActivity.map((r) => [r.name, r.total, ...allOutcomes.map((o) => r.byOutcome[o] ?? 0)]),
    );
  }

  const allOutcomes = callActivity
    ? Array.from(new Set(callActivity.flatMap((r) => Object.keys(r.byOutcome))))
    : [];

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Date range</h3>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="card overflow-hidden">
        <SectionHeader
          title="Call Volume by Employee"
          icon={<PhoneCall className="h-4 w-4 text-gray-400" />}
        />
        <div className="p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {callActivity && callActivity.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader
            title="Outcome Breakdown"
            icon={<CheckCircle2 className="h-4 w-4 text-gray-400" />}
            onExport={handleExport}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                  {allOutcomes.map((o) => (
                    <th key={o} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                      {o.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {callActivity.map((r) => (
                  <tr key={r.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.total}</td>
                    {allOutcomes.map((o) => {
                      const val = r.byOutcome[o] ?? 0;
                      const color = CALL_OUTCOME_COLORS[o];
                      return (
                        <td key={o} className="px-4 py-3">
                          {val > 0 ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: color ?? "#9ca3af" }}
                            >
                              {val}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Campaign performance, lead analytics, and call activity</p>
      </div>

      <Tabs defaultTab="overview">
        <TabList>
          <Tab id="overview">Overview</Tab>
          <Tab id="leads">Leads</Tab>
          <Tab id="calls">Calls</Tab>
        </TabList>

        <TabPanel id="overview"><OverviewTab /></TabPanel>
        <TabPanel id="leads"><LeadsTab /></TabPanel>
        <TabPanel id="calls"><CallsTab /></TabPanel>
      </Tabs>
    </div>
  );
}
