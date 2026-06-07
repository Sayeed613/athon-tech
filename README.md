# 🏫 Athon — AI-Powered School Management Platform

AI-powered teacher productivity and parent communication platform for schools (Classes 1–10).

**Stack**: Python 3.14 · FastAPI · PostgreSQL 17 (Supabase) · SQLAlchemy 2.0 Async · Supabase Auth · Celery · Redis

---

## Project Status

> **🚀 BACKEND MVP FROZEN — FRONTEND PHASE 1 APPROVED** (June 3, 2026)
> See [`FREEZE.md`](FREEZE.md) for the complete UAT declaration.

| Layer | Status |
|---|---|
| **Database Schema** (29 tables, 11 ENUMs, 76 FKs) | ✅ Deployed & Seeded |
| **Backend API** (FastAPI + Uvicorn) | ✅ **52 routes across 11 modules** |
| **ORM Models** (29 of 29 tables mapped) | ✅ Complete |
| **Authentication** (Supabase JWT + JWKS) | ✅ Login, /me, role-based access |
| **School Context Middleware** | ✅ Complete |
| **Database Connection** (SQLAlchemy 2.0 Async + asyncpg) | ✅ Connected |
| **Migrations** (Alembic async) | ✅ Stamped at head |
| **Timetable Module** (4 endpoints) | ✅ Complete |
| **Attendance Module** (5 endpoints) | ✅ Complete |
| **Homework Module** (6 endpoints) | ✅ Complete |
| **Tests Module** (6 endpoints) | ✅ Complete |
| **Notifications Module** (5 endpoints) | ✅ Complete |
| **Announcements Module** (5 endpoints) | ✅ Complete |
| **Reports Module** (6 endpoints) | ✅ Complete |
| **Dashboard Module** (4 endpoints) | ✅ Complete |
| **Parent Portal** (6 endpoints) | ✅ Complete |
| **Background Jobs** (Celery + Redis) | 📋 Stubs only |
| **AI Services** (OpenAI / Anthropic) | 📋 Stubs only |

---

## Quick Start

### Prerequisites

