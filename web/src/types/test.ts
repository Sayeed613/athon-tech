/** Athon — Test Type Definitions */

export interface TestItem {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  academic_term_id: string;
  title: string;
  description: string | null;
  test_type: string;
  total_marks: number;
  duration_minutes: number;
  scheduled_at: string | null;
  passing_percentage: number;
  is_published: boolean;
  published_at: string | null;
  is_results_published: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  teacher: TestTeacherInfo | null;
  class_: TestClassInfo | null;
  subject: TestSubjectInfo | null;
}

export interface TestTeacherInfo {
  id: string;
  name: string;
  employee_code: string;
}

export interface TestClassInfo {
  id: string;
  name: string;
  section: string | null;
}

export interface TestSubjectInfo {
  id: string;
  name: string;
  code: string;
}

export interface TestListResponse {
  tests: TestItem[];
  total: number;
}

export interface CreateTestRequest {
  class_id: string;
  subject_id: string;
  academic_term_id: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  description?: string;
  test_type?: string;
  scheduled_at?: string;
  passing_percentage?: number;
  is_published?: boolean;
}

export interface UpdateTestRequest {
  title?: string;
  description?: string;
  total_marks?: number;
  duration_minutes?: number;
  test_type?: string;
  scheduled_at?: string;
  passing_percentage?: number;
  is_published?: boolean;
}

export interface TestAttempt {
  id: string;
  test_id: string;
  student_id: string;
  status: "pending" | "in_progress" | "submitted" | "graded" | "results_published";
  started_at: string | null;
  submitted_at: string | null;
  total_score_auto: number | null;
  total_score_manual: number | null;
  total_score: number | null;
  is_graded: boolean;
  graded_by: string | null;
  graded_at: string | null;
  teacher_remarks: string | null;
  created_at: string;
  updated_at: string;
  student: TestStudentInfo | null;
}

export interface TestStudentInfo {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
}

export interface AttemptListResponse {
  attempts: TestAttempt[];
  total: number;
}

export interface GradeAttemptRequest {
  total_score_manual?: number;
  teacher_remarks?: string;
}
