/** Athon — App-wide Constants */

import type { NavItem } from "@/types";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  SCHOOL_ADMIN: "school_admin",
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

/** ── Admin Navigation (School Admin) ───────────────────────── */
export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  {
    label: "School",
    href: "#",
    icon: "building-2",
    children: [
      { label: "Classes", href: "/academic/classes", icon: "building-2" },
      { label: "Subjects", href: "/academic/subjects", icon: "book" },
      { label: "Academic Calendar", href: "/academic/years", icon: "calendar" },
    ],
  },
  {
    label: "People",
    href: "#",
    icon: "users",
    children: [
      { label: "Students", href: "/users/students", icon: "graduation-cap" },
      { label: "Teachers", href: "/users/teachers", icon: "user-round" },
      { label: "Parents", href: "/users/parents", icon: "users" },
    ],
  },
  {
    label: "Operations",
    href: "#",
    icon: "clipboard-list",
    children: [
      { label: "Teacher Assignments", href: "/academic/assignments", icon: "clipboard-list" },
      { label: "Timetable", href: "/timetable", icon: "calendar-range" },
      { label: "Attendance", href: "/attendance", icon: "calendar-check" },
      { label: "Homework", href: "/homework", icon: "book-open" },
      { label: "Tests", href: "/tests", icon: "file-bar-chart" },
    ],
  },
  {
    label: "Communication",
    href: "#",
    icon: "megaphone",
    children: [
      { label: "Announcements", href: "/announcements", icon: "megaphone" },
      { label: "Notifications", href: "/notifications", icon: "bell" },
    ],
  },
  {
    label: "Analytics",
    href: "#",
    icon: "file-bar-chart",
    children: [
      { label: "Reports", href: "/reports", icon: "file-bar-chart" },
    ],
  },
  {
    label: "Settings",
    href: "#",
    icon: "settings",
    children: [
      { label: "School Leadership", href: "/settings/leadership", icon: "crown" },
      { label: "School Profile", href: "/settings", icon: "settings" },
    ],
  },
];

/** ── Principal Navigation ──────────────────────────────────── */
export const PRINCIPAL_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  {
    label: "School",
    href: "#",
    icon: "building-2",
    children: [
      { label: "Classes", href: "/academic/classes", icon: "building-2" },
      { label: "Subjects", href: "/academic/subjects", icon: "book" },
      { label: "Academic Calendar", href: "/academic/years", icon: "calendar" },
    ],
  },
  {
    label: "Operations",
    href: "#",
    icon: "clipboard-list",
    children: [
      { label: "Timetable", href: "/timetable", icon: "calendar-range" },
      { label: "Attendance", href: "/attendance", icon: "calendar-check" },
      { label: "Homework", href: "/homework", icon: "book-open" },
      { label: "Tests", href: "/tests", icon: "file-bar-chart" },
    ],
  },
  {
    label: "Communication",
    href: "#",
    icon: "megaphone",
    children: [
      { label: "Announcements", href: "/announcements", icon: "megaphone" },
      { label: "Notifications", href: "/notifications", icon: "bell" },
    ],
  },
  {
    label: "Analytics",
    href: "#",
    icon: "file-bar-chart",
    children: [
      { label: "Reports", href: "/reports", icon: "file-bar-chart" },
    ],
  },
];

/** ── Teacher Navigation ──────────────────────────────────── */
export const TEACHER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "My Timetable", href: "/timetable", icon: "calendar-range" },
  {
    label: "Operations",
    href: "#",
    icon: "clipboard-list",
    children: [
      { label: "Attendance", href: "/attendance", icon: "calendar-check" },
      { label: "Homework", href: "/homework", icon: "book-open" },
      { label: "Tests", href: "/tests", icon: "file-bar-chart" },
    ],
  },
  {
    label: "Communication",
    href: "#",
    icon: "megaphone",
    children: [
      { label: "Announcements", href: "/announcements", icon: "megaphone" },
      { label: "Notifications", href: "/notifications", icon: "bell" },
    ],
  },
];

