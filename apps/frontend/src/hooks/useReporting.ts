"use client";

import { useQuery } from "@tanstack/react-query";
import { reportingApi } from "../lib/api/reporting";

export const reportingKeys = {
  dashboard: () => ["reporting", "dashboard"] as const,
  teamPerformance: (managerId?: string) =>
    ["reporting", "team-performance", managerId] as const,
  campaignSummary: () => ["reporting", "campaigns"] as const,
  leadsByChannel: (from?: string, to?: string) => ["reporting", "leads-by-channel", from, to] as const,
  leadsByEmployee: (from?: string, to?: string) => ["reporting", "leads-by-employee", from, to] as const,
  conversionFunnel: (from?: string, to?: string) => ["reporting", "conversion-funnel", from, to] as const,
  callActivity: (from?: string, to?: string) => ["reporting", "call-activity", from, to] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: reportingKeys.dashboard(),
    queryFn: reportingApi.getDashboard,
    refetchInterval: 60_000,
  });
}

export function useTeamPerformance(managerId?: string) {
  return useQuery({
    queryKey: reportingKeys.teamPerformance(managerId),
    queryFn: () => reportingApi.getTeamPerformance(managerId),
  });
}

export function useCampaignSummary() {
  return useQuery({
    queryKey: reportingKeys.campaignSummary(),
    queryFn: reportingApi.getCampaignSummary,
  });
}

export function useLeadsByChannel(from?: string, to?: string) {
  return useQuery({
    queryKey: reportingKeys.leadsByChannel(from, to),
    queryFn: () => reportingApi.getLeadsByChannel({ from, to }),
  });
}

export function useLeadsByEmployee(from?: string, to?: string) {
  return useQuery({
    queryKey: reportingKeys.leadsByEmployee(from, to),
    queryFn: () => reportingApi.getLeadsByEmployee({ from, to }),
  });
}

export function useConversionFunnel(from?: string, to?: string) {
  return useQuery({
    queryKey: reportingKeys.conversionFunnel(from, to),
    queryFn: () => reportingApi.getConversionFunnel({ from, to }),
  });
}

export function useCallActivity(from?: string, to?: string) {
  return useQuery({
    queryKey: reportingKeys.callActivity(from, to),
    queryFn: () => reportingApi.getCallActivity({ from, to }),
  });
}

export function useAutomationLogsForReport(page = 1) {
  return useQuery({
    queryKey: ["automation", "logs", page],
    queryFn: () => import("../lib/api/automation").then((m) => m.automationApi.listLogs(page)),
  });
}
