-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- indexes.sql — Performance-First Indexing Strategy
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed AFTER tables.sql and BEFORE triggers.sql.
--
-- Design principles:
--   • Every index has a documented performance justification
--   • Partial indexes (WHERE deleted_at IS NULL) on large tables to
--     keep index size small and writes fast
--   • Composite indexes for common multi-column query patterns
--   • Avoid redundant indexes (already covered by UNIQUE constraints)
--   • Avoid indexes on small reference tables (academic_years, terms,
--     subjects) — their UNIQUE constraints are sufficient
--   • No indexes on purely transactional child tables queried
--     exclusively through their parent FK (homework_answers, test_answers)
--     — CASCADE parent index is sufficient
-- =============================================================================

-- =============================================================================
-- 1. MULTI-TENANT & TENANT WIDE QUERIES
-- =============================================================================
-- Every major query filters by school_id first. These indexes accelerate
-- tenant-scoped dashboard queries and admin panels.
-- =============================================================================

-- 1.1 Active users per school (login, roster, admin panels)
CREATE INDEX idx_users_school_active
    ON users(school_id, created_at DESC)
    WHERE is_active = TRUE AND deleted_at IS NULL;
COMMENT ON INDEX idx_users_school_active IS 'Accelerates tenant-scoped active user queries and recent-user dashboards';

-- 1.2 Active students per school (attendance, fee, roster queries)
CREATE INDEX idx_students_school_active
    ON students(school_id, created_at DESC)
    WHERE is_active = TRUE AND deleted_at IS NULL;
COMMENT ON INDEX idx_students_school_active IS 'Most common student query pattern: active students within a school';

