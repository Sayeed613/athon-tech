/** Athon — Student Type Definitions */

export interface Student {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  admission_number: string;
  class_id: string;
  class_name: string;
  roll_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  enrollment_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  parents: StudentParentInfo[];
  enrollments: StudentEnrollmentInfo[];
}

export interface StudentParentInfo {
  id: string;
  parent_id: string;
  parent_name: string;
  relationship: string;
  is_primary_contact: boolean;
}

export interface StudentEnrollmentInfo {
  id: string;
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  status: string;
  enrolled_at: string;
}

export interface CreateStudentRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  admission_number: string;
  class_id: string;
  roll_number?: string;
  date_of_birth?: string;
  gender?: string;
  enrollment_date?: string;
}

export interface UpdateStudentRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  admission_number?: string;
  class_id?: string;
  roll_number?: string;
  date_of_birth?: string;
  gender?: string;
  is_active?: boolean;
}

export interface StudentListResponse {
  students: Student[];
  total: number;
  skip: number;
  limit: number;
}

/** From GET /reports/student/{id} */
export interface StudentSummaryReport {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  attendance_present_percentage: number;
  attendance_absent_percentage: number;
  attendance_total_records: number;
  homework_total_assigned: number;
  homework_submitted: number;
  homework_completion_rate: number;
  homework_average_score: number;
  tests_total: number;
  tests_attempted: number;
  tests_average_score: number;
  tests_highest_score: number;
  tests_pass_rate: number;
}

export interface BulkImportResponse {
  imported: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
}
