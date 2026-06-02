-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- tables.sql — Complete Table Definitions
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed AFTER enums.sql and BEFORE indexes.sql.
-- 
-- Conventions:
--   • UUID primary keys via gen_random_uuid() (pgcrypto extension)
--   • All tenant-scoped tables include school_id for multi-tenancy
--   • Soft deletes via deleted_at TIMESTAMPTZ (NULL = active record)
--   • created_at/updated_at on all mutable tables
--   • updated_at is NOT auto-maintained here (see triggers.sql)
--   • Foreign keys are added AFTER all table creations to handle
--     forward references regardless of table order
--   • COMMENT statements document every table and key design decisions
-- =============================================================================

-- =============================================================================
-- TENANT & IDENTITY LAYER
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1 schools — Tenant root entity
-- Every record in the system belongs to exactly one school via school_id.
-- Schools have a unique short code (for API use) and an optional custom
-- domain for white-label portals.
-- settings JSONB stores school-specific configuration (grading scales,
-- term structures, feature flags) without requiring schema migrations.
-- ---------------------------------------------------------------------------

CREATE TABLE schools (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200)    NOT NULL,
    code            VARCHAR(20)     NOT NULL,
    address         TEXT,
    phone           VARCHAR(20),
    email           CITEXT,
    domain          VARCHAR(100),
    logo_url        VARCHAR(500),
    settings        JSONB           NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT schools_code_uk UNIQUE (code),
    CONSTRAINT schools_domain_uk UNIQUE (domain)
);

COMMENT ON TABLE  schools IS 'Tenant root — each school is a separate tenant';
COMMENT ON COLUMN schools.code IS 'Short unique code for API identification (e.g. "ATH-001")';
COMMENT ON COLUMN schools.domain IS 'Optional custom subdomain for white-label school portal';
COMMENT ON COLUMN schools.settings IS 'JSONB for flexible school-level configuration without migrations';


-- =============================================================================
-- ACADEMIC CALENDAR
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 academic_years — Academic calendar years
-- Defines the academic calendar years for each school (e.g. "2025-2026").
-- Each school manages its own academic years independently.
-- is_current flags the active year for simplified queries.
-- The UNIQUE(school_id, name) constraint prevents duplicate year names
-- within the same school.
-- ---------------------------------------------------------------------------

CREATE TABLE academic_years (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID        NOT NULL,
    name            VARCHAR(50) NOT NULL,
    start_date      DATE        NOT NULL,
    end_date        DATE        NOT NULL,
    is_current      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT academic_years_date_check
        CHECK (end_date > start_date),
    CONSTRAINT academic_years_school_name_uk
        UNIQUE (school_id, name)
);

COMMENT ON TABLE  academic_years IS 'Academic calendar years per school (e.g. "2025-2026")';
COMMENT ON COLUMN academic_years.name IS 'Display name for the academic year, e.g. "2025-2026"';
COMMENT ON COLUMN academic_years.is_current IS 'Only one year per school should be current at a time';


-- ---------------------------------------------------------------------------
-- 2.2 academic_terms — Terms within an academic year
-- Homework, tests, and attendance are scoped to terms rather than full years
-- to enable term-by-term reporting and grade calculation.
-- The UNIQUE(academic_year_id, name) constraint prevents duplicate term
-- names within the same academic year.
-- ---------------------------------------------------------------------------

CREATE TABLE academic_terms (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id  UUID        NOT NULL,
    school_id         UUID        NOT NULL,
    name              VARCHAR(50) NOT NULL,
    start_date        DATE        NOT NULL,
    end_date          DATE        NOT NULL,
    is_current        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,

    CONSTRAINT academic_terms_date_check
        CHECK (end_date > start_date),
    CONSTRAINT academic_terms_year_name_uk
        UNIQUE (academic_year_id, name)
);

COMMENT ON TABLE  academic_terms IS 'Terms within each academic year (e.g. "Term 1", "Term 2")';
COMMENT ON COLUMN academic_terms.is_current IS 'Only one term per school should be current at a time';


-- =============================================================================
-- IDENTITY & ACCESS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 users — Unified authentication principal
-- Serves as the single auth principal for all roles: super_admin,
-- school_admin, principal, teacher, student, and parent.
-- Uses CITEXT for case-insensitive email storage and lookups.
-- The composite UNIQUE(school_id, email) allows the same email to exist
-- across different schools while maintaining uniqueness per tenant.
-- metadata JSONB stores school-specific profile fields without migrations.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    email           CITEXT          NOT NULL,
    phone           VARCHAR(20),
    supabase_user_id UUID            NOT NULL,
    first_name      VARCHAR(100)    NOT NULL,
    last_name       VARCHAR(100)    NOT NULL,
    role            user_role       NOT NULL,
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    locale          VARCHAR(10)     NOT NULL DEFAULT 'en',
    metadata        JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT users_school_email_uk UNIQUE (school_id, email),
    CONSTRAINT users_supabase_id_uk UNIQUE (supabase_user_id)
);

COMMENT ON TABLE  users IS 'Unified auth principal for all roles (admin, principal, teacher, student, parent)';
COMMENT ON COLUMN users.email IS 'CITEXT enables case-insensitive email lookups';
COMMENT ON COLUMN users.role IS 'Determines RLS policy behaviour and feature access';
COMMENT ON COLUMN users.metadata IS 'Flexible JSONB for school-specific user fields';


