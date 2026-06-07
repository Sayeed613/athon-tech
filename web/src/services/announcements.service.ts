/** Athon — Announcements API Service */

import http from "@/lib/axios";
import type {
  AnnouncementItem,
  AnnouncementListResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from "@/types/announcements";

export const announcementService = {
  /** GET /announcements */
  async list(params?: {
    skip?: number;
    limit?: number;
    include_unpublished?: boolean;
  }): Promise<AnnouncementListResponse> {
    const { data } = await http.get<AnnouncementListResponse>("/announcements", { params });
    return data;
  },

  /** GET /announcements/{id} */
  async get(id: string): Promise<AnnouncementItem> {
    const { data } = await http.get<AnnouncementItem>(`/announcements/${id}`);
    return data;
  },

  /** POST /announcements */
  async create(payload: CreateAnnouncementRequest): Promise<AnnouncementItem> {
    const { data } = await http.post<AnnouncementItem>("/announcements", payload);
    return data;
  },

  /** PATCH /announcements/{id} */
  async update(id: string, payload: UpdateAnnouncementRequest): Promise<AnnouncementItem> {
    const { data } = await http.patch<AnnouncementItem>(`/announcements/${id}`, payload);
    return data;
  },

  /** DELETE /announcements/{id} */
  async delete(id: string): Promise<void> {
    await http.delete(`/announcements/${id}`);
  },
};
