# Athon — Database Architecture

**Last Updated**: June 9, 2026

---

## 1. Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 16 (Supabase) |
| Connection | asyncpg via SQLAlchemy 2.0 Async |
| URL | `postgresql+asyncpg://...` (from `.env`) |
| ORM | 29 SQLAlchemy models in `app/models/` |
| Migrations | Alembic (3 versions in `alembic/versions/`) |
| SQL Files | 6 files in `database/` (enums, tables, indexes, triggers, RLS, seed) |

---

## 2. Entity Relationship

### Core Tenants

```
schools (1) ──┬── academic_years (N)
              ├── users (N) ──┬── teachers (0..1)
              │               ├── principals (0..1)
              │               ├── parents (0..1)
              │               └── students (0..1)
              ├── classes (N) ──── timetable_entries (N)
              ├── subjects (N)
              ├── periods (N)
              ├── attendance (N)
              ├── homeworks (N) ── homework_questions (N)
              │                  └── homework_submissions (N) ── homework_answers (N)
              ├── tests (N) ── test_questions (N)
              │              └── test_attempts (N) ── test_answers (N)
              ├── notifications (N) ── notification_recipients (N)
              ├── announcements (N)
              ├── reports (N)
              ├── audit_logs (N)
              └── ai_generations (N)
```

### User → Role Profiles

```
users (1) ──→ teachers (0..1)
users (1) ──→ principals (0..1)
users (1) ──→ parents (0..1)
users (1) ──→ students (0..1)
```

### Student Relationships

```
students (1) ──→ classes (N)          (current class)
students (1) ──→ class_enrollments (N) (history)
students (1) ──→ student_parents (N)   (parent links)
students (1) ──→ attendance (N)
students (1) ──→ homework_submissions (N)
students (1) ──→ test_attempts (N)

parents (1) ──→ student_parents (N)   (child links)
```

### Teacher Relationships

```
teachers (1) ──→ teacher_class_subjects (N) (class-subject assignments)
teachers (N) ──→ classes (N) via timetable_entries
teachers (1) ──→ homeworks (N)
teachers (1) ──→ tests (N)
teachers (1) ──→ attendance (N) (as marker)
```

---

## 3. All Tables (29)

| # | Table | Purpose | School-Scoped | Soft Delete |
|---|-------|---------|:-------------:|:-----------:|
| 1 | `schools` | Tenant root | Root | ✅ |
| 2 | `users` | Auth principal (linked to Supabase) | ✅ | ✅ |
| 3 | `teachers` | Teacher-specific profile | ✅ | ✅ |
| 4 | `principals` | Principal-specific profile | ✅ | ✅ |
| 5 | `parents` | Parent/guardian profile | ✅ | ✅ |
| 6 | `students` | Student-specific profile | ✅ | ✅ |
| 7 | `student_parents` | M:N parent-student links | ✅ | ❌ |
| 8 | `classes` | Class groups (e.g., "Grade 10-A") | ✅ | ✅ |
| 9 | `subjects` | Academic subjects offered | ✅ | ✅ |
| 10 | `academic_years` | Academic calendar years | ✅ | ✅ |
| 11 | `academic_terms` | Terms within academic year | ✅ | ✅ |
| 12 | `periods` | School day time slots | ✅ | ✅ |
| 13 | `teacher_class_subjects` | Teacher → class → subject mappings | ✅ | ✅ |
| 14 | `class_enrollments` | Enrollment history across years | ✅ | ❌ |
| 15 | `timetable_entries` | Class & teacher schedule | ✅ | ✅ |
| 16 | `attendance` | Daily attendance per student | ✅ | ❌ |
| 17 | `homeworks` | Homework assignments | ✅ | ✅ |
| 18 | `homework_questions` | Questions within a homework | ✅ (via FK) | ❌ |
| 19 | `homework_submissions` | Student homework submissions | ✅ | ❌ |
| 20 | `homework_answers` | Per-question answers | ✅ (via FK) | ❌ |
| 21 | `tests` | Test/exam definitions | ✅ | ✅ |
| 22 | `test_questions` | Questions within a test | ✅ (via FK) | ❌ |
| 23 | `test_attempts` | Student test attempts | ✅ | ❌ |
| 24 | `test_answers` | Per-question answers | ✅ (via FK) | ❌ |
| 25 | `reports` | Generated reports (JSONB) | ✅ | ❌ |
| 26 | `notifications` | Outbound notification records | ✅ | ❌ |
| 27 | `notification_recipients` | Per-recipient delivery tracking | ✅ (via FK) | ❌ |
| 28 | `announcements` | School announcements | ✅ | ✅ |
| 29 | `audit_logs` | Immutable audit trail | ✅ | ❌ (immutable) |
| 30 | `ai_generations` | AI content generation audit | ✅ | ❌ (immutable) |

