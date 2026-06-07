/** Athon — Notifications API Service */

import http from "@/lib/axios";
import type {
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
} from "@/types/notifications";

export const notificationService = {
  /** GET /notifications/me — list current user's notifications */
  async getMyNotifications(params?: {
    skip?: number;
    limit?: number;
    unread_only?: boolean;
  }): Promise<NotificationListResponse> {
    const { data } = await http.get<NotificationListResponse>("/notifications/me", { params });
    return data;
  },

  /** GET /notifications/unread/count */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const { data } = await http.get<UnreadCountResponse>("/notifications/unread/count");
    return data;
  },

  /** PATCH /notifications/{id}/read — mark single as read */
  async markAsRead(id: string): Promise<void> {
    await http.patch(`/notifications/${id}/read`);
  },

  /** POST /notifications/read-all — mark all as read */
  async markAllAsRead(): Promise<{ count: number }> {
    const { data } = await http.post<{ count: number }>("/notifications/read-all");
    return data;
  },
};
