/** Athon — Student API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  Student,
  StudentListResponse,
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentSummaryReport,
  BulkImportResponse,
} from "@/types/student";

export const studentService = {
  /** GET /students — paginated list with optional filters */
  async list(params?: {
    search?: string;
    class_id?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<StudentListResponse> {
    const { data } = await http.get<StudentListResponse>(
      API_ENDPOINTS.STUDENTS.LIST,
      { params }
    );
    return data;
  },

  /** GET /students/{id} — single student with parents and enrollments */
  async get(id: string): Promise<Student> {
    const { data } = await http.get<Student>(
      API_ENDPOINTS.STUDENTS.GET(id)
    );
    return data;
  },

  /** POST /students — create student + user + enrollment */
  async create(payload: CreateStudentRequest): Promise<Student> {
    const { data } = await http.post<Student>(
      API_ENDPOINTS.STUDENTS.CREATE,
      payload
    );
    return data;
  },

  /** PATCH /students/{id} — update student profile */
  async update(
    id: string,
    payload: UpdateStudentRequest
  ): Promise<Student> {
    const { data } = await http.patch<Student>(
      API_ENDPOINTS.STUDENTS.UPDATE(id),
      payload
    );
    return data;
  },

  /** DELETE /students/{id} — soft-delete (deactivate) */
  async deactivate(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.STUDENTS.DELETE(id));
  },

  /** POST /students/import — bulk import students */
  async bulkImport(
    students: CreateStudentRequest[]
  ): Promise<BulkImportResponse> {
    const { data } = await http.post<BulkImportResponse>(
      API_ENDPOINTS.STUDENTS.IMPORT,
      { students }
    );
    return data;
  },

  /** GET /reports/student/{id} — student summary report */
  async getReport(id: string): Promise<StudentSummaryReport> {
    const { data } = await http.get<StudentSummaryReport>(
      API_ENDPOINTS.REPORTS.STUDENT(id)
    );
    return data;
  },
};
