import { apiClient } from "../api";
import type { ApiOk, ApiPaginated, AuditLogDTO } from "../../types/api";

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (params?: ListAuditLogsParams) =>
    apiClient
      .get<ApiPaginated<AuditLogDTO>>("/audit-logs", { params })
      .then((r) => r.data),

  actions: () =>
    apiClient
      .get<ApiOk<string[]>>("/audit-logs/actions")
      .then((r) => r.data.data),
};
