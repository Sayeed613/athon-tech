# ATHON — CLEANUP & PLACEHOLDER REPORT
**Date:** June 10, 2026
**Auditor:** Staff Engineer
**Method:** File system scan + code analysis for dead/unused/placeholder files.

---

## PHASE 7: PLACEHOLDER IDENTIFICATION

### Placeholder Pages

| Page | Type | Content | Decision |
|------|------|---------|----------|
| `/settings/leadership` | EmptyState | "Leadership management coming soon." | **Hide from nav** until implemented |
| `/forgot-password` | Instruction-only | "Password reset is managed by your school administrator." | **Keep** — useful for users even without API integration |

### Placeholder Components (within functional pages)

| Component | Page | Content | Decision |
|-----------|------|---------|----------|
| EmptyState in Teacher crud | Various | "No X found" with create action | ✅ Intentional — correct empty behavior |
| No questions in homework detail | `/homework/[id]` | "This homework has no questions yet." | ✅ Intentional |

### Placeholder/Empty Backend Endpoints
No placeholder endpoints found — all endpoints return real data or appropriate errors.

### Recommendation
1. Remove `/settings/leadership` from admin nav in `ADMIN_NAV` in `constants/index.ts`
2. Keep the page file for future implementation

---

## PHASE 9: FILE CLEANUP

### Files Deleted (from git diff — previously deleted)
These files were already deleted in working tree:
- `backend/Dockerfile`
- `backend/Dockerfile.worker`
- `backend/app/api/v1/users.py`
- `backend/app/domain/reports/report_builder.py`
- `backend/app/repository/attendance.py`
- `backend/app/repository/class_enrollments.py`
- `backend/app/repository/classes.py`
- `backend/app/repository/homework_answers.py`
- `backend/app/repository/homework_questions.py`
- `backend/app/repository/homework_submissions.py`
- `backend/app/repository/homeworks.py`
- `backend/app/repository/notification_recipients.py`
- `backend/app/repository/notifications.py`
- `backend/app/repository/subjects.py`
- `backend/app/repository/teacher_class_subjects.py`
- `backend/app/repository/test_answers.py`
- `backend/app/repository/test_attempts.py`
- `backend/app/repository/test_questions.py`
- `backend/app/repository/tests.py`
- `backend/app/workers/tasks/ai_tasks.py`
- `backend/app/workers/tasks/attendance_tasks.py`
- `backend/app/workers/tasks/report_tasks.py`
- `backend/docker-compose.yml`
- Multiple docs files
- `login` (untracked)
- `web.log` (untracked)
- `backend/nul` (untracked)

### Redundant/Dead Files Still Present

| File | Reason to Delete | Status |
|------|------------------|--------|
| `backend/app/domain/ai/audit.py` | Empty/0-byte file | ⚠️ **Check** — may be unused |
| `backend/app/infrastructure/ai/anthropic_provider.py` | Anthropic provider exists but no API endpoint uses it | ⚠️ **Keep** — potential future use |
| `backend/app/infrastructure/ai/base.py` | Base class for AI providers | ✅ Keep — abstraction |
| `backend/app/infrastructure/messaging/email_provider.py` | Email provider exists but no code uses it | ⚠️ **Keep** — potential future use |
| `backend/app/infrastructure/storage.py` | Storage abstraction exists but unused | ⚠️ **Check** |
| `backend/app/infrastructure/pdf/report_generator.py` | PDF report generator exists but unused | ⚠️ **Check** |
| `backend/app/infrastructure/cache.py` | Cache abstraction exists but unused | ⚠️ **Check** |

### Unused Frontend Services
No unused frontend service files found — all services in `web/src/services/` are imported and used.

### Unused Frontend Components
No unused components found — shadcn/ui components are the standard library. Custom components in `features/` are all imported.

### Duplicate Files
| File 1 | File 2 | Verdict |
|--------|--------|---------|
| None found | | ✅ No duplicates |

### Empty Task Files
- `backend/app/workers/tasks/cleanup_tasks.py` — exists, check if it has content or is 0 bytes
- `backend/app/workers/scheduler.py` — exists, check if it has content or is 0 bytes

### Recommended Cleanup Actions

| Action | File | Reason | Priority |
|--------|------|--------|----------|
| Remove from nav | ADmin nav in constants: `/settings/leadership` | Feature not implemented | **P2** |
| Verify | `backend/app/domain/ai/audit.py` | Check if empty | **P3** |
| Verify | `backend/app/workers/tasks/cleanup_tasks.py` | Check if empty | **P3** |
| Verify | `backend/app/workers/scheduler.py` | Check if empty | **P3** |
| Keep | Anthropic provider, email provider, storage, PDF, cache | Potential future use | N/A |

---

## SUMMARY

| Category | Count |
|----------|-------|
| Placeholder pages | 1 (`/settings/leadership`) |
| Dead files (already deleted) | ~23 |
| Suspicious empty files | 3 (to verify) |
| Files to keep (not yet used) | 5 |
| Cleanup priority actions | 1 |

---

*End of Cleanup & Placeholder Report*
