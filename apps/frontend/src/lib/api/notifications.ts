import { apiClient } from "../api";
import type { ApiOk, NotificationDTO } from "../../types/api";

export interface NotificationsResult {
  notifications: NotificationDTO[];
  total: number;
  unreadCount: number;
}

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<ApiOk<NotificationsResult>>("/notifications", { params: { page, limit } })
      .then((r) => r.data.data),

  unreadCount: () =>
    apiClient
      .get<ApiOk<{ count: number }>>("/notifications/unread-count")
      .then((r) => r.data.data.count),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post("/notifications/read-all"),
};
