# ATHON — BUG REGISTER
**Date:** June 10, 2026
**Auditor:** QA Lead
**Method:** Static code analysis + workflow trace. Each bug includes reproduction steps and root cause.

---

## CRITICAL (P0)

### BUG-001: Parent Dashboard Returns 403
| Field | Value |
|-------|-------|
| **Page** | `/dashboard` (Parent role) |
| **Severity** | **P0 — Critical** |
| **Issue** | Parent dashboard calls `GET /dashboard/admin` which requires `school_admin` or `super_admin` role → returns 403 |
| **Root Cause** | In `web/src/app/dashboard/page.tsx`, `ParentDashboard` function uses `dashboardService.getAdminDashboard()` instead of a parent-specific endpoint |
| **Fix** | Create backend endpoint `GET /dashboard/parent` or use principal endpoint; modify frontend to call correct endpoint |
| **Reproduction** | 1. Login as parent account 2. Observe dashboard showing "Failed to load dashboard" |

---

## HIGH (P1)

### BUG-002: No Parent-Specific Dashboard Endpoint
| Field | Value |
|-------|-------|
| **Page** | Backend: `GET /dashboard/` |
| **Severity** | **P1 — High** |
| **Issue** | No `GET /dashboard/parent` endpoint exists. The 4 dashboards (admin, teacher, student, principal) have endpoints but parent does not. |
| **Root Cause** | Dashboard API was built for 4 roles but the product has 5 roles |
| **Fix** | Create parent dashboard endpoint returning child attendance, homework due for linked students |

### BUG-003: Homework Subject Filter Uses All Subjects Instead of Class-Assigned
| Field | Value |
|-------|-------|
| **Page** | `/homework/create` |
| **Severity** | **P1 — High** |
| **Issue** | Subject dropdown shows ALL subjects in the school, not just subjects assigned to the selected class |
| **Root Cause** | The subject filter in homework create page was fixed to use teacher assignments, but the test create page still shows ALL subjects regardless of class |
| **Fix** | Add teacher-assignment-based filtering to test create page subject selector |
| **Note** | Actually this is partially addressed: homework create now filters by assignments. Test create needs the same fix. |
| **Reproduction** | 1. Go to /tests/create 2. Select a class 3. Subject dropdown shows all subjects, not just assigned ones |

### BUG-004: No Timetable-Based Class Filtering for Tests Create
| Field | Value |
|-------|-------|
| **Page** | `/tests/create` |
| **Severity** | **P1 — High** |
| **Issue** | Teacher can create a test for any class, even classes they don't teach. Backend blocks this with 403 at API level, but UI doesn't prevent it. |
| **Root Cause** | Test create page doesn't filter classes by teacher timetable |
| **Fix** | Apply same class filtering pattern as attendance mark page |
| **Reproduction** | 1. Login as teacher 2. Create test for a class teacher doesn't teach 3. See 403 after submit |

---

## MEDIUM (P2)

### BUG-005: Test Edit Page Subject/Class Read-Only With No Filtering
| Field | Value |
|-------|-------|
| **Page** | `/tests/[id]/edit` |
| **Severity** | **P2 — Medium** |
| **Issue** | Test edit page does not allow changing class or subject. The edit form only allows changing title, description, marks, etc. |
| **Root Cause** | The `UpdateTestRequest` schema doesn't include `class_id` or `subject_id` fields |
| **Fix** | Not necessarily a bug — intentional design. Class/subject are set at creation. Document as limitation. |

### BUG-006: Homework Edit Page Not Accessible From Detail
| Field | Value |
|-------|-------|
| **Page** | `/homework/[id]` |
| **Severity** | **P2 — Medium** |
| **Issue** | Homework detail page does not have an "Edit" button for teachers (unlike tests page which has one). |
| **Root Cause** | `TeacherHomeworkView` does not include edit navigation |
| **Fix** | Add "Edit" button in PageHeader actions |

### BUG-007: Timer Not Synced With Server
| Field | Value |
|-------|-------|
| **Page** | `/tests/[id]` (StudentTestView) |
| **Severity** | **P2 — Medium** |
| **Issue** | Test timer starts from client-side `useEffect` when component mounts, not from the server's `started_at` timestamp. Refreshing the page resets the timer. |
| **Root Cause** | Timer uses local state `timeRemaining` initialized from `duration_minutes`, not from server attempt's `started_at` time |
| **Fix** | Calculate remaining time from `attempt.started_at + duration_minutes - now` instead of local state |

### BUG-008: No Auto-Submit on Timer Expiry
| Field | Value |
|-------|-------|
| **Page** | `/tests/[id]` |
| **Severity** | **P2 — Medium** |
| **Issue** | When test timer reaches 0, student can continue answering and submit late. The UI shows "0m 0s" but doesn't block or auto-submit. |
| **Root Cause** | No timer expiry handler — `timeRemaining` just stops at 0 |
| **Fix** | Add auto-submit or block submission form when timer hits 0 |

