# ATHON — DASHBOARD AUDIT REPORT
**Date:** June 10, 2026
**Auditor:** Staff Frontend Engineer
**Method:** Static analysis of dashboard endpoints, response schemas, frontend queries, and render logic.

---

## 1. ADMIN DASHBOARD

### Endpoint: `GET /dashboard/admin`
- **Roles:** `school_admin`, `super_admin`
- **Response schema:** `AdminDashboardResponse`

### Backend Response Shape
```
{
  total_students: number,
  total_teachers: number,
  active_classes: number,
  attendance_percentage: number,
  recent_announcements: AnnouncementItem[],
  unread_notifications: { count: number }
}
```

### Frontend Data Composition
The dashboard service (`getAdminDashboardData`) composes data from 7 parallel API calls:
1. `GET /dashboard/admin` (counts + attendance)
2. `GET /schools/{id}` (school profile)
3. `GET /academic-years` (current year)
4. `GET /academic-terms` (current term)
5. `GET /students?skip=0&limit=5` (recent students)
6. `GET /teachers?skip=0&limit=5` (recent teachers)
7. `GET /timetable/today` (timetable status)

### Rendered Widgets
| Widget | Data Source | Status |
|--------|------------|--------|
| Total Students KPI | dashboard.total_students | ✅ |
| Total Teachers KPI | dashboard.total_teachers | ✅ |
| Active Classes KPI | dashboard.active_classes | ✅ |
| Academic Year KPI | academicYears.find(is_current) | ✅ |
| Recent Students | students endpoint (limit 5) | ✅ |
| Recent Teachers | teachers endpoint (limit 5) | ✅ |
| Recent Announcements | dashboard.recent_announcements | ✅ |
| Attendance Snapshot | dashboard.attendance_percentage | ✅ |
| Timetable Status | timetable/today | ✅ |
| System Status Card | Composed from multiple sources | ✅ |
| Quick Actions (4) | Static links | ✅ |

### Issues
| Issue | Severity |
|-------|----------|
| Academic Year KPI shows "Not set" if no current year exists — not a bug, correct behavior | ✅ Acceptable |
| `safeFetch()` catches and suppresses non-auth errors gracefully — individual API failures don't crash dashboard | ✅ Good design |

---

## 2. PRINCIPAL DASHBOARD

### Endpoint: `GET /dashboard/principal`
- **Roles:** `principal`, `super_admin`
- **Response schema:** `PrincipalDashboardResponse`

### Backend Response Shape
```
{
  total_students: number,
  total_teachers: number,
  attendance_percentage: number,
  homework_completion_rate: number,
  test_pass_rate: number,
  recent_announcements: AnnouncementItem[],
  unread_notifications: { count: number }
}
```

### Rendered Widgets
| Widget | Data Source | Status |
|--------|------------|--------|
| Total Students KPI | data.total_students | ✅ |
| Total Teachers KPI | data.total_teachers | ✅ |
| Attendance % KPI | data.attendance_percentage (with trend color) | ✅ |
| Test Pass Rate KPI | data.test_pass_rate | ✅ |
| Performance Metrics (bars) | homework_completion_rate, test_pass_rate | ✅ |
| Attendance Gauge (PieChart) | data.attendance_percentage (recharts) | ✅ |
| Performance Bar Chart | attendance %, homework %, test pass % (recharts) | ✅ |
| Recent Announcements | data.recent_announcements | ✅ |
| Unread Notifications | data.unread_notifications.count | ✅ |

### Issues
| Issue | Severity |
|-------|----------|
| `active_classes` is in `AdminDashboardResponse` but NOT in `PrincipalDashboardResponse` — principal cannot see class count | **P2** |
| No homework or test list shortcuts from principal dashboard — only aggregate metrics | **P3** |

---

## 3. TEACHER DASHBOARD

### Endpoint: `GET /dashboard/teacher`
- **Roles:** `teacher`
- **Response schema:** `TeacherDashboardResponse`

### Backend Response Shape
```
{
  classes_assigned: string[],          // Class names
  today_schedule: TimetableWidget[],   // subject_name, class_name, start_time, end_time, room_number
  attendance_pending_count: number,
  homework_pending_review: number,
  upcoming_tests: number,
  unread_notifications: { count: number }
}
```

