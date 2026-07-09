"use client";

import { useState } from "react";
import {
  Mail, MessageSquare, MessageCircle, Copy, Check, CheckCircle2, XCircle,
  Loader2, Webhook, RefreshCw,
} from "lucide-react";
import { useSenders, useTestSender, useWebhookUrls } from "../../../../hooks/useChannels";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { Tabs, TabList, Tab, TabPanel } from "../../../../components/ui/Tabs";
import type { SenderIdentityDTO, ChannelType } from "../../../../types/api";

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

// ─── Test Button ──────────────────────────────────────────────────────────────

function TestButton({ senderId }: { senderId: string }) {
  const testSender = useTestSender();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleTest() {
    setResult(null);
    const res = await testSender.mutateAsync(senderId);
    setResult(res);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTest}
        disabled={testSender.isPending}
        className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {testSender.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Test
      </button>
      {result && (
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            result.success ? "text-green-600" : "text-red-600"
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {result.message}
        </span>
      )}
    </div>
  );
}

// ─── Sender Card ──────────────────────────────────────────────────────────────

function SenderCard({ sender }: { sender: SenderIdentityDTO }) {
  const identifier =
    sender.fromAddress ?? sender.whatsappNumber ?? sender.smsSenderId ?? "—";

  return (
    <div className="flex items-start justify-between p-4 border border-gray-100 rounded-xl bg-white hover:bg-gray-50 transition-colors">
      <div className="space-y-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{sender.name}</p>
        <p className="text-xs font-mono text-gray-500">{identifier}</p>
        <div className="flex items-center gap-2 pt-1">
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              sender.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {sender.isActive ? "Active" : "Inactive"}
          </span>
          <span
            className={`text-xs rounded-full px-2 py-0.5 font-medium ${
              sender.hasCredentials
                ? "bg-blue-100 text-blue-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {sender.hasCredentials ? "Credentials stored" : "No credentials"}
          </span>
        </div>
      </div>
      <TestButton senderId={sender.id} />
    </div>
  );
}

// ─── Channel Panel ────────────────────────────────────────────────────────────

function ChannelPanel({ channel }: { channel: ChannelType }) {
  const { data: senders, isLoading } = useSenders(channel);

  if (isLoading) return <PageSpinner />;

  if (!senders || senders.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No {channel} sender identities configured.{" "}
        <a href="/dashboard/settings/senders" className="text-brand-600 hover:underline">
          Add one
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      {senders.map((s) => (
        <SenderCard key={s.id} sender={s} />
      ))}
    </div>
  );
}

// ─── Webhook URLs Panel ───────────────────────────────────────────────────────

function WebhookUrlsPanel() {
  const { data: urls, isLoading } = useWebhookUrls();

  const WEBHOOK_INFO: Array<{ key: string; label: string; description: string }> = [
    { key: "ses_notification", label: "AWS SES SNS Notification", description: "Configure this URL in your AWS SNS topic subscriptions for bounce/complaint/delivery events" },
    { key: "whatsapp_verify", label: "WhatsApp Webhook (Verify + Events)", description: "Set this as your webhook URL in Meta App Dashboard → WhatsApp → Configuration" },
    { key: "sms_delivery", label: "SMS Delivery Report", description: "Configure this URL in your SMS provider dashboard to receive delivery status callbacks" },
  ];

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-3 pt-4">
      {WEBHOOK_INFO.map(({ key, label, description }) => {
        const url = urls?.[key] ?? "";
        return (
          <div key={key} className="p-4 border border-gray-100 rounded-xl bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                <p className="text-xs font-mono text-gray-700 mt-2 bg-gray-50 rounded-lg px-3 py-2 break-all">
                  {url}
                </p>
              </div>
              <CopyButton text={url} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage channel credentials and webhook endpoints
        </p>
      </div>

      <Tabs defaultTab="email">
        <TabList>
          <Tab id="email">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email (SES)
            </span>
          </Tab>
          <Tab id="whatsapp">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              WhatsApp
            </span>
          </Tab>
          <Tab id="sms">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              SMS
            </span>
          </Tab>
          <Tab id="webhooks">
            <span className="flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              Webhook URLs
            </span>
          </Tab>
        </TabList>

        <TabPanel id="email">
          <ChannelPanel channel="email" />
        </TabPanel>
        <TabPanel id="whatsapp">
          <ChannelPanel channel="whatsapp" />
        </TabPanel>
        <TabPanel id="sms">
          <ChannelPanel channel="sms" />
        </TabPanel>
        <TabPanel id="webhooks">
          <WebhookUrlsPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}
