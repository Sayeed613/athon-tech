# Athon — Backend Documentation

**Stack**: FastAPI (Python) · Supabase (PostgreSQL + Auth) · SQLAlchemy 2.0 Async · Celery (Background Jobs)
**Status**: Steps 1–6 Complete · Database Connected · Server Running

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Domain Structure](#3-domain-structure)
4. [API Design](#4-api-design)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Service Layer Design](#6-service-layer-design)
7. [Repository Layer Design](#7-repository-layer-design)
8. [Background Job Architecture](#8-background-job-architecture)
9. [Notification Architecture](#9-notification-architecture)
10. [AI Service Architecture](#10-ai-service-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Implementation Steps](#12-implementation-steps)
    - [Step 1 — Folder Structure](#step-1--folder-structure)
    - [Step 2 — Development Environment](#step-2--development-environment)
    - [Step 3 — Cleanup & Restructuring](#step-3--cleanup--restructuring)
    - [Step 4 — FastAPI Bootstrap](#step-4--fastapi-bootstrap)
    - [Step 5 — Database Connection Layer](#step-5--database-connection-layer)
    - [Step 6 — Alembic Migration Setup](#step-6--alembic-migration-setup)
13. [Architecture Decision Records](#13-architecture-decision-records)

---

## 1. Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│              (Web App · Mobile App · WhatsApp Bot)                       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTPS / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│               FastAPI · Rate Limiting · CORS · Request Validation       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE LAYER                               │   │
│  │  · Supabase JWT Verification (auth.middleware)                   │   │
│  │  · Session Context (app.current_* settings)                     │   │
│  │  · Request ID / Tracing / Logging                                │   │
│  │  · Error Handling / Exception Mapping                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    ROUTER LAYER                                   │   │
│  │  /api/v1/*  — health, auth, schools, users, classes,             │   │
│  │  homeworks, tests, attendance, reports, notifications, ai        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    DOMAIN / SERVICE LAYER                         │   │
│  │  14 bounded contexts: Auth, Schools, Identity, Academic,         │   │
│  │  Attendance, Homework, Tests, Reports, Notifications, AI,        │   │
│  │  Dashboard, Enrollments, Teacher Assignments, Audit              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    REPOSITORY LAYER                               │   │
│  │  · SQLAlchemy 2.0 Async + asyncpg                               │   │
│  │  · Generic Repository[T] + Unit of Work                          │   │
│  │  · 27 repository files (one per table) + base.py + unit_of_work  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    INFRASTRUCTURE LAYER                           │   │
│  │  · Database (Supabase PostgreSQL)                                │   │
│  │  · Cache (Redis)                                                 │   │
│  │  · Object Storage (Supabase Storage)                             │   │
│  │  · AI Provider (OpenAI / Anthropic)                              │   │
│  │  · WhatsApp / Email / Push providers                              │   │
│  │  · PDF report generation                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKER LAYER                                     │
│          Celery Workers · Scheduled Tasks · Notification Delivery       │
│          Report Generation · AI Processing · WhatsApp Callbacks         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architectural Principles

| Principle | Application |
|---|---|
| Domain-Driven Design | Bounded contexts map to business domains; no cross-contamination |
| Separation of Concerns | API → Service → Repository → Infrastructure; each layer knows only its neighbor |
| Dependency Inversion | Domain defines interfaces; infrastructure implements them |
| CQRS (light) | Reads go through Supabase RLS, writes go through service layer |
| Idempotency | All mutation endpoints support idempotency keys |
| Observability | Structured logging, OpenTelemetry tracing, Prometheus metrics |

---

## 2. Folder Structure

```
backend/
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore rules
├── pyproject.toml                   # Project metadata & dependencies (source of truth)
├── requirements.txt                 # Pinned dependencies (generated from pip freeze)
├── Dockerfile                       # API server image
├── Dockerfile.worker                # Celery worker image
├── docker-compose.yml               # Local development environment
│
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI app factory (CORS, lifespan, middleware, routers)
│   ├── dependencies.py              # FastAPI dependency injection
│   │
│   ├── core/                        # Core infrastructure
│   │   ├── __init__.py
│   │   ├── config.py                # Pydantic BaseSettings (30+ env vars)
│   │   ├── database.py              # Async SQLAlchemy engine + session + health check
│   │   └── security.py              # SessionContext dataclass + JWT helpers (stubs)
│   │
│   ├── api/                         # API Layer
│   │   ├── v1/                      # 17 route files (health, auth, schools, users, etc.)
│   │   │   ├── router.py            # Aggregates all v1 routers
│   │   │   ├── health.py            # GET /health, GET /health/database
│   │   │   ├── auth.py, schools.py, users.py, teachers.py
│   │   │   ├── principals.py, parents.py, classes.py
│   │   │   ├── subjects.py, students.py, attendance.py
│   │   │   ├── homeworks.py, tests.py, reports.py
│   │   │   ├── notifications.py, ai.py, dashboard.py
│   │   ├── deps/                    # Router dependencies
│   │   │   ├── auth.py              # get_current_user, require_role
│   │   │   ├── pagination.py        # Pagination, filtering, sorting
│   │   │   └── school_context.py    # School-scoped dependency
│   │   └── schemas/                 # Pydantic request/response models (16 files)
│   │
│   ├── domain/                      # Business Logic (11 bounded contexts)
│   │   ├── auth/                    # Authentication domain
│   │   ├── schools/                 # School domain
│   │   ├── identity/                # Users, Teachers, Principals, Parents, Students
│   │   ├── academic/                # Classes, Subjects, Calendar, Enrollments
│   │   ├── attendance/              # Attendance marking & reports
│   │   ├── homework/                # Homework CRUD, submissions, grading
│   │   ├── tests/                   # Test CRUD, attempts, grading
│   │   ├── reports/                 # Report generation
│   │   ├── notifications/           # Notification creation & delivery
│   │   ├── ai/                      # AI content generation
│   │   └── dashboard/               # Dashboard aggregation (4 role types)
│   │
│   ├── repository/                  # Data Access Layer (29 files)
│   │   ├── base.py                  # Generic Repository[T] base class
│   │   ├── unit_of_work.py          # Transaction management
│   │   └── 27 entity-specific repos # One per table (schools, users, etc.)
│   │
│   ├── infrastructure/              # External integrations
│   │   ├── cache.py                 # Redis cache abstraction
│   │   ├── storage.py               # Supabase Storage (file uploads)
│   │   ├── ai/                      # OpenAI + Anthropic providers
│   │   ├── messaging/               # WhatsApp, Email, Push providers
│   │   └── pdf/                     # Report PDF generation
│   │
│   ├── workers/                     # Background jobs (Celery)
│   │   ├── celery_app.py            # Celery configuration
│   │   ├── scheduler.py             # Beat schedule definitions
│   │   └── tasks/                   # 5 task files (notification, report, ai, etc.)
│   │
│   ├── middleware/                  # FastAPI middleware
│   │   ├── auth.py                  # JWT verification
│   │   ├── session.py               # App session context (RLS params)
│   │   ├── logging.py               # Request/response logging
│   │   ├── error_handler.py         # Global exception handler
│   │   └── correlation_id.py        # Request tracing
│   │
│   └── common/                      # Shared utilities
│       ├── exceptions.py            # Domain exceptions
│       ├── pagination.py            # Pagination utilities
│       ├── permissions.py           # Role-based permission constants
│       ├── idempotency.py           # Idempotency key decorator
│       └── types.py                 # Shared type aliases
│
├── tests/                           # Test suite
│   ├── conftest.py                  # Fixtures (DB, Supabase mock, factories)
│   ├── unit/domain/                 # Unit tests for services
│   ├── unit/repository/             # Unit tests for repositories
│   ├── integration/                 # Integration tests for API endpoints
│   └── e2e/                         # End-to-end workflow tests
│
├── alembic/                         # Database migrations
│   ├── env.py                       # Async migration runner
│   ├── script.py.mako               # Migration template
│   ├── versions/                    # Migration version files
│   └── alembic.ini                  # Alembic configuration
│
└── scripts/                         # Dev & ops scripts
    ├── init_db.sh
    ├── seed_data.sh
    └── run_worker.sh
```

---

## 3. Domain Structure

### Bounded Contexts

| Bounded Context | Owner | Key Entities | Dependencies |
|---|---|---|---|
| Auth | System | Supabase Auth, JWT, Session | Supabase Auth API |
| Schools | Super Admin | schools | None (root) |
| Identity | School Admin | users, teachers, principals, parents, students | Schools |
| Academic Calendar | School Admin | academic_years, academic_terms | Schools |
| Academic Structure | Principal | classes, subjects | Schools, Academic Calendar |
| Enrollments | School Admin | student_parents, class_enrollments | Identity, Academic Structure |
| Teacher Assignments | Principal | teacher_class_subjects | Identity, Academic Structure, Calendar |
| Attendance | Teacher | attendance | Identity, Academic Structure |
| Homework | Teacher | homeworks, homework_questions, submissions, answers | Identity, Academic Structure, AI |
| Tests | Teacher | tests, test_questions, attempts, answers | Identity, Academic Structure, AI |
| Reports | Principal | reports | Multiple domains (read-only) |
| Notifications | System | notifications, notification_recipients | Identity, Messaging |
| AI | Teacher | ai_generations | Multiple domains |
| Audit | System | audit_logs | All domains (via trigger) |

### Domain Service Pattern

```python
class HomeworkService:
    def __init__(self, repo, ai_service, notification_service, unit_of_work):
        ...

    async def create_homework(self, school_id, teacher_id, data) -> Homework:
        # 1. Validate business rules
        # 2. Create via repo (within unit of work)
        # 3. Publish domain event
        # 4. Return result
```

---

## 4. API Design

### Base URL Convention

```
https://api.athonschool.com/v1
```

### Live Endpoints (Implemented)

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | ✅ Live | Service health (`healthy`, version) |
| `GET` | `/api/v1/health/database` | ✅ Live | Database connectivity check |

### Planned Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with email/password |
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/refresh` | Refresh JWT token |
| `GET/POST/PATCH/DELETE` | `/schools` | School CRUD |
| `GET/POST` | `/users` | User management |
| `GET/POST` | `/teachers` | Teacher profiles |
| `GET/POST` | `/students` | Student profiles |
| `POST` | `/attendance/batch` | Batch attendance marking |
| `GET/POST/PATCH` | `/homeworks` | Homework CRUD + submissions |
| `GET/POST/PATCH` | `/tests` | Test CRUD + attempts |
| `GET` | `/dashboard/teacher` | Teacher dashboard |
| `GET` | `/dashboard/principal` | Principal dashboard |

### Response Envelope

```json
{
  "data": { ... },
  "meta": { "page": 1, "per_page": 20, "total": 142, "total_pages": 8 },
  "error": null
}
```

### Error Format

```json
{
  "data": null,
  "error": {
    "code": "HOMEWORK_NOT_FOUND",
    "message": "Homework with id 'abc-123' not found in this school",
    "details": { "homework_id": "abc-123" }
  }
}
```

---

## 5. Authentication & Authorization Flow

### Auth Flow

```
Client → POST /auth/login → FastAPI → Supabase Auth API → JWT (access + refresh)
Client → GET /api/v1/... (JWT) → FastAPI verifies → Sets session context → Processes with RLS
```

### Three-Layer Authorization

```
Layer 1: JWT Authentication (Supabase) — Verifies the caller is authenticated
Layer 2: Row Level Security (Database) — Enforces tenant isolation + role-based row visibility
Layer 3: Application Permissions (FastAPI) — Role-based endpoint access + resource ownership
```

### Role Hierarchy

```
super_admin → school_admin → principal → teacher → student / parent
```

### Permission Matrix

| Endpoint | super_admin | school_admin | principal | teacher | student | parent |
|---|---|---|---|---|---|---|
| `POST /schools` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /users` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `POST /attendance/batch` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `POST /homeworks` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `GET /students/{id}` | ✅ | ✅ | ✅ | ✅ | 👤 | 👨‍👧 |

> 👤 = Own records only · 👨‍👧 = Own children only

---

## 6. Service Layer Design

Every domain service follows a consistent interface with command methods (mutations within Unit of Work) and query methods (read-only, no transaction). Services use constructor-based dependency injection.

### Cross-Domain Orchestration

```
HomeworkService.publish()
  ├── Validates homework is in draft state
  ├── Sets is_published = TRUE
  ├── NotificationService.notify_class(class_id, 'new_homework')
  │     ├── Resolves students + parents
  │     ├── Creates notification records
  │     └── Queues WhatsApp/email delivery (Celery)
  └── Returns updated homework
```

---

## 7. Repository Layer Design

### Pattern: Generic Repository + Unit of Work

```python
class Repository[T]:
    """Generic CRUD repository with school-scoped queries."""

    async def get(self, id: UUID, school_id: UUID) -> T | None: ...
    async def list(self, school_id, filters, pagination) -> Page[T]: ...
    async def add(self, entity: T) -> T: ...
    async def update(self, entity: T) -> T: ...
    async def delete(self, entity: T) -> None: ...
```

### Repository vs RLS

| Concern | Handled By |
|---|---|
| Tenant isolation | RLS (database) |
| Input validation | Pydantic schemas (API) |
| Business rules | Domain services |
| Cross-entity transactions | Unit of Work |
| Complex queries | Repository (raw SQL / ORM) |

---

## 8. Background Job Architecture

**Stack**: Celery + Redis

### Key Tasks

| Task | Trigger | Priority |
|---|---|---|
| `send_notification` | On homework/test publish | High |
| `retry_failed_notifications` | Every 5 min (scheduled) | Medium |
| `generate_report` | User request | Low |
| `generate_ai_content` | Teacher request | Medium |
| `send_daily_attendance_summary` | Daily 3 PM (scheduled) | Medium |
| `archive_old_records` | Weekly Sunday 2 AM (scheduled) | Low |

---

## 9. Notification Architecture

### Multi-Channel Pipeline

```
Event → NotificationService → Create notification → Resolve recipients
  → Create notification_recipients (one per channel)
  → Enqueue Celery tasks for WhatsApp (primary), Email (fallback), Push (mobile)
  → Delivery worker updates status: pending → sent → delivered / failed (retry 3×)
```

### WhatsApp-First Delivery

Athon is WhatsApp-first by design. Templates are stored as structured dictionaries with placeholders per channel.

---

## 10. AI Service Architecture

### Provider Abstraction

```
AIService (domain) → AIProvider (interface) → OpenAIProvider / AnthropicProvider
```

Every AI generation is logged to `ai_generations` for cost tracking and audit.

### Prompt Templates

Stored in `domain/ai/prompt_templates.py` — subject-specific templates for homework questions, test questions, and student feedback.

---

## 11. Deployment Architecture

| Component | Service | Scaling |
|---|---|---|
| API Server | FastAPI (UVicorn) on ECS/GKE | Horizontal |
| Workers | Celery on ECS/GKE (spot) | Horizontal (queue depth) |
| Database | Supabase PostgreSQL (Managed) | Vertical + Read replicas |
| Cache | Redis (ElastiCache / Memorystore) | Vertical |
| File Storage | Supabase Storage / S3 | Serverless |
| CI/CD | GitHub Actions | — |

---

## 12. Implementation Steps

### Step 1 — Folder Structure

**Status**: ✅ Complete

Created the complete backend folder structure following a layered architecture: ~115 files across 40 directories covering all layers (API, Domain, Repository, Infrastructure, Workers, Middleware, Common, Tests, Alembic, Scripts).

### Step 2 — Development Environment

**Status**: ✅ Complete

| Task | Detail |
|---|---|
| Python version | 3.14.3 detected |
| Virtual environment | `backend/.venv/` |
| Package manager | pyproject.toml (source of truth) + requirements.txt (pip freeze) |
| Main dependencies | fastapi 0.136.3, uvicorn 0.48.0, sqlalchemy 2.0.50, asyncpg 0.31.0, alembic 1.18.4, pydantic 2.13.4, celery 5.6.3, redis 8.0.0, httpx 0.28.1, supabase-auth 2.30.1, postgrest 2.30.1 |
| Dev dependencies | pytest 9.0.3, pytest-asyncio 1.4.0, pytest-cov 7.1.0, ruff 0.15.15, mypy 2.1.0, pre-commit 4.6.0 |
| Key files | `.env.example`, `.gitignore`, `pyproject.toml`, `requirements.txt` |

**ADR**: The `supabase` meta-package was replaced with `supabase-auth` + `postgrest` because `storage3` pulls in `pyiceberg` (requires C++ build tools on Windows). SQLAlchemy handles DB access.

### Step 3 — Cleanup & Restructuring

**Status**: ✅ Complete

| Action | Detail |
|---|---|
| Created `app/core/` | Core infrastructure package |
| Moved `app/config.py` | → `app/core/config.py` |
| Created `app/core/database.py` | Async engine + session (later productionized in Step 5) |
| Created `app/core/security.py` | SessionContext dataclass + JWT stubs |
| Created `app/api/v1/health.py` | First endpoint — `GET /health` |
| Deleted `app/infrastructure/database.py` | Redundant — `app/core/database.py` is single source of truth |
| Verified no duplicates | `app/tests/`, `app/alembic/`, `app/scripts/` do not exist |

### Step 4 — FastAPI Bootstrap

**Status**: ✅ Complete

**Files created:**
- `app/main.py` — FastAPI app factory with metadata (title, version, description, contact)
- `app/api/v1/router.py` — Aggregates all v1 routers
- `app/core/config.py` — Pydantic BaseSettings (30+ env vars)

**Middleware registered (all in main.py):**
1. CORS middleware — explicit origins (localhost:3000, :5173, app.athonschool.com)
2. Global exception handler — standard error envelope `{data: null, error: {code, message, details}}`
3. Request logging — method + path + status + duration

**Lifespan:** Startup/shutdown hooks via `@asynccontextmanager`

**Run command:**
```bash
cd backend
.venv/Scripts/uvicorn app.main:app --reload
```

### Step 5 — Database Connection Layer

**Status**: ✅ Complete

**Connection verified:**
```
DATABASE_URL=postgresql+asyncpg://postgres:***@db.xxx.supabase.co:5432/postgres
```

**Implementation:**
- `app/core/config.py` — Added `DATABASE_POOL_SIZE` (20), `DATABASE_MAX_OVERFLOW` (10)
- `app/core/database.py` — Production-ready async engine from config, `async_session_factory`, `get_db()` with commit/rollback, `check_db_connection()` running `SELECT 1`
- `app/main.py` — Lifespan validates DB on startup (fail-fast `RuntimeError`), disposes engine on shutdown
- `app/api/v1/health.py` — Added `GET /api/v1/health/database` returning `{status, database}` or `{status, database, error}`

**Startup behavior:** App fails immediately if database is unreachable.

### Step 6 — Alembic Migration Setup

**Status**: ✅ Complete

**Files:**
- `alembic/alembic.ini` — Async PostgreSQL config
- `alembic/env.py` — Async runner using `create_async_engine` + `run_async()`
- `alembic/script.py.mako` — Mako template for new migrations
- `alembic/versions/f65f053e7d10_stamp_initial_schema.py` — Empty migration stamping current DB state

**Verification:**
| Command | Result |
|---|---|
| `alembic current` | `f65f053e7d10 (head)` |
| `alembic history` | `<base> -> f65f053e7d10 (head)` |
| `alembic heads` | `f65f053e7d10 (head)` |

**Migration workflow:**
```bash
# Create migration
.venv/Scripts/alembic -c alembic/alembic.ini revision --autogenerate -m "description"

# Apply
.venv/Scripts/alembic -c alembic/alembic.ini upgrade head

# Rollback
.venv/Scripts/alembic -c alembic/alembic.ini downgrade -1
```

**Naming convention:** `YYYYMMDD_HHMM_short_description` (snake_case)

**Rollback strategy:** Test on staging first, backup before upgrade, never edit applied migrations, create new migration to reverse.

---

## 13. Architecture Decision Records

| Decision | Choice | Rationale |
|---|---|---|
| ORM | SQLAlchemy 2.0 Async | Mature, async-native, Supabase-compatible |
| API Framework | FastAPI | Async-native, type-safe via Pydantic, auto-docs |
| Background Jobs | Celery + Redis | Battle-tested, beat scheduler, retry |
| Auth | Supabase Auth JWT | No password storage; built-in OAuth, MFA |
| File Storage | Supabase Storage / S3 | For report PDFs, student photos |
| Caching | Redis | Session cache, rate limiting, Celery broker |
| AI Providers | Abstracted (OpenAI + Anthropic) | Vendor independence |
| Messaging | Abstracted per-channel | WhatsApp (primary), Email (secondary) |
| Testing | pytest + httpx + testcontainers | Async testing, isolated DB per test |
| Migrations | Alembic | Standard Python migration tool |
| Supabase SDK | `supabase-auth` + `postgrest` (not full `supabase`) | Avoids `pyiceberg` C++ build issue on Windows |
| DB config source | `app.core.config.settings` (not hardcoded) | Single source of truth for all env vars |
