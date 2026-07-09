"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callingApi, type LogCallPayload } from "../lib/api/calling";
import type { CallOutcome } from "../types/api";

export const callingKeys = {
  all: ["calling"] as const,
  queue: (params?: object) => ["calling", "queue", params] as const,
  logs: (params?: object) => ["calling", "logs", params] as const,
  followUps: (params?: object) => ["calling", "follow-ups", params] as const,
  myStats: () => ["calling", "my-stats"] as const,
};

export function useCallQueue(params?: {
  page?: number;
  limit?: number;
  listId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: callingKeys.queue(params),
    queryFn: () => callingApi.getQueue(params),
  });
}

export function useLogCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LogCallPayload) => callingApi.logCall(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: callingKeys.all });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["reporting"] });
    },
  });
}

export function useCallLogs(params?: {
  page?: number;
  limit?: number;
  userId?: string;
  outcome?: CallOutcome;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: callingKeys.logs(params),
    queryFn: () => callingApi.listLogs(params),
  });
}

export function useFollowUps(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: callingKeys.followUps(params),
    queryFn: () => callingApi.getFollowUps(params),
  });
}

export function useMyStats() {
  return useQuery({
    queryKey: callingKeys.myStats(),
    queryFn: callingApi.getMyStats,
  });
}