/** ── Parent Navigation ───────────────────────────────────── */
export const PARENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  {
    label: "Academics",
    href: "#",
    icon: "book-open",
    children: [
      { label: "Attendance", href: "/attendance", icon: "calendar-check" },
      { label: "Homework", href: "/homework", icon: "book-open" },
      { label: "Tests", href: "/tests", icon: "file-bar-chart" },
      { label: "Reports", href: "/reports", icon: "file-bar-chart" },
    ],
  },
  { label: "Announcements", href: "/announcements", icon: "megaphone" },
  { label: "Notifications", href: "/notifications", icon: "bell" },
];

/** ── Student Navigation ──────────────────────────────────── */
export const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  {
    label: "Academics",
    href: "#",
    icon: "book-open",
    children: [
      { label: "Homework", href: "/homework", icon: "book-open" },
      { label: "Tests", href: "/tests", icon: "file-bar-chart" },
      { label: "Reports", href: "/reports", icon: "file-bar-chart" },
    ],
  },
  { label: "Announcements", href: "/announcements", icon: "megaphone" },
  { label: "Notifications", href: "/notifications", icon: "bell" },
];

export const PUBLIC_ROUTES = ["/login", "/forgot-password"];

export const ROUTE_ROLES: Record<string, string[]> = {
  "/dashboard": ["super_admin", "school_admin", "principal", "teacher", "student", "parent"],
  "/users/teachers": ["super_admin", "school_admin"],
  "/users/students": ["super_admin", "school_admin"],
  "/users/parents": ["super_admin", "school_admin"],
  "/users/principals": ["super_admin", "school_admin"],
  "/academic/classes": ["super_admin", "school_admin", "principal"],
  "/academic/subjects": ["super_admin", "school_admin", "principal"],
  "/academic/years": ["super_admin", "school_admin", "principal"],
  "/academic/terms": ["super_admin", "school_admin", "principal"],
  "/academic/periods": ["super_admin", "school_admin", "principal"],
  "/academic/assignments": ["super_admin", "school_admin", "principal"],
  "/timetable": ["super_admin", "school_admin", "principal", "teacher"],
  "/attendance": ["super_admin", "school_admin", "principal", "teacher", "parent"],
  "/attendance/mark": ["teacher"],
  "/attendance/class": ["super_admin", "school_admin", "principal", "teacher"],
  "/attendance/student": ["super_admin", "school_admin", "principal", "teacher", "parent"],
  "/homework": ["super_admin", "school_admin", "principal", "teacher", "parent", "student"],
  "/homework/create": ["teacher"],
  "/tests": ["super_admin", "school_admin", "principal", "teacher", "parent", "student"],
  "/tests/create": ["teacher"],
  "/notifications": ["super_admin", "school_admin", "principal", "teacher", "parent", "student"],
  "/announcements": ["super_admin", "school_admin", "principal", "teacher", "parent", "student"],
  "/reports": ["super_admin", "school_admin", "principal", "teacher", "parent", "student"],
  "/settings": ["super_admin", "school_admin"],
  "/settings/leadership": ["super_admin", "school_admin"],
};

