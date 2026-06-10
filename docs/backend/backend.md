# ATHON V2 — Backend Architecture Review

**Reviewers**: Google Principal Backend Engineer, Staff Software Architect, Principal API Designer, Principal Systems Engineer, EdTech Domain Expert  
**Date**: June 10, 2026  
**Status**: Architecture Review — Pre-Implementation  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Reference**: V1 Backend (23 routes, 11 domains, 26 repos, 33 models)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [V1 Architecture Autopsy](#2-v1-architecture-autopsy)
3. [Domain Architecture (Task 1)](#3-domain-architecture)
4. [Service Architecture (Task 2)](#4-service-architecture)
5. [Repository Architecture (Task 3)](#5-repository-architecture)
6. [API Architecture (Task 4)](#6-api-architecture)
7. [Permission Matrix (Task 5)](#7-permission-matrix)
8. [Attendance Flow (Task 6)](#8-attendance-flow)
9. [Assignment Flow (Task 7)](#9-assignment-flow)
10. [Assessment Flow (Task 8)](#10-assessment-flow)
11. [AI Architecture (Task 9)](#11-ai-architecture)
12. [Analytics Architecture (Task 10)](#12-analytics-architecture)
13. [Scalability Analysis (Task 11)](#13-scalability-analysis)
14. [Security Architecture (Task 12)](#14-security-architecture)
15. [Performance Targets (Task 13)](#15-performance-targets)
16. [Risks & Missing Components](#16-risks--missing-components)
17. [Build Order](#17-build-order)
18. [Final Answers](#18-final-answers)

---

## 1. Executive Summary

### V1 at a Glance

| Metric | V1 Value | V2 Target |
|--------|----------|-----------|
| Route files | 23 (flat) | 10 (grouped) |
| Domain modules | 11 | 8 |
| Service classes | ~15 | ~8 |
| Repository files | 26 | ~8 |
| Model files | 33 | ~13 |
| Lines of service code | ~3,500 | ~1,500 |
| Permission checks | Inline strings | Decorator-based RBAC |
| AI integration | Minimal (3 endpoints) | Core (12 capabilities) |
| Caching | None | Multi-layer |
| Rate limiting | None | Required |
| File upload | None | Required |

### Verdict

V1's backend was built by **quantity** — many files, many routes, many repos. V2 must be built by **quality** — fewer, smarter, faster.

**V1 achieved**: 23 routes, 26 repos, 11 domains  
**V1 missed**: Caching, rate limiting, proper RBAC, error taxonomy, file handling, AI architecture, analytics engine, background jobs

**V2 must be**: <500 lines per service, <8 repositories, permission decorators, caching-first, AI-native, analytics-ready.

---

## 2. V1 Architecture Autopsy

### What V1 Did Well

| # | Strength | Evidence |
|---|----------|----------|
| 1 | Async SQLAlchemy with proper pool management | `create_async_engine` with pool_size=20, pool_pre_ping=True |
| 2 | School-scoped tenant isolation | `_school_scope()` in BaseRepository applied to all queries |
| 3 | Soft-delete awareness | `_active_query()` automatically filters `deleted_at IS NULL` |
| 4 | Generic BaseRepository pattern | Type-safe generic CRUD with pagination support |
| 5 | Supabase JWKS verification | Production-grade JWT validation via PyJWKClient |
| 6 | Lifespan-based startup validation | Database connectivity check on startup with fail-fast |
| 7 | Batch query helpers | `get_classes_attendance_by_date()` avoids N+1 |
| 8 | Dashboard service consolidates round-trips | Comments like "Round-trip 1/2/3/4/5" show attention to DB calls |
| 9 | Structured error response format | Consistent `{data, error: {code, message, details}}` pattern |
| 10 | Celery integration | Background task dispatching for WhatsApp alerts |

### What V1 Did Wrong

| # | Mistake | Impact | V2 Fix |
|---|---------|--------|--------|
| 1 | **Flat route structure** — all 23 route files in api/v1/ | No logical grouping, hard to permission-audit | Group by role + domain |
| 2 | **26 repository files** — one per table | Massive boilerplate, 90% of repos are empty shells | 8 repositories max, generics handle 80% |
| 3 | **Permission strings inline** — `require_role("teacher", "principal")` | Roles scattered across 23 files, fragile | Centralized RBAC with decorators |
| 4 | **No caching** — every dashboard load hits DB | Dashboard >2s on 700 students | Redis cache with 60s TTL for aggregates |
| 5 | **Homework and Tests as separate domains** — duplicate patterns | `homework_service.py` and `test_service.py` are 80% identical | Unified `Assignments` + `Assessments` |
| 6 | **Academic calendar over-engineering** — `AcademicYearService` + `AcademicTermService` + `PeriodService` | 3 service classes for what could be 2 helpers | Simplify to config-based terms |
| 7 | **Anthropic provider stub** — referenced in config, never implemented | Dead code, technical debt | Remove until needed |
| 8 | **Celery tasks are empty stubs** — `notification_tasks.py` has no real implementation | False sense of background processing | Implement or remove |
| 9 | **No error taxonomy** — all errors are `HTTPException` | Frontend can't differentiate error types | Error hierarchy (ValidationError, NotFoundError, etc.) |
| 10 | **No rate limiting** — API is unprotected | Abuse potential from student/parent users | Redis-based rate limiting |
| 11 | **No file upload** — referenced in `storage_bucket` config, never implemented | Can't upload homework files or student photos | S3/MinIO integration |
| 12 | **No middleware layer for auth context** — context set per-request | Duplicate user lookups in every endpoint | Auth middleware sets `request.state` |
| 13 | **Schema files separated from routes** — `api/schemas/` directory | Scattered, hard to trace request->response flow | Co-locate schemas with routes |
| 14 | **WhatsApp provider is a stub** — `whatsapp_provider.py` exists but doesn't send | Parent notifications don't work | Implement or remove |
| 15 | **No health checks for AI** — `ai.py` endpoints don't validate API key existence | Teachers get 503 with no guidance | `/ai/health` endpoint |

---

## 3. Domain Architecture

### V1 Domain Layout (11 domains)

```
domain/
├── academic/           # AcademicCalendarService, ClassService, EnrollmentService, SubjectService, TimetableService
├── ai/                 # AIService + PromptTemplates
├── announcements/      # AnnouncementService
├── attendance/         # AttendanceService
├── dashboard/          # DashboardService (400+ lines, does everything)
├── homework/           # HomeworkService
├── identity/           # UserService, TeacherService, StudentService, ParentService, PrincipalService
├── notifications/      # NotificationService
├── reports/            # ReportsService
├── schools/            # SchoolService
├── tests/              # TestService
```

### V2 Domain Architecture (8 domains)

```
domain/
├── identity/           # Users, auth, profiles (Teacher, Student, Parent, SchoolLeader)
├── curriculum/         # Classes, Subjects, Chapters, Topics, LearningObjectives
├── attendance/         # Daily attendance marking, roll-call views, absence tracking
├── assignments/        # Homework, worksheets, projects, quizzes (unified model)
├── assessments/        # Tests, exams, practice tests (unified model)
├── analytics/          # Dashboards, reports, risk detection, insights
├── ai/                 # AI orchestration — all AI capabilities (no domain logic)
├── communications/     # Notifications, announcements, parent reports
```

### Key Changes

| Decision | Rationale |
|----------|-----------|
| Merge homework + tests → assignments + assessments | Same data model (questions, submissions, grading). Only metadata differs. |
| Merge academic calendar into curriculum | No separate calendar service needed. Terms are config, not business logic. |
| Rename `reports` → `analytics` | Reports are generated on-demand. Analytics are computed. Different architecture. |
| Merge schools into identity | School is a tenant context, not a domain. User identity is the primary concern. |
| Merge announcements into communications | Same channel as notifications. Different content model. |
| Extract AI providers as infrastructure; keep AI orchestration in domain | AI providers (OpenAI, Anthropic) are infrastructure. AI orchestration services (TeacherAI, GradingAI) stay in domain layer. This keeps business logic in domain while abstracting LLM providers. |
| Dashboard becomes analytics | Dashboards are cached snapshots of analytics, not ad-hoc queries. |

### Domain Rules

```
1. identity  → knows about all profiles (teacher, student, parent, school_leader)
2. curriculum → knows about classes, subjects, chapters, topics, LOs
3. attendance  → depends on identity (who), curriculum (where)
4. assignments  → depends on curriculum (chapter/topic), identity (teacher/student)
5. assessments  → depends on curriculum, identity; shares question model with assignments
6. analytics    → reads from all domains (read-only), caches aggressively
7. ai           → depends on curriculum (context); called by assignments, assessments
8. communications → depends on identity (who to send to)
```

**Rule**: Domains import from `identity` and `curriculum`. Never the reverse. `analytics` reads from all but writes to none.

---

## 4. Service Architecture

### V2 Service Map

```
services/
├── identity/
│   ├── AuthService           # Login, token refresh, password reset
│   ├── UserService           # CRUD for all user profiles
│   ├── TeacherService        # Teacher-specific actions (assign to class, view schedule)
│   ├── StudentService        # Student-specific actions (enroll, view progress)
│   └── ParentService         # Parent-specific actions (link child, view reports)
│
├── curriculum/
│   ├── ClassService          # Class CRUD + roster
│   ├── SubjectService        # Subject CRUD
│   └── CurriculumService     # Chapter → Topic → LO management
│
├── attendance/
│   └── AttendanceService     # Mark, batch-mark, view, trend analysis
│
├── assignments/
│   ├── AssignmentService     # Create, publish, submit, grade (unified)
│   └── QuestionService       # Question CRUD, AI generation, answer validation
│
├── assessments/
│   ├── AssessmentService     # Create, publish, attempt, auto-grade
│   └── GradingService        # AI auto-grading, teacher review, score calculation
│
├── analytics/
│   ├── DashboardService      # Role-based dashboard composition (cached)
│   ├── ProgressService       # Per-LO mastery tracking
│   ├── RiskDetectionService  # At-risk student identification
│   └── ReportService         # PDF/on-screen report generation
│
├── ai/
│   ├── AIService             # Orchestrates all AI calls
│   ├── TeacherAI             # Generator: lessons, homework, tests, rubrics
│   ├── GradingAI             # Auto-grade: MCQs, TF, short answers
│   └── InsightsAI            # Reports: parent summaries, risk flags
│
└── communications/
    ├── NotificationService   # In-app notifications
    └── AnnouncementService   # School-wide announcements
```

### What V1 Services Should Be Deleted

| V1 Service | Reason | Replacement |
|-----------|--------|-------------|
| `AcademicYearService` | Over-engineered. Years are config. | Removed. Academic year is a `schools.settings` field. |
| `AcademicTermService` | Over-engineered. Terms are date ranges. | Removed. Terms are config in school settings. |
| `EnrollmentService` | Duplicates `StudentService.class_id` logic | Removed. Student record has `class_id`. |
| `TimetableService` | Too complex for V2. Timetable is a read-only view. | Simplified to query in ClassService. |
| `SchoolService` | Thin wrapper around School CRUD | Merged into UserService (school = tenant context). |

### Service Design Rules

1. **Every service must answer**: "What teacher workflow does this enable?" If none, delete it.
2. **No service longer than 500 lines**. Split at 400.
3. **Services call repositories, never other services**. Use a coordinator pattern if cross-service orchestration is needed.
4. **Services never import from other services**. They import from repositories.
5. **No service has inline permission checks**. Permissions are decorators on route handlers.
6. **DashboardService is read-only**. It never creates, updates, or deletes. It caches and returns.

---

## 5. Repository Architecture

### V1 Problem: 26 Repository Files

Each V1 table got its own repository file. The result:

```
repository/  (26 files)
├── base.py                   # Generic CRUD — the only useful file
├── users.py                  # 15 lines, empty shell
├── students.py               # 25 lines, one custom query
├── teachers.py               # 12 lines, empty shell
├── parents.py                # 10 lines, empty shell
├── principals.py             # 10 lines, empty shell
├── schools.py                # 8 lines, empty shell
├── class_repo.py             # 30 lines, two custom queries
├── subject_repo.py           # 8 lines, empty shell
├── ... (16 more empty shells)
├── reports.py                # The only file with real aggregation logic
```

**80% of repository files are empty shells** that contribute nothing beyond BaseRepository.

### V2 Repository Architecture: 8 Files

```
repository/
├── base.py                   # Generic CRUD (survives from V1, slightly simplified)
├── users.py                  # User lookups, auth queries, profile joins
├── curriculum.py             # Class, Subject, Chapter, Topic, LO queries
├── assignments.py            # Unified assignment + question queries
├── assessments.py            # Unified assessment + answer queries
├── attendance.py             # Attendance marking, roll-call, trends
├── progress.py               # Progress snapshots, mastery aggregation
└── analytics.py              # Read-only aggregation queries (replaces V1 reports.py)
```

### What Changes

| V1 | V2 | Rationale |
|----|----|-----------|
| 26 files | 8 files | Merge by domain, not by table |
| Generic repo duplicated per table | BaseRepository handles 80% out of the box | Custom queries only when needed |
| reports.py (aggregation queries) | analytics.py (same concept, better name) | Analytics is a read domain |
| `_active_query()` soft-delete filter | Keep it — best feature | |
| No cursor pagination | Add cursor-based pagination | Offset pagination is slow at scale |
| No caching in repository | Add optional cache layer | Redis TTL for hot queries |

### Repository Rules

1. **One repository per domain, not per table**. `curriculum.py` handles Class, Subject, Chapter, Topic, LO.
2. **Repositories never call other repositories**. If you need a join, do it in the query.
3. **Repositories return ORM instances or dicts**. Never Pydantic models.
4. **AnalyticsRepository returns dicts only**. No ORM instances. Read-only.
5. **BaseRepository is the sole source of truth** for create/update/soft_delete/get. Repos only add custom query methods.
6. **No repository has business logic**. That belongs in services.

---

## 6. API Architecture

### V1 Route Structure (Flat)

```
/api/v1/
├── health                 # GET /health, GET /health/database
├── auth                   # POST /auth/login, GET /auth/me, GET /auth/context
├── schools                # CRUD schools
├── academic-years         # CRUD academic years
├── academic-terms         # CRUD academic terms
├── classes                # CRUD classes (with roster)
├── subjects               # CRUD subjects
├── periods                # CRUD periods
├── timetable              # Timetable CRUD
├── teachers               # CRUD teachers
├── students               # CRUD students
├── principals             # CRUD principals
├── parents                # CRUD parents + parent portal
├── student-parents        # Link students to parents
├── teacher-assignments    # Assign teachers to classes
├── attendance             # Mark + view attendance
├── homeworks              # Homework CRUD + submissions + grading
├── tests                  # Test CRUD + attempts + results
├── notifications          # In-app notifications
├── announcements          # School announcements
├── reports                # Report data
├── dashboard              # Role-based dashboards
├── ai                     # AI generation
```

**23 route files. 107+ endpoints.**

### V2 Route Structure (10 Groups)

```
/api/v2/
├── /health                # Health checks (system, database, AI)
│
├── /auth                  # Authentication & user context
│   ├── POST /auth/login
│   ├── POST /auth/refresh
│   ├── GET  /auth/me
│   └── POST /auth/logout
│
├── /users                 # User management & profiles (admin)
│   ├── /users                  # All users (admin)
│   ├── /users/teachers         # Teacher CRUD
│   ├── /users/students         # Student CRUD
│   ├── /users/parents          # Parent CRUD
│   └── /users/school-leaders   # Principal + Admin CRUD
│
├── /curriculum            # Curriculum engine
│   ├── /classes                # Class CRUD + roster
│   ├── /subjects               # Subject CRUD
│   ├── /chapters               # Chapter CRUD per class+subject
│   ├── /topics                 # Topic CRUD per chapter
│   └── /learning-objectives    # Learning Objective CRUD per topic
│
├── /attendance            # Daily attendance
│   ├── POST /attendance/mark      # Mark single
│   ├── POST /attendance/batch     # Batch mark
│   ├── GET  /attendance/today     # Today's view (role-aware)
│   └── GET  /attendance/trends    # Attendance analytics
│
├── /assignments           # Homework, worksheets, projects
│   ├── /assignments              # CRUD
│   ├── /assignments/{id}/submit  # Student submit
│   ├── /assignments/{id}/grade   # Teacher grade
│   └── /assignments/generate     # AI generate
│
├── /assessments           # Tests, exams, quizzes
│   ├── /assessments              # CRUD
│   ├── /assessments/{id}/attempt # Student attempt
│   ├── /assessments/{id}/grade   # Auto-grade + teacher review
│   └── /assessments/generate     # AI generate
│
├── /analytics             # Dashboards, reports, progress
│   ├── /dashboard/{role}         # Role-based dashboard
│   ├── /progress/{student}       # Per-student mastery progress
│   ├── /risk                     # At-risk students
│   └── /reports                  # Generated reports
│
├── /communications        # Notifications, announcements, parent comms
│   ├── /notifications            # In-app notifications
│   ├── /announcements            # School announcements
│   └── /parent-reports           # AI-generated parent summaries
│
└── /ai                    # AI capabilities
    ├── POST /ai/generate           # Generic generation endpoint
    ├── POST /ai/grade              # Auto-grading
    ├── POST /ai/report             # Report comment generation
    └── POST /ai/insights           # AI insights on data
```

**~40 endpoints. ~10 route files. ~50% reduction from V1.**

### Endpoint Reduction Rationale

| V1 Endpoints Removed | Reason |
|---------------------|--------|
| Full CRUD for `periods` | Periods are seed data, not CRUD-managed |
| Full CRUD for `academic-years` | Years are config, not REST resources |
| Full CRUD for `academic-terms` | Terms are date ranges, managed by school config |
| Full CRUD for `timetable` entries | Timetable is complex frontend UI, not CRUD |
| Separate `student-parents` CRUD | Linking is a single POST, not a full CRUD |
| Separate `teacher-assignments` CRUD | Merge into `/curriculum/classes/{id}/teachers` |
| Duplicate `reports` module | Generate reports on-demand via analytics |
| Duplicate `dashboard` per role | Unified `/analytics/dashboard/{role}` |

### API Design Rules

1. **No more than 10 route files.** Group by product domain, not database table.
2. **Every endpoint must have a documented permission check.** No default "any authenticated user."
3. **All responses follow `{data, meta, error}` format.** Consistent error codes.
4. **Pagination is mandatory for list endpoints.** Default 50, max 200.
5. **List endpoints support `?fields=id,name` for sparse field sets.**
6. **Write endpoints return the created/updated resource.** No 204 No Content.

---

## 7. Permission Matrix

### Role Definitions

| Role | Scope | Reports To | Can Manage |
|------|-------|------------|------------|
| `super_admin` | Global | None | All schools, all users |
| `school_admin` | School-wide | super_admin | Teachers, students, classes, subjects |
| `school_leader` | School-wide | school_admin | Teachers, view all student data |
| `teacher` | Own classes + subjects | school_leader | Own assignments, own assessments |
| `student` | Own data | teacher | Own submissions, own attempts |
| `parent` | Own children's data | teacher | View children's progress |

### Permission Matrix

| Endpoint Group | super_admin | school_admin | school_leader | teacher | student | parent |
|----------------|:-----------:|:------------:|:-------------:|:-------:|:-------:|:------:|
| **Health** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Auth** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Users** | | | | | | |
| · List all | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| · Create teacher | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| · Create student | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| · Create parent | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| · Self profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Curriculum** | | | | | | |
| · List classes | ✅ | ✅ | ✅ | ✅ | ✅ (own) | ✅ (child's) |
| · Manage classes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| · Manage chapters | ✅ | ✅ | ✅ | ✅ (teaches) | ❌ | ❌ |
| **Attendance** | | | | | | |
| · Mark | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · View class | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| · View self | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ (child) |
| · Trends | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| **Assignments** | | | | | | |
| · Create | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · Publish | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · Submit | ❌ | ❌ | ❌ | ❌ | ✅ (own) | ❌ |
| · Grade | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · View | ✅ | ✅ | ✅ | ✅ (own) | ✅ (published) | ✅ (child) |
| **Assessments** | | | | | | |
| · Create | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · Attempt | ❌ | ❌ | ❌ | ❌ | ✅ (own) | ❌ |
| · Auto-grade | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| · View results | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own) | ✅ (child) |
| **Analytics** | | | | | | |
| · Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (child) |
| · Progress | ✅ | ✅ | ✅ | ✅ (own class) | ✅ (own) | ✅ (child) |
| · Risk flags | ✅ | ✅ | ✅ | ✅ (own class) | ❌ | ❌ |
| **AI** | | | | | | |
| · Generate | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| · Auto-grade | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| · Parent reports | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| · Insights | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Communications** | | | | | | |
| · Send notification | ✅ | ✅ | ✅ | ✅ (own class) | ❌ | ❌ |
| · View own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| · Announcements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Permission Enforcement Strategy

1. **Decorators on route handlers** — `@requires_role("teacher")` or `@requires_any_role("teacher", "school_admin")`
2. **Data-scoping decorators** — `@scoped_to_school`, `@scoped_to_own_class`
3. **Ownership checks in service layer** — `assert_owns_assignment(teacher_id, assignment_id)`
4. **Row-level security in database** — Supabase RLS as defense-in-depth
5. **Never use inline strings** — All role names are `Role` enum values

---

## 8. Attendance Flow

### Teacher Workflow

```
Login
│
├── Dashboard shows:
│   ├── Today's classes (from timetable)
│   ├── Number of students without attendance yet
│   └── Quick-action: "Mark attendance" button per class
│
├── Click "Mark attendance"
│   ├── GET /attendance/today → list of students for this class
│   ├── UI shows student roster with default "Present"
│   ├── Teacher taps absent/late/half-day for relevant students
│   └── POST /attendance/batch → saves all records
│
├── After marking:
│   ├── Attendance metric updates on dashboard
│   ├── Absent students trigger:
│   │   ├── In-app notification to parents
│   │   └── (Future: WhatsApp/SMS)
│   └── Student marked late → notification only if repeated
│
└── Weekly summary:
    ├── Teacher can view attendance trends
    └── GET /attendance/trends?class_id=X&range=week
```

### Backend Architecture

```
POST /attendance/batch
├── Authenticate (JWT)
├── Authorize (teacher, teaches this class)
├── Validate (same school, valid academic period)
├── deduplicate (no existing record for student + date)
├── INSERT batch (single transaction)
├── IF any absent:
│   ├── QUEUE absence notification (async, not blocking)
│   └── RETURN success
└── RETURN 201 + attendance records
```

### API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/attendance/mark` | Teacher | Single student mark |
| `POST` | `/attendance/batch` | Teacher | Full class batch mark |
| `GET` | `/attendance/today` | Teacher/Student | Today's records |
| `GET` | `/attendance/trends` | Teacher/Leader | Weekly/monthly trends |
| `GET` | `/attendance/{student_id}` | Parent | Child's attendance |

### Database Model (From V2 Review)

```
attendance:
  id, school_id, student_id, class_id,
  date, status (present|absent|late|half_day),
  marked_by, remarks, created_at, updated_at
```

**Key constraint**: `UNIQUE(student_id, date)` — one record per student per day.

### Performance Target

| Operation | Target |
|-----------|--------|
| Batch mark 50 students | <200ms |
| Load today's class attendance | <100ms |
| Load monthly trends for a class | <500ms |
| Load individual student history | <100ms |

---

## 9. Assignment Flow

### Teacher Flow

```
Login → Dashboard
│
├── Click "Create Assignment"
│   ├── Select: Class, Subject
│   ├── Select: Chapter, Topic (from curriculum engine)
│   ├── Choose: Type (Homework | Worksheet | Project | Revision)
│   ├── Option A: AI Generate (recommended)
│   │   ├── POST /ai/generate with chapter+topic+type
│   │   ├── AI returns questions with answers
│   │   ├── Teacher reviews and edits
│   │   └── Saves to assignment as draft
│   ├── Option B: Manual Create
│   │   ├── Add questions one by one
│   │   └── Set question type (MCQ, short_answer, long_answer, true_false)
│   ├── Set: due date, max score, instructions
│   └── Save as draft or Publish
│
├── After publishing:
│   ├── Students get in-app notification
│   ├── Assignment appears on student dashboard
│   └── Teacher dashboard shows pending submissions count
│
├── Review submissions:
│   ├── GET /assignments/{id}/submissions → list of all submissions
│   ├── For MCQ/TF: AI auto-graded ✓
│   ├── For written: Teacher reviews
│   └── POST /assignments/{id}/grade → save scores
│
└── After grading:
    ├── Submission count updates
    ├── Learning objective mastery updates
    └── Student sees score + feedback
```

### Backend Architecture

```
POST /assignments (create)
├── Authenticate + Authorize (teacher)
├── Validate: teacher teaches this class+subject
├── Validate: chapter exists for this class+subject
├── Create assignment record
├── If questions provided → create questions
├── If AI-generated → save to ai_generations
└── Return assignment with questions

POST /assignments/{id}/submit
├── Authenticate + Authorize (student in this class)
├── Validate: assignment is published
├── Validate: before due date
├── Validate: not already submitted (or allow re-submit)
├── Create submission
├── For auto-gradeable questions (MCQ, TF):
│   ├── Grade immediately
│   ├── Update submission score
│   └── Update learning objective progress
└── Return submission

POST /assignments/{id}/grade
├── Authenticate + Authorize (teacher who created it)
├── Validate: submission exists
├── For each written answer:
│   ├── Teacher provides score
│   ├── Option: AI suggests score
│   └── Save score + feedback
├── Mark submission as graded
├── Update learning objective progress
└── Return updated submission
```

### Unified Assignment Model

```python
# Single model replaces V1's homework.py, homework_question.py,
# homework_submission.py, homework_answer.py, test.py, test_question.py,
# test_attempt.py, test_answer.py

assignment_type: enum(homework, worksheet, project, revision, quiz)

assignments:
  id, school_id, class_id, subject_id, chapter_id, topic_id,
  teacher_id, academic_term_id,
  type, title, instructions, max_score, passing_percentage,
  due_date, is_published, published_at,
  ai_generated (bool), generation_id,
  created_at, updated_at, deleted_at

questions:
  id, assignment_id, school_id, type(mcq|tf|short|long),
  question_text, options (jsonb for MCQ), correct_answer,
  marks, order, difficulty(easy|medium|hard),
  created_at, updated_at

submissions:
  id, assignment_id, student_id, school_id,
  status(draft|submitted|graded|returned),
  submitted_at, graded_at, graded_by,
  total_score, max_score, percentage,
  created_at, updated_at

answers:
  id, submission_id, question_id,
  answer_text, answer_choice (for MCQ),
  score, feedback, is_auto_graded,
  created_at, updated_at
```

### Key Insight

**Assignments and Assessments share the same question/submission/answer data model.** The only difference is:
- **Assignments** → have a due date, re-submission allowed, graded by teacher
- **Assessments** → have a scheduled time, single attempt, timed, auto-graded first

Having separate models for homework, tests, quizzes, worksheets, projects, and revision is a V1 mistake that doubles code for no gain.

---

## 10. Assessment Flow

### Teacher Flow

```
Login → Dashboard
│
├── Click "Create Assessment"
│   ├── Select: Class, Subject
│   ├── Select: Chapter, Topic
│   ├── Choose: Type (Test | Exam | Quiz | Practice)
│   ├── Set: duration, total marks, passing %, difficulty
│   ├── Option A: AI Generate
│   │   ├── POST /ai/generate-assessment
│   │   ├── AI returns question paper
│   │   └── Teacher reviews
│   ├── Option B: Manual + AI mix
│   │   ├── Add questions manually
│   │   └── AI suggests distractors for MCQs
│   ├── Create answer key
│   └── Save as draft or Publish
│
├── After publishing:
│   ├── Students see scheduled assessment
│   ├── Timer activates at scheduled time
│   └── Teacher can monitor attempt progress
│
├── Auto-grading (immediate):
│   ├── MCQ+TF: graded instantly on submission
│   ├── Score calculated
│   ├── Learning objective progress updated
│   └── Teacher notified of auto-graded results
│
├── Teacher review:
│   ├── Review auto-graded results (override if needed)
│   ├── Grade written answers manually
│   └── Publish final scores
│
└── After grading:
    ├── Results viewable by students
    ├── Parent notified (if below passing)
    ├── Progress/analytics updated
    └── Risk flag triggered (if consistently failing)
```

### Backend Architecture

```
POST /assessments/generate
├── Authenticate + Authorize (teacher)
├── Validate: chapter+topic exist
├── Call AIService.generate_assessment()
├── Return: questions + answer key + metadata
└── Teacher can save as draft

POST /assessments/{id}/attempt
├── Authenticate + Authorize (student enrolled)
├── Validate: assessment is published
├── Validate: within scheduled window
├── Validate: no existing attempt
├── Create attempt + generate answer rows
├── For each submitted answer:
│   ├── If auto-gradeable → grade immediately
│   ├── If written → mark for teacher review
│   └── Save answer
├── Calculate preliminary score
├── Update learning objective progress
├── Notify teacher on completion
└── Return results

POST /assessments/{id}/grade-written
├── Authenticate + Authorize (teacher)
├── For each ungraded written answer:
│   ├── Teacher provides score
│   └── AI suggests score
├── Recalculate final score
├── Publish results
└── Return assessment results
```

### Unified Assessment Model

Same as assignment model (see above). The `type` discriminator handles the behavioral differences.

### Auto-Grading Rules

| Question Type | Gradeable | How |
|---------------|-----------|-----|
| MCQ (single correct) | ✅ Instant | Match to answer key |
| True/False | ✅ Instant | Match to answer key |
| MCQ (multiple correct) | ✅ Instant | Partial credit for partial matches |
| Short answer | ✅ AI-suggested | Teacher reviews AI suggestion |
| Long answer | ❌ Teacher only | AI provides rubric, teacher scores |

---

## 11. AI Architecture

### V1 AI Architecture (Inadequate)

```
V1 AI:
├── /api/v1/ai.py           # 3 endpoints (generate-homework, generate-test, generate-report-comment)
├── /domain/ai/             # AIService + PromptTemplates
├── /infrastructure/ai/     # OpenAIProvider (only OpenAI, no fallback)
├── /infrastructure/messaging/ # WhatsApp stub
└── No caching, no rate limiting, no monitoring
```

**Problems**:
- No context layer → AI doesn't know about the school's curriculum
- No safety layer → No content filtering, no prompt injection protection
- No caching → Same request generates different results every time
- No monitoring → Can't track token usage, cost, or failure rates
- No fallback → If OpenAI is down, AI features are down
- No abuse prevention → Students could call AI endpoints if they bypass frontend

### V2 AI Architecture — 4 Layers

```
┌─────────────────────────────────────────────────┐
│                  AI ARCHITECTURE                  │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │ Teacher AI  │  │  Grading AI │  │Insights AI│ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬────┘ │
│         │                │                │       │
│  ┌──────┴────────────────┴────────────────┴────┐ │
│  │              AI SERVICE LAYER                │ │
│  │  (Orchestration, routing, fallback, retry)  │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────┴──────────────────────┐ │
│  │              CONTEXT LAYER                   │ │
│  │  School, Class, Subject, Chapter, Topic,    │ │
│  │  Curriculum State, Student History           │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────┴──────────────────────┐ │
│  │              PROMPT LAYER                    │ │
│  │  Template composition, Curriculum injection, │ │
│  │  Few-shot examples, Safety guardrails        │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────┴──────────────────────┐ │
│  │              SAFETY LAYER                    │ │
│  │  Content filtering, Prompt injection check, │ │
│  │  Output validation, Rate limiting            │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────┴──────────────────────┐ │
│  │           INFRASTRUCTURE LAYER               │ │
│  │  OpenAI (primary), Anthropic (fallback),    │ │
│  │  Token tracking, Cost monitoring             │ │
│  └──────────────────────┬──────────────────────┘ │
│                         │                         │
│  ┌──────────────────────┴──────────────────────┐ │
│  │              CACHING LAYER                   │ │
│  │  Response cache (hash-based, TTL-based),    │ │
│  │  Curriculum context cache                    │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### AI Capabilities Map

| Capability | AI Type | Caching | Storage | Latency Target |
|------------|---------|---------|---------|----------------|
| Generate homework/worksheet | TeacherAI | ❌ | Save questions to DB | <5s |
| Generate test paper | TeacherAI | ❌ | Save questions to DB | <8s |
| Generate lesson plan | TeacherAI | ✅ 24h | Cache only (regenerate) | <5s |
| Generate rubric | TeacherAI | ✅ 24h | Cache only | <3s |
| Auto-grade MCQ/TF | GradingAI | ❌ | Store score immediately | <500ms |
| Suggest score for short answer | GradingAI | ❌ | Store suggestion + teacher review | <3s |
| Generate report comment | InsightsAI | ❌ | Store as draft | <3s |
| Generate parent weekly summary | InsightsAI | ✅ 7d | Store in report | <5s |
| Identify at-risk students | InsightsAI | ✅ 1d | Store risk flags | <10s |
| Student doubt assistant | StudentAI | ✅ session | No storage | <3s |
| Curriculum insights (principal) | InsightsAI | ✅ 1d | No storage | <10s |

### What Gets Stored

```
ai_generations:
  id, school_id, teacher_id, type (homework|test|lesson|rubric|report),
  input_context (jsonb: class, subject, chapter, topic, parameters),
  generated_content (jsonb: questions, answers, metadata),
  model_used, tokens_used, latency_ms,
  was_edited (bool: teacher modified before publishing),
  created_at
```

### What NEVER Gets Stored

1. **Raw LLM responses** — Only validated, parsed content is stored
2. **Student PII in prompts** — Prompts are stripped of student PII before being sent
3. **Failed generation responses** — Only successful generations are logged
4. **Chat history with student AI** — Session-only, deleted after 24h
5. **Teacher's edits of AI content** — Only the final version is stored
6. **API keys or tokens** — Config-only, never in DB

### What Gets Generated On-Demand

1. **Lesson plans** — Always fresh. Cached for 24h for repeat views.
2. **Rubrics** — Cached for 24h. Re-generated for each unique assessment.
3. **Parent weekly summaries** — Generated weekly, cached for 7 days.
4. **Risk flags** — Generated daily, cached for 24h.
5. **Curriculum insights** — Generated on dashboard load, cached 1h.

### Caching Strategy

```
Cache Tiers:
├── SHORT (5 min): Dashboard widgets, attendance trends
├── MEDIUM (1 hr): Curriculum context, teacher class list
├── LONG (24 hr): Lesson plans, rubrics, parent summaries
└── SESSION (24 hr): Student AI chat context
```

### AI Provider Architecture

```python
# V1: Single provider, no fallback
class OpenAIProvider:  # If OpenAI fails, AI is down

# V2: Multi-provider with fallback
class AIProvider:
    """Primary: OpenAI. Fallback: Anthropic. Configurable."""
    
    def __init__(self):
        self.primary = OpenAIProvider()
        self.fallback = AnthropicProvider()
        self.config = load_ai_config()
    
    async def generate(self, prompt, context):
        try:
            return await self.primary.generate(prompt, context)
        except ProviderError:
            logger.warning("OpenAI failed, falling back to Anthropic")
            return await self.fallback.generate(prompt, context)
```

### AI Abuse Prevention

1. **Rate limiting per teacher**: 10 generations/minute, 100/day
2. **Rate limiting per student (StudentAI)**: 20 queries/day
3. **Content filtering**: Profanity and inappropriate content filtering on outputs
4. **Prompt injection detection**: Strip or reject prompt injection attempts
5. **Cost tracking**: Log tokens per teacher per day, alert on anomalies
6. **Approval queue**: New AI features require school_admin approval
7. **Opt-out**: Schools can disable AI features per-role

---

## 12. Analytics Architecture

### Principal Dashboard

```
Principal logs in:
├── GET /analytics/dashboard/leader
│
├── Attendance Trends (last 30 days)
│   ├── School-wide: 85% present (↑2% vs last week)
│   ├── Per class: 8A: 92%, 8B: 78% (⚠), 8C: 88%
│   └── Alert: Class 8B attendance dropped 10% this week
│
├── Performance Trends
│   ├── Overall pass rate: 72% (↓3% vs last month)
│   ├── Subject-wise: Math 81%, Science 74%, English 68%
│   └── Alert: English scores declining 3 consecutive weeks
│
├── Curriculum Completion
│   ├── School-wide: 62% of curriculum delivered (target: 75%)
│   ├── Per teacher: Mrs. Sharma 81%, Mr. Kumar 45% (⚠)
│   └── Alert: 3 teachers behind schedule
│
├── Teacher Activity
│   ├── Assignments created this week: 45
│   ├── Assessments scheduled: 12
│   ├── Average time to grade: 2.3 days
│   └── Teachers with low activity (top 5)
│
└── Student Risk Flags
    ├── 15 students at-risk (attendance <80% + performance <40%)
    ├── 8 students flagged for attendance only
    ├── 5 students flagged for performance only
    └── 2 students flagged for both (⚠ high risk)
```

### Analytics Backend Architecture

```
┌────────────────────────────────────────────────────┐
│                  ANALYTICS ENGINE                    │
├────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           REAL-TIME AGGREGATES                 │  │
│  │  (Dashboard queries, computed on demand)      │  │
│  │                                                │  │
│  │  - Attendance: COUNT + GROUP BY date/class    │  │
│  │  - Performance: AVG of assessment scores      │  │
│  │  - Activity: COUNT of assignments/assessments │  │
│  │                                                │  │
│  │  Cache: Redis, TTL: 5 min                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │            BATCH COMPUTATIONS                  │  │
│  │  (Celery daily job, updated every 24h)        │  │
│  │                                                │  │
│  │  - Curriculum completion % per teacher         │  │
│  │  - Student progress against LOs                │  │
│  │  - Risk flag computation (attendance + perf)   │  │
│  │  - Weekly parent summaries                     │  │
│  │                                                │  │
│  │  Storage: progress table + student_risk_flags  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │            MATERIALIZED VIEWS                  │  │
│  │  (PostgreSQL, refreshed on schedule)          │  │
│  │                                                │  │
│  │  - daily_attendance_summary                    │  │
│  │  - weekly_performance_summary                  │  │
│  │  - teacher_activity_summary                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Progress Tracking

Each Learning Objective has a progress state per student:

```python
progress:
  id, school_id, student_id, learning_objective_id,
  mastery_level (0.0 to 1.0),  # 0=not_started, 0.5=in_progress, 1.0=mastered
  last_assessment_score, last_assessment_date,
  attempts_count, correct_count,
  trend (improving|declining|stable),
  updated_at
  
  # Computed at assessment grade time
  # Recalculated daily by batch job
```

### Risk Detection

```python
student_risk_flags:
  id, school_id, student_id,
  risk_level (low|medium|high|critical),
  risk_reasons (jsonb): [
    {"type": "attendance", "value": 72, "threshold": 80, "trend": "declining"},
    {"type": "performance", "value": 38, "threshold": 40, "trend": "declining"},
    {"type": "homework", "value": 45, "threshold": 60, "trend": "stable"}
  ],
  flagged_at, reviewed_at, reviewed_by,
  resolved_at, resolution_notes,
  created_at
```

### Analytics API Endpoints

| Method | Path | Response | Cache |
|--------|------|----------|-------|
| `GET` | `/analytics/dashboard/{role}` | Role-specific dashboard data | 5 min |
| `GET` | `/analytics/progress/{student_id}` | Per-LO mastery breakdown | 1 min |
| `GET` | `/analytics/progress/class/{class_id}` | Class-level progress | 5 min |
| `GET` | `/analytics/risk` | At-risk students (principal) | 1 hr |
| `GET` | `/analytics/trends/attendance` | Attendance trend data | 5 min |
| `GET` | `/analytics/trends/performance` | Performance trend data | 5 min |

---

## 13. Scalability Analysis

### 1 School (10 teachers, 700 students, 700 parents)

| Area | Assessment | Bottleneck |
|------|------------|------------|
| API throughput | ✅ No issues. ~100 concurrent users max. | None |
| Database | ✅ 13 tables, <1M rows/year. PG handles easily | None |
| AI API calls | ✅ ~50/day from teachers. Well within limits | None |
| Caching | ✅ Not critical but reduces cost | None |
| Background jobs | ✅ Celery with Redis handles daily jobs | None |

**Verdict**: 1 school runs on a $20/month VPS with PostgreSQL.

### 100 Schools (1,000 teachers, 70,000 students, 70,000 parents)

| Area | Assessment | Bottleneck |
|------|------------|------------|
| API throughput | ⚠️ 10,000 concurrent users peak. Need horizontal scaling | FastAPI can scale but needs load balancer |
| Database | ⚠️ ~7M attendance rows/year, ~35M assignment rows. PG with proper indexes handles it | Index maintenance |
| AI API calls | ✅ ~5,000/day. API-based, no server load | Cost ($200-500/month) |
| Caching | ✅ **Required**. Redis cache reduces DB load by 60%+ | Redis instance size |
| Background jobs | ⚠️ 100 daily risk detection jobs, 100 weekly summary jobs | Celery worker pool needs 2-4 workers |
| Storage | ✅ Reports, uploads: ~50GB/year | S3/MinIO |

**Verdict**: 100 schools needs:
- 2-3 API server instances (behind nginx/ALB)
- 1 PostgreSQL instance (8 vCPU, 32GB RAM)
- 1 Redis instance (4GB)
- 2 Celery workers
- 1 MinIO/S3 bucket

### 1,000 Schools (10,000 teachers, 700,000 students, 700,000 parents)

| Area | Assessment | Bottleneck |
|------|------------|------------|
| API throughput | ❌ 100,000 concurrent users. Needs auto-scaling group | FastAPI is stateless, scaling is linear |
| Database | ❌ **Primary bottleneck**. 70M attendance rows/year. PG needs partitioning | Partition `attendance` by month. Shard by school_id |
| AI API calls | ⚠️ ~50,000/day. Significant cost | $2,000-5,000/month in API costs |
| Caching | ❌ **Critical**. Without it, DB crashes at peak | Redis cluster (4 shards) |
| Background jobs | ❌ 1,000 daily risk jobs, 1,000 weekly summary jobs | Celery needs 10+ workers |
| Storage | ⚠️ ~500GB/year reports+uploads | S3 with lifecycle policies |

**Verdict**: 1,000 schools needs:
- Auto-scaling API group (10-20 instances)
- PostgreSQL cluster (read replicas + partitioning)
- Redis cluster (4-8 shards)
- 10+ Celery workers
- CDN for static files
- Estimated infra cost: $3,000-8,000/month

### Bottleneck Resolution

| Bottleneck | Solution for 1,000 schools |
|------------|---------------------------|
| Attendance queries | Monthly partitioning, summary materialized view |
| Dashboard load | Redis cache with 5-min TTL, SM invalidation on write |
| AI cost | Caching for lesson plans, parent summaries. Bulk API calls. |
| Homework/assessment queries | Index on (class_id, type, due_date), point queries |
| User lookups | Index on (school_id, role, email) |
| Risk computation | Incremental computation, not full recompute |
| File storage | S3 with CDN, 30-day retention for temp files |

---

## 14. Security Architecture

### Authentication Flow

```
V1: Supabase JWT verification via JWKS (good — keep this pattern)
V2: Add refresh token endpoint, logout, and httpOnly cookie storage

Token Architecture:
├── access_token (JWT, 1h expiry)
│   ├── Issued by Supabase Auth on login
│   ├── Verified by backend via JWKS endpoint
│   ├── Contains: sub (user_id), email, aud, exp, iat
│   └── Stored: httpOnly cookie (secure, sameSite=strict)
│
├── refresh_token (opaque string, 30d expiry)
│   ├── Issued by Supabase Auth alongside access_token
│   ├── Not verified by backend — sent to Supabase on refresh
│   ├── Stored: httpOnly cookie (not accessible to JS)
│   └── Used: POST /auth/refresh → Supabase returns new token pair

Login Flow:
1. POST /auth/login {email, password}
2. Backend forwards to Supabase Auth
3. Supabase returns {access_token, refresh_token, user}
4. Backend sets httpOnly cookies:
   - Set-Cookie: athon_token=<access_token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
   - Set-Cookie: athon_refresh=<refresh_token>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=2592000
5. Returns {user} (no token in response body)

Request Flow:
1. Frontend sends request with Cookie header (browser handles this)
2. Backend reads athon_token cookie
3. Backend verifies JWT via JWKS
4. If expired, backend reads athon_refresh cookie, calls POST /auth/refresh on Supabase
5. On success: updates cookies, retries original request
6. On refresh failure: clears cookies, returns 401

Logout Flow:
1. POST /auth/logout
2. Backend clears athon_token and athon_refresh cookies
3. Calls Supabase Auth to revoke refresh token (optional, depends on plan)
4. Returns 200

Why httpOnly cookies over localStorage:
1. XSS cannot steal the token (JS cannot access httpOnly cookies)
2. CSRF protection via SameSite=Strict
3. Automatic inclusion in requests (no frontend token management)
4. Automatic expiry and refresh (backend handles it)

Note: This requires the frontend and backend to share the same domain
or use a BFF (Backend-for-Frontend) proxy pattern.
```

### Session Context Middleware

```python
# On every request, after auth:
request.state.user_id      # UUID from JWT sub
request.state.school_id    # From user profile lookup (cached)
request.state.role         # From user profile lookup (cached)
request.state.user         # Full User ORM instance (if needed)

# This replaces V1's per-endpoint get_current_user() pattern.
# The middleware caches user profile for 5 minutes to avoid
# DB lookup on every request.
```

### RBAC Enforcement

```
Layer 1: Route decorator (FastAPI)
  @requires_role("teacher")
  @requires_school_access
  
  - Rejects unauthenticated requests
  - Rejects wrong-role requests
  - Rejects cross-school requests (school isolation)

Layer 2: Service assertion (business logic)
  await self.assert_teacher_teaches_class(teacher_id, class_id)
  
  - Ensures data-level access
  - Checks class ownership, subject assignment

Layer 3: Database RLS (defense-in-depth)
  CREATE POLICY student_access ON assignments
    FOR SELECT USING (school_id = app.current_school_id());
  
  - Even if an API bug bypasses layers 1+2, RLS prevents data leak
```

### School Isolation

```
Every table has school_id NOT NULL
Every query filters by school_id
Every INSERT includes school_id
JWT includes school_id scope
Middleware sets current_school_id in app context
RLS enforces school isolation at database level
```

### Rate Limiting

```
Per Endpoint Group:
├── /auth/*: 5 requests/minute (prevent brute force)
├── /attendance/batch: 30 requests/minute (teacher)
├── /assignments/*: 60 requests/minute (teacher)
├── /assessments/attempt: 10 requests/10 minutes (student)
├── /ai/*: 10 requests/minute (teacher)
├── /analytics/*: 30 requests/minute
└── All others: 120 requests/minute

Implementation: Redis-based sliding window counter
```

### AI Abuse Prevention

```
1. AI endpoints are teacher-only (require_role("teacher"))
2. Rate limited: 10 generations/minute, 100/day
3. Input validation: max 2000 chars per prompt
4. Output filtering: profanity, PII detection
5. Token budget: max 4000 tokens per request
6. Cost alert: notify admin if daily AI cost exceeds $X
7. Audit: every generation logged with teacher_id, school_id
```

### Additional Security Measures

| Measure | V1 | V2 |
|---------|----|----|
| HTTPS | Assumed | Enforced at load balancer |
| CORS | Configured | Narrowed to specific origins |
| Input validation | Pydantic | **Enhanced**: whitelist patterns |
| SQL injection | SQLAlchemy (safe) | Same, stay safe |
| XSS | Not addressed | Output encoding, CSP headers |
| CSRF | Not addressed | Double-submit cookie pattern |
| File upload | Not implemented | File type validation, size limits, virus scan (see design below) |

### File Upload Architecture (Brief)

```python
# /api/v2/uploads (P1 feature, Week 3)
#
# Flow:
# 1. Client uploads file via POST /uploads (multipart/form-data)
# 2. Backend validates:
#    - File type (whitelist: pdf, docx, jpg, png, mp4, max 20MB)
#    - Virus scan (ClamAV integration)
#    - School storage quota
# 3. Backend stores to S3/MinIO: /{school_id}/{entity_type}/{id}/{filename}
# 4. Returns file UUID + signed URL (expires in 1 hour)
# 5. Client stores file UUID in submission/assignment/student record
#
# Models:
# file_uploads:
#   id, school_id, uploaded_by, original_filename, storage_path,
#   mime_type, size_bytes, entity_type (submission|assignment|student_photo),
#   entity_id, created_at
```
| Audit log | Not implemented | All mutations logged with user_id, timestamp |
| Secrets management | .env file | Environment variables only |
| Dependency audit | Not checked | Regular `pip-audit` in CI |

---

## 15. Performance Targets

### API Response Times

| Endpoint | Target | Strategy |
|----------|--------|----------|
| `GET /auth/me` | <50ms | JWT decode + cache user profile |
| `GET /attendance/today` | <200ms | Cached query, indexed by date+class |
| `POST /attendance/batch` | <500ms | Single transaction, batch insert |
| `GET /assignments` | <300ms | Indexed by class_id+due_date |
| `POST /assignments` | <200ms | Single insert |
| `POST /assessments/attempt` | <3s (auto-grade) | Grade in-line, no background job |
| `GET /analytics/dashboard` | <2s | Redis cache |
| `POST /ai/generate` | <8s | Async streaming response |
| `GET /curriculum` | <200ms | Cached curriculum tree |

### Page Load Targets

| Page | Target | Composition |
|------|--------|-------------|
| Teacher Dashboard | <2s | 1 API call (cached) |
| Class Attendance View | <2s | 1 API call (indexed) |
| Assignment Create | <1s | Static form + AI async |
| Assessment Attempt | <1s load | Static questions, timer local |
| Student Dashboard | <2s | 1 API call (cached) |
| Parent Dashboard | <2s | 1 API call (cached) |
| Principal Analytics | <3s | 3-4 parallel API calls |

### Database Query Performance

| Query | Target | Index Strategy |
|-------|--------|---------------|
| Attendance by class+date | <10ms | `(school_id, class_id, date)` |
| Attendance by student+term | <10ms | `(student_id, academic_term_id)` |
| Assignments by class | <10ms | `(class_id, due_date, deleted_at)` |
| Submissions by assignment | <10ms | `(assignment_id, student_id)` |
| Student progress by LO | <20ms | `(student_id, learning_objective_id)` |
| Risk flags by school | <50ms | `(school_id, risk_level, flagged_at)` |

### Caching Invalidation Strategy

```
On Write → Invalidate Related Cache Keys:

POST /attendance/batch:
  → Invalidate: dashboard:teacher:{id}, dashboard:leader:{school_id}
  → Invalidate: attendance:class:{class_id}:today
  → Invalidate: attendance:trends:{class_id}

POST /assignments:
  → Invalidate: dashboard:teacher:{id}
  → Invalidate: dashboard:student:{class_id}
  → Invalidate: curriculum:teacher:{id}:assignments

POST /assessments/attempt:
  → Invalidate: dashboard:student:{id}
  → Invalidate: progress:student:{id}
  → Invalidate: risk:{school_id}

POST /ai/generate (teacher edits and publishes):
  → Invalidate: nothing (content is new)
```

---

## 16. Risks & Missing Components

### Critical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI cost overruns without guardrails | 🔴 High | Per-teacher daily limits, cost alerts, usage dashboard |
| No offline capability for attendance | 🔴 High | PWA + IndexedDB sync strategy (V3, but plan now) |
| Parent adoption low without WhatsApp | 🔴 High | Build WhatsApp integration in V2, not V3 |
| Student AI assistant costs more than it helps | 🟡 Medium | Strict token budgets, only for practice tests |
| Risk detection accuracy low with sparse data | 🟡 Medium | Conservative thresholds initially, tune with real data |
| School admin fatigue from too many metrics | 🟡 Medium | Start with 5 metrics, expand on request |
| Principal ignores analytics without mobile | 🟡 Medium | PWA-first. No native app in V2. |

### Missing Components (V1→V2)

| Component | Status | Priority |
|-----------|--------|----------|
| Rate limiting | ❌ Missing | P0 (security) |
| File upload | ❌ Missing | P1 (homework attachments) |
| Audit logging | ❌ Missing | P1 (compliance) |
| Error taxonomy | ❌ Missing | P1 (frontend integration) |
| Health check for AI | ❌ Missing | P1 (teacher experience) |
| Token refresh endpoint | ❌ Missing | P1 (auth UX) |
| Logout/revocation | ❌ Missing | P2 (security) |
| Offline sync | ❌ Missing | P3 (V3) |
| WebSocket for live updates | ❌ Missing | P2 (real-time grading) |
| API versioning | ✅ Survives | P0 (keep /v1 prefix this time) |
| Request ID tracing | ❌ Missing | P1 (debugging) |
| Rate limiting headers | ❌ Missing | P1 (API consumer) |
| Pagination standardization | ✅ Survives | P0 (keep Page model) |
| Celery implementation | ⚠️ Stubs only | P1 (background jobs) |

---

## 17. Build Order

### Phase 1: Foundation (Week 1)

```
Backend Core:
├── FastAPI bootstrap (from V1, simplified)
├── Database connection (from V1)
├── Auth service (from V1 + refresh + logout)
├── RBAC decorators (new)
├── Redis cache client (new)
├── Rate limiting middleware (new)
├── Error taxonomy (new)
├── Health checks (from V1 + AI)
└── BaseRepository (from V1)

Database:
├── Identity: schools, users, teachers, students, parents
├── Curriculum: classes, subjects, chapters, topics, learning_objectives
├── Attendance: attendance
├── Assignments: assignments, questions, submissions, answers (unified)
├── Analytics: progress, student_risk_flags
└── Communications: notifications, announcements

AI Infrastructure:
├── OpenAI provider (from V1)
├── Anthropic fallback provider (new)
├── Prompt templates (from V1, refactored)
├── Content safety layer (new)
├── Rate limiting per teacher/student (new)
└── Token tracking (new)
```

### Phase 2: Core Workflows (Week 2)

```
Identity Module:
├── POST /auth/login, /auth/refresh, /auth/logout
├── GET /auth/me
├── CRUD /users/teachers, /users/students
└── POST /users/{id}/link-parent

Curriculum Module:
├── CRUD /classes
├── CRUD /subjects
├── CRUD /chapters (per class+subject)
├── CRUD /topics (per chapter)
└── CRUD /learning-objectives (per topic)

Attendance Module:
├── POST /attendance/batch
├── GET /attendance/today
└── GET /attendance/trends
```

### Phase 3: Assignment + Assessment + AI (Week 3)

```
Assignment Module:
├── POST /assignments (create + AI generate)
├── GET /assignments (list, filter by class/type)
├── POST /assignments/{id}/submit
├── POST /assignments/{id}/grade
└── GET /assignments/{id}/submissions

Assessment Module:
├── POST /assessments (create + AI generate)
├── GET /assessments (list)
├── POST /assessments/{id}/attempt
├── POST /assessments/{id}/grade-written
└── GET /assessments/{id}/results

AI Module:
├── POST /ai/generate (homework, test, lesson plan)
├── POST /ai/grade (auto-grade MCQ/TF/short answer)
└── POST /ai/report (report comments, parent summaries)
```

### Phase 4: Analytics + Communications (Week 4)

```
Analytics Module:
├── GET /analytics/dashboard/{role}
├── GET /analytics/progress/{student_id}
├── GET /analytics/risk
├── GET /analytics/trends/attendance
└── GET /analytics/trends/performance

Communications Module:
├── GET /announcements
├── POST /announcements
├── GET /notifications
├── POST /notifications/mark-read
├── POST /notifications/mark-all-read
└── GET /parent-reports/{student_id}

Background Jobs:
├── Daily risk computation
├── Weekly parent summary generation
└── Attendance trend aggregation
```

---

## 18. Final Answers

### 1. What backend modules should be deleted?

| V1 Module | Action | Reason |
|-----------|--------|--------|
| `api/v1/academic_years.py` | Delete | Over-engineered. Years are config. |
| `api/v1/academic_terms.py` | Delete | Terms are date ranges, not CRUD resources. |
| `api/v1/periods.py` | Delete | Periods are seed data. |
| `api/v1/timetable.py` | Delete | Complex frontend UI, not a REST pattern. |
| `api/v1/schools.py` | Delete | School is tenant context, merged into identity. |
| `api/v1/student_parents.py` | Delete | Single `POST /users/{id}/link-parent` replaces full CRUD. |
| `api/v1/teacher_assignments.py` | Delete | `POST /curriculum/classes/{id}/assign-teacher` replaces it. |
| `api/v1/tests.py` | Delete | Merged into unified `/assessments` module. |
| `api/v1/homeworks.py` | Delete | Merged into unified `/assignments` module. |
| `api/v1/reports.py` | Delete | Replaced by `/analytics` module. |
| `api/v1/annotations.py` | Delete | Replaced by `/communications/announcements`. |
| `domain/reports/` | Delete | Replaced by `/analytics`. |
| `domain/schools/` | Delete | Merged into identity. |
| `domain/homework/` | Delete | Merged into assignments. |
| `domain/tests/` | Delete | Merged into assessments. |
| `domain/academic/*` | Delete | Most functionality either deleted or moved to curriculum. |
| `domain/notifications/` | Keep | Rename to communications. |
| `domain/announcements/` | Keep | Merge into communications. |
| `domain/dashboard/` | Rewrite | Split into analytics (dashboard + progress + risk). |
| `domain/ai/` | Rewrite | Proper 4-layer architecture. |
| `workers/tasks/notification_tasks.py` | Delete | Stub. Rebuild when implementing background jobs. |
| `infrastructure/messaging/whatsapp_provider.py` | Delete | Stub. Rebuild when integrating WhatsApp. |
| 24 of 26 repository files | Delete | Keep base.py and reports.py (rename to analytics.py). |

**Total deleted: ~80% of V1 backend code.**

### 2. What backend modules should be merged?

| Merge | Into | Rationale |
|-------|------|-----------|
| homework + tests → assignments + assessments | Same data model (questions, submissions, grading). |
| identity services (5 files) → 1 UserService + 4 small profile services | All share auth profile pattern. |
| notifications + announcements → communications | Same delivery channel (in-app). Different content. |
| academic services (5 files) → 1 CurriculumService | All deal with curriculum graph traversal. |
| reports + dashboard → analytics | Both are read-only aggregation with caching. |

### 3. What backend modules are missing?

| Missing Module | Priority | Why |
|----------------|----------|-----|
| Rate limiting middleware | P0 | Security. Prevents abuse. |
| File upload service | P1 | Homework attachments, student photos. |
| Audit logging service | P1 | Track all mutations for compliance. |
| Error taxonomy + handler | P1 | Consistent error responses for frontend. |
| Health check for AI | P1 | Teachers need to know if AI is available. |
| Auth refresh/logout | P1 | Production auth UX requirement. |
| Background job scheduler | P2 | Daily risk computation, weekly summaries. |
| WebSocket handler | P2 | Real-time grading updates, live attendance. |
| Offline sync service | P3 | Indian schools have unreliable internet. |

### 4. What should be built first?

| Order | Module | Rationale |
|-------|--------|-----------|
| 1 | Auth + Identity | Everything needs authentication. |
| 2 | Curriculum Engine | Foundation for all teaching workflows. |
| 3 | Attendance | Quick win. Simple, high-impact. |
| 4 | Assignments | Core teacher workflow. AI generation. |
| 5 | Assessments | Core teacher workflow. AI auto-grading. |
| 6 | Analytics | Dashboards need data from 1-5. |
| 7 | Communications | Parent engagement in parallel with 4-6. |
| 8 | AI improvements | Layer on after core workflows exist. |

### 5. What V1 mistakes must never be repeated?

1. **One repo per table** — Creates 26 files when 8 will do.
2. **Separate homework/test models** — Same data structure, different filenames.
3. **Flat route structure** — 23 files in one directory is unmanageable.
4. **Inline permission strings** — `require_role("teacher", "principal")` scattered everywhere.
5. **Academic calendar over-engineering** — Years, terms, periods as REST resources.
6. **Stub infrastructure** — WhatsApp provider, Celery tasks, storage — not implemented.
7. **No caching** — Every dashboard load hits the database.
8. **No rate limiting** — API is completely unprotected.
9. **Services that do everything** — DashboardService at 400+ lines.
10. **Dead code** — Anthropic provider, WhatsApp provider, Celery stubs.
11. **No error taxonomy** — Every error is `HTTPException`.
12. **No health check for AI** — Teachers get 503 with no guidance.

### 6. If Google were building Athon, how would the backend be organized?

**Note**: This is a **North Star / Phase 4+ target**, not a V2 requirement. The V2 implementation uses a well-bounded monolith (single deployable) with clear module boundaries, as described in Sections 3-6. The Google-style architecture below is the direction for 1,000+ school scale, not the immediate build goal.

```
Athon Backend (Google-style — Phase 4+ target):
├── /services               # Microservices (bounded context per domain)
│   ├── identity-service/   # Auth, users, profiles
│   ├── curriculum-service/ # Classes, subjects, chapters, topics, LOs
│   ├── attendance-service/ # Daily attendance marking
│   ├── assignment-service/ # Homework, worksheets, projects
│   ├── assessment-service/ # Tests, exams, grading
│   ├── analytics-service/  # Dashboards, progress, risk detection
│   ├── ai-service/         # AI generation, grading, insights
│   └── communications-service/ # Notifications, announcements
│
├── /lib                    # Shared libraries
│   ├── /auth               # JWT verification, RBAC
│   ├── /database           # SQLAlchemy engine, migrations
│   ├── /cache              # Redis client
│   ├── /storage            # S3/MinIO client
│   ├── /ai                 # AI provider abstraction
│   └── /pagination         # Cursor/offset pagination
│
├── /proto                  # Protobuf definitions (gRPC)
├── /infrastructure         # K8s, Terraform, monitoring
├── /docs                   # OpenAPI specs, architecture docs
├── BUILD / WORKSPACE       # Bazel build (optional)
├── go.mod / pyproject.toml # Dependencies
└── cloudbuild.yaml         # CI/CD
```

**Key Google-style changes from V1 (for Phase 4+):**
1. **Bounded context microservices** — Splits the monolith into independently deployable services
2. **No repository pattern** — Direct SQLAlchemy queries; repos were over-engineering at this scale
3. **No ORM for reads** — SQLAlchemy ORM for writes, raw SQL for read aggregates
4. **gRPC/Protobuf** — Strongly typed contracts between services
5. **OpenAPI 3.0 spec-first** — Design API contract before writing code
6. **Observability by default** — Every endpoint emits metrics, traces, logs
7. **Feature flags** — New AI features behind toggle, canary deployed
8. **Chaos engineering** — Regular testing of AI provider fallback, DB failover

---

**Document Version**: 1.0  
**Review Date**: June 10, 2026  
**Next Review**: After Athon Zero Implementation
