# Athon — API Route Inventory

**Last Updated**: June 9, 2026
**Total Routes**: 107 endpoints across 22 modules

---

## All Routes by Module

### Health (2 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| GET | `/health` | `health.py` | Public | ✅ Active |
| GET | `/health/database` | `health.py` | Public | ✅ Active |

### Auth (3 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/auth/login` | `auth.py` | Public | ✅ Active |
| GET | `/auth/me` | `auth.py` | JWT | ✅ Active |
| GET | `/auth/context` | `auth.py` | JWT | ✅ Active |

### Teachers (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/teachers` | `teachers.py` | school_admin+ | ✅ Active |
| GET | `/teachers` | `teachers.py` | school_admin+ | ✅ Active |
| GET | `/teachers/{id}` | `teachers.py` | school_admin+ | ✅ Active |
| PATCH | `/teachers/{id}` | `teachers.py` | school_admin+ | ✅ Active |
| DELETE | `/teachers/{id}` | `teachers.py` | school_admin+ | ✅ Active |

### Students (6 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/students` | `students.py` | school_admin+ | ✅ Active |
| GET | `/students` | `students.py` | school_admin+ | ✅ Active |
| GET | `/students/{id}` | `students.py` | school_admin+ | ✅ Active |
| PATCH | `/students/{id}` | `students.py` | school_admin+ | ✅ Active |
| DELETE | `/students/{id}` | `students.py` | school_admin+ | ✅ Active |
| POST | `/students/import` | `students.py` | school_admin+ | ✅ Active |

### Parents (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/parents` | `parents.py` | school_admin+ | ✅ Active |
| GET | `/parents` | `parents.py` | school_admin+ | ✅ Active |
| GET | `/parents/{id}` | `parents.py` | school_admin+ | ✅ Active |
| PATCH | `/parents/{id}` | `parents.py` | school_admin+ | ✅ Active |
| DELETE | `/parents/{id}` | `parents.py` | school_admin+ | ✅ Active |

### Principals (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/principals` | `principals.py` | school_admin+ | ✅ Active |
| GET | `/principals` | `principals.py` | school_admin+ | ✅ Active |
| GET | `/principals/{id}` | `principals.py` | school_admin+ | ✅ Active |
| PATCH | `/principals/{id}` | `principals.py` | school_admin+ | ✅ Active |
| DELETE | `/principals/{id}` | `principals.py` | school_admin+ | ✅ Active |

### Student-Parents (1 route)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/student-parents` | `student_parents.py` | school_admin+ | ✅ Active |

### Classes (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/classes` | `classes.py` | school_admin+ | ✅ Active |
| GET | `/classes` | `classes.py` | school_admin+ | ✅ Active |
| GET | `/classes/{id}` | `classes.py` | school_admin+ | ✅ Active |
| PATCH | `/classes/{id}` | `classes.py` | school_admin+ | ✅ Active |
| DELETE | `/classes/{id}` | `classes.py` | school_admin+ | ✅ Active |

### Subjects (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/subjects` | `subjects.py` | school_admin+ | ✅ Active |
| GET | `/subjects` | `subjects.py` | school_admin+ | ✅ Active |
| GET | `/subjects/{id}` | `subjects.py` | school_admin+ | ✅ Active |
| PATCH | `/subjects/{id}` | `subjects.py` | school_admin+ | ✅ Active |
| DELETE | `/subjects/{id}` | `subjects.py` | school_admin+ | ✅ Active |

### Academic Years (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/academic-years` | `academic_years.py` | school_admin+ | ✅ Active |
| GET | `/academic-years` | `academic_years.py` | school_admin+ | ✅ Active |
| GET | `/academic-years/{id}` | `academic_years.py` | school_admin+ | ✅ Active |
| PATCH | `/academic-years/{id}` | `academic_years.py` | school_admin+ | ✅ Active |
| DELETE | `/academic-years/{id}` | `academic_years.py` | school_admin+ | ✅ Active |

