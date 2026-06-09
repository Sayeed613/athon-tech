# Athon — Frontend Architecture

**Last Updated**: June 9, 2026

---

## 1. Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 16.2.7 |
| Language | TypeScript | 5.x |
| UI Library | React | 19.2.4 |
| Styling | Tailwind CSS | 4.x |
| Icons | Lucide React | 1.17.0 |
| HTTP Client | Axios | 1.17.0 |
| Server State | TanStack React Query | 5.101.0 |
| Client State | Zustand | 5.0.14 |
| Forms | React Hook Form + Zod | 7.77.0 |
| Tables | TanStack React Table | 8.21.3 |
| Charts | Recharts | 3.8.1 |
| UI Library | shadcn/ui (base-ui) | 1.5.0 |

---

## 2. Folder Structure

```
web/src/
├── app/                    # Next.js App Router pages (51 pages)
│   ├── academic/           # Classes, subjects, years, assignments
│   │   ├── assignments/    # Teacher assignments
│   │   ├── classes/        # Class management (list, create, edit, detail)
│   │   ├── subjects/       # Subject management
│   │   └── years/          # Academic year/term management
│   ├── announcements/      # Announcements list
│   ├── attendance/         # Attendance views + marking
│   │   ├── class/[id]/     # Class attendance history
│   │   ├── mark/           # Batch attendance marking
│   │   └── student/[id]/   # Student attendance history
│   ├── dashboard/          # Role-based dashboard (admin/teacher/student/principal/parent)
│   ├── forgot-password/    # Password reset (stub)
│   ├── homework/           # Homework management
│   │   ├── create/         # Create homework (with AI generation)
│   │   ├── [id]/           # Detail view (teacher: grade, student: submit)
│   │   └── [id]/edit/      # Edit homework
│   ├── login/              # Login page
│   ├── notifications/      # Notification inbox
│   ├── reports/            # Reports dashboard
│   ├── settings/           # School settings
│   │   └── leadership/     # School leadership management
│   ├── tests/              # Test management
│   │   ├── create/         # Create test
│   │   ├── [id]/           # Test detail
│   │   ├── [id]/edit/      # Edit test
│   │   └── [id]/results/   # Test results
│   ├── timetable/          # Timetable view
│   └── users/              # User management
│       ├── parents/        # Parent CRUD
│       ├── students/       # Student CRUD + import
│       └── teachers/       # Teacher CRUD
├── components/             # Shared UI components (44 files)
│   ├── forms/              # Form utilities (form-actions, form-fields)
│   ├── layout/             # Layout components (admin-layout, sidebar, top-nav, etc.)
│   ├── shared/             # Shared functionality (auth-guard, error-boundary, etc.)
│   ├── tables/             # Data table component
│   └── ui/                 # shadcn/ui primitives (button, card, dialog, etc.)
├── config/                 # App configuration
├── constants/              # Navigation constants, route roles, labels
├── features/               # Feature-specific components
│   └── dashboard/          # Dashboard widgets (KPI cards, announcements, etc.)
├── hooks/                  # Custom React hooks (7)
├── lib/                    # Utilities (axios client, query keys, utils)
├── providers/              # React context providers (app, query, theme)
├── services/               # API client services (18)
└── types/                  # TypeScript type definitions (17 files)
```

---

## 3. Authentication

### Flow

```
Login Page → authService.login() → POST /auth/login → JWT Token
                                                          ↓
                                          Zustand Store (token + user)
                                                          ↓
                                          Axios Interceptor (Bearer token)
                                                          ↓
                                          AuthGuard → role-based routing
```

### State Management

| Concern | Solution | Details |
|---------|----------|---------|
| Auth State | Zustand (`use-auth-store`) | Token, user, login/logout actions |
| Theme | Zustand (`use-theme-store`) | Dark/light mode toggle |
| UI State | Zustand (`use-ui-store`) | Sidebar open/close, modals |
| Server State | TanStack React Query | All API data fetching with caching |
| Forms | React Hook Form + Zod | Type-safe form validation |

### Auth Hooks

| Hook | Purpose |
|------|---------|
| `useAuth()` | Login/logout actions, session state |
| `useUserRole()` | Current user's role checks (isAdmin, isTeacher, etc.) |
| `useAuthStore()` | Raw store access (token, user) |

---

## 4. Role-Based Routing

| Role | Sidebar | Accessible Pages |
|------|---------|-----------------|
| **Admin** | Full menu | All pages |
| **Principal** | Dashboard, School, Operations, Communication, Analytics | Dashboard, classes, subjects, timetable, attendance, homework, tests, reports, announcements |
| **Teacher** | Dashboard, Timetable, Operations, Communication | Dashboard, timetable, attendance (mark), homework (create), tests (create), announcements |
| **Student** | Dashboard, Academics, Announcements, Notifications | Dashboard, homework (view/submit), tests (attempt), reports, announcements |
| **Parent** | Dashboard, Academics, Announcements, Notifications | Dashboard (calls admin API - BUG), attendance, homework, tests, announcements |

