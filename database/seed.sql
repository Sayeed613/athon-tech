-- =============================================================================
-- ATHON — School Management & Assessment Platform
-- seed.sql — Development Seed Data
-- PostgreSQL 16 | Supabase Compatible
-- =============================================================================
-- This file must be executed AFTER rls.sql (all RLS policies in place).
--
-- WARNING: This file contains DEMO data for development and testing only.
--          DO NOT use in production without replacing all records.
--
-- All UUIDs use a recognizable format (0000...00001, 0000...00010, etc.)
-- to make debugging and development easier. In production, use gen_random_uuid().
--
-- Order of insertion:
--   1. schools
--   2. academic_years & academic_terms
--   3. users (all roles)
--   4. teachers, principals, parents
--   5. classes & subjects
--   6. students
--   7. student_parents & class_enrollments
--   8. teacher_class_subjects
--   9. Optional: sample homeworks, tests, reports, notifications
-- =============================================================================

-- =============================================================================
-- WARNING: Seed data is wrapped in a transaction. If any INSERT fails,
-- the entire seed is rolled back. Run with caution on non-empty databases.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. SCHOOLS
-- =============================================================================
-- One demo school for development. Add more schools as needed for
-- multi-tenant testing scenarios.

INSERT INTO schools (id, name, code, address, phone, email, domain, settings, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Athon Demo International School',
    'ATH-DEMO-001',
    '123 Education Boulevard, Learning City, ED 10001',
    '+1-555-0100',
    'admin@athondemo.edu',
    'demo.athonschool.com',
    '{
        "grading_scale": {"A": 90, "B": 80, "C": 70, "D": 60, "F": 0},
        "max_class_capacity": 35,
        "academic_year_format": "YYYY-YYYY",
        "default_language": "en",
        "timezone": "UTC",
        "whatsapp_business_number": "+1-555-0100"
    }'::jsonb,
    TRUE
);

-- =============================================================================
-- 2. ACADEMIC CALENDAR
-- =============================================================================

INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '2025-2026',
    '2025-09-01',
    '2026-06-30',
    TRUE
);

INSERT INTO academic_terms (id, academic_year_id, school_id, name, start_date, end_date, is_current)
VALUES
(
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Term 1',
    '2025-09-01',
    '2025-12-20',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Term 2',
    '2026-01-05',
    '2026-06-30',
    FALSE
);

-- =============================================================================
-- 3. USERS
-- =============================================================================
-- One user per role for development testing.
-- IMPORTANT: supabase_user_id values are PLACEHOLDERS. Replace with actual
-- Supabase Auth user IDs after creating users in the Supabase Auth dashboard.
--
-- Email conventions for testing:
--   admin@athondemo.edu       → school_admin
--   principal@athondemo.edu   → principal
--   teacher@athondemo.edu     → teacher
--   student@athondemo.edu     → student
--   parent@athondemo.edu      → parent
--   super@athonsystem.io      → super_admin (mocked, belongs to no school)

INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale)
VALUES
(
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'admin@athondemo.edu',
    '00000000-0000-0000-0000-0000000000aa',  -- placeholder — replace with real Supabase Auth ID
    'Alice',
    'Admin',
    'school_admin',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'principal@athondemo.edu',
    '00000000-0000-0000-0000-0000000000bb',  -- placeholder
    'Peter',
    'Principal',
    'principal',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'teacher@athondemo.edu',
    '00000000-0000-0000-0000-0000000000cc',  -- placeholder
    'Tina',
    'Teacher',
    'teacher',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'student@athondemo.edu',
    '00000000-0000-0000-0000-0000000000dd',  -- placeholder
    'Sam',
    'Student',
    'student',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000001',
    'parent@athondemo.edu',
    '00000000-0000-0000-0000-0000000000ee',  -- placeholder
    'Patricia',
    'Parent',
    'parent',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    'student2@athondemo.edu',
    '00000000-0000-0000-0000-0000000000ff',  -- placeholder
    'Sierra',
    'Student',
    'student',
    TRUE,
    'en'
),
(
    '00000000-0000-0000-0000-000000000016',
    '00000000-0000-0000-0000-000000000001',  -- attached to demo school for simplicity
    'super@athonsystem.io',
    '00000000-0000-0000-0000-0000000000ab',  -- placeholder
    'Super',
    'Admin',
    'super_admin',
    TRUE,
    'en'
);

-- =============================================================================
-- 4. STAFF & FACULTY PROFILES
-- =============================================================================

INSERT INTO teachers (id, user_id, school_id, employee_code, qualification, specialization, hire_date, is_class_teacher)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'TCH-001',
    'M.Ed. Mathematics',
    'Mathematics & Science',
    '2024-08-15',
    TRUE
);

INSERT INTO principals (id, user_id, school_id, employee_code, qualification, appointment_type, tenure_start_date)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'PRN-001',
    'Ed.D. Educational Leadership',
    'permanent',
    '2024-07-01'
);

INSERT INTO parents (id, user_id, school_id, occupation, is_verified)
VALUES (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000001',
    'Software Engineer',
    TRUE
);


