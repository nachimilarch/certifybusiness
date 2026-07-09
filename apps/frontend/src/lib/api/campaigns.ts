import { apiClient } from "../api";
import type { ApiOk, ApiPaginated, CampaignDTO, ChannelType, CampaignStatus } from "../../types/api";

export interface CampaignStep {
  stepNumber: number;
  templateId?: string | null;
  subject?: string | null;
  body?: string | null;
  delayDays?: number;
  delayHours?: number;
}

export interface CreateCampaignPayload {
  name: string;
  channel: ChannelType;
  senderIdentityId?: string | null;
  listId?: string | null;
  scheduledAt?: string | null;
  settings?: Record<string, unknown> | null;
  steps: CampaignStep[];
}

export interface ListCampaignsParams {
  page?: number;
  limit?: number;
  channel?: ChannelType;
  status?: CampaignStatus;
}

export const campaignsApi = {
  list: (params?: ListCampaignsParams) =>
    apiClient.get<ApiPaginated<CampaignDTO>>("/campaigns", { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiOk<CampaignDTO>>(`/campaigns/${id}`).then((r) => r.data.data),

  create: (data: CreateCampaignPayload) =>
    apiClient.post<ApiOk<CampaignDTO>>("/campaigns", data).then((r) => r.data.data),

  update: (id: string, data: Partial<Omit<CreateCampaignPayload, "steps" | "channel">>) =>
    apiClient.patch<ApiOk<CampaignDTO>>(`/campaigns/${id}`, data).then((r) => r.data.data),

  delete: (id: string) => apiClient.delete(`/campaigns/${id}`),

  launch: (id: string, scheduledAt?: string | null) =>
    apiClient
      .post<ApiOk<CampaignDTO>>(`/campaigns/${id}/launch`, { scheduledAt: scheduledAt ?? null })
      .then((r) => r.data.data),

  pause: (id: string) =>
    apiClient.post<ApiOk<CampaignDTO>>(`/campaigns/${id}/pause`).then((r) => r.data.data),

  resume: (id: string) =>
    apiClient.post<ApiOk<CampaignDTO>>(`/campaigns/${id}/resume`).then((r) => r.data.data),
};
