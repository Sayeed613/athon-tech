# Athon — Backend Architecture

**Last Updated**: June 9, 2026

---

## 1. Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Python | 3.12+ |
| Framework | FastAPI | 0.136.3 |
| ORM | SQLAlchemy | 2.0.50 (async) |
| Driver | asyncpg | 0.31.0 |
| Auth | Supabase Auth (JWT via JWKS) | ES256 ECDSA |
| Validation | Pydantic v2 | 2.13.4 |
| Background Jobs | Celery | 5.6.3 (via Redis) |
| AI | OpenAI / Anthropic | gpt-4o-mini |

---

## 2. Folder Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps/          # FastAPI dependencies (auth, pagination, school context)
│   │   ├── schemas/       # Pydantic request/response models (24 files)
│   │   └── v1/            # API route handlers (25 route files + router)
│   ├── common/            # Shared utilities (exceptions, pagination, permissions)
│   ├── core/              # Config, database engine, security (JWT verification)
│   ├── domain/            # Business logic (14 domain modules)
│   │   ├── academic/      # Academic calendar, classes, subjects, timetable
│   │   ├── ai/            # AI question generation
│   │   ├── announcements/ # Announcement lifecycle
│   │   ├── attendance/    # Attendance marking & reports
│   │   ├── auth/          # Auth service & session management
│   │   ├── dashboard/     # Role-specific dashboard composers
│   │   ├── homework/      # Homework CRUD, grading, submissions
│   │   ├── identity/      # User, teacher, student, parent, principal services
│   │   ├── notifications/ # Notification creation & delivery
│   │   ├── reports/       # Report aggregation service
│   │   ├── schools/       # School profile service
│   │   └── tests/         # Test CRUD, attempts, grading
│   ├── infrastructure/    # External integrations (AI providers, messaging, PDF, storage)
│   ├── middleware/         # Auth, correlation ID, error handler, logging
│   ├── models/            # SQLAlchemy ORM models (29 models)
│   ├── repository/        # Data access layer (32 repo files)
│   └── workers/           # Celery app + task definitions
├── alembic/               # Database migrations (3 versions)
├── scripts/               # Utility scripts (sync auth, seed, fix users)
└── tests/                 # Test stubs (no actual tests)
```

---

## 3. Architecture: API → Domain → Repository

```
[Client] → [API Route] → [Schema] → [Domain Service] → [Repository] → [Database]
                                                              ↕
                                                         [ORM Model]
