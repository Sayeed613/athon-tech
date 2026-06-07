/** Athon — Teacher Type Definitions */

export interface Teacher {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  employee_code: string;
  qualification: string | null;
  specialization: string | null;
  hire_date: string;
  is_class_teacher: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  assignments: TeacherAssignment[];
}

export interface TeacherAssignment {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  academic_term_id: string;
  is_class_teacher: boolean;
}

export interface CreateTeacherRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  employee_code: string;
  qualification?: string;
  specialization?: string;
  hire_date: string;
}

export interface UpdateTeacherRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  employee_code?: string;
  qualification?: string;
  specialization?: string;
  hire_date?: string;
  is_active?: boolean;
}

export interface TeacherListResponse {
  teachers: Teacher[];
  total: number;
  skip: number;
  limit: number;
}
