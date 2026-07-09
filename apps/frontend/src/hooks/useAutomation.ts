"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { automationApi, type CreateRulePayload, type UpdateRulePayload } from "../lib/api/automation";

export const automationKeys = {
  all: ["automation"] as const,
  rules: () => ["automation", "rules"] as const,
  rule: (id: string) => ["automation", "rule", id] as const,
  logs: (page: number) => ["automation", "logs", page] as const,
};

export function useAutomationRules() {
  return useQuery({
    queryKey: automationKeys.rules(),
    queryFn: automationApi.listRules,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRulePayload) => automationApi.createRule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRulePayload }) =>
      automationApi.updateRule(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationApi.deleteRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useAutomationLogs(page = 1) {
  return useQuery({
    queryKey: automationKeys.logs(page),
    queryFn: () => automationApi.listLogs(page),
  });
}