-- =============================================================================
-- 5. ACADEMIC STRUCTURE
-- =============================================================================

INSERT INTO classes (id, school_id, name, section, academic_year_id, class_teacher_id, capacity)
VALUES
(
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001',
    'Grade 10',
    'A',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000020',
    30
),
(
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000001',
    'Grade 10',
    'B',
    '00000000-0000-0000-0000-000000000002',
    NULL,
    30
);

INSERT INTO subjects (id, school_id, name, code, description, is_core)
VALUES
(
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000001',
    'Mathematics',
    'MATH101',
    'Algebra, Geometry, and Trigonometry',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000001',
    'English Language',
    'ENG101',
    'Reading comprehension, writing, and literature',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000001',
    'Science',
    'SCI101',
    'Physics, Chemistry, and Biology foundations',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000053',
    '00000000-0000-0000-0000-000000000001',
    'History',
    'HIS101',
    'World history and geography',
    FALSE
),
(
    '00000000-0000-0000-0000-000000000054',
    '00000000-0000-0000-0000-000000000001',
    'Art',
    'ART101',
    'Visual arts and design fundamentals',
    FALSE
);


-- =============================================================================
-- 6. STUDENTS
-- =============================================================================

INSERT INTO students (id, user_id, school_id, class_id, admission_number, roll_number, date_of_birth, gender, enrollment_date, is_active)
VALUES
(
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000040',
    'ADM-2025-001',
    '01',
    '2008-03-15',
    'male',
    '2025-09-01',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000040',
    'ADM-2025-002',
    '02',
    '2008-07-22',
    'female',
    '2025-09-01',
    TRUE
);


-- =============================================================================
-- 7. RELATIONSHIPS & ENROLLMENTS
-- =============================================================================

-- Student-Parent: Sam (student) is Patricia's child
INSERT INTO student_parents (id, student_id, parent_id, school_id, relationship, is_primary_contact, receive_whatsapp)
VALUES (
    '00000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000001',
    'mother',
    TRUE,
    TRUE
);

-- Class enrollments for both students
INSERT INTO class_enrollments (id, school_id, student_id, class_id, academic_year_id, status)
VALUES
(
    '00000000-0000-0000-0000-000000000070',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000002',
    'active'
),
(
    '00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000002',
    'active'
);


-- =============================================================================
-- 8. TEACHER ASSIGNMENTS
-- =============================================================================

-- Tina Teacher teaches Mathematics to Grade 10A
INSERT INTO teacher_class_subjects (id, teacher_id, class_id, subject_id, school_id, academic_term_id, is_class_teacher)
VALUES (
    '00000000-0000-0000-0000-000000000080',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000003',
    TRUE
);


-- =============================================================================
-- 9. SAMPLE HOMEWORK & TEST DATA
-- =============================================================================
-- Uncomment and customize these sections when you need demonstration data.

/*
-- Sample homework: Algebra Quiz
INSERT INTO homeworks (id, school_id, teacher_id, class_id, subject_id, academic_term_id, title, description, due_date, max_score, is_published, published_at)
VALUES (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000003',
    'Algebra Fundamentals Quiz',
    'Solve the following algebra problems. Show all your working.',
    '2025-10-15 23:59:00+00',
    100.00,
    TRUE,
    now()
);

INSERT INTO homework_questions (id, homework_id, question_text, question_type, options, correct_answer, points, sort_order)
VALUES
(
    '00000000-0000-0000-0000-000000000110',
    '00000000-0000-0000-0000-000000000100',
    'Solve for x: 2x + 5 = 13',
    'short_answer',
    NULL,
    'x = 4',
    10.00,
    1
),
(
    '00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000100',
    'Which of the following represents a linear equation?',
    'multiple_choice',
    '[{"label": "A", "text": "y = x²"}, {"label": "B", "text": "y = 2x + 3"}, {"label": "C", "text": "y = 1/x"}, {"label": "D", "text": "y = x³"}]'::jsonb,
    'B',
    10.00,
    2
);

-- Sample test: Midterm Mathematics
INSERT INTO tests (id, school_id, teacher_id, class_id, subject_id, academic_term_id, title, test_type, total_marks, duration_minutes, scheduled_at, is_published)
VALUES (
    '00000000-0000-0000-0000-000000000200',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000003',
    'Mathematics Midterm Examination',
    'midterm',
    100.00,
    120,
    '2025-11-01 09:00:00+00',
    TRUE
);
*/


-- =============================================================================
-- 10. SEED DATA SUMMARY
-- =============================================================================
-- To verify the seed was applied correctly, run:
--   SELECT 'schools' AS tbl, COUNT(*) FROM schools
--   UNION ALL SELECT 'users', COUNT(*) FROM users
--   UNION ALL ...
-- Expected counts after seed:
--   schools:                 1
--   academic_years:          1
--   academic_terms:          2
--   users:                   7
--   teachers:                1
--   principals:              1
--   parents:                 1
--   classes:                 2
--   subjects:                5
--   students:                2
--   student_parents:         1
--   class_enrollments:       2
--   teacher_class_subjects:  1
-- =============================================================================

COMMIT;
