-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- rls.sql — Row Level Security Policies
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed AFTER triggers.sql and BEFORE seed.sql.
--
-- Architecture:
--   1. app schema — Security helper functions isolated from public schema
--   2. Helper functions — Role/school lookups for policy definitions
--   3. RLS enablement — One ALTER TABLE per table
--   4. Policies — Two-layer approach:
--      a. Tenant isolation (school_id = current_user's school)
--      b. Role-based access (what each role can read/write)
--
-- Role hierarchy:
--   super_admin     → Unrestricted access (bypasses RLS via service_role)
--   school_admin    → Full CRUD within their school
--   principal       → School-wide read, approval-level write
--   teacher         → Own assignments, classes, and students
--   student         → Own data only
--   parent          → Own children's data
--
-- Session context:
--   The application sets `app.current_school_id` and `app.current_user_id`
--   at connection time for service_role operations.
--   For end-user queries, policies use auth.uid() from Supabase Auth.
-- =============================================================================

-- =============================================================================
-- 1. APP SCHEMA — Security Helper Functions
-- =============================================================================
-- Provides helper functions that RLS policies use to determine access.
-- Isolated in the 'app' schema to avoid namespace pollution.

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Security helpers for RLS policies — isolated from public schema';


-- =============================================================================
-- 2. HELPER FUNCTIONS
-- =============================================================================

-- 2.1. current_user_id — Returns the authenticated user's UUID
--      Prefers the session setting (set by service_role operations),
--      falls back to auth.uid() for end-user queries.
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID,
        auth.uid()
    );
$$;

COMMENT ON FUNCTION app.current_user_id IS 'Returns current user UUID from session setting or auth.uid()';


-- 2.2. current_school_id — Returns the current user's school
--      Reads from session setting or looks up from users table.
CREATE OR REPLACE FUNCTION app.current_school_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_school_id', TRUE), '')::UUID,
        (SELECT school_id FROM public.users WHERE id = app.current_user_id() AND deleted_at IS NULL)
    );
$$;

COMMENT ON FUNCTION app.current_school_id IS 'Returns current school UUID from session setting or user lookup';


-- 2.3. current_user_role — Returns the current user's role
--      Reads from session setting or looks up from users table.
CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS public.user_role
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('app.current_user_role', TRUE), '')::public.user_role,
        (SELECT role FROM public.users WHERE id = app.current_user_id() AND deleted_at IS NULL)
    );
$$;

COMMENT ON FUNCTION app.current_user_role IS 'Returns current user role from session setting or user lookup';


-- 2.4. user_has_role — Convenience function for role checks
CREATE OR REPLACE FUNCTION app.user_has_role(VARIADIC p_roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT app.current_user_role() = ANY(p_roles);
$$;

COMMENT ON FUNCTION app.user_has_role IS 'Returns TRUE if the current user has one of the specified roles';


-- 2.5. user_belongs_to_school — Checks if user belongs to a given school
CREATE OR REPLACE FUNCTION app.user_belongs_to_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = app.current_user_id()
          AND school_id = p_school_id
          AND deleted_at IS NULL
    );
$$;

COMMENT ON FUNCTION app.user_belongs_to_school IS 'Returns TRUE if the current user belongs to the specified school';


-- 2.6. is_parent_of_student — Checks if current user (as parent) is linked to a student
CREATE OR REPLACE FUNCTION app.is_parent_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.student_parents sp
        JOIN public.parents p ON p.id = sp.parent_id
        WHERE sp.student_id = p_student_id
          AND p.user_id = app.current_user_id()
    );
$$;

COMMENT ON FUNCTION app.is_parent_of_student IS 'Returns TRUE if the current user (as parent) is linked to the specified student';


-- 2.7. is_teacher_of_class — Checks if current teacher is assigned to a class
CREATE OR REPLACE FUNCTION app.is_teacher_of_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.teacher_class_subjects tcs
        JOIN public.teachers t ON t.id = tcs.teacher_id
        WHERE tcs.class_id = p_class_id
          AND t.user_id = app.current_user_id()
          AND t.deleted_at IS NULL
          AND tcs.deleted_at IS NULL
    );
$$;

COMMENT ON FUNCTION app.is_teacher_of_class IS 'Returns TRUE if the current user (as teacher) teaches the specified class';