-- =============================================================================
-- STAFF & FACULTY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1 teachers — Teacher-specific profile
-- Extends the users table via user_id (1:1 relationship).
-- employee_code is unique per school for HR tracking.
-- is_class_teacher is a denormalized flag for quick filtering; the actual
-- form-teacher assignment is tracked in teacher_class_subjects.
-- ---------------------------------------------------------------------------

CREATE TABLE teachers (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    school_id       UUID            NOT NULL,
    employee_code   VARCHAR(30)     NOT NULL,
    qualification   VARCHAR(200),
    specialization  VARCHAR(200),
    hire_date       DATE            NOT NULL,
    is_class_teacher BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT teachers_school_employee_uk UNIQUE (school_id, employee_code),
    CONSTRAINT teachers_user_uk UNIQUE (user_id)
);

COMMENT ON TABLE teachers IS 'Teacher-specific profile data extending users table';


-- ---------------------------------------------------------------------------
-- 4.2 principals — Principal-specific profile (first-class role)
-- Principals have distinct permissions, dashboards, and profile information
-- from teachers. A principal oversees school-wide operations including
-- curriculum, discipline, reports, and teacher management.
--
-- Design decision: This is a separate table, not a flag on teachers,
-- because principals have fundamentally different permissions, dashboards,
-- and profile fields (appointment_type, tenure dates). Merging them would
-- complicate RLS policies and create nullable columns specific to each role.
-- appointment_type tracks the nature of the appointment (permanent, acting,
-- interim). tenure_end_date is NULL while the principal is currently serving.
-- ---------------------------------------------------------------------------

CREATE TABLE principals (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL,
    school_id           UUID            NOT NULL,
    employee_code       VARCHAR(30)     NOT NULL,
    qualification       VARCHAR(200),
    appointment_type    VARCHAR(50)     NOT NULL DEFAULT 'permanent',
    tenure_start_date   DATE            NOT NULL,
    tenure_end_date     DATE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT principals_school_employee_uk UNIQUE (school_id, employee_code),
    CONSTRAINT principals_user_uk UNIQUE (user_id)
);

COMMENT ON TABLE  principals IS 'Principal-specific profile — first-class role separate from teachers';
COMMENT ON COLUMN principals.appointment_type IS 'Type: permanent, acting, interim, etc.';
COMMENT ON COLUMN principals.tenure_end_date IS 'NULL while the principal is currently serving';


-- ---------------------------------------------------------------------------
-- 4.3 parents — Parent/guardian profile
-- Extends the users table via user_id (1:1 relationship).
-- is_verified tracks whether the parent identity has been confirmed.
-- The actual student-parent relationship (which children belong to which
-- parent) is modeled in the student_parents junction table.
-- ---------------------------------------------------------------------------

CREATE TABLE parents (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    school_id       UUID            NOT NULL,
    occupation      VARCHAR(100),
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT parents_user_uk UNIQUE (user_id)
);

COMMENT ON TABLE parents IS 'Parent/guardian profile data extending users table';
COMMENT ON COLUMN parents.is_verified IS 'Whether the parent identity has been confirmed';


-- =============================================================================
-- ACADEMIC STRUCTURE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 classes — Class groups
-- Represents a cohort group (e.g. "Grade 10" section "A").
-- The combination of name + section + academic_year uniquely identifies
-- a class per school. class_teacher_id (form teacher) is optional.
-- capacity limits the maximum number of students (1–100).
-- ---------------------------------------------------------------------------

CREATE TABLE classes (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    name            VARCHAR(50)     NOT NULL,
    section         VARCHAR(20),
    academic_year_id UUID           NOT NULL,
    class_teacher_id UUID,
    room_number     VARCHAR(20),
    capacity        INTEGER         NOT NULL DEFAULT 30,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT classes_school_year_section_uk
        UNIQUE (school_id, name, section, academic_year_id),
    CONSTRAINT classes_capacity_check
        CHECK (capacity > 0 AND capacity <= 100)
);

COMMENT ON TABLE  classes IS 'Class groups — e.g. "Grade 10", section "A"';
COMMENT ON COLUMN classes.class_teacher_id IS 'Optional form teacher reference';
COMMENT ON COLUMN classes.capacity IS 'Maximum student capacity (1–100)';


-- ---------------------------------------------------------------------------
-- 5.2 subjects — Academic subjects
-- Subjects offered at a school (e.g. "Mathematics", "Physics").
-- is_core distinguishes core/compulsory from elective subjects.
-- Both code and name must be unique per school.
-- ---------------------------------------------------------------------------

CREATE TABLE subjects (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    code            VARCHAR(20)     NOT NULL,
    description     TEXT,
    is_core         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT subjects_school_code_uk UNIQUE (school_id, code),
    CONSTRAINT subjects_school_name_uk UNIQUE (school_id, name)
);

COMMENT ON TABLE  subjects IS 'Academic subjects offered at each school';
COMMENT ON COLUMN subjects.is_core IS 'TRUE for core/compulsory, FALSE for elective';


-- =============================================================================
-- STUDENTS & ENROLLMENTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6.1 students — Student-specific profile
-- Extends the users table via user_id (1:1 relationship).
-- class_id is a denormalized pointer to the student's current class for
-- fast queries (the canonical enrollment history is in class_enrollments).
-- admission_number is unique per school; roll_number is unique per class.
-- ---------------------------------------------------------------------------

