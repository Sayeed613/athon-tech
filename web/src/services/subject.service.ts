/** Athon — Subject API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  Subject,
  SubjectListResponse,
  CreateSubjectRequest,
  UpdateSubjectRequest,
} from "@/types/subject";

export const subjectService = {
  /** GET /subjects — list all subjects */
  async list(params?: {
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<SubjectListResponse> {
    const { data } = await http.get<SubjectListResponse>(
      API_ENDPOINTS.SUBJECTS.LIST,
      { params }
    );
    return data;
  },

  /** GET /subjects/{id} — single subject */
  async get(id: string): Promise<Subject> {
    const { data } = await http.get<Subject>(
      API_ENDPOINTS.SUBJECTS.GET(id)
    );
    return data;
  },

  /** POST /subjects — create a new subject */
  async create(payload: CreateSubjectRequest): Promise<Subject> {
    const { data } = await http.post<Subject>(
      API_ENDPOINTS.SUBJECTS.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /subjects/{id} — update subject */
  async update(
    id: string,
    payload: UpdateSubjectRequest
  ): Promise<Subject> {
    const { data } = await http.patch<Subject>(
      API_ENDPOINTS.SUBJECTS.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /subjects/{id} — soft-delete */
  async archive(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.SUBJECTS.DELETE(id));
  },
};
