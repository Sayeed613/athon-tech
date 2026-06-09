# ATHON — ROUTE AUDIT REPORT
**Date:** June 10, 2026
**Auditor:** Staff Frontend Engineer
**Method:** Cross-reference route registry from constants, page files, and backend endpoints.

---

## ROUTE INVENTORY

Legend:
- ✅ Working — loads data, no errors
- ⚠️ Partial — loads but has issues
- ❌ Broken — does not work / crashes
- 📄 Placeholder — shows EmptyState only

---

## ADMIN ROUTES (super_admin / school_admin)

| Route | Role Access | Status | Notes |
|-------|------------|--------|-------|
| `/` | All | ✅ | Redirects to `/dashboard` |
| `/login` | Public | ✅ | |
| `/forgot-password` | Public | ✅ | Static page, no backend integration |
| `/dashboard` | All | ✅ | Role-aware branching |
| `/users/teachers` | admin | ✅ | Full CRUD |
| `/users/teachers/create` | admin | ✅ | |
| `/users/teachers/[id]` | admin | ✅ | |
| `/users/teachers/[id]/edit` | admin | ✅ | |
| `/users/students` | admin | ✅ | Full CRUD |
| `/users/students/create` | admin | ✅ | |
| `/users/students/import` | admin | ✅ | |
| `/users/students/[id]` | admin | ✅ | |
| `/users/students/[id]/edit` | admin | ✅ | |
| `/users/parents` | admin | ✅ | Full CRUD |
| `/users/parents/create` | admin | ✅ | |
| `/users/parents/[id]` | admin | ✅ | |
| `/users/parents/[id]/edit` | admin | ✅ | |
| `/academic/classes` | admin, principal | ✅ | |
| `/academic/classes/create` | admin | ✅ | |
| `/academic/classes/[id]` | admin, principal | ✅ | |
| `/academic/classes/[id]/edit` | admin | ✅ | |
| `/academic/subjects` | admin, principal | ✅ | |
| `/academic/subjects/create` | admin | ✅ | |
| `/academic/subjects/[id]` | admin, principal | ✅ | |
| `/academic/subjects/[id]/edit` | admin | ✅ | |
| `/academic/years` | admin, principal | ✅ | |
| `/academic/years/create` | admin | ✅ | |
| `/academic/years/[id]` | admin, principal | ✅ | |
| `/academic/years/[id]/edit` | admin | ✅ | |
| `/academic/periods` | admin, principal | ✅ | Period slots |
| `/academic/assignments` | admin, principal | ✅ | |
| `/academic/assignments/create` | admin | ✅ | |
| `/academic/assignments/[id]` | admin, principal | ✅ | |
| `/timetable` | admin, principal, teacher | ✅ | |
| `/attendance` | All | ✅ | |
| `/attendance/mark` | teacher | ✅ | Redirects non-teachers |
| `/attendance/class/[id]` | admin, principal, teacher | ✅ | |
| `/attendance/student/[id]` | admin, principal, teacher | ✅ | |
| `/homework` | All | ✅ | Role-aware |
| `/homework/create` | teacher | ✅ | Redirects non-teachers |
| `/homework/[id]` | All | ✅ | Role-aware |
| `/homework/[id]/edit` | teacher | ✅ | |
| `/tests` | All | ✅ | Role-aware |
| `/tests/create` | teacher | ✅ | |
| `/tests/[id]` | All | ✅ | Role-aware |
| `/tests/[id]/edit` | teacher | ✅ | |
| `/tests/[id]/results` | teacher | ✅ | |
| `/announcements` | All | ✅ | Role-aware CRUD |
| `/notifications` | All | ✅ | |
| `/reports` | All | ✅ | Data-rich, CSV export |
| `/settings` | admin | ✅ | School profile editor |
| `/settings/leadership` | admin | 📄 | **Placeholder** — EmptyState only |

---

## PRINCIPAL ROUTES

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | ✅ | Principal-specific dashboard |
| `/timetable` | ✅ | Read-only |
| `/attendance` | ✅ | View-only |
| `/homework` | ✅ | Published only |
| `/tests` | ✅ | Published only |
| `/announcements` | ✅ | Can create |
| `/notifications` | ✅ | |
| `/reports` | ✅ | |

---

## TEACHER ROUTES

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | ✅ | Teacher-specific |
| `/timetable` | ✅ | |
| `/attendance` | ✅ | |
| `/attendance/mark` | ✅ | Mobile-friendly |
| `/attendance/class/[id]` | ✅ | |
| `/homework` | ✅ | Class selector + homework list |
| `/homework/create` | ✅ | With AI generation |
| `/homework/[id]` | ✅ | Submissions + grading + question editor |
| `/tests` | ✅ | |
| `/tests/create` | ✅ | |
| `/tests/[id]` | ✅ | Attempts view |
| `/announcements` | ✅ | Can create class-specific |
| `/notifications` | ✅ | |
| `/reports` | ✅ | |

---

## STUDENT ROUTES

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | ✅ | Student-specific |
| `/homework` | ✅ | My Homework (no class selector) |
| `/homework/[id]` | ✅ | Questions + submit + results |
| `/tests` | ✅ | My Tests |
| `/tests/[id]` | ✅ | Start test + timer + questions + submit |
| `/announcements` | ✅ | Read-only |
| `/notifications` | ✅ | |
| `/reports` | ✅ | |

---

## PARENT ROUTES

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | ❌ **P0** | Calls admin endpoint → 403 |
| `/attendance` | ✅ | View child attendance |
| `/homework` | ✅ | Published homework only |
| `/tests` | ✅ | Published tests only |
| `/announcements` | ✅ | Read-only |
| `/notifications` | ✅ | |
| `/reports` | ✅ | |

---

## FLAGGED ISSUES

### P0 — Critical
| Route | Issue | Role |
|-------|-------|------|
| `/dashboard` | Calls `GET /dashboard/admin` → 403 for parent role | parent |

### P1 — High
| Route | Issue | Role |
|-------|-------|------|
| `/settings/leadership` | **Placeholder** — no functionality, shows EmptyState | admin |

### P2 — Medium
| Route | Issue | Role |
|-------|-------|------|
| `/timetable` | Teacher timetable depends on `/timetable/teacher/{id}` — may return empty if no timetable created | teacher |
| `/homework` | If no class selected, auto-selects first class. If no classes exist, dropdown is empty | admin |

### P3 — Low
| Route | Issue | Role |
|-------|-------|------|
| `/forgot-password` | No backend integration — static instructional page only | public |
| Tests results page at `/tests/[id]/results` | Exists but minimal — shows attempts list without grade input | teacher |

---

## ROUTE ACCESS CONTROL SUMMARY

Route guard defined in `web/src/constants/index.ts` `ROUTE_ROLES`:
- **51 routes** have role restrictions defined
- Routes without explicit role entries are blocked by default (Next.js middleware or client-side redirect)
- The `AdminLayout` wrapper is used on all authenticated pages

**Verdict:** Route access control is correctly implemented for all roles. No unauthorized access paths found.

---

*End of Route Audit Report*