CREATE TABLE students (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID          NOT NULL,
    school_id         UUID          NOT NULL,
    class_id          UUID          NOT NULL,
    admission_number  VARCHAR(30)   NOT NULL,
    roll_number       VARCHAR(10),
    date_of_birth     DATE,
    gender            gender,
    enrollment_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,

    CONSTRAINT students_school_admission_uk UNIQUE (school_id, admission_number),
    CONSTRAINT students_user_uk UNIQUE (user_id),
    CONSTRAINT students_school_roll_uk UNIQUE (school_id, class_id, roll_number)
);

COMMENT ON TABLE  students IS 'Student-specific profile extending users table';
COMMENT ON COLUMN students.class_id IS 'Current class (denormalized); canonical history is in class_enrollments';
COMMENT ON COLUMN students.admission_number IS 'Unique admission number per school';
COMMENT ON COLUMN students.roll_number IS 'Class-internal roll number, unique per school+class';


-- ---------------------------------------------------------------------------
-- 6.2 student_parents — Student ↔ Parent junction table
-- Enables a many-to-many relationship: a student can have multiple parents
-- (father, mother, guardian), and a parent can have multiple children.
-- receive_whatsapp enables per-relationship opt-in for WhatsApp notifications.
-- is_primary_contact identifies the parent to contact first in emergencies.
-- ---------------------------------------------------------------------------

CREATE TABLE student_parents (
    id                UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID                NOT NULL,
    parent_id         UUID                NOT NULL,
    school_id         UUID                NOT NULL,
    relationship      parent_relationship NOT NULL,
    is_primary_contact BOOLEAN            NOT NULL DEFAULT FALSE,
    receive_whatsapp  BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT student_parents_pair_uk UNIQUE (student_id, parent_id)
);

COMMENT ON TABLE  student_parents IS 'Junction table: many-to-many student↔parent relationships';
COMMENT ON COLUMN student_parents.relationship IS 'e.g. father, mother, guardian, other';
COMMENT ON COLUMN student_parents.receive_whatsapp IS 'Per-relationship opt-in for WhatsApp notifications';

-- Note for indexes.sql: Create a partial unique index for primary contact enforcement:
--   CREATE UNIQUE INDEX idx_sp_primary_contact
--   ON student_parents(student_id) WHERE is_primary_contact = TRUE;


-- ---------------------------------------------------------------------------
-- 6.3 class_enrollments — Student enrollment history
-- Tracks student movement across classes and academic years with full
-- history preservation. Examples:
--   2025 → Grade 8A (active)
--   2026 → Grade 9A (completed)
--   2027 → Grade 10A (active)
--
-- The UNIQUE(student_id, academic_year_id) constraint ensures a student
-- can only be enrolled in one class per academic year.
-- students.class_id serves as a denormalized pointer to the current class;
-- this table is the canonical source for all historical enrollments.
-- status values: active, promoted, transferred, graduated, withdrawn (enrollment_status ENUM)
-- ---------------------------------------------------------------------------

CREATE TABLE class_enrollments (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID            NOT NULL,
    student_id        UUID            NOT NULL,
    class_id          UUID            NOT NULL,
    academic_year_id  UUID            NOT NULL,
    enrolled_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ,
    status            enrollment_status NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT ce_student_year_uk UNIQUE (student_id, academic_year_id)
);

COMMENT ON TABLE  class_enrollments IS 'Student enrollment history across classes and academic years';
COMMENT ON COLUMN class_enrollments.status IS 'Enrollment status: active, promoted, transferred, graduated, withdrawn';
COMMENT ON COLUMN class_enrollments.enrolled_at IS 'When the student joined this class';
COMMENT ON COLUMN class_enrollments.completed_at IS 'When the student completed or moved from this class';


-- =============================================================================
-- TEACHER ASSIGNMENTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 teacher_class_subjects — Teacher ↔ Class ↔ Subject mapping
-- Maps teachers to the classes and subjects they teach in a given term.
-- Supports multiple subjects per teacher and multiple teachers per class
-- (team teaching). is_class_teacher indicates the form teacher for a class.
-- The UNIQUE constraint prevents duplicate assignments.
-- ---------------------------------------------------------------------------

CREATE TABLE teacher_class_subjects (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID            NOT NULL,
    class_id        UUID            NOT NULL,
    subject_id      UUID            NOT NULL,
    school_id       UUID            NOT NULL,
    academic_term_id UUID           NOT NULL,
    is_class_teacher BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT tcs_teacher_class_subject_term_uk
        UNIQUE (teacher_id, class_id, subject_id, academic_term_id)
);

COMMENT ON TABLE  teacher_class_subjects IS 'Maps teachers → classes → subjects per term';
COMMENT ON COLUMN teacher_class_subjects.is_class_teacher IS 'TRUE if this teacher is the form teacher for this class';


-- =============================================================================
-- TIMETABLE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 8.1 periods — School day time slots
-- Defines the time slots that make up a school day (e.g. "Period 1: 08:00–08:45",
-- "Morning Break: 09:30–09:50"). Each school defines its own period structure
-- independently. period_number determines chronological ordering.
-- is_break distinguishes instructional periods from breaks (recess, lunch).
-- The UNIQUE(school_id, period_number) constraint ensures period numbers
-- are sequential and non-conflicting per school.
-- ---------------------------------------------------------------------------

CREATE TABLE periods (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    name            VARCHAR(50)     NOT NULL,
    period_number   INTEGER         NOT NULL,
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    is_break        BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT periods_school_number_uk UNIQUE (school_id, period_number),
    CONSTRAINT periods_time_check CHECK (end_time > start_time)
);

