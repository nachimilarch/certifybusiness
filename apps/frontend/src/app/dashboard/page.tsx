"use client";

import { Users, Phone, TrendingUp, Clock, AlertCircle, CheckCircle2, BarChart2 } from "lucide-react";
import { useDashboardStats } from "../../hooks/useReporting";
import { useMyStats } from "../../hooks/useCalling";
import { Spinner } from "../../components/ui/Spinner";

function StatCard({
  label,
  value,
  icon,
  iconBg,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div className="card p-6 flex items-center gap-4">
      <div className={`${iconBg} flex h-12 w-12 items-center justify-center rounded-xl shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-gray-500 capitalize truncate">{label.replace(/_/g, " ")}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-gray-700 font-medium">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: myStats } = useMyStats();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back — here's what's happening today.</p>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : stats ? (
        <>
          {/* ── Top stat cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              label="Total Leads"
              value={stats.leads.total.toLocaleString()}
              icon={<Users className="h-6 w-6 text-white" />}
              iconBg="bg-blue-500"
              sub={`+${stats.leads.newToday} today`}
            />
            <StatCard
              label="Calls Today"
              value={stats.calls.today}
              icon={<Phone className="h-6 w-6 text-white" />}
              iconBg="bg-green-500"
              sub={`${stats.calls.thisWeek} this week`}
            />
            <StatCard
              label="Conversion Rate"
              value={`${stats.calls.conversionRate}%`}
              icon={<TrendingUp className="h-6 w-6 text-white" />}
              iconBg="bg-purple-500"
              sub="calls → leads"
            />
            <StatCard
              label="Overdue Follow-ups"
              value={stats.followUps.overdue}
              icon={<AlertCircle className="h-6 w-6 text-white" />}
              iconBg={stats.followUps.overdue > 0 ? "bg-red-500" : "bg-gray-400"}
              sub={`${stats.followUps.dueToday} due today`}
            />
          </div>

          {/* ── Charts row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Lead status breakdown */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-gray-400" /> Leads by Status
              </h3>
              <div className="space-y-2.5">
                {Object.entries(stats.leads.byStatus).map(([k, v]) => (
                  <MiniBar
                    key={k}
                    label={k}
                    value={v}
                    max={stats.leads.total || 1}
                    color="bg-blue-400"
                  />
                ))}
              </div>
            </div>

            {/* Call outcome breakdown */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" /> Call Outcomes (week)
              </h3>
              <div className="space-y-2.5">
                {Object.entries(stats.calls.byOutcome).map(([k, v]) => (
                  <MiniBar
                    key={k}
                    label={k}
                    value={v}
                    max={stats.calls.thisWeek || 1}
                    color="bg-green-400"
                  />
                ))}
                {Object.keys(stats.calls.byOutcome).length === 0 && (
                  <p className="text-xs text-gray-400">No calls this week.</p>
                )}
              </div>
            </div>

            {/* My stats */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gray-400" /> My Activity
              </h3>
              {myStats ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calls today</span>
                    <span className="font-semibold text-gray-900">{myStats.callsToday}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calls this week</span>
                    <span className="font-semibold text-gray-900">{myStats.callsThisWeek}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overdue follow-ups</span>
                    <span
                      className={`font-semibold ${
                        myStats.overdueFollowUps > 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {myStats.overdueFollowUps}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400 mb-1.5">Outcome breakdown</p>
                    <div className="space-y-1.5">
                      {Object.entries(myStats.outcomeBreakdown).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="text-gray-700">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No personal stats yet.</p>
              )}
            </div>
          </div>

          {/* ── Tasks & follow-ups row ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-5">
            <div className="card p-5 flex items-center gap-4">
              <div className="rounded-lg bg-orange-50 p-2.5 text-orange-500">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Tasks Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{stats.tasks.overdue}</p>
                <p className="text-xs text-gray-400">{stats.tasks.dueToday} due today</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="rounded-lg bg-yellow-50 p-2.5 text-yellow-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">New Leads (week)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.leads.newThisWeek}</p>
                <p className="text-xs text-gray-400">{stats.leads.newToday} today</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card p-8 text-center text-gray-400">
          <p className="text-sm">Could not load dashboard stats.</p>
        </div>
      )}
    </div>
  );
}
