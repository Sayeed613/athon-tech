/** Athon — Dashboard API Service */

import http, { ApiClientError } from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import type {
  AdminDashboardResponse,
  SchoolProfile,
  AcademicYearItem,
  AcademicTermItem,
  RecentStudent,
  RecentTeacher,
  TimetableStatus,
  DashboardState,
} from "@/types/dashboard";

/**
 * Safe wrapper: catches non-auth errors gracefully so a failed
 * supplementary endpoint doesn't crash the entire dashboard.
 * Auth errors (401/403) are re-thrown so the Axios interceptor
 * can trigger auto-logout.
 */
async function safeFetch<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.isUnauthorized || err.isForbidden) {
        throw err; // let the Axios interceptor handle these
      }
    }
    return fallback;
  }
}

/**
 * Dashboard service — composes data from the admin dashboard endpoint
 * and supplementary APIs into a single DashboardState.
 */
export const dashboardService = {
  /** GET /dashboard/admin — primary dashboard data (counts + attendance) */
  async getAdminDashboard(): Promise<AdminDashboardResponse> {
    const { data } = await http.get<AdminDashboardResponse>(
      API_ENDPOINTS.DASHBOARD.ADMIN
    );
    return data;
  },

  /** GET /schools/{id} — school profile */
  async getSchoolProfile(schoolId: string): Promise<SchoolProfile> {
    const { data } = await http.get<SchoolProfile>(
      API_ENDPOINTS.SCHOOLS.GET(schoolId)
    );
    return data;
  },

  /** GET /academic-years — find current academic year */
  async getAcademicYears(): Promise<AcademicYearItem[]> {
    const { data } = await http.get<{
      academic_years: AcademicYearItem[];
      total: number;
    }>(API_ENDPOINTS.ACADEMIC_YEARS.LIST);
    return data.academic_years;
  },

  /** GET /academic-terms — find current term */
  async getAcademicTerms(): Promise<AcademicTermItem[]> {
    const { data } = await http.get<{
      academic_terms: AcademicTermItem[];
      total: number;
    }>(API_ENDPOINTS.ACADEMIC_TERMS.LIST);
    return data.academic_terms;
  },

  /** GET /students?skip=0&limit=5 — recent students (by created_at desc) */
  async getRecentStudents(): Promise<RecentStudent[]> {
    const { data } = await http.get<{
      students: RecentStudent[];
      total: number;
      skip: number;
      limit: number;
    }>(API_ENDPOINTS.STUDENTS.LIST, {
      params: { skip: 0, limit: 5 },
    });
    return data.students;
  },

  /** GET /teachers?skip=0&limit=5 — recent teachers */
  async getRecentTeachers(): Promise<RecentTeacher[]> {
    const { data } = await http.get<{
      teachers: RecentTeacher[];
      total: number;
      skip: number;
      limit: number;
    }>(API_ENDPOINTS.TEACHERS.LIST, {
      params: { skip: 0, limit: 5 },
    });
    return data.teachers;
  },

  /** GET /timetable/today — check if any timetable entries exist */
  async getTimetableStatus(): Promise<TimetableStatus> {
    try {
      const { data } = await http.get<{ entries: unknown[] }>(
        API_ENDPOINTS.TIMETABLE.TODAY
      );
      return {
        has_entries: data.entries.length > 0,
        entry_count: data.entries.length,
      };
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.isUnauthorized || err.isForbidden) throw err;
      }
      return { has_entries: false, entry_count: 0 };
    }
  },

  /** GET /dashboard/teacher — teacher dashboard */
  async getTeacherDashboard(): Promise<import("@/types/dashboard").TeacherDashboardResponse> {
    const { data } = await http.get<import("@/types/dashboard").TeacherDashboardResponse>(
      API_ENDPOINTS.DASHBOARD.TEACHER
    );
    return data;
  },

  /** GET /dashboard/principal — principal dashboard */
  async getPrincipalDashboard(): Promise<import("@/types/dashboard").PrincipalDashboardResponse> {
    const { data } = await http.get<import("@/types/dashboard").PrincipalDashboardResponse>(
      API_ENDPOINTS.DASHBOARD.PRINCIPAL
    );
    return data;
  },

  /** GET /dashboard/student — student dashboard */
  async getStudentDashboard(): Promise<import("@/types/dashboard").StudentDashboardResponse> {
    const { data } = await http.get<import("@/types/dashboard").StudentDashboardResponse>(
      API_ENDPOINTS.DASHBOARD.STUDENT
    );
    return data;
  },

  /** GET /dashboard/parent — parent dashboard */
  async getParentDashboard(): Promise<import("@/types/dashboard").ParentDashboardResponse> {
    const { data } = await http.get<import("@/types/dashboard").ParentDashboardResponse>(
      API_ENDPOINTS.DASHBOARD.PARENT
    );
    return data;
  },

  /**
   * Compose all dashboard data for the admin view.
   * Runs queries in parallel for minimal loading time.
   */
  async getAdminDashboardData(
    schoolId: string
  ): Promise<DashboardState> {
    const [dashboard, school, academicYears, academicTerms, recentStudents, recentTeachers, timetableStatus] =
      await Promise.all([
        this.getAdminDashboard(),
        safeFetch(() => this.getSchoolProfile(schoolId), null),
        safeFetch(() => this.getAcademicYears(), []),
        safeFetch(() => this.getAcademicTerms(), []),
        safeFetch(() => this.getRecentStudents(), []),
        safeFetch(() => this.getRecentTeachers(), []),
        this.getTimetableStatus(),
      ]);

    const currentYear =
      academicYears.find((y) => y.is_current) ?? null;
    const currentTerm =
      academicTerms.find((t) => t.is_current) ?? null;

    return {
      total_students: dashboard.total_students,
      total_teachers: dashboard.total_teachers,
      active_classes: dashboard.active_classes,
      attendance_percentage: dashboard.attendance_percentage,
      announcements: dashboard.recent_announcements,
      unread_count: dashboard.unread_notifications.count,
      school_name: school?.name ?? "—",
      active_academic_year: currentYear?.name ?? null,
      current_term: currentTerm?.name ?? null,
      recent_students: recentStudents,
      recent_teachers: recentTeachers,
      timetable_status: timetableStatus,
      last_login: null,
      isLoading: false,
      isError: false,
      error: null,
    };
  },
};
