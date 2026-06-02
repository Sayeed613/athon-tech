-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- triggers.sql — Automated Timestamp & Audit Triggers
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed AFTER indexes.sql and BEFORE rls.sql.
--
-- Contents:
--   1. set_updated_at() — Reusable function that sets updated_at = now()
--      on every UPDATE of any row that has an updated_at column.
--   2. Trigger application — One trg_{table}_updated trigger per table.
--   3. audit_log_changes() — Reusable function that captures INSERT/UPDATE/
--      DELETE events on core business tables into audit_logs.
--   4. Trigger application — One trg_{table}_audit trigger per audited table.
--
-- Design decisions:
--   • updated_at is handled by a generic trigger function to avoid
--     repeating the same logic across tables.
--   • Audit logging is applied ONLY to core business tables (schools,
--     users, teachers, principals, students, classes, homeworks, tests,
--     attendance). High-volume transactional tables (submissions,
--     attempts, notifications) are excluded to prevent runaway growth
--     of the audit_logs table.
--   • The audit function reads the current user from a session setting
--     (`app.current_user_id`) set by the application at connection time.
--     Falls back to NULL if the setting is not available.
-- =============================================================================

-- =============================================================================
-- 1. REUSABLE FUNCTION: set_updated_at
-- =============================================================================
-- Generic trigger function that automatically sets the updated_at column
-- to the current timestamp on every UPDATE.
-- Drop and recreate to ensure idempotent re-runs.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at IS 'Generic trigger function: sets updated_at = now() on UPDATE for any row with an updated_at column';


-- =============================================================================
-- 2. APPLY updated_at TRIGGERS
-- =============================================================================
-- Each CREATE TRIGGER is wrapped in a DO block that drops the trigger first,
-- making the entire file safe for idempotent re-execution in CI/CD pipelines.
-- =============================================================================

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_schools_updated ON schools;
    CREATE TRIGGER trg_schools_updated
        BEFORE UPDATE ON schools
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_academic_years_updated ON academic_years;
    CREATE TRIGGER trg_academic_years_updated
        BEFORE UPDATE ON academic_years
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_academic_terms_updated ON academic_terms;
    CREATE TRIGGER trg_academic_terms_updated
        BEFORE UPDATE ON academic_terms
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_users_updated ON users;
    CREATE TRIGGER trg_users_updated
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_teachers_updated ON teachers;
    CREATE TRIGGER trg_teachers_updated
        BEFORE UPDATE ON teachers
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_principals_updated ON principals;
    CREATE TRIGGER trg_principals_updated
        BEFORE UPDATE ON principals
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_parents_updated ON parents;
    CREATE TRIGGER trg_parents_updated
        BEFORE UPDATE ON parents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_classes_updated ON classes;
    CREATE TRIGGER trg_classes_updated
        BEFORE UPDATE ON classes
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_subjects_updated ON subjects;
    CREATE TRIGGER trg_subjects_updated
        BEFORE UPDATE ON subjects
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_students_updated ON students;
    CREATE TRIGGER trg_students_updated
        BEFORE UPDATE ON students
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_student_parents_updated ON student_parents;
    CREATE TRIGGER trg_student_parents_updated
        BEFORE UPDATE ON student_parents
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_class_enrollments_updated ON class_enrollments;
    CREATE TRIGGER trg_class_enrollments_updated
        BEFORE UPDATE ON class_enrollments
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_teacher_class_subjects_updated ON teacher_class_subjects;
    CREATE TRIGGER trg_teacher_class_subjects_updated
        BEFORE UPDATE ON teacher_class_subjects
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_periods_updated ON periods;
    CREATE TRIGGER trg_periods_updated
        BEFORE UPDATE ON periods
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_timetable_entries_updated ON timetable_entries;
    CREATE TRIGGER trg_timetable_entries_updated
        BEFORE UPDATE ON timetable_entries
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_attendance_updated ON attendance;
    CREATE TRIGGER trg_attendance_updated
        BEFORE UPDATE ON attendance
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_homeworks_updated ON homeworks;
    CREATE TRIGGER trg_homeworks_updated
        BEFORE UPDATE ON homeworks
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_homework_submissions_updated ON homework_submissions;
    CREATE TRIGGER trg_homework_submissions_updated
        BEFORE UPDATE ON homework_submissions
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

-- homework_answers has nullable updated_at — trigger still applies
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_homework_answers_updated ON homework_answers;
    CREATE TRIGGER trg_homework_answers_updated
        BEFORE UPDATE ON homework_answers
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_tests_updated ON tests;
    CREATE TRIGGER trg_tests_updated
        BEFORE UPDATE ON tests
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_test_attempts_updated ON test_attempts;
    CREATE TRIGGER trg_test_attempts_updated
        BEFORE UPDATE ON test_attempts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;