### BUG-009: Attendance Mark Page Shows No Classes If No Timetable
| Field | Value |
|-------|-------|
| **Page** | `/attendance/mark` |
| **Severity** | **P2 — Medium** |
| **Issue** | Teacher's class list is filtered by timetable entries. If no timetable exists for the teacher, `visibleClasses` falls back to ALL classes (correct fallback), but teacher may be confused why they see all classes. |
| **Root Cause** | Backend `GET /timetable/teacher/{id}` returns empty array when no timetable exists |
| **Fix** | Add a banner: "No timetable found. Showing all classes. Create a timetable for filtered view." |

### BUG-010: Teacher Timetable API Uses user ID, Not Teacher ID
| Field | Value |
|-------|-------|
| **Page** | `/attendance/mark` |
| **Severity** | **P2 — Medium** |
| **Issue** | `timetableService.getByTeacher(user?.id ?? '')` passes the user's Auth ID (from useAuthStore), but the backend `GET /timetable/teacher/{teacher_id}` expects a Teacher record ID, not a User record ID. These are different UUIDs. |
| **Root Cause** | Auth store stores the User model ID, but timetable endpoint resolves by Teacher ID |
| **Fix** | Check backend endpoint — if it resolves teacher ID from user session, then it works. Otherwise need to resolve teacher ID first. |
| **Note** | Looking at backend: `GET /timetable/teacher/me` exists and uses the authenticated user. But the frontend calls `GET /timetable/teacher/{id}` with user's auth ID. This may not match the teacher record ID. |

---

## LOW (P3)

### BUG-011: Forgot Password Has No Backend Integration
| Field | Value |
|-------|-------|
| **Page** | `/forgot-password` |
| **Severity** | **P3 — Low** |
| **Issue** | Forgot password page simulates sending an email but doesn't call any API. Shows "Password reset emails are not yet available." |
| **Root Cause** | No backend endpoint for password reset |
| **Fix** | Integrate with Supabase Auth password reset API when available |

### BUG-012: Settings Page City/State/ZIP Fields Lack Validation
| Field | Value |
|-------|-------|
| **Page** | `/settings` |
| **Severity** | **P3 — Low** |
| **Issue** | City, state, and ZIP fields are plain text inputs with no validation |
| **Root Cause** | No schema validation on these fields |
| **Fix** | Add basic validation (e.g., ZIP code format) |

### BUG-013: No "Total Parents" Dashboard KPI
| Field | Value |
|-------|-------|
| **Page** | `/dashboard` (Admin) |
| **Severity** | **P3 — Low** |
| **Issue** | Admin dashboard shows student count, teacher count, class count, but no parent count |
| **Root Cause** | Not in scope / backend doesn't expose parent count |
| **Fix** | Add parent count to AdminDashboardResponse and KPI cards |

### BUG-014: Announcement Creation Missing Validation for Specific Classes
| Field | Value |
|-------|-------|
| **Page** | `/announcements` |
| **Severity** | **P3 — Low** |
| **Issue** | When creating an announcement with audience "Specific Classes", only one class can be selected at a time using a single-select dropdown |
| **Root Cause** | UI uses single `Select` component instead of multi-select |
| **Fix** | Upgrade to multi-select or checkboxes |

### BUG-015: Leadership Page Is Empty Placeholder
| Field | Value |
|-------|-------|
| **Page** | `/settings/leadership` |
| **Severity** | **P3 — Low** |
| **Issue** | Shows EmptyState: "Leadership management coming soon." No functionality. |
| **Root Cause** | Feature not yet implemented |
| **Fix** | Either implement or remove from navigation |

### BUG-016: No Test Question Management UI
| Field | Value |
|-------|-------|
| **Page** | `/tests/[id]` |
| **Severity** | **P3 — Low** |
| **Issue** | Unlike homework detail which has a full question editor, test detail has no question management. No way to add/edit/reorder test questions. |
| **Root Cause** | Test question endpoints not implemented in frontend |
| **Fix** | Add question management tab (similar to homework) |

---

## BUG SUMMARY BY SEVERITY

| Severity | Count | Priority |
|----------|-------|----------|
| **P0 — Critical** | 1 | Fix immediately |
| **P1 — High** | 3 | Fix this sprint |
| **P2 — Medium** | 6 | Fix next sprint |
| **P3 — Low** | 6 | Fix when time permits |
| **Total** | **16** | |

## TOP 5 BUGS TO FIX FIRST

1. **BUG-001**: Parent dashboard 403 — blocks parent usage entirely
2. **BUG-003**: Test create subject filter shows all subjects
3. **BUG-004**: Test create class filter not limited by teacher assignments
4. **BUG-007**: Timer not synced with server
5. **BUG-010**: Teacher timetable API uses wrong ID type

---

*End of Bug Register*