COMMENT ON TABLE  periods IS 'School day time slots — each school defines its own period structure';
COMMENT ON COLUMN periods.name IS 'Display name: "Period 1", "Morning Break", "Lunch", etc.';
COMMENT ON COLUMN periods.period_number IS 'Chronological order (1 = first period of the day)';
COMMENT ON COLUMN periods.is_break IS 'TRUE for recess/lunch periods (no subject assigned)';


-- ---------------------------------------------------------------------------
-- 8.2 timetable_entries — Unified class and teacher schedule
-- The single source of truth for who teaches what subject to which class,
-- in which period, on which day of the week, during a given academic term.
--
-- Replaces the need for separate teacher_schedules, class_schedules, and
-- timetables tables. Both class and teacher schedules are derived by
-- filtering this table by class_id or teacher_id.
--
-- Two UNIQUE constraints prevent double-booking:
--   1. A class can have only one subject per (day, period)
--   2. A teacher can teach only one class per (day, period)
--
-- day_of_week uses ISO-like numbering: 1 = Monday, 6 = Saturday.
-- is_active allows disabling individual entries without soft-deleting them,
-- enabling quick schedule adjustments (e.g., substitute teacher for a day).
-- ---------------------------------------------------------------------------

CREATE TABLE timetable_entries (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID            NOT NULL,
    academic_term_id  UUID            NOT NULL,
    class_id          UUID            NOT NULL,
    subject_id        UUID            NOT NULL,
    teacher_id        UUID            NOT NULL,
    period_id         UUID            NOT NULL,
    day_of_week       SMALLINT        NOT NULL,
    room_number       VARCHAR(20),
    is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,

    CONSTRAINT tt_class_period_uk
        UNIQUE (academic_term_id, class_id, day_of_week, period_id),
    CONSTRAINT tt_teacher_period_uk
        UNIQUE (academic_term_id, teacher_id, day_of_week, period_id),
    CONSTRAINT tt_day_of_week_check
        CHECK (day_of_week >= 1 AND day_of_week <= 6)
);

COMMENT ON TABLE  timetable_entries IS 'Unified timetable — single source of truth for class and teacher schedules';
COMMENT ON COLUMN timetable_entries.day_of_week IS '1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
COMMENT ON COLUMN timetable_entries.is_active IS 'Allows disabling entries for temporary adjustments without deleting';
COMMENT ON COLUMN timetable_entries.room_number IS 'Optional per-period room override; defaults to class default if NULL';


-- =============================================================================
-- ATTENDANCE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9.1 attendance — Daily attendance records
-- Records one entry per student per day, marked by a teacher.
-- The UNIQUE(student_id, date) constraint ensures exactly one record per
-- student per day. Attendance is scoped to a class and academic term to
-- enable term-level roll-up reports.
-- ---------------------------------------------------------------------------

CREATE TABLE attendance (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID                NOT NULL,
    student_id      UUID                NOT NULL,
    class_id        UUID                NOT NULL,
    academic_term_id UUID               NOT NULL,
    date            DATE                NOT NULL,
    status          attendance_status   NOT NULL,
    marked_by       UUID                NOT NULL,
    remarks         TEXT,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT attendance_student_date_uk UNIQUE (student_id, date)
);

COMMENT ON TABLE  attendance IS 'Daily attendance per student';
COMMENT ON COLUMN attendance.marked_by IS 'Teacher UUID who marked this attendance record';


-- =============================================================================
-- HOMEWORK
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 10.1 homeworks — Homework assignments
-- Created by teachers for a specific class and subject within a term.
-- Draft/publish workflow: teachers create drafts (is_published = FALSE),
-- review and edit, then publish when ready. Each edit increments the
-- version number for tracking revision history.
-- The CHECK constraint ensures max_score is always positive.
-- ---------------------------------------------------------------------------

CREATE TABLE homeworks (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    teacher_id      UUID            NOT NULL,
    class_id        UUID            NOT NULL,
    subject_id      UUID            NOT NULL,
    academic_term_id UUID           NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    description     TEXT,
    due_date        TIMESTAMPTZ     NOT NULL,
    max_score       DECIMAL(6,2)    NOT NULL DEFAULT 100.00,
    version         INTEGER         NOT NULL DEFAULT 1,
    is_published    BOOLEAN         NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT homeworks_max_score_check CHECK (max_score > 0),
    CONSTRAINT homeworks_version_check CHECK (version > 0)
);

COMMENT ON TABLE  homeworks IS 'Homework assignments created by teachers';
COMMENT ON COLUMN homeworks.version IS 'Revision counter; incremented on each edit';
COMMENT ON COLUMN homeworks.is_published IS 'FALSE = draft (students cannot see); TRUE = published';


-- ---------------------------------------------------------------------------
-- 10.2 homework_questions — Questions within a homework
-- Supports multiple question types via the question_type enum.
-- options JSONB stores MCQ choices as an array of objects:
--   [{"label": "A", "text": "Option A"}, {"label": "B", "text": "Option B"}]
-- correct_answer is stored for auto-grading objective-type questions.
-- ON DELETE CASCADE: removing a homework removes its questions.
-- ---------------------------------------------------------------------------

CREATE TABLE homework_questions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    homework_id     UUID            NOT NULL,
    question_text   TEXT            NOT NULL,
    question_type   question_type   NOT NULL DEFAULT 'short_answer',
    options         JSONB,
    explanation     TEXT,
    correct_answer  TEXT,
    points          DECIMAL(6,2)    NOT NULL DEFAULT 1.00,
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT homework_q_points_check CHECK (points > 0)
);

