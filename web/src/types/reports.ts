/** Athon — Report Type Definitions */

export interface AttendanceReportResponse {
  total_records: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count: number;
  present_percentage: number;
  absent_percentage: number;
  average_percentage: number;
  class_breakdown: ClassAttendanceBreakdown[];
  period_start: string | null;
  period_end: string | null;
}

export interface ClassAttendanceBreakdown {
  class_id: string;
  class_name: string;
  total_records: number;
  present_percentage: number;
  student_count: number;
}

export interface HomeworkReportResponse {
  total_assigned: number;
  total_submissions: number;
  total_graded: number;
  submission_rate: number;
  average_score: number;
  average_completion_rate: number;
  class_breakdown: ClassHomeworkBreakdown[];
  period_start: string | null;
  period_end: string | null;
}

export interface ClassHomeworkBreakdown {
  class_id: string;
  class_name: string;
  assigned: number;
  submission_rate: number;
  average_score: number;
}

export interface TestReportResponse {
  total_tests: number;
  total_attempts: number;
  total_graded: number;
  average_score: number;
  highest_score: number;
  pass_rate: number;
  class_breakdown: ClassTestBreakdown[];
  period_start: string | null;
  period_end: string | null;
}

export interface ClassTestBreakdown {
  class_id: string;
  class_name: string;
  tests_count: number;
  average_score: number;
  pass_rate: number;
}

export interface StudentSummaryReport {
  student_id: string;
  student_name: string;
  class_name: string;
  attendance_percentage: number;
  homework_completion_rate: number;
  homework_average_score: number;
  tests_average_score: number;
  tests_pass_rate: number;
}

export interface ClassSummaryReport {
  class_id: string;
  class_name: string;
  student_count: number;
  attendance_percentage: number;
  homework_completion_rate: number;
  homework_average_score: number;
  tests_average_score: number;
  tests_pass_rate: number;
}

export interface TeacherSummaryReport {
  teacher_id: string;
  teacher_name: string;
  assigned_classes: number;
  assigned_subjects: number;
  homework_assignments_count: number;
  homework_average_score: number;
  tests_created_count: number;
  tests_average_score: number;
}
