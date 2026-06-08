/** Athon — TanStack Query Key Factory
 *
 * Centralised key management prevents cache collisions
 * and enables targeted invalidation across features.
 */

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
    context: ["auth", "context"] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    list: (params?: Record<string, unknown>) => ["teachers", "list", params] as const,
    detail: (id: string) => ["teachers", id] as const,
  },
  students: {
    all: ["students"] as const,
    list: (params?: Record<string, unknown>) => ["students", "list", params] as const,
    detail: (id: string) => ["students", id] as const,
  },
  principals: {
    all: ["principals"] as const,
    list: (params?: Record<string, unknown>) => ["principals", "list", params] as const,
    detail: (id: string) => ["principals", id] as const,
  },
  classes: {
    all: ["classes"] as const,
    list: (params?: Record<string, unknown>) => ["classes", "list", params] as const,
    detail: (id: string) => ["classes", id] as const,
  },
  subjects: {
    all: ["subjects"] as const,
    list: (params?: Record<string, unknown>) => ["subjects", "list", params] as const,
    detail: (id: string) => ["subjects", id] as const,
  },
  academicYears: {
    all: ["academic-years"] as const,
    list: (params?: Record<string, unknown>) => ["academic-years", "list", params] as const,
    detail: (id: string) => ["academic-years", id] as const,
  },
  academicTerms: {
    all: ["academic-terms"] as const,
    list: (params?: Record<string, unknown>) => ["academic-terms", "list", params] as const,
    detail: (id: string) => ["academic-terms", id] as const,
  },
  periods: {
    all: ["periods"] as const,
    list: (params?: Record<string, unknown>) => ["periods", "list", params] as const,
  },
  assignments: {
    all: ["teacher-assignments"] as const,
    list: (params?: Record<string, unknown>) => ["teacher-assignments", "list", params] as const,
  },
  timetable: {
    all: ["timetable"] as const,
    byClass: (classId: string) => ["timetable", "class", classId] as const,
    byTeacher: (teacherId: string) => ["timetable", "teacher", teacherId] as const,
    today: ["timetable", "today"] as const,
  },
  school: {
    detail: (id: string) => ["schools", id] as const,
  },
  dashboard: {
    admin: ["dashboard", "admin"] as const,
    principal: ["dashboard", "principal"] as const,
    teacher: ["dashboard", "teacher"] as const,
    student: ["dashboard", "student"] as const,
  },
  reports: {
    attendance: (params?: Record<string, unknown>) => ["reports", "attendance", params] as const,
    homework: (params?: Record<string, unknown>) => ["reports", "homework", params] as const,
    tests: (params?: Record<string, unknown>) => ["reports", "tests", params] as const,
    student: (id: string) => ["reports", "student", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  announcements: {
    all: ["announcements"] as const,
  },
  parents: {
    all: ["parents"] as const,
    list: (params?: Record<string, unknown>) => ["parents", "list", params] as const,
    detail: (id: string) => ["parents", id] as const,
  },
  attendance: {
    all: ["attendance"] as const,
    byClass: (classId: string, params?: Record<string, unknown>) => ["attendance", "class", classId, params] as const,
    byStudent: (studentId: string, termId?: string) => ["attendance", "student", studentId, termId] as const,
    today: (params?: Record<string, unknown>) => ["attendance", "today", params] as const,
  },
  homework: {
    all: ["homework"] as const,
    byClass: (classId: string) => ["homework", "class", classId] as const,
    detail: (id: string) => ["homework", id] as const,
    submissions: (homeworkId: string) => ["homework", "submissions", homeworkId] as const,
  },
  tests: {
    all: ["tests"] as const,
    byClass: (classId: string) => ["tests", "class", classId] as const,
    detail: (id: string) => ["tests", id] as const,
    results: (testId: string) => ["tests", "results", testId] as const,
  },
} as const;
