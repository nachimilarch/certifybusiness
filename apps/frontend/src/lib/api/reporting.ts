import { apiClient } from "../api";
import type {
  ApiOk,
  DashboardStats,
  CampaignSummaryStats,
  LeadsByChannelItem,
  LeadsByEmployeeItem,
  ConversionFunnelItem,
  CallActivityItem,
} from "../../types/api";

export interface TeamMemberPerformance {
  userId: string;
  name: string;
  callsThisWeek: number;
  leadsAssigned: number;
}

export const reportingApi = {
  getDashboard: () =>
    apiClient.get<ApiOk<DashboardStats>>("/reporting/dashboard").then((r) => r.data.data),

  getTeamPerformance: (managerId?: string) =>
    apiClient
      .get<ApiOk<TeamMemberPerformance[]>>(
        managerId ? `/reporting/team-performance/${managerId}` : "/reporting/team-performance"
      )
      .then((r) => r.data.data),

  getCampaignSummary: () =>
    apiClient.get<ApiOk<CampaignSummaryStats>>("/reporting/campaigns").then((r) => r.data.data),

  getLeadsByChannel: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<ApiOk<LeadsByChannelItem[]>>("/reporting/leads-by-channel", { params })
      .then((r) => r.data.data),

  getLeadsByEmployee: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<ApiOk<LeadsByEmployeeItem[]>>("/reporting/leads-by-employee", { params })
      .then((r) => r.data.data),

  getConversionFunnel: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<ApiOk<ConversionFunnelItem[]>>("/reporting/conversion-funnel", { params })
      .then((r) => r.data.data),

  getCallActivity: (params?: { from?: string; to?: string }) =>
    apiClient
      .get<ApiOk<CallActivityItem[]>>("/reporting/call-activity", { params })
      .then((r) => r.data.data),
};
