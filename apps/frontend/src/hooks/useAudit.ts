"use client";

import { useQuery } from "@tanstack/react-query";
import { auditApi, type ListAuditLogsParams } from "../lib/api/audit";

export function useAuditLogs(params?: ListAuditLogsParams) {
  return useQuery({
    queryKey: ["audit-logs", params] as const,
    queryFn: () => auditApi.list(params),
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: ["audit-logs", "actions"] as const,
    queryFn: () => auditApi.actions(),
    staleTime: 60_000,
  });
}