- Python 3.12+
- A [Supabase](https://supabase.com) project (free tier works)

### Backend Setup

```bash
cd backend

# 1. Create environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Create virtual environment
python -m venv .venv

# 3. Install dependencies
.venv/Scripts/pip install -r requirements.txt

# 4. Initialize database (creates schema + seeds data)
.venv/Scripts/python scripts/setup_database.py

# 5. Start the server
.venv/Scripts/uvicorn app.main:app --reload
```

### Verify

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

# Swagger docs
open http://127.0.0.1:8000/docs
```

---

## Test Accounts

All users share the password: **`Athon2025!`**

| Role | Email | Supabase User ID |
|---|---|---|
| **School Admin** | admin@athondemo.edu | `490ebed2-7450-415d-859b-a999b823d814` |
| **Principal** | principal@athondemo.edu | `89a2a317-3c01-423c-b4e4-3663472f93aa` |
| **Teacher** | teacher@athondemo.edu | `d829a4c6-b598-4ce8-ae4b-4e71af1a0fc4` |
| **Student** | student@athondemo.edu | `16dad9d3-a386-46d4-a313-4892455f2c53` |
| **Parent** | parent@athondemo.edu | `0e16568c-49d0-4fa1-95ab-dd5b4de51b37` |
| **Student 2** | student2@athondemo.edu | `ff2a17f1-b302-4260-b5ea-e3e861b689ee` |

---

## Live API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | ❌ | Service health check |
| `GET` | `/api/v1/health/database` | ❌ | Database connectivity check |
| `POST` | `/api/v1/auth/login` | ❌ | Authenticate with email/password |
| `GET` | `/api/v1/auth/me` | ✅ JWT | Get current user profile |
| `GET` | `/api/v1/auth/context` | ✅ JWT | Get school context (user_id, school_id, role, email) |
| `GET` | `/docs` | ❌ | Swagger UI |
| `GET` | `/redoc` | ❌ | ReDoc UI |

---

## Authentication Architecture

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
  │◄─── LoginResponse {token,      │                               │                    │
  │       user {id, name, email,   │                               │                    │
  │             role, school_id}   │                               │                    │
```

**Key design decisions:**
- **Zero password storage** — All credential verification delegated to Supabase Auth
- **JWKS verification** — JWT signatures verified against Supabase's ES256 public keys (cached, supports key rotation)
- **`supabase_user_id` foreign key** — Links Athon user records to Supabase Auth identities
- **Dependency-based context** — `get_current_context()` populates `request.state` with `{user_id, school_id, role, email}`

---

## Project Structure

```
athon-tech/
├── backend/                        # FastAPI application
│   ├── app/
│   │   ├── main.py                 # App factory (CORS, lifespan, middleware)
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic BaseSettings (30+ env vars)
│   │   │   ├── database.py         # Async SQLAlchemy engine + sessions
│   │   │   └── security.py         # JWT verification via JWKS
│   │   ├── api/
│   │   │   ├── v1/                 # Route files (health, auth)
│   │   │   ├── deps/auth.py        # get_current_user, get_current_context, require_role
│   │   │   └── schemas/            # Pydantic models (auth, context)
│   │   ├── models/                 # ORM models (User, Student, Teacher, etc.)
│   │   ├── domain/                 # 11 bounded contexts (stubs)
│   │   ├── repository/             # 29 repository files (stubs)
│   │   ├── infrastructure/         # AI, messaging, storage (stubs)
│   │   ├── workers/                # Celery tasks (stubs)
│   │   ├── middleware/             # Auth, session, logging (stubs)
│   │   └── common/                 # Exceptions, pagination (stubs)
│   ├── scripts/
│   │   └── setup_database.py       # Schema + seed + Auth ID sync
│   ├── alembic/                    # Async migration config
│   ├── tests/                      # Test suite (stubs)
│   ├── .env                        # Supabase credentials (gitignored)
│   ├── pyproject.toml              # Dependencies
│   └── requirements.txt            # Pinned deps
├── database/
│   ├── enums.sql                   # 11 ENUM types
│   ├── tables.sql                  # 29 tables + 76 FK constraints
│   ├── indexes.sql                 # 41 indexes
│   ├── triggers.sql                # 22 updated_at + 10 audit triggers
│   ├── rls.sql                     # ~90 RLS policies
│   └── seed.sql                    # Demo school data
├── docs/
│   ├── database/database.md        # Full schema docs + ERD
│   └── backend/backend.md          # Full backend architecture docs
├── report.md                       # Detailed implementation report
└── README.md
```

---

## Database Architecture

**29 tables**, **11 ENUM types**, **76 foreign keys**, **~90 RLS policies**

| Module | Tables | Key Entities |
|---|---|---|
| **Tenant** | 1 | schools |
| **Identity** | 6 | users, teachers, principals, parents, students, student_parents |
| **Academic** | 7 | academic_years, academic_terms, classes, subjects, class_enrollments, teacher_class_subjects, periods |
| **Timetable** | 1 | timetable_entries |
| **Attendance** | 1 | attendance |
| **Homework** | 4 | homeworks, homework_questions, homework_submissions, homework_answers |
| **Tests** | 4 | tests, test_questions, test_attempts, test_answers |
| **Reports** | 1 | reports |
| **Notifications** | 2 | notifications, notification_recipients |
| **Audit** | 1 | audit_logs |
| **AI** | 1 | ai_generations |

### Multi-Tenant Design
- Every tenant-scoped table has `school_id UUID NOT NULL`
- RLS policies enforce tenant isolation at the database level
- Session context: `SET app.current_school_id = '<uuid>'`

### Security Model (6 Roles)

| Role | Scope |
|---|---|
| **super_admin** | Platform-wide (bypasses RLS) |
| **school_admin** | Full CRUD within school |
| **principal** | School-wide read, limited write |
| **teacher** | Own assignments, classes, students |
| **student** | Own data only |
| **parent** | Own children's data |

---

## Implementation Status

| Step | Description | Status |
|---|---|---|
| 1 | Folder structure (layered architecture) | ✅ Complete |
| 2 | Development environment (venv, deps) | ✅ Complete |
| 3 | Cleanup & restructuring | ✅ Complete |
| 4 | FastAPI bootstrap (CORS, middleware, lifespan) | ✅ Complete |
| 5 | Database connection (async engine, health check) | ✅ Complete |
| 6 | Alembic migrations (async, stamped at head) | ✅ Complete |
| 7 | ORM models (26 of 29 tables) | ✅ Complete |
| 8A | Auth service (JWT verification via JWKS) | ✅ Complete |
| 8B | Login endpoint (Supabase Auth delegation) | ✅ Complete |
| 8C | User provisioning (6 test users, DB sync) | ✅ Complete |
| 9 | School context middleware (get_current_context) | ✅ Complete |
| 10 | Timetable module | ✅ Complete |
| 11 | Attendance module | ✅ Complete |
| 12 | Homework module | ✅ Complete |
| 13 | Tests module | ✅ Complete |
| 14 | Notifications module | ✅ Complete |
| 15 | Announcements module | ✅ Complete |
| 16 | Reports module | ✅ Complete |
| 17 | Dashboard module | ✅ Complete |
| 18 | Phase 2 audit & report | ✅ Complete |

---

## Bugs Fixed (During Implementation)

| Bug | Cause | Fix |
|---|---|---|
| Enum case mismatch | Python enum names (UPPER) vs DB values (lower) | Added `values_callable` to SAEnum |
| JWKS clock skew | Server clock slightly behind Supabase | Added `leeway=30` to jwt_decode |
| Timezone mismatch | Model used naive datetime, DB used TIMESTAMPTZ | Added `DateTime(timezone=True)` |
| Hardcoded DB password | Setup script had literal password in DSN | Changed to read from settings |

---

## Documentation

| For | Document | Covers |
|---|---|---|
| **Full Report (Frontend Planning)** | [`report.md`](report.md) | Complete backend + database reference for frontend build discussion |
| **Database Schema** | [`docs/database/database.md`](docs/database/database.md) | 29 tables, 11 ENUMs, 76 FKs, ERD, RLS, triggers |
| **Backend Architecture** | [`docs/backend/backend.md`](docs/backend/backend.md) | Architecture, API design, auth flow, all layers |
| **Production Hardening** | [`production_hardening.md`](production_hardening.md) | Security audit, pagination audit, test plan, readiness score |

---

## License

See [LICENSE](LICENSE).
