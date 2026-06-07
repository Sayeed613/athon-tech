/** Athon — Attendance API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  AttendanceRecord,
  AttendanceListResponse,
  MarkAttendanceRequest,
  BatchMarkAttendanceRequest,
} from "@/types/attendance";

export const attendanceService = {
  /** GET /attendance/class/{id} — attendance records for a class */
  async getByClass(classId: string, params?: { date?: string; academic_term_id?: string }): Promise<AttendanceListResponse> {
    const { data } = await http.get<AttendanceListResponse>(
      `/attendance/class/${classId}`,
      { params }
    );
    return data;
  },

  /** GET /attendance/student/{id} — attendance records for a student */
  async getByStudent(studentId: string, params?: { academic_term_id?: string }): Promise<AttendanceListResponse> {
    const { data } = await http.get<AttendanceListResponse>(
      `/attendance/student/${studentId}`,
      { params }
    );
    return data;
  },

  /** GET /attendance/today — today's attendance for current user */
  async getToday(params?: { class_id?: string }): Promise<AttendanceListResponse> {
    const { data } = await http.get<AttendanceListResponse>(
      "/attendance/today",
      { params }
    );
    return data;
  },

  /** POST /attendance/mark — mark single attendance */
  async mark(payload: MarkAttendanceRequest): Promise<AttendanceRecord> {
    const { data } = await http.post<AttendanceRecord>(
      "/attendance/mark",
      payload
    );
    return data;
  },

  /** POST /attendance/batch — batch mark attendance */
  async batchMark(payload: BatchMarkAttendanceRequest): Promise<AttendanceListResponse> {
    const { data } = await http.post<AttendanceListResponse>(
      "/attendance/batch",
      payload
    );
    return data;
  },
};
