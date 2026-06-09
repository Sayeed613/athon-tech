# Athon — Project Overview

**Last Updated**: June 9, 2026
**Status**: Post-Cleanup Sprint

---

## Vision

Athon is an AI-powered school operating system for Indian schools (Classes 1-10). The platform reduces teacher administrative work, improves parent communication, digitizes attendance/homework/tests/reports, and provides principals with school-wide visibility.

---

## Roles

| Role | Platform | Primary Device | Auth Level |
|------|----------|---------------|------------|
| **Super Admin** | Web | Desktop | System-wide |
| **School Admin** | Web | Desktop | Full CRUD |
| **Principal** | Web | Desktop/Laptop | Read + Limited Write |
| **Teacher** | Mobile-first | Phone | Read + Write (own scope) |
| **Parent** | Mobile | Phone | Read-only |
| **Student** | Mobile | Phone | Read + Own Submit |

---

## Completed Work

### Backend: ~65% Production Readiness

| Module | Status | Details |
|--------|:------:|---------|
| Authentication | **100%** | JWT + JWKS, all 5 roles login tested |
| School Isolation | **100%** | All queries school-scoped |
| Teachers CRUD | ✅ Complete | Create, list, get, update, delete |
| Students CRUD | ✅ Complete | Create, list, get, update, delete, bulk import |
| Classes CRUD | ✅ Complete | Create, list, get, update, delete |
| Subjects CRUD | ✅ Complete | Create, list, get, update, delete |
| Academic Years/Terms/Periods | ✅ Complete | Full CRUD |
| Teacher Assignments | ✅ Complete | Create, list, delete |
| Timetable | ✅ Complete | Read + CRUD |
| Attendance | ✅ Complete | Mark, batch, history, today |
| Homework | ✅ Complete | Create, detail, submit, grade, questions, reorder |
| Tests | ✅ Complete | Create, detail, start, submit, results |
| Notifications | ✅ Complete | Send, list, mark read, unread count |
| Announcements | ✅ Complete | Create, list, get, update, delete |
| Reports | ✅ Complete | Attendance, homework, tests, student/class/teacher summaries |
| Dashboards | ✅ Complete | Admin, Principal, Teacher, Student |
| Parent Portal | ✅ Complete | Dashboard, children, attendance, homework, tests |
| AI Generation | ✅ Complete | Homework question generation via OpenAI |
| WhatsApp Integration | ✅ Complete | Absence alerts wired to attendance |
| Celery Workers | ⚠️ Partial | Notification tasks working; cleanup tasks partial |

### Frontend: Build Passes ✅

| Module | Status | Pages | Details |
|--------|:------:|:-----:|---------|
| Authentication | ✅ | 2 | Login, Forgot Password (stub) |
| Dashboard | ✅ | 1 | Role-routed (admin/teacher/student/principal/parent) |
| User Management | ✅ | 11 | Teachers, Students, Parents, Principals CRUD |
| Academic Management | ✅ | 12 | Classes, Subjects, Years, Assignments |
| Attendance | ✅ | 4 | Overview, Mark, Class history, Student history |
| Homework | ✅ | 4 | List, Create (with AI), Detail, Edit |
| Tests | ✅ | 5 | List, Create, Detail, Edit, Results |
| Timetable | ✅ | 1 | Schedule view |
| Announcements | ✅ | 1 | List/Create |
| Notifications | ✅ | 1 | Inbox |
| Reports | ✅ | 1 | Aggregated reports |
| Settings | ✅ | 2 | School profile, Leadership |

### Database: 100% Complete

- **29 tables** mapped to ORM models
- **11 ENUM types** defined
- **41 indexes** for performance
- **RLS policies** on all tables
- **Seed data**: 112 users across all roles

---

## Current Issues

### 🔴 Critical

| Issue | Area | Notes |
|-------|------|-------|
| Parent dashboard calls admin API | Frontend | Shows school-wide metrics instead of child data |
| `day_name` undefined in dashboard_service | Backend | Crashes teacher/student dashboard at runtime |

### 🟡 Medium

| Issue | Area | Notes |
|-------|------|-------|
| No test coverage (0%) | Project | No unit, integration, or E2E tests |
| Forgot password is stub | Frontend | No password reset flow |
| Missing pagination on list endpoints | Backend | Infrastructure exists, not wired |
| Inconsistent response wrapping | Backend | Mixed response formats |

### 🟢 Low

| Issue | Area | Notes |
|-------|------|-------|
| N+1 queries in 3 locations | Backend | Performance issue |
| No rate limiting | Backend | API unprotected |
| No Docker configuration | DevOps | 3 empty Docker files |

---

## Working Features

| Feature | Status | Notes |
|---------|:------:|-------|
| Login (all 5 roles) | ✅ | Password: Athon2025! |
| Dashboard (admin, teacher, student, principal) | ✅ | Real data from backend |
| Create teacher/student/parent/principal | ✅ | With Supabase Auth sync |
| Class/subject/year management | ✅ | Full CRUD |
| Teacher assignments | ✅ | Assign teachers to classes/subjects |
| Timetable view | ✅ | Role-filtered schedules |
| Mark attendance (batch) | ✅ | Mobile-friendly tap-to-cycle |
| View attendance history | ✅ | By class or student |
| Create homework | ✅ | With AI question generation |
| Submit homework | ✅ | Student submission flow |
| Grade homework | ✅ | Score + remarks |
| Create tests | ✅ | Publish workflow |
| Attempt tests | ✅ | Start/submit flow |
| View test results | ✅ | Score distribution |
| Announcements | ✅ | Create, publish, delete |
| Notifications | ✅ | Send, receive, mark read |
| Reports | ✅ | Attendance, homework, tests |
| School settings | ✅ | Profile management |

## Broken Features

| Feature | Issue | Status |
|---------|-------|:------:|
| Parent dashboard | Shows admin data instead of child-specific data | Needs fix |
| Forgot password | Placeholder page only | Needs implementation |
| Test timer UI | No countdown for test attempts | Needs implementation |
| AI generation frontend | Backend ready, frontend partially implemented | P1 |

---

## Next Priorities

1. **Fix parent dashboard** — call correct `/parent/dashboard` API
2. **Fix `day_name` bug** — add `day_of_week` variable to `dashboard_service.py`
3. **Implement test suite** — start with unit tests for critical paths
4. **Implement forgot password** — complete the auth flow
5. **Add Docker configuration** — enable containerized deployment

---

## Production Readiness: **~65%**

| Category | Score |
|----------|:-----:|
| Backend API | 85% |
| Frontend UI | 80% |
| Database | 100% |
| Auth/Security | 95% |
| Testing | 0% |
| DevOps | 10% |
| Documentation | 90% |
| **Overall** | **~65%** |