COMMENT ON TABLE  homework_questions IS 'Questions within a homework assignment';
COMMENT ON COLUMN homework_questions.options IS 'JSONB array for MCQ: [{"label":"A","text":"..."}]';
COMMENT ON COLUMN homework_questions.explanation IS 'Optional explanation or hint for the question';
COMMENT ON COLUMN homework_questions.correct_answer IS 'Stored for auto-grading objective-type questions';


-- ---------------------------------------------------------------------------
-- 10.3 homework_submissions — Student homework submissions
-- One submission per student per homework (enforced by UNIQUE constraint).
-- graded_by references users (not teachers) so that school admins and
-- principals can also grade submissions.
-- total_score is denormalized from homework_answers for query performance.
-- ---------------------------------------------------------------------------

CREATE TABLE homework_submissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    homework_id     UUID            NOT NULL,
    student_id      UUID            NOT NULL,
    school_id       UUID            NOT NULL,
    status          attempt_status  NOT NULL DEFAULT 'pending',
    submitted_at    TIMESTAMPTZ,
    total_score     DECIMAL(8,2),
    is_graded       BOOLEAN         NOT NULL DEFAULT FALSE,
    graded_by       UUID,
    graded_at       TIMESTAMPTZ,
    teacher_remarks TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT hs_homework_student_uk UNIQUE (homework_id, student_id)
);

COMMENT ON TABLE  homework_submissions IS 'Student homework submissions';
COMMENT ON COLUMN homework_submissions.graded_by IS 'References users — admins, principals, and teachers can grade';
COMMENT ON COLUMN homework_submissions.total_score IS 'Denormalized from homework_answers for query speed';


-- ---------------------------------------------------------------------------
-- 10.4 homework_answers — Per-question answers within a submission
-- Scores are split into auto (for MCQ/TF) and manual (for written responses).
-- updated_at is nullable since answers are immutable once submitted
-- (regraded answers would update the record, setting a timestamp).
-- CASCADE: removing a submission removes its answers.
-- ---------------------------------------------------------------------------

CREATE TABLE homework_answers (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    homework_submission_id UUID       NOT NULL,
    question_id           UUID        NOT NULL,
    submitted_answer      TEXT,
    score_auto            DECIMAL(6,2),
    score_manual          DECIMAL(6,2),
    is_correct            BOOLEAN,
    remarks               TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,

    CONSTRAINT ha_submission_question_uk UNIQUE (homework_submission_id, question_id)
);

COMMENT ON TABLE  homework_answers IS 'Per-question answers within a homework submission';
COMMENT ON COLUMN homework_answers.score_auto IS 'Auto-graded score for multiple_choice / true_false';
COMMENT ON COLUMN homework_answers.score_manual IS 'Teacher-assigned score for written responses';


-- =============================================================================
-- TESTS & EXAMS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 11.1 tests — Test/exam definitions
-- Created by teachers with support for various test types (quiz, unit_test,
-- midterm, final). Tests have configurable duration limits and can be
-- scheduled for a specific date/time.
--
-- Two-phase publish workflow:
--   1. is_published = TRUE → students can view and attempt the test
--   2. is_results_published = TRUE → students can see their scores
--
-- version increments on each edit, enabling draft/revision tracking.
-- The CHECK constraints ensure marks, duration, and passing percentage
-- are within valid ranges.
-- ---------------------------------------------------------------------------

CREATE TABLE tests (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           UUID            NOT NULL,
    teacher_id          UUID            NOT NULL,
    class_id            UUID            NOT NULL,
    subject_id          UUID            NOT NULL,
    academic_term_id    UUID            NOT NULL,
    title               VARCHAR(200)    NOT NULL,
    description         TEXT,
    test_type           VARCHAR(30)     NOT NULL DEFAULT 'unit_test',
    total_marks         DECIMAL(8,2)    NOT NULL,
    duration_minutes    INTEGER         NOT NULL,
    scheduled_at        TIMESTAMPTZ,
    version             INTEGER         NOT NULL DEFAULT 1,
    is_published        BOOLEAN         NOT NULL DEFAULT FALSE,
    published_at        TIMESTAMPTZ,
    is_results_published BOOLEAN        NOT NULL DEFAULT FALSE,
    results_published_at TIMESTAMPTZ,
    passing_percentage  DECIMAL(5,2)    NOT NULL DEFAULT 40.00,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,

    CONSTRAINT tests_total_marks_check CHECK (total_marks > 0),
    CONSTRAINT tests_duration_check CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    CONSTRAINT tests_passing_check CHECK (passing_percentage >= 0 AND passing_percentage <= 100),
    CONSTRAINT tests_version_check CHECK (version > 0)
);

COMMENT ON TABLE  tests IS 'Test/exam definitions created by teachers';
COMMENT ON COLUMN tests.test_type IS 'Category: quiz, unit_test, midterm, final, etc.';
COMMENT ON COLUMN tests.version IS 'Revision counter; incremented on each edit before publishing';
COMMENT ON COLUMN tests.is_published IS 'When TRUE, students can view and attempt the test';
COMMENT ON COLUMN tests.is_results_published IS 'When TRUE, students can see their scores and feedback';


-- ---------------------------------------------------------------------------
-- 11.2 test_questions — Questions within a test
-- Same structure as homework_questions. Supports auto-grading for
-- objective question types via correct_answer storage.
-- CASCADE: removing a test removes its questions.
-- ---------------------------------------------------------------------------