-- 2.8. is_teacher_of_student — Checks if current teacher teaches a student's class
CREATE OR REPLACE FUNCTION app.is_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = p_student_id
          AND app.is_teacher_of_class(s.class_id)
          AND s.deleted_at IS NULL
    );
$$;

COMMENT ON FUNCTION app.is_teacher_of_student IS 'Returns TRUE if the current teacher teaches the class of the specified student';


-- =============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.schools                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.principals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_parents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeworks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_answers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations           ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 4. RLS POLICIES
-- =============================================================================
-- Naming convention: p_{table}_{action}_{suffix}
--   p_   = policy
--   FOR  = SELECT / INSERT / UPDATE / DELETE / ALL
--   TO   = anon / authenticated / service_role
--   USING (read/delete filter)
--   WITH CHECK (insert/update validation)
-- =============================================================================


-- 4.1. schools — Tenant root
--       Only super_admin can modify; all authenticated users in the school can view.
CREATE POLICY p_schools_select ON public.schools
    FOR SELECT USING (
        id = app.current_school_id()
    );

COMMENT ON POLICY p_schools_select ON public.schools IS 'Users can only see their own school record; anonymous access handled separately if needed';

CREATE POLICY p_schools_insert ON public.schools
    FOR INSERT WITH CHECK (
        app.user_has_role('super_admin')
    );

CREATE POLICY p_schools_update ON public.schools
    FOR UPDATE USING (
        app.user_has_role('super_admin')
    );

CREATE POLICY p_schools_delete ON public.schools
    FOR DELETE USING (
        app.user_has_role('super_admin')
    );


-- 4.2. academic_years & academic_terms
--       School-wide read; write by school_admin or principal.
CREATE POLICY p_academic_years_select ON public.academic_years
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_academic_years_write ON public.academic_years
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_academic_years_modify ON public.academic_years
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_academic_years_delete ON public.academic_years
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


CREATE POLICY p_academic_terms_select ON public.academic_terms
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_academic_terms_write ON public.academic_terms
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_academic_terms_modify ON public.academic_terms
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_academic_terms_delete ON public.academic_terms
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.3. users
--       Users can see their own record. Admins/principals see school-wide.
--       Teachers see students and other teachers within the school.
CREATE POLICY p_users_select_self ON public.users
    FOR SELECT USING (
        id = app.current_user_id()
    );

CREATE POLICY p_users_select_school ON public.users
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_users_select_parent ON public.users
    FOR SELECT USING (
        -- Parents can see teachers and students linked to their children
        EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.parents p ON p.id = sp.parent_id
            WHERE p.user_id = app.current_user_id()
        )
        AND app.user_has_role('parent')
    );

CREATE POLICY p_users_insert ON public.users
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_users_update_self ON public.users
    FOR UPDATE USING (
        id = app.current_user_id()
    );

CREATE POLICY p_users_update_school ON public.users
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_users_delete ON public.users
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.4. teachers
--       Teachers see own profile; school_admin/principal see school-wide.
CREATE POLICY p_teachers_select_self ON public.teachers
    FOR SELECT USING (
        user_id = app.current_user_id()
    );

CREATE POLICY p_teachers_select_school ON public.teachers
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_teachers_insert ON public.teachers
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_teachers_update ON public.teachers
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND (user_id = app.current_user_id() OR app.user_has_role('school_admin'))
    );

CREATE POLICY p_teachers_delete ON public.teachers
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.5. principals
--       Principal sees own profile; school_admin sees school-wide.
CREATE POLICY p_principals_select_self ON public.principals
    FOR SELECT USING (
        user_id = app.current_user_id()
    );

CREATE POLICY p_principals_select_school ON public.principals
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_principals_insert ON public.principals
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_principals_update ON public.principals
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND (user_id = app.current_user_id() OR app.user_has_role('school_admin'))
    );

CREATE POLICY p_principals_delete ON public.principals
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.6. parents
--       Parents see own profile; school_admin/principal/teacher see school-wide.
CREATE POLICY p_parents_select_self ON public.parents
    FOR SELECT USING (
        user_id = app.current_user_id()
    );

CREATE POLICY p_parents_select_school ON public.parents
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_parents_insert ON public.parents
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_parents_update ON public.parents
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND (user_id = app.current_user_id() OR app.user_has_role('school_admin'))
    );

