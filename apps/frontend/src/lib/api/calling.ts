import { apiClient } from "../api";
import type {
  ApiOk,
  ApiPaginated,
  CallLogDTO,
  CallQueueItemDTO,
  FollowUpDTO,
  CallOutcome,
} from "../../types/api";

export interface LogCallPayload {
  uploadedContactId?: string | null;
  calledPhone?: string;
  calledAt?: string;
  durationSeconds?: number;
  outcome: CallOutcome;
  followUpAt?: string | null;
  notes?: string | null;
  convertToLead?: boolean;
}

export interface LogCallResult {
  callLog: CallLogDTO;
  leadId: string | null;
  leadCreated: boolean;
}

export interface MyStats {
  callsToday: number;
  callsThisWeek: number;
  outcomeBreakdown: Record<string, number>;
  overdueFollowUps: number;
}

export const callingApi = {
  getQueue: (params?: {
    page?: number;
    limit?: number;
    listId?: string;
    status?: string;
  }) =>
    apiClient
      .get<ApiPaginated<CallQueueItemDTO>>("/calling/queue", { params })
      .then((r) => r.data),

  logCall: (data: LogCallPayload) =>
    apiClient
      .post<ApiOk<LogCallResult>>("/calling/logs", data)
      .then((r) => r.data.data),

  listLogs: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    outcome?: CallOutcome;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    apiClient
      .get<ApiPaginated<CallLogDTO>>("/calling/logs", { params })
      .then((r) => r.data),

  getFollowUps: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<ApiPaginated<FollowUpDTO>>("/calling/follow-ups", { params })
      .then((r) => r.data),

  getMyStats: () =>
    apiClient.get<ApiOk<MyStats>>("/calling/stats/me").then((r) => r.data.data),
};
