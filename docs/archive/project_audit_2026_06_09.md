# 🏫 Athon — Full Project Repository Audit

**Date**: June 9, 2026
**Auditors**: Staff Frontend Engineer, Staff Backend Engineer, QA Lead
**Scope**: `backend/`, `web/`, `docs/`, `scripts/`, `database/`

---

## 1. Folder Structure Overview

```
athon-tech/
├── backend/                  # Python 3.12 FastAPI backend (107 API routes)
│   ├── app/
│   │   ├── api/v1/           # 26 route files (25 actual endpoints + router)
│   │   ├── api/schemas/      # 24 Pydantic response/request schemas
│   │   ├── api/deps/         # Auth, pagination, school context deps
│   │   ├── core/             # Config, database, security
│   │   ├── common/           # Exceptions, pagination, permissions
│   │   ├── domain/           # 14 domain service modules (50 files)
│   │   ├── infrastructure/   # AI providers, messaging, storage, PDF
│   │   ├── middleware/       # Auth, correlation, error, logging, session
│   │   ├── models/           # 29 SQLAlchemy ORM models
│   │   ├── repository/       # 44 repo files (many empty duplicates)
│   │   └── workers/          # Celery app + 3 task files (2 populated)
│   ├── alembic/              # 3 migration versions
│   ├── scripts/              # 4 utility scripts
│   ├── src/athon-backend/    # Dead — orphaned package (LICENSE + README only)
│   └── tests/                # Empty — only __init__.py files
├── web/                      # Next.js 16 frontend (51 pages, 44 components)
│   └── src/
│       ├── app/              # 51 page.tsx files across all routes
│       ├── components/       # 44 shared components
│       ├── services/         # 18 API service modules
│       ├── types/            # 17 type definition files
│       ├── hooks/            # 7 custom hooks
│       └── features/         # Dashboard feature components
├── database/                 # 6 SQL files (enums, tables, indexes, triggers, RLS, seed)
├── docs/                     # Existing documentation
└── scripts/                  # Seed + utility scripts
```

---

## 2. Dead Files

### 2.1 Empty Duplicate Repository Files (12 files)

These files are **completely empty** (0 bytes or blank). Their `_repo` counterparts contain the actual implementation.

| File | Size | Real Implementation |
|------|------|-------------------|
| `backend/app/repository/classes.py` | 0 bytes | `class_repo.py` |
| `backend/app/repository/attendance.py` | 0 bytes | `attendance_repo.py` |
| `backend/app/repository/homeworks.py` | 0 bytes | `homework_repo.py` |
| `backend/app/repository/notifications.py` | 0 bytes | `notification_repo.py` |
| `backend/app/repository/subjects.py` | 0 bytes | `subject_repo.py` |
| `backend/app/repository/tests.py` | 0 bytes | `test_repo.py` |
| `backend/app/repository/homework_submissions.py` | 0 bytes | `homework_submission_repo.py` |
| `backend/app/repository/notification_recipients.py` | 0 bytes | `notification_recipient_repo.py` |
| `backend/app/repository/teacher_class_subjects.py` | 0 bytes | `teacher_class_subject_repo.py` |
| `backend/app/repository/test_attempts.py` | 0 bytes | `test_attempt_repo.py` |
| `backend/app/repository/test_answers.py` | 0 bytes | (no _repo counterpart) |
| `backend/app/repository/test_questions.py` | 0 bytes | (no _repo counterpart) |

### 2.2 Empty API File

| File | Size | Notes |
|------|------|-------|
| `backend/app/api/v1/users.py` | 0 bytes | Users route never implemented (not registered in router.py) |

### 2.3 Files Deleted in Previous Sprint (Already Removed)

These 4 files were 0-byte stubs that are already deleted in the working tree:

- `backend/app/domain/reports/report_builder.py` (was 0 bytes)
- `backend/app/workers/tasks/ai_tasks.py` (was 0 bytes)
- `backend/app/workers/tasks/attendance_tasks.py` (was 0 bytes)
- `backend/app/workers/tasks/report_tasks.py` (was 0 bytes)