### Academic Terms (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/academic-terms` | `academic_terms.py` | school_admin+ | ✅ Active |
| GET | `/academic-terms` | `academic_terms.py` | school_admin+ | ✅ Active |
| GET | `/academic-terms/{id}` | `academic_terms.py` | school_admin+ | ✅ Active |
| PATCH | `/academic-terms/{id}` | `academic_terms.py` | school_admin+ | ✅ Active |
| DELETE | `/academic-terms/{id}` | `academic_terms.py` | school_admin+ | ✅ Active |

### Periods (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/periods` | `periods.py` | school_admin+ | ✅ Active |
| GET | `/periods` | `periods.py` | school_admin+ | ✅ Active |
| GET | `/periods/{id}` | `periods.py` | school_admin+ | ✅ Active |
| PATCH | `/periods/{id}` | `periods.py` | school_admin+ | ✅ Active |
| DELETE | `/periods/{id}` | `periods.py` | school_admin+ | ✅ Active |

### Teacher Assignments (3 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/teacher-assignments` | `teacher_assignments.py` | school_admin+ | ✅ Active |
| GET | `/teacher-assignments` | `teacher_assignments.py` | school_admin+ | ✅ Active |
| DELETE | `/teacher-assignments/{id}` | `teacher_assignments.py` | school_admin+ | ✅ Active |

### Timetable (7 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/timetable/entries` | `timetable.py` | school_admin+ | ✅ Active |
| PATCH | `/timetable/entries/{id}` | `timetable.py` | school_admin+ | ✅ Active |
| DELETE | `/timetable/entries/{id}` | `timetable.py` | school_admin+ | ✅ Active |
| GET | `/timetable/class/{id}` | `timetable.py` | JWT | ✅ Active |
| GET | `/timetable/teacher/{id}` | `timetable.py` | JWT | ✅ Active |
| GET | `/timetable/teacher/me` | `timetable.py` | teacher | ✅ Active |
| GET | `/timetable/today` | `timetable.py` | JWT | ✅ Active |

### Attendance (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/attendance/mark` | `attendance.py` | teacher | ✅ Active |
| POST | `/attendance/batch` | `attendance.py` | teacher | ✅ Active |
| GET | `/attendance/class/{id}` | `attendance.py` | JWT | ✅ Active |
| GET | `/attendance/student/{id}` | `attendance.py` | JWT | ✅ Active |
| GET | `/attendance/today` | `attendance.py` | JWT | ✅ Active |

### Homework (9 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/homework` | `homeworks.py` | teacher | ✅ Active |
| PATCH | `/homework/{id}` | `homeworks.py` | teacher | ✅ Active |
| GET | `/homework/class/{id}` | `homeworks.py` | JWT | ✅ Active |
| GET | `/homework/{id}` | `homeworks.py` | JWT | ✅ Active |
| GET | `/homework/student/me` | `homeworks.py` | student | ✅ Active |
| POST | `/homework/{id}/submit` | `homeworks.py` | student | ✅ Active |
| PATCH | `/homework/{id}/submit` | `homeworks.py` | student | ✅ Active |
| GET | `/homework/{id}/submissions` | `homeworks.py` | JWT | ✅ Active |
| PATCH | `/homework/{id}/submissions/{sid}/grade` | `homeworks.py` | teacher | ✅ Active |
| POST | `/homework/{id}/questions` | `homeworks.py` | teacher | ✅ Active |
| PATCH | `/homework/{id}/questions/{qid}` | `homeworks.py` | teacher | ✅ Active |
| DELETE | `/homework/{id}/questions/{qid}` | `homeworks.py` | teacher | ✅ Active |
| PATCH | `/homework/{id}/questions/reorder` | `homeworks.py` | teacher | ✅ Active |