CREATE TABLE test_questions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         UUID            NOT NULL,
    question_text   TEXT            NOT NULL,
    question_type   question_type   NOT NULL DEFAULT 'multiple_choice',
    options         JSONB,
    explanation     TEXT,
    correct_answer  TEXT,
    points          DECIMAL(6,2)    NOT NULL DEFAULT 1.00,
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT tq_points_check CHECK (points > 0)
);

COMMENT ON TABLE  test_questions IS 'Questions within a test/exam';
COMMENT ON COLUMN test_questions.options IS 'JSONB array for MCQ choices';
COMMENT ON COLUMN test_questions.explanation IS 'Optional explanation or hint for the question';


-- ---------------------------------------------------------------------------
-- 11.3 test_attempts — Student test attempts
-- Tracks start and submission times for duration monitoring.
-- Scores are split into auto (MCQ/TF), manual (written), and total.
-- UNIQUE(test_id, student_id) enforces one attempt per student per test.
-- graded_by references users for flexibility (admins can grade too).
-- ---------------------------------------------------------------------------

CREATE TABLE test_attempts (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         UUID            NOT NULL,
    student_id      UUID            NOT NULL,
    school_id       UUID            NOT NULL,
    status          attempt_status  NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ,
    total_score_auto   DECIMAL(8,2),
    total_score_manual DECIMAL(8,2),
    total_score     DECIMAL(8,2),
    is_graded       BOOLEAN         NOT NULL DEFAULT FALSE,
    graded_by       UUID,
    graded_at       TIMESTAMPTZ,
    teacher_remarks TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT ta_test_student_uk UNIQUE (test_id, student_id)
);

COMMENT ON TABLE  test_attempts IS 'Student test attempts with timing and scoring';
COMMENT ON COLUMN test_attempts.total_score IS 'Computed from auto + manual scores';
COMMENT ON COLUMN test_attempts.graded_by IS 'References users — admins, principals, and teachers can grade';


-- ---------------------------------------------------------------------------
-- 11.4 test_answers — Per-question answers within a test attempt
-- Same pattern as homework_answers with added answered_at timestamp
-- to track how long each question took the student.
-- CASCADE: removing an attempt removes its answers.
-- ---------------------------------------------------------------------------

CREATE TABLE test_answers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_attempt_id     UUID        NOT NULL,
    question_id         UUID        NOT NULL,
    submitted_answer    TEXT,
    score_auto          DECIMAL(6,2),
    score_manual        DECIMAL(6,2),
    is_correct          BOOLEAN,
    remarks             TEXT,
    answered_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT tans_attempt_question_uk UNIQUE (test_attempt_id, question_id)
);

COMMENT ON TABLE  test_answers IS 'Per-question answers within a test attempt';
COMMENT ON COLUMN test_answers.answered_at IS 'Timestamp when the student answered this specific question';


-- =============================================================================
-- REPORTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 12.1 reports — Generated reports
-- A generic reports table supporting multiple use cases via the report_type
-- ENUM (student_progress, class_performance, teacher_performance,
-- attendance_summary, exam_results, custom).
--
-- Design decision: Generic instead of separate tables (student_reports,
-- class_reports, etc.) because multiple report types share the same
-- structure and cross-type queries are common ("all reports for Grade 10
-- this term"). The data JSONB column stores the type-specific payload.
-- The CHECK constraint ensures published reports have a published_at date.
-- ---------------------------------------------------------------------------

CREATE TABLE reports (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    academic_term_id UUID,
    title           VARCHAR(200)    NOT NULL,
    report_type     report_type     NOT NULL,
    parameters      JSONB,
    data            JSONB           NOT NULL,
    file_url        VARCHAR(500),
    generated_by    UUID            NOT NULL,
    is_published    BOOLEAN         NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    generated_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT reports_published_data_check
        CHECK (is_published = FALSE OR published_at IS NOT NULL)
);

COMMENT ON TABLE  reports IS 'Generated reports — progress, performance, attendance, exams, and custom';
COMMENT ON COLUMN reports.parameters IS 'Input parameters used to generate the report';
COMMENT ON COLUMN reports.data IS 'Complete report payload in flexible JSONB format';
COMMENT ON COLUMN reports.file_url IS 'Link to generated PDF document if exported';


-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 13.1 notifications — Outbound notification records
-- A notification represents a message sent to one or more recipients
-- through various channels. sender_id is NULL for system-triggered
-- notifications (e.g. automated attendance alerts).
-- Individual delivery tracking is handled in notification_recipients.
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           UUID                NOT NULL,
    sender_id           UUID,
    notification_type   notification_type   NOT NULL DEFAULT 'academic',
    title               VARCHAR(200)        NOT NULL,
    body                TEXT,
    metadata            JSONB,
    is_sent             BOOLEAN             NOT NULL DEFAULT FALSE,
    sent_at             TIMESTAMPTZ,
    scheduled_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now()
);

COMMENT ON TABLE  notifications IS 'Outbound notification records for multi-channel delivery';
COMMENT ON COLUMN notifications.sender_id IS 'NULL for system-generated notifications';


-- ---------------------------------------------------------------------------
-- 13.2 notification_recipients — Per-recipient delivery tracking
-- Each notification can target multiple recipients through different channels
-- (whatsapp, email, push, sms). contact_address stores the actual email or
-- phone number used for delivery tracking and retry logic.
--
-- Parent-specific WhatsApp notifications use parent_id + channel='whatsapp'.
-- A single notification about a student's attendance can be sent to the
-- mother (WhatsApp), father (email), and guardian (WhatsApp) — each with
-- independent delivery status tracking.
-- ---------------------------------------------------------------------------

