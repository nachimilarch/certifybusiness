import { apiClient } from "../api";
import type { ApiOk, ApiPaginated } from "../../types/api";
import type {
  ConversationDTO,
  ConversationDetailDTO,
  ConversationMessageDTO,
  InboxStatsDTO,
} from "../../types/api";

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  channel?: "email" | "whatsapp" | "sms";
  status?: "open" | "awaiting_employee" | "awaiting_customer" | "closed";
  ownerUserId?: string;
  campaignId?: string;
  unassigned?: "true" | "false";
  search?: string;
}

export const inboxApi = {
  /** Fetch a 30-second one-time token for the SSE stream endpoint. */
  streamToken: () =>
    apiClient
      .post<ApiOk<{ token: string }>>("/inbox/stream-token")
      .then((r) => r.data.data),

  list: (params?: ListConversationsParams) =>
    apiClient
      .get<ApiPaginated<ConversationDTO>>("/inbox", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ApiOk<ConversationDetailDTO>>(`/inbox/${id}`)
      .then((r) => r.data.data),

  stats: () =>
    apiClient
      .get<ApiOk<InboxStatsDTO>>("/inbox/stats")
      .then((r) => r.data.data),

  reply: (id: string, body: string, bodyHtml?: string) =>
    apiClient
      .post<ApiOk<ConversationMessageDTO>>(`/inbox/${id}/reply`, { body, bodyHtml })
      .then((r) => r.data.data),

  assign: (id: string, userId: string, reason?: string) =>
    apiClient
      .post<ApiOk<ConversationDTO>>(`/inbox/${id}/assign`, { userId, reason })
      .then((r) => r.data.data),

  close: (id: string) =>
    apiClient
      .post<ApiOk<ConversationDTO>>(`/inbox/${id}/close`)
      .then((r) => r.data.data),

  reopen: (id: string) =>
    apiClient
      .post<ApiOk<ConversationDTO>>(`/inbox/${id}/reopen`)
      .then((r) => r.data.data),
};