### Tests (8 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/tests` | `tests.py` | teacher | ✅ Active |
| PATCH | `/tests/{id}` | `tests.py` | teacher | ✅ Active |
| GET | `/tests/class/{id}` | `tests.py` | JWT | ✅ Active |
| GET | `/tests/student/me` | `tests.py` | student | ✅ Active |
| GET | `/tests/{id}` | `tests.py` | JWT | ✅ Active |
| POST | `/tests/{id}/start` | `tests.py` | student | ✅ Active |
| POST | `/tests/{id}/submit` | `tests.py` | student | ✅ Active |
| GET | `/tests/{id}/results` | `tests.py` | JWT | ✅ Active |
| PATCH | `/tests/{id}/questions/{qid}` | `tests.py` | teacher | ✅ Active |
| DELETE | `/tests/{id}/questions/{qid}` | `tests.py` | teacher | ✅ Active |
| PATCH | `/tests/{id}/questions/reorder` | `tests.py` | teacher | ✅ Active |

### Dashboard (4 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| GET | `/dashboard/principal` | `dashboard.py` | principal | ✅ Active |
| GET | `/dashboard/teacher` | `dashboard.py` | teacher | ✅ Active |
| GET | `/dashboard/student` | `dashboard.py` | student | ✅ Active |
| GET | `/dashboard/admin` | `dashboard.py` | school_admin | ✅ Active |

### Reports (6 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| GET | `/reports/attendance` | `reports.py` | JWT | ✅ Active |
| GET | `/reports/homework` | `reports.py` | JWT | ✅ Active |
| GET | `/reports/tests` | `reports.py` | JWT | ✅ Active |
| GET | `/reports/student/{id}` | `reports.py` | JWT | ✅ Active |
| GET | `/reports/class/{id}` | `reports.py` | JWT | ✅ Active |
| GET | `/reports/teacher/{id}` | `reports.py` | JWT | ✅ Active |

### Notifications (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/notifications/send` | `notifications.py` | teacher+ | ✅ Active |
| GET | `/notifications/me` | `notifications.py` | JWT | ✅ Active |
| GET | `/notifications/unread/count` | `notifications.py` | JWT | ✅ Active |
| PATCH | `/notifications/{id}/read` | `notifications.py` | JWT | ✅ Active |
| POST | `/notifications/read-all` | `notifications.py` | JWT | ✅ Active |

### Announcements (5 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/announcements` | `announcements.py` | JWT | ✅ Active |
| GET | `/announcements` | `announcements.py` | JWT | ✅ Active |
| GET | `/announcements/{id}` | `announcements.py` | JWT | ✅ Active |
| PATCH | `/announcements/{id}` | `announcements.py` | JWT | ✅ Active |
| DELETE | `/announcements/{id}` | `announcements.py` | JWT | ✅ Active |

### Parent Portal (6 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| GET | `/parent/dashboard` | `parents.py` | parent | ✅ Active |
| GET | `/parent/children` | `parents.py` | parent | ✅ Active |
| GET | `/parent/attendance` | `parents.py` | parent | ✅ Active |
| GET | `/parent/homework` | `parents.py` | parent | ✅ Active |
| GET | `/parent/tests` | `parents.py` | parent | ✅ Active |
| GET | `/parent/announcements` | `parents.py` | parent | ✅ Active |

### Schools (2 routes)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| GET | `/schools/{id}` | `schools.py` | school_admin+ | ✅ Active |
| PATCH | `/schools/{id}` | `schools.py` | school_admin+ | ✅ Active |

### AI (1 route)

| Method | Route | File | Auth | Status |
|--------|------|------|:----:|:------:|
| POST | `/ai/generate-homework` | `ai.py` | teacher | ✅ Active |

---

## Dead Routes

| Route | File | Reason |
|-------|------|--------|
| — | `users.py` | File was empty — already deleted | 

All 107 routes are registered in `router.py` and are actively used. No dead routes detected.
