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

  /** GET /homework/student/me — get my homework (student role) */
  async getMyHomework(): Promise<HomeworkListResponse> {
    const { data } = await http.get<HomeworkListResponse>(
      "/homework/student/me"
    );
    return data;
  },

  /** GET /homework/{id}/my-submission — get the student's submission for a homework */
  async getMySubmission(homeworkId: string): Promise<HomeworkSubmission | null> {
    const { data } = await http.get<HomeworkSubmission | null>(
      `/homework/${homeworkId}/my-submission`
    );
    return data;
  },

  /** GET /homework/{id}/questions — get questions for a homework */
  async getQuestions(homeworkId: string): Promise<import("@/types/dashboard").AIQuestion[]> {
    const { data } = await http.get<import("@/types/dashboard").AIQuestion[]>(
      `/homework/${homeworkId}/questions`
    );
    return data;
  },

  /** POST /homework/{id}/submit — submit homework */
  async submitHomework(homeworkId: string): Promise<HomeworkSubmission> {
    const { data } = await http.post<HomeworkSubmission>(
      `/homework/${homeworkId}/submit`
    );
    return data;
  },

  /** POST /ai/generate-homework — generate AI homework questions */
  async generateAI(payload: {
    subject_name: string;
    class_name: string;
    chapter_topic: string;
    question_count: number;
    question_types: string[];
  }): Promise<{ title: string; questions: import("@/types/dashboard").AIQuestion[] }> {
    const { data } = await http.post<{ title: string; questions: import("@/types/dashboard").AIQuestion[] }>(
      "/ai/generate-homework",
      payload
    );
    return data;
  },

  /** POST /homework/{id}/questions — save questions to a homework */
  async saveQuestions(homeworkId: string, questions: import("@/types/dashboard").AIQuestion[]): Promise<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }> {
    const { data } = await http.post<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }>(
      `/homework/${homeworkId}/questions`,
      { questions: questions.map((q) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        max_points: q.max_points,
      })) }
    );
    return data;
  },

  /** PATCH /homework/{id}/questions/{questionId} — update a single question */
  async updateQuestion(
    homeworkId: string,
    questionId: string,
    payload: Partial<{
      question_text: string;
      question_type: string;
      options: string[];
      correct_answer: string;
      explanation: string;
      max_points: number;
    }>
  ): Promise<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }> {
    const { data } = await http.patch<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }>(
      `/homework/${homeworkId}/questions/${questionId}`,
      payload
    );
    return data;
  },

  /** DELETE /homework/{id}/questions/{questionId} — delete a single question */
  async deleteQuestion(
    homeworkId: string,
    questionId: string
  ): Promise<void> {
    await http.delete(`/homework/${homeworkId}/questions/${questionId}`);
  },

  /** PATCH /homework/{id}/questions/reorder — reorder questions */
  async reorderQuestions(homeworkId: string, questionIds: string[]): Promise<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }> {
    const { data } = await http.patch<HomeworkItem & { questions: import("@/types/dashboard").AIQuestion[] }>(
      `/homework/${homeworkId}/questions/reorder`,
      { question_ids: questionIds }
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
