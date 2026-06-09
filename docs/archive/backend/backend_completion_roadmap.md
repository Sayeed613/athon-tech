# 🏫 Athon — Backend Completion Roadmap

> **Date**: June 3, 2026
> **Purpose**: Implementation plan for the 30 P0 missing endpoints that block Admin Web and complete Teacher/Student flows
> **Phase Order**: A → B → C → D (3-4 weeks total)
> **Database Changes Required**: NONE — all tables exist with full ORM coverage

---

## Pre-Flight Verification

### ✅ All ORM Models Exist (32 models, 0 gaps)

| Model | File | Lines | Status |
|-------|------|:-----:|:------:|
| School | `school.py` | 86 | ✅ |
| User | `user.py` | 93 | ✅ |
| Teacher | `teacher.py` | 65 | ✅ |
| Student | `student.py` | 80 | ✅ |
| Parent | `parent.py` | 49 | ✅ |
| Principal | `principal.py` | 61 | ✅ |
| StudentParent | `student_parent.py` | 71 | ✅ |
| Class | `academic_class.py` | 69 | ✅ |
| Subject | `subject.py` | 53 | ✅ |
| Period | `period.py` | 56 | ✅ |
| AcademicYear | `academic_year.py` | 54 | ✅ |
| AcademicTerm | `academic_term.py` | 60 | ✅ |
| TeacherClassSubject | `teacher_class_subject.py` | 59 | ✅ |
| TimetableEntry | `timetable_entry.py` | 76 | ✅ |
| ClassEnrollment | `class_enrollment.py` | 76 | ✅ |
| Homework | `homework.py` | 89 | ✅ |
| HomeworkQuestion | `homework_question.py` | 69 | ✅ |
| HomeworkSubmission | `homework_submission.py` | 83 | ✅ |
| HomeworkAnswer | `homework_answer.py` | 57 | ✅ |
| Test | `test.py` | 102 | ✅ |
| TestQuestion | `test_question.py` | 69 | ✅ |
| TestAttempt | `test_attempt.py` | 91 | ✅ |
| TestAnswer | `test_answer.py` | 61 | ✅ |
| Attendance | `attendance.py` | 91 | ✅ |
| TimetableEntry | `timetable_entry.py` | 76 | ✅ |
| Notification | `notification.py` | 79 | ✅ |
| NotificationRecipient | `notification_recipient.py` | 92 | ✅ |
| Announcement | `announcement.py` | 72 | ✅ |
| AuditLog | `audit_log.py` | 68 | ✅ |
| AiGeneration | `ai_generation.py` | 76 | ✅ |
| Enums | `enums.py` | 169 | ✅ |
| Base | `base.py` | 54 | ✅ |

### ✅ DB Schema Has All Tables (29 tables, 11 ENUMs, 76 FKs)

All tables are deployed and seeded. No `ALTER TABLE` or migration required for any Phase A-D endpoint.

---

## Phase A — Identity CRUD (Week 1, ~10 endpoints)

### A.1 Teacher CRUD

#### A.1.1 `POST /teachers` — Create Teacher

**Purpose**: Create a new teacher profile + associated User account.

**Request Schema**:
```json
{
  "email": "teacher@school.edu",
  "password": "temporary-password",
  "first_name": "Tina",
  "last_name": "Teacher",
  "phone": "+919999999999",
  "employee_code": "TCH-2026-001",
  "qualification": "B.Ed, Mathematics",
  "specialization": "Mathematics",
  "hire_date": "2026-06-01",
  "role": "teacher"
}
```

