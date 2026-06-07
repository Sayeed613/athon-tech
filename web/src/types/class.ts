/** Athon — Class Type Definitions */

export interface ClassItem {
  id: string;
  name: string;
  section: string | null;
  academic_year_id: string;
  academic_year_name: string;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  room_number: string | null;
  capacity: number;
  student_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateClassRequest {
  name: string;
  section?: string;
  academic_year_id: string;
  class_teacher_id?: string;
  room_number?: string;
  capacity?: number;
}

export interface UpdateClassRequest {
  name?: string;
  section?: string;
  academic_year_id?: string;
  class_teacher_id?: string;
  room_number?: string;
  capacity?: number;
}

export interface ClassListResponse {
  classes: ClassItem[];
  total: number;
}

/** Used for filter dropdowns */
export interface ClassOption {
  id: string;
  name: string;
  section: string | null;
}