---

## 4. ENUM Types (11)

| Enum | Values | Used In |
|------|--------|---------|
| `user_role` | super_admin, school_admin, principal, teacher, student, parent | `users.role` |
| `attendance_status` | present, absent, late, half_day | `attendance.status` |
| `question_type` | multiple_choice, true_false, short_answer, long_answer, essay | `homework_questions.question_type`, `test_questions.question_type` |
| `attempt_status` | pending, in_progress, submitted, graded, results_published | `homework_submissions.status`, `test_attempts.status` |
| `enrollment_status` | active, promoted, transferred, graduated, withdrawn | `class_enrollments.status` |
| `notification_channel` | whatsapp, email, push, sms | `notification_recipients.channel` |
| `notification_type` | academic, attendance, fee_reminder, announcement, behavioral, emergency, system, other | `notifications.notification_type` |
| `notification_status` | pending, sent, delivered, failed | `notification_recipients.status` |
| `report_type` | student_progress, class_performance, teacher_performance, attendance_summary, exam_results, custom | `reports.report_type` |
| `gender` | male, female, other | `students.gender` |
| `parent_relationship` | father, mother, guardian, other | `student_parents.relationship` |

---

## 5. Key Indexes (41 total)

| Table | Indexes | Purpose |
|-------|---------|---------|
| `users` | `email`, `supabase_user_id`, `school_id + email` (unique) | Fast auth lookup |
| `attendance` | `student_id + date`, `class_id + date`, `school_id + date` | Fast attendance queries |
| `timetable_entries` | `class_id + day_of_week`, `teacher_id + day_of_week` | Schedule queries |
| `homeworks` | `class_id + is_published`, `teacher_id` | Homework listing |
| `tests` | `class_id + is_published` | Test listing |
| `notifications` | `school_id + created_at` | Notification queries |

---

## 6. Seed Data (Current Counts)

| Table | Count |
|-------|:-----:|
| schools | 1 |
| users | 112 |
| teachers | 10 |
| students | 50 |
| parents | 50 |
| principals | 1 |
| classes | 8 |
| subjects | 8 |
| academic_years | 1 |
| academic_terms | 1 |
| periods | 8 |
| attendance | ~250 |
| homeworks | 8 |
| homework_submissions | ~200 |
| tests | 6 |
| test_attempts | ~120 |
| timetable_entries | 40 |

---

## 7. Migrations (Alembic)

| Version | Description | Status |
|---------|-------------|--------|
| `f65f053e7d10` | Stamp initial schema | ✅ Applied |
| `20260602_1200` | Create periods and timetable_entries | ✅ Applied |
| `20260608_0100` | Create announcements table | ✅ Applied |

---

## 8. Multi-Tenant Strategy

- **Architecture**: Shared database, shared schema
- **Isolation**: Every table has `school_id` column + RLS policies
- **Application Layer**: All queries include `school_id` filter
- **RLS**: ~90 policies across all 29 tables, enforced via `app` schema helper functions

---

## 9. Future Changes

| Change | Reason | Priority |
|--------|--------|----------|
| Partition `attendance` by date | Table grows ~1000 rows/month/school | Medium |
| Partition `audit_logs` by month | Immutable, append-only | Low |
| Archive soft-deleted records | Performance cleanup | Low |
| Add `is_current` flag to `academic_years` | Simplify current year lookup | Low |