export const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/users/teachers": "Teachers",
  "/users/students": "Students",
  "/users/parents": "Parents",
  "/users/principals": "Principals",
  "/academic": "Academic",
  "/academic/classes": "Classes",
  "/academic/subjects": "Subjects",
  "/academic/years": "Academic Calendar",
  "/academic/terms": "Terms",
  "/academic/periods": "Periods",
  "/academic/assignments": "Teacher Assignments",
  "/attendance": "Attendance",
  "/homework": "Homework",
  "/tests": "Tests",
  "/timetable": "Timetable",
  "/announcements": "Announcements",
  "/reports": "Reports",
  "/notifications": "Notifications",
  "/settings": "School Settings",
  "/settings/leadership": "School Leadership",
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    ME: "/auth/me",
    CONTEXT: "/auth/context",
  },
  TEACHERS: {
    LIST: "/teachers",
    CREATE: "/teachers",
    GET: (id: string) => `/teachers/${id}`,
    UPDATE: (id: string) => `/teachers/${id}`,
    DELETE: (id: string) => `/teachers/${id}`,
  },
  STUDENTS: {
    LIST: "/students",
    CREATE: "/students",
    GET: (id: string) => `/students/${id}`,
    UPDATE: (id: string) => `/students/${id}`,
    DELETE: (id: string) => `/students/${id}`,
    IMPORT: "/students/import",
  },
  PRINCIPALS: {
    LIST: "/principals",
    CREATE: "/principals",
    GET: (id: string) => `/principals/${id}`,
    UPDATE: (id: string) => `/principals/${id}`,
    DELETE: (id: string) => `/principals/${id}`,
  },
  CLASSES: {
    LIST: "/classes",
    CREATE: "/classes",
    GET: (id: string) => `/classes/${id}`,
    UPDATE: (id: string) => `/classes/${id}`,
    DELETE: (id: string) => `/classes/${id}`,
  },
  SUBJECTS: {
    LIST: "/subjects",
    CREATE: "/subjects",
    GET: (id: string) => `/subjects/${id}`,
    UPDATE: (id: string) => `/subjects/${id}`,
    DELETE: (id: string) => `/subjects/${id}`,
  },
  ACADEMIC_YEARS: {
    LIST: "/academic-years",
    CREATE: "/academic-years",
    GET: (id: string) => `/academic-years/${id}`,
    UPDATE: (id: string) => `/academic-years/${id}`,
    DELETE: (id: string) => `/academic-years/${id}`,
  },
  ACADEMIC_TERMS: {
    LIST: "/academic-terms",
    CREATE: "/academic-terms",
    GET: (id: string) => `/academic-terms/${id}`,
    UPDATE: (id: string) => `/academic-terms/${id}`,
    DELETE: (id: string) => `/academic-terms/${id}`,
  },
  PERIODS: {
    LIST: "/periods",
    CREATE: "/periods",
    GET: (id: string) => `/periods/${id}`,
    UPDATE: (id: string) => `/periods/${id}`,
  },
  TEACHER_ASSIGNMENTS: {
    LIST: "/teacher-assignments",
    CREATE: "/teacher-assignments",
    DELETE: (id: string) => `/teacher-assignments/${id}`,
  },
  TIMETABLE: {
    ENTRIES: "/timetable/entries",
    ENTRY: (id: string) => `/timetable/entries/${id}`,
    BY_CLASS: (id: string) => `/timetable/class/${id}`,
    BY_TEACHER: (id: string) => `/timetable/teacher/${id}`,
    TODAY: "/timetable/today",
  },
  SCHOOLS: {
    GET: (id: string) => `/schools/${id}`,
    UPDATE: (id: string) => `/schools/${id}`,
  },
  DASHBOARD: {
    ADMIN: "/dashboard/admin",
    PRINCIPAL: "/dashboard/principal",
    TEACHER: "/dashboard/teacher",
    STUDENT: "/dashboard/student",
  },
  REPORTS: {
    ATTENDANCE: "/reports/attendance",
    HOMEWORK: "/reports/homework",
    TESTS: "/reports/tests",
    STUDENT: (id: string) => `/reports/student/${id}`,
    CLASS: (id: string) => `/reports/class/${id}`,
    TEACHER: (id: string) => `/reports/teacher/${id}`,
  },
  NOTIFICATIONS: {
    LIST: "/notifications/me",
    MARK_READ: (id: string) => `/notifications/${id}/read`,
  },
  ANNOUNCEMENTS: {
    LIST: "/announcements",
    CREATE: "/announcements",
    DELETE: (id: string) => `/announcements/${id}`,
  },
} as const;
