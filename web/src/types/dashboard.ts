/** Athon — Dashboard Type Definitions */

import type { TimestampedEntity } from "./index";

// ── Shared Widgets ────────────────────────────────────────────

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string | null;
  priority: string;
  created_at: string;
}

export interface UnreadCountWidget {
  count: number;
}

// ── Admin Dashboard API Response ──────────────────────────────

export interface AdminDashboardResponse {
  total_students: number;
  total_teachers: number;
  active_classes: number;
  attendance_percentage: number;
  recent_announcements: AnnouncementItem[];
  unread_notifications: UnreadCountWidget;
}

// ── Parent Dashboard Response ────────────────────────────────

export interface ParentDashboardResponse {
  attendance_percentage: number;
  recent_announcements: AnnouncementItem[];
  unread_notifications: UnreadCountWidget;
}

// ── Principal Dashboard Response ──────────────────────────────

export interface PrincipalDashboardResponse {
  total_students: number;
  total_teachers: number;
  attendance_percentage: number;
  homework_completion_rate: number;
  test_pass_rate: number;
  recent_announcements: AnnouncementItem[];
  unread_notifications: UnreadCountWidget;
}

// ── Teacher Dashboard Response ────────────────────────────────

export interface TimetableWidget {
  subject_name: string;
  class_name: string;
  start_time: string;
  end_time: string;
  room_number: string | null;
}

export interface TeacherDashboardResponse {
  classes_assigned: string[];
  today_schedule: TimetableWidget[];
  attendance_pending_count: number;
  homework_pending_review: number;
  upcoming_tests: number;
  unread_notifications: UnreadCountWidget;
}

// ── Student Dashboard Response ────────────────────────────────

export interface HomeworkDueWidget {
  id: string;
  title: string;
  subject_name: string;
  due_date: string;
  days_remaining: number;
}

export interface UpcomingTestWidget {
  id: string;
  title: string;
  subject_name: string;
  scheduled_at: string | null;
  total_marks: number;
}

export interface StudentDashboardResponse {
  today_timetable: TimetableWidget[];
  homework_due: HomeworkDueWidget[];
  upcoming_tests: UpcomingTestWidget[];
  attendance_percentage: number;
  recent_announcements: AnnouncementItem[];
  unread_notifications: UnreadCountWidget;
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

// ── Homework Question Types (for AI generation) ───────────────

export interface AIQuestion {
  id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  max_points: number;
}
