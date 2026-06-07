/** Athon — Attendance Type Definitions */

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  academic_term_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "half_day";
  marked_by: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  student: AttendanceStudentInfo | null;
  marker: AttendanceMarkerInfo | null;
}

export interface AttendanceStudentInfo {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
}

export interface AttendanceMarkerInfo {
  id: string;
  employee_code: string;
  name: string;
}

export interface AttendanceListResponse {
  records: AttendanceRecord[];
  total: number;
}

export interface MarkAttendanceRequest {
  student_id: string;
  class_id: string;
  academic_term_id: string;
  date: string;
  status: "present" | "absent" | "late" | "half_day";
  remarks?: string;
}

export interface BatchAttendanceItem {
  student_id: string;
  status: "present" | "absent" | "late" | "half_day";
  remarks?: string;
}

export interface BatchMarkAttendanceRequest {
  class_id: string;
  academic_term_id: string;
  date: string;
  records: BatchAttendanceItem[];
}