```

### API Layer (`app/api/v1/`)
- **Purpose**: HTTP endpoints, request parsing, response serialization
- **Pattern**: FastAPI router classes with `Depends()` for auth
- **Auth**: `get_current_user` → JWT verification, `require_role()` → role check
- **Convention**: Each route file handles one resource (e.g., `teachers.py`, `homeworks.py`)

### Domain Layer (`app/domain/`)
- **Purpose**: Business logic, validation, orchestration
- **Pattern**: Service classes with repository injection
- **Rules**: All business rules enforced at this layer (uniqueness, permissions, scoping)

### Repository Layer (`app/repository/`)
- **Purpose**: Data access, query building
- **Pattern**: Generic `BaseRepository[T]` with entity-specific subclasses
- **Features**: Soft-delete support, school-scoped queries, eager loading

---

## 4. Authentication

### Flow

```
User → POST /auth/login → Supabase Auth → JWT Token → verify_jwt() → get_current_user()
```

1. **Login**: Delegates to Supabase Auth REST API
2. **Token**: JWT signed with ES256, verified against Supabase JWKS endpoint
3. **User Resolution**: JWT `sub` claim → `users.supabase_user_id` lookup
4. **Session**: Token stored client-side (localStorage), sent as `Authorization: Bearer <token>`

### Auth Dependencies

| Dependency | Purpose |
|-----------|---------|
| `get_current_user` | Verifies JWT + loads User model (returns `User`) |
| `require_role("teacher", ...)` | Factory: checks user role against allowed list |
| `get_current_context` | Builds `SchoolContext` from user, populates `request.state` |

---

## 5. API Inventory

### Route Summary (22 modules, 107 endpoints)

| Module | Routes | Prefix |
|--------|:------:|--------|
| Health | 2 | `/health` |
| Auth | 3 | `/auth` |
| Teachers | 5 | `/teachers` |
| Students | 6 | `/students` |
| Principals | 5 | `/principals` |
| Parents | 5 | `/parents` |
| Student-Parents | 1 | `/student-parents` |
| Classes | 5 | `/classes` |
| Subjects | 5 | `/subjects` |
| Academic Years | 5 | `/academic-years` |
| Academic Terms | 5 | `/academic-terms` |
| Periods | 5 | `/periods` |
| Teacher Assignments | 3 | `/teacher-assignments` |
| Timetable | 7 | `/timetable` |
| Attendance | 5 | `/attendance` |
| Homework | 9 | `/homework` |
| Tests | 8 | `/tests` |
| Dashboard | 4 | `/dashboard` |
| Reports | 6 | `/reports` |
| Notifications | 5 | `/notifications` |
| Announcements | 5 | `/announcements` |
| Parent Portal | 6 | `/parent` |
| Schools | 2 | `/schools` |
| AI | 1 | `/ai` |

---

## 6. Domain Services

| Service | Module | Status |
|---------|--------|--------|
| AIService | `domain/ai/` | ✅ Built |
| AnnouncementService | `domain/announcements/` | ✅ Built |
| AttendanceService | `domain/attendance/` | ✅ Built |
| AuthService | `domain/auth/` | ✅ Built |
| ClassService | `domain/academic/` | ✅ Built |
| DashboardService | `domain/dashboard/` | ✅ Built |
| EnrollmentService | `domain/academic/` | ✅ Built |
| GradingService (homework) | `domain/homework/` | ✅ Built |
| GradingService (tests) | `domain/tests/` | ✅ Built |
| HomeworkService | `domain/homework/` | ✅ Built |
| NotificationService | `domain/notifications/` | ✅ Built |
| ParentService | `domain/identity/` | ✅ Built |
| PrincipalService | `domain/identity/` | ✅ Built |
| ReportService | `domain/reports/` | ✅ Built |
| SchoolService | `domain/schools/` | ✅ Built |
| StudentService | `domain/identity/` | ✅ Built |
| SubjectService | `domain/academic/` | ✅ Built |
| TeacherService | `domain/identity/` | ✅ Built |
| TestService | `domain/tests/` | ✅ Built |
| TimetableService | `domain/academic/` | ✅ Built |
| UserService | `domain/identity/` | ✅ Built |

---

## 7. Celery Workers

| Component | Status | Notes |
|-----------|--------|-------|
| Celery App (`celery_app.py`) | ✅ Configured | Broker: Redis |
| Notification Tasks (`notification_tasks.py`) | ✅ Implemented | WhatsApp alerts for absences |
| Cleanup Tasks (`cleanup_tasks.py`) | ✅ Implemented | Scheduled soft-delete cleanup |
| Scheduler (`scheduler.py`) | ✅ Implemented | Celery Beat schedule |

---

## 8. Known Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `day_name` undefined in `dashboard_service.py` (lines ~110, ~280) | **Medium** — crashes teacher/student dashboards at runtime | Needs fix |
| 2 | No test coverage (0%) | **High** | Needs effort |
| 3 | Missing pagination on most list endpoints | Medium | Infrastructure exists, not wired |
| 4 | Inconsistent response wrapping | Low | Some use `{items, total}`, others bare objects |
| 5 | No rate limiting | Medium | API unprotected against abuse |
| 6 | 3 empty Docker/deployment files | Low | Docker not configured |

---

## 9. Production Readiness

| Category | Score |
|----------|:-----:|
| ORM Coverage | 100% (29/29 tables) |
| Auth Coverage | 100% (all endpoints have role enforcement) |
| School Isolation | 100% (all queries school-scoped) |
| API Consistency | 85% |
| Error Handling | 70% |
| Background Jobs | 70% (notification tasks working) |
| Testing | 0% |
| Documentation | 90% |
| **Overall** | **~65%** |
