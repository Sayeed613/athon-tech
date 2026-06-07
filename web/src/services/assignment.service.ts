/** Athon — Teacher Assignment API Service */

import http from "@/lib/axios";
import { API_ENDPOINTS } from "@/constants";
import { teacherService } from "@/services/teacher.service";
import { classService } from "@/services/class.service";
import { subjectService } from "@/services/subject.service";
import { academicService } from "@/services/academic.service";
import type {
  TeacherAssignmentItem,
  CreateAssignmentRequest,
  AssignmentListResponse,
} from "@/types/assignment";

interface RawAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  academic_term_id: string;
  is_class_teacher: boolean;
}

// Cache reference data to avoid refetching on every create()
let cachedTeachers: Record<string, { first_name: string; last_name: string; employee_code: string }> = {};
let cachedClasses: Record<string, { name: string; section: string | null }> = {};
let cachedSubjects: Record<string, { name: string; code: string }> = {};
let cachedTerms: Record<string, { name: string; academic_year_id: string; academic_year_name: string }> = {};
let cachedYears: Record<string, { name: string }> = {};

/** Refresh the reference data caches */
async function refreshReferenceData(): Promise<void> {
  const [teachersData, classesData, subjectsData, termsData, yearsData] = await Promise.all([
    teacherService.list({ limit: 200 }),
    classService.list({ limit: 200 }),
    subjectService.list({ limit: 200 }),
    academicService.listTerms(),
    academicService.listYears(),
  ]);

  cachedTeachers = {};
  for (const t of teachersData?.teachers ?? []) {
    cachedTeachers[t.id] = { first_name: t.first_name, last_name: t.last_name, employee_code: t.employee_code };
  }

  cachedClasses = {};
  for (const c of classesData?.classes ?? []) {
    cachedClasses[c.id] = { name: c.name, section: c.section };
  }

  cachedSubjects = {};
  for (const s of subjectsData?.subjects ?? []) {
    cachedSubjects[s.id] = { name: s.name, code: s.code };
  }

  cachedTerms = {};
  for (const t of termsData?.academic_terms ?? []) {
    cachedTerms[t.id] = { name: t.name, academic_year_id: t.academic_year_id, academic_year_name: t.academic_year_name };
  }

  cachedYears = {};
  for (const y of yearsData?.academic_years ?? []) {
    cachedYears[y.id] = { name: y.name };
  }
}

/** Build a TeacherAssignmentItem from a raw assignment + caches */
function buildAssignment(raw: RawAssignment): TeacherAssignmentItem {
  const teacher = cachedTeachers[raw.teacher_id];
  const cls = cachedClasses[raw.class_id];
  const subject = cachedSubjects[raw.subject_id];
  const term = cachedTerms[raw.academic_term_id];
  const year = term ? cachedYears[term.academic_year_id] : undefined;

  return {
    id: raw.id,
    teacher_id: raw.teacher_id,
    teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : "Unknown",
    teacher_code: teacher?.employee_code ?? "",
    class_id: raw.class_id,
    class_name: cls?.name ?? "Unknown",
    class_section: cls?.section ?? null,
    subject_id: raw.subject_id,
    subject_name: subject?.name ?? "Unknown",
    subject_code: subject?.code ?? "",
    academic_term_id: raw.academic_term_id,
    academic_term_name: term?.name ?? "Unknown",
    academic_year_name: year?.name ?? term?.academic_year_name ?? "",
    is_class_teacher: raw.is_class_teacher,
  };
}

export const assignmentService = {
  /** GET /teacher-assignments — list with optional filters */
  async list(params?: {
    teacher_id?: string;
    class_id?: string;
    subject_id?: string;
    search?: string;
  }): Promise<AssignmentListResponse> {
    const { data: rawAssignments } = await http.get<RawAssignment[]>(
      API_ENDPOINTS.TEACHER_ASSIGNMENTS.LIST,
      { params: { teacher_id: params?.teacher_id, class_id: params?.class_id } }
    );

    if (!rawAssignments || rawAssignments.length === 0) {
      return { assignments: [], total: 0 };
    }

    // Refresh reference data
    await refreshReferenceData();

    // Join data
    const assignments: TeacherAssignmentItem[] = rawAssignments.map(buildAssignment);

    // Client-side filters
    let filtered = assignments;

    if (params?.subject_id) {
      filtered = filtered.filter((a) => a.subject_id === params.subject_id);
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.teacher_name.toLowerCase().includes(q) ||
          a.class_name.toLowerCase().includes(q) ||
          a.subject_name.toLowerCase().includes(q) ||
          a.subject_code.toLowerCase().includes(q) ||
          a.academic_term_name.toLowerCase().includes(q)
      );
    }

    return { assignments: filtered, total: filtered.length };
  },

  /** POST /teacher-assignments — create a new assignment */
  async create(payload: CreateAssignmentRequest): Promise<TeacherAssignmentItem> {
    const { data } = await http.post<RawAssignment>(
      API_ENDPOINTS.TEACHER_ASSIGNMENTS.CREATE,
      payload
    );

    // Build the response directly from the raw assignment + cached reference data.
    // Refresh caches first to ensure fresh data.
    await refreshReferenceData();
    return buildAssignment(data);
  },

  /** DELETE /teacher-assignments/{id} — remove assignment */
  async remove(id: string): Promise<void> {
    await http.delete(API_ENDPOINTS.TEACHER_ASSIGNMENTS.DELETE(id));
  },
};