### 2.4 Artifact/Nuisance Files

| File | Source | Action |
|------|--------|--------|
| `backend/nul` | Command output artifact | Remove |
| `nul` | Command output artifact | Remove |
| `login` | Command artifact | Remove |

### 2.5 Empty Docker & Deployment Files

| File | Size | Notes |
|------|------|-------|
| `backend/docker-compose.yml` | 0 bytes | Never populated |
| `backend/Dockerfile` | 0 bytes | Never populated |
| `backend/Dockerfile.worker` | 0 bytes | Never populated |

### 2.6 Orphaned Source Directory

| Path | Contents | Action |
|------|----------|--------|
| `backend/src/athon-backend/` | LICENSE + README.md only | Dead — not imported by any code. Remove. |

---

## 3. Duplicate Files

### 3.1 Functional Duplicate Repositories

These two repository pairs both have **actual code** implementing the same entity:

| Empty Duplicate | Has Code Counterpart | Assessment |
|-----------------|---------------------|------------|
| `backend/app/repository/class_enrollments.py` (HAS CODE) | `class_enrollment_repo.py` (HAS CODE) | **Duplicate** — both have different implementations for `ClassEnrollment` |
| `backend/app/repository/__init__.py` | N/A | Empty init file — harmless |

The `class_enrollments.py` and `class_enrollment_repo.py` both define `ClassEnrollmentRepository` with different method sets. The former is imported directly by `app/api/v1/students.py`. This could cause confusion.

### 3.2 Service Files with Redundant __init__.py

Most `__init__.py` files in domain directories are empty. This is standard Python practice — they're directory markers, not duplicates.

---

## 4. Unused Files

### 4.1 Unused Components

The following feature components under `web/src/features/dashboard/components/` should be checked for import usage — they may be unused if the dashboard page uses inline equivalents:

| Component | Likely Used? |
|-----------|-------------|
| `announcements-widget.tsx` | ✅ Used by dashboard |
| `dashboard-widget.tsx` | ✅ Used by dashboard |
| `kpi-card.tsx` | ✅ Used by dashboard |
| `quick-action-card.tsx` | ✅ Used by dashboard |
| `recent-students-widget.tsx` | ✅ Used by dashboard |
| `recent-teachers-widget.tsx` | ✅ Used by dashboard |
| `system-status.tsx` | ✅ Used by dashboard |

### 4.2 Unused Services

All 18 services in `web/src/services/` are registered and used across the frontend pages. No unused services found.

### 4.3 Unused Pages

All 51 `page.tsx` files appear to be reachable through the navigation structure. No orphan pages detected.

### 4.4 Empty Test Files

| File | Size | Notes |
|------|------|-------|
| `backend/tests/conftest.py` | ~0 bytes | No test configuration |
| `backend/tests/e2e/__init__.py` | 0 bytes | Empty |
| `backend/tests/integration/__init__.py` | 0 bytes | Empty |
| `backend/tests/unit/__init__.py` | 0 bytes | Empty |
| `backend/tests/unit/domain/__init__.py` | 0 bytes | Empty |
| `backend/tests/unit/repository/__init__.py` | 0 bytes | Empty |

**Assessment**: The entire test suite is stubs only. **0 tests exist.**

### 4.5 Unused Schemas

The `backend/app/api/schemas/` directory has 24 files. All are referenced by their corresponding API route modules. No unused schemas.

---

## 5. Cleanup Recommendations

### P0 — Must Fix (Before Production)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Delete 12 empty repository stub files | 5 min | Removes dead file clutter |
| 2 | Delete `backend/src/athon-backend/` | 2 min | Orphaned directory |
| 3 | Delete `backend/nul`, `nul`, `login` | 1 min | Artifact files |
| 4 | Delete empty Docker files or populate them | 5 min | Never used |
| 5 | Consolidate `class_enrollments.py` vs `class_enrollment_repo.py` | 30 min | Eliminates repository confusion |

### P1 — Should Fix (Before Beta)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 6 | Write actual tests (unit + integration) | 5-10 days | 0% test coverage currently |
| 7 | Implement `backend/app/api/v1/users.py` or remove it | 15 min | Dead route file |
| 8 | Populate `backend/docker-compose.yml` | 1 day | Required for containerized deployment |

