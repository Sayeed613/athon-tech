/** Athon — Timetable Type Definitions */

export interface PeriodInfo {
  id: string;
  name: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
}

export interface TimetableTeacherInfo {
  id: string;
  name: string;
  employee_code: string;
}

export interface TimetableSubjectInfo {
  id: string;
  name: string;
  code: string;
  is_core: boolean;
}

export interface TimetableClassInfo {
  id: string;
  name: string;
  section: string | null;
}

export interface TimetableEntry {
  id: string;
  day_of_week: number;
  room_number: string | null;
  is_active: boolean;
  period: PeriodInfo;
  subject: TimetableSubjectInfo;
  teacher: TimetableTeacherInfo;
  class_: TimetableClassInfo;
}

export interface TimetableResponse {
  entries: TimetableEntry[];
}

export interface CreateTimetableEntryRequest {
  teacher_id: string;
  class_id: string;
  subject_id: string;
  period_id: string;
  academic_term_id: string;
  day_of_week: number;
  room_number?: string;
}

export interface UpdateTimetableEntryRequest {
  teacher_id?: string;
  class_id?: string;
  subject_id?: string;
  period_id?: string;
  day_of_week?: number;
  room_number?: string;
  is_active?: boolean;
}

export interface ClassTimetableOption {
  id: string;
  name: string;
  section: string | null;
}
