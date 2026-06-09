# ATHON — WORKFLOW AUDIT REPORT
**Date:** June 10, 2026
**Auditor:** Staff Full-Stack Engineer + QA Lead
**Method:** End-to-end workflow trace through code paths, API calls, and UI components.

---

## 1. TEACHER WORKFLOWS

### 1.1 Login → Dashboard
```
Steps:
1. Go to /login
2. Enter email + password
3. POST /auth/login → Supabase Auth → JWT
4. Redirect to /dashboard
5. GET /dashboard/teacher → teacher dashboard data
6. Render: KPI cards, today's schedule, quick actions

Verdict: ✅ COMPLETE
Issues: None
```

### 1.2 Mark Attendance
```
Steps:
1. From dashboard, click "Mark Attendance" or navigate to /attendance/mark
2. Class dropdown shows only assigned classes (filtered via timetable)
3. Select date (defaults to today)
4. Tap-to-cycle: each student shows P/A/L/H badge
5. "Set all" buttons for bulk operations
6. Summary bar shows counts per status
7. Click "Save Attendance"
8. Confirm dialog → POST /attendance/batch
9. On success: toast + redirect to /attendance
10. Backend fires Celery task `send_absence_whatsapp` for absent students

Verdict: ✅ COMPLETE
Issues:
- If no timetable entries exist, teacher sees ALL classes (fallback) — P2
- WhatsApp alerts only fire on batch mark, not single mark — P2
```

### 1.3 Create Homework (Manual)
```
Steps:
1. Navigate to /homework/create
2. Select class (resets subject selection)
3. Select subject (filtered by teacher assignments for that class)
4. Enter title, description, due date, max score
5. Toggle "Publish immediately"
6. Click "Create Homework"
7. POST /homework → creates homework
8. Redirect to /homework/{id}

Verdict: ✅ COMPLETE
Issues: None
```

### 1.4 Create Homework (AI-Generated)
```
Steps:
1. On /homework/create, ensure class + subject selected
2. AI Generation Card appears with sparkle icon + "Beta" badge
3. Enter chapter/topic (e.g., "Quadratic Equations")
4. Select question count (slider 1-20)
5. Toggle question types (MCQ, Short Answer, True/False)
6. Click "Generate with AI"
7. POST /ai/generate-homework → OpenAI generates questions
8. Preview shows: title, questions list with correct answers highlighted
9. Click "Accept & Fill Title" → auto-fills title field
10. Submit creates homework + saves questions via POST /homework/{id}/questions

Verdict: ✅ COMPLETE
Issues:
- AI requires OPENAI_API_KEY set in backend. Without it, returns 503 with error message. ✅ (expected behavior)
```

### 1.5 Grade Homework Submissions
```
Steps:
1. Navigate to /homework/{id}
2. See submissions tab with student list
3. Click "Grade" on ungraded submission
4. Dialog opens: enter score + optional remarks
5. PATCH /homework/{id}/submissions/{submissionId}/grade
6. On success: toast, submission shows score badge

Verdict: ✅ COMPLETE
Issues: None
```

### 1.6 Create Test
```
Steps:
1. Navigate to /tests/create
2. Select class, subject, enter title, description
3. Configure test type, total marks, duration, pass %
4. Optional: schedule for later date
5. AI Generation Card: enter topic, question count, difficulty
6. Generate with AI → preview questions → accept fills title
7. Click "Create Test"

Verdict: ✅ COMPLETE
Issues: None
```

---

## 2. STUDENT WORKFLOWS

### 2.1 Login → Dashboard
```
Steps:
1. Login at /login
2. Redirect to /dashboard
3. GET /dashboard/student → student dashboard
4. Shows: homework due (count + list), upcoming tests, attendance %, today's classes

Verdict: ✅ COMPLETE
Issues: None
```

### 2.2 View & Submit Homework
```
Steps:
1. From dashboard, click homework item or navigate to /homework
2. Student sees "My Homework" — no class selector, no "New Homework" button
3. GET /homework/student/me → student's published homework
4. Click homework → /homework/{id}
5. Detail view: title, description, due date, max score
6. Click "View Questions"
7. GET /homework/{id}/questions → questions without answers
8. Answer: radio buttons for MCQ/TF, textareas for short answer
9. Click "Submit Homework" → confirm dialog
10. POST /homework/{id}/submit
11. Success: green checkmark, "Homework Submitted" view
12. If graded: shows score, teacher remarks

Verdict: ✅ COMPLETE
Issues:
- No partial save / draft support — answers are local state only, lost on page refresh — P2
```

