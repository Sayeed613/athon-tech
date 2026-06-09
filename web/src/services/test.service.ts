/** Athon — Test API Service */

import http from "@/lib/axios";
import type {
  TestItem,
  TestListResponse,
  CreateTestRequest,
  UpdateTestRequest,
  TestAttempt,
  AttemptListResponse,
  GradeAttemptRequest,
} from "@/types/test";

export const testService = {
  /** GET /tests/class/{id} — list tests for a class */
  async getByClass(classId: string, params?: { include_unpublished?: boolean }): Promise<TestListResponse> {
    const { data } = await http.get<TestListResponse>(
      `/tests/class/${classId}`,
      { params }
    );
    return data;
  },

  /** GET /tests/{id} — test detail */
  async get(id: string): Promise<TestItem> {
    const { data } = await http.get<TestItem>(
      `/tests/${id}`
    );
    return data;
  },

  /** POST /tests — create test */
  async create(payload: CreateTestRequest): Promise<TestItem> {
    const { data } = await http.post<TestItem>(
      "/tests",
      payload
    );
    return data;
  },

  /** PATCH /tests/{id} — update test */
  async update(id: string, payload: UpdateTestRequest): Promise<TestItem> {
    const { data } = await http.patch<TestItem>(
      `/tests/${id}`,
      payload
    );
    return data;
  },

  /** GET /tests/{id}/results — list attempts/results */
  async getResults(testId: string): Promise<AttemptListResponse> {
    const { data } = await http.get<AttemptListResponse>(
      `/tests/${testId}/results`
    );
    return data;
  },

  /** GET /tests/{id}/questions — get test questions for student */
  async getQuestions(testId: string): Promise<import("@/types/test").StudentTestQuestion[]> {
    const { data } = await http.get<import("@/types/test").StudentTestQuestion[]>(
      `/tests/${testId}/questions`
    );
    return data;
  },

  /** GET /tests/student/me — get published tests for authenticated student */
  async getMyTests(): Promise<TestListResponse> {
    const { data } = await http.get<TestListResponse>(
      "/tests/student/me"
    );
    return data;
  },

  /** POST /tests/{id}/start — start a test attempt */
  async startTest(testId: string): Promise<TestAttempt> {
    const { data } = await http.post<TestAttempt>(
      `/tests/${testId}/start`
    );
    return data;
  },

  /** POST /tests/{id}/submit — submit a test attempt */
  async submitTest(testId: string): Promise<TestAttempt> {
    const { data } = await http.post<TestAttempt>(
      `/tests/${testId}/submit`
    );
    return data;
  },

  /** POST /ai/generate-test — generate AI test questions */
  async generateAI(payload: {
    class_name: string;
    subject_name: string;
    chapter_topic: string;
    test_type: string;
    question_count: number;
    total_marks: number;
    duration_minutes: number;
    difficulty: string;
  }): Promise<{ title: string; questions: import("@/types/test").AITestQuestion[] }> {
    const { data } = await http.post<{ title: string; questions: import("@/types/test").AITestQuestion[] }>(
      "/ai/generate-test",
      payload
    );
    return data;
  },
};
