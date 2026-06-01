-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- enums.sql — Custom ENUM Types
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed BEFORE tables.sql.
-- It defines all custom ENUM types used across the schema.
-- Note: The 'app' schema (for RLS helpers) is created in rls.sql.
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
-- pgcrypto: provides gen_random_uuid() for UUID primary keys
-- citext:   provides case-insensitive text type for email columns

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;


-- =============================================================================
-- 2. ENUM TYPES
-- =============================================================================
-- Enums are created with DO $$ blocks and duplicate_object exception handling
-- so this file can be re-run safely in development and CI/CD pipelines.

-- 2.1. user_role — Platform-wide role-based access control
--       super_admin: platform-level super administrator (bypasses RLS)
--       school_admin: school-level administrator
--       teacher: teaching staff
--       student: enrolled student
--       parent: parent/guardian

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin',
        'school_admin',
        'principal',
        'teacher',
        'student',
        'parent'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.2. attendance_status — Daily attendance state for a student

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM (
        'present',
        'absent',
        'late',
        'half_day'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.3. question_type — Types of questions in homework and tests
--       multiple_choice: MCQ with predefined options
--       true_false: binary true/false question
--       short_answer: brief written response
--       long_answer: detailed written response
--       essay: extended writing exercise

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM (
        'multiple_choice',
        'true_false',
        'short_answer',
        'long_answer',
        'essay'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.4. attempt_status — Lifecycle state of a homework or test attempt
--       pending:       not yet started
--       in_progress:   currently being worked on
--       submitted:     submitted by student, awaiting grading
--       graded:        teacher has completed grading
--       results_published: results released to students/parents

DO $$ BEGIN
    CREATE TYPE attempt_status AS ENUM (
        'pending',
        'in_progress',
        'submitted',
        'graded',
        'results_published'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.5. notification_channel — Delivery channel for notifications
--       whatsapp: WhatsApp Business API
--       email:    SMTP email delivery
--       push:     Mobile push notification
--       sms:      SMS text message

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM (
        'whatsapp',
        'email',
        'push',
        'sms'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.6. notification_type — Category of notification for routing and filtering

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'academic',       -- homework, test results, grades
        'attendance',     -- attendance alerts
        'fee_reminder',   -- fee payment reminders
        'announcement',   -- school-wide announcements
        'behavioral',     -- behavioral reports
        'emergency',      -- emergency alerts
        'system',         -- system/account notifications
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.7. notification_status — Delivery status of an outbound notification

DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM (
        'pending',
        'sent',
        'delivered',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.8. report_type — Category of generated report

DO $$ BEGIN
    CREATE TYPE report_type AS ENUM (
        'student_progress',
        'class_performance',
        'teacher_performance',
        'attendance_summary',
        'exam_results',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.9. gender — Student gender identity

DO $$ BEGIN
    CREATE TYPE gender AS ENUM (
        'male',
        'female',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.10. parent_relationship — Relationship type between parent and student

DO $$ BEGIN
    CREATE TYPE parent_relationship AS ENUM (
        'father',
        'mother',
        'guardian',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2.11. enrollment_status — Lifecycle state of a class enrollment
--       active:      currently enrolled in the class
--       promoted:    moved to the next grade/class
--       transferred: moved to a different class/school
--       graduated:   completed the final year
--       withdrawn:   removed from the class

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM (
        'active',
        'promoted',
        'transferred',
        'graduated',
        'withdrawn'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