### Rendered Widgets
| Widget | Data Source | Status |
|--------|------------|--------|
| Attendance Pending Card | attendance_pending_count (click to /attendance/mark) | ✅ |
| Homework to Review Card | homework_pending_review (click to /homework) | ✅ |
| Upcoming Tests Card | upcoming_tests | ✅ |
| Classes Badges | classes_assigned array | ✅ |
| Today's Schedule Timeline | today_schedule | ✅ |
| Quick Actions | Mark Attendance, Create Homework, My Timetable | ✅ |
| Refresh Button | refetch query | ✅ |

### Issues
| Issue | Severity |
|-------|----------|
| No direct link to test creation from teacher dashboard | **P3** |
| `upcoming_tests` shows count but no list — teacher must navigate to /tests for details | **P3** |

---

## 4. STUDENT DASHBOARD

### Endpoint: `GET /dashboard/student`
- **Roles:** `student`
- **Response schema:** `StudentDashboardResponse`

### Backend Response Shape
```
{
  today_timetable: TimetableWidget[],
  homework_due: HomeworkDueWidget[],     // id, title, subject_name, due_date, days_remaining
  upcoming_tests: UpcomingTestWidget[],  // id, title, subject_name, scheduled_at, total_marks
  attendance_percentage: number,
  recent_announcements: AnnouncementItem[],
  unread_notifications: { count: number }
}
```

### Rendered Widgets
| Widget | Data Source | Status |
|--------|------------|--------|
| Homework Due KPI | homework_due.length | ✅ |
| Upcoming Tests KPI | upcoming_tests.length | ✅ |
| Attendance % KPI | attendance_percentage | ✅ |
| Unread Notifications Card | unread_notifications.count | ✅ |
| Homework Due List | homework_due (cards with color-coded urgency) | ✅ |
| Upcoming Tests List | upcoming_tests | ✅ |
| Today's Timetable | today_timetable | ✅ |
| "View all" links | Navigate to /homework, /tests | ✅ |

### Issues
| Issue | Severity |
|-------|----------|
| No direct "Submit Homework" entry point from dashboard — student must navigate into homework list then into each assignment | **P3** |
| Timetable does not show room number (even if backend provides it) | **P3** |

---

## 5. PARENT DASHBOARD — CRITICAL

### Endpoint: `GET /dashboard/admin` ❌
- **Frontend calls:** `dashboardService.getAdminDashboard()` 
- **Required roles:** `school_admin`, `super_admin`
- **Parent role:** `parent` → **403 FORBIDDEN**

### Verdict: **P0 CRITICAL BUG — PARENT DASHBOARD DOES NOT WORK**

### Root Cause
In `web/src/app/dashboard/page.tsx`, the `ParentDashboard` function calls:
```typescript
queryFn: () => dashboardService.getAdminDashboard(),
```
This hits `GET /dashboard/admin` which requires `school_admin` or `super_admin` role.

### Fix Required
Parent dashboard should call a different endpoint. Options:
1. Call `GET /dashboard/principal` (requires `principal/super_admin` — still won't work)
2. Add a new backend endpoint `GET /dashboard/parent`
3. Create a parent-specific endpoint that returns relevant data (child's attendance, homework for linked children, announcements)

### Current Parent Dashboard (what WOULD render if API worked)
| Widget | Would Work? | Notes |
|--------|-------------|-------|
| Attendance % KPI | Would show from admin response | Not child-specific |
| Homework Card | Static link to /homework | ✅ Would navigate |
| Attendance Card | Static link to /attendance | ✅ Would navigate |
| Recent Announcements | From admin response | ✅ Would show |

### Issues
| Issue | Severity |
|-------|----------|
| **Parent dashboard 403 — cannot load at all** | **P0** |
| Even if fixed, parent sees SCHOOL-wide metrics, not child-specific data | **P2** |

---

## DASHBOARD SUMMARY

| Dashboard | API Endpoint | Frontend Query Key | Status | Issue Count |
|-----------|-------------|-------------------|--------|-------------|
| Admin | `GET /dashboard/admin` | `queryKeys.dashboard.admin` | ✅ Working | 0 |
| Principal | `GET /dashboard/principal` | `queryKeys.dashboard.principal` | ✅ Working | 1 (P2) |
| Teacher | `GET /dashboard/teacher` | `queryKeys.dashboard.teacher` | ✅ Working | 0 |
| Student | `GET /dashboard/student` | `queryKeys.dashboard.student` | ✅ Working | 0 |
| Parent | `GET /dashboard/admin` | `queryKeys.dashboard.admin` | ❌ **P0** | 1 (P0) |

---

*End of Dashboard Audit Report*
