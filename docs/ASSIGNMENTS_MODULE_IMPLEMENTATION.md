# ATHON V2 — Assignments Module Implementation

**Reviewer**: Staff Backend Engineer  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026  
**References**: DATABASE_V2_FINAL.md · CURRICULUM_MODULE_IMPLEMENTATION.md · SUBJECTS_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Folder Structure](#2-folder-structure)
3. [Schemas (Zod)](#3-schemas-zod)
4. [Services](#4-services)
5. [Repositories](#5-repositories)
6. [API Routes](#6-api-routes)
7. [Permissions](#7-permissions)
8. [Submission Workflow](#8-submission-workflow)
9. [Grading Workflow](#9-grading-workflow)
10. [Parent Monitoring](#10-parent-monitoring)
11. [Resubmission Workflow](#11-resubmission-workflow)
12. [Edge Cases](#12-edge-cases)
13. [Risk Analysis](#13-risk-analysis)
14. [Testing Checklist](#14-testing-checklist)

---

## 1. Database Schema

### 1.1 Tables

#### `assignments`

```sql
CREATE TABLE assignments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id             UUID NOT NULL REFERENCES schools(id),
    teacher_id            UUID NOT NULL REFERENCES teachers(id),
    class_id              UUID NOT NULL REFERENCES classes(id),
    subject_id            UUID NOT NULL REFERENCES subjects(id),
    academic_term_id      UUID NOT NULL REFERENCES academic_terms(id),
    lo_id                 UUID REFERENCES learning_objectives(id),
    
    -- Core fields
    title                 VARCHAR(200) NOT NULL,
    description           TEXT,
    assignment_type       assignment_type NOT NULL,  -- homework, revision, worksheet, project, quiz
    max_score             DECIMAL(8,2) NOT NULL CHECK (max_score > 0),
    passing_percentage    DECIMAL(5,2) DEFAULT 40.00,
    
    -- Timing
    due_date              TIMESTAMPTZ,
    due_date_extension    TIMESTAMPTZ,               -- Teacher-granted extension per assignment
    duration_minutes      INTEGER,                    -- For timed assignments (quiz, timed test)
    scheduled_at          TIMESTAMPTZ,                -- For scheduled release
    
    -- Publishing
    is_published          BOOLEAN NOT NULL DEFAULT FALSE,
    published_at          TIMESTAMPTZ,
    
    -- Results
    is_results_published  BOOLEAN NOT NULL DEFAULT FALSE,
    results_published_at  TIMESTAMPTZ,
    
    -- Settings
    allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
    late_submission_penalty DECIMAL(5,2) DEFAULT 0,  -- Percentage deducted per day
    max_resubmissions     INTEGER NOT NULL DEFAULT 0,
    shuffle_questions     BOOLEAN NOT NULL DEFAULT FALSE,
    show_results_after    TIMESTAMPTZ,               -- Auto-publish results at this time
    
    -- Versioning
    version               INTEGER NOT NULL DEFAULT 1,
    source_assignment_id  UUID REFERENCES assignments(id),  -- For cloned assignments
    
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_class_subject ON assignments(class_id, subject_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_due ON assignments(due_date) WHERE deleted_at IS NULL AND is_published = TRUE;
CREATE INDEX idx_assignments_type ON assignments(school_id, assignment_type, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_assignments_lo ON assignments(lo_id) WHERE lo_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_assignments_published ON assignments(class_id, is_published, due_date) WHERE deleted_at IS NULL;
```

#### `assignment_questions`

```sql
CREATE TABLE assignment_questions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id     UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    lo_id             UUID REFERENCES learning_objectives(id),  -- Per-question curriculum link
    
    question_text     TEXT NOT NULL,
    question_type     question_type NOT NULL,  -- multiple_choice, true_false, short_answer, long_answer, essay
    options           JSONB,                   -- MCQ choices: [{"label":"A","text":"..."}]
    correct_answer    TEXT,                    -- For auto-grading (MUST NEVER be sent to students before grading)
    explanation       TEXT,                    -- Shown after results published
    points            DECIMAL(6,2) NOT NULL DEFAULT 1.00 CHECK (points > 0),
    sort_order        INTEGER NOT NULL DEFAULT 0,
    is_optional       BOOLEAN NOT NULL DEFAULT FALSE,
    tags              TEXT[],                  -- Difficulty tags: easy, medium, hard
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aq_assignment ON assignment_questions(assignment_id, sort_order);
CREATE INDEX idx_aq_lo ON assignment_questions(lo_id) WHERE lo_id IS NOT NULL;
```

#### `submissions`

```sql
CREATE TABLE submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id     UUID NOT NULL REFERENCES assignments(id),
    student_id        UUID NOT NULL REFERENCES students(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    -- Status
    status            attempt_status NOT NULL DEFAULT 'pending',
        -- pending: not yet started
        -- in_progress: started (timed assessment clock ticking)
        -- submitted: student submitted, pending grading
        -- returned: teacher returned submission for revision (student must resubmit)
        -- resubmitted: student resubmitted after teacher returned for revision
        -- graded: teacher graded
        -- results_published: grades visible to student
    
    -- Timing
    started_at        TIMESTAMPTZ,
    submitted_at      TIMESTAMPTZ,
    time_spent_seconds INTEGER,                -- Actual time spent (for timed assessments)
    
    -- Scoring
    total_score_auto  DECIMAL(8,2),            -- Auto-graded by system
    total_score_manual DECIMAL(8,2),           -- Manually graded by teacher
    total_score       DECIMAL(8,2),            -- Computed: auto + manual
    is_graded         BOOLEAN NOT NULL DEFAULT FALSE,
    graded_by         UUID REFERENCES users(id),
    graded_at         TIMESTAMPTZ,
    teacher_remarks   TEXT,
    
    -- Resubmission tracking
    resubmission_count INTEGER NOT NULL DEFAULT 0,
    resubmitted_at    TIMESTAMPTZ,
    returned_for_revision_at TIMESTAMPTZ,
    returned_reason   TEXT,
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(assignment_id, student_id)  -- One submission per student per assignment
);

CREATE INDEX idx_submissions_grading ON submissions(assignment_id, status, created_at ASC) WHERE is_graded = FALSE;
CREATE INDEX idx_submissions_student ON submissions(student_id, created_at DESC);
CREATE INDEX idx_submissions_pending ON submissions(school_id, status, created_at) WHERE status = 'submitted';
```

#### `answers`

```sql
CREATE TABLE answers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id     UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id       UUID NOT NULL REFERENCES assignment_questions(id),
    
    submitted_answer  TEXT,                    -- Student's answer text
    file_urls         TEXT[],                  -- For file upload answers (project, worksheet)
    
    -- Auto-grading
    is_correct        BOOLEAN,                 -- For MCQ/TF auto-grading
    score_auto        DECIMAL(6,2),            -- Auto-assigned score
    
    -- Manual grading
    score_manual      DECIMAL(6,2),            -- Teacher-assigned score
    score             DECIMAL(6,2),            -- Computed: COALESCE(score_manual, score_auto, 0)
    remarks           TEXT,                    -- Teacher feedback per answer
    
    answered_at       TIMESTAMPTZ,             -- When student answered this question
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(submission_id, question_id)
);

CREATE INDEX idx_answers_submission ON answers(submission_id, question_id);
CREATE INDEX idx_answers_question ON answers(question_id);
```

### 1.2 ENUMs

```sql
-- Assignment type (5 types per requirements)
CREATE TYPE assignment_type AS ENUM (
    'homework',    -- Standard take-home, teacher-graded, has deadline
    'revision',    -- Practice, auto-graded, no deadline pressure
    'worksheet',   -- In-class or take-home practice, may be auto or teacher graded
    'project',     -- Long-term, file uploads, rubric-based grading
    'quiz'         -- Timed, MCQs, auto-graded, scheduled release
);

-- Extend existing enums
ALTER TYPE attempt_status ADD VALUE IF NOT EXISTS 'resubmitted';
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'file_upload';

-- Audit event types
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:published';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:archived';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assignment:cloned';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:submitted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:resubmitted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:returned';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:graded';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:results_published';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'submission:grade_overridden';
```

### 1.3 RLS Policies

```sql
-- Assignments: teacher manages own; student sees published; parent sees child's
CREATE POLICY assignments_teacher_manage ON assignments FOR ALL
  USING (teacher_id = current_setting('app.current_teacher_id')::UUID AND school_id = current_setting('app.current_school_id')::UUID);

CREATE POLICY assignments_admin_all ON assignments FOR ALL
  USING (school_id = current_setting('app.current_school_id')::UUID);

CREATE POLICY assignments_student_view ON assignments FOR SELECT
  USING (is_published = TRUE AND class_id IN (
    SELECT class_id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID
  ));

CREATE POLICY assignments_parent_view ON assignments FOR SELECT
  USING (is_published = TRUE AND class_id IN (
    SELECT ce.class_id FROM class_enrollments ce
    JOIN student_parents sp ON sp.student_id = ce.student_id
    JOIN parents p ON p.id = sp.parent_id
    WHERE p.user_id = current_setting('app.current_user_id')::UUID
  ));

-- Assignment questions: teacher sees all; student sees only if published and never sees correct_answer
CREATE VIEW v_assignment_questions_student AS
  SELECT id, assignment_id, question_text, question_type, options, points, sort_order
  FROM assignment_questions;

CREATE VIEW v_assignment_questions_teacher AS
  SELECT * FROM assignment_questions;

-- Submissions: student sees own; teacher sees own class's; admin sees all
CREATE POLICY submissions_student_manage ON submissions FOR ALL
  USING (student_id = (SELECT id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID));

CREATE POLICY submissions_teacher_view ON submissions FOR SELECT
  USING (assignment_id IN (
    SELECT id FROM assignments WHERE teacher_id = current_setting('app.current_teacher_id')::UUID
  ));

-- Answers: scoped through submission visibility
CREATE POLICY answers_student ON answers FOR SELECT
  USING (submission_id IN (
    SELECT id FROM submissions WHERE student_id = (SELECT id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID)
  ));
```

### 1.4 Materialized View: Assignment Performance

```sql
CREATE MATERIALIZED VIEW mv_assignment_performance AS
SELECT
    a.id AS assignment_id,
    a.school_id,
    a.class_id,
    a.subject_id,
    a.assignment_type,
    a.max_score,
    a.lo_id,
    COUNT(s.id) AS total_submissions,
    COUNT(s.id) FILTER (WHERE s.is_graded = TRUE) AS graded_submissions,
    AVG(s.total_score) FILTER (WHERE s.is_graded = TRUE) AS avg_score,
    MIN(s.total_score) FILTER (WHERE s.is_graded = TRUE) AS min_score,
    MAX(s.total_score) FILTER (WHERE s.is_graded = TRUE) AS max_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.total_score) FILTER (WHERE s.is_graded = TRUE) AS median_score,
    COUNT(s.id) FILTER (WHERE s.total_score < a.max_score * a.passing_percentage / 100 AND s.is_graded = TRUE) AS below_passing,
    COUNT(s.id) FILTER (WHERE s.status = 'submitted' AND s.submitted_at > a.due_date) AS late_submissions
FROM assignments a
LEFT JOIN submissions s ON s.assignment_id = a.id AND s.deleted_at IS NULL
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.school_id, a.class_id, a.subject_id, a.assignment_type, a.max_score, a.lo_id;

CREATE UNIQUE INDEX idx_mv_ap_id ON mv_assignment_performance(assignment_id);
```

---

## 2. Folder Structure

```
src/modules/assignments/
├── assignments.service.ts              # Business logic
├── assignments.repository.ts           # Database access
├── assignments.router.ts               # API route handlers
├── assignments.validator.ts            # Zod schemas
├── assignments.schema.ts               # TypeScript types
├── assignment-grading.service.ts       # Grading logic (auto + manual)
├── assignment-submission.service.ts    # Submission + resubmission logic
├── assignment-notifications.service.ts # Notification triggers
├── assignment-reports.service.ts       # Performance reports + export
│
src/modules/classes/
├── classes.repository.ts               # Class lookups
src/modules/subjects/
├── subjects.repository.ts              # Subject lookups
src/modules/curriculum/
├── curriculum.repository.ts            # LO lookups
src/core/notifications/
├── notification.service.ts             # In-app, email, WhatsApp triggers
src/core/analytics/
├── performance-analytics.service.ts    # Dashboard queries
```

---

## 3. Schemas (Zod)

```typescript
// src/modules/assignments/assignments.validator.ts

import { z } from 'zod';

const UUID = z.string().uuid();
const Name = z.string().min(1, 'Required').max(200);

// ─── Shared ─────────────────────────────────────────────

export const AssignmentTypeEnum = z.enum([
  'homework', 'revision', 'worksheet', 'project', 'quiz'
]);

export const QuestionTypeEnum = z.enum([
  'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'essay', 'file_upload'
]);

const OptionSchema = z.object({
  label: z.string().min(1).max(10),
  text: z.string().min(1).max(500),
});

// ─── Create Assignment ──────────────────────────────────

export const AssignmentQuestionInputSchema = z.object({
  lo_id: UUID.optional(),
  question_text: z.string().min(1, 'Question text required').max(2000),
  question_type: QuestionTypeEnum,
  options: z.array(OptionSchema).optional(),
  correct_answer: z.string().max(1000).optional(),
  explanation: z.string().max(2000).optional(),
  points: z.number().positive().default(1),
  sort_order: z.number().int().min(0).default(0),
  is_optional: z.boolean().default(false),
  tags: z.array(z.string().max(20)).max(5).optional(),
});

export const CreateAssignmentSchema = z.object({
  class_id: UUID,
  subject_id: UUID,
  academic_term_id: UUID,
  lo_id: UUID.optional(),
  
  title: Name,
  description: z.string().max(5000).optional(),
  assignment_type: AssignmentTypeEnum,
  max_score: z.number().positive(),
  passing_percentage: z.number().min(0).max(100).default(40),
  
  due_date: z.string().datetime().optional(),
  duration_minutes: z.number().int().positive().optional(),
  scheduled_at: z.string().datetime().optional(),
  
  allow_late_submission: z.boolean().default(false),
  late_submission_penalty: z.number().min(0).max(100).default(0),
  max_resubmissions: z.number().int().min(0).max(10).default(0),
  shuffle_questions: z.boolean().default(false),
  show_results_after: z.string().datetime().optional(),
  
  questions: z.array(AssignmentQuestionInputSchema).min(1, 'At least one question required'),
});

export const CreateAssignmentDraftSchema = CreateAssignmentSchema.extend({
  questions: z.array(AssignmentQuestionInputSchema).optional(),  // Drafts can have 0 questions
});

// ─── Update Assignment ──────────────────────────────────

export const UpdateAssignmentSchema = z.object({
  title: Name.optional(),
  description: z.string().max(5000).nullable().optional(),
  max_score: z.number().positive().optional(),
  passing_percentage: z.number().min(0).max(100).optional(),
  due_date: z.string().datetime().nullable().optional(),
  due_date_extension: z.string().datetime().nullable().optional(),
  duration_minutes: z.number().int().positive().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  allow_late_submission: z.boolean().optional(),
  late_submission_penalty: z.number().min(0).max(100).optional(),
  max_resubmissions: z.number().int().min(0).max(10).optional(),
  shuffle_questions: z.boolean().optional(),
  show_results_after: z.string().datetime().nullable().optional(),
});

// ⚠️ Questions cannot be updated via this schema; use dedicated question endpoints.
// This prevents accidental deletion of student answers.

// ─── Manage Questions ───────────────────────────────────

export const AddQuestionSchema = AssignmentQuestionInputSchema;

export const UpdateQuestionSchema = z.object({
  question_text: z.string().min(1).max(2000).optional(),
  question_type: QuestionTypeEnum.optional(),
  options: z.array(OptionSchema).nullable().optional(),
  correct_answer: z.string().max(1000).nullable().optional(),
  explanation: z.string().max(2000).nullable().optional(),
  points: z.number().positive().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_optional: z.boolean().optional(),
  tags: z.array(z.string().max(20)).max(5).nullable().optional(),
});

export const ReorderQuestionsSchema = z.object({
  order: z.array(z.object({ id: UUID, sort_order: z.number().int().min(0) })),
});

// ─── Publish / Results ──────────────────────────────────

export const PublishAssignmentSchema = z.object({
  scheduled_at: z.string().datetime().optional(),  // Schedule future publish
  send_notification: z.boolean().default(true),
});

export const PublishResultsSchema = z.object({
  show_answers: z.boolean().default(true),        // Show correct answers to students
  send_notification: z.boolean().default(true),
  publish_after: z.string().datetime().optional(),  // Schedule future publish
});

// ─── Submission ─────────────────────────────────────────

export const SubmitAnswerSchema = z.object({
  question_id: UUID,
  submitted_answer: z.string().max(10000).optional(),
  file_urls: z.array(z.string().url()).max(10).optional(),
}).refine(data => data.submitted_answer || (data.file_urls && data.file_urls.length > 0), {
  message: 'Either submitted_answer or file_urls must be provided',
});

export const SubmitAssignmentSchema = z.object({
  answers: z.array(SubmitAnswerSchema).min(1, 'At least one answer required'),
  time_spent_seconds: z.number().int().positive().optional(),
});

export const StartAssignmentSchema = z.object({
  started_at: z.string().datetime().optional(),  // Server will use NOW() if not provided
});

// ─── Grading ────────────────────────────────────────────

export const GradeAnswerSchema = z.object({
  question_id: UUID,
  score_manual: z.number().min(0),
  remarks: z.string().max(500).optional(),
});

export const GradeSubmissionSchema = z.object({
  answers: z.array(GradeAnswerSchema).min(1),
  teacher_remarks: z.string().max(2000).optional(),
  return_for_revision: z.boolean().default(false),
  return_reason: z.string().max(500).optional(),  // Required if return_for_revision=true
});

// ─── Resubmission ───────────────────────────────────────

export const ReturnForResubmissionSchema = z.object({
  reason: z.string().min(10, 'Provide specific feedback').max(2000),
  allow_until: z.string().datetime().optional(),  // Override default deadline
});

// ─── List / Query ───────────────────────────────────────

export const AssignmentListQuerySchema = z.object({
  class_id: UUID.optional(),
  subject_id: UUID.optional(),
  assignment_type: AssignmentTypeEnum.optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
  search: z.string().max(100).optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  include_inactive: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const SubmissionListQuerySchema = z.object({
  assignment_id: UUID.optional(),
  student_id: UUID.optional(),
  status: z.enum(['pending', 'in_progress', 'submitted', 'returned', 'graded', 'resubmitted']).optional(),
  graded: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Response Schemas ───────────────────────────────────

export const AssignmentResponseSchema = z.object({
  id: UUID,
  teacher_id: UUID,
  teacher_name: z.string(),
  class_id: UUID,
  class_name: z.string(),
  subject_id: UUID,
  subject_name: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assignment_type: AssignmentTypeEnum,
  max_score: z.number(),
  passing_percentage: z.number(),
  due_date: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  is_published: z.boolean(),
  published_at: z.string().nullable(),
  is_results_published: z.boolean(),
  allow_late_submission: z.boolean(),
  late_submission_penalty: z.number(),
  max_resubmissions: z.number().int(),
  question_count: z.number(),
  submission_count: z.number(),
  graded_count: z.number(),
  avg_score: z.number().nullable(),
  version: z.number(),
  created_at: z.string(),
});

export const SubmissionResponseSchema = z.object({
  id: UUID,
  assignment_id: UUID,
  student_id: UUID,
  student_name: z.string(),
  status: z.string(),
  started_at: z.string().nullable(),
  submitted_at: z.string().nullable(),
  time_spent_seconds: z.number().nullable(),
  total_score: z.number().nullable(),
  is_graded: z.boolean(),
  graded_by: z.string().nullable(),
  graded_at: z.string().nullable(),
  teacher_remarks: z.string().nullable(),
  resubmission_count: z.number().int(),
  resubmitted_at: z.string().nullable(),
  returned_for_revision_at: z.string().nullable(),
  returned_reason: z.string().nullable(),
  answers: z.array(z.object({
    question_id: UUID,
    question_text: z.string(),
    question_type: z.string(),
    points: z.number(),
    submitted_answer: z.string().nullable(),
    file_urls: z.array(z.string()).nullable(),
    score: z.number().nullable(),
    score_auto: z.number().nullable(),
    score_manual: z.number().nullable(),
    is_correct: z.boolean().nullable(),
    remarks: z.string().nullable(),
    answered_at: z.string().nullable(),
  })),
});

// ─── Types ──────────────────────────────────────────────

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof UpdateAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof SubmitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof GradeSubmissionSchema>;
export type AssignmentResponse = z.infer<typeof AssignmentResponseSchema>;
export type SubmissionResponse = z.infer<typeof SubmissionResponseSchema>;
```

---

## 4. Services

```typescript
// src/modules/assignments/assignments.service.ts

export class AssignmentsService {
  constructor(
    private readonly repo: AssignmentsRepository,
    private readonly gradingService: AssignmentGradingService,
    private readonly notificationService: AssignmentNotificationsService,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  // ════════════════════════════════════════════════════════
  // TEACHER: CREATE
  // ════════════════════════════════════════════════════════

  async createAssignment(
    ctx: RequestContext,
    input: CreateAssignmentInput,
  ): Promise<AssignmentResponse> {
    await this.authz.assert(ctx, 'assignments:create', { classId: input.class_id });

    // 1. Validate class + subject existence and teacher assignment
    const teacherClass = await this.repo.teacherTeachesSubjectInClass(
      ctx.profileId!, input.class_id, input.subject_id,
    );
    if (!teacherClass) {
      throw new ForbiddenError('You do not teach this subject in this class');
    }

    // 2. Validate assignment type constraints
    this.validateAssignmentTypeConstraints(input);

    // 3. Create assignment (draft — not published)
    const assignment = await this.repo.createAssignment({
      school_id: ctx.schoolId,
      teacher_id: ctx.profileId!,
      class_id: input.class_id,
      subject_id: input.subject_id,
      academic_term_id: input.academic_term_id,
      lo_id: input.lo_id ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      assignment_type: input.assignment_type,
      max_score: input.max_score,
      passing_percentage: input.passing_percentage,
      due_date: input.due_date ?? null,
      duration_minutes: input.duration_minutes ?? null,
      scheduled_at: input.scheduled_at ?? null,
      allow_late_submission: input.allow_late_submission,
      late_submission_penalty: input.late_submission_penalty,
      max_resubmissions: input.max_resubmissions,
      shuffle_questions: input.shuffle_questions,
      show_results_after: input.show_results_after ?? null,
    });

    // 4. Create questions
    await this.repo.createQuestions(
      assignment.id,
      input.questions.map(q => ({
        ...q,
        lo_id: q.lo_id ?? null,
        options: q.options ?? null,
        correct_answer: q.correct_answer ?? null,
        explanation: q.explanation ?? null,
        tags: q.tags ?? null,
      })),
    );

    await this.audit.log({
      eventType: 'assignment:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      resourceType: 'assignment',
      resourceId: assignment.id,
      details: {
        title: input.title,
        type: input.assignment_type,
        classId: input.class_id,
        subjectId: input.subject_id,
        questionCount: input.questions.length,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`teacher:${ctx.profileId}:assignments`);
    await this.cache.invalidate(`class:${input.class_id}:assignments`);

    return this.mapAssignmentResponse(assignment);
  }

  // ════════════════════════════════════════════════════════
  // TEACHER: EDIT
  // ════════════════════════════════════════════════════════

  async updateAssignment(
    ctx: RequestContext,
    assignmentId: string,
    input: UpdateAssignmentInput,
  ): Promise<AssignmentResponse> {
    await this.authz.assert(ctx, 'assignments:edit');

    const existing = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Assignment not found');
    if (existing.teacher_id !== ctx.profileId) {
      // Admin can edit any assignment; teacher can only edit own
      if (ctx.role !== 'school_admin') {
        throw new ForbiddenError('You can only edit your own assignments');
      }
    }
    if (existing.is_published && ctx.role !== 'school_admin') {
      // Once published, teacher can only edit timing/marks, not core content
      const allowedFields = ['due_date', 'due_date_extension', 'description',
        'allow_late_submission', 'late_submission_penalty', 'show_results_after'];
      const disallowed = Object.keys(input).filter(k => !allowedFields.includes(k));
      if (disallowed.length > 0 && ctx.role !== 'school_admin') {
        throw new ValidationError(
          `Cannot edit ${disallowed.join(', ')} after publishing. Only due_date, description, and late submission settings can be changed.`,
        );
      }
    }

    // Run type validation if assignment_type is changing
    if (input.assignment_type && input.assignment_type !== existing.assignment_type) {
      // Rebuild full input from existing + changes for validation
      const mergedInput = { ...existing, ...input, questions: [] };
      this.validateAssignmentTypeConstraints(mergedInput);
    }

    const updated = await this.repo.updateAssignment(assignmentId, input);

    await this.audit.log({
      eventType: 'assignment:updated',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignmentId,
      details: { changes: Object.keys(input) },
      outcome: 'success',
    });

    await this.cache.invalidate(`assignment:${assignmentId}`);
    return this.mapAssignmentResponse(updated);
  }

  // ─── Questions Management ─────────────────────────────

  async addQuestion(ctx: RequestContext, assignmentId: string, input: AddQuestionInput): Promise<void> {
    await this.authz.assert(ctx, 'assignments:edit');
    const assignment = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (assignment.is_published && ctx.role !== 'school_admin') {
      throw new ValidationError('Cannot add questions after assignment is published');
    }
    await this.repo.createQuestion(assignmentId, input);
    await this.cache.invalidate(`assignment:${assignmentId}`);
  }

  async updateQuestion(ctx: RequestContext, questionId: string, input: UpdateQuestionInput): Promise<void> {
    await this.authz.assert(ctx, 'assignments:edit');
    const question = await this.repo.findQuestionById(questionId);
    if (!question) throw new NotFoundError('Question not found');
    const assignment = await this.repo.findAssignmentById(question.assignment_id, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (assignment.is_published && ctx.role !== 'school_admin') {
      throw new ValidationError('Cannot edit questions after assignment is published');
    }
    await this.repo.updateQuestion(questionId, input);
    await this.cache.invalidate(`assignment:${question.assignment_id}`);
  }

  async deleteQuestion(ctx: RequestContext, questionId: string): Promise<void> {
    await this.authz.assert(ctx, 'assignments:edit');
    const question = await this.repo.findQuestionById(questionId);
    if (!question) throw new NotFoundError('Question not found');
    const assignment = await this.repo.findAssignmentById(question.assignment_id, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (assignment.is_published && ctx.role !== 'school_admin') {
      throw new ValidationError('Cannot delete questions after assignment is published');
    }
    // Check for existing answers referencing this question
    const answerCount = await this.repo.getAnswerCountForQuestion(questionId);
    if (answerCount > 0) {
      throw new ValidationError(
        `Cannot delete: ${answerCount} student answer(s) reference this question. Archive the question instead.`,
      );
    }
    await this.repo.deleteQuestion(questionId);
  }

  // ════════════════════════════════════════════════════════
  // TEACHER: PUBLISH
  // ════════════════════════════════════════════════════════

  async publishAssignment(
    ctx: RequestContext,
    assignmentId: string,
    input: PublishAssignmentSchema = {},
  ): Promise<void> {
    await this.authz.assert(ctx, 'assignments:publish');

    const existing = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Assignment not found');

    // Validation
    if (existing.teacher_id !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('Only the creator or admin can publish this assignment');
    }
    if (existing.is_published) {
      throw new ValidationError('Assignment is already published');
    }

    const questionCount = await this.repo.getQuestionCount(assignmentId);
    if (questionCount === 0) {
      throw new ValidationError('Cannot publish an assignment with no questions');
    }
    if (!existing.due_date && existing.assignment_type !== 'revision') {
      throw new ValidationError('Due date is required for this assignment type');
    }
    if (!existing.max_score || existing.max_score <= 0) {
      throw new ValidationError('Max score must be set before publishing');
    }

    const now = new Date().toISOString();
    const publishAt = input.scheduled_at ?? now;

    await this.repo.publishAssignment(assignmentId, {
      is_published: true,
      published_at: publishAt,
      scheduled_at: existing.scheduled_at ?? (input.scheduled_at ? null : existing.scheduled_at),
    });

    await this.audit.log({
      eventType: 'assignment:published',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignmentId,
      details: { scheduledAt: publishAt },
      outcome: 'success',
    });

    // Notify students
    if (input.send_notification !== false) {
      await this.notificationService.notifyAssignmentPublished(
        ctx.schoolId, assignmentId, existing.class_id, existing.title,
      );
    }

    await this.eventBus.publish('assignment:published', { assignmentId, classId: existing.class_id });
    await this.cache.invalidate(`assignment:${assignmentId}`);
    await this.cache.invalidate(`class:${existing.class_id}:assignments`);
  }

  // ════════════════════════════════════════════════════════
  // TEACHER: GRADE
  // ════════════════════════════════════════════════════════

  async gradeSubmission(
    ctx: RequestContext,
    submissionId: string,
    input: GradeSubmissionInput,
  ): Promise<SubmissionResponse> {
    await this.authz.assert(ctx, 'assignments:grade');

    const submission = await this.repo.findSubmissionById(submissionId, ctx.schoolId);
    if (!submission) throw new NotFoundError('Submission not found');

    const assignment = await this.repo.findAssignmentById(submission.assignment_id, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');

    // Scope: teacher can only grade own class's submissions
    if (assignment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('You can only grade submissions for your own assignments');
    }

    if (submission.is_graded && !input.return_for_revision) {
      throw new ValidationError(
        'Submission is already graded. Use the override endpoint to change grades, or set return_for_revision=true to request resubmission.',
      );
    }

    // Grade each answer
    const gradedAnswers = await this.gradingService.gradeAnswers(
      submission.id, input.answers, assignment.max_score,
    );

    // Auto-compute total
    const totalScoreManual = gradedAnswers.reduce((sum, a) => sum + (a.score_manual ?? 0), 0);
    const totalScoreAuto = submission.total_score_auto ?? 0;
    const totalScore = totalScoreManual + totalScoreAuto;

    if (input.return_for_revision) {
      // Return with feedback, allow resubmission
      // Use a distinct status ('returned') so client can differentiate between
      // "first submission awaiting grading" and "returned for revision".
      // The returned_for_revision_at field provides additional context.
      await this.repo.returnForResubmission(submissionId, {
        status: 'returned',
        returned_for_revision_at: new Date().toISOString(),
        returned_reason: input.return_reason ?? '',
        teacher_remarks: input.teacher_remarks ?? null,
        is_graded: false,  // Not finalized
        resubmission_count: submission.resubmission_count,
      });
    } else {
      // Final grade
      await this.repo.finalizeGrade(submissionId, {
        status: 'graded',
        total_score: totalScore,
        total_score_manual: totalScoreManual,
        is_graded: true,
        graded_by: ctx.userId,
        graded_at: new Date().toISOString(),
        teacher_remarks: input.teacher_remarks ?? null,
        resubmission_count: submission.resubmission_count,
      });

      // Auto-publish results if assignment is set to auto-publish
      if (assignment.show_results_after && new Date() >= new Date(assignment.show_results_after)) {
        // Results already published
      }

      // Check if all submissions are graded → suggest publishing results
      const pendingCount = await this.repo.getUngradedCount(submission.assignment_id);
      if (pendingCount === 0) {
        await this.eventBus.publish('assignment:all_graded', {
          assignmentId: submission.assignment_id,
        });
      }
    }

    await this.audit.log({
      eventType: input.return_for_revision ? 'submission:returned' : 'submission:graded',
      actorId: ctx.userId,
      resourceType: 'submission',
      resourceId: submissionId,
      details: {
        totalScore,
        returnForRevision: input.return_for_revision,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`submission:${submissionId}`);
    await this.cache.invalidate(`assignment:${submission.assignment_id}:submissions`);

    return this.repo.getSubmissionWithAnswers(submissionId);
  }

  // ════════════════════════════════════════════════════════
  // TEACHER: PUBLISH RESULTS
  // ════════════════════════════════════════════════════════

  async publishResults(
    ctx: RequestContext,
    assignmentId: string,
    input: PublishResultsSchema = {},
  ): Promise<void> {
    await this.authz.assert(ctx, 'assignments:publish_results');

    const assignment = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');

    if (assignment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('Only the creator or admin can publish results');
    }

    // Check at least one submission is graded
    const gradedCount = await this.repo.getGradedCount(assignmentId);
    if (gradedCount === 0) {
      throw new ValidationError('No graded submissions to publish results for');
    }

    await this.repo.publishResults(assignmentId, {
      is_results_published: true,
      results_published_at: new Date().toISOString(),
    });

    await this.audit.log({
      eventType: 'submission:results_published',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignmentId,
      details: { gradedCount, showAnswers: input.show_answers },
      outcome: 'success',
    });

    if (input.send_notification !== false) {
      await this.notificationService.notifyResultsPublished(
        ctx.schoolId, assignmentId, assignment.class_id, assignment.title,
      );
    }

    await this.cache.invalidate(`assignment:${assignmentId}`);
    await this.eventBus.publish('assignment:results_published', { assignmentId });
  }

  // ════════════════════════════════════════════════════════
  // STUDENT: VIEW
  // ════════════════════════════════════════════════════════

  async getAssignmentsForStudent(
    ctx: RequestContext,
    query: { class_id?: string; assignment_type?: string; status?: string; page?: number; limit?: number },
  ): Promise<{ data: AssignmentResponse[]; total: number }> {
    await this.authz.assert(ctx, 'assignments:view');

    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student) throw new NotFoundError('Student profile not found');

    const assignments = await this.repo.getAssignmentsForStudent(
      student.class_id, student.id, query,
    );

    return assignments;
  }

  async getAssignmentDetailForStudent(
    ctx: RequestContext,
    assignmentId: string,
  ): Promise<AssignmentDetailResponse> {
    await this.authz.assert(ctx, 'assignments:view');

    const assignment = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');
    if (!assignment.is_published) {
      throw new ForbiddenError('Assignment is not yet published');
    }

    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student) throw new NotFoundError('Student profile not found');
    if (student.class_id !== assignment.class_id) {
      throw new ForbiddenError('This assignment is not for your class');
    }

    // Check if results are published → student can see everything including answers
    const showAnswers = assignment.is_results_published;

    // Get questions
    const questions = await this.repo.getQuestionsForStudent(
      assignmentId, showAnswers,
    );

    // Get existing submission (if any)
    const submission = await this.repo.findSubmissionByStudentAndAssignment(
      student.id, assignmentId,
    );

    return {
      assignment: this.mapAssignmentResponse(assignment),
      questions,
      submission: submission ? this.mapSubmissionResponse(submission) : null,
      can_submit: submission
        ? this.canResubmit(submission, assignment)
        : true,
    };
  }

  // ════════════════════════════════════════════════════════
  // STUDENT: SUBMIT
  // ════════════════════════════════════════════════════════

  async startAssignment(ctx: RequestContext, assignmentId: string): Promise<void> {
    await this.authz.assert(ctx, 'assignments:submit');

    const assignment = await this.repo.findPublishedAssignment(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Published assignment not found');

    // Check student is in the right class
    // ... (similar class check as above)

    // Create or update submission with in_progress status
    const student = await this.repo.findStudentByUserId(ctx.userId);
    let submission = await this.repo.findSubmissionByStudentAndAssignment(student.id, assignmentId);

    if (submission) {
      if (submission.status === 'submitted' || submission.status === 'graded') {
        throw new ValidationError('You have already submitted this assignment');
      }
    } else {
      submission = await this.repo.createSubmission({
        assignment_id: assignmentId,
        student_id: student.id,
        school_id: ctx.schoolId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });
    }

    // For timed assignments, check duration
    if (assignment.duration_minutes && !submission.started_at) {
      await this.repo.updateSubmission(submission.id, {
        started_at: new Date().toISOString(),
      });
    }
  }

  async submitAssignment(
    ctx: RequestContext,
    assignmentId: string,
    input: SubmitAssignmentInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'assignments:submit');

    const assignment = await this.repo.findPublishedAssignment(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Published assignment not found');

    const student = await this.repo.findStudentByUserId(ctx.userId);
    let submission = await this.repo.findSubmissionByStudentAndAssignment(student.id, assignmentId);

    if (!submission) {
      // First submission
      submission = await this.repo.createSubmission({
        assignment_id: assignmentId,
        student_id: student.id,
        school_id: ctx.schoolId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      });
    } else if (submission.status === 'submitted' || submission.status === 'graded') {
      throw new ValidationError('Already submitted. Use resubmit if allowed.');
    }

    // Determine if this is a resubmission:
    // - status = 'returned': teacher returned for revision
    // - status = 'in_progress': student started but never submitted (can submit)
    // - status = 'resubmitted': student already resubmitted (must be returned again)
    const isResubmission = submission.status === 'returned';
    } else {
      // Resubmission
      await this.repo.updateSubmission(submission.id, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        resubmission_count: submission.resubmission_count + 1,
        resubmitted_at: new Date().toISOString(),
      });
    }

    // Save answers
    const questions = await this.repo.getAssignmentQuestions(assignmentId);
    const questionMap = new Map(questions.map(q => [q.id, q]));

    for (const answer of input.answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;

      const submittedAnswer = answer.submitted_answer ?? '';
      const fileUrls = answer.file_urls ?? [];
      let scoreAuto: number | null = null;
      let isCorrect: boolean | null = null;

      // Auto-grade MCQ / True-False
      if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        if (question.correct_answer) {
          isCorrect = submittedAnswer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase();
          scoreAuto = isCorrect ? question.points : 0;
        }
      }

      await this.repo.upsertAnswer(submission.id, {
        question_id: question.id,
        submitted_answer: submittedAnswer,
        file_urls: fileUrls,
        is_correct: isCorrect,
        score_auto: scoreAuto,
        score: scoreAuto ?? 0,  // Temporary — will be updated if teacher overrides
        answered_at: new Date().toISOString(),
      });
    }

    // Auto-compute total auto-score
    let totalAutoScore = 0;
    for (const answer of input.answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;
      if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        const isCorrect = (answer.submitted_answer ?? '').trim().toUpperCase() ===
          (question.correct_answer ?? '').trim().toUpperCase();
        if (isCorrect) totalAutoScore += question.points;
      }
    }

    await this.repo.updateSubmission(submission.id, {
      total_score_auto: totalAutoScore,
      total_score: totalAutoScore,  // Temporary until manual grading
    });

    // For fully auto-graded assignments (revision), auto-grade
    if (assignment.assignment_type === 'revision' || assignment.assignment_type === 'quiz') {
      const allAutoGraded = questions.every(q =>
        ['multiple_choice', 'true_false'].includes(q.question_type)
      );
      if (allAutoGraded) {
        await this.repo.finalizeGrade(submission.id, {
          status: 'graded',
          is_graded: true,
          graded_by: null,  // System-graded
          graded_at: new Date().toISOString(),
          total_score_auto: totalAutoScore,
          total_score: totalAutoScore,
        });

        // For revision assignments, auto-publish results
        if (assignment.assignment_type === 'revision') {
          // Results are immediately visible for revision type
        }
      }
    }

    await this.audit.log({
      eventType: isResubmission ? 'submission:resubmitted' : 'submission:submitted',
      actorId: ctx.userId,
      resourceType: 'submission',
      resourceId: submission.id,
      details: {
        assignmentId,
        isResubmission,
        isAutoGraded: assignment.assignment_type === 'revision' || assignment.assignment_type === 'quiz',
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`submission:${submission.id}`);
    await this.cache.invalidate(`assignment:${assignmentId}:submissions`);

    // Notify teacher
    await this.notificationService.notifySubmissionReceived(
      ctx.schoolId, assignmentId, assignment.teacher_id, student.admission_number,
    );
  }

  // ════════════════════════════════════════════════════════
  // STUDENT: RESUBMIT
  // ════════════════════════════════════════════════════════

  async getResubmissionStatus(
    ctx: RequestContext,
    assignmentId: string,
  ): Promise<{ can_resubmit: boolean; remaining: number; reason: string | null }> {
    await this.authz.assert(ctx, 'assignments:view');

    const assignment = await this.repo.findPublishedAssignment(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');

    const student = await this.repo.findStudentByUserId(ctx.userId);
    const submission = await this.repo.findSubmissionByStudentAndAssignment(student.id, assignmentId);

    if (!submission) return { can_resubmit: true, remaining: assignment.max_resubmissions, reason: null };

    // Revision assignments allow unlimited resubmissions
    if (assignment.assignment_type === 'revision') {
      return { can_resubmit: true, remaining: 999, reason: null };
    }

    // Standard assignments: check max_resubmissions + teacher returned flag
    const remaining = assignment.max_resubmissions - submission.resubmission_count;
    const canResubmit = remaining > 0 &&
      submission.status === 'returned';

    return {
      can_resubmit: canResubmit,
      remaining: Math.max(0, remaining),
      reason: submission.returned_reason,
    };
  }

  // ════════════════════════════════════════════════════════
  // PARENT: MONITOR
  // ════════════════════════════════════════════════════════

  async getAssignmentsForParent(
    ctx: RequestContext,
    query: { child_id?: string; status?: string; page?: number; limit?: number },
  ): Promise<{ data: ParentAssignmentView[]; total: number }> {
    await this.authz.assert(ctx, 'assignments:view');

    const parent = await this.repo.findParentByUserId(ctx.userId);
    if (!parent) throw new NotFoundError('Parent profile not found');

    const children = await this.repo.getParentChildren(parent.id);
    const childIds = query.child_id
      ? children.filter(c => c.id === query.child_id).map(c => c.id)
      : children.map(c => c.id);

    if (childIds.length === 0) return { data: [], total: 0 };

    const assignments = await this.repo.getAssignmentsForParent(childIds, query);

    return assignments;
  }

  // ════════════════════════════════════════════════════════
  // TEACHER: LIST + DELETE + ARCHIVE
  // ════════════════════════════════════════════════════════

  async listAssignments(
    ctx: RequestContext,
    query: AssignmentListQuery,
  ): Promise<{ data: AssignmentResponse[]; total: number }> {
    await this.authz.assert(ctx, 'assignments:view');

    let scopeTeacherId: string | undefined;
    if (ctx.role === 'teacher') {
      scopeTeacherId = ctx.profileId;
    }

    return this.repo.findAssignments(ctx.schoolId, { ...query, teacher_id: scopeTeacherId });
  }

  async deleteAssignment(ctx: RequestContext, assignmentId: string): Promise<void> {
    await this.authz.assert(ctx, 'assignments:delete');

    const assignment = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assignment not found');

    if (assignment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('You can only delete your own assignments');
    }

    // Check for submissions
    const submissionCount = await this.repo.getSubmissionCount(assignmentId);
    if (submissionCount > 0) {
      throw new ValidationError(
        `Cannot delete: ${submissionCount} submission(s) exist. Archive the assignment instead.`,
      );
    }

    await this.repo.softDeleteAssignment(assignmentId);

    await this.audit.log({
      eventType: 'assignment:deleted',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignmentId,
      details: { title: assignment.title, type: assignment.assignment_type },
      outcome: 'success',
    });

    await this.cache.invalidate(`assignment:${assignmentId}`);
    await this.cache.invalidate(`class:${assignment.class_id}:assignments`);
  }

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════

  private validateAssignmentTypeConstraints(input: CreateAssignmentInput | any): void {
    switch (input.assignment_type) {
      case 'quiz':
        if (!input.duration_minutes) {
          throw new ValidationError('Quiz assignments require duration_minutes');
        }
        if (input.questions.some(q => !['multiple_choice', 'true_false'].includes(q.question_type))) {
          throw new ValidationError('Quiz assignments only support MCQs and True/False questions');
        }
        break;
      case 'project':
        if (input.questions.some(q => q.question_type !== 'file_upload' && q.question_type !== 'essay')) {
          throw new ValidationError('Project assignments only support file upload and essay questions');
        }
        if (input.max_resubmissions > 2) {
          throw new ValidationError('Project assignments allow max 2 resubmissions');
        }
        break;
      case 'revision':
        // Revision assignments have unlimited resubmissions
        input.max_resubmissions = 999;
        input.allow_late_submission = false;  // No late submission concept
        // questions may be undefined during update validation (not passed in schema)
        if (input.questions && !input.questions.every(q => ['multiple_choice', 'true_false', 'short_answer'].includes(q.question_type))) {
          throw new ValidationError('Revision assignments only support auto-gradable question types');
        }
        break;
      case 'homework':
        if (!input.due_date) {
          throw new ValidationError('Homework assignments require a due date');
        }
        break;
      case 'worksheet':
        // No specific constraints beyond base
        break;
    }
  }

  private canResubmit(submission: any, assignment: any): boolean {
    if (assignment.max_resubmissions === 0) return false;
    if (submission.resubmission_count >= assignment.max_resubmissions) return false;
    if (!submission.returned_for_revision_at) return false;  // Must be returned by teacher
    return true;
  }

  private mapAssignmentResponse(assignment: any): AssignmentResponse {
    return {
      id: assignment.id,
      teacher_id: assignment.teacher_id,
      teacher_name: assignment.teacher_name ?? '',
      class_id: assignment.class_id,
      class_name: assignment.class_name ?? '',
      subject_id: assignment.subject_id,
      subject_name: assignment.subject_name ?? '',
      title: assignment.title,
      description: assignment.description,
      assignment_type: assignment.assignment_type,
      max_score: assignment.max_score,
      passing_percentage: assignment.passing_percentage,
      due_date: assignment.due_date,
      duration_minutes: assignment.duration_minutes,
      is_published: assignment.is_published,
      published_at: assignment.published_at,
      is_results_published: assignment.is_results_published,
      allow_late_submission: assignment.allow_late_submission,
      late_submission_penalty: assignment.late_submission_penalty,
      max_resubmissions: assignment.max_resubmissions,
      question_count: assignment.question_count ?? 0,
      submission_count: assignment.submission_count ?? 0,
      graded_count: assignment.graded_count ?? 0,
      avg_score: assignment.avg_score ?? null,
      version: assignment.version,
      created_at: assignment.created_at,
    };
  }

  private mapSubmissionResponse(submission: any): SubmissionResponse {
    return {
      id: submission.id,
      assignment_id: submission.assignment_id,
      student_id: submission.student_id,
      student_name: submission.student_name ?? '',
      status: submission.status,
      started_at: submission.started_at,
      submitted_at: submission.submitted_at,
      time_spent_seconds: submission.time_spent_seconds,
      total_score: submission.total_score,
      is_graded: submission.is_graded,
      graded_by: submission.graded_by,
      graded_at: submission.graded_at,
      teacher_remarks: submission.teacher_remarks,
      resubmission_count: submission.resubmission_count,
      resubmitted_at: submission.resubmitted_at,
      returned_for_revision_at: submission.returned_for_revision_at,
      returned_reason: submission.returned_reason,
      answers: (submission.answers ?? []).map((a: any) => ({
        question_id: a.question_id,
        question_text: a.question_text,
        question_type: a.question_type,
        points: a.points,
        submitted_answer: a.submitted_answer,
        file_urls: a.file_urls,
        score: a.score,
        score_auto: a.score_auto,
        score_manual: a.score_manual,
        is_correct: a.is_correct,
        remarks: a.remarks,
        answered_at: a.answered_at,
      })),
    };
  }
}
```

### 4.1 Grading Service

```typescript
// src/modules/assignments/assignment-grading.service.ts

export class AssignmentGradingService {
  constructor(private readonly repo: AssignmentsRepository) {}

  async gradeAnswers(
    submissionId: string,
    grades: Array<{ question_id: string; score_manual: number; remarks?: string }>,
    maxAssignmentScore: number,
  ): Promise<Array<{ question_id: string; score_manual: number; score: number }>> {
    const results: Array<{ question_id: string; score_manual: number; score: number }> = [];

    for (const grade of grades) {
      const question = await this.repo.findQuestionById(grade.question_id);
      if (!question) continue;

      // Validate score doesn't exceed question max
      if (grade.score_manual > question.points) {
        throw new ValidationError(
          `Score ${grade.score_manual} exceeds max points (${question.points}) for question ${grade.question_id}`,
        );
      }

      // Get existing auto-score if any
      const existingAnswer = await this.repo.findAnswerBySubmissionAndQuestion(
        submissionId, grade.question_id,
      );
      const autoScore = existingAnswer?.score_auto ?? 0;

      // Final score = manual (if provided) or auto, but manual takes precedence
      const score = grade.score_manual;

      await this.repo.updateAnswer(submissionId, grade.question_id, {
        score_manual: grade.score_manual,
        score: score,
        remarks: grade.remarks ?? null,
      });

      results.push({ question_id: grade.question_id, score_manual: grade.score_manual, score });
    }

    return results;
  }

  async autoGradeMCQ(
    submittedAnswer: string,
    correctAnswer: string,
    points: number,
  ): Promise<{ is_correct: boolean; score_auto: number }> {
    const isCorrect = submittedAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();
    return {
      is_correct: isCorrect,
      score_auto: isCorrect ? points : 0,
    };
  }

  async autoGradeShortAnswer(
    submittedAnswer: string,
    keywords: string[],
    points: number,
  ): Promise<{ score_auto: number; confidence: 'high' | 'low' }> {
    // Simple keyword-based auto-grading for short answers
    const answerLower = submittedAnswer.toLowerCase();
    const matchedKeywords = keywords.filter(kw => answerLower.includes(kw.toLowerCase()));
    const matchRatio = matchedKeywords.length / keywords.length;

    if (matchRatio >= 0.8) return { score_auto: points, confidence: 'high' };
    if (matchRatio >= 0.5) return { score_auto: points * 0.5, confidence: 'low' };
    return { score_auto: 0, confidence: 'low' };
  }
}
```

### 4.2 Notifications Service

```typescript
// src/modules/assignments/assignment-notifications.service.ts

export class AssignmentNotificationsService {
  constructor(
    private readonly notification: NotificationService,
    private readonly repo: AssignmentsRepository,
  ) {}

  async notifyAssignmentPublished(
    schoolId: string, assignmentId: string, classId: string, title: string,
  ): Promise<void> {
    // Get student user IDs in this class
    const students = await this.repo.getStudentUserIdsByClass(classId);
    const studentIds = students.map(s => s.user_id);

    await this.notification.sendToUsers(studentIds, {
      type: 'academic',
      title: `New Assignment: ${title}`,
      body: `A new assignment has been published. Due date: ...`,
      metadata: { assignmentId, type: 'assignment_published' },
    });
  }

  async notifyResultsPublished(
    schoolId: string, assignmentId: string, classId: string, title: string,
  ): Promise<void> {
    const students = await this.repo.getStudentUserIdsByClass(classId);
    const studentIds = students.map(s => s.user_id);

    await this.notification.sendToUsers(studentIds, {
      type: 'academic',
      title: `Results Published: ${title}`,
      body: `Your grades for "${title}" are now available.`,
      priority: 'high',
      metadata: { assignmentId, type: 'results_published' },
    });

    // Also notify parents
    const parentUserIds = await this.repo.getParentUserIdsByClass(classId);
    await this.notification.sendToUsers(parentUserIds, {
      type: 'academic',
      title: `Results Published: ${title}`,
      body: `Your child's grades for "${title}" are now available.`,
      metadata: { assignmentId, type: 'results_published_parent' },
    });
  }

  async notifySubmissionReceived(
    schoolId: string, assignmentId: string, teacherId: string, studentAdmissionNo: string,
  ): Promise<void> {
    const teacher = await this.repo.findTeacherByProfileId(teacherId);
    if (!teacher) return;

    await this.notification.sendToUsers([teacher.user_id], {
      type: 'academic',
      title: 'Submission Received',
      body: `Student ${studentAdmissionNo} submitted assignment.`,
      metadata: { assignmentId, type: 'submission_received' },
    });
  }

  async notifyGraded(
    schoolId: string, submissionId: string, studentId: string, assignmentTitle: string,
  ): Promise<void> {
    const student = await this.repo.findStudentByProfileId(studentId);
    if (!student) return;

    await this.notification.sendToUsers([student.user_id], {
      type: 'academic',
      title: `Assignment Graded: ${assignmentTitle}`,
      body: `Your submission for "${assignmentTitle}" has been graded.`,
      metadata: { submissionId, type: 'submission_graded' },
    });
  }
}
```

---

## 5. Repositories

```typescript
// src/modules/assignments/assignments.repository.ts

export class AssignmentsRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  // ─── Assignment CRUD ─────────────────────────────────────

  async createAssignment(input: any): Promise<any> {
    const { data, error } = await this.db.from('assignments')
      .insert(input).select().single();
    if (error) throw new DatabaseError('Failed to create assignment', { cause: error });
    return data;
  }

  async findAssignmentById(id: string, schoolId: string): Promise<any | null> {
    const { data, error } = await this.db.from('assignments')
      .select(`
        *,
        classes!inner(name),
        subjects!inner(name),
        teachers!inner(user_id, users!inner(first_name, last_name))
      `)
      .eq('id', id).eq('school_id', schoolId)
      .is('deleted_at', null).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return {
      ...data,
      class_name: data.classes?.name,
      subject_name: data.subjects?.name,
      teacher_name: `${data.teachers?.users?.first_name} ${data.teachers?.users?.last_name}`,
    };
  }

  async findPublishedAssignment(id: string, schoolId: string): Promise<any | null> {
    const assignment = await this.findAssignmentById(id, schoolId);
    if (!assignment || !assignment.is_published) return null;
    return assignment;
  }

  async updateAssignment(id: string, data: any): Promise<any> {
    const { data: updated, error } = await this.db.from('assignments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw new DatabaseError('Failed to update assignment', { cause: error });
    return updated;
  }

  async publishAssignment(id: string, data: any): Promise<void> {
    await this.db.from('assignments').update(data).eq('id', id);
  }

  async publishResults(id: string, data: any): Promise<void> {
    await this.db.from('assignments').update(data).eq('id', id);
  }

  async softDeleteAssignment(id: string): Promise<void> {
    await this.db.from('assignments').update({
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  // ─── Questions ───────────────────────────────────────────

  async createQuestions(assignmentId: string, questions: any[]): Promise<void> {
    const records = questions.map(q => ({ ...q, assignment_id: assignmentId }));
    const { error } = await this.db.from('assignment_questions').insert(records);
    if (error) throw new DatabaseError('Failed to create questions', { cause: error });
  }

  async createQuestion(assignmentId: string, question: any): Promise<any> {
    const { data, error } = await this.db.from('assignment_questions')
      .insert({ ...question, assignment_id: assignmentId }).select().single();
    if (error) throw error;
    return data;
  }

  async findQuestionById(id: string): Promise<any | null> {
    const { data } = await this.db.from('assignment_questions')
      .select('*').eq('id', id).single();
    return data;
  }

  async updateQuestion(id: string, data: any): Promise<void> {
    await this.db.from('assignment_questions').update({
      ...data, updated_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.db.from('assignment_questions').delete().eq('id', id);
  }

  async getQuestionCount(assignmentId: string): Promise<number> {
    const { count } = await this.db.from('assignment_questions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);
    return count ?? 0;
  }

  async getAssignmentQuestions(assignmentId: string): Promise<any[]> {
    const { data } = await this.db.from('assignment_questions')
      .select('*').eq('assignment_id', assignmentId)
      .order('sort_order', { ascending: true });
    return data ?? [];
  }

  async getQuestionsForStudent(assignmentId: string, showAnswers: boolean): Promise<any[]> {
    const query = showAnswers
      ? this.db.from('assignment_questions').select('*')
      : this.db.from('assignment_questions').select(
          'id, assignment_id, question_text, question_type, options, points, sort_order'
        );
    const { data } = await query
      .eq('assignment_id', assignmentId)
      .order('sort_order', { ascending: true });
    return data ?? [];
  }

  async getAnswerCountForQuestion(questionId: string): Promise<number> {
    const { count } = await this.db.from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', questionId);
    return count ?? 0;
  }

  // ─── Submissions ─────────────────────────────────────────

  async createSubmission(input: any): Promise<any> {
    const { data, error } = await this.db.from('submissions')
      .insert(input).select().single();
    if (error) throw new DatabaseError('Failed to create submission', { cause: error });
    return data;
  }

  async findSubmissionById(id: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db.from('submissions')
      .select('*').eq('id', id).eq('school_id', schoolId).single();
    return data;
  }

  async findSubmissionByStudentAndAssignment(studentId: string, assignmentId: string): Promise<any | null> {
    const { data } = await this.db.from('submissions')
      .select('*').eq('student_id', studentId).eq('assignment_id', assignmentId).single();
    return data;
  }

  async updateSubmission(id: string, data: any): Promise<void> {
    await this.db.from('submissions').update({
      ...data, updated_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async returnForResubmission(id: string, data: any): Promise<void> {
    await this.db.from('submissions').update(data).eq('id', id);
  }

  async finalizeGrade(id: string, data: any): Promise<void> {
    await this.db.from('submissions').update(data).eq('id', id);
  }

  async getSubmissionCount(assignmentId: string): Promise<number> {
    const { count } = await this.db.from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);
    return count ?? 0;
  }

  async getGradedCount(assignmentId: string): Promise<number> {
    const { count } = await this.db.from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId).eq('is_graded', true);
    return count ?? 0;
  }

  async getUngradedCount(assignmentId: string): Promise<number> {
    const { count } = await this.db.from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId).eq('is_graded', false)
      .neq('status', 'pending');
    return count ?? 0;
  }

  // ─── Answers ─────────────────────────────────────────────

  async upsertAnswer(submissionId: string, input: any): Promise<void> {
    await this.db.from('answers').upsert({
      ...input, submission_id: submissionId,
    }, { onConflict: 'submission_id, question_id' });
  }

  async updateAnswer(submissionId: string, questionId: string, data: any): Promise<void> {
    await this.db.from('answers').update(data)
      .eq('submission_id', submissionId).eq('question_id', questionId);
  }

  async findAnswerBySubmissionAndQuestion(submissionId: string, questionId: string): Promise<any | null> {
    const { data } = await this.db.from('answers')
      .select('*').eq('submission_id', submissionId).eq('question_id', questionId).single();
    return data;
  }

  // ─── List Queries ────────────────────────────────────────

  async findAssignments(
    schoolId: string,
    filters: {
      class_id?: string; subject_id?: string; assignment_type?: string;
      status?: string; search?: string; teacher_id?: string;
      due_before?: string; due_after?: string;
      include_inactive?: boolean; page?: number; limit?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    let query = this.db.from('assignments')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId);

    if (!filters.include_inactive) query = query.is('deleted_at', null);
    if (filters.teacher_id) query = query.eq('teacher_id', filters.teacher_id);
    if (filters.class_id) query = query.eq('class_id', filters.class_id);
    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id);
    if (filters.assignment_type) query = query.eq('assignment_type', filters.assignment_type);
    if (filters.status === 'draft') query = query.eq('is_published', false);
    if (filters.status === 'published') query = query.eq('is_published', true);
    if (filters.status === 'closed') query = query.lt('due_date', new Date().toISOString()).eq('is_published', true);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    if (filters.due_before) query = query.lt('due_date', filters.due_before);
    if (filters.due_after) query = query.gt('due_date', filters.due_after);

    query = query.order('created_at', { ascending: false });

    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    const to = from + (filters.limit ?? 20) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getAssignmentsForStudent(
    classId: string, studentId: string,
    filters: { assignment_type?: string; status?: string; page?: number; limit?: number },
  ): Promise<{ data: any[]; total: number }> {
    let query = this.db.from('assignments')
      .select('*', { count: 'exact' })
      .eq('class_id', classId).eq('is_published', true)
      .is('deleted_at', null);

    if (filters.assignment_type) query = query.eq('assignment_type', filters.assignment_type);
    if (filters.status === 'pending') query = query.is('submissions.id', null);
    if (filters.status === 'submitted') query = query.not('submissions.id', 'is', null);

    query = query.order('due_date', { ascending: true });
    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    query = query.range(from, from + (filters.limit ?? 20) - 1);

    const { data, count } = await query;
    return { data: data ?? [], total: count ?? 0 };
  }

  async getAssignmentsForParent(
    childIds: string[],
    filters: { status?: string; page?: number; limit?: number },
  ): Promise<{ data: ParentAssignmentView[]; total: number }> {
    // ⚠️ SECURITY: Two-step approach to prevent data leakage.
    // Supabase nested select with `.in('submissions.student_id', ...)` may not
    // filter joined rows correctly, potentially returning ALL submissions for
    // an assignment instead of just the child's submission.
    //
    // Step 1: Get published assignments for the children's classes.
    // Step 2: Get submissions filtered explicitly by child_ids.
    const childIdSet = [...new Set(childIds)];

    // Step 1: Get class IDs for children
    const { data: enrollments } = await this.db.from('class_enrollments')
      .select('class_id')
      .in('student_id', childIdSet)
      .eq('status', 'active');
    const classIds = [...new Set(enrollments?.map(e => e.class_id) ?? [])];
    if (classIds.length === 0) return { data: [], total: 0 };

    // Step 2: Get published assignments for those classes
    let query = this.db.from('assignments')
      .select(`
        id, title, assignment_type, max_score, due_date, is_published,
        is_results_published, created_at, teacher_id,
        classes!inner(name, section),
        subjects!inner(name)
      `, { count: 'exact' })
      .in('class_id', classIds)
      .eq('is_published', true)
      .is('deleted_at', null);

    query = query.order('due_date', { ascending: false });
    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    query = query.range(from, from + (filters.limit ?? 20) - 1);

    const { data, count } = await query;
    const assignments = data ?? [];

    if (assignments.length === 0) return { data: [], total: count ?? 0 };

    // Step 3: Get submissions for these children + assignments
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissions } = await this.db.from('submissions')
      .select('id, assignment_id, student_id, status, is_graded, total_score, submitted_at')
      .in('assignment_id', assignmentIds)
      .in('student_id', childIdSet);

    const submissionsByAssignment: Record<string, any[]> = {};
    for (const sub of submissions ?? []) {
      if (!submissionsByAssignment[sub.assignment_id]) submissionsByAssignment[sub.assignment_id] = [];
      submissionsByAssignment[sub.assignment_id].push(sub);
    }

    // Step 4: Get child names
    const { data: children } = await this.db.from('students')
      .select('id, first_name, last_name')
      .in('id', childIdSet);
    const childNames: Record<string, string> = {};
    for (const c of children ?? []) {
      childNames[c.id] = `${c.first_name} ${c.last_name}`;
    }

    // Step 5: Assemble response — each assignment gets child-specific submission data
    const result: ParentAssignmentView[] = [];
    for (const assignment of assignments) {
      const assignmentSubmissions = submissionsByAssignment[assignment.id] ?? [];
      for (const sub of assignmentSubmissions) {
        result.push({
          child_id: sub.student_id,
          child_name: childNames[sub.student_id] ?? 'Unknown',
          assignment_id: assignment.id,
          title: assignment.title,
          assignment_type: assignment.assignment_type,
          class_name: `${assignment.classes.name}${assignment.classes.section ? ' ' + assignment.classes.section : ''}`,
          subject_name: assignment.subjects.name,
          max_score: assignment.max_score,
          due_date: assignment.due_date,
          is_results_published: assignment.is_results_published,
          submission_id: sub.id,
          status: sub.status,
          is_graded: sub.is_graded,
          score: sub.total_score,
          submitted_at: sub.submitted_at,
        });
      }
    }

    return { data: result, total: result.length };
  }

  // ─── Student / Parent / Teacher lookups ──────────────────

  async findStudentByUserId(userId: string): Promise<any | null> {
    const { data } = await this.db.from('students')
      .select('id, class_id, admission_number, user_id')
      .eq('user_id', userId).is('deleted_at', null).single();
    return data;
  }

  async findStudentByProfileId(studentId: string): Promise<any | null> {
    const { data } = await this.db.from('students')
      .select('id, user_id, admission_number')
      .eq('id', studentId).single();
    return data;
  }

  async findParentByUserId(userId: string): Promise<any | null> {
    const { data } = await this.db.from('parents')
      .select('id').eq('user_id', userId).is('deleted_at', null).single();
    return data;
  }

  async getParentChildren(parentId: string): Promise<any[]> {
    const { data } = await this.db.from('student_parents')
      .select('student_id')
      .eq('parent_id', parentId).is('deleted_at', null);
    const ids = data?.map(d => d.student_id) ?? [];
    if (ids.length === 0) return [];
    const { data: students } = await this.db.from('students')
      .select('id, first_name, last_name, admission_number, class_id')
      .in('id', ids).is('deleted_at', null);
    return students ?? [];
  }

  async findTeacherByProfileId(teacherId: string): Promise<any | null> {
    const { data } = await this.db.from('teachers')
      .select('id, user_id').eq('id', teacherId).single();
    return data;
  }

  async getStudentUserIdsByClass(classId: string): Promise<Array<{ user_id: string }>> {
    const { data } = await this.db.from('students')
      .select('user_id').eq('class_id', classId).is('deleted_at', null);
    return data ?? [];
  }

  async getParentUserIdsByClass(classId: string): Promise<string[]> {
    const { data } = await this.db.from('students')
      .select('id').eq('class_id', classId).is('deleted_at', null);
    const studentIds = data?.map(s => s.id) ?? [];
    if (studentIds.length === 0) return [];
    const { data: parentLinks } = await this.db.from('student_parents')
      .select('parent_id').in('student_id', studentIds);
    const parentIds = [...new Set(parentLinks?.map(p => p.parent_id) ?? [])];
    if (parentIds.length === 0) return [];
    const { data: parents } = await this.db.from('parents')
      .select('user_id').in('id', parentIds);
    return parents?.map(p => p.user_id) ?? [];
  }

  async teacherTeachesSubjectInClass(teacherId: string, classId: string, subjectId: string): Promise<boolean> {
    const { count } = await this.db.from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).eq('class_id', classId)
      .eq('subject_id', subjectId).is('deleted_at', null);
    return (count ?? 0) > 0;
  }

  async getSubmissionWithAnswers(submissionId: string): Promise<any> {
    const { data } = await this.db.from('submissions')
      .select(`
        *,
        students!inner(first_name, last_name, admission_number),
        answers(*, assignment_questions!inner(question_text, question_type, points))
      `)
      .eq('id', submissionId).single();
    if (!data) return null;
    return {
      ...data,
      student_name: `${data.students?.first_name} ${data.students?.last_name}`,
      answers: (data.answers ?? []).map((a: any) => ({
        ...a,
        question_text: a.assignment_questions?.question_text,
        question_type: a.assignment_questions?.question_type,
        points: a.assignment_questions?.points,
      })),
    };
  }
}
```

---

## 6. API Routes

### 6.1 POST /assignments — Create assignment (draft)

```typescript
POST /assignments
Role: teacher, school_admin

Request: CreateAssignmentSchema
Response: 201 { data: AssignmentResponse }
Errors: 400 (type constraints), 403 (not teaching class), 404 (class/subject), 422
```

### 6.2 GET /assignments — List assignments

```
GET /assignments?class_id=...&subject_id=...&assignment_type=...&status=...&page=1&limit=20
Role: school_admin (all), teacher (own), student (own class, published only), parent (children's)

Scope: Teacher sees own assignments. Student sees published assignments for their class.
Parent sees published assignments for their children's classes.
```

### 6.3 GET /assignments/{id} — Get assignment detail

```
GET /assignments/{id}
Role: school_admin, teacher (own), student (own class, published), parent (children's)

Response: 200 { data: AssignmentResponse }
```

### 6.4 PATCH /assignments/{id} — Update assignment

```
PATCH /assignments/{id}
Role: teacher (own), school_admin
Request: UpdateAssignmentSchema
Errors: 400 (post-publish field restrictions), 403, 404

Note: Core fields (questions, type, max_score) cannot be changed after publishing.
Only timing, description, and late submission settings can be updated post-publish.
```

### 6.5 DELETE /assignments/{id} — Delete assignment

```
DELETE /assignments/{id}
Role: teacher (own), school_admin
Errors: 400 (submissions exist — must archive instead), 403, 404

Note: If submissions exist, this endpoint returns 400. Teachers should use archive instead.
Admin can force-delete with audit (override param: ?force=true&reason=...).
```

### 6.6 POST /assignments/{id}/archive — Archive assignment

```
POST /assignments/{id}/archive
Role: teacher (own), school_admin
Response: 200 { data: { message: 'Assignment archived' } }

Archiving: Soft deletes the assignment but preserves submissions, grades, and answers.
Hidden from student dashboards, visible in teacher's archived view.
```

### 6.7 POST /assignments/{id}/publish — Publish assignment

```
POST /assignments/{id}/publish
Role: teacher (own), school_admin
Request: { scheduled_at?: ISO8601, send_notification?: boolean }
Response: 200 { data: { published_at: ISO8601 } }
Errors: 400 (no questions, no due date, no max score), 403, 404

Validates: has questions, has due_date (except revision), has max_score
```

### 6.8 POST /assignments/{id}/publish-results — Publish grades

```
POST /assignments/{id}/publish-results
Role: teacher (own), school_admin
Request: { show_answers?: boolean, send_notification?: boolean, publish_after?: ISO8601 }
Errors: 400 (no graded submissions), 403, 404

Triggers notification to all students and parents.
```

### 6.9 POST /assignments/{id}/questions — Add question

```
POST /assignments/{id}/questions
Role: teacher (own), school_admin
Request: AssignmentQuestionInputSchema
Errors: 400 (published), 403, 404
```

### 6.10 PATCH /assignments/questions/{id} — Update question

```
PATCH /assignments/questions/{id}
Role: teacher (own), school_admin
Request: UpdateQuestionSchema
Errors: 400 (published), 403, 404
```

### 6.11 DELETE /assignments/questions/{id} — Delete question

```
DELETE /assignments/questions/{id}
Role: teacher (own), school_admin
Errors: 400 (published, has answers), 403, 404
```

### 6.12 POST /assignments/questions/reorder — Reorder questions

```
POST /assignments/questions/reorder
Role: teacher (own), school_admin
Request: { order: Array<{ id: UUID, sort_order: number }> }
```

### 6.13 POST /assignments/{id}/clone — Clone assignment

```
POST /assignments/{id}/clone
Role: teacher, school_admin
Request: { title?: string, class_id?: UUID, due_date?: ISO8601 }
Response: 201 { data: AssignmentResponse }

Clones the assignment including all questions (but NOT submissions).
New assignment starts as draft. source_assignment_id tracks the original.
```

### 6.14 GET /assignments/{id}/submissions — List submissions

```
GET /assignments/{id}/submissions?status=...&graded=true&page=1&limit=50
Role: teacher (own), school_admin
Response: 200 { data: SubmissionResponse[] }
```

### 6.15 GET /assignments/submissions/{id} — Get submission detail

```
GET /assignments/submissions/{id}
Role: teacher (own), school_admin, student (own)
Response: 200 { data: SubmissionResponse }
```

### 6.16 POST /assignments/{id}/start — Start assignment (student)

```
POST /assignments/{id}/start
Role: student
Response: 200 { data: { started_at: ISO8601, time_remaining_minutes?: number } }

For timed assignments, starts the timer. Returns time remaining.
```

### 6.17 POST /assignments/{id}/submit — Submit assignment (student)

```
POST /assignments/{id}/submit
Role: student
Request: SubmitAssignmentSchema
Response: 200 { data: { submission_id: UUID, is_auto_graded: boolean, score?: number } }
Errors: 400 (already submitted, late without permission), 403, 404

Auto-grades MCQ/TF questions. For revision/quiz types, auto-finalizes grade.
```

### 6.18 POST /assignments/submissions/{id}/grade — Grade submission

```
POST /assignments/submissions/{id}/grade
Role: teacher (own), school_admin
Request: GradeSubmissionSchema (answers array + teacher_remarks + return_for_revision)
Response: 200 { data: SubmissionResponse }
Errors: 403, 404, 400 (already graded)

return_for_revision: true → returns submission to student for revision (resubmission)
return_for_revision: false → finalizes the grade
```

### 6.19 POST /assignments/submissions/{id}/override — Override grade

```
POST /assignments/submissions/{id}/override
Role: school_admin (with audit), principal (with reason)
Request: { reason: string, answers: Array<{ question_id, score_manual }> }
Response: 200 { data: SubmissionResponse }

Requires reason string (min 20 chars). Logged with before/after values.
Principal can override within school; admin can override unconditionally.
```

### 6.20 POST /assignments/{id}/save-draft — Save draft (student)

```
POST /assignments/{id}/save-draft
Role: student
Request: { answers: SubmitAnswerSchema[] }
Response: 200 { data: { saved_at: ISO8601, answers_saved: number } }
Errors: 403 (not published, not student's class), 404

Saves answers without changing submission status to 'submitted'.
Student can continue working later. For timed assignments, timer continues.
Does NOT trigger auto-grading or teacher notification.
Status stays 'in_progress' (or creates one if none exists).
```

### 6.21 POST /assignments/{id}/return-resubmission — Return for revision

```
POST /assignments/{id}/return-resubmission
Role: teacher (own), school_admin
Request: ReturnForResubmissionSchema
```

### 6.22 GET /assignments/{id}/resubmission-status — Student check resubmit

```
GET /assignments/{id}/resubmission-status
Role: student
Response: { can_resubmit: boolean, remaining: number, reason: string | null }
```

### 6.23 GET /assignments/parent — Parent assignment overview

```
GET /assignments/parent?child_id=...&status=...&page=1&limit=20
Role: parent
Response: { data: ParentAssignmentView[], total: number }

ParentAssignmentView includes: assignment title, type, class, subject, due_date,
submission status, score, is_graded, child_name
```

### 6.24 GET /assignments/stats — Assignment statistics

```
GET /assignments/stats?assignment_id=...
Role: teacher (own), school_admin
Response: {
  total_submissions: number,
  graded: number,
  pending: number,
  avg_score: number,
  median_score: number,
  max_score: number,
  min_score: number,
  below_passing: number,
  late_submissions: number,
  score_distribution: Array<{ range: string, count: number }>
}
```

---

## 7. Permissions

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create assignment | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Edit assignment | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Delete assignment | 🔶 | ❌ | 🔷 (own) | ❌ | ❌ |
| Publish assignment | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| View assignment list | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View assignment detail | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| Add/edit/delete questions | ✅ | ❌ | 🔷 (own, draft) | ❌ | ❌ |
| Submit assignment | ❌ | ❌ | ❌ | 🔷 (own) | ❌ |
| Resubmit assignment | ❌ | ❌ | ❌ | 🔷 (own) | ❌ |
| Grade submission | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Publish results | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Override grade | 🔶 | 🔶 | ❌ | ❌ | ❌ |
| View submissions | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View grades/results | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher creates/edit for own classes | `teacher_class_subjects` check on create |
| Teacher cannot edit questions after publishing | `is_published` guard in service |
| Student submits only own assignments | `submissions.student_id == ctx.studentProfileId` |
| Student sees only published assignments | `is_published = TRUE` filter |
| Student sees questions without correct_answer before grading | `v_assignment_questions_student` view |
| Student sees answers + scores only after results published | `is_results_published` guard |
| Parent sees only own children's data | `student_parents` join filter |
| Grade override requires written reason | Zod validation |
| Delete blocked if submissions exist | Service count check |

### 7.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'assignments:create', { classId });
await this.authz.assert(ctx, 'assignments:edit');           // Owner + draft guard in service
await this.authz.assert(ctx, 'assignments:publish');         // Owner check in service
await this.authz.assert(ctx, 'assignments:grade');           // Owner check in service
await this.authz.assert(ctx, 'assignments:delete');          // Owner check in service
await this.authz.assert(ctx, 'assignments:publish_results'); // Owner check in service
await this.authz.assert(ctx, 'assignments:submit');          // Student role + scope
await this.authz.assert(ctx, 'assignments:view');            // Role-dependent scope
```

---

## 8. Submission Workflow

### 8.1 Standard Submission Flow

```
[Student]                  [System]                      [Teacher]
    │                          │                             │
    │  GET /assignments        │                             │
    │─────────────────────────►│                             │
    │◄──── Published list ─────│                             │
    │                          │                             │
    │  POST /assignments/{id}/start                          │
    │─────────────────────────►│                             │
    │◄── started_at + timer ───│                             │
    │                          │                             │
    │  (Student works on assignment)                         │
    │                          │                             │
    │  POST /assignments/{id}/submit                         │
    │  { answers: [...] }     │                             │
    │─────────────────────────►│                             │
    │                          │  Auto-grade MCQ/TF          │
    │                          │  Create submission record   │
    │                          │  Compute auto-score         │
    │                          │                             │
    │◄── submission_id +      │                             │
    │    is_auto_graded ──────│                             │
    │                          │  Notify teacher             │
    │                          │────────────────────────────►│
    │                          │                             │
```

### 8.2 Timed Assignment Flow (Quiz)

```
[Student]                  [System]                      [Teacher]
    │                          │                             │
    │  POST /start              │                             │
    │─────────────────────────►│                             │
    │◄── started_at +          │                             │
    │    time_remaining: 30m ──│                             │
    │                          │                             │
    │  Timer counts down       │                             │
    │  on client               │                             │
    │                          │                             │
    │  ┌─────────────────┐     │                             │
    │  │ Auto-submit on  │────►│  Force submit + grade       │
    │  │ timer expiry    │     │                             │
    │  └─────────────────┘     │                             │
    │                          │                             │
    │  POST /submit            │                             │
    │  (before timer expires)  │                             │
    │─────────────────────────►│                             │
    │                          │  Auto-grade all MCQ/TF      │
    │                          │  Finalize grade             │
    │◄── score + results ─────│                             │
```

### 8.3 Late Submission

```
[Student] submits after due_date:

1. Check assignment.allow_late_submission
   - TRUE: Allow submission, apply penalty if configured
   - FALSE: Block submission → "Assignment due date has passed"

2. If penalty applies:
   - Calculate days_late = Math.ceil((now - due_date) / 86400000)
   - per_day_penalty = assignment.late_submission_penalty  // e.g., 10 = 10% per day
   - total_penalty_pct = Math.min(days_late * per_day_penalty, 100)  // Cap at 100%
   - max_possible_score = assignment.max_score * (1 - total_penalty_pct / 100)
   - Display: "Late submission: {days_late} day(s) late. {total_penalty_pct}% penalty applied. Maximum possible score: {max_possible_score}"
```

**Formula explanation**: If penalty = 10% per day and student is 3 days late, total penalty = 3 × 10% = 30%. Max score is capped at `maxScore × (1 − 0.30) = maxScore × 0.70`.

### 8.4 Revision Assignment Flow

```
[Student]                  [System]
    │                          │
    │  GET /assignments        │
    │─────────────────────────►│
    │◄── Revision questions ──│  (always visible, no due date)
    │                          │
    │  POST /submit            │
    │─────────────────────────►│
    │                          │  Auto-grade all questions
    │                          │  Finalize: status = 'graded'
    │                          │  results published immediately
    │◄── score + correct       │
    │    answers ─────────────│
    │                          │
    │  (Can retake any time)   │
    │  (No limit on attempts)  │
```

---

## 9. Grading Workflow

### 9.1 Standard Grading Flow

```
[Teacher]                  [System]                      [Student]
    │                          │                             │
    │  GET /assignments/{id}/submissions                    │
    │─────────────────────────►│                             │
    │◄── Pending submissions ──│                             │
    │                          │                             │
    │  POST /grade {           │                             │
    │    answers: [            │                             │
    │      { question_id,      │                             │
    │        score_manual,     │                             │
    │        remarks }         │                             │
    │    ],                    │                             │
    │    teacher_remarks,      │                             │
    │    return_for_revision   │                             │
    │  }                       │                             │
    │─────────────────────────►│                             │
    │                          │                             │
    │  if return_for_revision: │                             │
    │    Set status=submitted  │                             │
    │    Set returned_at       │                             │
    │    Notify student        │────────────────────────────►│
    │                          │                             │
    │  else:                   │                             │
    │    Compute total_score   │                             │
    │    Set is_graded=true    │                             │
    │    Save graded_at        │                             │
    │                          │                             │
    │◄── SubmissionResponse ──│                             │
    │                          │                             │
```

### 9.2 Auto-Grading Logic

| Question Type | Auto-Gradable? | Method |
|---------------|---------------|--------|
| `multiple_choice` | ✅ | Case-insensitive string comparison with `correct_answer` |
| `true_false` | ✅ | Case-insensitive string comparison with `correct_answer` |
| `short_answer` | ⚠️ Partial (keyword-based) | Keyword matching in `correct_answer` (comma-separated) |
| `long_answer` | ❌ Manual only | Teacher reviews and assigns score |
| `essay` | ❌ Manual only | Teacher reviews and assigns score |
| `file_upload` | ❌ Manual only | Teacher reviews uploaded file |

### 9.3 Score Computation

```typescript
// Per-question score:
// - If score_manual is set → score = score_manual (teacher override)
// - If no score_manual but score_auto is set → score = score_auto
// - If neither → score = 0

// Total score:
total_score = COALESCE(SUM(score_manual), 0) + COALESCE(SUM(score_auto), 0)

// Passing check:
is_passing = (total_score / max_score * 100) >= passing_percentage
```

### 9.4 Grade Override Flow (Admin / Principal)

```
[Admin/Principal]          [System]                      [Teacher]
    │                          │                             │
    │  POST /override {        │                             │
    │    reason: "...",        │                             │
    │    answers: [...]        │                             │
    │  }                       │                             │
    │─────────────────────────►│                             │
    │                          │                             │
    │  1. Validate reason      │                             │
    │     (min 20 chars)       │                             │
    │                          │                             │
    │  2. Snapshot old_data    │                             │
    │     (current scores)     │                             │
    │                          │                             │
    │  3. Apply new scores     │                             │
    │                          │                             │
    │  4. Log audit with       │                             │
    │     before + after       │                             │
    │                          │                             │
    │  5. Notify teacher       │────────────────────────────►│
    │                          │                             │
    │◄── SubmissionResponse ──│                             │
```

---

## 10. Parent Monitoring

### 10.1 Parent Dashboard View

```
GET /assignments/parent?child_id=UUID
Role: parent

Response:
{
  "data": [
    {
      "child_name": "Aarav Sharma",
      "child_id": "uuid",
      "assignments": [
        {
          "title": "Nutrition in Plants HW",
          "type": "homework",
          "class": "7A",
          "subject": "Science",
          "due_date": "2026-06-15T16:00:00Z",
          "status": "submitted",
          "submitted_at": "2026-06-14T10:30:00Z",
          "is_graded": true,
          "score": "16/20",
          "percentage": 80,
          "is_passing": true,
          "teacher_remarks": "Good work! Please work on diagrams."
        },
        ...
      ]
    }
  ]
}
```

### 10.2 Notification Triggers (Parent)

| Event | Notification | Channel |
|-------|-------------|---------|
| Child submits assignment | "Aarav submitted 'Nutrition HW'" | in_app |
| Child's assignment graded | "Aarav scored 16/20 on 'Nutrition HW'" | in_app, email |
| Late submission | "Aarav submitted 'Math HW' 2 days late" | in_app |
| Child has overdue assignments | "Aarav has 3 overdue assignments" | in_app, email (weekly) |
| Results published | "Results for 'Unit Test 1' available" | in_app, email |

### 10.3 Data Scoping

```typescript
// Parent sees ONLY:
// 1. Assignments for classes their children are enrolled in
// 2. Published assignments only (is_published = TRUE)
// 3. Their own child's submissions and grades
// 4. Teacher remarks (not other students' grades)

// Parent CANNOT see:
// 1. Answer keys (before grading)
// 2. Other children's grades
// 3. Unpublished assignments
// 4. Draft assignments
// 5. Other teachers' internal notes
```

---

## 11. Resubmission Workflow

### 11.1 Flow Diagram

```
[Teacher]                  [System]                      [Student]
    │                          │                             │
    │  Grade with              │                             │
    │  return_for_revision=true│                             │
    │─────────────────────────►│                             │
    │                          │                             │
    │                          │  Status: 'submitted'        │
    │                          │  returned_for_revision_at   │
    │                          │  resubmission_count unchanged│
    │                          │                             │
    │                          │  Notify student             │
    │                          │────────────────────────────►│
    │                          │                             │
    │                          │  Student sees:              │
    │                          │  "Returned for revision:    │
    │                          │   Add diagrams to Q3"       │
    │                          │                             │
    │                          │  Student revises +          │
    │                          │  POST /{id}/submit          │
    │                          │◄────────────────────────────│
    │                          │                             │
    │                          │  resubmission_count++       │
    │                          │  status = 'submitted'       │
    │                          │  Reset is_graded = false    │
    │                          │                             │
    │                          │  Notify teacher             │
    │──────────────────────────│◄────────────────────────────│
```

### 11.2 Resubmission Rules

| Rule | Value |
|------|-------|
| Max resubmissions per assignment | `assignment.max_resubmissions` (default 0) |
| Trigger | Teacher grades with `return_for_revision: true` |
| Student sees | Previous answers + teacher's returned_reason |
| Submission status during revision | `submitted` (special state: "returned for revision") |
| Resubmission deadline | `assignment.due_date_extension` or 7 days from return (whichever is earlier) |
| Graded count | Resubmitted submissions are NOT counted as "graded" |
| Score display | Most recent grade replaces previous |

---

## 12. Edge Cases

### 12.1 Assignment Lifecycle Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Edit after publish** | Only timing, description, late submission settings. Questions frozen. |
| 2 | **Delete with submissions** | Blocked. Must archive instead. Admin can force-delete with audit for rare cases. |
| 3 | **Publish empty assignment** | Blocked. Must have at least 1 question. |
| 4 | **Publish without due date** | Only allowed for `revision` type. Others require due_date. |
| 5 | **Due date in the past** | Allowed (teacher can backdate). Student sees as "overdue" on listing. |
| 6 | **Multiple teachers, one class** | Each teacher creates assignments independently. Students see union. |
| 7 | **Assignment cloned mid-term** | New draft created. No linked submissions. Clone preserves questions + settings. |
| 8 | **Class deleted mid-term** | Assignments orphaned. Admin must reassign or archive. EventBus notification. |
| 9 | **Subject removed from class** | Teacher can no longer create new assignments for that subject in that class. Existing assignments visible. |
| 10 | **Teacher leaves mid-term** | Admin reassigns or archives. Remaining submissions can be regraded by admin. |

### 12.2 Submission Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Student submits twice** | Blocked. Use resubmission if teacher returned for revision. |
| 2 | **Submit after due date** | Check `allow_late_submission`. Apply penalty if configured. |
| 3 | **Submit for ungraded manual questions** | Allowed. Teacher grades manually. Auto-score = 0 for ungraded manual questions. |
| 4 | **Partial submission** | All questions optional by default. Unanswered questions get 0. |
| 5 | **Timed assignment: browser close mid-test** | Submission saved as `in_progress`. Student can resume within duration window. |
| 6 | **Timed assignment: timer expires** | Auto-submit with whatever answers are saved. |
| 7 | **Timed assignment: network drop** | Answers saved locally, submitted on reconnect. Timer still counts down server-side. |
| 8 | **Student submits empty answers** | Allowed but will likely get 0. Teachers can give partial credit if configured. |
| 9 | **Student changes class mid-term** | Old submissions preserved. New assignments appear for new class. |
| 10 | **Student deactivated** | Submissions preserved for audit. Student cannot submit new assignments. |

### 12.3 Grading Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Grade exceeds max points** | Blocked per-question. Score must be ≤ question.points. |
| 2 | **Regrade after grading** | Use `/override` (admin) or use `return_for_revision` + resubmit flow. |
| 3 | **Partial grading** | Some questions graded, others not → submission is `submitted` not `graded`. |
| 4 | **All auto-graded with no manual review** | For revision/quiz: auto-finalize. For homework with all MCQ: teacher must still submit grade. |
| 5 | **Late submission penalty + grade** | Apply penalty to max possible score: `max_score * (1 - days_late * penalty_pct / 100)`. Then cap total at this value. |
| 6 | **Teacher grades after results published** | Regrade via override. Students see updated score (logged). |
| 7 | **Principal override vs admin override** | Principal: reason required (min 20 chars), teacher notified. Admin: reason optional, teacher notified. |
| 8 | **Grade override with no change** | Allowed but pointless. Logged with "no change" note. |

### 12.4 Timing Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Assignment scheduled in future** | `is_published = false`, `scheduled_at` set. Auto-publish via cron. |
| 2 | **Results scheduled for future** | `is_results_published = false`, `show_results_after` set. Auto-publish via cron. |
| 3 | **Due date after term ends** | Warning on publish: "Due date is after current term ends." Still allowed. |
| 4 | **Duration exceeds end of day** | Quiz duration capped at end of school day (configurable). |
| 5 | **Quiz at midnight** | `scheduled_at` handles timezone. Stored as UTC, displayed in school timezone. |

---

## 13. Risk Analysis

### 13.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Student sees answer key during active quiz** | Critical | Cheating, test invalid | `v_assignment_questions_student` view excludes `correct_answer`. API returns filtered view. |
| 2 | **Student accesses another student's submission** | High | Privacy violation | `submissions_student_manage` RLS policy scopes to own student_id. API checks ownership. |
| 3 | **Teacher grades submission for non-assigned class** | High | Unauthorized grade changes | Service checks `teacher_class_subjects` before grade operations. |
| 4 | **Parent sees another child's grades** | High | Privacy violation | Parent endpoints filter through `student_parents` join. Parent_id derived from JWT, not request. |
| 5 | **Bulk submission via script** | Medium | Cheating via automation | Rate limit: max 1 submission per student per 30 seconds. |
| 6 | **Untimed quiz: student submits slowly** | Low | Time advantage | `duration_minutes` enforced server-side. Timer tracks actual time spent. |
| 7 | **File upload injection** | Medium | Malware, phishing | Validate file type, scan for malware, limit size (10MB max). |
| 8 | **Question edit after publish (accidental)** | Medium | Student sees wrong/confusing questions | Block question edits after publish. Require admin override. |

### 13.2 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Assignment deleted with submissions** | Data loss | Blocked by service. Archive preserves data. |
| 2 | **Question deleted with answers** | Orphaned answers | Block if answer count > 0. Admin can force-delete. |
| 3 | **Duplicate submission on network retry** | Two submissions for same student | `UNIQUE(assignment_id, student_id)` prevents duplicates. Backend dedup on idempotency key. |
| 4 | **Auto-score + manual score race condition** | Wrong total | Service computes total after all manual grades are saved. |
| 5 | **Results published before all graded** | Some students see partial grades | Service warns if ungraded submissions exist. Admin can override. |
| 6 | **Resubmission overwrites original** | Lost original answers | System preserves all answer versions in answers table. Last submission is current. |

### 13.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **Assignment list for large class (50 students)** | Loading all assignments + submission status | Pagination (20 per page). Cached with 30s TTL. |
| 2 | **Grading queue for 50 submissions** | Teacher loads all submissions to grade | Paginated submission list (50 per page). Lazy-load answers. |
| 3 | **Auto-grading 50 MCQs for 50 students** | 2,500 answer grading operations | Server-side batch processing. Not per-answer API calls. |
| 4 | **Parent dashboard: 3 children × 5 classes** | 15 class assignment lists | Aggregated query with JOINs. Cached 60s. |
| 5 | **MV refresh on grade** | Real-time performance stats | Refresh MV every 15 min (not per-grade). Dashboard uses cached MV. |

### 13.4 V1 Mistakes Not to Repeat

| V1 Mistake | V2 Fix |
|-----------|--------|
| Separate `homeworks` and `tests` tables with identical schemas | Unified `assignments` with `assignment_type` discriminator |
| No resubmission workflow | `max_resubmissions` + `return_for_revision` + resubmission tracking |
| No late submission handling | `allow_late_submission` + `late_submission_penalty` + penalty computation |
| No assignment cloning | `clone` endpoint + `source_assignment_id` FK |
| Questions could be edited after publishing | Block question edits post-publish |
| No schedule/publish workflow | `scheduled_at` + `published_at` + auto-publish via cron |
| No parent monitoring | Dedicated `GET /assignments/parent` endpoint with child-scoped view |
| Grades could be changed without audit | Grade override requires reason, logs before/after, notifies teacher |

---

## 14. Testing Checklist

### 14.1 Unit Tests — Assignment CRUD

| Test | Expected | Priority |
|------|----------|----------|
| `create_assignment: homework valid` | Created as draft, questions saved | P0 |
| `create_assignment: quiz without duration` | 400 ValidationError | P0 |
| `create_assignment: revision with non-MCQ` | 400 ValidationError | P1 |
| `create_assignment: project with file_upload` | Created | P1 |
| `create_assignment: teacher not assigned` | 403 ForbiddenError | P0 |
| `create_assignment: 0 questions` | 422 ValidationError (Zod) | P0 |
| `update_assignment: before publish` | All fields updatable | P0 |
| `update_assignment: after publish (allowed)` | Timing/settings only | P0 |
| `update_assignment: after publish (blocked)` | 400 for questions/type/score | P0 |
| `delete_assignment: no submissions` | Soft deleted | P0 |
| `delete_assignment: with submissions` | 400 ValidationError | P0 |
| `archive_assignment: with submissions` | Archived (soft delete) | P0 |
| `clone_assignment: full clone` | New draft, same questions, source_assignment_id set | P0 |

### 14.2 Unit Tests — Submission

| Test | Expected | Priority |
|------|----------|----------|
| `submit: valid homework` | Submission created, auto-graded MCQ/TF | P0 |
| `submit: quiz auto-graded` | All MCQ auto-graded, status = graded | P0 |
| `submit: revision auto-graded + results` | Graded, results published immediately | P0 |
| `submit: after due date (allowed)` | Accepted with late penalty applied | P0 |
| `submit: after due date (blocked)` | 400 (allow_late_submission = false) | P0 |
| `submit: duplicate` | 400 (already submitted) | P0 |
| `submit: timed assignment timer expired` | Auto-submitted, time_spent_seconds capped | P1 |
| `submit: student not in class` | 403 ForbiddenError | P0 |
| `submit: unpublished assignment` | 403 or 404 | P0 |
| `start: timed assignment` | Submission created with started_at | P0 |
| `start: resume timed assignment` | Returns existing started_at, time remaining | P1 |

### 14.3 Unit Tests — Grading

| Test | Expected | Priority |
|------|----------|----------|
| `grade: valid manual grade` | Scores saved, is_graded = true | P0 |
| `grade: score exceeds max points` | 400 ValidationError | P0 |
| `grade: return for revision` | Status = submitted, returned_at set | P0 |
| `grade: all auto-graded` | No manual grade needed | P0 |
| `grade: non-own assignment` | 403 ForbiddenError | P0 |
| `grade: already graded` | 400 (use override) | P0 |
| `override: admin valid` | Scores changed, audit logged | P0 |
| `override: without reason` | 422 (Zod validation) | P0 |
| `override: principal vs admin` | Principal requires reason, admin optional | P1 |
| `publish_results: no graded submissions` | 400 | P0 |
| `publish_results: valid` | Results visible to students | P0 |

### 14.4 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Create assignment → Add questions → Publish → Student views | Full flow works | P0 |
| Student submits → Teacher grades → Results published | Full submission-to-result flow | P0 |
| Teacher returns for revision → Student resubmits → Teacher re-grades | Resubmission flow | P0 |
| Parent views child's assignments and grades | Parent sees correct scoped data | P0 |
| Clone assignment → Verify new draft is independent | Clone has no linked submissions | P0 |
| Schedule assignment → Auto-publish at scheduled time | Published via cron | P1 |
| Late submission with penalty → Verify score capped | Penalty correctly applied | P0 |

### 14.5 Security Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student accesses assignment questions (before grading) | Correct_answer NOT returned | P0 |
| Student accesses assignment questions (after results published) | Correct_answer returned | P0 |
| Student accesses another student's submission | 403 or empty | P0 |
| Parent accesses non-child's grades | 403 or empty | P0 |
| Teacher grades non-own assignment | 403 | P0 |
| Student calls grade endpoint | 403 | P0 |
| Unauthenticated create | 401 | P0 |
| Teacher deletes assignment with submissions | 400 | P0 |
| Admin force-deletes with reason | Deleted, audited | P0 |
| Cross-school submission access | Empty or 403 | P0 |

### 14.6 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Load 50 assignments with submission status | <200ms (p95) | Cached query with pagination |
| Grade 30 submissions (batch) | <3s per batch | Sequential per-submission, batch answers |
| Student submit with 20 MCQ auto-grading | <500ms | Server-side batch auto-grade |
| Parent dashboard (3 children) | <500ms (p95) | Aggregated query, cached 60s |
| List all submissions for grading (50 students) | <300ms | Paginated, indexed |

---

## Appendix A: Error Codes

```typescript
export const ASSIGNMENT_ERROR_CODES = {
  // ─── Assignment ───────────────────────────────────────────
  ASN_400_01: { status: 400, message: 'Quiz assignments require duration_minutes' },
  ASN_400_02: { status: 400, message: 'Quiz assignments only support MCQs and True/False questions' },
  ASN_400_03: { status: 400, message: 'Project assignments only support file_upload and essay questions' },
  ASN_400_04: { status: 400, message: 'Homework assignments require a due date' },
  ASN_400_05: { status: 400, message: 'Cannot publish: assignment has no questions' },
  ASN_400_06: { status: 400, message: 'Cannot publish: max_score is not set' },
  ASN_400_07: { status: 400, message: 'Cannot edit [fields] after publishing' },
  ASN_400_08: { status: 400, message: 'Cannot delete: submissions exist. Archive instead.' },
  ASN_400_09: { status: 400, message: 'Cannot add/edit/delete questions after publishing' },
  ASN_400_10: { status: 400, message: 'Assignment is already published' },
  ASN_400_11: { status: 400, message: 'Cannot delete question: student answers exist. Archive instead.' },
  ASN_400_12: { status: 400, message: 'No graded submissions to publish results for' },
  ASN_400_13: { status: 400, message: 'Assignment due date has passed and late submission is not allowed' },
  ASN_400_14: { status: 400, message: 'Already submitted. Use resubmit if allowed.' },
  ASN_400_15: { status: 400, message: 'Max resubmissions reached' },
  ASN_400_16: { status: 400, message: 'Submission is already graded. Use override endpoint.' },
  ASN_400_17: { status: 400, message: 'Grade override requires a reason (min 20 characters)' },

  ASN_403_01: { status: 403, message: 'You do not teach this subject in this class' },
  ASN_403_02: { status: 403, message: 'You can only edit your own assignments' },
  ASN_403_03: { status: 403, message: 'Only the creator or admin can publish this assignment' },
  ASN_403_04: { status: 403, message: 'You can only grade submissions for your own assignments' },
  ASN_403_05: { status: 403, message: 'Assignment is not yet published' },
  ASN_403_06: { status: 403, message: 'This assignment is not for your class' },

  ASN_404_01: { status: 404, message: 'Assignment not found' },
  ASN_404_02: { status: 404, message: 'Question not found' },
  ASN_404_03: { status: 404, message: 'Submission not found' },
  ASN_404_04: { status: 404, message: 'Student profile not found' },
  ASN_404_05: { status: 404, message: 'Published assignment not found' },

  ASN_429_01: { status: 429, message: 'Too many submissions. Please wait 30 seconds.' },
} as const;
```

## Appendix B: Assignment Type Comparison

| Feature | Homework | Revision | Worksheet | Project | Quiz |
|---------|----------|----------|-----------|---------|------|
| Due date | ✅ Required | ❌ N/A | ⚠️ Optional | ✅ Required | ✅ Scheduled |
| Timing | Untimed | Untimed | Untimed | Long-term | ⏱️ Timed |
| Auto-grade | ⚠️ Partial | ✅ Full | ⚠️ Partial | ❌ No | ✅ Full |
| Resubmission | ✅ Configurable | ✅ Unlimited | ✅ Configurable | ⚠️ Max 2 | ❌ No |
| Late penalty | ⚠️ Configurable | ❌ N/A | ⚠️ Configurable | ⚠️ Configurable | ❌ No (timer) |
| File upload | ❌ | ❌ | ✅ | ✅ Required | ❌ |
| Question types | All | MCQ/TF/SA | All except quiz | Essay, file | MCQ/TF only |
| Results visibility | After teacher publishes | Immediate | After teacher publishes | After teacher grades | After timer (auto) |
| Teacher effort | Grade manually | Auto (review optional) | Grade manually | Rubric grading | Auto (review optional) |
| Best for | Daily HW | Self-practice | In-class work | Term projects | Timed exams |

## Appendix C: Notification Templates

```typescript
export const ASSIGNMENT_NOTIFICATION_TEMPLATES = {
  assignment_published: {
    student: {
      title: 'New Assignment: {{title}}',
      body: '{{type}} for {{subject}} is due {{due_date}}',
      channel: ['in_app', 'email'],
    },
  },
  submission_received: {
    teacher: {
      title: 'Submission Received',
      body: '{{student_name}} submitted "{{title}}"',
      channel: ['in_app'],
    },
  },
  submission_graded: {
    student: {
      title: 'Assignment Graded: {{title}}',
      body: 'You scored {{score}}/{{max_score}} ({{percentage}}%)',
      channel: ['in_app', 'email'],
    },
    parent: {
      title: 'Assignment Graded: {{title}}',
      body: '{{child_name}} scored {{score}}/{{max_score}} ({{percentage}}%)',
      channel: ['in_app', 'email'],
    },
  },
  results_published: {
    student: {
      title: 'Results Published: {{title}}',
      body: 'Your grades for "{{title}}" are now available',
      priority: 'high',
      channel: ['in_app', 'email'],
    },
    parent: {
      title: 'Results Published: {{title}}',
      body: '{{child_name}}\'s grades for "{{title}}" are available',
      priority: 'high',
      channel: ['in_app', 'email'],
    },
  },
  returned_for_revision: {
    student: {
      title: 'Returned for Revision: {{title}}',
      body: '{{reason}}',
      channel: ['in_app'],
    },
  },
  late_submission_reminder: {
    student: {
      title: 'Late Submission: {{title}}',
      body: 'Your submission for "{{title}}" is {{days_late}} day(s) late',
      channel: ['in_app'],
    },
  },
  weekly_overdue_summary: {
    parent: {
      title: 'Weekly Assignment Summary',
      body: '{{child_name}} has {{count}} overdue assignment(s)',
      channel: ['email'],
    },
  },
} as const;
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement module scaffolding, create migration for `assignment_type` ENUM, and begin API endpoint development
