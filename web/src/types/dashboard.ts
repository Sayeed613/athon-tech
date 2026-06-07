/** Athon — Dashboard Type Definitions */

import type { TimestampedEntity } from "./index";

// ── Admin Dashboard API Response ──────────────────────────────

export interface AdminDashboardResponse {
  total_students: number;
  total_teachers: number;
  active_classes: number;
  attendance_percentage: number;
  recent_announcements: AnnouncementItem[];
  unread_notifications: { count: number };
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string | null;
  priority: string;
  created_at: string;
}

// ── School Profile ────────────────────────────────────────────

export interface SchoolProfile {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  domain: string | null;
  logo_url: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Academic Year / Term ──────────────────────────────────────

export interface AcademicYearItem {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicTermItem {
  id: string;
  academic_year_id: string;
  academic_year_name: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

// ── Recent Entities (for widgets) ─────────────────────────────

export interface RecentStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  admission_number: string;
  class_name: string;
  is_active: boolean;
  created_at: string;
}

export interface RecentTeacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_code: string;
  is_active: boolean;
  created_at: string;
}

// ── Timetable Status ──────────────────────────────────────────

export interface TimetableStatus {
  has_entries: boolean;
  entry_count: number;
}

// ── Composed Dashboard State ──────────────────────────────────

export interface DashboardState {
  /** From /dashboard/admin */
  total_students: number;
  total_teachers: number;
  active_classes: number;
  attendance_percentage: number;
  announcements: AnnouncementItem[];
  unread_count: number;

  /** From supplementary APIs */
  school_name: string;
  active_academic_year: string | null;
  current_term: string | null;
  recent_students: RecentStudent[];
  recent_teachers: RecentTeacher[];
  timetable_status: TimetableStatus;
  last_login: string | null;

  /** Loading / error state (aggregated) */
  isLoading: boolean;
  isError: boolean;
  error: string | null;
}
