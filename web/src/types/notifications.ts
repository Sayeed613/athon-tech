/** Athon — Notification Type Definitions */

export interface NotificationItem {
  id: string;
  school_id: string;
  sender_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  is_sent: boolean;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  recipient: NotificationRecipientInfo | null;
}

export interface NotificationRecipientInfo {
  user_id: string | null;
  channel: string;
  status: string;
  is_read: boolean;
  read_at: string | null;
  delivered_at: string | null;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  count: number;
}
