/** Athon — Class API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  ClassItem,
  ClassListResponse,
  CreateClassRequest,
  UpdateClassRequest,
  ClassOption,
} from "@/types/class";

export const classService = {
  /** GET /classes — paginated list with optional filters */
  async list(params?: {
    search?: string;
    academic_year_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ClassListResponse> {
    const { data } = await http.get<ClassListResponse>(
      API_ENDPOINTS.CLASSES.LIST,
      { params }
    );
    return data;
  },

  /** GET /classes/{id} — single class with student count */
  async get(id: string): Promise<ClassItem> {
    const { data } = await http.get<ClassItem>(
      API_ENDPOINTS.CLASSES.GET(id)
    );
    return data;
  },

  /** POST /classes — create a new class */
  async create(payload: CreateClassRequest): Promise<ClassItem> {
    const { data } = await http.post<ClassItem>(
      API_ENDPOINTS.CLASSES.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /classes/{id} — update class fields */
  async update(
    id: string,
    payload: UpdateClassRequest
  ): Promise<ClassItem> {
    const { data } = await http.patch<ClassItem>(
      API_ENDPOINTS.CLASSES.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /classes/{id} — soft-delete (archive) */
  async archive(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.CLASSES.DELETE(id));
  },

  /** Convenience: fetch all classes as options for dropdowns */
  async fetchOptions(): Promise<ClassOption[]> {
    const { data } = await http.get<ClassListResponse>(
      API_ENDPOINTS.CLASSES.LIST,
      { params: { limit: 200 } }
    );
    return (data.classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
    }));
  },
};
