# 🏫 Athon — AI-Powered School Management Platform

AI-powered teacher productivity and parent communication platform for schools.

**Stack**: FastAPI · PostgreSQL (Supabase) · SQLAlchemy 2.0 Async · Celery · Redis

---

## Project Overview

| Layer | Technology | Status |
|---|---|---|
| **Database** | PostgreSQL 16 (27 tables, 11 ENUMs, 69 FKs) | ✅ Schema Deployed |
| **Backend API** | FastAPI + Uvicorn | ✅ Running on :8000 |
| **Database Connection** | SQLAlchemy 2.0 Async + asyncpg | ✅ Connected |
| **Migrations** | Alembic (async) | ✅ Stamped at head |
| **Auth** | Supabase Auth + JWT | 📋 Planned |
| **Background Jobs** | Celery + Redis | 📋 Configured |
| **AI Services** | OpenAI / Anthropic | 📋 Configured |

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

# 2. Create virtual environment (one time)
python -m venv .venv

# 3. Install dependencies
.venv/Scripts/pip install -e ".[dev]"

# 4. Start the server
.venv/Scripts/uvicorn app.main:app --reload
```

### Database Setup

Run the SQL files in order via Supabase SQL Editor or psql:

```bash
psql "$DATABASE_URL" \
  -f database/enums.sql \
  -f database/tables.sql \
  -f database/indexes.sql \
  -f database/triggers.sql \
  -f database/rls.sql \
  -f database/seed.sql
```

### Verify

```bash
# Server health
curl http://127.0.0.1:8000/api/v1/health
# → {"status":"healthy","service":"athon-backend","version":"0.1.0"}

# Database connectivity
curl http://127.0.0.1:8000/api/v1/health/database
# → {"status":"healthy","database":"connected"}

# Swagger docs
start http://127.0.0.1:8000/docs  # Windows
# open http://127.0.0.1:8000/docs  # macOS
```

---

## Project Structure

```
athon-tech/
├── backend/                    # FastAPI application (+185 files)
│   ├── app/
│   │   ├── main.py             # App factory (CORS, middleware, lifespan)
│   │   ├── core/               # Config, database engine, security
│   │   ├── api/v1/             # 17 route files + schemas + deps
│   │   ├── domain/             # 11 bounded contexts
│   │   ├── repository/         # 29 files (base + unit_of_work + 27 repos)
│   │   ├── infrastructure/     # AI, messaging, PDF providers
│   │   ├── workers/            # Celery tasks + scheduler
│   │   ├── middleware/         # Auth, session, logging, error handler
│   │   └── common/             # Exceptions, pagination, permissions
│   ├── alembic/                # Async migrations (stamped at head)
│   ├── tests/                  # Unit, integration, e2e
│   ├── pyproject.toml          # Dependencies (source of truth)
│   └── requirements.txt        # Pinned deps (generated)
│
├── database/                   # PostgreSQL schema
│   ├── enums.sql               # 11 ENUM types + extensions
│   ├── tables.sql              # 27 tables + 69 FK constraints
│   ├── indexes.sql             # 36 indexes (partial, composite)
│   ├── triggers.sql            # 20 updated_at + 9 audit triggers
│   ├── rls.sql                 # RLS policies (~80) + helper functions
│   └── seed.sql                # Demo data (7 users, 2 classes)
│
├── docs/
│   ├── database/database.md    # Full schema docs + ERD diagram
│   └── backend/backend.md      # Full backend docs + implementation steps
│
├── LICENSE
└── README.md
```

---

## Documentation

| For | Document | Covers |
|---|---|---|
| **Database Schema** | [`docs/database/database.md`](docs/database/database.md) | 27 tables, 11 ENUMs, 69 FKs, ERD, RLS, triggers, seed data, naming conventions |
| **Backend Architecture** | [`docs/backend/backend.md`](docs/backend/backend.md) | Architecture, folder structure, API design, auth flow, service/repository layers, background jobs, notifications, AI services, deployment, all 6 implementation steps, ADRs |

---

## Implementation Status

| Step | Description | Status |
|---|---|---|
| 1 | Folder structure (layered architecture, ~185 files) | ✅ Complete |
| 2 | Development environment (venv, deps, config) | ✅ Complete |
| 3 | Cleanup & restructuring (app/core/, health endpoint) | ✅ Complete |
| 4 | FastAPI bootstrap (app factory, CORS, middleware) | ✅ Complete |
| 5 | Database connection (async engine, health check, fail-fast startup) | ✅ Complete |
| 6 | Alembic migrations (async, stamped at head, workflow docs) | ✅ Complete |
| 7 | ORM models | 📋 Next |
| 8 | Auth endpoints | 📋 Planned |
| 9 | Schools CRUD | 📋 Planned |

---

## Current Live Endpoints

| Endpoint | Method | Response |
|---|---|---|
| `/api/v1/health` | GET | `{"status":"healthy","service":"athon-backend","version":"0.1.0"}` |
| `/api/v1/health/database` | GET | `{"status":"healthy","database":"connected"}` |
| `/docs` | GET | Swagger UI |
| `/redoc` | GET | ReDoc UI |
| `/openapi.json` | GET | OpenAPI spec |

---

## Architecture Highlights

### Multi-Tenant Design
- Every tenant-scoped table includes `school_id UUID NOT NULL`
- RLS policies enforce isolation at the database level
- Session context set by middleware: `app.current_school_id`, `app.current_user_id`, `app.current_user_role`

### Security Model (6 Roles)
| Role | Scope |
|---|---|
| **super_admin** | Platform-wide (bypasses RLS) |
| **school_admin** | Full CRUD within school |
| **principal** | School-wide read, limited write |
| **teacher** | Own assignments, classes, students |
| **student** | Own data only |
| **parent** | Own children's data |

### Key Design Decisions
| Decision | Choice |
|---|---|
| **ORM** | SQLAlchemy 2.0 Async (not supabase-py sync client) |
| **DB config** | `app.core.config.settings` (not hardcoded) |
| **Startup** | Fail-fast if database unreachable |
| **Migrations** | Alembic async with NullPool for short-lived connections |
| **Supabase SDK** | `supabase-auth` + `postgrest` (avoids `pyiceberg` C++ build issue) |

---

## File Reference

| File | Idempotent | Notes |
|---|---|---|
| `database/enums.sql` | ✅ Yes | `DO $$` handles duplicates |
| `database/tables.sql` | ❌ No | Run once |
| `database/indexes.sql` | ❌ No | Run once |
| `database/triggers.sql` | ✅ Yes | `DROP IF EXISTS` + `CREATE OR REPLACE` |
| `database/rls.sql` | ❌ Partial | Policies don't auto-drop |
| `database/seed.sql` | ❌ No | Fixed UUIDs conflict on re-run |

---

## License

See [LICENSE](LICENSE).
