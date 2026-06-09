# 🏫 Athon — Role Permissions Matrix

**Date**: June 9, 2026
**Reviewer**: School Operations Consultant

---

## Role Definitions

### What Each Role SHOULD Do

| Role | Core Responsibility |
|------|-------------------|
| **Super Admin** | System-wide administration across all schools |
| **School Admin** | Daily school operations: manage users, classes, subjects, timetable, settings |
| **Principal** | Monitor school performance: view reports, make announcements, oversee operations |
| **Teacher** | Classroom operations: mark attendance, create homework/tests, grade submissions |
| **Parent** | Monitor child's progress: view attendance, homework, test results |
| **Student** | Academic participation: submit homework, take tests, view results |

### What Each Role Should NOT Do

| Role | Should NOT |
|------|-----------|
| **Super Admin** | Interfere in daily school operations |
| **School Admin** | Create homework/tests, mark attendance, grade submissions |
| **Principal** | Manage user accounts (CRUD teachers/students/parents), mark attendance, create homework/tests |
| **Teacher** | Manage user accounts, create classes/subjects, access other teachers' classes |
| **Parent** | Create/edit any data, submit homework, take tests |
| **Student** | View other students' data, access unpublished content, grade anything |

---

## Permission Matrix

### View (Read Access)

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| School Profile | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users (all) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Teachers | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Students | ✅ | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Parents | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Classes | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| Subjects | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Academic Years/Terms | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Periods | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Timetable | ✅ | ✅ | ✅ (all) | ✅ (own) | ❌ | ✅ (own class) |
| Attendance | ✅ | ✅ | ✅ (school-wide) | ✅ (own classes) | ✅ (own children) | ✅ (own) |
| Homework | ✅ | ✅ | ✅ (published) | ✅ (own) | ✅ (own children) | ✅ (published, own class) |
| Homework Submissions | ✅ | ✅ | ✅ | ✅ (own homework) | ❌ | ✅ (own) |
| Tests | ✅ | ✅ | ✅ (published) | ✅ (own) | ✅ (own children) | ✅ (published, own class) |
| Test Attempts | ✅ | ✅ | ✅ | ✅ (own tests) | ❌ | ✅ (own) |
| Reports | ✅ | ✅ | ✅ | ✅ (own scope) | ✅ (own children) | ✅ (own) |
| Announcements | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) |
| School Settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Create

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| School | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Teacher | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Student | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Parent | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Principal | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Class | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Subject | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic Year | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic Term | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Period | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Timetable Entry | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Attendance | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Homework | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Homework Submission | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Test | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Test Attempt | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Announcement | ✅ | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Notification | ✅ | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Parent-Student Link | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Edit / Update

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| School Profile | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Teacher | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Student | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Parent | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Principal | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Class | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Subject | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic Year | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Homework | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Homework Submission | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (own, before graded) |
| Test | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Announcement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Delete / Soft-Delete

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| School | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Teacher | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Student | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Parent | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Principal | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Class | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Subject | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic Year | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Homework | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Test | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Announcement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Question (Homework/Test) | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |

### Approve / Grade

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| Homework Grade | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Test Grade | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Homework Publish | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Test Publish | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |
| Test Results Publish | ✅ | ❌ | ❌ | ✅ (own) | ❌ | ❌ |

### Monitor / Report

| Resource | Super Admin | School Admin | Principal | Teacher | Parent | Student |
|----------|:-----------:|:------------:|:---------:|:-------:|:-------:|:-------:|
| Attendance Report | ✅ | ✅ | ✅ | ✅ (own classes) | ✅ (own children) | ❌ |
| Homework Report | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own children) | ❌ |
| Test Report | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own children) | ❌ |
| Student Summary | ✅ | ✅ | ✅ | ✅ (own classes) | ✅ (own children) | ✅ (own) |
| Class Summary | ✅ | ✅ | ✅ | ✅ (own classes) | ❌ | ❌ |
| Teacher Summary | ✅ | ✅ | ✅ | ✅ (own) | ❌ | ❌ |

---

## Current Permission Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | Teacher can see school-wide attendance data without class filter | Data leak — teacher sees all students | 🔴 **CRITICAL** (was C1, believed fixed) |
| 2 | Parent dashboard calls admin API | Parent sees admin data instead of child data | 🔴 **CRITICAL** (needs fix) |
| 3 | No parent settings/preferences page | Cannot manage notification channels | 🟡 Medium |
| 4 | No principal user management restrictions in UI | Principal can navigate to user CRUD pages (though backend blocks) | 🟡 Medium |
| 5 | Teacher Assignments visible in principal nav | Was partially fixed but sidebar items may still appear | 🟡 Medium |

---

## Workflow Completeness

| Workflow | Status | Notes |
|----------|--------|-------|
| Admin creates teacher → Teacher logs in → Teaches class | ✅ Complete | End-to-end works |
| Admin creates student → Student logs in → Views homework | ✅ Complete | End-to-end works |
| Teacher marks attendance → Parent sees it | ✅ Complete | WhatsApp alert wired |
| Teacher creates homework → Student submits → Teacher grades | ✅ Complete | End-to-end works |
| Teacher creates test → Student attempts → Teacher views results | ✅ Complete | End-to-end works |
| Parent views child dashboard | ⚠️ Broken | Calls wrong API |
| Forgot password → Reset | ❌ Missing | Stub page only |
