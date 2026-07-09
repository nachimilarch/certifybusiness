import { apiClient } from "../api";
import type { ApiOk, ApiPaginated, AutomationRuleDTO, AutomationLogDTO, AutomationTrigger, AutomationCondition, AutomationAction } from "../../types/api";

export interface CreateRulePayload {
  name: string;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
}

export interface UpdateRulePayload {
  name?: string;
  isActive?: boolean;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
}

export const automationApi = {
  listRules: () =>
    apiClient.get<ApiOk<AutomationRuleDTO[]>>("/automation/rules").then((r) => r.data.data),

  getRule: (id: string) =>
    apiClient.get<ApiOk<AutomationRuleDTO>>(`/automation/rules/${id}`).then((r) => r.data.data),

  createRule: (data: CreateRulePayload) =>
    apiClient.post<ApiOk<AutomationRuleDTO>>("/automation/rules", data).then((r) => r.data.data),

  updateRule: (id: string, data: UpdateRulePayload) =>
    apiClient.patch<ApiOk<AutomationRuleDTO>>(`/automation/rules/${id}`, data).then((r) => r.data.data),

  deleteRule: (id: string) =>
    apiClient.delete(`/automation/rules/${id}`),

  listLogs: (page = 1, limit = 50) =>
    apiClient
      .get<ApiPaginated<AutomationLogDTO>>("/automation/logs", { params: { page, limit } })
      .then((r) => r.data),
};