-- test_answers has nullable updated_at — trigger still applies
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_test_answers_updated ON test_answers;
    CREATE TRIGGER trg_test_answers_updated
        BEFORE UPDATE ON test_answers
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$;


-- =============================================================================
-- 3. REUSABLE FUNCTION: audit_log_changes
-- =============================================================================
-- Generic trigger function that captures INSERT, UPDATE, and DELETE events
-- on core business tables and writes them to the audit_logs table.
--
-- It reads the current application user from the session setting
-- `app.current_user_id` (set by the application at connection time).
-- If the setting is not available, user_id is recorded as NULL.
-- The IP address is similarly read from `app.current_ip_address`.
--
-- This function handles tables with and without a school_id column.
-- If a school_id column exists on the table, it is included in the audit
-- record; otherwise, NULL is stored for school_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id   UUID;
    v_ip_address INET;
    v_school_id UUID;
BEGIN
    -- Read session context set by the application
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    EXCEPTION
        WHEN OTHERS THEN v_user_id := NULL;
    END;

    BEGIN
        v_ip_address := NULLIF(current_setting('app.current_ip_address', TRUE), '')::INET;
    EXCEPTION
        WHEN OTHERS THEN v_ip_address := NULL;
    END;

    -- Determine school_id if the table has that column
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_school_id := OLD.school_id;
        ELSE
            v_school_id := NEW.school_id;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN v_school_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (school_id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
        VALUES (
            v_school_id,
            v_user_id,
            'created',
            TG_TABLE_NAME,
            NEW.id,
            NULL,
            row_to_json(NEW)::jsonb,
            v_ip_address
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (school_id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
        VALUES (
            v_school_id,
            v_user_id,
            'updated',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(OLD)::jsonb,
            row_to_json(NEW)::jsonb,
            v_ip_address
        );
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (school_id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
        VALUES (
            v_school_id,
            v_user_id,
            'deleted',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)::jsonb,
            NULL,
            v_ip_address
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION audit_log_changes IS 'Generic audit trigger: captures INSERT/UPDATE/DELETE on core tables into audit_logs. Reads app.current_user_id and app.current_ip_address from session settings.';


-- =============================================================================
-- 4. APPLY AUDIT LOG TRIGGERS
-- =============================================================================
-- Applied only to core business tables that require compliance tracking.
-- High-volume transactional tables (submissions, attempts, answers,
-- notifications, notification_recipients) are EXCLUDED to prevent
-- excessive audit log growth.
--
-- timetable_entries IS audited because schedule changes affect attendance
-- marking, homework deadlines, and room allocation — compliance-sensitive.
-- periods are NOT audited (reference data, like subjects).
-- =============================================================================

-- 4.1 Schools — tenant config changes (high sensitivity)
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_schools_audit ON schools;
    CREATE TRIGGER trg_schools_audit
        AFTER INSERT OR UPDATE OR DELETE ON schools
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.2 Users — identity and role changes (privacy-sensitive)
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_users_audit ON users;
    CREATE TRIGGER trg_users_audit
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.3 Teachers — faculty records and class assignments
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_teachers_audit ON teachers;
    CREATE TRIGGER trg_teachers_audit
        AFTER INSERT OR UPDATE OR DELETE ON teachers
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.4 Principals — leadership appointments
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_principals_audit ON principals;
    CREATE TRIGGER trg_principals_audit
        AFTER INSERT OR UPDATE OR DELETE ON principals
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.5 Students — enrollment and profile changes
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_students_audit ON students;
    CREATE TRIGGER trg_students_audit
        AFTER INSERT OR UPDATE OR DELETE ON students
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.6 Classes — class group and teacher assignment changes
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_classes_audit ON classes;
    CREATE TRIGGER trg_classes_audit
        AFTER INSERT OR UPDATE OR DELETE ON classes
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.7 Homeworks — content changes (homework assignments, questions)
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_homeworks_audit ON homeworks;
    CREATE TRIGGER trg_homeworks_audit
        AFTER INSERT OR UPDATE OR DELETE ON homeworks
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.8 Tests — test content and schedule changes
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_tests_audit ON tests;
    CREATE TRIGGER trg_tests_audit
        AFTER INSERT OR UPDATE OR DELETE ON tests
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.9 Attendance — sensitive attendance records
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_attendance_audit ON attendance;
    CREATE TRIGGER trg_attendance_audit
        AFTER INSERT OR UPDATE OR DELETE ON attendance
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;

-- 4.10 timetable_entries — schedule changes affect attendance, homework,
--     room allocation, and teacher workload (compliance-sensitive)
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_timetable_entries_audit ON timetable_entries;
    CREATE TRIGGER trg_timetable_entries_audit
        AFTER INSERT OR UPDATE OR DELETE ON timetable_entries
        FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
END $$;
