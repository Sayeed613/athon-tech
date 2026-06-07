/** Athon — Timetable API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  TimetableResponse,
  TimetableEntry,
  CreateTimetableEntryRequest,
  UpdateTimetableEntryRequest,
} from "@/types/timetable";

export const timetableService = {
  /** GET /timetable/class/{id} — weekly timetable for a class */
  async getByClass(classId: string): Promise<TimetableResponse> {
    const { data } = await http.get<TimetableResponse>(
      API_ENDPOINTS.TIMETABLE.BY_CLASS(classId)
    );
    return data;
  },

  /** GET /timetable/teacher/{id} — weekly timetable for a teacher */
  async getByTeacher(teacherId: string): Promise<TimetableResponse> {
    const { data } = await http.get<TimetableResponse>(
      API_ENDPOINTS.TIMETABLE.BY_TEACHER(teacherId)
    );
    return data;
  },

  /** GET /timetable/today — today's schedule for current user */
  async getToday(): Promise<TimetableResponse> {
    const { data } = await http.get<TimetableResponse>(
      API_ENDPOINTS.TIMETABLE.TODAY
    );
    return data;
  },

  /** POST /timetable/entries — create entry */
  async createEntry(payload: CreateTimetableEntryRequest): Promise<TimetableEntry> {
    const { data } = await http.post<TimetableEntry>(
      API_ENDPOINTS.TIMETABLE.ENTRIES,
      payload
    );
    return data;
  },

  /** PATCH /timetable/entries/{id} — update entry */
  async updateEntry(id: string, payload: UpdateTimetableEntryRequest): Promise<TimetableEntry> {
    const { data } = await http.patch<TimetableEntry>(
      API_ENDPOINTS.TIMETABLE.ENTRY(id),
      payload
    );
    return data;
  },

  /** DELETE /timetable/entries/{id} — delete entry */
  async deleteEntry(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.TIMETABLE.ENTRY(id));
  },
};
