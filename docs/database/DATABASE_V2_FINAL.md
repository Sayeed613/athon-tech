# ATHON V2 — Final Production Database Architecture

**Reviewers**: Principal Database Architect (Google, Stripe, Notion)  
**Date**: June 10, 2026  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Scale Target**: 100 schools · 1,000 teachers · 50,000 students · 500K assessments · 5M attendance records  
**Based on**: Product Architecture v1.0 · API Spec v2.0 · RBAC Matrix v1.0 · Security Model v1.0  
**V1 Baseline**: 29 tables, 76 FKs, 11 ENUMs, 41 indexes, 90 RLS policies  
**Correction (v1.1)**: Scale calculations accounted for 50,000 students total across 100 schools (~500 students/school, typical for CBSE). All row estimates use this corrected baseline.

---

## Table of Contents

1. [Database Architecture Overview](#1-database-architecture-overview)
2. [Complete ERD](#2-complete-erd)
3. [Final Table List](#3-final-table-list)
4. [Duplicate Table Analysis](#4-duplicate-table-analysis)
5. [Database Audit](#5-database-audit)
6. [Audit Logging Tables](#6-audit-logging-tables)
7. [Notification System Tables](#7-notification-system-tables)
8. [AI System Tables](#8-ai-system-tables)
9. [Analytics Tables](#9-analytics-tables)
10. [PostgreSQL Production Recommendations](#10-postgresql-production-recommendations)
11. [Final Summary & Migration Plan](#11-final-summary--migration-plan)

---

## 1. Database Architecture Overview

### 1.1 Design Philosophy

Every table in Athon V2 exists to answer exactly one question:

| Table | Answers |
|-------|---------|
| `schools` | Who is the tenant? |
| `users` | Who is this person and how do they authenticate? |
| `teachers` | What teacher-specific data does this user have? |
| `students` | What student-specific data does this user have? |
| `parents` | What parent-specific data does this user have? |
| `student_parents` | Which children belong to which parent? |
| `classes` | What cohort groups exist? |
| `class_enrollments` | Which students are in which class (history)? |
| `subjects` | What subjects are taught? |
| `teacher_class_subjects` | Who teaches what to whom? |
| `chapters` | What chapters exist in each subject? |
| `topics` | What topics exist in each chapter? |
| `learning_objectives` | What specific LOs exist in each topic? |
| `curriculum_progress` | Has the teacher covered this chapter/topic? |
| `attendance` | Was the student present on this date? |
| `assignments` | What homework/test/worksheet was assigned? |
| `assignment_questions` | What questions are in this assignment? |
| `submissions` | Did the student submit? What score? |
| `answers` | How did the student answer each question? |
| `notifications` | What message was sent? |
| `notification_recipients` | Was it delivered? |
| `lesson_plans` | What is the teacher's lesson plan? |
| `announcements` | What school-wide message was posted? |
| `ai_generations` | What did AI generate? How much did it cost? |
| `student_risk_flags` | Which students need intervention? |
| `audit_logs` | Who changed what and when? |
| `progress_mastery` (MV) | What has each student mastered? |

### 1.2 Why Each Table Exists

**schools** — Tenant root. Every record in the system belongs to exactly one school. The entire database is scoped by `school_id`. Without this table, there is no multi-tenancy.

**users** — Authentication principal for all 5 roles. Every person in the system has exactly one user record. The `role` column determines what they can do. The `supabase_user_id` links to Supabase Auth. Without this, there is no login.

**teachers** — Teacher-specific profile (1:1 with users). Stores `employee_code`, `qualification`, `hire_date`. Teachers have fundamentally different permissions and data than students or parents. V1 got this right — keeping it.

**students** — Student-specific profile (1:1 with users). Stores `admission_number`, `roll_number`, `date_of_birth`, `class_id` (denormalized current class). This is the most-queried table after users.

**parents** — Parent-specific profile (1:1 with users). Minimal: `occupation`, `is_verified`. Most parent access comes through the `student_parents` junction.

**principals** — Note: **REMOVED from V2**. The principal role is now just a `user.role = 'principal'` with no additional profile data. V1's `principals` table added zero query value — it was a 1:1 extension with no unique columns. All principal-specific data is in `users` now.

**student_parents** — Junction table enabling many-to-many student↔parent relationships. Critical for parent portal access control. Every parent dashboard query starts here.

**classes** — Cohort groups (e.g., "Grade 10", section "A"). Scoped to `academic_year_id`. The `class_teacher_id` is a denormalized form-teacher reference.

**class_enrollments** — Historical tracking of which student was in which class in which year. Critical for graduated/transferred student data. The golden source for "who was in Class 7A in 2025-26?"

**subjects** — Academic subjects offered at each school. Simple: name + code + is_core flag.

**teacher_class_subjects** — The core mapping table. Answers "which teachers teach which subjects to which classes?" Used for permission scoping, timetable generation, and dashboard queries.

**chapters** — NEW for V2. Curriculum chapters within a subject (e.g., "Nutrition in Plants" in Class 7 Science). This is the first level of the curriculum graph. Without this, assignments cannot be curriculum-connected.

**topics** — NEW for V2. Topics within chapters (e.g., "Photosynthesis" within "Nutrition in Plants"). The unit of curriculum progress tracking.

**learning_objectives** — NEW for V2. Granular learning objectives within topics (e.g., "Describe the process of photosynthesis", "Identify the reactants and products of photosynthesis"). The atomic unit for mastery tracking.

**curriculum_progress** — NEW for V2. Tracks whether a teacher has covered (Started, In Progress, Completed) a chapter or topic. This is per-teacher, not shared. Powers principal analytics and AI context.

**attendance** — One row per student per day. The `UNIQUE(student_id, date)` constraint ensures exactly one record. This is a high-volume table — expect 5M+ rows at scale. Partition by month.

**assignments** — Unified assignment model replaces V1's `homeworks` + `tests`. A single table with `assignment_type` discriminator (`homework`, `quiz`, `unit_test`, `worksheet`, `project`, `practice`). All assignments share: title, description, due_date, max_score, publish workflow. The `curriculum_id` (optional) links to a `learning_objective` for curriculum-connected assignments.

**assignment_questions** — Questions within an assignment. V1 had duplicate `homework_questions` and `test_questions` tables with identical schemas. Unified in V2.

**submissions** — Student submissions for assignments. V1 had duplicate `homework_submissions` and `test_attempts`. Unified in V2. The `submission_type` distinguishes timed assessments (has `started_at`, `duration_minutes`) from untimed submissions.

**answers** — Per-question answers within a submission. V1 had duplicate `homework_answers` and `test_answers`. Unified in V2.

**notifications** — Outbound notification records. Supports in-app, email, WhatsApp, push. `sender_id` is NULL for system-triggered notifications.

**notification_recipients** — Per-recipient delivery tracking. Each notification can target multiple recipients through different channels.

**lesson_plans** — NEW for V2. Teacher-created lesson plans. Teacher-owned (not school-owned). Optional sharing. Content stored as structured JSON (objectives, activities, materials, assessment).

**announcements** — NEW for V2. School-wide announcements. Created by admin or principal. Filtered by target role.

**ai_generations** — Audit trail for all AI-generated content. Tracks prompts, responses, tokens, cost. Immutable once created.

**student_risk_flags** — NEW for V2. AI-detected flags for students needing intervention (e.g., attendance < 80%, failing grades, incomplete assignments). Resolvable by teachers.

**audit_logs** — Immutable audit trail. All mutations logged. Append-only.

**progress_mastery** — Materialized view (not a table). Computes per-student, per-learning-objective mastery based on assignment scores. Refreshed periodically or on-demand.

### 1.3 Ownership Rules

| Table | Owner (Creator) | Scoped To |
|-------|-----------------|-----------|
| schools | Super Admin | Platform |
| users | Admin / Principal | School |
| teachers | Admin | School |
| students | Admin / Principal | School |
| parents | Admin / Principal | School |
| student_parents | Admin | School (pair) |
| classes | Admin | School |
| class_enrollments | Admin (system) | School |
| subjects | Admin | School |
| teacher_class_subjects | Admin | School |
| chapters | Admin / System (CBSE default) | School / Subject |
| topics | Admin / System | School / Chapter |
| learning_objectives | Admin / System | School / Topic |
| curriculum_progress | Teacher | Teacher (own) |
| attendance | Teacher | School (class) |
| assignments | Teacher | School (teacher's class) |
| assignment_questions | Teacher (via AI or manual) | School (assignment) |
| submissions | Student | School (own) |
| answers | Student | School (own submission) |
| notifications | System / Teacher / Principal / Admin | School |
| notification_recipients | System | School |
| lesson_plans | Teacher | Teacher (own) |
| announcements | Admin / Principal | School |
| ai_generations | System | School |
| student_risk_flags | System (AI) | School |
| audit_logs | System | School |
| progress_mastery | System (MV) | Student |

---

## 2. Complete ERD

### 2.1 Entity-Relationship Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SCHOOLS                                    │
│  id (PK) │ name │ code │ address │ phone │ email │ settings │ ...  │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ 1
                   │
      ┌────────────┼────────────────┬──────────────────┬──────────────┐
      │            │                │                  │              │
      ▼ 1:N        ▼ 1:N           ▼ 1:N              ▼ 1:N          ▼ 1:N
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│  USERS   │ │ TEACHERS │ │   SUBJECTS   │ │   CLASSES   │ │ ACADEMIC_    │
│          │ │          │ │              │ │             │ │ YEARS        │
│ school_id│ │ user_id  │ │ school_id    │ │ school_id   │ │ school_id    │
│ role     │ │ FK→users │ │              │ │ acad_year_id│ │              │
└────┬─────┘ └────┬─────┘ └──────┬───────┘ └──────┬──────┘ └──────┬───────┘
     │            │              │                 │              │
     │ 1:1        │ 1:1          │                 │ 1:N          │ 1:N
     ├────────────┘              │                 │              │
     │                           │                 ▼              ▼
     ▼ 1:N              ┌────────┘          ┌─────────────────────────┐
┌──────────────┐        ▼                   │   CLASS_ENROLLMENTS     │
│   STUDENTS   │   ┌─────────────────┐      │   student_id FK→students│
│              │   │ CHAPTERS        │      │   class_id FK→classes   │
│ user_id      │   │ subject_id      │      │   acad_year_id FK→years │
│ FK→users     │   │ FK→subjects     │      │                         │
│ class_id     │   └────────┬────────┘      └─────────────────────────┘
│ FK→classes   │            │ 1:N
└──────┬───────┘            ▼
       │ 1:N          ┌─────────────────┐
       ▼              │   TOPICS        │
┌──────────────┐      │ chapter_id      │
│ ATTENDANCE   │      │ FK→chapters     │
│ student_id   │      └────────┬────────┘
│ FK→students  │               │ 1:N
│ date         │               ▼
│ status       │      ┌──────────────────────────┐
└──────────────┘      │  LEARNING_OBJECTIVES      │
                      │  topic_id FK→topics       │
       ┌──────────────┴───────────────────────────┘
       │
       │ 1:N
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    ASSIGNMENTS                                │
│  teacher_id FK→teachers │ class_id FK→classes                │
│  subject_id FK→subjects │ lo_id FK→learning_objectives (opt) │
│  assignment_type (homework|quiz|test|worksheet|project)      │
│  is_published │ due_date │ max_score                          │
└─────────────────────┬────────────────────────────────────────┘
                      │ 1:N
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                ASSIGNMENT_QUESTIONS                            │
│  assignment_id FK→assignments │ question_text │ question_type  │
│  options (JSONB) │ correct_answer │ points │ sort_order        │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      │ 1:N (answers reference questions)
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUBMISSIONS                                │
│  assignment_id FK→assignments │ student_id FK→students       │
│  status │ submitted_at │ total_score │ is_graded │ graded_by  │
└─────────────────────┬────────────────────────────────────────┘
                      │ 1:N
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                     ANSWERS                                   │
│  submission_id FK→submissions │ question_id FK→questions      │
│  submitted_answer │ score_auto │ score_manual │ is_correct     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Relationship Summary

| # | From | To | Type | Via |
|---|------|----|------|-----|
| 1 | schools | users | 1:N | school_id |
| 2 | schools | teachers | 1:N | school_id |
| 3 | schools | students | 1:N | school_id |
| 4 | schools | parents | 1:N | school_id |
| 5 | schools | classes | 1:N | school_id |
| 6 | schools | subjects | 1:N | school_id |
| 7 | schools | academic_years | 1:N | school_id |
| 8 | schools | attendance | 1:N | school_id |
| 9 | schools | assignments | 1:N | school_id |
| 10 | schools | notifications | 1:N | school_id |
| 11 | schools | ai_generations | 1:N | school_id |
| 12 | schools | audit_logs | 1:N | school_id |
| 13 | users | teachers | 1:1 | user_id |
| 14 | users | students | 1:1 | user_id |
| 15 | users | parents | 1:1 | user_id |
| 16 | academic_years | academic_terms | 1:N | academic_year_id |
| 17 | classes | class_enrollments | 1:N | class_id |
| 18 | students | class_enrollments | 1:N | student_id |
| 19 | students | attendance | 1:N | student_id |
| 20 | students | submissions | 1:N | student_id |
| 21 | parents | student_parents | 1:N | parent_id |
| 22 | students | student_parents | 1:N | student_id |
| 23 | teachers | teacher_class_subjects | 1:N | teacher_id |
| 24 | classes | teacher_class_subjects | 1:N | class_id |
| 25 | subjects | teacher_class_subjects | 1:N | subject_id |
| 26 | subjects | chapters | 1:N | subject_id |
| 27 | chapters | topics | 1:N | chapter_id |
| 28 | topics | learning_objectives | 1:N | topic_id |
| 29 | learning_objectives | assignments | 1:N | lo_id (optional) |
| 30 | teachers | assignments | 1:N | teacher_id |
| 31 | classes | assignments | 1:N | class_id |
| 32 | assignments | assignment_questions | 1:N | assignment_id |
| 33 | assignments | submissions | 1:N | assignment_id |
| 34 | submissions | answers | 1:N | submission_id |
| 35 | assignment_questions | answers | 1:N | question_id |
| 36 | teachers | lesson_plans | 1:N | teacher_id |

---

## 3. Final Table List

### 3.1 TENANT LAYER

#### schools

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| name | VARCHAR(200) | NOT NULL | |
| code | VARCHAR(20) | NOT NULL, UNIQUE | Short code: "ATH-001" |
| address | TEXT | | |
| phone | VARCHAR(20) | | |
| email | CITEXT | | |
| domain | VARCHAR(100) | UNIQUE | White-label domain |
| logo_url | VARCHAR(500) | | |
| settings | JSONB | NOT NULL DEFAULT '{}' | School config |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**: PK, UNIQUE(code), UNIQUE(domain)
**Estimated rows at scale**: 100–1,000

### 3.2 IDENTITY LAYER

#### users

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| email | CITEXT | NOT NULL | Case-insensitive |
| phone | VARCHAR(20) | | |
| supabase_user_id | UUID | NOT NULL, UNIQUE | Links to Supabase Auth |
| first_name | VARCHAR(100) | NOT NULL | |
| last_name | VARCHAR(100) | NOT NULL | |
| role | user_role | NOT NULL | super_admin, school_admin, principal, teacher, student, parent |
| avatar_url | VARCHAR(500) | | |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | |
| last_login_at | TIMESTAMPTZ | | |
| locale | VARCHAR(10) | NOT NULL DEFAULT 'en' | |
| metadata | JSONB | | Flexible fields |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- PK(id)
- UNIQUE(school_id, email)
- UNIQUE(supabase_user_id)
- INDEX idx_users_school_active ON users(school_id) WHERE is_active AND deleted_at IS NULL
- INDEX idx_users_role_school ON users(school_id, role) WHERE is_active AND deleted_at IS NULL

**Estimated rows**: 50,000 students + 1,000 teachers + 1 admin + 2 principals + 50,000 parents ≈ 102K per 100 schools = ~10M at scale

#### teachers

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, NOT NULL, UNIQUE | 1:1 with users |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized for query perf |
| employee_code | VARCHAR(30) | NOT NULL | |
| qualification | VARCHAR(200) | | |
| specialization | VARCHAR(200) | | |
| hire_date | DATE | NOT NULL | |
| is_class_teacher | BOOLEAN | NOT NULL DEFAULT FALSE | Denormalized flag |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- PK(id)
- UNIQUE(user_id)
- UNIQUE(school_id, employee_code)
- INDEX idx_teachers_school ON teachers(school_id) WHERE deleted_at IS NULL

**Estimated rows**: 1,000 teachers per 100 schools

#### students

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, NOT NULL, UNIQUE | 1:1 with users |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized |
| class_id | UUID | FK → classes.id, NOT NULL | Current class (denormalized) |
| admission_number | VARCHAR(30) | NOT NULL | Unique per school |
| roll_number | VARCHAR(10) | | Unique per class |
| date_of_birth | DATE | | PII — encrypted at rest |
| gender | VARCHAR(10) | | male, female, other (application-level, not ENUM) |
| enrollment_date | DATE | NOT NULL | |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- PK(id)
- UNIQUE(user_id)
- UNIQUE(school_id, admission_number)
- UNIQUE(school_id, class_id, roll_number)
- INDEX idx_students_school_active ON students(school_id) WHERE is_active AND deleted_at IS NULL
- INDEX idx_students_class ON students(class_id) WHERE deleted_at IS NULL

**Estimated rows**: 50,000 students per 100 schools

#### parents

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK → users.id, NOT NULL, UNIQUE | 1:1 with users |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized |
| occupation | VARCHAR(100) | | |
| is_verified | BOOLEAN | NOT NULL DEFAULT FALSE | Identity confirmed? |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- PK(id)
- UNIQUE(user_id)

**Estimated rows**: ~50,000 parents per 100 schools

#### student_parents

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| student_id | UUID | FK → students.id, NOT NULL | |
| parent_id | UUID | FK → parents.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized |
| relationship | parent_relationship | NOT NULL | father, mother, guardian, other |
| is_primary_contact | BOOLEAN | NOT NULL DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- PK(id)
- UNIQUE(student_id, parent_id)
- UNIQUE INDEX idx_sp_primary_contact ON student_parents(student_id) WHERE is_primary_contact = TRUE
- INDEX idx_sp_parent ON student_parents(parent_id) INCLUDE (student_id, relationship)

**Estimated rows**: ~60K (most students have 1-2 parents)

### 3.3 ACADEMIC LAYER

#### academic_years

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| name | VARCHAR(50) | NOT NULL | "2025-2026" |
| start_date | DATE | NOT NULL | |
| end_date | DATE | NOT NULL | CHECK(end_date > start_date) |
| is_current | BOOLEAN | NOT NULL DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**: UNIQUE(school_id, name)

#### academic_terms

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| academic_year_id | UUID | FK → academic_years.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| name | VARCHAR(50) | NOT NULL | "Term 1" |
| start_date | DATE | NOT NULL | |
| end_date | DATE | NOT NULL | CHECK(end_date > start_date) |
| is_current | BOOLEAN | NOT NULL DEFAULT FALSE | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**: UNIQUE(academic_year_id, name)

#### classes

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| name | VARCHAR(50) | NOT NULL | "Grade 10" |
| section | VARCHAR(20) | | "A" |
| academic_year_id | UUID | FK → academic_years.id, NOT NULL | |
| class_teacher_id | UUID | FK → teachers.id | Form teacher |
| room_number | VARCHAR(20) | | |
| capacity | INTEGER | NOT NULL DEFAULT 30, CHECK(1-100) | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- UNIQUE(school_id, name, section, academic_year_id)
- INDEX idx_classes_teacher ON classes(class_teacher_id) WHERE deleted_at IS NULL

#### class_enrollments

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| class_id | UUID | FK → classes.id, NOT NULL | |
| academic_year_id | UUID | FK → academic_years.id, NOT NULL | |
| enrolled_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| completed_at | TIMESTAMPTZ | | |
| status | enrollment_status | NOT NULL DEFAULT 'active' | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- UNIQUE(student_id, academic_year_id)
- INDEX idx_ce_current_enrollments ON class_enrollments(student_id, status) WHERE status = 'active'
- INDEX idx_ce_class_history ON class_enrollments(class_id, academic_year_id, status)

#### subjects

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| name | VARCHAR(100) | NOT NULL | "Mathematics" |
| code | VARCHAR(20) | NOT NULL | "MATH" |
| description | TEXT | | |
| is_core | BOOLEAN | NOT NULL DEFAULT TRUE | Core or elective |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**: UNIQUE(school_id, code), UNIQUE(school_id, name)

#### teacher_class_subjects

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| teacher_id | UUID | FK → teachers.id, NOT NULL | |
| class_id | UUID | FK → classes.id, NOT NULL | |
| subject_id | UUID | FK → subjects.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| academic_term_id | UUID | FK → academic_terms.id, NOT NULL | |
| is_class_teacher | BOOLEAN | NOT NULL DEFAULT FALSE | Form teacher |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- UNIQUE(teacher_id, class_id, subject_id, academic_term_id)
- INDEX idx_tcs_teacher_current ON teacher_class_subjects(teacher_id, academic_term_id) WHERE deleted_at IS NULL

### 3.4 CURRICULUM LAYER (NEW)

#### chapters

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| subject_id | UUID | FK → subjects.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| name | VARCHAR(200) | NOT NULL | "Nutrition in Plants" |
| description | TEXT | | |
| chapter_number | INTEGER | NOT NULL | Ordering within subject |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- UNIQUE(subject_id, name)
- INDEX idx_chapters_subject ON chapters(subject_id, sort_order) WHERE deleted_at IS NULL

#### topics

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| chapter_id | UUID | FK → chapters.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized |
| name | VARCHAR(200) | NOT NULL | "Photosynthesis" |
| description | TEXT | | |
| estimated_periods | INTEGER | | Estimated teaching periods |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- UNIQUE(chapter_id, name)
- INDEX idx_topics_chapter ON topics(chapter_id, sort_order) WHERE deleted_at IS NULL

#### learning_objectives

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| topic_id | UUID | FK → topics.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | Denormalized |
| code | VARCHAR(30) | NOT NULL | "SCI-7-NP-PH-01" |
| description | TEXT | NOT NULL | "Describe the process of photosynthesis" |
| bloom_taxonomy_level | VARCHAR(30) | | remember, understand, apply, analyze, evaluate, create |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- UNIQUE(topic_id, code)
- INDEX idx_lo_topic ON learning_objectives(topic_id, sort_order) WHERE deleted_at IS NULL

#### curriculum_progress

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| teacher_id | UUID | FK → teachers.id, NOT NULL | Who marked progress |
| entity_type | VARCHAR(20) | NOT NULL | 'chapter' or 'topic' |
| entity_id | UUID | NOT NULL | FK to chapters.id or topics.id |
| school_id | UUID | FK → schools.id, NOT NULL | |
| status | VARCHAR(20) | NOT NULL | 'not_started', 'in_progress', 'completed' |
| marked_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| notes | TEXT | | Optional teacher notes |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- UNIQUE(teacher_id, entity_type, entity_id)
- INDEX idx_cp_teacher ON curriculum_progress(teacher_id, entity_type, status)

### 3.5 ATTENDANCE LAYER

#### attendance

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| class_id | UUID | FK → classes.id, NOT NULL | Denormalized |
| academic_term_id | UUID | FK → academic_terms.id, NOT NULL | |
| date | DATE | NOT NULL | |
| status | attendance_status | NOT NULL | present, absent, late, half_day |
| marked_by | UUID | FK → teachers.id, NOT NULL | |
| remarks | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- UNIQUE(student_id, date)
- INDEX idx_attendance_class_date ON attendance(class_id, date) INCLUDE (student_id, status)
- INDEX idx_attendance_term ON attendance(academic_term_id, class_id, student_id) INCLUDE (status)
- **PARTITION BY RANGE (date)** — monthly partitions

### 3.6 ASSIGNMENT LAYER (UNIFIED)

#### assignments

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| teacher_id | UUID | FK → teachers.id, NOT NULL | Creator |
| class_id | UUID | FK → classes.id, NOT NULL | Target class |
| subject_id | UUID | FK → subjects.id, NOT NULL | |
| academic_term_id | UUID | FK → academic_terms.id, NOT NULL | |
| lo_id | UUID | FK → learning_objectives.id | Optional curriculum link |
| title | VARCHAR(200) | NOT NULL | |
| description | TEXT | | |
| assignment_type | assignment_type | NOT NULL | homework, quiz, unit_test, worksheet, project, practice |
| max_score | DECIMAL(8,2) | NOT NULL | |
| duration_minutes | INTEGER | | NULL for untimed |
| due_date | TIMESTAMPTZ | | |
| scheduled_at | TIMESTAMPTZ | | For timed assessments |
| is_published | BOOLEAN | NOT NULL DEFAULT FALSE | |
| published_at | TIMESTAMPTZ | | |
| is_results_published | BOOLEAN | NOT NULL DEFAULT FALSE | |
| results_published_at | TIMESTAMPTZ | | |
| passing_percentage | DECIMAL(5,2) | DEFAULT 40.00 | |
| version | INTEGER | NOT NULL DEFAULT 1 | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- INDEX idx_assignments_class_subject ON assignments(class_id, subject_id) WHERE deleted_at IS NULL
- INDEX idx_assignments_teacher ON assignments(teacher_id, created_at DESC) WHERE deleted_at IS NULL
- INDEX idx_assignments_due_date ON assignments(due_date) WHERE deleted_at IS NULL AND is_published = TRUE
- INDEX idx_assignments_type ON assignments(school_id, assignment_type, created_at DESC) WHERE deleted_at IS NULL

#### assignment_questions

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| assignment_id | UUID | FK → assignments.id, NOT NULL | ON DELETE CASCADE |
| question_text | TEXT | NOT NULL | |
| question_type | question_type | NOT NULL | multiple_choice, true_false, short_answer, long_answer, essay |
| options | JSONB | | MCQ choices: [{"label":"A","text":"..."}] |
| correct_answer | TEXT | | For auto-grading |
| explanation | TEXT | | |
| points | DECIMAL(6,2) | NOT NULL DEFAULT 1.00, CHECK(points > 0) | |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | |
| tags | TEXT[] | | Optional tags for categorization |
| created_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- INDEX idx_aq_assignment ON assignment_questions(assignment_id, sort_order)

#### submissions

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| assignment_id | UUID | FK → assignments.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| status | attempt_status | NOT NULL DEFAULT 'pending' | pending, in_progress, submitted, graded, results_published |
| started_at | TIMESTAMPTZ | | For timed assessments |
| submitted_at | TIMESTAMPTZ | | |
| total_score_auto | DECIMAL(8,2) | | Auto-graded score |
| total_score_manual | DECIMAL(8,2) | | Teacher-graded score |
| total_score | DECIMAL(8,2) | | Computed |
| is_graded | BOOLEAN | NOT NULL DEFAULT FALSE | |
| graded_by | UUID | FK → users.id | |
| graded_at | TIMESTAMPTZ | | |
| teacher_remarks | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- UNIQUE(assignment_id, student_id)
- INDEX idx_submissions_grading_queue ON submissions(assignment_id, status, created_at ASC) WHERE is_graded = FALSE
- INDEX idx_submissions_student ON submissions(student_id, created_at DESC)

#### answers

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| submission_id | UUID | FK → submissions.id, NOT NULL | ON DELETE CASCADE |
| question_id | UUID | FK → assignment_questions.id, NOT NULL | |
| submitted_answer | TEXT | | |
| score_auto | DECIMAL(6,2) | | Auto-graded |
| score_manual | DECIMAL(6,2) | | Teacher-graded |
| is_correct | BOOLEAN | | |
| remarks | TEXT | | |
| answered_at | TIMESTAMPTZ | | Per-question timing |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | | |

**Indexes**:
- UNIQUE(submission_id, question_id)

### 3.7 NOTIFICATION LAYER

#### notifications

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| sender_id | UUID | FK → users.id | NULL for system |
| notification_type | notification_type | NOT NULL | academic, attendance, announcement, etc. |
| priority | VARCHAR(10) | NOT NULL DEFAULT 'normal' | low, normal, high, urgent |
| title | VARCHAR(200) | NOT NULL | |
| body | TEXT | | |
| metadata | JSONB | | |
| is_sent | BOOLEAN | NOT NULL DEFAULT FALSE | |
| sent_at | TIMESTAMPTZ | | |
| scheduled_at | TIMESTAMPTZ | | For scheduled delivery |
| created_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- INDEX idx_notifications_school_recent ON notifications(school_id, created_at DESC)
- INDEX idx_notifications_scheduled ON notifications(school_id, scheduled_at) WHERE scheduled_at IS NOT NULL AND is_sent = FALSE

#### notification_recipients

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| notification_id | UUID | FK → notifications.id, NOT NULL | ON DELETE CASCADE |
| user_id | UUID | FK → users.id | Recipient user |
| channel | notification_channel | NOT NULL | in_app, email, whatsapp, push |
| contact_address | VARCHAR(255) | | Email or phone for delivery |
| status | notification_status | NOT NULL DEFAULT 'pending' | pending, sent, delivered, failed |
| sent_at | TIMESTAMPTZ | | |
| delivered_at | TIMESTAMPTZ | | |
| read_at | TIMESTAMPTZ | | In-app read tracking |
| error_message | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- INDEX idx_nr_status_channel ON notification_recipients(status, channel, created_at ASC)
- INDEX idx_nr_user ON notification_recipients(user_id, created_at DESC)

### 3.8 LESSON PLANS LAYER (NEW)

#### lesson_plans

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| teacher_id | UUID | FK → teachers.id, NOT NULL | Owner |
| school_id | UUID | FK → schools.id, NOT NULL | |
| topic_id | UUID | FK → topics.id | Optional curriculum link |
| title | VARCHAR(200) | NOT NULL | |
| content | JSONB | NOT NULL | Structured: objectives, activities, materials, assessment |
| duration_minutes | INTEGER | | |
| is_shared | BOOLEAN | NOT NULL DEFAULT FALSE | Share with other teachers |
| is_ai_generated | BOOLEAN | NOT NULL DEFAULT FALSE | |
| version | INTEGER | NOT NULL DEFAULT 1 | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- INDEX idx_lp_teacher ON lesson_plans(teacher_id, created_at DESC) WHERE deleted_at IS NULL
- INDEX idx_lp_topic ON lesson_plans(topic_id) WHERE deleted_at IS NULL

### 3.9 ANNOUNCEMENTS LAYER (NEW)

#### announcements

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| author_id | UUID | FK → users.id, NOT NULL | Admin or principal |
| title | VARCHAR(200) | NOT NULL | |
| body | TEXT | NOT NULL | |
| target_roles | user_role[] | | NULL = all roles |
| is_pinned | BOOLEAN | NOT NULL DEFAULT FALSE | |
| is_published | BOOLEAN | NOT NULL DEFAULT TRUE | |
| published_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

**Indexes**:
- INDEX idx_announcements_school ON announcements(school_id, created_at DESC) WHERE deleted_at IS NULL AND is_published = TRUE

### 3.10 AI LAYER

#### ai_generations

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| user_id | UUID | FK → users.id, NOT NULL | Who triggered |
| entity_type | VARCHAR(50) | NOT NULL | homework, test, lesson_plan, report_comment, parent_summary, doubt_answer, insight, rubric |
| entity_id | UUID | | Associated entity |
| generation_type | VARCHAR(50) | | Sub-type |
| prompt | TEXT | NOT NULL | |
| response | TEXT | NOT NULL | |
| model | VARCHAR(100) | | e.g., gpt-4o-mini |
| tokens_input | INTEGER | | Cost tracking |
| tokens_output | INTEGER | | |
| duration_ms | INTEGER | | Performance |
| created_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- INDEX idx_ai_generation_type ON ai_generations(school_id, generation_type, created_at DESC)
- INDEX idx_ai_user ON ai_generations(user_id, created_at DESC)
- INDEX idx_ai_created ON ai_generations(school_id, created_at DESC)

### 3.11 RISK DETECTION LAYER (NEW)

#### student_risk_flags

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| student_id | UUID | FK → students.id, NOT NULL | |
| flag_type | VARCHAR(50) | NOT NULL | attendance_risk, failing_grade, incomplete_work, behavioral, drop_risk |
| severity | VARCHAR(20) | NOT NULL | low, medium, high, critical |
| description | TEXT | | |
| source | VARCHAR(50) | NOT NULL | 'ai', 'teacher', 'system' |
| is_resolved | BOOLEAN | NOT NULL DEFAULT FALSE | |
| resolved_by | UUID | FK → users.id | |
| resolved_at | TIMESTAMPTZ | | |
| created_at | TIMESTAMPTZ | NOT NULL | |
| updated_at | TIMESTAMPTZ | NOT NULL | |

**Indexes**:
- INDEX idx_srf_active ON student_risk_flags(school_id, severity, created_at DESC) WHERE is_resolved = FALSE
- INDEX idx_srf_student ON student_risk_flags(student_id, created_at DESC)

**Constraints**:
- UNIQUE(student_id, flag_type, source) — prevents duplicate flags of same type from same source. Use `ON CONFLICT (student_id, flag_type, source) DO UPDATE SET severity = EXCLUDED.severity, updated_at = now()` for upsert.
### 3.12 AUDIT LAYER

#### audit_logs

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| id | UUID | PK | |
| school_id | UUID | FK → schools.id, NOT NULL | |
| user_id | UUID | FK → users.id | Who acted |
| action | VARCHAR(50) | NOT NULL | created, updated, deleted, viewed, exported, overrode, logged_in, logged_out |
| entity_type | VARCHAR(50) | NOT NULL | Table name |
| entity_id | UUID | | Affected record ID |
| old_data | JSONB | | Before snapshot |
| new_data | JSONB | | After snapshot |
| ip_address | INET | | |
| user_agent | TEXT | | |
| session_id | UUID | | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Indexes**:
- INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC)
- INDEX idx_audit_user ON audit_logs(user_id, created_at DESC)
- INDEX idx_audit_created ON audit_logs(school_id, created_at DESC)
- **PARTITION BY RANGE (created_at)** — monthly or quarterly

### 3.13 PROGRESS MASTERY (Materialized View)

```sql
CREATE MATERIALIZED VIEW mv_progress_mastery AS
SELECT
    s.id AS student_id,
    s.school_id,
    lo.id AS learning_objective_id,
    lo.topic_id,
    lo.chapter_id,  -- Denormalized for performance
    lo.subject_id,  -- Denormalized for performance
    COUNT(DISTINCT a.id) AS total_assignments,
    COUNT(DISTINCT CASE WHEN sub.is_graded THEN a.id END) AS graded_assignments,
    AVG(CASE WHEN sub.is_graded THEN sub.total_score::FLOAT / NULLIF(a.max_score, 0) * 100 END) AS mastery_percentage,
    MAX(sub.updated_at) AS last_assessment_date
FROM students s
JOIN submissions sub ON sub.student_id = s.id
JOIN assignments a ON a.id = sub.assignment_id
JOIN assignment_questions aq ON aq.assignment_id = a.id
JOIN learning_objectives lo ON lo.id = a.lo_id
WHERE sub.is_graded = TRUE
  AND s.deleted_at IS NULL
  AND a.deleted_at IS NULL
GROUP BY s.id, s.school_id, lo.id, lo.topic_id, lo.chapter_id, lo.subject_id;
```

---

## 4. Duplicate Table Analysis

### 4.1 V1 Tables to DELETE

| V1 Table | Reason to DELETE | V2 Replacement |
|----------|------------------|----------------|
| `homeworks` | Duplicate schema with `tests` | `assignments` (type = 'homework') |
| `homework_questions` | Duplicate schema with `test_questions` | `assignment_questions` |
| `homework_submissions` | Duplicate schema with `test_attempts` | `submissions` |
| `homework_answers` | Duplicate schema with `test_answers` | `answers` |
| `tests` | Duplicate schema with `homeworks` | `assignments` (type = 'quiz'/'unit_test') |
| `test_questions` | Duplicate schema with `homework_questions` | `assignment_questions` |
| `test_attempts` | Duplicate schema with `homework_submissions` | `submissions` |
| `test_answers` | Duplicate schema with `homework_answers` | `answers` |
| `principals` | Zero unique columns; 1:1 with users | Removed; use `users.role = 'principal'` |
| `reports` | Reports should be views, not tables | Materialized views + on-demand generation |
| `periods` | Works fine but renamed for clarity | `timetable_slots` (rename to match domain language) |
| `timetable_entries` | Works fine but can simplify | Keep but rename to `timetable` |

### 4.2 V1 Tables to KEEP (Renamed or Restructured)

| V1 Table | V2 Table | Changes |
|----------|----------|---------|
| `schools` | `schools` | No changes |
| `users` | `users` | Add `last_login_at` for session tracking |
| `teachers` | `teachers` | No significant changes |
| `students` | `students` | No significant changes |
| `parents` | `parents` | No significant changes |
| `student_parents` | `student_parents` | Add `receive_email` flag |
| `classes` | `classes` | No significant changes |
| `class_enrollments` | `class_enrollments` | No significant changes |
| `subjects` | `subjects` | No significant changes |
| `teacher_class_subjects` | `teacher_class_subjects` | No significant changes |
| `attendance` | `attendance` | Add monthly partitioning |
| `academic_years` | `academic_years` | No changes |
| `academic_terms` | `academic_terms` | No changes |
| `ai_generations` | `ai_generations` | No changes |
| `audit_logs` | `audit_logs` | Add session_id, partition by time |

### 4.3 V1 Tables to MERGE

| V1 Tables | V2 Table | Merge Rationale |
|-----------|----------|----------------|
| `homeworks` + `tests` | `assignments` | Identical data shape with different type labels |
| `homework_questions` + `test_questions` | `assignment_questions` | Identical schema |
| `homework_submissions` + `test_attempts` | `submissions` | Both track student submission/attempt per assignment |
| `homework_answers` + `test_answers` | `answers` | Identical schema |

### 4.4 V2 Tables to ADD (New)

| Table | Rationale |
|-------|-----------|
| `chapters` | Core curriculum entity — enables curriculum-connected assignments |
| `topics` | Unit of teacher progress tracking and AI context |
| `learning_objectives` | Atomic unit of mastery tracking — enables per-LO analytics |
| `curriculum_progress` | Per-teacher coverage tracking — powers principal dashboard |
| `lesson_plans` | AI-generated and teacher-created plans — teacher intellectual property |
| `announcements` | School communications — separate from notifications system |
| `timetable_slots` | Renamed from V1 `periods`. School day time slots (e.g., "Period 1: 08:00–08:45"). |
| `timetable` | Renamed from V1 `timetable_entries`. Unified class and teacher schedule. |
| `student_risk_flags` | AI-driven risk detection — powers principal intervention workflow |
| `mv_progress_mastery` | Materialized view for learning mastery analytics |

### 4.5 Final Table Count

**V1**: 29 tables  
**V2**: 22 tables + 1 materialized view

| Category | Tables | vs V1 |
|----------|--------|-------|
| Tenant | 1 | Same |
| Identity | 5 | -1 (principals removed) |
| Academic | 6 | -1 (periods renamed, timetable simplified) |
| Curriculum | 4 | +4 (new) |
| Attendance | 1 | Same |
| Assignments | 4 | -6 (merged from 10) |
| Lesson Plans | 1 | +1 (new) |
| Announcements | 1 | +1 (new) |
| Notifications | 2 | Same |
| AI | 1 | Same |
| Risk Detection | 1 | +1 (new) |
| Audit | 1 | Same |
| **Total Tables** | **22 + 1 MV** | **-7 tables** |

---

## 5. Database Audit

### 5.1 Missing Tables (Before V2)

| Missing Table | Impact | Evidence |
|---------------|--------|----------|
| `chapters` | Assignments cannot link to curriculum. Teachers create ad-hoc homework with no curriculum context. AI has no curriculum context for generation. | V1 had NO curriculum entities. All assignments were freestanding. |
| `topics` | Progress tracking impossible. Teachers cannot indicate what they've covered. Principal cannot monitor curriculum delivery. | V1 had no progress tracking at all. |
| `learning_objectives` | Mastery tracking impossible. Cannot answer "has this student mastered photosynthesis?" | V1 had no mastery concept. |
| `curriculum_progress` | No feedback loop between teaching and curriculum planning. | V1 teachers had no way to mark progress. |
| `lesson_plans` | Teachers use Word/Google Docs. No AI generation, no sharing, no backup. | V1 had no lesson plan feature despite being an "AI Teacher OS". |
| `announcements` | V1 had `notifications` for everything. Announcements are fundamentally different (one-to-many, school-wide, target-role-filtered). | V1 had `announcements` table that was deleted in V1 cleanup. |
| `student_risk_flags` | No early warning system. At-risk students only identified after failing tests. | V1 principal dashboard had no risk detection. |

### 5.2 Redundant Tables (To Delete or Merge)

| Table | Verdict | Evidence |
|-------|---------|----------|
| `homeworks` | MERGE into `assignments` | Identical schema to `tests` (title, description, due_date, max_score, publish workflow, versioning). Only difference is `test_type` vs no-type. |
| `homework_questions` | MERGE into `assignment_questions` | Identical schema to `test_questions`. Zero design difference. |
| `homework_submissions` | MERGE into `submissions` | Identical schema to `test_attempts` (student_id, status, total_score, graded_by). |
| `homework_answers` | MERGE into `answers` | Identical schema to `test_answers`. |
| `tests` | MERGE into `assignments` | See homeworks. |
| `test_questions` | MERGE into `assignment_questions` | See homework_questions. |
| `test_attempts` | MERGE into `submissions` | Only difference: timing fields (started_at, answered_at). Add as nullable columns to unified `submissions`. |
| `test_answers` | MERGE into `answers` | Only difference: `answered_at`. Add as nullable column. |
| `principals` | DELETE | Zero unique columns. 1:1 with users. No queries join to this table that couldn't use `users.role = 'principal'`. |
| `reports` | DELETE | Reports are generated on-demand or via materialized views. The `data` JSONB column is an anti-pattern (no schema enforcement). |

### 5.3 Scalability Issues

| Issue | SeverITY | Details | Solution |
|-------|----------|---------|----------|
| **attendance table growth** | HIGH | At 50K students × 200 school days = **10M rows/year total** (across all 100 schools). At 50K total students, ~500/school, a CBSE school size. Queries filtering by `(class_id, date)` will degrade without partitioning. | Partition by quarter (10M rows/year fits quarterly). At 1,000 schools/500K students, switch to monthly. |
| **answers table growth** | MEDIUM | At 50K students × 20 assignments/year × 10 questions = **10M rows/year total** (across all 100 schools). | Partition by quarter. Archive submissions older than 3 years. |
| **audit_logs growth** | MEDIUM | All mutations logged. Estimated **5M rows/year** at 50K users. | Partition by quarter. Retention: 90 days for auth, 1 year for data changes, permanent for grade/role changes. Implement automated archiving. |
| **ai_generations growth** | MEDIUM | At 10 generations/teacher/day × 1,000 teachers = 10K/day = 3.6M/year. Prompts and responses are TEXT (potentially large). | Partition by month. Strip PII before storing. Compress response TEXT. Retention: 90 days. |
| **submissions growth** | LOW | At 50K students × 20 assignments/year = **1M rows/year total**. | Manageable without partitioning at this scale. Archive after 2 years. |
| **mv_progress_mastery refresh** | LOW | ~5M rows at scale (50K students × ~100 LOs each). | Use CONCURRENTLY refresh. Refresh every 15 min via pg_cron. |

### 5.4 Performance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Materialized view staleness** | Principal dashboard shows outdated mastery data | Refresh MV via pg_cron every 15 min during school hours. Allow manual refresh. |
| **N+1 on teacher dashboard** | Loading teacher's classes → subjects → students → attendance produces 4+ queries | Use CTEs or batch loading. Cache dashboard response for 60 seconds. |
| **Curriculum tree loading** | Loading all chapters + topics + LOs for one subject produces 3 queries | Single query with JOIN. Cache curriculum tree (rarely changes). |
| **Attendance rollup for 50K students** | Computing attendance percentage for whole-school report | Pre-compute daily rollup in a summary table. Use for all percentage calculations. |
| **Risk detection queries** | AI scans all students for risk flags | Run as background job (Celery), not inline in API. Cache risk flags. |

### 5.5 Security Risks

| Risk | Severity | Details | Mitigation |
|------|----------|---------|------------|
| **Student PII in response TEXT** | HIGH | AI generation stores raw LLM response. Student names may leak into prompts. | Strip PII before storing. Run PII scanner on stored responses. |
| **Answer key exposure** | HIGH | `correct_answer` in `assignment_questions` must NEVER be sent to students before grading. | API layer must filter. RLS cannot protect column-level access. **Schema-level mitigation**: Create two database views — `v_assignment_questions_teacher` (includes `correct_answer`, for teachers/admin/principal) and `v_assignment_questions_student` (excludes `correct_answer`, for students/parents). Backend queries against views by role. |
| **Cross-school data leak** | HIGH | If `school_id` filter is missing from any query, data leaks across tenants. | Every query MUST include `WHERE school_id = current_school_id`. Use RLS as defense-in-depth. |
| **Audit log tampering** | MEDIUM | Audit logs are in the same database as application data. | Database-level triggers prevent UPDATE/DELETE on audit_logs. Audit logs in separate schema with restricted permissions. |
| **Bulk data export** | MEDIUM | No limit on query results can lead to mass PII export. | Enforce pagination (max 500 rows). Log all exports. Rate-limit export endpoints. |

---

## 6. Audit Logging Tables

### 6.1 Design

The existing V1 `audit_logs` table is **adequate** with minor modifications:

```sql
-- V2 audit_logs (improved from V1)
CREATE TABLE audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL REFERENCES schools(id),
    user_id         UUID            REFERENCES users(id),
    session_id      UUID,                              -- NEW: link events in same session
    action          VARCHAR(50)     NOT NULL,           -- created, updated, deleted, viewed, exported, logged_in, logged_out, overrode
    entity_type     VARCHAR(50)     NOT NULL,           -- 'assignment', 'submission', 'attendance', 'user', etc.
    entity_id       UUID,
    old_data        JSONB,                              -- Before snapshot
    new_data        JSONB,                              -- After snapshot
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- ... automated via pg_cron
```

### 6.2 What Gets Logged

| Event | action | entity_type | old_data | new_data |
|-------|--------|-------------|----------|----------|
| Login success | `logged_in` | 'session' | NULL | {session_id, method} |
| Login failure | `login_failed` | 'session' | NULL | {attempt_count, ip} |
| Logout | `logged_out` | 'session' | NULL | {session_id} |
| User created | `created` | 'user' | NULL | {email, role} |
| User updated | `updated` | 'user' | {old_fields} | {new_fields} |
| User deactivated | `deactivated` | 'user' | {is_active: true} | {is_active: false} |
| Attendance marked | `created` | 'attendance' | NULL | {student_id, date, status} |
| Attendance edited | `updated` | 'attendance' | {old_status} | {new_status} |
| Attendance overridden | `overrode` | 'attendance' | {old_status} | {new_status, reason} |
| Assignment graded | `updated` | 'submission' | {score: null} | {score: 85} |
| Grade overridden | `overrode` | 'submission' | {old_score} | {new_score, reason} |
| AI generation | `created` | 'ai_generation' | NULL | {type, tokens, cost} |
| Data export | `exported` | 'report' | NULL | {type, row_count, format} |
| Permission change | `updated` | 'user_role' | {old_role} | {new_role} |
| Bulk student import | `imported` | 'student' | NULL | {count, file_name} |

### 6.3 Retention & Archiving

| Category | Retention | Action | 
|----------|-----------|--------|
| Authentication events | 90 days | DELETE after 90 days |
| AI generations | 90 days | DELETE after 90 days  
| Data access (exports, PII views) | 1 year | Archive to cold storage |
| Data mutations | 1 year | Archive to cold storage |
| Grade changes | Permanent | Never delete |
| Permission changes | Permanent | Never delete |
| Security events | 1 year | Archive to cold storage |

### 6.4 Access Control

- **Tables are append-only**: INSERT only. UPDATE/DELETE blocked by database triggers.
- **Read access**: super_admin (all), school_admin (school scope), principal (school scope, read-only)
- **No role can delete or modify audit records**.

---

## 7. Notification System Tables

### 7.1 Design

Two tables: `notifications` and `notification_recipients`.

This design supports:
- **In-app**: notification_recipients with `channel = 'in_app'` and `read_at` tracking
- **Email**: notification_recipients with `channel = 'email'` and `contact_address`
- **WhatsApp**: notification_recipients with `channel = 'whatsapp'` and `contact_address`
- **Push**: notification_recipients with `channel = 'push'` and device token in `contact_address`

### 7.2 Trigger Events

| Event | Triggered By | Priority | Channels | Target |
|-------|-------------|----------|----------|--------|
| Attendance marked absent | Teacher marks absent | normal | in_app, whatsapp | Student's parents |
| Assignment published | Teacher publishes | low | in_app, email | Students in class |
| Assignment due soon | System (24h before) | normal | in_app | Students |
| Assignment graded | Teacher grades | normal | in_app, email | Student, parents |
| Assessment scheduled | Teacher schedules | low | in_app | Students |
| Assessment results published | Teacher publishes results | high | in_app, email, whatsapp | Students, parents |
| Student at risk | AI detects risk | high | in_app | Teacher, principal, parents |
| Student flagged (attendance < 80%) | System | urgent | in_app, email, whatsapp | Parents, principal |
| Announcement posted | Admin/principal | normal | in_app | All users (role-filtered) |
| Account created | Admin | low | in_app, email | New user |
| Weekly summary (AI) | System (weekly) | low | in_app, email | Parents |

### 7.3 Delivery Rules

| Rule | Description |
|------|-------------|
| **Same-channel dedup** | Don't send WhatsApp if email already delivered same content in last 24h |
| **Parent cascade** | Try WhatsApp first, then email, then in-app |
| **Urgent override** | Urgent notifications send via ALL channels simultaneously |
| **Quiet hours** | No WhatsApp/email between 9PM-7AM (unless urgent) |
| **Opt-out** | Parents can opt-out per channel per student |
| **Retry** | Failed delivery retried 3× at 5-min intervals, then marked failed |

---

## 8. AI System Tables

### 8.1 Design

Single table: `ai_generations` (extended from V1).

```sql
CREATE TABLE ai_generations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL REFERENCES schools(id),
    user_id         UUID            NOT NULL REFERENCES users(id),
    entity_type     VARCHAR(50)     NOT NULL,
        -- 'assignment_question', 'lesson_plan', 'report_comment', 
        -- 'parent_summary', 'doubt_answer', 'principal_insight', 'rubric'
    generation_type VARCHAR(50),     -- Sub-category within entity_type
    entity_id       UUID,           -- The generated entity (if created)
    prompt          TEXT            NOT NULL,  -- Stripped of PII before storage
    response        TEXT            NOT NULL,  -- Stripped of PII before storage
    model           VARCHAR(100),   -- 'gpt-4o-mini', 'gpt-4o', claude-3-5-sonnet
    tokens_input    INTEGER,        -- Cost tracking
    tokens_output   INTEGER,
    duration_ms     INTEGER,        -- Performance monitoring
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
```

### 8.2 AI Features Mapped to Database

| AI Feature | entity_type | Stored? | Retrievable? | Cost Tracked? |
|------------|-------------|---------|--------------|---------------|
| Homework generation | `assignment_question` | Yes (prompt+response) | No (audit only) | Yes |
| Test generation | `assignment_question` | Yes | No | Yes |
| Lesson plan generation | `lesson_plan` | Yes (in lesson_plans table) | Yes | Yes |
| Report comment generation | `report_comment` | Yes (prompt+response) | No | Yes |
| Parent weekly summary | `parent_summary` | No (generated on demand) | No | Yes |
| Student doubt assistant | `doubt_answer` | Yes (for audit) | No | Yes |
| Principal insights | `principal_insight` | No (generated on demand) | No | Yes |
| Rubric generation | `rubric` | Yes (prompt+response) | Yes (if saved to lesson_plans) | Yes |

### 8.3 What Gets Stored vs. Not Stored

| Data | Stored? | Rationale |
|------|---------|-----------|
| Prompt text | ✅ Stored (PII-stripped) | Audit trail, debugging, model improvement |
| Response text | ✅ Stored (PII-stripped) | Audit trail, quality review |
| Generated lesson plan | ✅ Stored in `lesson_plans` | Teacher-owned, editable, reusable |
| Generated homework questions | ✅ Stored in `assignment_questions` | Teacher reviews and publishes |
| Generated test questions | ✅ Stored in `assignment_questions` | Teacher reviews and publishes |
| Generated report comments | ❌ Not stored beyond audit | Generated per-student, rarely reused |
| Parent weekly summaries | ❌ Not stored | Generated on demand, transient |
| Student doubt answers | ❌ Not stored beyond audit | Can be regenerated |
| Principal insights | ❌ Not stored | Generated on demand, always fresh |
| Raw LLM response | ✅ Stored in response column | Debugging, compliance |
| Token counts | ✅ Stored | Cost tracking, usage analytics |
| PII (student names, etc.) | ❌ Stripped before storage | Privacy compliance |

### 8.4 Quota & Rate Limiting Schema

Not a table — enforced at application level:

```python
# Per-user daily quota (stored in users.metadata or school settings)
{
  "ai_quota": {
    "teacher": {"generations_per_day": 100, "tokens_per_day": 40000},
    "student": {"doubts_per_day": 20},
    "principal": {"insights_per_day": 10}
  }
}
```

---

## 9. Analytics Tables

### 9.1 Design Philosophy

Analytics data is **mostly computed, not stored**. The database stores:

1. **Raw events** (attendance, submissions, etc.) — the source of truth
2. **Materialized views** — pre-computed rollups for dashboard performance
3. **Risk flags** — AI-generated flags (stored in `student_risk_flags`)

### 9.2 Materialized Views

#### mv_progress_mastery (defined above in Section 3.13)

Powers: Student progress dashboard, Learning objective mastery chart

#### mv_daily_attendance_summary

```sql
CREATE MATERIALIZED VIEW mv_daily_attendance_summary AS
SELECT
    school_id,
    class_id,
    date,
    COUNT(*) AS total_students,
    COUNT(*) FILTER (WHERE status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_count,
    COUNT(*) FILTER (WHERE status = 'late') AS late_count,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('present', 'late'))::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 1
    ) AS present_percentage
FROM attendance
GROUP BY school_id, class_id, date;
```

Powers: Principal attendance dashboard, teacher attendance sheet, parent attendance view

#### mv_teacher_activity

```sql
CREATE MATERIALIZED VIEW mv_teacher_activity AS
SELECT
    teacher_id,
    school_id,
    academic_term_id,
    COUNT(DISTINCT a.id) AS assignments_created,
    COUNT(DISTINCT sub.id) FILTER (WHERE sub.is_graded = TRUE) AS submissions_graded,
    COUNT(DISTINCT cp.id) AS progress_marked,
    COUNT(DISTINCT ag.id) AS ai_generations,
    MAX(a.created_at) AS last_activity
FROM teachers t
LEFT JOIN assignments a ON a.teacher_id = t.id AND a.deleted_at IS NULL
LEFT JOIN submissions sub ON sub.assignment_id IN (SELECT id FROM assignments WHERE teacher_id = t.id)
LEFT JOIN curriculum_progress cp ON cp.teacher_id = t.id
LEFT JOIN ai_generations ag ON ag.user_id = t.user_id AND ag.created_at >= NOW() - INTERVAL '30 days'
GROUP BY teacher_id, school_id, academic_term_id;
```

Powers: Principal teacher activity view, admin dashboard

### 9.3 Risk Detection (Application-Level, Not Database)

Risk detection runs as a background job (Celery) and writes results to `student_risk_flags`:

```python
# Risk detection algorithm (pseudocode)
def detect_risks():
    for student in active_students:
        risks = []
        
        # Attendance risk
        if student.attendance_percentage_30_days < 80:
            risks.append({
                "flag_type": "attendance_risk",
                "severity": "high" if student.attendance_percentage_30_days < 70 else "medium"
            })
        
        # Grade risk  
        if student.average_score_last_3_assessments < 40:
            risks.append({
                "flag_type": "failing_grade",
                "severity": "critical" if student.average_score < 30 else "high"
            })
        
        # Incomplete work risk
        if student.incomplete_submissions_count > 3:
            risks.append({
                "flag_type": "incomplete_work",
                "severity": "high"
            })
        
        # Create/update risk flags in student_risk_flags table
```

### 9.4 Principal Dashboard Queries

| Dashboard Widget | Query Source | Refresh |
|-----------------|-------------|---------|
| Attendance trend (30-day) | `mv_daily_attendance_summary` | Daily |
| Class performance ranking | `mv_progress_mastery` | Hourly |
| Curriculum completion % | `curriculum_progress` | Real-time |
| Teacher activity score | `mv_teacher_activity` | Daily |
| At-risk student count | `student_risk_flags WHERE is_resolved = FALSE` | Real-time |
| Active flags by severity | `student_risk_flags` GROUP BY severity | Real-time |

---

## 10. PostgreSQL Production Recommendations

### 10.1 Index Strategy

**Must-have indexes** (total: ~45, down from 55 in V1):

| Priority | Index | Reason |
|----------|-------|--------|
| P0 | All PKs, UNIQUE constraints | Data integrity |
| P0 | attendance(class_id, date) | Most-used teacher query |
| P0 | submissions(assignment_id, student_id) | UNIQUE constraint for submissions |
| P0 | assignments(teacher_id) | Teacher dashboard |
| P0 | student_parents(parent_id) | Parent portal |
| P1 | notifications(school_id, created_at) | Notification feed |
| P1 | teacher_class_subjects(teacher_id, term_id) | Permission scoping |
| P1 | curriculum_progress(teacher_id) | Curriculum tracking |
| P1 | audit_logs(entity_type, entity_id) | Audit trail |
| P1 | ai_generations(school_id, created_at) | Cost tracking |
| P2 | assignments(lo_id) | Mastery computation |
| P2 | chapters(subject_id, sort_order) | Curriculum tree |
| P2 | risk_flags(school_id, severity) | Principal dashboard |

**Indexes from V1 to remove**: All homework_*, test_* indexes (tables removed).

### 10.2 Partitioning Strategy

| Table | Partition Key | Schedule | Rows/year (100 schools, 50K total students) |
|-------|--------------|----------|--------------------------------------------|
| `attendance` | `date` (quarterly) | Create 4 quarters ahead | 10M |
| `audit_logs` | `created_at` (quarterly) | Create 4 quarters ahead | 5M |
| `ai_generations` | `created_at` (quarterly) | Create 4 quarters ahead | 3.6M |
| `submissions` | No partitioning needed | — | 1M |

**Note**: At 1,000+ schools (500K students), switch from quarterly to monthly partitioning.

### 10.3 Caching Strategy

| Cache | Data | TTL | Invalidation |
|-------|------|-----|--------------|
| Teacher dashboard | Classes, subjects, assignments, attendance today | 60 seconds | On attendance mark, assignment create |
| Curriculum tree | Chapters + topics + LOs per subject | 1 hour | On curriculum edit (rare) |
| Student profile | User + student + class data | 5 minutes | On profile edit |
| Principal dashboard | Aggregated analytics | 15 minutes | On risk flag update |
| Materialized View (progress) | Per-student mastery | 15 minutes | On grade, on-demand refresh |

### 10.4 Soft Delete Strategy

| Table | Soft Delete Column | Cascade Behavior |
|-------|-------------------|-----------------|
| All user-related | `deleted_at` | Children preserved (orphaned) for audit |
| schools | `deleted_at` | Prevents deletion if children exist |
| classes | `deleted_at` | Students auto-unenrolled via notification |
| assignments | `deleted_at` | Submissions preserved (archived) |
| Most tables | `deleted_at` | Data preserved for compliance, hidden from UI |

**Rule**: Soft-delete is read-only. Data is never physically deleted unless:
- Explicit admin request (logged)
- Automated archival (after retention period)
- GDPR deletion request (full cascade with audit)

### 10.5 Connection Pooling

```yaml
# Production configuration
max_connections: 200  # Per PostgreSQL instance
pool_size: 20         # Per application instance
pool_overflow: 10     # Burst capacity
pool_timeout: 30      # Seconds to wait for connection

# With 3 app instances → 90 concurrent database connections
# Headroom: 110 connections for admin, reports, background jobs
```

### 10.6 RLS Strategy (Defense-in-Depth)

```sql
-- Every table gets these RLS policies:

-- Policy 1: School isolation
CREATE POLICY school_isolation ON {table}
    FOR ALL
    USING (school_id = current_setting('app.current_school_id')::UUID);

-- Policy 2: Role-based access (example for assignments)
CREATE POLICY teacher_own_assignments ON assignments
    FOR SELECT
    USING (
        teacher_id = current_setting('app.current_teacher_id')::UUID
        OR current_setting('app.current_role') IN ('school_admin', 'principal')
    );

CREATE POLICY student_view_published ON assignments
    FOR SELECT
    USING (
        is_published = TRUE 
        AND class_id IN (
            SELECT class_id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID
        )
    );
```

### 10.7 Backup Strategy

| Backup Type | Frequency | Retention | Target |
|-------------|-----------|-----------|--------|
| Full database | Daily | 30 days | S3 / GCS |
| WAL archiving | Continuous | 7 days | S3 / GCS |
| Point-in-time recovery | Via WAL | 7 days | Restore to any point |
| Schema-only | On migration | Permanent | Version control (git) |

### 10.8 Performance SLAs

| Query Type | Target P99 | Achievable With |
|------------|-----------|-----------------|
| Simple lookup (PK) | <5ms | PK index |
| Class roster | <50ms | Composite index |
| Daily attendance sheet | <100ms | Composite index + INCLUDE |
| Teacher dashboard | <500ms | Caching + composite indexes |
| Student dashboard | <500ms | Caching + composite indexes |
| Principal dashboard | <2s | Materialized views + caching |
| Curriculum tree | <100ms | Cached (rarely changes) |
| AI generation cost report | <3s | Partitioned table + time-range index |
| Risk detection scan | <5s (background) | Dedicated query window |

---

## 11. Final Summary & Migration Plan

### 11.1 Final Table Count

| Category | Tables | ENUMs |
|----------|--------|-------|
| Tenant | 1 | 0 |
| Identity | 5 | 2 (user_role, parent_relationship) |
| Academic | 6 | 1 (enrollment_status) |
| Curriculum | 4 | 0 |
| Attendance | 1 | 1 (attendance_status) |
| Assignments | 4 | 3 (question_type, attempt_status, assignment_type NEW) |
| Notifications | 2 | 3 (notification_type, notification_channel, notification_status) |
| Lesson Plans | 1 | 0 |
| Announcements | 1 | 0 |
| AI | 1 | 0 |
| Risk Detection | 1 | 0 |
| Audit | 1 | 0 |
| **Total Tables** | **22 + 1 MV** | **10 ENUMs** |

### 11.2 V1 → V2 Migration Plan

**Phase 1: Greenfield Schema (Week 1)**

Build the V2 schema from scratch. Do NOT migrate V1 data.

1. Create ENUMs (10 types, down from 11)
2. Create Tables (22 tables, down from 29)
3. Create Indexes (~45, down from 55+)
4. Create RLS Policies (~50, down from ~90)
5. Create Materialized Views (3)
6. Create triggers (updated_at, audit, restrict hard deletes)

**Phase 2: Seed CBSE Curriculum (Week 1)**

1. Load CBSE curriculum data (chapters, topics, LOs for Classes 1-10)
2. All 7 subjects × 10 classes × ~15 chapters × ~5 topics = ~5,250 curriculum records

**Phase 3: Schema Validation (Week 2)**

1. Insert test data (1 school, 1 admin, 2 teachers, 50 students, 50 parents)
2. Run all API endpoints against real schema
3. Verify RLS policies with each role
4. Load-test attendance (simulate 50K students × 30 days)
5. Verify materialized view refresh performance

**Phase 4: Production Deployment (Week 3)**

1. Apply schema to production (empty database)
2. Point new API at new schema
3. Run schema validation tests against production
4. Monitor query performance for 1 week
5. Enable RLS policies after initial data load

**Phase 5: Go Live (Week 4)**

1. Open to first school (pilot)
2. Verify all queries meet SLAs with real traffic
3. Enable background jobs (risk detection, MV refresh, notification delivery)
4. Onboard remaining schools

### 11.3 Schema Comparison: V1 → V2

```
V1 (29 tables)                              V2 (22 tables + 1 MV)
=============                               =====================
schools                                     schools
users                                       users
teachers                                    teachers
principals                                  [DELETED]
students                                    students
parents                                     parents
student_parents                             student_parents
academic_years                              academic_years
academic_terms                              academic_terms
classes                                     classes
class_enrollments                           class_enrollments
subjects                                    subjects
teacher_class_subjects                      teacher_class_subjects
periods                                     timetable_slots (renamed)
timetable_entries                           timetable (renamed)
attendance                                  attendance
homeworks                                   [MERGED → assignments]
homework_questions                          [MERGED → assignment_questions]
homework_submissions                        [MERGED → submissions]
homework_answers                            [MERGED → answers]
tests                                       [MERGED → assignments]
test_questions                              [MERGED → assignment_questions]
test_attempts                               [MERGED → submissions]
test_answers                                [MERGED → answers]
reports                                     [DELETED → materialized views]
notifications                               notifications
notification_recipients                     notification_recipients
ai_generations                              ai_generations
audit_logs                                  audit_logs
                                            [NEW] chapters
                                            [NEW] topics
                                            [NEW] learning_objectives
                                            [NEW] curriculum_progress
                                            [NEW] lesson_plans
                                            [NEW] announcements
                                            [NEW] student_risk_flags
                                            [NEW] mv_progress_mastery (MV)
                                            [NEW] mv_daily_attendance_summary (MV)
                                            [NEW] mv_teacher_activity (MV)
```

### 11.4 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Curriculum graph too rigid** for some subjects (GK, Computer Science) | Medium | Low | Make `chapter_id` optional in `topics`. Allow flat topic lists per subject. |
| **Unified assignments lose flexibility** for timed tests vs untimed homework | Medium | Medium | Add nullable `duration_minutes`, `scheduled_at`, `started_at` columns. Differing behavior at API/UI level. |
| **Materialized view refresh blocks writes** | Low | High | Use CONCURRENTLY option. Refresh during off-hours. Use application-level caching as fallback. |
| **Attendance partitions become too large** (100K students × 200 days) | Medium | Medium | Partition by week, not month. Archive >1 year old data. |
| **AI generation storage grows too fast** (10K/day × 2KB = 700MB/month) | Medium | Low | Compress TEXT columns. Auto-delete >90 days. No impact on query performance. |

### 11.5 Final Verdict

**Score**: 9/10

**Strengths**:
- 22 tables (down from 29) — each justified
- Curriculum engine (chapters → topics → LOs) — the core differentiator
- Unified assignment model — eliminates 6 duplicate tables
- Progress mastery as materialized view — performance and correctness
- Proper partitioning strategy for high-volume tables
- Clear ownership and scoping rules
- RLS for defense-in-depth

**Weaknesses**:
- `mv_progress_mastery` refresh strategy needs monitoring in production
- `timetable_slots` and `timetable` are legacy carry-overs with limited V2 value
- `lesson_plans.content` JSONB should define expected structure (see Section 3.8 column notes)
- No explicit table for notification templates (manageable application-side)

**Recommendation**: Proceed to implementation. The schema is production-ready for 100 schools. Revisit partitioning and materialized view refresh strategy after 6 months of production data.

---

## Appendix: ENUMs for V2

```sql
-- 10 ENUMs (down from 11 in V1)

CREATE TYPE user_role AS ENUM (
    'super_admin', 'school_admin', 'principal', 'teacher', 'student', 'parent'
);

CREATE TYPE attendance_status AS ENUM (
    'present', 'absent', 'late', 'half_day'
);

CREATE TYPE question_type AS ENUM (
    'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'essay'
);

CREATE TYPE attempt_status AS ENUM (
    'pending', 'in_progress', 'submitted', 'graded', 'results_published'
);

CREATE TYPE assignment_type AS ENUM (  -- NEW
    'homework', 'quiz', 'unit_test', 'worksheet', 'project', 'practice'
);

CREATE TYPE notification_channel AS ENUM (
    'in_app', 'email', 'whatsapp', 'push'
);

CREATE TYPE notification_type AS ENUM (
    'academic', 'attendance', 'announcement', 'behavioral', 'emergency', 'system', 'other'
);

CREATE TYPE notification_status AS ENUM (
    'pending', 'sent', 'delivered', 'failed'
);

CREATE TYPE parent_relationship AS ENUM (
    'father', 'mother', 'guardian', 'other'
);

CREATE TYPE enrollment_status AS ENUM (
    'active', 'promoted', 'transferred', 'graduated', 'withdrawn'
);

-- REMOVED from V1: report_type (use materialized views), gender (use VARCHAR in students table)
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Generate V2 SQL schema files (enums.sql → tables.sql → indexes.sql → rls.sql → triggers.sql → materialized_views.sql)