**Response Schema** (201 Created):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "email": "teacher@school.edu",
  "first_name": "Tina",
  "last_name": "Teacher",
  "employee_code": "TCH-2026-001",
  "qualification": "B.Ed, Mathematics",
  "specialization": "Mathematics",
  "hire_date": "2026-06-01",
  "is_active": true,
  "created_at": "2026-06-03T10:00:00Z"
}
```

**Backend Tasks**:
| Layer | Action | Pattern Reference |
|-------|--------|-------------------|
| Schema | Create `CreateTeacherRequest`, `TeacherResponse` in `app/api/schemas/teachers.py` | `homeworks.py::CreateHomeworkRequest` |
| Route | `POST /teachers` in `app/api/v1/teachers.py` | `homeworks.py::create_homework` |
| Service | `TeacherService.create_teacher()` in `app/domain/identity/teacher_service.py` | `HomeworkService.create_homework()` |
| Repository | Populate `app/repository/teachers.py` with `TeacherRepository.create()` | `BaseRepository.create()` |
| User creation | Create User via `User` model, then Teacher link. Use Supabase Auth for password. | Auth login flow (Supabase delegation) |

**Repository Methods Needed**:
- `TeacherRepository(db)` extending `BaseRepository[Teacher]`
- No custom methods needed for basic CRUD (inherits `create`, `get`, `get_multi`, `update`, `soft_delete`)

**Service Methods**:
- `create_teacher(school_id, user_data, teacher_data) → Teacher`
  - 1. Create User via Supabase Auth (register)
  - 2. Create local User record
  - 3. Create Teacher record linked to User
  - 4. Return teacher profile with user info

**Permission**: `require_role("school_admin", "super_admin")`
**School Isolation**: `school_id` from authenticated user

#### A.1.2 `GET /teachers` — List Teachers

**Purpose**: List/search teachers with pagination.

**Request**: Query params: `skip`, `limit`, `search` (name/email/employee_code)

**Response** (200):
```json
{
  "teachers": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "first_name": "Tina",
      "last_name": "Teacher",
      "email": "teacher@school.edu",
      "employee_code": "TCH-2026-001",
      "qualification": "B.Ed, Mathematics",
      "specialization": "Mathematics",
      "hire_date": "2026-06-01",
      "is_active": true,
      "is_class_teacher": false
    }
  ],
  "total": 25,
  "skip": 0,
  "limit": 50
}
```

**Repository**: `TeacherRepository.get_multi()` with school scope + search filter
**Service**: `TeacherService.list_teachers(school_id, skip, limit, search)`
**Permission**: `require_role("school_admin", "super_admin")`

#### A.1.3 `GET /teachers/{teacher_id}` — Get Teacher

**Purpose**: Single teacher detail with assignments.

**Response**: Includes `TeacherResponse` + `assignments: [{class_id, class_name, subject_id, subject_name, academic_term_id}]`

**Repository**: `TeacherRepository.get()` with `selectinload(teacher_class_subjects)`
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### A.1.4 `PATCH /teachers/{teacher_id}` — Update Teacher

**Purpose**: Update teacher profile fields + associated user fields.

**Request Schema**: Partial update — all fields optional:
```json
{
  "first_name": "Updated",
  "last_name": "Name",
  "phone": "+919888888888",
  "qualification": "M.Ed",
  "specialization": "Science",
  "employee_code": "TCH-2026-001",
  "is_active": true
}
```

**Service**: `TeacherService.update_teacher(teacher_id, school_id, data)`
**Permission**: `require_role("school_admin", "super_admin")`
**School Isolation**: Verify teacher belongs to admin's school

#### A.1.5 `DELETE /teachers/{teacher_id}` — Soft-Delete Teacher

**Purpose**: Deactivate teacher (soft delete).

**Response**: 204 No Content

**Repository**: `TeacherRepository.soft_delete(teacher_id)`
**Service**: `TeacherService.delete_teacher(teacher_id, school_id)`
**Permission**: `require_role("school_admin", "super_admin")`

### A.2 Student CRUD

#### A.2.1 `POST /students` — Create Student

**Purpose**: Create student profile + User + ClassEnrollment in one transaction.

**Request Schema**:
```json
{
  "email": "student@school.edu",
  "password": "temporary-password",
  "first_name": "Sam",
  "last_name": "Student",
  "phone": "+919777777777",
  "admission_number": "ATH-2026-001",
  "class_id": "uuid",
  "roll_number": "10",
  "date_of_birth": "2010-05-15",
  "gender": "male",
  "enrollment_date": "2026-06-01"
}
```

**Backend Tasks**:
| Layer | Action |
|-------|--------|
| Schema | `CreateStudentRequest`, `StudentResponse` in `app/api/schemas/students.py` |
| Route | `POST /students` in `app/api/v1/students.py` |
| Service | `StudentService.create_student()` — creates User + Student + ClassEnrollment |
| Repo | Populate `app/repository/students.py` with `StudentRepository` |

**Service Logic**:
1. Create User via Supabase Auth
2. Create local User record
3. Create Student record
4. Create ClassEnrollment record (status=active)
5. Return full student profile

**Permission**: `require_role("school_admin", "super_admin")`

#### A.2.2 `GET /students` — List Students

**Purpose**: List/search students with pagination.

**Query params**: `skip`, `limit`, `search` (name/admission), `class_id`, `is_active`

**Response**:
```json
{
  "students": [...],
  "total": 200,
  "skip": 0,
  "limit": 50
}
```

**Repository**: `StudentRepository.get_multi()` with school scope
**Service**: `StudentService.list_students()`
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### A.2.3 `GET /students/{student_id}` — Get Student

**Purpose**: Single student detail.

**Response**: Includes user info, current class, enrollments, linked parents.

**Permission**: `require_role("school_admin", "super_admin", "principal", "teacher")`

#### A.2.4 `PATCH /students/{student_id}` — Update Student

**Purpose**: Update student fields. Changing `class_id` should also create a new ClassEnrollment.

**Permission**: `require_role("school_admin", "super_admin")`

#### A.2.5 `DELETE /students/{student_id}` — Soft-Delete Student

**Purpose**: Deactivate student.

**Response**: 204 No Content

**Permission**: `require_role("school_admin", "super_admin")`

#### A.2.6 `POST /students/import` — Bulk Import Students

**Purpose**: Upload CSV of students, create in batch.

**Request**: CSV file upload or JSON array of student objects.

**Response**:
```json
{
  "imported": 45,
  "failed": 2,
  "errors": [
    {"row": 3, "error": "Email already exists: duplicate@school.edu"}
  ]
}
```

**Service**: `StudentService.bulk_import(school_id, students_data)` — transactional batch
**Permission**: `require_role("school_admin", "super_admin")`

### A.3 Parent Linking

#### A.3.1 `POST /student-parents` — Link Parent to Student

**Purpose**: Create a StudentParent record linking an existing parent to an existing student.

**Request Schema**:
```json
{
  "student_id": "uuid",
  "parent_id": "uuid",
  "relationship": "father|mother|guardian|other",
  "is_primary_contact": true,
  "receive_whatsapp": true
}
```

**Response**: StudentParent record (201 Created)

**Repository**: Populate `app/repository/student_parents.py` with `StudentParentRepository`
**Service**: `StudentService.link_parent(school_id, student_id, parent_id, relationship, ...)`
**Permission**: `require_role("school_admin", "super_admin")`
**School Isolation**: Verify both student and parent belong to same school

### A.4 Principal CRUD

#### A.4.1 `POST /principals` — Create Principal

**Purpose**: Create principal profile + User.

**Request Schema**:
```json
{
  "email": "principal@school.edu",
  "password": "temporary-password",
  "first_name": "Peter",
  "last_name": "Principal",
  "employee_code": "PRN-2026-001",
  "qualification": "M.Ed, Educational Leadership",
  "appointment_type": "permanent",
  "tenure_start_date": "2026-06-01",
  "tenure_end_date": null
}
```

**Permission**: `require_role("school_admin", "super_admin")`

#### A.4.2 `GET /principals` — List Principals

**Permission**: `require_role("school_admin", "super_admin")`

#### A.4.3 `GET /principals/{principal_id}` — Get Principal

**Permission**: `require_role("school_admin", "super_admin")`

#### A.4.4 `PATCH /principals/{principal_id}` — Update Principal

**Permission**: `require_role("school_admin", "super_admin")`

#### A.4.5 `DELETE /principals/{principal_id}` — Soft-Delete Principal

**Permission**: `require_role("school_admin", "super_admin")`

---

## Phase B — Academic Structure CRUD (Week 2, ~8 endpoints)

### B.1 Class CRUD

#### B.1.1 `POST /classes` — Create Class

**Request Schema**:
```json
{
  "name": "Grade 10",
  "section": "A",
  "academic_year_id": "uuid",
  "class_teacher_id": "uuid (optional)",
  "room_number": "101",
  "capacity": 40
}
```

**Backend Tasks**:
| Layer | Action |
|-------|--------|
| Schema | `CreateClassRequest`, `ClassResponse` in `app/api/schemas/classes.py` |
| Route | `POST /classes` in `app/api/v1/classes.py` |
| Service | Populate `ClassService.create_class()` — `class_service.py` exists with 46 lines |
| Repo | `ClassRepository.create()` already available (81 lines) |

**Permission**: `require_role("school_admin", "super_admin")`
**School Isolation**: school_id from authenticated user

#### B.1.2 `GET /classes` — List Classes

**Query params**: `academic_year_id` (optional filter)

**Response**:
```json
{
  "classes": [
    {
      "id": "uuid",
      "name": "Grade 10",
      "section": "A",
      "academic_year_id": "uuid",
      "academic_year_name": "2025-2026",
      "class_teacher_id": "uuid (nullable)",
      "class_teacher_name": "Tina Teacher (nullable)",
      "student_count": 30,
      "room_number": "101",
      "capacity": 40
    }
  ],
  "total": 10
}
```

**Repository**: `ClassRepository.get_multi()` already available
**Service**: `ClassService.list_classes()`
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### B.1.3 `GET /classes/{class_id}` — Get Class

**Includes**: Student count, assigned teachers count

**Permission**: `require_role("school_admin", "super_admin", "principal", "teacher")`

#### B.1.4 `PATCH /classes/{class_id}` — Update Class

**Permission**: `require_role("school_admin", "super_admin")`

#### B.1.5 `DELETE /classes/{class_id}` — Soft-Delete Class

**Permission**: `require_role("school_admin", "super_admin")`

### B.2 Subject CRUD

#### B.2.1 `POST /subjects` — Create Subject

**Request Schema**:
```json
{
  "name": "Mathematics",
  "code": "MATH",
  "description": "Algebra, Geometry, Trigonometry",
  "is_core": true
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Schema | New — `app/api/schemas/subjects.py` |
| Route | New — `app/api/v1/subjects.py` |
| Service | `SubjectService` exists with 57 lines — populate `create_subject()` |
| Repo | `SubjectRepository` exists with 39 lines |

**Permission**: `require_role("school_admin", "super_admin")`

#### B.2.2 `GET /subjects` — List Subjects

**Permission**: `require_role("school_admin", "super_admin", "principal")`

### B.3 Academic Year CRUD

#### B.3.1 `GET /academic-years` — List Academic Years

**Purpose**: Return all academic years for the school.

**Response**:
```json
{
  "academic_years": [
    {
      "id": "uuid",
      "name": "2025-2026",
      "start_date": "2025-04-01",
      "end_date": "2026-03-31",
      "is_current": true
    }
  ],
  "total": 2
}
```

**Repository**: `AcademicYearRepository.get_multi()` — already available (47 lines)
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### B.3.2 `POST /academic-years` — Create Year

**Request Schema**:
```json
{
  "name": "2026-2027",
  "start_date": "2026-04-01",
  "end_date": "2027-03-31",
  "is_current": false
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Schema | New — `app/api/schemas/academic_years.py` |
| Route | New — route in existing or new file |
| Service | `AcademicCalendarService` exists — populate year methods |
| Repo | `AcademicYearRepository` exists with 47 lines |

**Permission**: `require_role("school_admin", "super_admin")`

### B.4 Academic Term CRUD

#### B.4.1 `GET /academic-terms` — List Academic Terms

**Purpose**: Return terms for a given academic year (or all terms for the school).

**Query params**: `academic_year_id` (optional filter)

**Repository**: `AcademicTermRepository.get_multi()` — already available (42 lines)
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### B.4.2 `POST /academic-terms` — Create Term

**Request Schema**:
```json
{
  "academic_year_id": "uuid",
  "name": "Term 1",
  "start_date": "2026-04-01",
  "end_date": "2026-09-30",
  "is_current": true
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Repo | `AcademicTermRepository` exists (42 lines) |

**Permission**: `require_role("school_admin", "super_admin")`

### B.5 Period CRUD

#### B.5.1 `GET /periods` — List Periods

**Purpose**: Return all time slots for the school.

**Repository**: `PeriodRepository.get_multi()` — already available (21 lines)
**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### B.5.2 `POST /periods` — Create Period

**Request Schema**:
```json
{
  "name": "Period 1",
  "period_number": 1,
  "start_time": "08:00",
  "end_time": "08:45",
  "is_break": false
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Repo | `PeriodRepository` exists (21 lines) |

**Permission**: `require_role("school_admin", "super_admin")`

---

## Phase C — Operations CRUD (Week 2-3, ~7 endpoints)

### C.1 Teacher Assignments

#### C.1.1 `POST /teacher-assignments` — Assign Teacher to Class/Subject

**Purpose**: Create a TeacherClassSubject record.

**Request Schema**:
```json
{
  "teacher_id": "uuid",
  "class_id": "uuid",
  "subject_id": "uuid",
  "academic_term_id": "uuid",
  "is_class_teacher": false
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Schema | New — `app/api/schemas/teacher_assignments.py` |
| Route | New — `POST /teacher-assignments` |
| Service | New — assignment logic in TeacherService |
| Repo | `TeacherClassSubjectRepository` exists (93 lines) |

**Permission**: `require_role("school_admin", "super_admin")`

#### C.1.2 `GET /teacher-assignments` — List Assignments

**Query params**: `teacher_id`, `class_id`, `academic_term_id` (optional filters)

**Permission**: `require_role("school_admin", "super_admin", "principal")`

#### C.1.3 `DELETE /teacher-assignments/{assignment_id}` — Remove Assignment

**Permission**: `require_role("school_admin", "super_admin")`

### C.2 Timetable CRUD

#### C.2.1 `POST /timetable/entries` — Create Timetable Entry

**Purpose**: Add a new entry to the school timetable.

**Request Schema**:
```json
{
  "class_id": "uuid",
  "subject_id": "uuid",
  "teacher_id": "uuid",
  "period_id": "uuid",
  "academic_term_id": "uuid",
  "day_of_week": 1,
  "room_number": "101",
  "is_active": true
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Schema | New — extend `app/api/schemas/timetable.py` |
| Route | New — add to `app/api/v1/timetable.py` |
| Service | `TimetableService` exists (133 lines) — `validate_no_conflicts()` already built! |
| Repo | `TimetableRepository` exists (197 lines) — `check_conflict()` already built! |

**Key advantage**: The conflict validation service already exists (`TimetableService.validate_no_conflicts()`). This endpoint just needs to call it before creating.

**Permission**: `require_role("school_admin", "super_admin")`

#### C.2.2 `DELETE /timetable/entries/{entry_id}` — Delete Timetable Entry

**Purpose**: Soft-delete a timetable entry.

**Permission**: `require_role("school_admin", "super_admin")`

#### C.2.3 `PATCH /timetable/entries/{entry_id}` — Update Timetable Entry

**Purpose**: Modify an existing entry (re-run conflict validation excluding this entry).

**Permission**: `require_role("school_admin", "super_admin")`

### C.3 School Settings

#### C.3.1 `PATCH /schools/{school_id}` — Update School

**Purpose**: Update school profile, settings.

**Request Schema**:
```json
{
  "name": "Updated School Name",
  "address": "123 Education Lane",
  "phone": "+919999999999",
  "email": "admin@school.edu",
  "logo_url": "https://storage/school-logo.png",
  "settings": {
    "grading_scale": "percentage",
    "academic_year_start_month": 4
  }
}
```

**Backend**:
| Layer | Status |
|-------|--------|
| Schema | New — `app/api/schemas/schools.py` |
| Route | New — `app/api/v1/schools.py` |
| Service | Populate `SchoolService` (currently empty stub) |
| Repo | Populate `app/repository/schools.py` (currently empty stub) |

**Permission**: `require_role("school_admin", "super_admin")`

#### C.3.2 `GET /schools/{school_id}` — Get School

**Purpose**: Return school profile for settings display.

**Permission**: `require_role("school_admin", "super_admin")`

---

## Phase D — Missing Operational Endpoints (Week 3, ~5 endpoints)

### D.1 Homework Detail

#### D.1.1 `GET /homework/{homework_id}` — Get Homework Detail

**Purpose**: Return single homework with all questions for teacher/student viewing.

**Response**: Homework + questions (with correct_answer hidden for students)

**Backend**:
| Layer | Status |
|-------|--------|
| Route | Add to `app/api/v1/homeworks.py` |
| Service | `HomeworkService.get_homework()` |
| Repo | `HomeworkRepository.get()` with `selectinload(Homeworks.questions)` |

**Permission**: Role-aware — teacher (own), principal/admin (any), student (published + own class)

### D.2 Test Detail

#### D.2.1 `GET /tests/{test_id}` — Get Test Detail

**Purpose**: Return single test with all questions.

**Response**: Test + questions (student-accessible only if published)

**Permission**: Role-aware — teacher (own), principal/admin (any), student (published + own class)

### D.3 Homework Grading

#### D.3.1 `PATCH /homework/{homework_id}/submissions/{submission_id}/grade` — Grade Submission

**Purpose**: Score and provide feedback on a student's homework submission.

**Request Schema**:
```json
{
  "total_score": 85.5,
  "teacher_remarks": "Good work! Review question 3."
}
```

**Backend**:
| Layer | Action |
|-------|--------|
| Schema | Add grade request to `app/api/schemas/homeworks.py` |
| Route | Add to `app/api/v1/homeworks.py` |
| Service | `HomeworkService.grade_submission(submission_id, teacher_id, score, remarks)` |
| Repo | `HomeworkSubmissionRepository.update()` — exists |

**Service Logic**:
1. Find submission by ID
2. Verify teacher owns the homework (via submission → homework → teacher_id)
3. Verify submission is in "submitted" status (not already graded)
4. Update total_score, is_graded=true, graded_by=user_id, graded_at=now, teacher_remarks
5. Return updated submission

**Permission**: `require_role("teacher")` + verify homework ownership

### D.4 Student Question Access

#### D.4.1 `GET /tests/{test_id}/questions` — Get Test Questions (Student)

**Purpose**: Return test questions for a student during an in-progress attempt.

**Response**: Questions WITHOUT `correct_answer` or `explanation` fields.

**Schema note**: Two variants needed:
- `TestQuestionResponse` (teacher/admin) — includes `correct_answer`, `explanation`, `points`
- `StudentTestQuestionResponse` — strips `correct_answer` and `explanation` to prevent cheating

**Service Logic**:
1. Find the student's in-progress attempt
2. Verify attempt.test_id matches requested test
3. Fetch questions via TestQuestionRepository
4. Map to student-safe schema (omit `correct_answer`, `explanation`)

**Permission**: `require_role("student")` + verify owned attempt
**School Isolation**: Verify attempt.school_id matches user's school

#### D.4.2 `GET /homework/{homework_id}/questions` — Get Homework Questions (Student)

**Purpose**: Return homework questions for a student viewing published homework.

**Response**: Questions WITHOUT `correct_answer` or `explanation` fields.

**Schema note**: Same dual-variant pattern as tests.

**Permission**: `require_role("student")` + verify homework is published for their class

---

## Implementation Summary

### Effort Estimates

| Phase | Endpoints | New Schemas | New Services | Repos to Populate | Routes to Modify | Est. Days |
|-------|:---------:|:-----------:|:------------:|:-----------------:|:----------------:|:---------:|
| **A — Identity CRUD** | 16 | 4 | 3 | 5 | 4 | 5-7 |
| **B — Academic CRUD** | 7 | 5 | 1 | 0 (exist) | 4 | 2-3 |
| **C — Operations CRUD** | 6 | 3 | 1 | 1 | 3 | 2-3 |
| **D — Missing Ops** | 4 | 1 | 0 | 0 (exist) | 2 | 1-2 |
| **Total** | **33** | **13** | **5** | **6** | **13** | **10-15** |

### Dependency Graph

```
Phase A (Identity CRUD)
  ├── A.1 Teachers → A.2 Students → A.3 Parent Linking
  └── A.4 Principals

Phase B (Academic CRUD) — Independent of Phase A but logically follows
  ├── B.3 Academic Years → B.4 Terms → B.1 Classes → B.2 Subjects
  └── B.5 Periods

Phase C (Operations) — Depends on A + B
  ├── C.1 Teacher Assignments (depends on A.1 Teachers + B.1 Classes + B.2 Subjects)
  ├── C.2 Timetable CRUD (depends on C.1 for conflict check)
  └── C.3 School Settings

Phase D (Missing Ops) — Independent, can be done in parallel with Phase A-C
  ├── D.1 Homework Detail
  ├── D.2 Test Detail
  ├── D.3 Grading
  └── D.4 Student Questions
```

### Recommended Build Order

```
Week 1:     Phase A (Identity CRUD)
              Day 1-2: Teacher CRUD (5 endpoints)
              Day 2-3: Student CRUD (6 endpoints)
              Day 4:   Parent Linking + Principal CRUD (5 endpoints)
              Day 5:   Phase D in parallel (4 endpoints)

Week 2:     Phase B (Academic CRUD)
              Day 1:   Academic Years + Terms (2 endpoints)
              Day 2:   Classes + Subjects (6 endpoints)
              Day 3:   Periods (1 endpoint)

Week 2-3:   Phase C (Operations CRUD)
              Day 3-4: Teacher Assignments (3 endpoints)
              Day 4-5: Timetable CRUD (3 endpoints)
              Day 5:   School Settings (2 endpoints)

Week 3:     Integration & Testing
              All endpoints verified, routes registered, permissions tested
```

### Zero Database Changes Required

All 33 endpoints listed above work against existing tables. No migrations needed.

### File Creation Summary

| New Files | Purpose |
|-----------|---------|
| `app/api/schemas/teachers.py` | Teacher request/response schemas |
| `app/api/schemas/students.py` | Student request/response schemas |
| `app/api/schemas/classes.py` | Class request/response schemas |
| `app/api/schemas/subjects.py` | Subject schemas |
| `app/api/schemas/academic_years.py` | Year/term schemas |
| `app/api/schemas/periods.py` | Period schemas |
| `app/api/schemas/schools.py` | School schemas |
| `app/api/schemas/teacher_assignments.py` | Assignment schemas |

### Files to Populate (Empty Stubs → Real Code)

| File | Current | Target |
|------|:-------:|:------:|
| `app/api/v1/teachers.py` | 0 lines | ~200 lines |
| `app/api/v1/students.py` | 0 lines | ~250 lines |
| `app/api/v1/classes.py` | 0 lines | ~120 lines |
| `app/api/v1/subjects.py` | 0 lines | ~80 lines |
| `app/api/v1/principals.py` | 0 lines | ~100 lines |
| `app/api/v1/schools.py` | 0 lines | ~80 lines |
| `app/repository/teachers.py` | 0 lines | ~30 lines |
| `app/repository/students.py` | 0 lines | ~50 lines |
| `app/repository/parents.py` | 0 lines | ~20 lines |
| `app/repository/principals.py` | 0 lines | ~20 lines |
| `app/repository/schools.py` | 0 lines | ~20 lines |
| `app/repository/student_parents.py` | 0 lines | ~20 lines |
| `app/domain/identity/teacher_service.py` | 0 lines | ~150 lines |
| `app/domain/identity/student_service.py` | 0 lines | ~200 lines |
| `app/domain/identity/principal_service.py` | 0 lines | ~80 lines |
| `app/domain/schools/school_service.py` | 0 lines | ~50 lines |

### Router Registration

After building all phases, register new routers in `app/api/v1/router.py`:
```python
from app.api.v1.teachers import router as teacher_router
from app.api.v1.students import router as student_router
from app.api.v1.classes import router as class_router
from app.api.v1.subjects import router as subject_router
from app.api.v1.principals import router as principal_router
from app.api.v1.schools import router as school_router

router.include_router(teacher_router)
router.include_router(student_router)
router.include_router(class_router)
router.include_router(subject_router)
router.include_router(principal_router)
router.include_router(school_router)
```

**Total after completion**: 52 + 33 = **~85 API endpoints**

---

## Appendix: Database Constraint Reference

### Unique Constraints to Handle

| Table | Constraint | Error to Return |
|-------|-----------|-----------------|
| `users` | `email` (unique per school via app logic) | 409: "Email already exists" |
| `users` | `supabase_user_id` (unique) | 500 (shouldn't happen in practice) |
| `teachers` | `employee_code` + `school_id` (unique per DB) | 409: "Employee code already exists" |
| `students` | `admission_number` + `school_id` (unique per DB) | 409: "Admission number already exists" |
| `classes` | `(school_id, name, section, academic_year_id)` (unique per DB) | 409: "Class already exists for this year" |
| `subjects` | `(school_id, code)` and `(school_id, name)` (unique per DB) | 409: "Subject code/name already exists" |
| `teacher_class_subjects` | `(teacher_id, class_id, subject_id, academic_term_id)` (unique per DB) | 409: "Assignment already exists" |
| `timetable_entries` | `(class_id, day_of_week, period_id, academic_term_id)` and `(teacher_id, day_of_week, period_id, academic_term_id)` (unique per DB) | 409: "Schedule conflict detected" |

### Service-Layer Validations

| Action | Validation | Error |
|--------|-----------|-------|
| Create teacher | `employee_code` unique per school | 409 |
| Create student | `admission_number` unique per school | 409 |
| Assign teacher to class | Teacher exists, class exists, subject exists | 404 |
| Create timetable entry | No double-booking (teacher OR class) | 409 |
| Grade submission | Teacher owns the homework | 403 |
| Grade submission | Submission is in "submitted" state | 409 |
| Student view questions | Student has in-progress attempt | 403 |
| Student view questions | Test is published | 403 |

---

*End of Backend Completion Roadmap*