### P2 — Nice to Have

| # | Item | Effort |
|---|------|--------|
| 9 | Audit unused imports across all Python/TS files | 2 days |
| 10 | Consolidate duplicate repository implementations | 1 day |
| 11 | Standardize `__init__.py` content across packages | 30 min |

---

## 6. Technical Debt List

### Architecture Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-1 | Mixed naming convention: `_repo` vs bare name | Medium | Repos like `classes.py` (empty) vs `class_repo.py` (filled) |
| TD-2 | Two ClassEnrollmentRepository implementations | High | `class_enrollments.py` and `class_enrollment_repo.py` both have code |
| TD-3 | No pagination wired into list endpoints | Medium | Infrastructure exists but not connected |
| TD-4 | Inconsistent response wrappers | Low | Some endpoints use `{items, total}`, others return bare objects |

### Testing Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-5 | Zero test coverage | Critical | No unit, integration, or E2E tests |
| TD-6 | Empty test directories | Low | Structure exists, no content |
| TD-7 | No test fixtures or factories | High | No reusable test data setup |

### DevOps Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-8 | No Docker Compose configuration | High | 3 empty Docker files |
| TD-9 | No CI/CD configuration | High | No GitHub Actions or similar |
| TD-10 | No Alembic migration history cleanup | Low | 3 migration files, may need squashing |

### Frontend Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-11 | Feature components in `web/src/features/` are tightly coupled to dashboard | Low | Could be extracted |
| TD-12 | No unit tests for React components | High | 0% frontend test coverage |
| TD-13 | Hardcoded CORS origins in `main.py` | Medium | Should come from config |

### Backend Debt

| # | Item | Severity | Notes |
|---|------|----------|-------|
| TD-14 | `_get_teacher_today_schedule` uses undefined `day_name` variable | **BUG** | Variable named `day_name` on line ~110 but `day_of_week` on line ~104 |
| TD-15 | `get_teacher_class_ids` fetches all records in some services | Medium | Performance issue |
| TD-16 | String enum comparisons (`["submitted", "pending"]`) | Low | Should use Python enum values |
| TD-17 | No rate limiting | Medium | API is unprotected against abuse |
| TD-18 | Celery workers configured but only 1 of 3 task files has content | Medium | `cleanup_tasks.py` and notification infrastructure |

---

## 7. Database Health

| Table | Status | Records |
|-------|--------|---------|
| schools | ✅ | 1 |
| users | ✅ | 112 |
| teachers | ✅ | 10 |
| students | ✅ | 50 |
| parents | ✅ | 50 |
| principals | ✅ | 1 |
| classes | ✅ | 8 |
| subjects | ✅ | 8 |
| academic_years | ✅ | 1 |
| academic_terms | ✅ | 1 |
| periods | ✅ | 8 |
| attendance | ✅ | ~250 |
| homeworks | ✅ | 8 |
| homework_submissions | ✅ | ~200 |
| tests | ✅ | 6 |
| test_attempts | ✅ | ~120 |
| timetable_entries | ✅ | 40 |
| announcements | ✅ | 0 (table exists, no records) |
| notifications | ✅ | 0 |

All 29 tables present. Seed data is comprehensive (112 users across all roles).

---

## 8. Critical Bug Found During Audit

### TD-14: `day_name` Undefined Variable in `dashboard_service.py`

**File**: `backend/app/domain/dashboard/dashboard_service.py`
**Line**: ~120 (inside `_get_teacher_today_schedule`)
**Issue**: Variable `day_of_week` is computed but the query references `day_name` (undefined):

```python
py_day = date.today().weekday()  # Monday=0, Sunday=6
if py_day == 6:
    day_of_week = 1
else:
    day_of_week = py_day + 1

result = await self.db.execute(
    ...
    .where(
        TimetableEntry.day_of_week == day_name,  # ❌ day_name is not defined!
        ...
    )
```

The same bug exists in `_get_student_today_timetable` method (~line 280).
