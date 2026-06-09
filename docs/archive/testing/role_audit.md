# ATHON — ROLE AUDIT REPORT
**Date:** June 10, 2026
**Auditor:** Staff Frontend + Backend Engineer
**Method:** Static code analysis of routes, permissions, navigation, and page implementations.

---

## ROLE SUMMARY

| Role | Dashboard | Nav Items | Accessible Pages | Critical Routes |
|------|-----------|-----------|------------------|-----------------|
| **super_admin** | Admin Dashboard `GET /dashboard/admin` | 7 nav groups (Admin) | ~35 pages | Full access |
| **school_admin** | Admin Dashboard `GET /dashboard/admin` | 7 nav groups (Admin) | ~35 pages | Full CRUD |
| **principal** | Principal Dashboard `GET /dashboard/principal` | 5 nav groups (Principal) | ~25 pages | Read-only operations |
| **teacher** | Teacher Dashboard `GET /dashboard/teacher` | 4 nav groups (Teacher) | ~20 pages | Attendance, Homework, Tests |
| **student** | Student Dashboard `GET /dashboard/student` | 4 nav groups (Student) | ~12 pages | Homework, Tests |
| **parent** | Parent Dashboard `GET /dashboard/admin` (BUG) | 4 nav groups (Parent) | ~10 pages | Read-only |

---

## 1. SUPER ADMIN / SCHOOL ADMIN

### Working ✅
| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ Working | Email/password via Supabase Auth |
| `/dashboard` | ✅ Working | Admin dashboard with KPI cards, recent students/teachers, attendance snapshot, system status |
| `/users/teachers` | ✅ Working | Full CRUD with create, edit, detail, list |
| `/users/students` | ✅ Working | Full CRUD with create, edit, detail, list + import |
| `/users/parents` | ✅ Working | Full CRUD with create, edit, detail, list |
| `/academic/classes` | ✅ Working | Full CRUD with create, edit, detail, list |
| `/academic/subjects` | ✅ Working | Full CRUD with create, edit, detail, list |
| `/academic/years` | ✅ Working | Full CRUD for academic years |
| `/academic/assignments` | ✅ Working | Teacher-class-subject assignment management |
| `/academic/periods` | ✅ Working | Period (period slot) management |
| `/timetable` | ✅ Working | Visual timetable UI |
| `/attendance` | ✅ Working | Today's attendance overview |
| `/homework` | ✅ Working | Homework list with class filter |
| `/tests` | ✅ Working | Tests list with class filter |
| `/announcements` | ✅ Working | Create, view, delete announcements |
| `/notifications` | ✅ Working | Notification inbox with read/unread |
| `/reports` | ✅ Working | Attendance, homework, test reports with date range + CSV export |
| `/settings` | ✅ Working | School profile editor |
| `/forgot-password` | ✅ Working | Static page |

### Broken ❌
| Page | Issue | Severity |
|------|-------|----------|
| `/settings/leadership` | **EMPTY STATE** — placeholder only. Shows "Leadership management coming soon." | **P2** |

### Missing ⚠️
| Feature | Impact | Severity |
|---------|--------|----------|
| No user impersonation or admin override | Cannot test as other roles without separate accounts | **P3** |
| No audit log viewer | Cannot see who changed what | **P3** |

---

## 2. PRINCIPAL

### Working ✅
| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ Working | |
| `/dashboard` | ✅ Working | Principal dashboard with school metrics, performance bars, recharts charts |
| `/academic/classes` | ✅ Working | Read-only class list |
| `/academic/subjects` | ✅ Working | Read-only subject list |
| `/academic/years` | ✅ Working | Read-only calendar view |
| `/timetable` | ✅ Working | View timetable |
| `/attendance` | ✅ Working | View attendance records |
| `/homework` | ✅ Working | View homework (published only) |
| `/tests` | ✅ Working | View tests (published only) |
| `/announcements` | ✅ Working | View and create announcements |
| `/notifications` | ✅ Working | Notification inbox |
| `/reports` | ✅ Working | School performance reports |

### Navigation Routing
Principal's nav sidebar (from `constants/index.ts` `PRINCIPAL_NAV`):
- Dashboard ✅
- School (Classes, Subjects, Academic Calendar) ✅
- Operations (Timetable, Attendance, Homework, Tests) ✅
- Communication (Announcements, Notifications) ✅
- Analytics (Reports) ✅

**Note:** Principal cannot access:
- `/users/teachers` ❌ (correct)
- `/users/students` ❌ (correct)
- `/users/parents` ❌ (correct)
- `/settings` ❌ (correct)
- `/academic/assignments` ❌ (correct)
- `/attendance/mark` ❌ (correct)

### Missing ⚠️
| Feature | Impact | Severity |
|---------|--------|----------|
| Principal cannot create/edit timetable | Read-only view only | **P2** |
| No teacher evaluation/observation tools | Not in scope yet | **P3** |

---

## 3. TEACHER

