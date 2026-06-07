/** Athon — Teacher Assignment Type Definitions */

export interface TeacherAssignmentItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_code: string;
  class_id: string;
  class_name: string;
  class_section: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  academic_term_id: string;
  academic_term_name: string;
  academic_year_name: string;
  is_class_teacher: boolean;
}

export interface CreateAssignmentRequest {
  teacher_id: string;
  class_id: string;
  subject_id: string;
  academic_term_id: string;
  is_class_teacher?: boolean;
}

export interface AssignmentListResponse {
  assignments: TeacherAssignmentItem[];
  total: number;
}
