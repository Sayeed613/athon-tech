# ATHON V2 — Assessments Module Implementation

**Reviewer**: Principal Software Architect  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026  
**References**: DATABASE_V2_FINAL.md · ASSIGNMENTS_MODULE_IMPLEMENTATION.md · CURRICULUM_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Folder Structure](#3-folder-structure)
4. [Schemas (Zod)](#4-schemas-zod)
5. [Services](#5-services)
6. [API Routes](#6-api-routes)
7. [Attempt Flow](#7-attempt-flow)
8. [Security Flow](#8-security-flow)
9. [Proctoring Architecture (Future)](#9-proctoring-architecture-future)
10. [Grading Workflow](#10-grading-workflow)
11. [Results & Analytics](#11-results--analytics)
12. [Permissions](#12-permissions)
13. [Edge Cases](#13-edge-cases)
14. [Risk Analysis](#14-risk-analysis)
15. [Testing Checklist](#15-testing-checklist)

---

## 1. Architecture Overview

### 1.1 Relationship to Assignments Module

Assessments (formal exams/tests) are built **on top of** the unified assignments infrastructure. They reuse `assignments`, `assignment_questions`, `submissions`, and `answers` tables — **not** as separate tables.

```
assignments.assignment_type IN ('unit_test', 'quiz')
         │
         ├── assessment_config        ← New: exam-specific settings
         │     (shuffle, show_results, negative_marking, etc.)
         │
         ├── question_pools            ← New: for randomized question selection
         │     (pool_name, selection_count, questions)
         │
         ├── submissions               ← Reuse: one per student per assessment
         │     (status, started_at, submitted_at, time_spent)
         │
         ├── answers                   ← Reuse: per-question student answers
         │
         └── assessment_proctoring_sessions  ← New (future): proctoring data
               (camera, mic, tab_switch, face_detection events)
```

### 1.2 Key Differentiators from Assignments

| Feature | Assignments (Module 7) | Assessments (Module 8) |
|---------|----------------------|------------------------|
| Timing | Duration optional, no strict timer | Fixed duration, auto-submit on expiry |
| Scheduling | Ad-hoc | Scheduled start + auto-release |
| Questions | Static, teacher-defined | Pools for random selection per student |
| Answer key | Hidden until results published | Hidden until assessment ends |
| Proctoring | None | Camera, mic, tab-switch (future) |
| Submission | Manual submit | Auto-submit on timeout + manual |
| Grading | Per-question flexible | Batch auto-grade (MCQ) + manual review |
| Results | Simple score | Detailed analytics, per-LO mastery, class stats |
| Retake | Via resubmission | Assessment attempts (configurable max) |
| Negative marking | ❌ | ✅ Configurable per assessment |

---

## 2. Database Schema

### 2.1 Tables

#### `assessment_config` — NEW: per-assessment extended settings

```sql
CREATE TABLE assessment_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id         UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    school_id             UUID NOT NULL REFERENCES schools(id),
    
    -- Scheduling
    scheduled_at          TIMESTAMPTZ NOT NULL,          -- When assessment opens
    duration_minutes      INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 300),
    late_cutoff_minutes   INTEGER DEFAULT 0,             -- Grace period for late start
    auto_submit_minutes   INTEGER,                        -- Auto-submit X min after duration (default = 0)
    
    -- Attempts
    max_attempts          INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 5),
    attempt_gap_minutes   INTEGER DEFAULT 0,              -- Min time between attempts
    
    -- Question selection
    shuffle_questions     BOOLEAN NOT NULL DEFAULT TRUE,
    shuffle_options       BOOLEAN NOT NULL DEFAULT TRUE,
    show_question_numbers BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Question pools (optional randomization)
    use_question_pools    BOOLEAN NOT NULL DEFAULT FALSE,
    questions_per_student INTEGER,                        -- If set, selects N questions from pools
    
    -- Navigation
    allow_backtracking    BOOLEAN NOT NULL DEFAULT FALSE, -- Can student revisit previous questions?
    show_progress_bar     BOOLEAN NOT NULL DEFAULT TRUE,
    show_timer            BOOLEAN NOT NULL DEFAULT TRUE,
    warn_at_minutes       INTEGER DEFAULT 5,              -- Warning when X minutes remaining
    
    -- Scoring
    passing_percentage    DECIMAL(5,2) NOT NULL DEFAULT 40.00,
    allow_negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
    negative_marking_pct  DECIMAL(5,2) DEFAULT 25.00,    -- % of question points deducted for wrong answer
    question_skipped_score DECIMAL(5,2) DEFAULT 0,        -- Score for skipped questions (usually 0)
    
    -- Results
    show_results_immediately BOOLEAN NOT NULL DEFAULT FALSE,
    show_results_after    TIMESTAMPTZ,                    -- Schedule results release
    show_correct_answers  BOOLEAN NOT NULL DEFAULT TRUE,  -- Show answer key in results
    show_answer_explanations BOOLEAN NOT NULL DEFAULT TRUE,
    show_per_question_score BOOLEAN NOT NULL DEFAULT TRUE,
    show_rank             BOOLEAN NOT NULL DEFAULT FALSE,   -- Show student's rank in class
    
    -- Proctoring (future)
    proctoring_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    camera_required       BOOLEAN NOT NULL DEFAULT FALSE,
    microphone_required   BOOLEAN NOT NULL DEFAULT FALSE,
    tab_switch_limit      INTEGER DEFAULT 3,               -- Max tab switches before flagged
    face_detection_required BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Features
    allow_file_upload     BOOLEAN NOT NULL DEFAULT FALSE,
    allow_scratchpad      BOOLEAN NOT NULL DEFAULT TRUE,
    allow_formulas        BOOLEAN NOT NULL DEFAULT FALSE,  -- Math formula editor
    allow_code_editor     BOOLEAN NOT NULL DEFAULT FALSE,  -- Code editor for CS exams
    
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(assignment_id)
);

CREATE INDEX idx_ac_school ON assessment_config(school_id);
CREATE INDEX idx_ac_scheduled ON assessment_config(scheduled_at) WHERE scheduled_at > NOW();
CREATE INDEX idx_ac_assignment ON assessment_config(assignment_id);
```

#### `question_pools` — NEW: For randomized question selection

```sql
CREATE TABLE question_pools (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id     UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    name              VARCHAR(200) NOT NULL,            -- "MCQ Pool", "Short Answer Pool"
    description       TEXT,
    pool_type         VARCHAR(30) NOT NULL,             -- 'fixed', 'random_select'
    selection_count   INTEGER,                           -- Number of questions to select (NULL = all)
    total_weightage   DECIMAL(6,2),                      -- Total marks for this pool
    sort_order        INTEGER NOT NULL DEFAULT 0,
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qp_assignment ON question_pools(assignment_id);
```

#### `pool_questions` — NEW: which questions belong to which pool

```sql
CREATE TABLE pool_questions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id           UUID NOT NULL REFERENCES question_pools(id) ON DELETE CASCADE,
    question_id       UUID NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    
    UNIQUE(pool_id, question_id)
);

CREATE INDEX idx_pq_pool ON pool_questions(pool_id);
CREATE INDEX idx_pq_question ON pool_questions(question_id);
```

#### `assessment_attempts` — NEW: tracks individual attempts per student

```sql
CREATE TABLE assessment_attempts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id     UUID NOT NULL REFERENCES assignments(id),
    student_id        UUID NOT NULL REFERENCES students(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    attempt_number    INTEGER NOT NULL CHECK (attempt_number >= 1),
    
    -- Timing
    started_at        TIMESTAMPTZ NOT NULL,
    submitted_at      TIMESTAMPTZ,
    auto_submitted_at TIMESTAMPTZ,                      -- When timer expired
    time_spent_seconds INTEGER,
    
    -- Question selection (for random pools)
    question_ids      UUID[],                            -- Order of questions presented to this student
    
    -- Status
    status            attempt_status NOT NULL DEFAULT 'in_progress'::attempt_status,
        -- in_progress: student is actively taking the assessment
        -- submitted: student manually submitted
        -- auto_submitted: timer expired, system submitted
        -- graded: all answers graded
        -- results_published: results visible to student
    
    -- Scoring
    total_score_auto  DECIMAL(8,2),                     -- Auto-graded total
    total_score_manual DECIMAL(8,2),                    -- Manually graded total
    total_score       DECIMAL(8,2),                     -- Computed total
    total_penalty     DECIMAL(8,2) DEFAULT 0,           -- Negative marking penalty
    net_score         DECIMAL(8,2),                     -- total_score - penalty
    is_passed         BOOLEAN,
    
    -- Grading
    is_graded         BOOLEAN NOT NULL DEFAULT FALSE,
    graded_by         UUID REFERENCES users(id),
    graded_at         TIMESTAMPTZ,
    
    -- Proctoring (future)
    proctoring_events_count INTEGER DEFAULT 0,
    proctoring_flagged      BOOLEAN NOT NULL DEFAULT FALSE,
    proctoring_reviewed_at  TIMESTAMPTZ,
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(assignment_id, student_id, attempt_number)
);

CREATE INDEX idx_aa_assignment ON assessment_attempts(assignment_id, status);
CREATE INDEX idx_aa_student ON assessment_attempts(student_id, created_at DESC);
CREATE INDEX idx_aa_grading ON assessment_attempts(assignment_id, status, created_at) WHERE status = 'submitted' OR status = 'auto_submitted';
```

#### `assessment_answers` — NEW: per-attempt, per-question answer tracking (extends `answers`)

```sql
CREATE TABLE assessment_answers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id        UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id       UUID NOT NULL REFERENCES assignment_questions(id),
    
    -- Student response
    submitted_answer  TEXT,
    is_skipped        BOOLEAN NOT NULL DEFAULT FALSE,
    answered_at       TIMESTAMPTZ,
    
    -- Auto-grading
    is_correct        BOOLEAN,
    score_auto        DECIMAL(6,2),
    
    -- Manual grading
    score_manual      DECIMAL(6,2),
    remarks           TEXT,
    graded_by         UUID REFERENCES users(id),
    graded_at         TIMESTAMPTZ,
    
    -- Final score (computed)
    score             DECIMAL(6,2),
    penalty           DECIMAL(6,2) DEFAULT 0,
    net_score         DECIMAL(6,2),
    
    -- Per-question timing
    time_spent_seconds INTEGER,                          -- How long student spent on this question
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_aaq_attempt ON assessment_answers(attempt_id, question_id);
CREATE INDEX idx_aaq_question ON assessment_answers(question_id);
```

#### `assessment_proctoring_events` — NEW (future): proctoring event log

```sql
CREATE TABLE assessment_proctoring_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id        UUID NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    event_type        VARCHAR(30) NOT NULL,
        -- tab_switch, tab_switch_duration, face_lost, face_multiple,
        -- microphone_noise, microphone_voice, camera_off,
        -- device_motion, keyboard_shortcut, copy_paste
    severity          VARCHAR(10) NOT NULL DEFAULT 'info',
        -- info, warning, violation, critical
    event_data        JSONB,                             -- Additional context
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ape_attempt ON assessment_proctoring_events(attempt_id);
CREATE INDEX idx_ape_severity ON assessment_proctoring_events(attempt_id, severity);
CREATE INDEX idx_ape_occurred ON assessment_proctoring_events(occurred_at);
```

### 2.2 ENUMs

```sql
-- Extend existing attempt_status ENUM (base values from V2: in_progress, submitted, graded, results_published)
-- 'auto_submitted' was added in M8
ALTER TYPE attempt_status ADD VALUE IF NOT EXISTS 'auto_submitted';

-- Pool type
CREATE TYPE pool_type AS ENUM ('fixed', 'random_select');

-- Proctoring event types
CREATE TYPE proctoring_event_type AS ENUM (
    'tab_switch', 'tab_switch_duration', 'face_lost', 'face_multiple',
    'microphone_noise', 'microphone_voice', 'camera_off',
    'device_motion', 'keyboard_shortcut', 'copy_paste'
);

ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:published';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:attempt_started';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:attempt_submitted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:attempt_auto_submitted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:graded';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:results_published';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:proctoring_flag';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'assessment:grade_overridden';
```

### 2.3 RLS Policies

```sql
-- assessment_config: inherited from assignment visibility
CREATE POLICY ac_teacher_manage ON assessment_config FOR ALL
  USING (assignment_id IN (SELECT id FROM assignments WHERE teacher_id = current_setting('app.current_teacher_id')::UUID));

CREATE POLICY ac_student_view ON assessment_config FOR SELECT
  USING (assignment_id IN (SELECT id FROM assignments WHERE is_published = TRUE AND class_id IN (
    SELECT class_id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID
  )));

-- assessment_attempts: student sees own; teacher sees own class's
CREATE POLICY aa_student_manage ON assessment_attempts FOR ALL
  USING (student_id = (SELECT id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID));

CREATE POLICY aa_teacher_view ON assessment_attempts FOR SELECT
  USING (assignment_id IN (SELECT id FROM assignments WHERE teacher_id = current_setting('app.current_teacher_id')::UUID));

-- Proctoring events: only teacher can view; system inserts
CREATE POLICY ape_teacher_view ON assessment_proctoring_events FOR SELECT
  USING (attempt_id IN (SELECT aa.id FROM assessment_attempts aa
    JOIN assignments a ON a.id = aa.assignment_id
    WHERE a.teacher_id = current_setting('app.current_teacher_id')::UUID
    OR current_setting('app.current_role') IN ('school_admin', 'principal')));
CREATE POLICY ape_insert ON assessment_proctoring_events FOR INSERT
  WITH CHECK (true);  -- System-trusted insert from client SDK
```

### 2.4 Materialized View: Assessment Performance

```sql
CREATE MATERIALIZED VIEW mv_assessment_performance AS
SELECT
    aa.assignment_id,
    aa.school_id,
    a.class_id,
    a.subject_id,
    COUNT(DISTINCT aa.student_id) AS total_students,
    COUNT(DISTINCT aa.student_id) FILTER (WHERE aa.is_passed = TRUE) AS passed_students,
    ROUND(AVG(aa.net_score)::NUMERIC, 2) AS avg_score,
    ROUND(AVG(aa.total_score)::NUMERIC, 2) AS avg_raw_score,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aa.net_score)::NUMERIC, 2) AS median_score,
    ROUND(STDDEV(aa.net_score)::NUMERIC, 2) AS std_dev,
    MIN(aa.net_score) AS min_score,
    MAX(aa.net_score) AS max_score,
    COUNT(*) FILTER (WHERE aa.status = 'in_progress') AS in_progress_count,
    COUNT(*) FILTER (WHERE aa.status = 'submitted' OR aa.status = 'auto_submitted') AS pending_grading_count,
    COUNT(*) FILTER (WHERE aa.status = 'graded') AS graded_count,
    MAX(aa.graded_at) AS last_graded_at
FROM assessment_attempts aa
JOIN assignments a ON a.id = aa.assignment_id
WHERE a.deleted_at IS NULL
GROUP BY aa.assignment_id, aa.school_id, a.class_id, a.subject_id;

CREATE UNIQUE INDEX idx_mv_ap_assignment ON mv_assessment_performance(assignment_id);
```

---

## 3. Folder Structure

```
src/modules/assessments/
├── assessments.service.ts                 # Business logic: create, publish, grade
├── assessment-attempt.service.ts          # Attempt flow: start, submit, auto-submit
├── assessment-grading.service.ts          # Grading: auto-grading, manual, partial
├── assessment-proctoring.service.ts      # Proctoring event handling (future)
├── assessment-results.service.ts          # Results, analytics, export
├── assessments.repository.ts             # Database access
├── assessments.validator.ts              # Zod schemas
├── assessments.router.ts                 # API route handlers
├── assessments.schema.ts                 # TypeScript types
├── assessment-timer.task.ts              # Background job: auto-submit expired timers
│
src/modules/assignments/
├── assignments.repository.ts             # Reused: assignment CRUD, questions
│
src/core/submissions/
├── auto-grader.service.ts                # Shared: MCQ/TF auto-grading logic
```

---

## 4. Schemas (Zod)

```typescript
// src/modules/assessments/assessments.validator.ts

import { z } from 'zod';

const UUID = z.string().uuid();

// ─── Assessment Config ──────────────────────────────────────

export const AssessmentConfigSchema = z.object({
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().min(5).max(300),
  late_cutoff_minutes: z.number().int().min(0).max(60).default(0),
  auto_submit_minutes: z.number().int().min(0).max(30).default(0),
  max_attempts: z.number().int().min(1).max(5).default(1),
  attempt_gap_minutes: z.number().int().min(0).max(1440).default(0),

  shuffle_questions: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  show_question_numbers: z.boolean().default(true),

  use_question_pools: z.boolean().default(false),
  questions_per_student: z.number().int().min(1).optional(),

  allow_backtracking: z.boolean().default(false),
  show_progress_bar: z.boolean().default(true),
  show_timer: z.boolean().default(true),
  warn_at_minutes: z.number().int().min(1).max(60).default(5),

  passing_percentage: z.number().min(0).max(100).default(40),
  allow_negative_marking: z.boolean().default(false),
  negative_marking_pct: z.number().min(0).max(100).default(25),

  show_results_immediately: z.boolean().default(false),
  show_results_after: z.string().datetime().optional(),
  show_correct_answers: z.boolean().default(true),
  show_answer_explanations: z.boolean().default(true),
  show_per_question_score: z.boolean().default(true),
  show_rank: z.boolean().default(false),

  proctoring_enabled: z.boolean().default(false),
  camera_required: z.boolean().default(false),
  microphone_required: z.boolean().default(false),
  tab_switch_limit: z.number().int().min(0).max(20).default(3),
  face_detection_required: z.boolean().default(false),

  allow_file_upload: z.boolean().default(false),
  allow_scratchpad: z.boolean().default(true),
  allow_formulas: z.boolean().default(false),
  allow_code_editor: z.boolean().default(false),
});

// ─── Question Pools ─────────────────────────────────────────

export const QuestionPoolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  pool_type: z.enum(['fixed', 'random_select']),
  selection_count: z.number().int().min(1).optional(),
  total_weightage: z.number().positive().optional(),
  sort_order: z.number().int().min(0).default(0),
  question_ids: z.array(UUID).min(1, 'At least one question required'),
});

export const BulkPoolSchema = z.object({
  pools: z.array(QuestionPoolSchema).min(1).max(10),
});

// ─── Create Assessment ──────────────────────────────────────

export const CreateAssessmentSchema = z.object({
  // Core assignment fields
  class_id: UUID,
  subject_id: UUID,
  academic_term_id: UUID,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  max_score: z.number().positive(),

  // Questions (traditional static)
  questions: z.array(z.object({
    question_text: z.string().min(1).max(2000),
    question_type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'long_answer', 'essay']),
    options: z.array(z.object({ label: z.string(), text: z.string() })).optional(),
    correct_answer: z.string().max(1000).optional(),
    explanation: z.string().max(2000).optional(),
    points: z.number().positive().default(1),
    lo_id: UUID.optional(),
    tags: z.array(z.string().max(20)).max(5).optional(),
  })).min(1).optional(),

  // Assessment config
  config: AssessmentConfigSchema,

  // Question pools (alternative to flat questions)
  pools: z.array(QuestionPoolSchema).max(10).optional(),
});

// ─── Update Assessment ──────────────────────────────────────

export const UpdateAssessmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  config: AssessmentConfigSchema.partial().optional(),
});

// ⚠️ Questions and pools cannot be updated once published.
// Create a new version instead.

// ─── Start Attempt ──────────────────────────────────────────

export const StartAttemptSchema = z.object({
  assessment_id: UUID,
  started_at: z.string().datetime().optional(),  // Server uses NOW()
});

// ─── Submit Answer (during attempt) ─────────────────────────

export const AssessmentAnswerSchema = z.object({
  question_id: UUID,
  submitted_answer: z.string().max(10000).optional(),
  is_skipped: z.boolean().default(false),
  time_spent_seconds: z.number().int().min(0).optional(),
  answered_at: z.string().datetime().optional(),
});

export const SaveProgressSchema = z.object({
  answers: z.array(AssessmentAnswerSchema),
});

// ─── Submit Attempt ─────────────────────────────────────────

export const SubmitAttemptSchema = z.object({
  answers: z.array(AssessmentAnswerSchema).min(1),
  time_spent_seconds: z.number().int().positive().optional(),
});

// ─── Grade ──────────────────────────────────────────────────

export const GradeAssessmentAnswerSchema = z.object({
  question_id: UUID,
  score_manual: z.number().min(0),
  remarks: z.string().max(500).optional(),
});

export const GradeAttemptSchema = z.object({
  answers: z.array(GradeAssessmentAnswerSchema).min(1),
  teacher_remarks: z.string().max(2000).optional(),
});

export const AutoGradeAttemptSchema = z.object({
  confirm_auto_grade: z.boolean(),  // Teacher must confirm auto-grade
});

// ─── Proctoring (future) ────────────────────────────────────

export const ProctoringEventSchema = z.object({
  event_type: z.enum([
    'tab_switch', 'tab_switch_duration', 'face_lost', 'face_multiple',
    'microphone_noise', 'microphone_voice', 'camera_off',
    'device_motion', 'keyboard_shortcut', 'copy_paste',
  ]),
  severity: z.enum(['info', 'warning', 'violation', 'critical']).default('info'),
  event_data: z.record(z.unknown()).optional(),
  occurred_at: z.string().datetime(),
});

// ─── Results ────────────────────────────────────────────────

export const PublishAssessmentResultsSchema = z.object({
  show_answers: z.boolean().default(true),
  show_explanations: z.boolean().default(true),
  show_rank: z.boolean().optional(),
  send_notification: z.boolean().default(true),
});

// ─── List / Query ───────────────────────────────────────────

export const AssessmentListQuerySchema = z.object({
  class_id: UUID.optional(),
  subject_id: UUID.optional(),
  status: z.enum(['scheduled', 'active', 'past']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const AttemptListQuerySchema = z.object({
  assessment_id: UUID.optional(),
  status: z.enum(['in_progress', 'submitted', 'graded', 'results_published']).optional(),
  graded: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

---

## 5. Services

### 5.1 Assessment Service

```typescript
// src/modules/assessments/assessments.service.ts

export class AssessmentsService {
  constructor(
    private readonly repo: AssessmentsRepository,
    private readonly attemptService: AssessmentAttemptService,
    private readonly gradingService: AssessmentGradingService,
    private readonly resultsService: AssessmentResultsService,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  // ════════════════════════════════════════════════════════════
  // CREATE ASSESSMENT
  // ════════════════════════════════════════════════════════════

  async createAssessment(
    ctx: RequestContext,
    input: CreateAssessmentInput,
  ): Promise<AssessmentResponse> {
    await this.authz.assert(ctx, 'assessments:create', { classId: input.class_id });

    // 1. Validate teacher teaches this class + subject
    const teacherClass = await this.repo.teacherTeachesSubjectInClass(
      ctx.profileId!, input.class_id, input.subject_id,
    );
    if (!teacherClass) {
      throw new ForbiddenError('You do not teach this subject in this class');
    }

    // 2. Create the base assignment record
    const assignment = await this.repo.createAssignment({
      school_id: ctx.schoolId,
      teacher_id: ctx.profileId!,
      class_id: input.class_id,
      subject_id: input.subject_id,
      academic_term_id: input.academic_term_id,
      assignment_type: 'unit_test',
      title: input.title.trim(),
      description: input.description ?? null,
      max_score: input.max_score,
      is_published: false,
    });

    // 3. Create assessment config
    await this.repo.createAssessmentConfig({
      assignment_id: assignment.id,
      school_id: ctx.schoolId,
      ...input.config,
    });

    // 4. Create questions (if provided)
    if (input.questions && input.questions.length > 0) {
      await this.repo.createQuestions(
        assignment.id,
        input.questions.map((q, i) => ({
          ...q,
          lo_id: q.lo_id ?? null,
          options: q.options ?? null,
          correct_answer: q.correct_answer ?? null,
          explanation: q.explanation ?? null,
          sort_order: i + 1,
          tags: q.tags ?? null,
        })),
      );
    }

    // 5. Create question pools (if provided)
    if (input.pools && input.pools.length > 0) {
      await this.repo.createPoolsWithQuestions(assignment.id, ctx.schoolId, input.pools);
    }

    await this.audit.log({
      eventType: 'assessment:created',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignment.id,
      details: {
        title: input.title,
        config: {
          duration: input.config.duration_minutes,
          scheduled: input.config.scheduled_at,
          pools: input.pools?.length ?? 0,
          questions: input.questions?.length ?? 0,
        },
      },
      outcome: 'success',
    });

    return this.mapAssessmentResponse(assignment);
  }

  // ════════════════════════════════════════════════════════════
  // PUBLISH ASSESSMENT
  // ════════════════════════════════════════════════════════════

  async publishAssessment(ctx: RequestContext, assignmentId: string): Promise<void> {
    await this.authz.assert(ctx, 'assessments:publish');

    const assignment = await this.repo.findAssignmentById(assignmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assessment not found');

    if (assignment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('Only the creator or admin can publish this assessment');
    }

    const config = await this.repo.findAssessmentConfig(assignmentId);
    if (!config) throw new ValidationError('Assessment configuration not found');

    // Validate assessment readiness
    const questionCount = await this.repo.getQuestionCount(assignmentId);
    if (questionCount === 0) {
      throw new ValidationError('Cannot publish an assessment with no questions');
    }
    if (!config.max_score && !assignment.max_score) {
      throw new ValidationError('Max score must be set before publishing');
    }
    if (new Date(config.scheduled_at) < new Date(Date.now() - 30000)) {
      // Allow 30s clock skew tolerance
      throw new ValidationError('Scheduled time must be in the future');
    }

    // Validate question pools have enough questions
    if (config.use_question_pools) {
      const pools = await this.repo.getPoolsWithQuestions(assignmentId);
      for (const pool of pools) {
        if (pool.pool_type === 'random_select' && pool.selection_count) {
          const availableCount = pool.questions?.length ?? 0;
          if (availableCount < pool.selection_count) {
            throw new ValidationError(
              `Pool "${pool.name}" has ${availableCount} questions but selection_count is ${pool.selection_count}. ` +
              'Add more questions to this pool or reduce the selection count before publishing.',
            );
          }
        }
      }
    }

    // Publish
    await this.repo.publishAssignment(assignmentId, {
      is_published: true,
      published_at: new Date().toISOString(),
    });

    // Schedule the assessment auto-open via cron if scheduled_at is in future
    const scheduledAt = new Date(config.scheduled_at);
    const delayMs = scheduledAt.getTime() - Date.now();
    if (delayMs > 0) {
      await this.eventBus.schedule('assessment:scheduled_open', {
        assignmentId,
        schoolId: ctx.schoolId,
      }, delayMs);
    }

    await this.audit.log({
      eventType: 'assessment:published',
      actorId: ctx.userId,
      resourceType: 'assignment',
      resourceId: assignmentId,
      details: { scheduledAt: config.scheduled_at },
      outcome: 'success',
    });

    // Notify students
    await this.eventBus.publish('assessment:published', { assignmentId, classId: assignment.class_id });
  }

  // ════════════════════════════════════════════════════════════
  // VIEW ACTIVE ASSESSMENTS (Student)
  // ════════════════════════════════════════════════════════════

  async getActiveAssessments(ctx: RequestContext): Promise<AssessmentResponse[]> {
    await this.authz.assert(ctx, 'assessments:view');

    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student) throw new NotFoundError('Student profile not found');

    const now = new Date().toISOString();
    const assessments = await this.repo.getActiveAssessmentsForClass(
      student.class_id, now,
    );

    const result = [];
    for (const a of assessments) {
      const config = await this.repo.findAssessmentConfig(a.id);
      if (!config) continue;

      // Check if student has remaining attempts
      const attempts = await this.repo.getAttemptCount(a.id, student.id);
      if (attempts >= config.max_attempts) continue;

      // Check if assessment is within scheduled window
      const scheduledAt = new Date(config.scheduled_at);
      const durationMs = config.duration_minutes * 60 * 1000;
      const lateCutoffMs = config.late_cutoff_minutes * 60 * 1000;
      const deadlineMs = scheduledAt.getTime() + durationMs;

      // Assessment is accessible after scheduled_at and before deadline + late cutoff
      if (now < config.scheduled_at) continue;  // Not yet open

      result.push(this.mapAssessmentForStudent(a, config, attempts));
    }

    return result;
  }
}
```

### 5.2 Attempt Service

```typescript
// src/modules/assessments/assessment-attempt.service.ts

export class AssessmentAttemptService {
  constructor(
    private readonly repo: AssessmentsRepository,
    private readonly autoGrader: AssessmentGradingService,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
  ) {}

  // ════════════════════════════════════════════════════════════
  // START ATTEMPT
  // ════════════════════════════════════════════════════════════

  async startAttempt(
    ctx: RequestContext,
    assessmentId: string,
  ): Promise<AssessmentAttemptResponse> {
    await this.authz.assert(ctx, 'assessments:attempt');

    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student) throw new NotFoundError('Student profile not found');

    const assignment = await this.repo.findPublishedAssignment(assessmentId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Assessment not found or not published');

    if (student.class_id !== assignment.class_id) {
      throw new ForbiddenError('This assessment is not for your class');
    }

    const config = await this.repo.findAssessmentConfig(assessmentId);
    if (!config) throw new NotFoundError('Assessment configuration not found');

    // Validate scheduling window
    const now = new Date();
    const scheduledAt = new Date(config.scheduled_at);
    if (now < scheduledAt) {
      throw new ValidationError('This assessment is not yet open');
    }

    const latestStartStr = config.late_cutoff_minutes
      ? new Date(scheduledAt.getTime() + config.late_cutoff_minutes * 60 * 1000).toISOString()
      : null;
    if (latestStartStr && now.toISOString() > latestStartStr) {
      throw new ValidationError('The late start window for this assessment has passed');
    }

    // Check max attempts
    const attemptCount = await this.repo.getAttemptCount(assessmentId, student.id);
    if (attemptCount >= config.max_attempts) {
      throw new ValidationError('Maximum number of attempts reached');
    }

    // Check gap between attempts
    if (attemptCount > 0 && config.attempt_gap_minutes > 0) {
      const lastAttempt = await this.repo.getLastAttempt(assessmentId, student.id);
      if (lastAttempt) {
        const gapMs = (now.getTime() - new Date(lastAttempt.submitted_at || lastAttempt.started_at).getTime());
        const gapMinutes = Math.floor(gapMs / 60000);
        if (gapMinutes < config.attempt_gap_minutes) {
          throw new ValidationError(
            `Please wait ${config.attempt_gap_minutes - gapMinutes} minute(s) before starting a new attempt`,
          );
        }
      }
    }

    // Determine question order
    let questionIds: string[];

    if (config.use_question_pools) {
      // Random selection from pools
      const pools = await this.repo.getPoolsWithQuestions(assessmentId);
      questionIds = this.selectQuestionsFromPools(pools, config.questions_per_student, student.id);
    } else {
      // All questions in configured order
      const questions = await this.repo.getAssignmentQuestions(assessmentId);
      questionIds = questions.map(q => q.id);

      if (config.shuffle_questions) {
        questionIds = this.shuffleArray(questionIds, student.id);
      }
    }

    // Create attempt
    const attempt = await this.repo.createAttempt({
      assignment_id: assessmentId,
      student_id: student.id,
      school_id: ctx.schoolId,
      attempt_number: attemptCount + 1,
      started_at: now.toISOString(),
      status: 'in_progress',
      question_ids: questionIds,
    });

    // Calculate deadline
    const deadlineMs = now.getTime() + config.duration_minutes * 60 * 1000;
    const deadline = new Date(deadlineMs);

    await this.audit.log({
      eventType: 'assessment:attempt_started',
      actorId: ctx.userId,
      resourceType: 'assessment_attempt',
      resourceId: attempt.id,
      details: {
        assignmentId: assessmentId,
        attemptNumber: attemptCount + 1,
        deadline: deadline.toISOString(),
      },
      outcome: 'success',
    });

    // Schedule auto-submit
    await this.scheduleAutoSubmit(attempt.id, deadline);

    return {
      attempt_id: attempt.id,
      attempt_number: attempt.attempt_number,
      started_at: now.toISOString(),
      deadline: deadline.toISOString(),
      duration_minutes: config.duration_minutes,
      question_ids: questionIds,
      shuffle_options: config.shuffle_options,
      allow_backtracking: config.allow_backtracking,
      show_progress_bar: config.show_progress_bar,
      show_timer: config.show_timer,
    };
  }

  // ════════════════════════════════════════════════════════════
  // SUBMIT ATTEMPT
  // ════════════════════════════════════════════════════════════

  async submitAttempt(
    ctx: RequestContext,
    attemptId: string,
    input: SubmitAttemptInput,
  ): Promise<AssessmentSubmitResponse> {
    await this.authz.assert(ctx, 'assessments:attempt');

    const attempt = await this.repo.findAttemptById(attemptId, ctx.schoolId);
    if (!attempt) throw new NotFoundError('Attempt not found');

    // Verify student owns this attempt
    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student || attempt.student_id !== student.id) {
      throw new ForbiddenError('This is not your attempt');
    }

    if (attempt.status !== 'in_progress') {
      throw new ValidationError('This attempt has already been submitted');
    }

    const assessment = await this.repo.findAssignmentById(attempt.assignment_id, ctx.schoolId);
    const config = await this.repo.findAssessmentConfig(attempt.assignment_id);

    // Save all answers
    for (const answer of input.answers) {
      const questionConfig = await this.repo.findQuestionById(answer.question_id);
      if (!questionConfig) continue;

      let isCorrect: boolean | null = null;
      let scoreAuto: number | null = null;

      // Auto-grade MCQ / True-False
      if (['multiple_choice', 'true_false'].includes(questionConfig.question_type)) {
        if (questionConfig.correct_answer) {
          isCorrect = (answer.submitted_answer ?? '').trim().toUpperCase() ===
            questionConfig.correct_answer.trim().toUpperCase();
          scoreAuto = isCorrect ? questionConfig.points : 0;
        }
      }

      // Negative marking
      let penalty = 0;
      if (config.allow_negative_marking && isCorrect === false) {
        penalty = questionConfig.points * (config.negative_marking_pct / 100);
      }

      const skipped = !answer.submitted_answer || answer.submitted_answer.trim() === '';

      await this.repo.upsertAssessmentAnswer({
        attempt_id: attemptId,
        question_id: answer.question_id,
        submitted_answer: answer.submitted_answer ?? '',
        is_skipped: skipped,
        answered_at: answer.answered_at ?? new Date().toISOString(),
        is_correct: isCorrect,
        score_auto: scoreAuto,
        score: (scoreAuto ?? 0) - penalty,
        penalty: penalty,
        net_score: (scoreAuto ?? 0) - penalty,
        time_spent_seconds: answer.time_spent_seconds ?? 0,
      });
    }

    // Compute totals
    const allAnswers = await this.repo.getAttemptAnswers(attemptId);
    let totalAutoScore = 0;
    let totalPenalty = 0;

    for (const ans of allAnswers) {
      totalAutoScore += (ans.score_auto ?? 0);
      totalPenalty += (ans.penalty ?? 0);
    }

    const netScore = Math.max(0, totalAutoScore - totalPenalty);
    const passingScore = assessment.max_score * (config.passing_percentage / 100);
    const isPassed = netScore >= passingScore;

    // Check if all questions are auto-gradable
    const questions = await this.repo.getAssignmentQuestions(attempt.assignment_id);
    const allAutoGradable = questions.every(q =>
      ['multiple_choice', 'true_false'].includes(q.question_type)
    );

    const submittedAt = new Date().toISOString();
    const isAutoSubmitted = false;

    if (allAutoGradable) {
      // Auto-grade complete — mark as graded
      await this.repo.updateAttempt(attemptId, {
        status: 'graded',
        submitted_at: submittedAt,
        time_spent_seconds: input.time_spent_seconds ?? 
          Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000),
        total_score_auto: totalAutoScore,
        total_score: totalAutoScore,
        total_penalty: totalPenalty,
        net_score: netScore,
        is_passed: isPassed,
        is_graded: true,
        graded_by: null,  // System-graded
        graded_at: submittedAt,
      });

      // Auto-publish results if configured
      if (config.show_results_immediately) {
        await this.repo.publishResults(attempt.assignment_id, {
          is_results_published: true,
          results_published_at: submittedAt,
        });
      }
    } else {
      // Manual grading needed — mark as submitted
      await this.repo.updateAttempt(attemptId, {
        status: 'submitted',
        submitted_at: submittedAt,
        time_spent_seconds: input.time_spent_seconds ??
          Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000),
        total_score_auto: totalAutoScore,                        total_penalty: totalPenalty,
                        net_score: Math.max(0, totalAutoScore - totalPenalty),
      });
    }

    await this.audit.log({
      eventType: 'assessment:attempt_submitted',
      actorId: ctx.userId,
      resourceType: 'assessment_attempt',
      resourceId: attemptId,
      details: {
        attemptNumber: attempt.attempt_number,
        isAutoGraded: allAutoGradable,
        netScore,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`attempt:${attemptId}`);

    const deadline = new Date(new Date(attempt.started_at).getTime() + config.duration_minutes * 60 * 1000);

    return {
      attempt_id: attemptId,
      submitted_at: submittedAt,
      is_auto_graded: allAutoGradable,
      is_passed: allAutoGradable ? isPassed : null,
      score: allAutoGradable ? netScore : null,
      max_score: assessment.max_score,
      total_questions: questions.length,
      answered_questions: allAnswers.filter(a => !a.is_skipped).length,
      time_spent_seconds: input.time_spent_seconds ?? 0,
      results_available: allAutoGradable && config.show_results_immediately,
    };
  }

  // ════════════════════════════════════════════════════════════
  // AUTO-SUBMIT ON TIMER EXPIRY (Called by scheduled job)
  // ════════════════════════════════════════════════════════════

  async autoSubmitExpiredAttempt(
    attemptId: string,
  ): Promise<void> {
    const attempt = await this.repo.findAttemptById(attemptId, '');
    if (!attempt || attempt.status !== 'in_progress') return;

    // Fetch config for negative marking settings (stored in assessment_config, not attempt)
    const config = await this.repo.findAssessmentConfig(attempt.assignment_id);

    // Force-submit with whatever answers exist
    const existingAnswers = await this.repo.getAttemptAnswers(attemptId);

    // Compute auto-scores for all answered questions
    const allQuestions = await this.repo.getAssignmentQuestions(attempt.assignment_id);
    let totalAutoScore = 0;
    let totalPenalty = 0;

    for (const answer of existingAnswers) {
      const question = allQuestions.find(q => q.id === answer.question_id);
      if (!question || !['multiple_choice', 'true_false'].includes(question.question_type)) continue;

      const isCorrect = (answer.submitted_answer ?? '').trim().toUpperCase() ===
        (question.correct_answer ?? '').trim().toUpperCase();
      const scoreAuto = isCorrect ? question.points : 0;
      const penalty = (config && !isCorrect && config.allow_negative_marking)
        ? question.points * (config.negative_marking_pct / 100)
        : 0;

      totalAutoScore += scoreAuto;
      totalPenalty += penalty;

      await this.repo.updateAssessmentAnswer(answer.id, {
        is_correct: isCorrect,
        score_auto: scoreAuto,
        score: Math.max(0, scoreAuto - penalty),
        penalty,
      });
    }

    // Mark as auto-submitted
    const autoSubmittedAt = new Date().toISOString();
    await this.repo.updateAttempt(attemptId, {
      status: 'auto_submitted',
      submitted_at: autoSubmittedAt,
      auto_submitted_at: autoSubmittedAt,
      time_spent_seconds: Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000),
      total_score_auto: totalAutoScore,                    total_penalty: totalPenalty,
                    net_score: Math.max(0, totalAutoScore - totalPenalty),
    });

    await this.audit.log({
      eventType: 'assessment:attempt_auto_submitted',
      actorId: attempt.student_id,
      resourceType: 'assessment_attempt',
      resourceId: attemptId,
      details: { reason: 'timer_expired' },
      outcome: 'success',
    });
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  private selectQuestionsFromPools(
    pools: QuestionPoolWithQuestions[],
    questionsPerStudent: number | undefined,
    seed: string,
  ): string[] {
    const selected: string[] = [];

    for (const pool of pools) {
      const questionIds = pool.questions.map(q => q.question_id);

      if (pool.pool_type === 'random_select' && pool.selection_count) {
        // Deterministic shuffle based on student ID for fairness
        const shuffled = this.shuffleArray(questionIds, seed + pool.id);
        selected.push(...shuffled.slice(0, pool.selection_count));
      } else {
        // Fixed pool — include all
        selected.push(...questionIds);
      }
    }

    // If questions_per_student is set, select subset from all pools
    if (questionsPerStudent && selected.length > questionsPerStudent) {
      // Ensure at least one question from each pool, then fill remaining
      const mandatory: string[] = [];
      const optional: string[] = [];

      for (const pool of pools) {
        const poolSelected = selected.filter(s =>
          pool.questions.some(pq => pq.question_id === s)
        );
        if (poolSelected.length > 0) {
          mandatory.push(poolSelected[0]);
          optional.push(...poolSelected.slice(1));
        }
      }

      const remaining = questionsPerStudent - mandatory.length;
      const shuffledOptional = this.shuffleArray(optional, seed);
      return [...mandatory, ...shuffledOptional.slice(0, Math.max(0, remaining))];
    }

    return selected;
  }

  private shuffleArray<T>(array: T[], seed: string): T[] {
    // Deterministic shuffle using seed for fairness
    const shuffled = [...array];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }

    for (let i = shuffled.length - 1; i > 0; i--) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      const j = hash % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async scheduleAutoSubmit(attemptId: string, deadline: Date): Promise<void> {
    const delayMs = deadline.getTime() - Date.now() + 5000; // +5s grace
    if (delayMs > 0) {
      await this.eventBus.schedule('assessment:auto_submit', { attemptId }, delayMs);
    }
  }
}
```

### 5.3 Grading Service

```typescript
// src/modules/assessments/assessment-grading.service.ts

export class AssessmentGradingService {
  constructor(
    private readonly repo: AssessmentsRepository,
    private readonly audit: AuditService,
    private readonly eventBus: EventBus,
  ) {}

  // ════════════════════════════════════════════════════════════
  // MANUAL GRADE ANSWER
  // ════════════════════════════════════════════════════════════

  async gradeAnswer(
    ctx: RequestContext,
    attemptId: string,
    input: GradeAssessmentAnswerInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'assessments:grade');

    const attempt = await this.repo.findAttemptById(attemptId, ctx.schoolId);
    if (!attempt) throw new NotFoundError('Attempt not found');

    const assessment = await this.repo.findAssignmentById(attempt.assignment_id, ctx.schoolId);
    if (!assessment || (assessment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin')) {
      throw new ForbiddenError('You can only grade assessments you created');
    }

    const answer = await this.repo.findAssessmentAnswer(attemptId, input.question_id);
    if (!answer) throw new NotFoundError('Answer not found');

    const question = await this.repo.findQuestionById(input.question_id);
    if (!question) throw new NotFoundError('Question not found');

    if (input.score_manual > question.points) {
      throw new ValidationError(
        `Score ${input.score_manual} exceeds max points (${question.points})`,
      );
    }

    const existingAutoScore = answer.score_auto ?? 0;
    const finalScore = input.score_manual;
    const netScore = finalScore - (answer.penalty ?? 0);

    await this.repo.updateAssessmentAnswer(answer.id, {
      score_manual: input.score_manual,
      score: finalScore,
      net_score: netScore,
      remarks: input.remarks ?? null,
      graded_by: ctx.userId,
      graded_at: new Date().toISOString(),
    });

    // Recompute attempt totals
    await this.recomputeAttemptTotals(attemptId);
  }

  // ════════════════════════════════════════════════════════════
  // GRADE ENTIRE ATTEMPT (Batch)
  // ════════════════════════════════════════════════════════════

  async gradeAttempt(
    ctx: RequestContext,
    attemptId: string,
    input: GradeAttemptInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'assessments:grade');

    const attempt = await this.repo.findAttemptById(attemptId, ctx.schoolId);
    if (!attempt) throw new NotFoundError('Attempt not found');

    const assessment = await this.repo.findAssignmentById(attempt.assignment_id, ctx.schoolId);
    if (!assessment || (assessment.teacher_id !== ctx.profileId && ctx.role !== 'school_admin')) {
      throw new ForbiddenError('You can only grade assessments you created');
    }

    if (attempt.status === 'graded' || attempt.status === 'results_published') {
      throw new ValidationError('This attempt is already graded. Use override endpoint.');
    }

    for (const grade of input.answers) {
      const answer = await this.repo.findAssessmentAnswer(attemptId, grade.question_id);
      if (!answer) continue;

      const question = await this.repo.findQuestionById(grade.question_id);
      if (!question) continue;

      if (grade.score_manual > question.points) {
        throw new ValidationError(
          `Score ${grade.score_manual} exceeds max points (${question.points}) for question ${grade.question_id}`,
        );
      }

      const existingAutoScore = answer.score_auto ?? 0;
      const finalScore = grade.score_manual;
      const netScore = finalScore - (answer.penalty ?? 0);

      await this.repo.updateAssessmentAnswer(answer.id, {
        score_manual: grade.score_manual,
        score: finalScore,
        net_score: netScore,
        remarks: grade.remarks ?? null,
        graded_by: ctx.userId,
        graded_at: new Date().toISOString(),
      });
    }

    // Recompute and finalize
    await this.recomputeAttemptTotals(attemptId);

    const config = await this.repo.findAssessmentConfig(attempt.assignment_id);
    const updatedAttempt = await this.repo.findAttemptById(attemptId, ctx.schoolId);
    const passingScore = assessment.max_score * (config.passing_percentage / 100);

    await this.repo.updateAttempt(attemptId, {
      status: 'graded',
      is_graded: true,
      graded_by: ctx.userId,
      graded_at: new Date().toISOString(),
      is_passed: (updatedAttempt.net_score ?? 0) >= passingScore,
    });

    await this.audit.log({
      eventType: 'assessment:graded',
      actorId: ctx.userId,
      resourceType: 'assessment_attempt',
      resourceId: attemptId,
      details: { score: updatedAttempt.net_score },
      outcome: 'success',
    });

    await this.eventBus.publish('assessment:attempt_graded', {
      attemptId,
      assignmentId: attempt.assignment_id,
    });
  }

  // ════════════════════════════════════════════════════════════
  // RECOMPUTE TOTALS
  // ════════════════════════════════════════════════════════════

  private async recomputeAttemptTotals(attemptId: string): Promise<void> {
    const answers = await this.repo.getAttemptAnswers(attemptId);
    let totalAutoScore = 0;
    let totalManualScore = 0;
    let totalPenalty = 0;

    for (const ans of answers) {
      totalAutoScore += (ans.score_auto ?? 0);
      totalManualScore += (ans.score_manual ?? 0);
      totalPenalty += (ans.penalty ?? 0);
    }

    // Final score = manual takes precedence over auto
    const totalScore = totalManualScore > 0 ? totalManualScore : totalAutoScore;
    const netScore = Math.max(0, totalScore - totalPenalty);

    await this.repo.updateAttempt(attemptId, {
      total_score: totalScore,
      total_score_auto: totalAutoScore,
      total_score_manual: totalManualScore,
      total_penalty: totalPenalty,
      net_score: netScore,
    });
  }
}
```

---

## 6. API Routes

### 6.1 POST /assessments — Create assessment

```
POST /assessments
Role: teacher, school_admin
Request: CreateAssessmentSchema
Response: 201 { data: AssessmentResponse }
Errors: 400 (validation), 403 (not teaching class), 422
```

### 6.2 GET /assessments — List assessments

```
GET /assessments?class_id=...&subject_id=...&status=...&page=1&limit=20
Role: teacher (own), school_admin (all), student (active), principal (all)
```

### 6.3 GET /assessments/{id} — Get assessment detail

```
GET /assessments/{id}
Role: teacher (own), school_admin, student (own class, published)
Response: 200 { data: AssessmentResponse with config }
```

### 6.4 PATCH /assessments/{id} — Update assessment

```
PATCH /assessments/{id}
Role: teacher (own, draft only), school_admin
Request: UpdateAssessmentSchema
```

### 6.5 POST /assessments/{id}/publish — Publish assessment

```
POST /assessments/{id}/publish
Role: teacher (own), school_admin
Errors: 400 (no questions, past scheduled_at, no config)
```

### 6.6 POST /assessments/{id}/attempts/start — Start attempt

```
POST /assessments/{id}/attempts/start
Role: student
Response: 200 {
  attempt_id: UUID,
  attempt_number: number,
  deadline: ISO8601,
  duration_minutes: number,
  question_ids: UUID[],
  shuffle_options: boolean,
  allow_backtracking: boolean,
  show_progress_bar: boolean,
  show_timer: boolean
}
Errors: 400 (not yet open, max attempts reached, gap period)
```

### 6.7 POST /assessments/attempts/{id}/save — Save progress (during attempt)

```
POST /assessments/attempts/{id}/save
Role: student (own)
Request: { answers: AssessmentAnswerSchema[] }
Response: 200 { saved_at: ISO8601, answers_saved: number }
```

### 6.8 POST /assessments/attempts/{id}/submit — Submit attempt

```
POST /assessments/attempts/{id}/submit
Role: student (own)
Request: SubmitAttemptSchema
Response: 200 {
  attempt_id, submitted_at, is_auto_graded, is_passed,
  score, max_score, total_questions, answered_questions,
  time_spent_seconds, results_available
}
```

### 6.9 GET /assessments/attempts/{id} — Get attempt detail (student/teacher)

```
GET /assessments/attempts/{id}
Role: student (own), teacher (own), school_admin
Response: 200 { data: AttemptDetailResponse }
Errors: 404

For students: includes answers but NOT correct_answer unless results published.
For teachers: includes correct_answer and all grading details.
```

### 6.10 GET /assessments/{id}/attempts — List attempts (teacher)

```
GET /assessments/{id}/attempts?status=...&graded=...&page=1&limit=50
Role: teacher (own), school_admin
```

### 6.11 POST /assessments/attempts/{id}/grade-answer — Grade single answer

```
POST /assessments/attempts/{id}/grade-answer
Role: teacher (own), school_admin
Request: { question_id: UUID, score_manual: number, remarks?: string }
```

### 6.12 POST /assessments/attempts/{id}/grade — Grade entire attempt

```
POST /assessments/attempts/{id}/grade
Role: teacher (own), school_admin
Request: GradeAttemptSchema
```

### 6.13 POST /assessments/{id}/publish-results — Publish results

```
POST /assessments/{id}/publish-results
Role: teacher (own), school_admin
Request: PublishAssessmentResultsSchema
Errors: 400 (no graded attempts)
```

### 6.14 GET /assessments/{id}/results — Get results summary (teacher)

```
GET /assessments/{id}/results
Role: teacher (own), school_admin
Response: AssessmentResultsSummary
```

### 6.15 GET /assessments/attempts/{id}/results — Get attempt results (student)

```
GET /assessments/attempts/{id}/results
Role: student (own)
Response: {
  score, max_score, percentage, is_passed, rank,
  total_questions, correct_count, incorrect_count, skipped_count,
  time_spent_seconds, questions: Array<{...}>
}
```

### 6.16 POST /assessments/{id}/override-grade — Override entire grade (admin)

```
POST /assessments/{id}/override-grade
Role: school_admin, principal (with reason)
Request: { reason: string, attempt_id: UUID, answers: GradeAssessmentAnswerSchema[] }
```

### 6.17 POST /assessments/proctoring/events — Proctoring event (future)

```
POST /assessments/proctoring/events
Role: student (own attempt)
Request: ProctoringEventSchema
Response: 201
```

### 6.18 GET /assessments/attempts/{id}/proctoring — Proctoring report (future)

```
GET /assessments/attempts/{id}/proctoring
Role: teacher (own), school_admin
Response: ProctoringReport
```

### 6.19 POST /assessments/{id}/clone — Clone assessment

```
POST /assessments/{id}/clone
Role: teacher, school_admin
Request: { title?: string, scheduled_at?: ISO8601 }
Response: 201 { data: AssessmentResponse }

Clones: assignment, config, questions, pools. New assessment starts as draft.
```

### 6.20 PATCH /assessments/{id}/settings — Update assessment config only

```
PATCH /assessments/{id}/settings
Role: teacher (own, draft only), school_admin
Request: AssessmentConfigSchema.partial()
Response: 200 { data: AssessmentConfigResponse }

Updates only assessment_config fields. Does NOT affect assignment-level fields.
Cannot update settings after assessment is published.
Errors: 400 (assessment is published)
```

### 6.21 POST /assessments/{id}/reopen — Reopen assessment for additional attempts

```
POST /assessments/{id}/reopen
Role: teacher (own), school_admin
Request: { 
  reason: string,          // Required, min 10 chars
  new_deadline?: ISO8601,  // New submission deadline
  additional_attempts?: 1  // How many extra attempts to grant (default: 1)
}
Response: 200 { data: { attempts_reset: number, new_deadline: ISO8601 } }

Resets all 'in_progress' attempts (for unresponsive students) or grants extra attempts.
Audit: assessment:reopened with reason.
Errors: 400 (no reason), 400 (assessment still active), 422
```

---

## 7. Attempt Flow

### 7.1 Complete Attempt Lifecycle

```
                    ┌───────────────────────┐
                    │  ASSESSMENT SCHEDULED │
                    │  (is_published=false)  │
                    └───────────┬───────────┘
                                │ Publish + scheduled_at arrives
                                ▼
                    ┌───────────────────────┐
                    │  ASSESSMENT ACTIVE    │
                    │  (is_published=true)  │
                    │  (within time window) │
                    └───────────┬───────────┘
                                │ Student starts
                                ▼
    ┌──────────────────────────────────────────────────────┐
    │                  ATTEMPT IN PROGRESS                   │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐│
    │  │ Answer 1 │→│ Answer 2 │→│ Answer 3 │→│  ...   ││
    │  └──────────┘  └──────────┘  └──────────┘  └────────┘│
    │  Timer counting down...  Auto-save every 30s         │
    └───────────────────────┬──────────────────────────────┘
                            │
              ┌─────────────┼─────────────────┐
              ▼             ▼                  ▼
    ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
    │ MANUAL       │ │ TIMER EXPIRES│  │ AUTO-SAVE    │
    │ SUBMIT       │ │ (Auto-submit)│  │ (still in    │
    │              │ │              │  │  progress)   │
    └──────┬───────┘ └──────┬───────┘  └──────┬───────┘
           │                │                  │
           └────────────────┼──────────────────┘
                            ▼
           ┌─────────────────────────────────────┐
           │        SUBMITTED / AUTO_SUBMITTED    │
           │  (pending grading)                   │
           └──────────────────┬──────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼              ▼
        ┌────────────┐ ┌────────────┐ ┌──────────────┐
        │ AUTO-      │ │ MANUAL     │ │ PARTIAL      │
        │ GRADED     │ │ GRADED     │ │ (some auto,  │
        │ (all MCQ)  │ │ (all essay)│ │  some manual)│
        └──────┬─────┘ └──────┬─────┘ └──────┬───────┘
               │              │               │
               └──────────────┼───────────────┘
                              ▼
              ┌────────────────────────────────┐
              │           GRADED               │
              │  status='graded', is_graded=true│
              └────────────────┬───────────────┘
                              │ Teacher publishes results
                              ▼
              ┌────────────────────────────────┐
              │      RESULTS PUBLISHED         │
              │  status='results_published'    │
              │  Student sees scores + answers  │
              └────────────────────────────────┘
```

### 7.2 Timer Management

```
Student starts assessment:
  → Attempt created with started_at = NOW()
  → Deadline = started_at + duration_minutes
  → Timer displayed in UI (config.show_timer)

During attempt:
  → Answers auto-saved every 30 seconds via POST /save
  → Timer synced with server every 60 seconds
  → Client-side timer for responsiveness
  → Server-side authoritative timer for auto-submit

Warning at config.warn_at_minutes before deadline:
  → UI shows warning banner
  → Optional: submit button becomes more prominent

Timer expires:
  → Server-side job fires (scheduled on attempt start)
  → Force-submit with whatever answers exist
  → Status = 'auto_submitted'
  → Student notified: "Your assessment was auto-submitted"

Late submission handling:
  → Assessment ends at deadline (no late submission for timed tests)
  → Exception: config.late_cutoff_minutes allows grace period for STARTING late
  → Once started, duration is fixed regardless of start time
```

### 7.3 Save Progress (Auto-Save)

```
POST /assessments/attempts/{id}/save
→ Called by client every 30 seconds
→ Also called on question change
→ Also called on tab close (beforeunload)
→ Saves answers without changing status
→ Does NOT trigger auto-grading
→ Does NOT notify teacher
→ Response includes server time for timer sync

Edge case: network failure during save
→ Answers kept in localStorage
→ Resubmitted on reconnect
→ If submit happens before reconnect, lost answers count as skipped
```

### 7.4 Multiple Attempts

```
Assessment with max_attempts > 1:
  → Student completes first attempt → sees result (if configured)
  → Attempt gap timer starts (config.attempt_gap_minutes)
  → After gap, student can start next attempt
  → Best score is recorded (highest net_score)
  → Each attempt has independent question selection (if pools)

Scoring with multiple attempts:
  → Each attempt graded independently
  → Best score displayed in dashboard
  → Teacher sees all attempts
  → Principal sees best score only
```

---

## 8. Security Flow

### 8.1 Answer Key Protection (Critical)

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Database Views                                        │
│                                                                  │
│  v_assessment_questions_student:                                 │
│    SELECT id, question_text, question_type, options, points,     │
│           sort_order                                             │
│    FROM assignment_questions                                     │
│    -- correct_answer, explanation are NEVER sent                 │
│                                                                  │
│  v_assessment_questions_teacher:                                 │
│    SELECT * FROM assignment_questions                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: API Filtering                                          │
│                                                                  │
│  Student GET /assessments/{id}/attempts/{id}:                    │
│    - Returns questions WITHOUT correct_answer                   │
│    - Returns answers WITHOUT is_correct                          │
│    - Only if status = 'in_progress' OR 'submitted'              │
│                                                                  │
│  Student GET /assessments/attempts/{id}/results:                 │
│    - Only available if is_results_published = TRUE               │
│    - Shows correct_answer, explanation, is_correct              │
│    - Shows per-question score                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Role Enforcement (Service)                             │
│                                                                  │
│  Teacher: sees all question data via teacher endpoints           │
│  Student: sees filtered question data via student endpoints      │
│  Parent: sees results only (no questions)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Timing Enforcement

```
┌─────────────────────────────────────────────────────────────────┐
│  ALL TIMING IS AUTHORITATIVE ON SERVER                           │
│                                                                  │
│  Client timer:  Display only, for user experience               │
│  Server timer:  Enforces deadline, triggers auto-submit          │
│  Timer sync:    Client calls GET /attempts/{id} to sync timer   │
│                 Difference > 5s → server time is authorative    │
│                                                                  │
│  Student cannot bypass timer by:                                 │
│  - Changing system clock  → Server time, not client time        │
│  - Refreshing page       → Timer continues server-side          │
│  - Opening new tab       → Timer continues server-side          │
│  - Browser crash         → Timer continues server-side          │
│  - Network disconnect    → Timer continues, sync on reconnect   │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Anti-Cheating Measures

| Measure | Implementation | Severity |
|---------|---------------|----------|
| **No backtracking** | Client-side + server-side enforced. Once question is submitted, cannot go back. | High |
| **Shuffled questions** | Deterministic shuffle per student (seeded by student_id). Same pool, different order per student. | Medium |
| **Shuffled options** | MCQ options shuffled per student in browser (but correct_answer stored in order). | Medium |
| **Question pool randomization** | Different students get different questions from the pool | High |
| **Fixed attempt window** | All students see the same scheduled time. Late start penalizes study time. | Medium |
| **IP logging** | Every attempt logs IP address of submit. Compare with student's usual IP. | Low |
| **Answer key protection** | 3 layers: DB views, API filtering, role enforcement | Critical |
| **Proctoring (future)** | Camera, microphone, tab-switch detection | Critical |

### 8.4 Answer Key Release Schedule

```
┌─────────────────────────────────────────────────────────────────┐
│  WHEN IS correct_answer VISIBLE TO STUDENT?                     │
│                                                                  │
│  Before attempt:    ❌ Not visible                               │
│  During attempt:    ❌ Not visible                               │
│  After submit:      ❌ Not visible (pending grading)             │
│  After grading:     ⚠️ Only if config.show_results_immediately  │
│  Results published: ✅ Visible (with explanation)               │
│                                                                  │
│  Exception: config.show_correct_answers = false                  │
│  → Even after results published, correct_answer is hidden       │
│  → Student sees only score, not correct answer                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Proctoring Architecture (Future)

### 9.1 Design Principles

The proctoring system follows these principles:

1. **Privacy-first**: All proctoring data stays on the student's device. Only events are sent to the server.
2. **Transparent**: Students are informed about what is being monitored before the assessment starts.
3. **Fair**: Proctoring flags are advisory — teachers review flagged attempts, not auto-fail.
4. **Offline-resilient**: Proctoring works offline; events are batched and sent on reconnect.
5. **Consent-based**: Students must consent to proctoring before starting the attempt.

### 9.2 Event Types

| Event Type | Source | Description | Severity |
|-----------|--------|-------------|----------|
| `tab_switch` | Browser | Student switched away from assessment tab | warning |
| `tab_switch_duration` | Browser | How long student was away (seconds) | info → violation |
| `face_lost` | Camera | Student's face left camera frame | warning |
| `face_multiple` | Camera | Multiple faces detected in frame | critical |
| `microphone_noise` | Microphone | Unusual noise detected | info |
| `microphone_voice` | Microphone | Speech detected (potential collusion) | violation |
| `camera_off` | Camera | Camera was turned off during assessment | critical |
| `device_motion` | Accelerometer | Device picked up / moved (mobile) | info |
| `keyboard_shortcut` | Browser | Suspicious keyboard shortcuts (Ctrl+C) | warning |
| `copy_paste` | Browser | Copy/paste detected in restricted fields | violation |

### 9.3 Data Flow

```
┌──────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Student Device  │         │   Athon API       │         │   Teacher View   │
│                   │         │                   │         │                  │
│  Proctoring SDK   │  POST   │  Store events     │  GET    │  Review flagged  │
│  ┌─────────────┐  │────────►│  ┌─────────────┐  │────────►│  attempts        │
│  │ Tab switch  │  │         │  │ proctoring_  │  │         │  with timeline   │
│  │ detection   │  │         │  │ events table │  │         │  of events       │
│  ├─────────────┤  │         │  └─────────────┘  │         │                  │
│  │ Face        │  │         │                   │         │  Actions:        │
│  │ detection   │  │         │  ┌─────────────┐  │         │  - Flag attempt  │
│  ├─────────────┤  │         │  │ Aggregate    │  │         │  - Void attempt  │
│  │ Microphone  │  │         │  │ severity     │  │         │  - Discount      │
│  │ monitoring  │  │         │  │ per attempt  │  │         │    marks         │
│  ├─────────────┤  │         │  └─────────────┘  │         │  - Allow         │
│  │ Event buffer│  │         │                   │         │    (false flag)  │
│  └─────────────┘  │         └───────────────────┘         └─────────────────┘
│                   │
│  Events batched   │
│  every 10 seconds │
│  or on reconnect  │
└──────────────────┘
```

### 9.4 Thresholds & Auto-Flagging

```
Assessment config proctoring thresholds:

Tab switch limit: 3 (default)
  → After 3 tab switches, flag as 'violation'
  → After 5 tab switches, attempt auto-flagged

Face lost duration: 10s (default)
  → < 5s: info
  → 5-30s: warning
  → > 30s: violation

Multiple faces: 1 event = critical
  → Any detection of multiple faces flags attempt

Camera off: 1 event = critical
  → Camera off during assessment = auto-flag

Copy/paste in restricted fields: 1 event = violation
```

### 9.5 Teacher Review Workflow

```
1. Teacher opens proctoring dashboard for an assessment
2. Sees list of attempts sorted by:
   - Flagged attempts first (red)
   - Warning attempts next (yellow)
   - Clean attempts last (green)
3. Clicks on an attempt to see timeline of events
4. Reviews events with timestamps
5. Actions:
   - "Allow" — marks as false flag, clears warning
   - "Void" — voids the attempt, student must retake
   - "Discount Marks" — applies penalty to flagged questions
   - "Flag for Review" — keeps flag for principal review
```

---

## 10. Grading Workflow

### 10.1 Auto-Grading Flow (All MCQ/TF)

```
Student submits → All answers checked against correct_answer
  → Each MCQ/TF: is_correct = (submitted === correct)
  → score_auto = is_correct ? points : 0
  → Negative marking: penalty = wrong ? points * negative_marking_pct/100 : 0
  → net_score = score_auto - penalty
  → total = SUM(net_score)
  → is_passed = total >= max_score * passing_percentage/100
  → Status = 'graded', is_graded = true
  → Auto-publish if show_results_immediately
```

### 10.2 Manual Grading Flow (Essays / Long Answer)

```
Student submits → All MCQ/TF auto-graded
  → Status = 'submitted' (pending manual grading)
  → Teacher opens grading queue
  → Teacher sees essay answers without auto-score
  → Teacher assigns score_manual per question
  → System computes total, is_passed
  → Status = 'graded'
  → Teacher publishes results
```

### 10.3 Mixed Grading Flow (MCQ + Essay)

```
Student submits → MCQ/TF auto-graded with is_correct
  → Essay answers saved, no auto-score
  → Status = 'submitted'
  → Teacher grades essay questions manually
  → System combines auto + manual scores
  → total = total_score_auto + total_score_manual
  → Status = 'graded'
```

### 10.4 Score Computation

```typescript
// Per-question score computation:
// If answer is skipped (no answer):
//   score = config.question_skipped_score (usually 0)
//   penalty = 0
//
// If answer exists:
//   If auto-gradable (MCQ/TF):
//     is_correct = submitted_answer === correct_answer
//     score_auto = is_correct ? points : 0
//     penalty = (!is_correct && config.allow_negative_marking)
//               ? points * config.negative_marking_pct / 100 : 0
//     score = score_auto - penalty
//   If manual-grade (essay/long_answer):
//     score = score_manual (teacher assigns)
//     penalty = 0 (no negative marking for manual grade)

// Attempt total:
// total_score = SUM(score_auto) + SUM(score_manual)
// total_penalty = SUM(penalty)
// net_score = MAX(0, total_score - total_penalty)
// is_passed = (net_score / max_score * 100) >= passing_percentage
```

### 10.5 Grade Override

```
Trigger: Admin or principal needs to change a grade

Admin override:
  → POST /assessments/{id}/override-grade
  → reason required (min 10 chars)
  → old_data snapshot saved
  → new scores applied
  → Audit log with before/after
  → Teacher notified

Principal override:
  → Same as admin but limited to own school
  → reason required (min 20 chars)
  → Teacher notified with reason

Constraints:
  → Cannot override published results (must unpublish first)
  → Cannot override grade more than 30 days old
  → All overrides logged permanently
```

---

## 11. Results & Analytics

### 11.1 Teacher Results Dashboard

```
GET /assessments/{id}/results

Response: {
  assessment: { title, max_score, passing_percentage, ... },
  config: { show_correct_answers, show_rank, ... },

  summary: {
    total_students: 40,
    attempted: 38,
    not_attempted: 2,
    passed: 28,
    failed: 10,
    pass_percentage: 73.7,

    avg_score: 68.5,
    median_score: 72.0,
    std_dev: 15.3,
    min_score: 22.0,
    max_score: 98.0,

    avg_time_spent: 42,  // minutes
    auto_submitted_count: 3,  // Timer expired
    proctoring_flagged: 1,    // Future
  },

  score_distribution: [
    { range: "0-20", count: 1 },
    { range: "21-40", count: 4 },
    { range: "41-60", count: 8 },
    { range: "61-80", count: 15 },
    { range: "81-100", count: 10 },
  ],

  per_question_analysis: [
    {
      question_id: UUID,
      question_text: "What is photosynthesis?",
      question_type: "multiple_choice",
      points: 2,
      correct_count: 30,
      incorrect_count: 8,
      skipped_count: 0,
      accuracy_pct: 78.9,
      avg_time_spent_seconds: 45,
    },
    ...
  ],

  students: [
    {
      student_id: UUID,
      student_name: "Aarav Sharma",
      attempt_number: 1,
      score: 85,
      percentage: 85,
      is_passed: true,
      rank: 5,
      time_spent: 38, // minutes
      status: "graded",
      proctoring_flagged: false,
    },
    ...
  ],
}
```

### 11.2 Student Results View

```
GET /assessments/attempts/{id}/results

Response: {
  student_name: "Aarav Sharma",
  assessment_title: "Science Unit Test 1",
  class: "7A",
  subject: "Science",
  attempt_number: 1,
  max_attempts: 2,

  score: 85,
  max_score: 100,
  percentage: 85.0,
  is_passed: true,
  is_best_attempt: true,

  rank: 5,          // Only if config.show_rank
  total_students: 38,

  stats: {
    total_questions: 20,
    correct_count: 15,
    incorrect_count: 3,
    skipped_count: 2,
    unanswered_count: 0,
    accuracy: 75,
  },

  time_spent_minutes: 38,
  submitted_at: "2026-06-15T10:38:00Z",
  status: "graded",

  questions: [
    {
      question_id: UUID,
      question_text: "What is photosynthesis?",
      question_type: "multiple_choice",
      points: 5,
      submitted_answer: "A",
      is_correct: true,
      score: 5,
      explanation: "Photosynthesis is the process...", // if enabled
      correct_answer: "A", // if enabled
      answered_at: "2026-06-15T10:02:00Z",
      time_spent_seconds: 45,
    },
    ...
  ],

  proctoring_summary: { // Future
    tab_switches: 1,
    face_lost_events: 0,
    flagged: false,
  },
}
```

### 11.3 Auto-Publish Schedule

```
Three modes for results publishing:

1. Immediate (show_results_immediately = true):
   → Results visible as soon as attempt is graded
   → For fully auto-graded assessments: instant
   → For manual grading: when teacher grades

2. Scheduled (show_results_after set):
   → Example: "Show results at 2026-06-16T14:00:00Z"
   → Even if all graded early, results hidden until scheduled time
   → Auto-publishes via cron job at scheduled time

3. Manual (default):
   → Teacher publishes results via POST /publish-results
   → Teacher reviews all grades first
   → Best for exams where teacher wants to review distribution first
```

---

## 12. Permissions

### 12.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create assessment | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Edit assessment | ✅ | ❌ | 🔷 (own, draft) | ❌ | ❌ |
| Publish assessment | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| View assessment list | ✅ | ✅ | 🔷 (own) | 🔷 (active) | ❌ |
| View assessment detail | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| Start attempt | ❌ | ❌ | ❌ | 🔷 (own) | ❌ |
| Submit attempt | ❌ | ❌ | ❌ | 🔷 (own) | ❌ |
| View own attempt | ❌ | ❌ | ❌ | 🔷 (own) | ❌ |
| View all attempts | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |
| Auto-grade | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Manual grade | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Override grade | 🔶 | 🔶 | ❌ | ❌ | ❌ |
| Publish results | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| View results (teacher) | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |
| View results (student) | ❌ | ❌ | ❌ | 🔷 (own) | 🔷 (children) |
| View proctoring events | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |

### 12.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher creates assessments for own classes | `teacher_class_subjects` check |
| Teacher cannot edit published assessments | `is_published` guard |
| Student can only attempt published assessments for own class | `student.class_id` match |
| Student can only see correct_answer after results published | `is_results_published` guard |
| Student has max N attempts per assessment | `config.max_attempts` check |
| Teacher grades only own assessments | `assignment.teacher_id` check |
| Grade override requires written reason | Zod validation (min 10 chars) |
| Proctoring events only visible to teacher | RLS on `assessment_proctoring_events` |
| Parent views child's results only | `student_parents` join |

### 12.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'assessments:create', { classId });
await this.authz.assert(ctx, 'assessments:publish');
await this.authz.assert(ctx, 'assessments:attempt');     // Student only
await this.authz.assert(ctx, 'assessments:grade');       // Teacher + scope
await this.authz.assert(ctx, 'assessments:view_results'); // Role-dependent
```

---

## 13. Edge Cases

### 13.1 Scheduling & Timing Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Student starts 1 minute before deadline** | Allowed if within late_cutoff_minutes. Full duration granted. Deadline = start_time + duration. |
| 2 | **Student's clock is 5 minutes ahead** | Server time is authoritative. Client timer syncs every 60s. |
| 3 | **Student's clock is 10 minutes behind** | Assessment appears "not yet open" until server time >= scheduled_at. |
| 4 | **Scheduled_at is in the past on publish** | Blocked — throw ValidationError. Teacher must set future time. |
| 5 | **Duration = 5 minutes, 30 questions** | Allowed (teacher's choice). Timer will auto-submit. |
| 6 | **Duration = 5 hours (300 min)** | Max allowed. For CBSE 3-hour exams. |
| 7 | **Assessment scheduled at midnight** | `scheduled_at` stored as UTC. Displayed in school timezone. |
| 8 | **Term ends during assessment window** | Warning on publish. Grade still recorded. |

### 13.2 Attempt Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Student refreshes page during attempt** | Answers saved via auto-save. Attempt continues. Timer unchanged. |
| 2 | **Student closes browser** | Timer continues server-side. Auto-submit fires on deadline. |
| 3 | **Browser crash mid-attempt** | Same as close. Auto-save captures most answers (last 30s max loss). |
| 4 | **Network failure during submit** | Keep in localStorage. Retry on reconnect. Timer still expires. |
| 5 | **Auto-submit fires before student submits** | Auto-submit wins. Any unsaved answers are lost. |
| 6 | **Student answers all questions in 5 minutes, duration=60** | Student can submit early. Remaining time is forfeited. |
| 7 | **Student starts but answers nothing** | Auto-submit fires with empty answers. All questions count as skipped/incorrect. |
| 8 | **Student attempts to submit after auto-submit** | Blocked. "This attempt has already been auto-submitted." |
| 9 | **Multiple attempts: student improves** | Best score recorded. Teacher sees all attempts. |
| 10 | **Multiple attempts: student declines** | No change. Best score used. |

### 13.3 Grading Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **All MCQ, auto-graded** | Instant grading. Results visible if `show_results_immediately`. |
| 2 | **Mixed MCQ+Essay, teacher grades** | Auto-graded visible to teacher. Essay pending. |
| 3 | **Teacher grades some but not all** | Status stays 'submitted' until all graded. |
| 4 | **Score exceeds max points** | Blocked per-question (max = question.points). |
| 5 | **Negative marking makes score negative** | `net_score = MAX(0, score - penalty)`. Floor at 0. |
| 6 | **Grade override after results published** | Must use override endpoint. Old and new scores logged. |
| 7 | **All students passed (100%)** | Grade distribution shows all in high range. Normal. |
| 8 | **All students failed (0% pass rate)** | Reviewed by principal. Teacher may need to regrade. |

### 13.4 Question Pool Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Pool has 5 questions, selection_count = 10** | Blocked on publish. Cannot select more than available. |
| 2 | **Pool has 0 questions** | Blocked on publish. Each pool must have ≥ 1 question. |
| 3 | **Question in multiple pools** | Allowed. Student only gets one instance. Deduplicated during selection. |
| 4 | **Student-specific random selection perceived as unfair** | Deterministic seed (student_id + pool_id). Same student = same selection. |
| 5 | **Teacher adds question after publish** | Blocked. Create new version. |

### 13.5 Proctoring Edge Cases (Future)

| # | Case | Handling |
|---|------|----------|
| 1 | **Student refuses camera permission** | Cannot start assessment if `camera_required = true`. |
| 2 | **Camera fails mid-assessment** | Flagged as violation. Teacher reviews. |
| 3 | **Student's internet drops for 2 minutes** | Events buffered locally. Sent on reconnect. |
| 4 | **False positive: student looks down to write** | Brief face_lost events (< 5s) are info severity. |
| 5 | **False positive: sibling walks into frame** | face_multiple event. Teacher reviews video snapshot. |

---

## 14. Risk Analysis

### 14.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Answer key leaked during active assessment** | Critical | Exam integrity destroyed | 3-layer protection: DB views, API filtering, RLS. Student quota on question endpoint. |
| 2 | **Student submits on behalf of another** | Critical | Impersonation fraud | IP logging, user-agent tracking, device fingerprinting (future). |
| 3 | **Student bypasses timer by manipulating client** | High | Unfair time advantage | Server-enforced timer. Auto-submit on server-side deadline. Client time is display only. |
| 4 | **Student opens assessment in multiple tabs** | Medium | Unfair advantage | Track active sessions per attempt. Block second tab. |
| 5 | **Teacher grades own child's assessment** | Medium | Grade inflation | Audit log records graded_by. Principal can review. Report shows grader bias. |
| 6 | **Bulk grade override without reason** | High | Mass grade manipulation | Override requires written reason. Principal notified for >5 overrides in a day. |
| 7 | **Proctoring data contains student images** | High | Privacy violation | Images processed client-side. Only metadata events sent to server. No raw video stored. |
| 8 | **Student uses AI to answer during assessment** | Medium | Cheating | Question-level timing analysis. Suspicious patterns flagged. |

### 14.2 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Auto-submit races with manual submit** | Double submission risk | `UNIQUE(assignment_id, student_id, attempt_number)`. Idempotent submit. |
| 2 | **Lost answers on browser crash** | Student loses work | Auto-save every 30s. localStorage backup. Max 30s data loss. |
| 3 | **Timer mismatch: server vs client** | Student thinks they have more/less time | Server timer is authoritative. Client syncs every 60s. |
| 4 | **Pool question deduplication failure** | Student gets same question twice | Deduplicate at selection time. Verify after selection. |
| 5 | **Grade computation error at scale** | Wrong student scores | Unit test all score paths. Log computation steps. Double-check totals. |

### 14.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **50 students submit simultaneously at deadline** | 50 auto-submit + 50 manual submit at same second | Auto-submit is async (background job). Manual submit queued. |
| 2 | **Real-time timer sync for 500 students** | Server hammered with GET requests every 60s | Timer sync piggybacks on save-progress calls. Dedicated endpoint rate-limited to 1/min. |
| 3 | **Proctoring events: 1 per second per student** | 50 students × 1 event/s = 50 events/s | Batch events (10s intervals). Use async insert. Aggregate on read. |
| 4 | **Results dashboard for 500 students** | Loading all results at once | Paginate (50 per page). Lazy-load per-question analysis. |
| 5 | **MV refresh for 50 assessments** | 50 assessments × 40 students each | Refresh MV hourly, not per-grade. Use CONCURRENTLY. |

---

## 15. Testing Checklist

### 15.1 Unit Tests — Create & Publish

| Test | Expected | Priority |
|------|----------|----------|
| `create_assessment: valid` | Assignment + config + questions created | P0 |
| `create_assessment: with pools` | Assignment + pools + pool_questions created | P0 |
| `create_assessment: teacher not assigned` | 403 | P0 |
| `publish: valid` | Published, schedule set | P0 |
| `publish: no questions` | 400 | P0 |
| `publish: past scheduled_at` | 400 | P0 |
| `publish: no config` | 400 | P0 |
| `update: before publish` | Fields updated | P0 |
| `update: after publish` | 400 | P0 |
| `clone: full clone` | New draft with same config, questions, pools | P0 |

### 15.2 Unit Tests — Attempt Flow

| Test | Expected | Priority |
|------|----------|----------|
| `start: valid` | Attempt created, question order set | P0 |
| `start: not yet open` | 400 | P0 |
| `start: late cutoff passed` | 400 | P0 |
| `start: max attempts reached` | 400 | P0 |
| `start: gap period not elapsed` | 400 | P0 |
| `start: student not in class` | 403 | P0 |
| `start: with pools` | Question order randomized per student | P0 |
| `save_progress: valid` | Answers saved, status unchanged | P0 |
| `submit: all auto-gradable` | Graded, status = graded, is_passed computed | P0 |
| `submit: mixed types` | Auto-graded, status = submitted | P0 |
| `submit: already submitted` | 400 | P0 |
| `submit: negative marking` | Penalty applied, net_score = score - penalty | P0 |
| `auto_submit: timer expires` | Status = auto_submitted, auto_submitted_at set | P0 |
| `auto_submit: already submitted` | No-op | P0 |

### 15.3 Unit Tests — Grading

| Test | Expected | Priority |
|------|----------|----------|
| `grade_single_answer: valid` | Answer score set, total recomputed | P0 |
| `grade_single_answer: exceeds max` | 400 | P0 |
| `grade_attempt: all manual` | All graded, status = graded | P0 |
| `grade_attempt: already graded` | 400 (use override) | P0 |
| `grade_attempt: non-own teacher` | 403 | P0 |
| `override: valid` | Scores changed, audit logged | P0 |
| `override: without reason` | 422 | P0 |
| `publish_results: no graded attempts` | 400 | P0 |
| `publish_results: valid` | Results visible to students | P0 |

### 15.4 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Create → Publish → Student starts → Submits → Auto-graded → Results | Full auto flow | P0 |
| Create (mixed types) → Publish → Student submits → Teacher grades → Results | Full manual flow | P0 |
| Create with pools → 2 students start → Verify different question sets | Pool randomization | P0 |
| Student starts → Timer expires → Auto-submit → Verify | Auto-submit flow | P0 |
| Student completes → Teacher overrides grade → Verify audit | Override flow | P0 |
| Multiple attempts → Best score selected | Multi-attempt flow | P0 |
| Negative marking → Verify net_score calculation | Negative marking | P0 |
| Clone → Publish → Verify independent | Clone integrity | P0 |

### 15.5 Security Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student sees answer key during attempt | Not in response | P0 |
| Student sees answer key after submit (not graded) | Not in response | P0 |
| Student sees answer key after results published | In response (if enabled) | P0 |
| Student accesses another student's attempt | 403 | P0 |
| Teacher grades non-own assessment | 403 | P0 |
| Student calls grade endpoint | 403 | P0 |
| Admin overrides without reason | 422 | P0 |
| Parent sees non-child's results | 403 | P0 |
| Cross-school access | Empty or 403 | P0 |
| SQL injection in answer text | 422 or parameterized | P0 |

### 15.6 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Start attempt (50 concurrent) | <500ms each | Indexed queries, async |
| Submit attempt (50 concurrent) | <1s each | Batch answer inserts |
| Auto-submit batch (50 attempts) | <10s total | Background job |
| Results dashboard (200 students) | <1s | Paginated, cached |
| Proctoring events (100 events/s) | <50ms each | Async insert, batched |
| Timer sync from client | <100ms | Lightweight endpoint |

---

## Appendix A: Assessment vs Assignment Type Comparison

| Feature | Homework (Module 7) | Quiz (M7) | Unit Test (M8) |
|---------|--------------------|-----------|----------------|
| Duration | Optional | ✅ Required | ✅ Required |
| Timer | None | Countdown | Countdown |
| Auto-submit | No | ✅ | ✅ |
| Schedule | Optional | ✅ Required | ✅ Required |
| Question pools | ❌ | ❌ | ✅ |
| Negative marking | ❌ | ❌ | ✅ Configurable |
| Multiple attempts | Via resubmission | ❌ | ✅ Configurable |
| Proctoring | ❌ | ❌ | ✅ (future) |
| Late submission | ✅ Configurable | ❌ | ⚠️ Late start only |
| Auto-grade | MCQ/TF only | MCQ/TF only | MCQ/TF + manual |
| Results | After teacher publishes | After submission | Configurable |
| Backtracking | ✅ | ⚠️ Depends on config | ⚠️ Configurable |
| Clone | ✅ | ✅ | ✅ |

## Appendix B: Error Codes

```typescript
export const ASSESSMENT_ERROR_CODES = {
  ASS_400_01: { status: 400, message: 'Assessment configuration not found' },
  ASS_400_02: { status: 400, message: 'Cannot publish: assessment has no questions' },
  ASS_400_03: { status: 400, message: 'Cannot publish: max_score not set' },
  ASS_400_04: { status: 400, message: 'Cannot publish: scheduled_at must be in the future' },
  ASS_400_05: { status: 400, message: 'This assessment is not yet open' },
  ASS_400_06: { status: 400, message: 'The late start window for this assessment has passed' },
  ASS_400_07: { status: 400, message: 'Maximum number of attempts reached' },
  ASS_400_08: { status: 400, message: 'Please wait before starting a new attempt' },
  ASS_400_09: { status: 400, message: 'This attempt has already been submitted' },
  ASS_400_10: { status: 400, message: 'Score exceeds maximum points for this question' },
  ASS_400_11: { status: 400, message: 'No graded attempts to publish results for' },
  ASS_400_12: { status: 400, message: 'Pool selection_count exceeds available questions' },
  ASS_400_13: { status: 400, message: 'Cannot edit a published assessment' },
  ASS_400_14: { status: 400, message: 'Duration must be between 5 and 300 minutes' },
  ASS_400_15: { status: 400, message: 'Reason is required (min 10 characters) for reopening' },
  ASS_400_16: { status: 400, message: 'Assessment is still active, cannot reopen' },

  ASS_403_01: { status: 403, message: 'You do not teach this subject in this class' },
  ASS_403_02: { status: 403, message: 'Only the creator or admin can publish this assessment' },
  ASS_403_03: { status: 403, message: 'This is not your attempt' },
  ASS_403_04: { status: 403, message: 'This assessment is not for your class' },
  ASS_403_05: { status: 403, message: 'You can only grade assessments you created' },

  ASS_404_01: { status: 404, message: 'Assessment not found' },
  ASS_404_02: { status: 404, message: 'Attempt not found' },
  ASS_404_03: { status: 404, message: 'Answer not found' },
  ASS_404_04: { status: 404, message: 'Question not found' },
  ASS_404_05: { status: 404, message: 'Student profile not found' },

  ASS_429_01: { status: 429, message: 'Too many timer syncs. Please wait.' },
} as const;
```

## Appendix C: Background Jobs

```typescript
// 1. assessment_timer_expiry — Auto-submit when timer expires
// Schedule: Triggered per-attempt via eventBus.schedule()
// Handler: AttemptService.autoSubmitExpiredAttempt(attemptId)

// 2. assessment_scheduled_open — Release assessment at scheduled time
// Schedule: Triggered per-assessment via eventBus.schedule() on publish
// Handler: EventsService.openAssessment(assignmentId)

// 3. assessment_results_scheduled — Auto-publish results
// Schedule: Triggered per-assessment when configured with show_results_after
// Handler: AssessmentsService.publishResults(assignmentId)

// 4. assessment_auto_grade — Batch auto-grade pending attempts
// Schedule: Every 5 minutes during school hours
// Query: SELECT id FROM assessment_attempts WHERE status IN ('submitted', 'auto_submitted')
//        AND assignment_id IN (SELECT id FROM assignments WHERE is_published = TRUE)
// Handler: Auto-grade all MCQ/TF questions that haven't been graded yet
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement module scaffolding, create migration for assessment tables, and begin API endpoint development
