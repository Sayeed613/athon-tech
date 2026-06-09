/** Athon — Homework Type Definitions */

export interface HomeworkItem {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  academic_term_id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_score: number;
  is_published: boolean;
  published_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  teacher: HomeworkTeacherInfo | null;
  class_: HomeworkClassInfo | null;
  subject: HomeworkSubjectInfo | null;
  /** Questions attached to this homework (from detail endpoint) */
  questions?: Array<Record<string, unknown>>;
}

export interface HomeworkTeacherInfo {
  id: string;
  name: string;
  employee_code: string;
}

export interface HomeworkClassInfo {
  id: string;
  name: string;
  section: string | null;
}

export interface HomeworkSubjectInfo {
  id: string;
  name: string;
  code: string;
}

export interface HomeworkListResponse {
  homeworks: HomeworkItem[];
  total: number;
}

export interface CreateHomeworkRequest {
  class_id: string;
  subject_id: string;
  academic_term_id: string;
  title: string;
  due_date: string;
  description?: string;
  max_score?: number;
  is_published?: boolean;
}

export interface UpdateHomeworkRequest {
  title?: string;
  description?: string;
  due_date?: string;
  max_score?: number;
  is_published?: boolean;
}

export interface HomeworkSubmission {
  id: string;
  homework_id: string;
  student_id: string;
  status: "pending" | "in_progress" | "submitted" | "graded" | "results_published";
  submitted_at: string | null;
  total_score: number | null;
  is_graded: boolean;
  graded_by: string | null;
  graded_at: string | null;
  teacher_remarks: string | null;
  created_at: string;
  updated_at: string;
  student: HomeworkStudentInfo | null;
}

export interface HomeworkStudentInfo {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
}

export interface SubmissionListResponse {
  submissions: HomeworkSubmission[];
  total: number;
}

export interface GradeSubmissionRequest {
  total_score: number;
  teacher_remarks?: string;
}