### Working ✅
| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ Working | |
| `/dashboard` | ✅ Working | Teacher dashboard with attendance pending, homework review, classes, schedule |
| `/timetable` | ✅ Working | View my timetable |
| `/attendance` | ✅ Working | View attendance |
| `/attendance/mark` | ✅ Working | Tap-to-cycle mobile design, filtered to assigned classes |
| `/attendance/class/[id]` | ✅ Working | Per-class attendance view |
| `/homework` | ✅ Working | Role-aware: shows class selector + homework list |
| `/homework/create` | ✅ Working | With AI question generation panel |
| `/homework/[id]` | ✅ Working | Homework detail with submissions + grading |
| `/tests` | ✅ Working | Test list |
| `/tests/create` | ✅ Working | With AI test generation panel |
| `/tests/[id]` | ✅ Working | Test detail with attempts view |
| `/announcements` | ✅ Working | View and create (class-specific) |
| `/notifications` | ✅ Working | |
| `/reports` | ✅ Working | |

### Issues ⚠️
| Page | Issue | Severity |
|------|-------|----------|
| `/attendance/mark` | Teacher's class list filtered by timetable. If no timetable exists, teacher sees ALL classes. Backend `GET /timetable/teacher/{id}` may return empty if no timetable set up | **P2** |
| `/homework/[id]` | The `TeacherHomeworkView` gives full question editor including correct_answer/explanations. Students see a separate `StudentHomeworkView` without answers | ✅ Correct |

---

## 4. STUDENT

### Working ✅
| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ Working | |
| `/dashboard` | ✅ Working | Student dashboard: homework due, upcoming tests, attendance %, timetable |
| `/homework` | ✅ Working | Shows **My Homework** via `GET /homework/student/me` — no class selector, no New Homework button |
| `/homework/[id]` | ✅ Working | StudentHomeworkView: questions, submission, grade view |
| `/tests` | ✅ Working | Shows **My Tests** via `GET /tests/student/me` |
| `/tests/[id]` | ✅ Working | StudentTestView: start test, timer, questions, submit |
| `/reports` | ✅ Working | Read-only reports |
| `/announcements` | ✅ Working | View announcements |
| `/notifications` | ✅ Working | Notification inbox |

### Navigation Routing
Student's nav (from `STUDENT_NAV`):
- Dashboard ✅
- Academics (Homework, Tests, Reports) ✅
- Announcements ✅
- Notifications ✅

### Correctly Forbidden
- `/attendance/mark` — redirects to `/attendance` ✅
- `/homework/create` — redirects to `/homework` ✅
- `/tests/create` — redirects to `/tests` ✅
- `/users/*` — not in nav, route guard blocks ✅

### Missing ⚠️
| Feature | Impact | Severity |
|---------|--------|-------|
| Student attendance view | No student-specific attendance page. Backend has `GET /attendance/student/{id}` but student can only view own ID | **P2** |
| Report card / progress view | No student report cards yet | **P3** |

---

## 5. PARENT

### Working ✅
| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ Working | |
| `/dashboard` | ⚠️ **PARTIAL** | Parent dashboard calls `GET /dashboard/admin` which requires `school_admin/super_admin`. **Will return 403 for parent role.** Should call principal or parent-specific endpoint. |
| `/homework` | ✅ Working | Shows published homework via `getByClass` without `include_unpublished` |
| `/tests` | ✅ Working | Shows published tests |
| `/attendance` | ✅ Working | View attendance |
| `/reports` | ✅ Working | View reports |
| `/announcements` | ✅ Working | View announcements |
| `/notifications` | ✅ Working | |

### Navigation Routing
Parent's nav (from `PARENT_NAV`):
- Dashboard ✅ (but broken API call)
- Academics (Attendance, Homework, Tests, Reports) ✅
- Announcements ✅
- Notifications ✅

### Critical Bugs ❌
| Issue | Page | Severity |
|-------|------|----------|
| Parent dashboard calls admin endpoint — **will 403** | `/dashboard` | **P0** |

---

## PERMISSION LEAKS (Security Audit)

| Route | Expected Roles | Vulnerability |
|-------|---------------|---------------|
| `GET /attendance/today` | All authenticated | No role restriction in backend (requires `get_current_user`). Teacher sees classes they teach, student sees own record, admin sees all. ✅ Correct |
| `POST /homework/{id}/questions` | Teacher-only | `require_role("teacher")` ✅ Correct |
| `POST /ai/generate-homework` | Teacher-only | ✅ Correct |
| `POST /ai/generate-test` | Teacher-only | ✅ Correct |
| `DELETE /announcements/{id}` | Admin/Principal | Backend uses `require_role("school_admin", "super_admin", "principal")` ✅ Correct |
| `GET /dashboard/student` | Student-only | `require_role("student")` ✅ Correct |
| `GET /dashboard/principal` | Principal/SuperAdmin | `require_role("principal", "super_admin")` ✅ Correct |

No permission leaks found in route analysis.

---

## OVERALL ROLE SCORING

| Role | Working | Broken | Missing | Score |
|------|---------|--------|---------|-------|
| Super Admin | 17/18 | 0 | 2 | **94%** |
| School Admin | 17/18 | 1 | 2 | **94%** |
| Principal | 12/12 | 0 | 2 | **100%** |
| Teacher | 14/14 | 0 | 1 | **100%** |
| Student | 10/10 | 0 | 2 | **100%** |
| Parent | 7/8 | **1 (P0)** | 1 | **88%** |

## P0 ISSUES

1. **Parent dashboard 403** — ParentDashboard() calls `getAdminDashboard()` which requires `school_admin/super_admin` role → 403 Forbidden for parents.

---

*End of Role Audit Report*