CREATE TABLE notification_recipients (
    id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     UUID                  NOT NULL,
    user_id             UUID,
    parent_id           UUID,
    channel             notification_channel  NOT NULL DEFAULT 'whatsapp',
    contact_address     VARCHAR(255),
    status              notification_status   NOT NULL DEFAULT 'pending',
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ           NOT NULL DEFAULT now(),

    CONSTRAINT nr_recipient_check CHECK (
        (user_id IS NOT NULL AND parent_id IS NULL)
        OR (user_id IS NULL AND parent_id IS NOT NULL)
    )
);

COMMENT ON TABLE  notification_recipients IS 'Per-recipient delivery tracking for notifications';
COMMENT ON COLUMN notification_recipients.channel IS 'Delivery channel for this specific recipient';
COMMENT ON COLUMN notification_recipients.contact_address IS 'Resolved email address or phone number used for delivery';


-- =============================================================================
-- AUDIT & COMPLIANCE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 14.1 audit_logs — Immutable audit trail
-- Records all CREATE, UPDATE, and DELETE operations on core entities for
-- compliance, debugging, and security investigations.
-- old_data / new_data store before/after JSONB snapshots.
-- No deleted_at or updated_at — audit records are immutable once written.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    user_id         UUID,
    action          VARCHAR(50)     NOT NULL,
    entity_type     VARCHAR(50)     NOT NULL,
    entity_id       UUID            NOT NULL,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  audit_logs IS 'Immutable audit trail for compliance and security';
COMMENT ON COLUMN audit_logs.action IS 'Operation performed: created, updated, deleted';
COMMENT ON COLUMN audit_logs.entity_type IS 'Table name of the affected entity';
COMMENT ON COLUMN audit_logs.old_data IS 'Snapshot of the record before the change';
COMMENT ON COLUMN audit_logs.new_data IS 'Snapshot of the record after the change';


-- =============================================================================
-- AI FEATURES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 15.1 ai_generations — AI content generation audit trail
-- Tracks all AI-generated content for auditing, cost tracking, and quality
-- improvement. Records what was sent to the AI model and what was returned.
-- Supports multiple entity types (homework_question, test_question, feedback,
-- report_summary, etc.) via entity_type + optional entity_id.
--
-- Use cases:
--   • Prompt tracking for debugging and quality improvement
--   • Cost tracking per school (tokens_input, tokens_output)
--   • Regeneration history
--   • AI audit trail for compliance and governance
--
-- No deleted_at or updated_at — generations are immutable once created.
-- ---------------------------------------------------------------------------

CREATE TABLE ai_generations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID            NOT NULL,
    user_id         UUID            NOT NULL,
    entity_type     VARCHAR(50)     NOT NULL,
    generation_type VARCHAR(50),
    entity_id       UUID,
    prompt          TEXT            NOT NULL,
    response        TEXT            NOT NULL,
    model           VARCHAR(100),
    tokens_input    INTEGER,
    tokens_output   INTEGER,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  ai_generations IS 'Audit log for AI-generated content and cost tracking';
COMMENT ON COLUMN ai_generations.entity_type IS 'Type of content generated (homework_question, test_question, feedback, etc.)';
COMMENT ON COLUMN ai_generations.entity_id IS 'Associated entity ID (nullable for context-free generations)';
COMMENT ON COLUMN ai_generations.model IS 'AI model used (e.g. gpt-4, claude-3-5-sonnet, gemini-pro)';
COMMENT ON COLUMN ai_generations.tokens_input IS 'Input token count for cost tracking';
COMMENT ON COLUMN ai_generations.tokens_output IS 'Output token count for cost tracking';
COMMENT ON COLUMN ai_generations.duration_ms IS 'Generation time in milliseconds for performance monitoring';


-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================
-- All FKs are defined here after table creation to avoid ordering
-- dependencies. This is the standard approach for SQL migrations.
--
-- ON DELETE actions:
--   CASCADE:   Deleting parent automatically removes dependent child rows
--   NO ACTION: Prevents deletion if dependent rows exist (safe with soft deletes)
-- =============================================================================

-- 16.1 schools (no FKs to other tables — root entity)

-- 16.2 academic_years
ALTER TABLE academic_years
    ADD CONSTRAINT academic_years_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.3 academic_terms
ALTER TABLE academic_terms
    ADD CONSTRAINT academic_terms_year_fk
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);
ALTER TABLE academic_terms
    ADD CONSTRAINT academic_terms_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.4 periods
ALTER TABLE periods
    ADD CONSTRAINT periods_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.5 timetable_entries
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_subject_fk
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_teacher_fk
    FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE timetable_entries
    ADD CONSTRAINT tt_period_fk
    FOREIGN KEY (period_id) REFERENCES periods(id);

-- 16.6 users
ALTER TABLE users
    ADD CONSTRAINT users_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.7 teachers
ALTER TABLE teachers
    ADD CONSTRAINT teachers_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE teachers
    ADD CONSTRAINT teachers_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.8 principals
ALTER TABLE principals
    ADD CONSTRAINT principals_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE principals
    ADD CONSTRAINT principals_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.9 parents
ALTER TABLE parents
    ADD CONSTRAINT parents_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE parents
    ADD CONSTRAINT parents_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.10 classes
ALTER TABLE classes
    ADD CONSTRAINT classes_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE classes
    ADD CONSTRAINT classes_academic_year_fk
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);
ALTER TABLE classes
    ADD CONSTRAINT classes_teacher_fk
    FOREIGN KEY (class_teacher_id) REFERENCES teachers(id);

