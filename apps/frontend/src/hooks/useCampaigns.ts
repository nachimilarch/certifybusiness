"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignsApi, type CreateCampaignPayload, type ListCampaignsParams } from "../lib/api/campaigns";

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: (params?: ListCampaignsParams) => ["campaigns", "list", params] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
};

export function useCampaigns(params?: ListCampaignsParams) {
  return useQuery({
    queryKey: campaignKeys.list(params),
    queryFn: () => campaignsApi.list(params),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.data.some(
        (c) => c.status === "running" || c.status === "scheduled"
      );
      return hasActive ? 10_000 : false;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignsApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "scheduled" ? 5_000 : false;
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCampaignPayload) => campaignsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof campaignsApi.update>[1] }) =>
      campaignsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: campaignKeys.all });
      qc.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt?: string | null }) =>
      campaignsApi.launch(id, scheduledAt),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: campaignKeys.all });
      qc.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignsApi.pause(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: campaignKeys.all });
      qc.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignsApi.resume(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: campaignKeys.all });
      qc.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}