-- 1.3 Recent teacher and principal lookups per school
CREATE INDEX idx_teachers_school
    ON teachers(school_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_teachers_school IS 'Teacher roster queries and form-teacher dashboards';

CREATE INDEX idx_principals_school
    ON principals(school_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_principals_school IS 'Principal lookup per school (small table, indexed for consistency)';


-- =============================================================================
-- 2. AUTHENTICATION & IDENTITY
-- =============================================================================
-- Users table authentication queries — login, SSO, passwordless sign-in.
-- supabase_user_id already has a UNIQUE index from the table definition.
-- school_id + email is also already covered by a UNIQUE constraint.
-- =============================================================================

-- 2.1 Email-based login (cross-school lookup for initial auth)
CREATE INDEX idx_users_email
    ON users(email);
COMMENT ON INDEX idx_users_email IS 'Standalone email index for login flow before school context is known';

-- 2.2 Active user lookup by role (admin panels, teacher directory)
CREATE INDEX idx_users_role_school
    ON users(school_id, role)
    WHERE is_active = TRUE AND deleted_at IS NULL;
COMMENT ON INDEX idx_users_role_school IS 'Filter users by role within a school (e.g. "show all teachers")';


-- =============================================================================
-- 3. STUDENT QUERIES
-- =============================================================================
-- admission_number already has UNIQUE(school_id, admission_number).
-- roll_number already has UNIQUE(school_id, class_id, roll_number).
-- =============================================================================

-- 3.1 Class roster — most common student query
CREATE INDEX idx_students_class
    ON students(class_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_students_class IS 'Class roster queries and attendance marking — the most frequent student access pattern';

-- 3.2 Student lookup by user_id (profile page, auth context)
--    Already covered by UNIQUE(user_id) constraint.


-- =============================================================================
-- 4. ATTENDANCE
-- =============================================================================
-- student_id + date already has UNIQUE(student_id, date) from table def.
-- Marked_by is a single-row lookup per attendance record — no index needed.
-- =============================================================================

-- 4.1 Daily class attendance sheet (teacher's most-used query)
CREATE INDEX idx_attendance_class_date
    ON attendance(class_id, date)
    INCLUDE (student_id, status);
COMMENT ON INDEX idx_attendance_class_date IS 'Daily attendance sheet per class (INCLUDE avoids heap lookups for common columns)';

-- 4.2 Term-level attendance rollup for reports
CREATE INDEX idx_attendance_term
    ON attendance(academic_term_id, class_id, student_id)
    INCLUDE (status);
COMMENT ON INDEX idx_attendance_term IS 'Term-level summary queries for progress reports and analytics';


-- =============================================================================
-- 5. HOMEWORK
-- =============================================================================

-- 5.1 Dashboard: homeworks by class and subject
CREATE INDEX idx_homeworks_class_subject
    ON homeworks(class_id, subject_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_homeworks_class_subject IS 'Teacher dashboard — list homework for a class in a subject';

-- 5.2 Teacher's homework list (their own assignments)
CREATE INDEX idx_homeworks_teacher
    ON homeworks(teacher_id, created_at DESC)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_homeworks_teacher IS 'Teacher view — "my homework assignments" sorted by recency';

-- 5.3 Upcoming deadlines (student/parent view)
CREATE INDEX idx_homeworks_due_date
    ON homeworks(due_date)
    WHERE deleted_at IS NULL AND is_published = TRUE;
COMMENT ON INDEX idx_homeworks_due_date IS 'Student and parent dashboard — upcoming homework deadlines';

-- 5.4 Published homework filtering
CREATE INDEX idx_homeworks_published
    ON homeworks(school_id, is_published, created_at DESC)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_homeworks_published IS 'Filter published vs. draft homework school-wide for admin oversight';


-- =============================================================================
-- 6. TESTS
-- =============================================================================

-- 6.1 Dashboard: tests by class and subject
CREATE INDEX idx_tests_class_subject
    ON tests(class_id, subject_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_tests_class_subject IS 'Teacher dashboard — list tests for a class in a subject';

-- 6.2 Teacher's test list
CREATE INDEX idx_tests_teacher
    ON tests(teacher_id, created_at DESC)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_tests_teacher IS 'Teacher view — "my test assignments" sorted by recency';

-- 6.3 Upcoming and scheduled tests
CREATE INDEX idx_tests_scheduled
    ON tests(scheduled_at)
    WHERE deleted_at IS NULL AND is_published = TRUE;
COMMENT ON INDEX idx_tests_scheduled IS 'Student dashboard — upcoming scheduled tests';

-- 6.4 Published test filtering
CREATE INDEX idx_tests_published
    ON tests(school_id, is_published, created_at DESC)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_tests_published IS 'Filter published vs. draft tests school-wide for admin oversight';


-- =============================================================================
-- 7. REPORTS
-- =============================================================================

-- 7.1 Reports filtered by type and school
CREATE INDEX idx_reports_type_school
    ON reports(school_id, report_type, generated_at DESC);
COMMENT ON INDEX idx_reports_type_school IS 'Filter reports by type within a school (e.g. "all student_progress reports")';

-- 7.2 Reports sorted by generation date
CREATE INDEX idx_reports_generated
    ON reports(school_id, generated_at DESC);
COMMENT ON INDEX idx_reports_generated IS 'Chronological report listing per school (dashboard and archive views)';


-- =============================================================================
-- 8. NOTIFICATIONS
-- =============================================================================

-- 8.1 Delivery worker query — pending notifications by channel
CREATE INDEX idx_nr_status_channel
    ON notification_recipients(status, channel, created_at ASC);
COMMENT ON INDEX idx_nr_status_channel IS 'Notification delivery worker — picks up oldest pending messages per channel';

-- 8.2 Scheduled notifications
CREATE INDEX idx_notifications_scheduled
    ON notifications(school_id, scheduled_at)
    WHERE scheduled_at IS NOT NULL AND is_sent = FALSE;
COMMENT ON INDEX idx_notifications_scheduled IS 'Scheduled delivery worker — picks up notifications due for sending';

-- 8.3 Recent notifications per school
CREATE INDEX idx_notifications_school_recent
    ON notifications(school_id, created_at DESC);
COMMENT ON INDEX idx_notifications_school_recent IS 'Recent notification feed per school (admin and dashboard views)';


-- =============================================================================
-- 9. AUDIT LOGS
-- =============================================================================
-- Note: audit_logs have no deleted_at (immutable) — partial indexes not needed.
-- =============================================================================

-- 9.1 Entity audit trail — find all changes to a specific record
CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id, created_at DESC);
COMMENT ON INDEX idx_audit_entity IS 'Entity audit trail — "show all changes to this homework/test/user"';

-- 9.2 User action history
CREATE INDEX idx_audit_user
    ON audit_logs(user_id, created_at DESC);
COMMENT ON INDEX idx_audit_user IS 'User action history — "what did this user do recently"';

-- 9.3 Time-range audit queries
CREATE INDEX idx_audit_created
    ON audit_logs(school_id, created_at DESC);
COMMENT ON INDEX idx_audit_created IS 'Time-range audit queries per school for compliance and SIEM integration';


-- =============================================================================
-- 10. AI GENERATIONS
-- =============================================================================
-- Note: ai_generations have no deleted_at (immutable) — partial indexes not needed.
-- =============================================================================

-- 10.1 Filter AI generations by type (homework, test, report, feedback)
CREATE INDEX idx_ai_generation_type
    ON ai_generations(school_id, generation_type, created_at DESC);
COMMENT ON INDEX idx_ai_generation_type IS 'Filter AI generations by use case type for cost tracking and quality analysis';

-- 10.2 User's AI generation history
CREATE INDEX idx_ai_user
    ON ai_generations(user_id, created_at DESC);
COMMENT ON INDEX idx_ai_user IS 'User generation history — "what did this teacher generate recently"';

-- 10.3 Time-range cost/usage analytics
CREATE INDEX idx_ai_created
    ON ai_generations(school_id, created_at DESC);
COMMENT ON INDEX idx_ai_created IS 'Time-range analytics per school for cost tracking and usage monitoring';


-- =============================================================================
-- 11. SPECIAL INDEXES
-- =============================================================================

-- 11.1 Primary Parent Contact — partial unique index
-- Ensures exactly one primary contact per student while allowing other
-- parent relationships to have is_primary_contact = FALSE.
CREATE UNIQUE INDEX idx_sp_primary_contact
    ON student_parents(student_id)
    WHERE is_primary_contact = TRUE;
COMMENT ON INDEX idx_sp_primary_contact IS 'Enforces one primary contact per student; partial index allows flexible non-primary relationships';

-- 11.2 Student-parent lookup by parent (inverse relationship)
CREATE INDEX idx_sp_parent
    ON student_parents(parent_id)
    INCLUDE (student_id, relationship);
COMMENT ON INDEX idx_sp_parent IS 'Parent dashboard — "show me my children" (includes relationship type)';

-- 11.3 Current enrollment lookups
CREATE INDEX idx_ce_current_enrollments
    ON class_enrollments(student_id, status)
    WHERE status = 'active';
COMMENT ON INDEX idx_ce_current_enrollments IS 'Fast lookup of student current enrollment for attendance and homework assignment';

-- 11.4 Class enrollment history view
CREATE INDEX idx_ce_class_history
    ON class_enrollments(class_id, academic_year_id, status);
COMMENT ON INDEX idx_ce_class_history IS 'Class composition history — which students were in a class in a given year';

-- 11.5 Teacher's current assignments (dashboard)
CREATE INDEX idx_tcs_teacher_current
    ON teacher_class_subjects(teacher_id, academic_term_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_tcs_teacher_current IS 'Teacher dashboard — current class and subject assignments for the active term';

-- 11.6 Class form teacher lookup
CREATE INDEX idx_classes_teacher
    ON classes(class_teacher_id)
    WHERE deleted_at IS NULL;
COMMENT ON INDEX idx_classes_teacher IS 'Form teacher quick lookup — "which classes does this teacher manage"';

-- 11.7 Homework submission grading queue
CREATE INDEX idx_hs_grading_queue
    ON homework_submissions(homework_id, status, created_at ASC)
    WHERE is_graded = FALSE;
COMMENT ON INDEX idx_hs_grading_queue IS 'Grading queue — ungraded submissions ordered by submission time';

-- 11.8 Test attempt grading queue
CREATE INDEX idx_ta_grading_queue
    ON test_attempts(test_id, status, submitted_at ASC)
    WHERE is_graded = FALSE;
COMMENT ON INDEX idx_ta_grading_queue IS 'Grading queue — ungraded test attempts ordered by submission time';

-- 11.9 Homework submissions by student (student dashboard)
CREATE INDEX idx_hs_student
    ON homework_submissions(student_id, created_at DESC);
COMMENT ON INDEX idx_hs_student IS 'Student dashboard — homework submission history and status';

-- 11.10 Test attempts by student (student dashboard)
CREATE INDEX idx_ta_student
    ON test_attempts(student_id, created_at DESC);
COMMENT ON INDEX idx_ta_student IS 'Student dashboard — test attempt history and scores';
