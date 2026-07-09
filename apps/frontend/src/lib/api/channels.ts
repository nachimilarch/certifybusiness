import { apiClient } from "../api";
import type { ApiOk, SenderIdentityDTO, TemplateDTO, ChannelType } from "../../types/api";

export interface CreateSenderPayload {
  channel: ChannelType;
  name: string;
  fromAddress?: string | null;
  whatsappNumber?: string | null;
  whatsappWabaId?: string | null;
  whatsappPhoneNumberId?: string | null;
  smsSenderId?: string | null;
  credentials?: Record<string, string> | null;
}

export interface CreateTemplatePayload {
  channel: ChannelType;
  name: string;
  subject?: string | null;
  body: string;
  whatsappTemplateName?: string | null;
  whatsappTemplateId?: string | null;
  dltTemplateId?: string | null;
}

export const channelsApi = {
  // Sender identities
  listSenders: (channel?: ChannelType) =>
    apiClient
      .get<ApiOk<SenderIdentityDTO[]>>("/channels/senders", { params: channel ? { channel } : {} })
      .then((r) => r.data.data),

  getSender: (id: string) =>
    apiClient.get<ApiOk<SenderIdentityDTO>>(`/channels/senders/${id}`).then((r) => r.data.data),

  createSender: (data: CreateSenderPayload) =>
    apiClient.post<ApiOk<SenderIdentityDTO>>("/channels/senders", data).then((r) => r.data.data),

  updateSender: (id: string, data: Partial<CreateSenderPayload> & { isActive?: boolean }) =>
    apiClient.patch<ApiOk<SenderIdentityDTO>>(`/channels/senders/${id}`, data).then((r) => r.data.data),

  deleteSender: (id: string) => apiClient.delete(`/channels/senders/${id}`),

  testSender: (id: string) =>
    apiClient
      .post<ApiOk<{ success: boolean; message: string }>>(`/channels/senders/${id}/test`)
      .then((r) => r.data.data),

  getWebhookUrls: () =>
    apiClient
      .get<ApiOk<Record<string, string>>>("/channels/webhook-urls")
      .then((r) => r.data.data),

  // Templates
  listTemplates: (channel?: ChannelType) =>
    apiClient
      .get<ApiOk<TemplateDTO[]>>("/channels/templates", { params: channel ? { channel } : {} })
      .then((r) => r.data.data),

  getTemplate: (id: string) =>
    apiClient.get<ApiOk<TemplateDTO>>(`/channels/templates/${id}`).then((r) => r.data.data),

  createTemplate: (data: CreateTemplatePayload) =>
    apiClient.post<ApiOk<TemplateDTO>>("/channels/templates", data).then((r) => r.data.data),

  updateTemplate: (id: string, data: Partial<CreateTemplatePayload> & { isActive?: boolean }) =>
    apiClient.patch<ApiOk<TemplateDTO>>(`/channels/templates/${id}`, data).then((r) => r.data.data),

  deleteTemplate: (id: string) => apiClient.delete(`/channels/templates/${id}`),
};
