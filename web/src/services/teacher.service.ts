/** Athon — Teacher API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  Teacher,
  TeacherListResponse,
  CreateTeacherRequest,
  UpdateTeacherRequest,
} from "@/types/teacher";

export const teacherService = {
  /** GET /teachers — paginated list with optional search */
  async list(params?: {
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<TeacherListResponse> {
    const { data } = await http.get<TeacherListResponse>(
      API_ENDPOINTS.TEACHERS.LIST,
      { params }
    );
    return data;
  },

  /** GET /teachers/{id} — single teacher with assignments */
  async get(id: string): Promise<Teacher> {
    const { data } = await http.get<Teacher>(
      API_ENDPOINTS.TEACHERS.GET(id)
    );
    return data;
  },

  /** POST /teachers — create teacher + user account */
  async create(payload: CreateTeacherRequest): Promise<Teacher> {
    const { data } = await http.post<Teacher>(
      API_ENDPOINTS.TEACHERS.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /teachers/{id} — update teacher profile fields */
  async update(
    id: string,
    payload: UpdateTeacherRequest
  ): Promise<Teacher> {
    const { data } = await http.patch<Teacher>(
      API_ENDPOINTS.TEACHERS.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /teachers/{id} — soft-delete (deactivate) */
  async deactivate(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.TEACHERS.DELETE(id));
  },
};