### 2.3 Attempt Test
```
Steps:
1. Navigate to /tests
2. Student sees "My Tests" — GET /tests/student/me
3. Click test → /tests/{id}
4. Detail view: title, marks, duration, description
5. If published and not scheduled in future: "Start Test" button
6. Click "Start Test" → POST /tests/{id}/start
7. Test view opens: timer (countdown), questions visible
8. GET /tests/{id}/questions → questions (require in-progress attempt)
9. Answer questions (MCQ radio, short answer textarea)
10. Click "Submit Test" → confirm dialog
11. POST /tests/{id}/submit
12. Success: green checkmark, "Test Submitted" view

Verdict: ✅ COMPLETE
Issues:
- Timer starts when component mounts, not from server timestamp — can be reset on page refresh — P2
- No auto-submit when timer expires — student can continue past time limit — P2
```

---

## 3. PARENT WORKFLOWS

### 3.1 Login → Dashboard → 403 ❌
```
Steps:
1. Login at /login → success
2. Redirect to /dashboard
3. GET /dashboard/admin → 403 FORBIDDEN
4. Dashboard shows error state: "Failed to load dashboard"

Verdict: ❌ BROKEN — P0 CRITICAL
Fix: Parent dashboard must call a role-appropriate endpoint
```

### 3.2 View Homework
```
Steps:
1. Navigate to /homework
2. Class selector appears (parent needs to select a class)
3. GET /homework/class/{id} with include_unpublished=false
4. Shows published homework only

Verdict: ✅ WORKING (conditional on class selection)
Issues:
- Parent must know which class to select — no automatic child linking — P2
```

### 3.3 View Tests
```
Steps:
1. Navigate to /tests
2. Class selector appears
3. GET /tests/class/{id} with include_unpublished=false
4. Shows published tests only

Verdict: ✅ WORKING
```

---

## 4. PRINCIPAL WORKFLOWS

### 4.1 Login → Dashboard
```
Steps:
1. Login → redirect to /dashboard
2. GET /dashboard/principal → school metrics
3. Shows: student/teacher counts, attendance %, homework completion, test pass rate
4. PieChart for attendance, BarChart for performance comparison
5. Recent announcements, unread notifications

Verdict: ✅ COMPLETE
```

### 4.2 View Reports
```
Steps:
1. Navigate to /reports
2. Three tabs: Attendance, Homework, Tests
3. Date range filter (default: last 30 days)
4. Class filter (optional)
5. KPI cards + class breakdown tables
6. CSV export available

Verdict: ✅ COMPLETE
```

---

## 5. ADMIN WORKFLOWS

### 5.1 Onboard Teacher
```
Steps:
1. Navigate to /users/teachers
2. Click "Add Teacher"
3. Fill: name, email, employee code, phone
4. Click "Create"
5. POST /teachers → creates user + teacher record
6. Redirect to teacher detail page

Verdict: ✅ COMPLETE
Issues: None
```

### 5.2 Onboard Student
```
Steps:
1. Navigate to /users/students
2. Click "Add Student"
3. Fill: name, email, admission number, select class
4. Click "Create"
5. POST /students → creates user + student record
6. Redirect to student detail page

Verdict: ✅ COMPLETE
Issues: None
```

### 5.3 Create Timetable
```
Steps:
1. Navigate to /timetable
2. Visual timetable grid (days × periods)
3. Click on cell → add/assign teacher+subject+class+period
4. POST /timetable/entries → creates entry

Verdict: ✅ COMPLETE
Issues:
- Timetable UI is functional but basic — no drag-and-drop — P3
```

---

## WORKFLOW COMPLETION SUMMARY

| Workflow | Status | Issues |
|----------|--------|--------|
| Teacher: Mark Attendance | ✅ Complete | 2 (P2) |
| Teacher: Create Homework (Manual) | ✅ Complete | 0 |
| Teacher: Create Homework (AI) | ✅ Complete | 0 |
| Teacher: Grade Submissions | ✅ Complete | 0 |
| Teacher: Create Test (Manual) | ✅ Complete | 0 |
| Teacher: Create Test (AI) | ✅ Complete | 0 |
| Student: View Homework | ✅ Complete | 0 |
| Student: Submit Homework | ✅ Complete | 2 (P2) |
| Student: Attempt Test | ✅ Complete | 2 (P2) |
| Parent: Dashboard | ❌ Broken (P0) | 1 (P0) |
| Parent: View Homework | ✅ Working | 1 (P2) |
| Parent: View Tests | ✅ Working | 0 |
| Principal: Dashboard | ✅ Complete | 0 |
| Principal: Reports | ✅ Complete | 0 |
| Admin: Onboard Teacher | ✅ Complete | 0 |
| Admin: Onboard Student | ✅ Complete | 0 |
| Admin: Create Timetable | ✅ Complete | 1 (P3) |

---

*End of Workflow Audit Report*
