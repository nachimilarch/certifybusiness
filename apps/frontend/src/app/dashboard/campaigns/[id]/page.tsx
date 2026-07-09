"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Mail,
  MessageSquare,
  MessageCircle,
  Clock,
  Users,
  Send,
  CheckCircle2,
  MessageCircle as ReplyIcon,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  useCampaign,
  useLaunchCampaign,
  usePauseCampaign,
  useResumeCampaign,
} from "../../../../hooks/useCampaigns";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { CampaignStatus, ChannelType } from "../../../../types/api";

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
  email: <Mail className="h-5 w-5 text-purple-600" />,
  whatsapp: <MessageSquare className="h-5 w-5 text-green-600" />,
  sms: <MessageCircle className="h-5 w-5 text-blue-600" />,
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pct(num: number, denom: number) {
  if (!denom) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, sub, color = "text-gray-900", icon }: StatCardProps) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="flex-shrink-0 rounded-lg bg-gray-50 p-2">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({
  params
}: {
  params: { id: string } // ✅ Not a Promise in Next.js 14
}) {
  const { id } = params; // ✅ Direct destructuring
  const router = useRouter();

  const [launchOpen, setLaunchOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [apiError, setApiError] = useState("");

  const { data: campaign, isLoading } = useCampaign(id);
  const launchCampaign = useLaunchCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();

  async function handleLaunch() {
    setApiError("");
    try {
      // datetime-local gives "YYYY-MM-DDTHH:mm" (no tz) — convert to ISO string
      const isoAt = scheduledAt ? new Date(scheduledAt).toISOString() : null;
      await launchCampaign.mutateAsync({ id, scheduledAt: isoAt });
      setLaunchOpen(false);
      setScheduledAt("");
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handlePause() {
    await pauseCampaign.mutateAsync(id);
  }

  async function handleResume() {
    await resumeCampaign.mutateAsync(id);
  }

  if (isLoading || !campaign) {
    return <PageSpinner />;
  }

  const { status } = campaign;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All Campaigns
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {CHANNEL_ICONS[campaign.channel]}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
                  {status}
                </span>
                {campaign.listName && <span>· {campaign.listName}</span>}
                {campaign.senderName && <span>· {campaign.senderName}</span>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {status === "draft" && (
              <Button
                leftIcon={<Play className="h-4 w-4" />}
                loading={launchCampaign.isPending}
                onClick={() => setLaunchOpen(true)}
              >
                Launch
              </Button>
            )}
            {status === "scheduled" && (
              <Button
                leftIcon={<Play className="h-4 w-4" />}
                loading={launchCampaign.isPending}
                onClick={() => launchCampaign.mutateAsync({ id, scheduledAt: null })}
              >
                Send Now
              </Button>
            )}
            {status === "running" && (
              <Button
                variant="secondary"
                leftIcon={<Pause className="h-4 w-4" />}
                loading={pauseCampaign.isPending}
                onClick={handlePause}
              >
                Pause
              </Button>
            )}
            {status === "paused" && (
              <Button
                leftIcon={<RotateCcw className="h-4 w-4" />}
                loading={resumeCampaign.isPending}
                onClick={handleResume}
              >
                Resume
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Timestamps row */}
      <div className="card p-4 mb-5 flex flex-wrap gap-6 text-sm text-gray-500">
        <span><span className="font-medium text-gray-700">Created:</span> {formatDate(campaign.createdAt)}</span>
        {campaign.scheduledAt && <span><span className="font-medium text-gray-700">Scheduled:</span> {formatDate(campaign.scheduledAt)}</span>}
        {campaign.startedAt && <span><span className="font-medium text-gray-700">Started:</span> {formatDate(campaign.startedAt)}</span>}
        {campaign.completedAt && <span><span className="font-medium text-gray-700">Completed:</span> {formatDate(campaign.completedAt)}</span>}
        <span><span className="font-medium text-gray-700">Created by:</span> {campaign.createdByName}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Contacts"
          value={campaign.totalContacts}
          icon={<Users className="h-5 w-5 text-gray-500" />}
        />
        <StatCard
          label="Sent"
          value={campaign.sentCount}
          sub={pct(campaign.sentCount, campaign.totalContacts)}
          icon={<Send className="h-5 w-5 text-blue-500" />}
          color="text-blue-700"
        />
        <StatCard
          label="Delivered"
          value={campaign.deliveredCount}
          sub={pct(campaign.deliveredCount, campaign.sentCount)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          color="text-green-700"
        />
        <StatCard
          label="Replied"
          value={campaign.repliedCount}
          sub={pct(campaign.repliedCount, campaign.deliveredCount)}
          icon={<ReplyIcon className="h-5 w-5 text-indigo-500" />}
          color="text-indigo-700"
        />
      </div>

      {campaign.channel === "email" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Opened"
            value={campaign.openedCount}
            sub={pct(campaign.openedCount, campaign.deliveredCount)}
            icon={<Mail className="h-5 w-5 text-purple-500" />}
            color="text-purple-700"
          />
          <StatCard
            label="Clicked"
            value={campaign.clickedCount}
            sub={pct(campaign.clickedCount, campaign.openedCount)}
            icon={<CheckCircle2 className="h-5 w-5 text-teal-500" />}
            color="text-teal-700"
          />
          <StatCard
            label="Bounced"
            value={campaign.bouncedCount}
            sub={pct(campaign.bouncedCount, campaign.sentCount)}
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
            color="text-orange-700"
          />
          <StatCard
            label="Failed"
            value={campaign.failedCount}
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            color="text-red-700"
          />
          {campaign.unsubscribedCount > 0 && (
            <StatCard
              label="Unsubscribed"
              value={campaign.unsubscribedCount}
              sub={pct(campaign.unsubscribedCount, campaign.sentCount)}
              icon={<XCircle className="h-5 w-5 text-gray-400" />}
              color="text-gray-500"
            />
          )}
        </div>
      )}

      {/* Steps */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Campaign Steps</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {campaign.steps.map((step) => (
            <div key={step.id} className="px-4 py-3 flex items-start gap-4">
              <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                {step.stepNumber}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">
                    {step.templateName ?? "No template"}
                  </p>
                  {step.subject && (
                    <span className="text-xs text-gray-500 truncate">Subject: {step.subject}</span>
                  )}
                </div>
                {step.stepNumber > 1 && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Send after {step.delayDays > 0 ? `${step.delayDays}d ` : ""}
                    {step.delayHours > 0 ? `${step.delayHours}h` : ""}
                    {step.delayDays === 0 && step.delayHours === 0 ? "0h" : ""}
                  </p>
                )}
                {step.body && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{step.body}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Launch Modal */}
      <Modal
        open={launchOpen}
        onClose={() => { setLaunchOpen(false); setScheduledAt(""); setApiError(""); }}
        title="Launch Campaign"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLaunchOpen(false)}>Cancel</Button>
            <Button
              loading={launchCampaign.isPending}
              onClick={handleLaunch}
            >
              {scheduledAt ? "Schedule" : "Send Now"}
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
          <p className="text-sm text-gray-600">
            Launch <strong>{campaign.name}</strong> to {campaign.totalContacts.toLocaleString()} contacts.
            Leave the schedule field blank to send immediately.
          </p>
          <Input
            label="Schedule for later (optional)"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
