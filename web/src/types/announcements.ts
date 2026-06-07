/** Athon — Announcement Type Definitions */

export interface AnnouncementItem {
  id: string;
  school_id: string;
  sender_id: string;
  title: string;
  body: string | null;
  audience_type: "school_wide" | "teachers_only" | "specific_classes";
  class_ids: string[] | null;
  priority: "low" | "normal" | "high" | "urgent";
  publish_at: string | null;
  expires_at: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  sender: AnnouncementSenderInfo | null;
}

export interface AnnouncementSenderInfo {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface AnnouncementListResponse {
  announcements: AnnouncementItem[];
  total: number;
}

export interface CreateAnnouncementRequest {
  title: string;
  body?: string;
  audience_type: "school_wide" | "teachers_only" | "specific_classes";
  class_ids?: string[];
  priority?: "low" | "normal" | "high" | "urgent";
  is_published?: boolean;
}

export interface UpdateAnnouncementRequest {
  title?: string;
  body?: string;
  is_published?: boolean;
  priority?: "low" | "normal" | "high" | "urgent";
}