Route guards are enforced via `ROUTE_ROLES` in `constants/index.ts` and the `AuthGuard` component.

---

## 5. Implemented Pages (51 total)

| Route | Purpose | Status |
|-------|---------|--------|
| `/login` | Authentication | ✅ Built |
| `/forgot-password` | Password reset | ⚠️ Stub |
| `/dashboard` | Role-based dashboard | ✅ Built |
| `/users/teachers` | Teacher management | ✅ Built |
| `/users/students` | Student management | ✅ Built |
| `/users/students/import` | Bulk import | ✅ Built |
| `/users/parents` | Parent management | ✅ Built |
| `/users/principals` | Principal management | ✅ Built |
| `/academic/classes` | Class management | ✅ Built |
| `/academic/subjects` | Subject management | ✅ Built |
| `/academic/years` | Academic calendar | ✅ Built |
| `/academic/assignments` | Teacher assignments | ✅ Built |
| `/attendance` | Attendance overview | ✅ Built |
| `/attendance/mark` | Mark attendance | ✅ Built |
| `/attendance/class/[id]` | Class history | ✅ Built |
| `/attendance/student/[id]` | Student history | ✅ Built |
| `/homework` | Homework listing | ✅ Built |
| `/homework/create` | Create homework | ✅ Built (AI generation) |
| `/homework/[id]` | Homework detail | ✅ Built |
| `/tests` | Test listing | ✅ Built |
| `/tests/create` | Create test | ✅ Built |
| `/tests/[id]` | Test detail | ✅ Built |
| `/tests/[id]/results` | Test results | ✅ Built |
| `/timetable` | Timetable view | ✅ Built |
| `/announcements` | Announcements | ✅ Built |
| `/notifications` | Notifications | ✅ Built |
| `/reports` | Reports | ✅ Built |
| `/settings` | School settings | ✅ Built |
| `/settings/leadership` | School leadership | ✅ Built |

---

## 6. Services (18 API clients)

| Service | Base Endpoint | Key Methods |
|---------|-------------|-------------|
| `academic.service.ts` | `/academic-years`, `/academic-terms` | listTerms, listYears |
| `announcements.service.ts` | `/announcements` | getList, create, delete |
| `assignment.service.ts` | `/teacher-assignments` | list |
| `attendance.service.ts` | `/attendance` | getByClass, batchMark, getByStudent |
| `auth.service.ts` | `/auth` | login, getMe |
| `base.service.ts` | Generic HTTP helper | get, post, patch, delete |
| `class.service.ts` | `/classes` | list, get, create, update, delete |
| `dashboard.service.ts` | `/dashboard` | getAdminDashboard, getTeacherDashboard, etc. |
| `homework.service.ts` | `/homework` | get, create, submit, grade, generateAI |
| `notifications.service.ts` | `/notifications` | getList, markRead, markAllRead |
| `parent.service.ts` | `/parent` | getDashboard, getChildren, getAttendance |
| `reports.service.ts` | `/reports` | getAttendance, getHomework, getTests |
| `school.service.ts` | `/schools` | get, update |
| `student.service.ts` | `/students` | list, get, create, update, delete, bulkImport |
| `subject.service.ts` | `/subjects` | list, get, create, update, delete |
| `teacher.service.ts` | `/teachers` | list, get, create, update, delete |
| `test.service.ts` | `/tests` | get, create, start, submit, getMyTests |
| `timetable.service.ts` | `/timetable` | getByTeacher, getByClass, getToday |

---

## 7. Design System

| Element | Implementation |
|---------|---------------|
| Colors | Tailwind CSS with CSS variables (shadcn/ui) |
| Typography | Inter font, configurable scale |
| Icons | Lucide React (outline, 1.5px stroke) |
| Components | 30+ shadcn/ui primitives (button, card, dialog, etc.) |
| Theme | Light/Dark mode via `next-themes` |
| Notifications | Sonner toast library |

### Core UI Components

| Component | Variants |
|-----------|----------|
| Button | Primary, Secondary, Ghost, Danger, Icon |
| Card | Stat, Metric, List, Dashboard Widget |
| Badge | Count, Status, Dot |
| Dialog | Confirmation, Form, Full-screen |
| Table | Sortable, Selectable, Paginated |

---

## 8. Known Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | Parent dashboard calls admin API instead of parent portal endpoint | **High** — incorrect data |
| 2 | Forgot password page is a stub | Medium |
| 3 | No test attempt timer UI | Medium |
| 4 | Reports page lacks chart visualizations | Medium |
| 5 | No skip-to-content links (accessibility) | Medium |
| 6 | Some pages lack loading skeletons | Low |
| 7 | No illustrated empty states | Low |

## 9. Technical Debt

| # | Item | Priority |
|---|------|----------|
| 1 | No unit tests for components | High |
| 2 | Feature components tightly coupled to dashboard | Medium |
| 3 | Hardcoded API URL in config | Low |
| 4 | Some pages use inline `useState` instead of form library | Medium |
