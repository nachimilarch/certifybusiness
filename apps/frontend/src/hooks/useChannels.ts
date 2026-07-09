"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { channelsApi, type CreateSenderPayload, type CreateTemplatePayload } from "../lib/api/channels";
import type { ChannelType } from "../types/api";

export const channelKeys = {
  senders: (channel?: ChannelType) => ["channels", "senders", channel] as const,
  sender: (id: string) => ["channels", "sender", id] as const,
  templates: (channel?: ChannelType) => ["channels", "templates", channel] as const,
  template: (id: string) => ["channels", "template", id] as const,
  webhookUrls: () => ["channels", "webhook-urls"] as const,
};

// ─── Senders ──────────────────────────────────────────────────────────────────

export function useSenders(channel?: ChannelType) {
  return useQuery({
    queryKey: channelKeys.senders(channel),
    queryFn: () => channelsApi.listSenders(channel),
  });
}

export function useCreateSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSenderPayload) => channelsApi.createSender(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "senders"] }),
  });
}

export function useUpdateSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSenderPayload> & { isActive?: boolean } }) =>
      channelsApi.updateSender(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "senders"] }),
  });
}

export function useDeleteSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => channelsApi.deleteSender(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "senders"] }),
  });
}

export function useTestSender() {
  return useMutation({
    mutationFn: (id: string) => channelsApi.testSender(id),
  });
}

export function useWebhookUrls() {
  return useQuery({
    queryKey: channelKeys.webhookUrls(),
    queryFn: channelsApi.getWebhookUrls,
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useTemplates(channel?: ChannelType) {
  return useQuery({
    queryKey: channelKeys.templates(channel),
    queryFn: () => channelsApi.listTemplates(channel),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplatePayload) => channelsApi.createTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateTemplatePayload> & { isActive?: boolean };
    }) => channelsApi.updateTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => channelsApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", "templates"] }),
  });
}
