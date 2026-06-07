/** Athon — Reports API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  AttendanceReportResponse,
  HomeworkReportResponse,
  TestReportResponse,
  StudentSummaryReport,
  ClassSummaryReport,
  TeacherSummaryReport,
} from "@/types/reports";

export const reportService = {
  /** GET /reports/attendance */
  async getAttendance(params?: {
    class_id?: string;
    student_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<AttendanceReportResponse> {
    const { data } = await http.get<AttendanceReportResponse>(
      API_ENDPOINTS.REPORTS.ATTENDANCE,
      { params }
    );
    return data;
  },

  /** GET /reports/homework */
  async getHomework(params?: {
    class_id?: string;
    student_id?: string;
    teacher_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<HomeworkReportResponse> {
    const { data } = await http.get<HomeworkReportResponse>(
      API_ENDPOINTS.REPORTS.HOMEWORK,
      { params }
    );
    return data;
  },

  /** GET /reports/tests */
  async getTests(params?: {
    class_id?: string;
    student_id?: string;
    teacher_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<TestReportResponse> {
    const { data } = await http.get<TestReportResponse>(
      API_ENDPOINTS.REPORTS.TESTS,
      { params }
    );
    return data;
  },

  /** GET /reports/student/{student_id} */
  async getStudentSummary(studentId: string): Promise<StudentSummaryReport> {
    const { data } = await http.get<StudentSummaryReport>(
      API_ENDPOINTS.REPORTS.STUDENT(studentId)
    );
    return data;
  },

  /** GET /reports/class/{class_id} */
  async getClassSummary(classId: string): Promise<ClassSummaryReport> {
    const { data } = await http.get<ClassSummaryReport>(
      API_ENDPOINTS.REPORTS.CLASS(classId)
    );
    return data;
  },

  /** GET /reports/teacher/{teacher_id} */
  async getTeacherSummary(teacherId: string): Promise<TeacherSummaryReport> {
    const { data } = await http.get<TeacherSummaryReport>(
      API_ENDPOINTS.REPORTS.TEACHER(teacherId)
    );
    return data;
  },
};