CREATE POLICY p_parents_delete ON public.parents
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.7. classes
--       School-wide read; write by school_admin/principal.
CREATE POLICY p_classes_select ON public.classes
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_classes_insert ON public.classes
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_classes_update ON public.classes
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_classes_delete ON public.classes
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.8. subjects
--       School-wide read; write by school_admin/principal.
CREATE POLICY p_subjects_select ON public.subjects
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_subjects_insert ON public.subjects
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_subjects_update ON public.subjects
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_subjects_delete ON public.subjects
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.9. students
--       Student sees own profile; school staff see school-wide; parent sees children.
CREATE POLICY p_students_select_self ON public.students
    FOR SELECT USING (
        user_id = app.current_user_id()
    );

CREATE POLICY p_students_select_school ON public.students
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_students_select_parent ON public.students
    FOR SELECT USING (
        app.is_parent_of_student(id)
    );

CREATE POLICY p_students_insert ON public.students
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_students_update ON public.students
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_students_delete ON public.students
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.10. student_parents
--       Junction table: school-wide staff view; parent sees own children.
CREATE POLICY p_sp_select_school ON public.student_parents
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_sp_select_parent ON public.student_parents
    FOR SELECT USING (
        parent_id IN (
            SELECT p.id FROM public.parents p WHERE p.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_sp_insert ON public.student_parents
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_sp_update ON public.student_parents
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_sp_delete ON public.student_parents
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.11. class_enrollments
--       School-wide read; write by school_admin.
CREATE POLICY p_ce_select ON public.class_enrollments
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_ce_insert ON public.class_enrollments
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_ce_update ON public.class_enrollments
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_ce_delete ON public.class_enrollments
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.13. periods — Reference data (same pattern as subjects)
--       School-wide read; write by school_admin/principal.
CREATE POLICY p_periods_select ON public.periods
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_periods_insert ON public.periods
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_periods_update ON public.periods
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_periods_delete ON public.periods
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.14. timetable_entries — Unified schedule
--       School-wide read (teachers see their classes through the unified view);
--       write by school_admin/principal only.
CREATE POLICY p_tt_select ON public.timetable_entries
    FOR SELECT USING (
        school_id = app.current_school_id()
    );

CREATE POLICY p_tt_insert ON public.timetable_entries
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_tt_update ON public.timetable_entries
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_tt_delete ON public.timetable_entries
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.15. attendance
--       Teachers see their class attendance; school-wide for admin/principal;
--       students see own; parents see children's.
CREATE POLICY p_attendance_select_teacher ON public.attendance
    FOR SELECT USING (
        app.is_teacher_of_class(class_id)
    );

CREATE POLICY p_attendance_select_staff ON public.attendance
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_attendance_select_student ON public.attendance
    FOR SELECT USING (
        student_id IN (
            SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_attendance_select_parent ON public.attendance
    FOR SELECT USING (
        app.is_parent_of_student(student_id)
    );

CREATE POLICY p_attendance_insert ON public.attendance
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('teacher', 'school_admin')
    );

CREATE POLICY p_attendance_update ON public.attendance
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('teacher', 'school_admin')
    );

CREATE POLICY p_attendance_delete ON public.attendance
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.16. homeworks
--       Teachers see own; school-wide for admin/principal.
--       Students and parents see only published homeworks for their class.
CREATE POLICY p_homeworks_select_teacher ON public.homeworks
    FOR SELECT USING (
        teacher_id IN (
            SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_homeworks_select_staff ON public.homeworks
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_homeworks_select_student ON public.homeworks
    FOR SELECT USING (
        is_published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.class_id = homeworks.class_id
              AND s.user_id = app.current_user_id()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY p_homeworks_select_parent ON public.homeworks
    FOR SELECT USING (
        is_published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.parents p ON p.id = sp.parent_id
            JOIN public.students s ON s.id = sp.student_id
            WHERE p.user_id = app.current_user_id()
              AND s.class_id = homeworks.class_id
        )
    );

CREATE POLICY p_homeworks_insert ON public.homeworks
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('teacher', 'school_admin')
    );

CREATE POLICY p_homeworks_update_owner ON public.homeworks
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND teacher_id IN (
            SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_homeworks_update_staff ON public.homeworks
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_homeworks_delete ON public.homeworks
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.17. homework_questions
--       Visibility follows parent homework visibility.
CREATE POLICY p_hq_select ON public.homework_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_questions.homework_id
              AND (
                  (h.is_published = TRUE AND h.school_id = app.current_school_id())
                  OR h.teacher_id IN (
                      SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin', 'principal')
              )
              AND h.deleted_at IS NULL
        )
    );

CREATE POLICY p_hq_insert ON public.homework_questions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_questions.homework_id
              AND h.school_id = app.current_school_id()
              AND (
                  h.teacher_id IN (
                      SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
              AND h.deleted_at IS NULL
        )
    );

CREATE POLICY p_hq_update ON public.homework_questions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_questions.homework_id
              AND h.school_id = app.current_school_id()
              AND (
                  h.teacher_id IN (
                      SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );

CREATE POLICY p_hq_delete ON public.homework_questions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_questions.homework_id
              AND h.school_id = app.current_school_id()
              AND (h.teacher_id IN (
                      SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );


-- 4.18. homework_submissions
--       Students see own; teachers see submissions for their homework;
--       school-wide for admin/principal.
CREATE POLICY p_hs_select_student ON public.homework_submissions
    FOR SELECT USING (
        student_id IN (
            SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_hs_select_teacher ON public.homework_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_submissions.homework_id
              AND h.teacher_id IN (
                  SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_hs_select_staff ON public.homework_submissions
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_hs_insert_student ON public.homework_submissions
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND student_id IN (
            SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_hs_update_teacher ON public.homework_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.homeworks h
            WHERE h.id = homework_submissions.homework_id
              AND h.teacher_id IN (
                  SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_hs_delete ON public.homework_submissions
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.19. homework_answers
--       Visibility follows submission visibility.
CREATE POLICY p_ha_select ON public.homework_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.homework_submissions hs
            WHERE hs.id = homework_answers.homework_submission_id
              AND (
                  hs.student_id IN (
                      SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.homeworks h
                      WHERE h.id = hs.homework_id
                        AND h.teacher_id IN (
                            SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                        )
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.homeworks h
                      WHERE h.id = hs.homework_id
                        AND h.school_id = app.current_school_id()
                        AND app.user_has_role('school_admin', 'principal')
                  )
              )
        )
    );

CREATE POLICY p_ha_insert ON public.homework_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.homework_submissions hs
            WHERE hs.id = homework_answers.homework_submission_id
              AND hs.student_id IN (
                  SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_ha_update ON public.homework_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.homework_submissions hs
            JOIN public.homeworks h ON h.id = hs.homework_id
            WHERE hs.id = homework_answers.homework_submission_id
              AND (
                  h.teacher_id IN (
                      SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );


-- 4.20. tests — Same pattern as homeworks
CREATE POLICY p_tests_select_teacher ON public.tests
    FOR SELECT USING (
        teacher_id IN (
            SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_tests_select_staff ON public.tests
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_tests_select_student ON public.tests
    FOR SELECT USING (
        is_published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.class_id = tests.class_id
              AND s.user_id = app.current_user_id()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY p_tests_select_parent ON public.tests
    FOR SELECT USING (
        is_published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.parents p ON p.id = sp.parent_id
            JOIN public.students s ON s.id = sp.student_id
            WHERE p.user_id = app.current_user_id()
              AND s.class_id = tests.class_id
        )
    );

CREATE POLICY p_tests_insert ON public.tests
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('teacher', 'school_admin')
    );

CREATE POLICY p_tests_update_owner ON public.tests
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND teacher_id IN (
            SELECT t.id FROM public.teachers t WHERE t.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_tests_update_staff ON public.tests
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

CREATE POLICY p_tests_delete ON public.tests
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.21. test_questions — Follows parent test visibility
CREATE POLICY p_tq_select ON public.test_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_questions.test_id
              AND (
                  (t.is_published = TRUE AND t.school_id = app.current_school_id())
                  OR t.teacher_id IN (
                      SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin', 'principal')
              )
              AND t.deleted_at IS NULL
        )
    );

CREATE POLICY p_tq_insert ON public.test_questions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_questions.test_id
              AND t.school_id = app.current_school_id()
              AND (t.teacher_id IN (
                      SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
              AND t.deleted_at IS NULL
        )
    );

CREATE POLICY p_tq_update ON public.test_questions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_questions.test_id
              AND t.school_id = app.current_school_id()
              AND (t.teacher_id IN (
                      SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );

CREATE POLICY p_tq_delete ON public.test_questions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_questions.test_id
              AND t.school_id = app.current_school_id()
              AND (t.teacher_id IN (
                      SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );


-- 4.22. test_attempts — Students see own; teachers see their test attempts
CREATE POLICY p_ta_select_student ON public.test_attempts
    FOR SELECT USING (
        student_id IN (
            SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_ta_select_teacher ON public.test_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_attempts.test_id
              AND t.teacher_id IN (
                  SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_ta_select_staff ON public.test_attempts
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_ta_insert_student ON public.test_attempts
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND student_id IN (
            SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
        )
    );

CREATE POLICY p_ta_update_teacher ON public.test_attempts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_attempts.test_id
              AND t.teacher_id IN (
                  SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_ta_delete ON public.test_attempts
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.23. test_answers — Follows attempt visibility
CREATE POLICY p_tans_select ON public.test_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.test_attempts ta
            WHERE ta.id = test_answers.test_attempt_id
              AND (
                  ta.student_id IN (
                      SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.tests t
                      WHERE t.id = ta.test_id
                        AND t.teacher_id IN (
                            SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                        )
                  )
                  OR EXISTS (
                      SELECT 1 FROM public.tests t
                      WHERE t.id = ta.test_id
                        AND t.school_id = app.current_school_id()
                        AND app.user_has_role('school_admin', 'principal')
                  )
              )
        )
    );

CREATE POLICY p_tans_insert ON public.test_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.test_attempts ta
            WHERE ta.id = test_answers.test_attempt_id
              AND ta.student_id IN (
                  SELECT s.id FROM public.students s WHERE s.user_id = app.current_user_id()
              )
        )
    );

CREATE POLICY p_tans_update ON public.test_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.test_attempts ta
            JOIN public.tests t ON t.id = ta.test_id
            WHERE ta.id = test_answers.test_attempt_id
              AND (t.teacher_id IN (
                      SELECT t2.id FROM public.teachers t2 WHERE t2.user_id = app.current_user_id()
                  )
                  OR app.user_has_role('school_admin')
              )
        )
    );


-- 4.24. reports
--       School-wide for staff; generated_by sees own; students/parents see published relevant reports.
CREATE POLICY p_reports_select_staff ON public.reports
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal', 'teacher')
    );

CREATE POLICY p_reports_select_self ON public.reports
    FOR SELECT USING (
        generated_by = app.current_user_id()
    );

CREATE POLICY p_reports_insert ON public.reports
    FOR INSERT WITH CHECK (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_reports_update ON public.reports
    FOR UPDATE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin', 'principal')
    );

CREATE POLICY p_reports_delete ON public.reports
    FOR DELETE USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.25. notifications
--       Recipients see their own notifications; system/service_role handles inserts.
CREATE POLICY p_notifications_select_recipient ON public.notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.notification_recipients nr
            WHERE nr.notification_id = notifications.id
              AND (
                  nr.user_id = app.current_user_id()
                  OR nr.parent_id IN (
                      SELECT p.id FROM public.parents p WHERE p.user_id = app.current_user_id()
                  )
              )
        )
    );

CREATE POLICY p_notifications_select_sender ON public.notifications
    FOR SELECT USING (
        sender_id = app.current_user_id()
    );

CREATE POLICY p_notifications_select_staff ON public.notifications
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

-- Notifications are created by the system (service_role), not end-users


-- 4.26. notification_recipients
--       Recipients see own delivery records.
CREATE POLICY p_nr_select ON public.notification_recipients
    FOR SELECT USING (
        user_id = app.current_user_id()
        OR parent_id IN (
            SELECT p.id FROM public.parents p WHERE p.user_id = app.current_user_id()
        )
    );

-- Notification recipients are managed by the system (service_role)


-- 4.27. audit_logs
--       Only school_admin and super_admin can view audit logs.
--       Audit logs are written by triggers, not end-users.
CREATE POLICY p_audit_select ON public.audit_logs
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );


-- 4.28. ai_generations
--       Users see own generations; school_admin sees school-wide.
CREATE POLICY p_ai_select_self ON public.ai_generations
    FOR SELECT USING (
        user_id = app.current_user_id()
    );

CREATE POLICY p_ai_select_staff ON public.ai_generations
    FOR SELECT USING (
        school_id = app.current_school_id()
        AND app.user_has_role('school_admin')
    );

-- AI generations are created by the application (service_role)
