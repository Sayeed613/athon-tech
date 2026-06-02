# 🏫 Athon Backend — Complete Project Report

## Project Overview

**Athon** is an AI-powered school operating system designed for Indian schools (Classes 1-10). It digitizes attendance, homework, tests, reports, and parent communication.

**Stack**: Python 3.14 · FastAPI · SQLAlchemy 2.0 Async · PostgreSQL 17 (Supabase) · Supabase Auth · Celery · Redis

**Status**: Steps 1–9 Complete · Database provisioned & seeded · Auth fully working · Server running on `http://127.0.0.1:8000`

---

## Table of Contents

1. [Technology Stack & Dependencies](#1-technology-stack--dependencies)
2. [Project Structure](#2-project-structure)
3. [Database Architecture (Steps 1-2)](#3-database-architecture)
4. [Backend Foundation (Steps 3-6)](#4-backend-foundation)
5. [ORM Models (Step 7)](#5-orm-models)
6. [Production Authentication (Steps 8A-8C)](#6-production-authentication)
7. [School Context Middleware (Step 9)](#7-school-context-middleware)
8. [API Reference](#8-api-reference)
9. [Test Accounts & Verification](#9-test-accounts--verification)
10. [Bugs Fixed](#10-bugs-fixed)
11. [Architecture Diagrams](#11-architecture-diagrams)

---

## 1. Technology Stack & Dependencies

### Core Stack

| Component | Technology | Version |
|---|---|---|
| Language | Python | 3.14.3 |
| Web Framework | FastAPI | 0.136.3 |
| ASGI Server | Uvicorn | 0.48.0 |
| ORM | SQLAlchemy Async | 2.0.50 |
| DB Driver | asyncpg | 0.31.0 |
| Database | PostgreSQL (Supabase) | 17.6 |
| Auth | Supabase Auth (JWT + JWKS) | — |
| Validation | Pydantic | 2.13.4 |
| Configuration | pydantic-settings | 2.14.1 |
| CLI | Typer | — |
| Background Jobs | Celery | 5.6.3 |
| Message Broker | Redis | 8.0.0 |
| HTTP Client | httpx | 0.28.1 |
| JWT | PyJWT | 2.13.0 |
| Migrations | Alembic | 1.18.4 |

### Development & Testing

| Tool | Version |
|---|---|
| pytest | 9.0.3 |
| pytest-asyncio | 1.4.0 |
| pytest-cov | 7.1.0 |
| ruff (linter) | 0.15.15 |
| mypy (type checker) | 2.1.0 |
| pre-commit | 4.6.0 |

### Key Design Decisions

1. **`supabase-auth` + `postgrest` instead of full `supabase` package** — The full `supabase` meta-package pulls in `storage3` which depends on `pyiceberg` (requires C++ build tools on Windows). Since Athon uses SQLAlchemy directly for DB access, only the auth SDK is needed.

2. **JWKS-based JWT verification instead of shared secret** — Fetches Supabase's public keys dynamically. Supports key rotation without downtime. ES256 ECDSA signatures.

3. **No password storage** — All credential verification delegated to Supabase Auth. Athon's `users` table stores profile data only.

4. **Dependency-based context instead of ASGI middleware** — School context is injected via FastAPI dependencies (`get_current_context`) rather than ASGI middleware. More composable and testable.

---

## 2. Project Structure

```
athon-tech/
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── main.py                   # FastAPI app factory ✨
│   │   ├── dependencies.py           # FastAPI dependency injection
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic BaseSettings ✨
│   │   │   ├── database.py           # Async SQLAlchemy engine + sessions ✨
│   │   │   └── security.py           # JWT verification + SessionContext ✨
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── router.py         # Route aggregator ✨
│   │   │   │   ├── health.py         # GET /health, /health/database ✨
│   │   │   │   └── auth.py           # POST /login, GET /me, GET /context ✨
│   │   │   ├── deps/
│   │   │   │   ├── auth.py           # get_current_user, get_current_context, require_role ✨
│   │   │   │   └── pagination.py     # Pagination, filtering, sorting
│   │   │   └── schemas/
│   │   │       ├── auth.py           # LoginRequest, LoginResponse, UserResponse ✨
│   │   │       └── context.py        # SchoolContext ✨
│   │   ├── models/
│   │   │   ├── base.py               # DeclarativeBase, TimestampMixin, SoftDeleteMixin ✨
│   │   │   ├── enums.py              # UserRole, Gender ✨
│   │   │   ├── user.py               # User model ✨
│   │   │   └── student.py            # Student model ✨
│   │   ├── middleware/               # Stubs (ready for implementation)
│   │   │   ├── auth.py
│   │   │   ├── session.py
│   │   │   ├── error_handler.py
│   │   │   ├── logging.py
│   │   │   └── correlation_id.py
│   │   ├── domain/                   # 11 bounded contexts (structure only)
│   │   ├── repository/               # 29 repository files (structure only)
│   │   ├── infrastructure/           # AI, messaging, storage, PDF (structure only)
│   │   └── workers/                  # Celery tasks (structure only)
│   ├── scripts/
│   │   └── setup_database.py         # Schema + seed + Auth ID sync ✨
│   ├── tests/                        # Test suite (structure only)
│   ├── alembic/                      # Migration configuration ✨
│   │   └── versions/
│   │       └── f65f053e7d10_stamp_initial_schema.py
│   ├── .env                          # Supabase credentials + DATABASE_URL ✨
│   ├── pyproject.toml                # Project metadata & dependencies
│   └── requirements.txt              # Pinned dependencies
├── database/
│   ├── enums.sql                     # 11 ENUM types
│   ├── tables.sql                    # 29 tables + 76 FK constraints
│   ├── indexes.sql                   # 41 indexes
│   ├── triggers.sql                  # 22 updated_at + 10 audit triggers
│   ├── rls.sql                       # ~90 RLS policies across 29 tables
│   └── seed.sql                      # Demo school data
├── docs/
│   ├── project_overview/plan.md      # Project master plan
│   ├── database/database.md          # Database architecture documentation
│   └── backend/backend.md            # Backend architecture documentation
├── docker-compose.yml                # Local dev environment
├── Dockerfile                        # API server image
└── Dockerfile.worker                 # Celery worker image
```

**Legend**: `✨` = Fully implemented and tested

---

## 3. Database Architecture

### SQL Files — Execution Order

| # | File | Contents |
|---|---|---|
| 1 | `database/enums.sql` | 11 ENUM types + `pgcrypto`/`citext` extensions |
| 2 | `database/tables.sql` | 29 tables, 76 FK constraints, CHECK/UNIQUE constraints |
| 3 | `database/indexes.sql` | 41 indexes — partial, composite, covering, unique partial |
| 4 | `database/triggers.sql` | 22 `updated_at` triggers + 10 audit log triggers |
| 5 | `database/rls.sql` | `app` schema with 8 helper functions + RLS on all 29 tables |
| 6 | `database/seed.sql` | Demo school data — 7 users, 2 classes, 5 subjects, 8 periods |

### Custom ENUM Types

| Enum | Values | Used In |
|---|---|---|
| `user_role` | `super_admin`, `school_admin`, `principal`, `teacher`, `student`, `parent` | `users.role` |
| `attendance_status` | `present`, `absent`, `late`, `half_day` | `attendance.status` |
| `question_type` | `multiple_choice`, `true_false`, `short_answer`, `long_answer`, `essay` | homework/test questions |
| `attempt_status` | `pending`, `in_progress`, `submitted`, `graded`, `results_published` | submissions, attempts |
| `notification_channel` | `whatsapp`, `email`, `push`, `sms` | notification_recipients |
| `enrollment_status` | `active`, `promoted`, `transferred`, `graduated`, `withdrawn` | class_enrollments |
| `notification_type` | `academic`, `attendance`, `fee_reminder`, `announcement`, `behavioral`, `emergency`, `system`, `other` | notifications |
| `notification_status` | `pending`, `sent`, `delivered`, `failed` | notification_recipients |
| `report_type` | `student_progress`, `class_performance`, `teacher_performance`, `attendance_summary`, `exam_results`, `custom` | reports |
| `gender` | `male`, `female`, `other` | students |
| `parent_relationship` | `father`, `mother`, `guardian`, `other` | student_parents |

### Entity Summary (29 Tables)

| # | Table | Purpose | School-scoped | Soft Delete |
|---|---|---|---|---|
| 1 | `schools` | Tenant root entity | N/A (root) | ✅ |
| 2 | `users` | Unified auth principal via `supabase_user_id` | ✅ | ✅ |
| 3 | `teachers` | Teacher-specific profile | ✅ | ✅ |
| 4 | `principals` | Principal-specific profile (first-class role) | ✅ | ✅ |
| 5 | `parents` | Parent/guardian profile | ✅ | ✅ |
| 6 | `students` | Student-specific profile | ✅ | ✅ |
| 7 | `classes` | Class groups (e.g. "Grade 10-A") | ✅ | ✅ |
| 8 | `subjects` | Academic subjects offered | ✅ | ✅ |
| 9 | `academic_years` | Calendar years per school | ✅ | ✅ |
| 10 | `academic_terms` | Terms within each academic year | ✅ | ✅ |
| 11 | `periods` | School day time slots | ✅ | ✅ |
| 12 | `student_parents` | M:N student↔parent relationships | ✅ | ❌ |
| 13 | `class_enrollments` | Enrollment history across years | ✅ | ❌ |
| 14 | `teacher_class_subjects` | Maps teachers → classes → subjects per term | ✅ | ✅ |
| 15 | `timetable_entries` | Unified class & teacher schedule | ✅ | ✅ |
| 16 | `attendance` | Daily attendance per student | ✅ | ❌ |
| 17 | `homeworks` | Homework assignments (draft/publish workflow) | ✅ | ✅ |
| 18 | `homework_questions` | Questions within a homework | ✅ (via FK) | ❌ |
| 19 | `homework_submissions` | Student homework submissions | ✅ | ❌ |
| 20 | `homework_answers` | Per-question answers in homework | ✅ (via FK) | ❌ |
| 21 | `tests` | Test/exam definitions | ✅ | ✅ |
| 22 | `test_questions` | Questions within a test | ✅ (via FK) | ❌ |
| 23 | `test_attempts` | Student test attempts | ✅ | ❌ |
| 24 | `test_answers` | Per-question answers in test | ✅ (via FK) | ❌ |
| 25 | `reports` | Generated reports (generic with JSONB data) | ✅ | ❌ |
| 26 | `notifications` | Outbound notification records | ✅ | ❌ |
| 27 | `notification_recipients` | Per-recipient delivery tracking | ✅ (via FK) | ❌ |
| 28 | `audit_logs` | Immutable audit trail | ✅ | ❌ (immutable) |
| 29 | `ai_generations` | AI content generation audit & cost tracking | ✅ | ❌ (immutable) |

### Multi-Tenant Strategy

- **Architecture**: Shared Database, Shared Schema
- Every tenant-scoped table includes `school_id UUID NOT NULL` referencing `schools(id)`
- RLS policies enforce tenant isolation at the database level
- Application sets session context on each connection via `SET app.current_school_id = '<uuid>'`

### Row Level Security

Implemented in `database/rls.sql`:
- **`app` schema** — 8 helper functions for policy evaluation
- **Two-layer approach**: Tenant isolation (`school_id` filter) + role-based access
- **Role access matrix**:

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `super_admin` | Bypasses RLS | Bypasses RLS | Bypasses RLS | Bypasses RLS |
| `school_admin` | School-wide | School-wide | School-wide | School-wide |
| `principal` | School-wide | Academic structure | School-wide | — |
| `teacher` | Own + assigned classes | Own assignments | Own assignments | — |
| `student` | Own records only | Own submissions | Own | — |
| `parent` | Children's records | — | — | — |

### Triggers

- **22 `updated_at` triggers** — Generic `set_updated_at()` function on all tables with `updated_at` column
- **10 audit log triggers** — `audit_log_changes()` captures INSERT/UPDATE/DELETE on: schools, users, teachers, principals, students, classes, homeworks, tests, attendance, timetable_entries

### Seed Data

| Entity | Rows | Details |
|---|---|---|
| schools | 1 | Athon Demo International School |
| academic_years | 1 | 2025-2026 (current) |
| academic_terms | 2 | Term 1 (current), Term 2 |
| users | 7 | All roles: super_admin, school_admin, principal, teacher, student (×2), parent |
| teachers | 1 | Tina Teacher (Mathematics, form teacher Grade 10A) |
| principals | 1 | Peter Principal (permanent) |
| parents | 1 | Patricia Parent (mother of Sam) |
| classes | 2 | Grade 10A & 10B |
| subjects | 5 | Math, English, Science, History, Art |
| students | 2 | Sam (male) and Sierra (female) |
| student_parents | 1 | Sam → Patricia |
| class_enrollments | 2 | Both in Grade 10A, active |
| teacher_class_subjects | 1 | Tina → Grade 10A → Math |

---

## 4. Backend Foundation

### Step 1 — Folder Structure ✅

Created ~115 files across 40 directories covering all layers:
- API layer (routers, deps, schemas)
- Domain layer (11 bounded contexts)
- Repository layer (29 files + base + unit of work)
- Infrastructure layer (AI, messaging, storage, PDF)
- Workers layer (Celery tasks + scheduler)
- Middleware layer (5 middleware stubs)
- Tests (unit, integration, e2e)
- Alembic migrations

### Step 2 — Development Environment ✅

| Task | Detail |
|---|---|
| Python version | 3.14.3 |
| Virtual env | `backend/.venv/` |
| Package manager | pyproject.toml + requirements.txt |
| Key packages | fastapi, uvicorn, sqlalchemy, asyncpg, alembic, pydantic, celery, redis, httpx, supabase-auth, postgrest |
| Dev packages | pytest, pytest-asyncio, pytest-cov, ruff, mypy, pre-commit |

### Step 3 — Cleanup & Restructuring ✅

- Created `app/core/` package (config.py, database.py, security.py)
- Moved config to `app/core/config.py`
- Created `app/core/database.py` with async engine + sessions
- Created `app/core/security.py` with SessionContext + JWT stubs
- Created `app/api/v1/health.py` — first endpoint
- Cleaned up redundant files

### Step 4 — FastAPI Bootstrap ✅

**`app/main.py`** — FastAPI app factory with:
- Metadata: title "Athon Backend", version "0.1.0", description, contact
- CORS middleware: localhost:3000, :5173, app.athonschool.com
- Global exception handler → standard error envelope
- Request logging middleware (method + path + status + duration)
- Lifespan events: DB connection validation on startup (fail-fast), engine disposal on shutdown
- Router: `app.include_router(api_v1_router, prefix="/api/v1")`

**`app/core/config.py`** — Pydantic BaseSettings with:
- App config (name, version, env, debug, log_level)
- Supabase config (url, anon_key, service_key)
- Database config (url, pool_size=20, max_overflow=10)
- Redis config (url, celery broker/backend)
- AI provider keys (OpenAI, Anthropic)
- WhatsApp config (api_key, phone_number, webhook_secret)
- Email config (SMTP host/port/user/password)
- Storage config (bucket, region)
- Monitoring config (Sentry DSN, Datadog API key)
- Computed `jwt_jwks_url` from supabase_url

### Step 5 — Database Connection Layer ✅

**`app/core/database.py`**:
```python
engine = create_async_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_pre_ping=True,
    echo=settings.app_debug,
)

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncSession:  # FastAPI dependency
    # Commits on success, rolls back on exception

async def check_db_connection() -> dict:  # SELECT 1 health check
```

**Health endpoints**: `GET /api/v1/health` and `GET /api/v1/health/database`

### Step 6 — Alembic Migration Setup ✅

- Async migration runner (`env.py` uses `create_async_engine` + `run_async()`)
- Initial migration stamps current DB state as `f65f053e7d10`
- Verified: `alembic current` shows `f65f053e7d10 (head)`

---

## 5. ORM Models (Step 7)

### Base Model (`app/models/base.py`)

```python
class Base(DeclarativeBase): ...
class TimestampMixin:
    created_at: Mapped[datetime]  # DateTime(timezone=True), server_default=now()
    updated_at: Mapped[datetime]  # DateTime(timezone=True), server_default=now(), onupdate=now()
class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None]  # DateTime(timezone=True), nullable=True
```

### Python Enums (`app/models/enums.py`)

```python
class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    PRINCIPAL = "principal"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"

class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
```

### User Model (`app/models/user.py`) ✅

```python
class User(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"
    
    id: uuid.UUID                    # PK, gen_random_uuid()
    school_id: uuid.UUID             # FK → schools.id
    email: str                       # CITEXT at DB level
    phone: str | None
    supabase_user_id: uuid.UUID      # Unique, FK to Supabase Auth
    first_name: str
    last_name: str
    role: UserRole                   # SAEnum with values_callable fix
    avatar_url: str | None
    is_active: bool                  # Default True
    last_login_at: datetime | None   # DateTime(timezone=True) — fixed!
    locale: str                      # Default "en"
    metadata_: dict | None           # JSONB
    
    # Relationships
    school = relationship("School")
    teacher = relationship("Teacher", uselist=False)
    principal = relationship("Principal", uselist=False)
    parent = relationship("Parent", uselist=False)
    student = relationship("Student", uselist=False)
```

### Student Model (`app/models/student.py`) ✅

```python
class Student(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "students"
    
    id: uuid.UUID                    # PK
    user_id: uuid.UUID               # FK → users.id (1:1, unique)
    school_id: uuid.UUID             # FK → schools.id
    class_id: uuid.UUID              # FK → classes.id (denormalized)
    admission_number: str            # Unique per school
    roll_number: str | None          # Unique per school+class
    date_of_birth: date | None
    gender: Gender | None            # SAEnum with values_callable fix
    enrollment_date: date
    is_active: bool                  # Default True
    
    # Relationships
    user = relationship("User", back_populates="student")
    school = relationship("School")
```

### Model Design Notes

- All models use UUID PKs with `server_default=func.gen_random_uuid()`
- All timestamp columns use `DateTime(timezone=True)` to match DB `TIMESTAMPTZ`
- `SAEnum` uses `values_callable=lambda enum_cls: [e.value for e in enum_cls]` to match DB lowercase values
- `SoftDeleteMixin` adds `deleted_at TIMESTAMPTZ` (NULL = active)
- `import uuid` from standard library, not SQLAlchemy's `UUID` type
- Only `User` and `Student` models implemented so far; other models ready for Phase 2

---

## 6. Production Authentication

### Architecture — Three-Layer Authorization

```
Layer 1: JWT Authentication (Supabase) — Verifies the caller is authenticated
Layer 2: Row Level Security (Database) — Enforces tenant isolation + role-based row visibility
Layer 3: Application Permissions (FastAPI) — Role-based endpoint access + resource ownership
```

### Auth Flow

```
Client                          FastAPI                         Supabase Auth         PostgreSQL
  │                                │                               │                    │
  │  POST /auth/login              │                               │                    │
  │  {email, password}             │                               │                    │
  │ ──────────────────────────────►│                               │                    │
  │                                │  POST /auth/v1/token          │                    │
  │                                │  ?grant_type=password         │                    │
  │                                │ ─────────────────────────────►│                    │
  │                                │◄──────── JWT + user ──────────│                    │
  │                                │                               │                    │
  │                                │  SELECT user WHERE            │                    │
  │                                │  supabase_user_id = sub      ────────────────────►│
  │                                │◄──── User ORM instance ────────│                    │
  │                                │                               │                    │
  │◄─── LoginResponse {token,      │                               │                    │
 │       user {id, name, email,    │                               │                    │
 │             role, school_id}    │                               │                    │
 │                                │                               │                    │
  │  GET /auth/me                  │                               │                    │
  │  Authorization: Bearer JWT     │                               │                    │
  │ ──────────────────────────────►│                               │                    │
  │                                │  GET /auth/v1/.well-known     │                    │
  │                                │  /jwks.json                   │                    │
  │                                │ ─────────────────────────────►│                    │
  │                                │◄──── ES256 public key ────────│                    │
  │                                │                               │                    │
  │                                │  Verify JWT signature          │                    │
  │                                │  Extract sub (supabase_user_id)│                    │
  │                                │  SELECT user WHERE             │                    │
  │                                │  supabase_user_id = sub      ────────────────────►│
  │◄──── UserResponse -------------│                               │                    │
```

### JWT Verification (`app/core/security.py`)

```python
# Cached JWKS client — lazy initialization
_jwks_client = PyJWKClient(settings.jwt_jwks_url, cache_keys=True)

async def verify_jwt(token: str) -> Optional[dict]:
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    payload = jwt_decode(
        token,
        signing_key.key,
        algorithms=["ES256"],
        options={"verify_aud": False},
        leeway=30,  # 30s clock skew tolerance
    )
    return payload  # or None on failure
```

### Login Endpoint (`POST /api/v1/auth/login`)

1. Forward credentials to Supabase Auth `/auth/v1/token?grant_type=password`
2. On success, extract `supabase_user_id` from Supabase response
3. Look up user in Athon DB by `supabase_user_id`
4. Verify account is active
5. Update `last_login_at` timestamp
6. Return `{access_token, token_type, user: {id, name, email, role, school_id}}`

### Auth Dependencies (`app/api/deps/auth.py`)

```python
# Returns User ORM instance (raises 401 if invalid)
current_user: User = Depends(get_current_user)

# Returns SchoolContext Pydantic model (raises 401 if invalid)
# Also populates request.state.{user_id, school_id, role, email}
ctx: SchoolContext = Depends(get_current_context)

# Returns User ORM instance, raises 403 if role not allowed
current_user: User = Depends(require_role("school_admin", "principal"))
```

### Supabase Auth Users Provisioned (6 users)

All created via Supabase Auth Admin API:

| Role | Email | Password | Supabase User ID |
|---|---|---|---|
| **School Admin** | admin@athondemo.edu | `Athon2025!` | `490ebed2-7450-415d-859b-a999b823d814` |
| **Principal** | principal@athondemo.edu | `Athon2025!` | `89a2a317-3c01-423c-b4e4-3663472f93aa` |
| **Teacher** | teacher@athondemo.edu | `Athon2025!` | `d829a4c6-b598-4ce8-ae4b-4e71af1a0fc4` |
| **Student** | student@athondemo.edu | `Athon2025!` | `16dad9d3-a386-46d4-a313-4892455f2c53` |
| **Parent** | parent@athondemo.edu | `Athon2025!` | `0e16568c-49d0-4fa1-95ab-dd5b4de51b37` |
| **Student 2** | student2@athondemo.edu | `Athon2025!` | `ff2a17f1-b302-4260-b5ea-e3e861b689ee` |

---

## 7. School Context Middleware

### Architecture (Dependency-Based)

```
                    ┌─────────────────────────┐
                    │     FastAPI Request      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │    HTTPBearer scheme     │  ← extracts token from header
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   get_current_user()     │  ← verifies JWT via JWKS
                    │  SELECT user WHERE       │  ← loads User from DB
                    │  supabase_user_id = sub  │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │ get_current_context()    │  ← builds SchoolContext
                    │ request.state.user_id    │  ← populates state for
                    │ request.state.school_id  │    downstream middleware
                    │ request.state.role       │    and services
                    │ request.state.email      │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │   GET /auth/context      │  ← returns SchoolContext
                    │   ctx: SchoolContext     │
                    └─────────────────────────┘
```

### SchoolContext Schema (`app/api/schemas/context.py`)

```python
class SchoolContext(BaseModel):
    user_id: str
    school_id: str
    role: str
    email: str
```

### get_current_context Implementation

```python
async def get_current_context(request: Request, current_user: User = Depends(get_current_user)) -> SchoolContext:
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    
    ctx = SchoolContext(
        user_id=str(current_user.id),
        school_id=str(current_user.school_id),
        role=role_str,
        email=current_user.email,
    )
    
    request.state.user_id = ctx.user_id
    request.state.school_id = ctx.school_id
    request.state.role = ctx.role
    request.state.email = ctx.email
    
    return ctx
```

---

## 8. API Reference

### Live Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | ❌ | Service health check |
| `GET` | `/api/v1/health/database` | ❌ | Database connectivity check |
| `POST` | `/api/v1/auth/login` | ❌ | Authenticate with email/password |
| `GET` | `/api/v1/auth/me` | ✅ JWT | Get current user profile |
| `GET` | `/api/v1/auth/context` | ✅ JWT | Get school context |

### Request/Response Examples

**GET /api/v1/health**
```json
// Response 200
{"status": "healthy", "service": "athon-backend", "version": "0.1.0"}
```

**POST /api/v1/auth/login**
```json
// Request
{"email": "admin@athondemo.edu", "password": "Athon2025!"}

// Response 200
{
  "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6...",
  "token_type": "bearer",
  "user": {
    "id": "00000000-0000-0000-0000-000000000010",
    "name": "Alice Admin",
    "email": "admin@athondemo.edu",
    "role": "school_admin",
    "school_id": "00000000-0000-0000-0000-000000000001"
  }
}
```

**GET /api/v1/auth/me** (Authorization: Bearer \<token\>)
```json
// Response 200
{
  "id": "00000000-0000-0000-0000-000000000010",
  "name": "Alice Admin",
  "email": "admin@athondemo.edu",
  "role": "school_admin",
  "school_id": "00000000-0000-0000-0000-000000000001"
}
```

**GET /api/v1/auth/context** (Authorization: Bearer \<token\>)
```json
// Response 200
{
  "user_id": "00000000-0000-0000-0000-000000000010",
  "school_id": "00000000-0000-0000-0000-000000000001",
  "role": "school_admin",
  "email": "admin@athondemo.edu"
}
```

**Error Responses**
```json
// 401 — Wrong credentials
{"detail": "Invalid email or password"}

// 401 — Missing token
{"detail": "Not authenticated — missing Bearer token"}

// 401 — Invalid/expired token
{"detail": "Invalid or expired token"}

// 403 — Wrong role
{"detail": "Access denied — requires one of: school_admin, principal"}
```

### How to Use cURL

```bash
# Health check
curl http://127.0.0.1:8000/api/v1/health

# Login
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@athondemo.edu","password":"Athon2025!"}'

# Get current user (replace <token>)
curl http://127.0.0.1:8000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"

# Get school context
curl http://127.0.0.1:8000/api/v1/auth/context \
  -H "Authorization: Bearer <token>"
```

---

## 9. Test Accounts & Verification

### Test Accounts

| Role | Email | Password |
|---|---|---|
| **School Admin** | admin@athondemo.edu | `Athon2025!` |
| **Principal** | principal@athondemo.edu | `Athon2025!` |
| **Teacher** | teacher@athondemo.edu | `Athon2025!` |
| **Student** | student@athondemo.edu | `Athon2025!` |
| **Parent** | parent@athondemo.edu | `Athon2025!` |

### Running the Server

```bash
cd backend
.venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Swagger UI

Open `http://127.0.0.1:8000/docs` in browser.

### Verification Results

| # | Test | Result |
|---|---|---|
| 1 | Health check | ✅ `200 OK` |
| 2 | Database health | ✅ Connected |
| 3 | Login: admin@athondemo.edu → school_admin | ✅ Returns JWT + user profile |
| 4 | Login: principal@athondemo.edu → principal | ✅ Returns JWT + user profile |
| 5 | Login: teacher@athondemo.edu → teacher | ✅ Returns JWT + user profile |
| 6 | Login: student@athondemo.edu → student | ✅ Returns JWT + user profile |
| 7 | Login: parent@athondemo.edu → parent | ✅ Returns JWT + user profile |
| 8 | GET /auth/me with valid JWT | ✅ Returns user profile |
| 9 | GET /auth/context (admin) | ✅ `{user_id, school_id, role: "school_admin", email}` |
| 10 | GET /auth/context (principal) | ✅ `{user_id, school_id, role: "principal", email}` |
| 11 | GET /auth/context (teacher) | ✅ `{user_id, school_id, role: "teacher", email}` |
| 12 | GET /auth/context (student) | ✅ `{user_id, school_id, role: "student", email}` |
| 13 | Wrong password | ✅ `401 Invalid email or password` |
| 14 | Non-existent email | ✅ `401 Invalid email or password` |
| 15 | Missing token | ✅ `401 Not authenticated — missing Bearer token` |
| 16 | Invalid/expired token | ✅ `401 Invalid or expired token` |

---

## 10. Bugs Fixed

During implementation, 4 bugs were identified and fixed:

### Bug 1: Enum Case Mismatch (SAEnum vs DB Values)

**Symptom**: `LookupError: 'school_admin' is not among the defined enum values` on any database row read.

**Root Cause**: Python `UserRole` uses uppercase member names (`SCHOOL_ADMIN`, `TEACHER`), but the PostgreSQL DB stores lowercase values (`'school_admin'`, `'teacher'`). SQLAlchemy's `SAEnum` was validating against member *names* instead of member *values*.

**Fix**: Added `values_callable=lambda enum_cls: [e.value for e in enum_cls]` to all `SAEnum` mappings (User.role, Student.gender).

**Files**: `app/models/user.py`, `app/models/student.py`

### Bug 2: JWKS Clock Skew

**Symptom**: `ImmatureSignatureError` during JWT verification.

**Root Cause**: Supabase JWTs have an `iat` (issued at) claim slightly ahead of the app server's clock. PyJWT's default leeway is 0 seconds, causing rejection of perfectly valid tokens.

**Fix**: Added `leeway=30` to `jwt_decode()` call — allows 30 seconds of clock skew.

**File**: `app/core/security.py`

### Bug 3: Database Connectivity

**Symptom**: Server couldn't connect to Supabase PostgreSQL.

**Root Cause**: The `.env` file was missing a working `DATABASE_URL`.

**Fix**: Updated `.env` with the correct Supabase connection string.

**File**: `.env`

### Bug 4: Timezone-Aware vs Naive DateTime

**Symptom**: `DataError: can't subtract offset-naive and offset-aware datetimes` on login.

**Root Cause**: The DB `last_login_at` column is `TIMESTAMPTZ` (timestamp with time zone), but the SQLAlchemy model used a bare `mapped_column()` which defaults to `TIMESTAMP WITHOUT TIME ZONE`. SQLAlchemy explicitly cast the parameter as `TIMESTAMP WITHOUT TIME ZONE`, causing a mismatch with the timezone-aware `datetime.now(timezone.utc)`.

**Fix**: Added `DateTime(timezone=True)` to the `last_login_at` column.

**File**: `app/models/user.py`

---

## 11. Architecture Diagrams

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│              (Web App · Mobile App · WhatsApp Bot)                       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│               FastAPI · CORS · Rate Limiting · Validation                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE LAYER                               │   │
│  │  · CORS · Request Logging · Exception Handler                    │   │
│  │  · (Future: Session Context, Correlation ID)                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    ROUTER LAYER                                   │   │
│  │  /api/v1/health       ✅ Live                                    │   │
│  │  /api/v1/auth         ✅ Live (login, me, context)                │   │
│  │  /api/v1/*            🔜 Planned (schools, users, classes, etc.)  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    DOMAIN / SERVICE LAYER                         │   │
│  │  11 bounded contexts — Auth, Schools, Identity, Academic,        │   │
│  │  Attendance, Homework, Tests, Reports, Notifications, AI,        │   │
│  │  Dashboard (structure ready, logic to be implemented)            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    REPOSITORY LAYER                               │   │
│  │  29 repository files + Generic Repository[T] + Unit of Work      │   │
│  │  (structure ready, implementations to be added)                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    INFRASTRUCTURE LAYER                           │   │
│  │  · Supabase PostgreSQL (connected ✅)                            │   │
│  │  · Supabase Auth (configured ✅)                                 │   │
│  │  · Redis (configured)                                            │   │
│  │  · AI Providers (stubs) · Messaging (stubs) · PDF (stubs)        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKER LAYER                                     │
│          Celery Workers · Scheduled Tasks (structure ready)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Authentication Architecture

```
┌─────────────────────────────────────────────┐
│              Client Application              │
│  Stores JWT in memory/secure storage         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         POST /api/v1/auth/login              │
│  Body: {email, password}                     │
├─────────────────────────────────────────────┤
│  1. Forward credentials to Supabase Auth     │
│  2. Receive JWT (ES256 signed)              │
│  3. Lookup user by supabase_user_id         │
│  4. Update last_login_at                    │
│  5. Return {access_token, user_profile}     │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Authenticated Requests               │
│  Header: Authorization: Bearer <JWT>         │
├─────────────────────────────────────────────┤
│  1. Extract JWT from header                 │
│  2. Fetch JWKS public key (cached)          │
│  3. Verify signature + claims (ES256)       │
│  4. Extract sub claim (Supabase user UUID)  │
│  5. SELECT user WHERE supabase_user_id = sub│
│  6. Check is_active flag                    │
│  7. Build SchoolContext {user_id, school_id,│
│     role, email} → request.state            │
│  8. Execute endpoint logic                  │
└─────────────────────────────────────────────┘
```

### Project Progress

```
Database Schema (DDL):          ████████████████████ 100%
Backend Foundation:             ████████████████████ 100%
ORM Models:                     ██████░░░░░░░░░░░░░░  30%
Authentication:                 ████████████████████ 100%
School Context Middleware:      ████████████████████ 100%
Business Logic (Services):      ░░░░░░░░░░░░░░░░░░░░   0%
Attendance APIs:                ░░░░░░░░░░░░░░░░░░░░   0%
Homework APIs:                  ░░░░░░░░░░░░░░░░░░░░   0%
Tests APIs:                     ░░░░░░░░░░░░░░░░░░░░   0%
Reports:                        ░░░░░░░░░░░░░░░░░░░░   0%
WhatsApp Notifications:         ░░░░░░░░░░░░░░░░░░░░   0%
AI Features:                    ░░░░░░░░░░░░░░░░░░░░   0%

Overall Progress: ≈ 30%
```

---

## Appendix A: Running the Project

### Prerequisites

- Python 3.14+
- PostgreSQL (or Supabase account)
- Redis (for Celery — optional for now)

### Setup

```bash
# Clone & enter project
cd athon-tech

# Create virtual environment
cd backend
python -m venv .venv
.venv/Scripts/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Edit .env with your Supabase credentials

# Run database setup (creates schema + seeds data)
.venv/Scripts/python scripts/setup_database.py

# Start development server
.venv/Scripts/uvicorn app.main:app --reload

# Open API docs
# http://127.0.0.1:8000/docs
```

### Docker

```bash
docker-compose up -d
```

---

## Appendix B: File Inventory

### Files Implemented and Tested (✨)

| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app factory — CORS, lifespan, exception handler, routing |
| `backend/app/core/config.py` | Pydantic BaseSettings — 30+ environment variables |
| `backend/app/core/database.py` | Async SQLAlchemy engine, session factory, health check |
| `backend/app/core/security.py` | JWKS JWT verification, SessionContext |
| `backend/app/models/base.py` | DeclarativeBase, TimestampMixin, SoftDeleteMixin |
| `backend/app/models/enums.py` | Python enums: UserRole, Gender |
| `backend/app/models/user.py` | User model (7 FKs, SAEnum fix, Timezone fix) |
| `backend/app/models/student.py` | Student model (SAEnum fix) |
| `backend/app/api/v1/router.py` | Route aggregator |
| `backend/app/api/v1/health.py` | GET /health, GET /health/database |
| `backend/app/api/v1/auth.py` | POST /login, GET /me, GET /context |
| `backend/app/api/deps/auth.py` | get_current_user, get_current_context, require_role |
| `backend/app/api/schemas/auth.py` | LoginRequest, LoginResponse, UserResponse |
| `backend/app/api/schemas/context.py` | SchoolContext |
| `backend/.env` | Supabase credentials + DATABASE_URL |
| `backend/scripts/setup_database.py` | Schema + seed + Auth ID sync |

### Files Ready for Phase 2 (Structure Only)

| Path | Count | Contents |
|---|---|---|
| `backend/app/domain/` | 11 packages | Service classes (empty stubs) |
| `backend/app/repository/` | 29 files | CRUD repositories (empty stubs) |
| `backend/app/infrastructure/` | 6 files | AI, messaging, storage, PDF (empty stubs) |
| `backend/app/middleware/` | 5 files | Auth, session, logging, error handler, correlation ID (empty stubs) |
| `backend/app/workers/` | 5 files | Celery tasks (empty stubs) |
| `backend/app/api/v1/` | 15 files | Endpoint routers (empty stubs) |
| `backend/app/api/schemas/` | 12 files | Pydantic schemas (empty stubs) |
| `backend/tests/` | 3 packages | Test suite (empty stubs) |

---

## Appendix C: Supabase Auth Admin API

For provisioning new users:

```bash
# List all Auth users
curl -X GET https://uekuowqjuciqogwasmtm.supabase.co/auth/v1/admin/users \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <service-role-key>"

# Create a new Auth user
curl -X POST https://uekuowqjuciqogwasmtm.supabase.co/auth/v1/admin/users \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@school.edu","password":"SecurePass123!","email_confirm":true}'

# Delete a user
curl -X DELETE https://uekuowqjuciqogwasmtm.supabase.co/auth/v1/admin/users/<user-id> \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <service-role-key>"
```

---

*Report generated for ChatGPT review — covers all work up to Step 9 (School Context Middleware). Total steps completed: 9/9 in Phase 1.*
