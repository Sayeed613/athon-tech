/** Athon — Homework API Service */

import http from "@/lib/axios";
import type {
  HomeworkItem,
  HomeworkListResponse,
  CreateHomeworkRequest,
  UpdateHomeworkRequest,
  HomeworkSubmission,
  SubmissionListResponse,
  GradeSubmissionRequest,
} from "@/types/homework";

export const homeworkService = {
  /** GET /homework/class/{id} — list homework for a class */
  async getByClass(classId: string, params?: { include_unpublished?: boolean }): Promise<HomeworkListResponse> {
    const { data } = await http.get<HomeworkListResponse>(
      `/homework/class/${classId}`,
      { params }
    );
    return data;
  },

  /** GET /homework/{id} — homework detail */
  async get(id: string): Promise<HomeworkItem> {
    const { data } = await http.get<HomeworkItem>(
      `/homework/${id}`
    );
    return data;
  },

  /** POST /homework — create homework */
  async create(payload: CreateHomeworkRequest): Promise<HomeworkItem> {
    const { data } = await http.post<HomeworkItem>(
      "/homework",
      payload
    );
    return data;
  },

  /** PATCH /homework/{id} — update homework */
  async update(id: string, payload: UpdateHomeworkRequest): Promise<HomeworkItem> {
    const { data } = await http.patch<HomeworkItem>(
      `/homework/${id}`,
      payload
    );
    return data;
  },

  /** GET /homework/{id}/submissions — list submissions */
  async getSubmissions(homeworkId: string): Promise<SubmissionListResponse> {
    const { data } = await http.get<SubmissionListResponse>(
      `/homework/${homeworkId}/submissions`
    );
    return data;
  },

  /** PATCH /homework/{id}/submissions/{submissionId}/grade — grade submission */
  async gradeSubmission(
    homeworkId: string,
    submissionId: string,
    payload: GradeSubmissionRequest
  ): Promise<HomeworkSubmission> {
    const { data } = await http.patch<HomeworkSubmission>(
      `/homework/${homeworkId}/submissions/${submissionId}/grade`,
      payload
    );
    return data;
  },
};