-- 16.11 subjects
ALTER TABLE subjects
    ADD CONSTRAINT subjects_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.12 students
ALTER TABLE students
    ADD CONSTRAINT students_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE students
    ADD CONSTRAINT students_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE students
    ADD CONSTRAINT students_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);

-- 16.13 student_parents
ALTER TABLE student_parents
    ADD CONSTRAINT sp_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE student_parents
    ADD CONSTRAINT sp_parent_fk
    FOREIGN KEY (parent_id) REFERENCES parents(id);
ALTER TABLE student_parents
    ADD CONSTRAINT sp_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);

-- 16.14 class_enrollments
ALTER TABLE class_enrollments
    ADD CONSTRAINT ce_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE class_enrollments
    ADD CONSTRAINT ce_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE class_enrollments
    ADD CONSTRAINT ce_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE class_enrollments
    ADD CONSTRAINT ce_academic_year_fk
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);

-- 16.15 teacher_class_subjects
ALTER TABLE teacher_class_subjects
    ADD CONSTRAINT tcs_teacher_fk
    FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE teacher_class_subjects
    ADD CONSTRAINT tcs_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE teacher_class_subjects
    ADD CONSTRAINT tcs_subject_fk
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
ALTER TABLE teacher_class_subjects
    ADD CONSTRAINT tcs_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE teacher_class_subjects
    ADD CONSTRAINT tcs_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);

-- 16.16 attendance
ALTER TABLE attendance
    ADD CONSTRAINT attendance_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE attendance
    ADD CONSTRAINT attendance_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE attendance
    ADD CONSTRAINT attendance_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE attendance
    ADD CONSTRAINT attendance_marked_by_fk
    FOREIGN KEY (marked_by) REFERENCES teachers(id);
ALTER TABLE attendance
    ADD CONSTRAINT attendance_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);

-- 16.17 homeworks
ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_teacher_fk
    FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_subject_fk
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE homeworks
    ADD CONSTRAINT homeworks_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);

-- 16.18 homework_questions
ALTER TABLE homework_questions
    ADD CONSTRAINT hq_homework_fk
    FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE CASCADE;

-- 16.19 homework_submissions
ALTER TABLE homework_submissions
    ADD CONSTRAINT hs_homework_fk
    FOREIGN KEY (homework_id) REFERENCES homeworks(id);
ALTER TABLE homework_submissions
    ADD CONSTRAINT hs_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE homework_submissions
    ADD CONSTRAINT hs_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE homework_submissions
    ADD CONSTRAINT hs_graded_by_fk
    FOREIGN KEY (graded_by) REFERENCES users(id);

-- 16.20 homework_answers
ALTER TABLE homework_answers
    ADD CONSTRAINT ha_submission_fk
    FOREIGN KEY (homework_submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE;
ALTER TABLE homework_answers
    ADD CONSTRAINT ha_question_fk
    FOREIGN KEY (question_id) REFERENCES homework_questions(id);

-- 16.21 tests
ALTER TABLE tests
    ADD CONSTRAINT tests_teacher_fk
    FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE tests
    ADD CONSTRAINT tests_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE tests
    ADD CONSTRAINT tests_subject_fk
    FOREIGN KEY (subject_id) REFERENCES subjects(id);
ALTER TABLE tests
    ADD CONSTRAINT tests_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE tests
    ADD CONSTRAINT tests_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);

-- 16.22 test_questions
ALTER TABLE test_questions
    ADD CONSTRAINT tq_test_fk
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE;

-- 16.23 test_attempts
ALTER TABLE test_attempts
    ADD CONSTRAINT ta_test_fk
    FOREIGN KEY (test_id) REFERENCES tests(id);
ALTER TABLE test_attempts
    ADD CONSTRAINT ta_student_fk
    FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE test_attempts
    ADD CONSTRAINT ta_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE test_attempts
    ADD CONSTRAINT ta_graded_by_fk
    FOREIGN KEY (graded_by) REFERENCES users(id);

-- 16.24 test_answers
ALTER TABLE test_answers
    ADD CONSTRAINT tans_attempt_fk
    FOREIGN KEY (test_attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE;
ALTER TABLE test_answers
    ADD CONSTRAINT tans_question_fk
    FOREIGN KEY (question_id) REFERENCES test_questions(id);

-- 16.25 reports
ALTER TABLE reports
    ADD CONSTRAINT reports_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE reports
    ADD CONSTRAINT reports_academic_term_fk
    FOREIGN KEY (academic_term_id) REFERENCES academic_terms(id);
ALTER TABLE reports
    ADD CONSTRAINT reports_generated_by_fk
    FOREIGN KEY (generated_by) REFERENCES users(id);

-- 16.26 notifications
ALTER TABLE notifications
    ADD CONSTRAINT notifications_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE notifications
    ADD CONSTRAINT notifications_sender_fk
    FOREIGN KEY (sender_id) REFERENCES users(id);

-- 16.27 notification_recipients
ALTER TABLE notification_recipients
    ADD CONSTRAINT nr_notification_fk
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
ALTER TABLE notification_recipients
    ADD CONSTRAINT nr_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE notification_recipients
    ADD CONSTRAINT nr_parent_fk
    FOREIGN KEY (parent_id) REFERENCES parents(id);

-- 16.28 audit_logs
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);

-- 16.29 ai_generations
ALTER TABLE ai_generations
    ADD CONSTRAINT ai_generations_school_fk
    FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE ai_generations
    ADD CONSTRAINT ai_generations_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id);
