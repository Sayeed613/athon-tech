# Repository Inventory

> Generated: June 9, 2026
> Purpose: Catalog every major folder in the Athon project — what it does, whether it's used, and whether it can be deleted.

---

## `backend/`

| Directory | Purpose | Status | Used? | Can Delete? |
|-----------|---------|--------|-------|-------------|
| `app/api/` | FastAPI route handlers (v1) + schemas + deps | ✅ Active | Yes | No |
| `app/api/v1/` | 25 endpoint modules (auth, homeworks, tests, etc.) | ✅ Active | Yes — router.py aggregates all | No |
| `app/api/schemas/` | Pydantic request/response schemas | ✅ Active | Yes — imported by route handlers | No |
| `app/api/deps/` | FastAPI dependency injection (auth, db session) | ✅ Active | Yes — used by all routes | No |
| `app/core/` | App config, database connection, security utils | ✅ Active | Yes — core infrastructure | No |
| `app/models/` | SQLAlchemy ORM models (31 models) | ✅ Active | Yes — foundation of data layer | No |
| `app/repository/` | Data access layer (28 repository files) | ✅ Active | Yes — used by domain services | No |
| `app/domain/` | Business logic services (13 sub-domains) | ✅ Active | Yes — orchestrates repo calls | No |
| `app/common/` | Shared utilities (exceptions, pagination, permissions) | ✅ Active | Yes — cross-cutting concerns | No |
| `app/infrastructure/` | External service adapters (AI, messaging, PDF, cache, storage) | ✅ Active | Yes | No |
| `app/middleware/` | FastAPI middleware (auth, correlation ID, error handler, logging, session) | ✅ Active | Yes — applied in main.py | No |
| `app/workers/` | Celery background tasks + scheduler | ✅ Active | Yes — async job processing | No |
| `alembic/` | Database migration framework | ✅ Active | Yes — schema versioning | No |
| `tests/` | Test suite (unit, integration, e2e) | 🟡 Minimal | Partial — only conftest.py has content | No |
| `scripts/` | Utility scripts (seed, sync, fix auth) | 🟡 Partial | Yes — used for setup | No |
| `src/athon-backend/` | README+LICENSE (orphaned) | ❌ Deleted | No | ✅ **Deleted** |

## `web/`

| Directory | Purpose | Status | Used? | Can Delete? |
|-----------|---------|--------|-------|-------------|
| `src/app/` | Next.js App Router pages (14 route groups) | ✅ Active | Yes — all page routes | No |
| `src/features/` | Feature-slice architecture (dashboard components only) | 🟡 Partially | Only `dashboard/components/` used | Keep dashboard, rest deleted |
| `src/components/` | Shared UI components (layout, ui, forms, tables, shared) | ✅ Active | Yes — used across pages | No |
| `src/hooks/` | Custom React hooks (auth, theme, toast, online status) | ✅ Active | Yes — used by pages | No |
| `src/services/` | API service layer (18 service files) | ✅ Active | Yes — all routes use these | No |
| `src/types/` | TypeScript type definitions (18 type files) | ✅ Active | Yes — used everywhere | No |
| `src/lib/` | Utility functions (axios, query keys, utils) | ✅ Active | Yes — foundational | No |
| `src/providers/` | React context providers (app, query, theme) | ✅ Active | Yes — wraps the app | No |
| `src/config/` | App configuration | ✅ Active | Yes — used by services | No |
| `src/constants/` | App-wide constants | 🟡 Minimal | Yes — exports | No |

## `docs/`

| Directory | Purpose | Status | Used? | Can Delete? |
|-----------|---------|--------|-------|-------------|
| `BACKEND.md` | Master backend architecture doc | ✅ Active | Source of truth | No |
| `DATABASE.md` | Master database schema doc | ✅ Active | Source of truth | No |
| `FRONTEND.md` | Master frontend architecture doc | ✅ Active | Source of truth | No |
| `PROJECT.md` | Master project overview doc | ✅ Active | Source of truth | No |
| `routes_inventory.md` | Complete API route inventory | ✅ Active | Reference | No |
| `archive/` | Historical audit/planning docs | ✅ Archived | Reference only | No |
| `testing/` | Demo accounts, local setup, build reports | ✅ Active | Onboarding reference | No |

## `database/`

| File | Purpose | Status | Used? | Can Delete? |
|------|---------|--------|-------|-------------|
| `tables.sql` | DDL for all database tables | ✅ Active | Yes — initial schema | No |
| `enums.sql` | ENUM type definitions | ✅ Active | Yes — referenced by tables | No |
| `indexes.sql` | Performance indexes | ✅ Active | Yes — applied after tables | No |
| `rls.sql` | Row-level security policies | ✅ Active | Yes — multi-tenant isolation | No |
| `triggers.sql` | Database triggers (audit, updated_at) | ✅ Active | Yes | No |
| `seed.sql` | Sample data SQL | 🟡 Partial | May be stale vs Python seeds | No |

## `scripts/`

| File | Purpose | Status | Used? | Can Delete? |
|------|---------|--------|-------|-------------|
| `create_demo_user.py` | Create demo user for testing | 🟡 Partial | On-demand | No |
| `fix_auth_users.py` | Fix auth user sync issues | 🟡 Partial | On-demand | No |
| `setup_database.py` | Full database setup script | ✅ Active | Yes — used in setup | No |
| `sync_auth_users.py` | Sync users with Supabase Auth | ✅ Active | Yes — used after seed | No |

## `key/`

| File | Purpose | Status | Used? | Can Delete? |
|------|---------|--------|-------|-------------|
| `acme-ai-platform-123.json` | GCP service account key for AI features | ✅ Active | Yes — AI integration | No |

## Cleaned Up

The following were deleted during this sprint:

| Path | Reason |
|------|--------|
| `backend/nul` | 0-byte artifact |
| `nul` | 0-byte artifact |
| `login` | Artifact file |
| `backend_server.log` | Server log artifact |
| `web.log` | Server log artifact |
| `backend/app/repository/homework_answers.py` | Empty stub file |
| `backend/app/repository/homework_questions.py` | Empty stub file |
| `backend/app/repository/class_enrollments.py` | Duplicate of `class_enrollment_repo.py` (merged) |
| `backend/src/athon-backend/` | Orphaned directory |
| `web/src/components/charts/` | Empty directory |
| `web/src/styles/` | Empty directory |
| `web/src/features/academic/assignments/` | Empty stub directory |
| `web/src/features/academic/classes/` | Empty stub directory |
| `web/src/features/academic/periods/` | Empty stub directory |
| `web/src/features/academic/subjects/` | Empty stub directory |
| `web/src/features/academic/terms/` | Empty stub directory |
| `web/src/features/academic/years/` | Empty stub directory |
| `web/src/features/announcements/` | Empty stub directory |
| `web/src/features/auth/` | Empty stub directory |
| `web/src/features/notifications/` | Empty stub directory |
| `web/src/features/reports/` | Empty stub directory |
| `web/src/features/settings/` | Empty stub directory |
| `web/src/features/timetable/` | Empty stub directory |
