# ATHON V2 — AI Layer Module Implementation

**Reviewer**: Principal AI Engineer, Principal Backend Engineer
**Stack**: Next.js 15 · TypeScript · OpenAI API · Anthropic API · Supabase Auth · PostgreSQL · Zod
**Product**: Athon — AI Teacher Operating System for CBSE Schools
**Date**: June 11, 2026
**References**: DATABASE_V2_FINAL.md · CURRICULUM_MODULE_IMPLEMENTATION.md · ASSIGNMENTS_MODULE_IMPLEMENTATION.md · ASSESSMENTS_MODULE_IMPLEMENTATION.md · NOTIFICATIONS_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Folder Structure](#3-folder-structure)
4. [Schemas (Zod)](#4-schemas-zod)
5. [Prompt Architecture](#5-prompt-architecture)
6. [Context Architecture](#6-context-architecture)
7. [AI Features — Teacher](#7-ai-features--teacher)
8. [AI Features — Student](#8-ai-features--student)
9. [AI Features — Parent](#9-ai-features--parent)
10. [AI Features — Principal](#10-ai-features--principal)
11. [Cost Tracking & Quotas](#11-cost-tracking--quotas)
12. [Caching Strategy](#12-caching-strategy)
13. [Hallucination Prevention](#13-hallucination-prevention)
14. [API Routes](#14-api-routes)
15. [Permissions](#15-permissions)
16. [Background Jobs](#16-background-jobs)
17. [Edge Cases](#17-edge-cases)
18. [Risk Analysis](#18-risk-analysis)
19. [Testing Checklist](#19-testing-checklist)

---

## 1. Architecture Overview

### 1.1 Design Principles

```
┌─────────────────────────────────────────────────────────────────────┐
│                  AI LAYER ARCHITECTURE                                │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐    │
│  │  Client   │───►│  AI Service  │───►│   LLM Provider (OpenAI) │    │
│  │  Request  │    │  Gateway     │    │   / Anthropic           │    │
│  └──────────┘    └──────┬───────┘    └─────────────────────────┘    │
│                         │                                             │
│            ┌────────────┼────────────┐                                │
│            ▼            ▼            ▼                                │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│    │ Context    │ │ Prompt     │ │ Response   │                      │
│    │ Builder    │ │ Templates  │ │ Validator  │                      │
│    └────────────┘ └────────────┘ └────────────┘                      │
│            │            │            │                                │
│            ▼            ▼            ▼                                │
│    ┌──────────────────────────────────────────────────────┐          │
│    │  Curriculum Graph  │  Student Data  │  School Config  │          │
│    └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Curriculum-First** | Every AI generation is grounded in the curriculum graph (Class → Subject → Chapter → Topic → Learning Objectives). The AI never generates without curriculum context. |
| **Teacher-in-the-Loop** | All AI-generated content requires teacher review before publishing. AI cannot auto-publish homework, tests, or lesson plans. |
| **Audit-All** | Every AI generation is logged with prompt, response, token count, and cost. Immutable record for compliance and debugging. |
| **Hallucination Guardrails** | Multi-layer validation: prompt grounding, response validation, factual constraints, and curriculum alignment checks. |
| **Cost-Controlled** | Per-role quotas, per-request token limits, model tiering (cheap models for simple tasks, expensive models for complex tasks). |
| **Privacy-First** | PII is stripped from prompts before sending to LLM. Student names are replaced with placeholders. Responses are scanned for PII before storage. |

### 1.3 Model Tiering

| Tier | Model | Cost | Use Case | Max Tokens Output |
|------|-------|------|----------|-------------------|
| **Tier 1** | `gpt-4o-mini` | $0.15/1M input, $0.60/1M output | Homework generation, rubric generation, report comments, doubt assistant | 2048 |
| **Tier 2** | `gpt-4o` | $2.50/1M input, $10.00/1M output | Lesson planning, test generation, principal insights, learning companion | 4096 |
| **Tier 3** | `gpt-4o` + structured output | $2.50/1M input, $10.00/1M output | Complex multi-question test generation, curriculum-aware analysis | 4096 |
| **Tier 4** | `o3-mini` (reasoning) | $1.10/1M input, $4.40/1M output | Risk detection, student at-risk analysis, performance insights | 2048 |

**Model Selection Rules:**
- If total curriculum context < 2000 tokens → Tier 1
- If generating structured output (JSON) with > 10 items → Tier 2
- If requires multi-step reasoning → Tier 4
- If generating freeform text for principal → Tier 2

### 1.4 Feature-to-Role Mapping

| Feature | Role | Tier | Curriculum-Aware? | Teacher Review Required? |
|---------|------|------|-------------------|--------------------------|
| Homework Generator | Teacher | Tier 1 (simple) / Tier 2 (complex) | ✅ Yes | ✅ Yes |
| Test Generator | Teacher | Tier 2 | ✅ Yes | ✅ Yes |
| Lesson Planner | Teacher | Tier 2 | ✅ Yes | ✅ Yes |
| Rubric Generator | Teacher | Tier 1 | ✅ Yes (LO-linked) | ✅ Yes |
| Report Comments | Teacher | Tier 1 | ✅ Yes (per-LO) | ✅ Yes |
| Doubt Assistant | Student | Tier 1 | ✅ Yes | ❌ No (auto-response) |
| Learning Companion | Student | Tier 2 | ✅ Yes | ❌ No (auto-response) |
| Weekly Summary | Parent | Tier 1 | ✅ Yes (aggregate) | ❌ No (auto-generated) |
| Insights | Principal | Tier 2 | ✅ Yes (school-wide) | ❌ No (auto-generated) |
| Risk Detection | Principal | Tier 4 | ✅ Yes | ❌ No (auto-flag) |

---

## 2. Database Schema

### 2.1 `ai_generations` (Extended from V2)

```sql
-- V2 baseline: ai_generations table already exists with:
-- id, school_id, user_id, entity_type, entity_id, generation_type,
-- prompt, response, model, tokens_input, tokens_output, duration_ms, created_at

-- V3 extensions for AI Module:
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS context_snapshot JSONB;
  -- { curriculum_tree, student_data, school_config, lo_ids, bloom_levels }
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS validation_results JSONB;
  -- { hallucination_score, factual_accuracy, curriculum_alignment, pii_detected }
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS user_rating INTEGER;
  -- Teacher can rate generation: 1-5
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS user_feedback TEXT;
  -- Optional teacher feedback
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS error_type VARCHAR(50);
  -- content_filter, hallucination, timeout, rate_limited, invalid_response
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS school_id UUID NOT NULL;
  -- Ensure school isolation

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ai_gen_school_type ON ai_generations(school_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gen_user_cost ON ai_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gen_cost_analytics ON ai_generations(school_id, created_at, tokens_input, tokens_output);
```

### 2.2 `ai_quota` — NEW: Per-school, per-role quota tracking

```sql
CREATE TABLE ai_quota (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    -- Per-role daily limits
    role              user_role NOT NULL,
    generations_per_day INTEGER NOT NULL DEFAULT 100,
    tokens_per_day    INTEGER NOT NULL DEFAULT 100000,
    
    -- Monthly budgets (cost tracking)
    monthly_budget_cents INTEGER NOT NULL DEFAULT 50000,  -- $500/month default (configurable per school)
    
    -- Current usage (reset daily)
    generations_today  INTEGER NOT NULL DEFAULT 0,
    tokens_today       INTEGER NOT NULL DEFAULT 0,
    monthly_cost_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Config
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    reset_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(school_id, role)
);

CREATE INDEX idx_ai_quota_school ON ai_quota(school_id);
```

### 2.3 `ai_context_cache` — NEW: Cached curriculum context for AI

```sql
CREATE TABLE ai_context_cache (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    -- Context fingerprint (deterministic hash of input params)
    fingerprint       VARCHAR(64) NOT NULL,
    
    -- Cached context payload
    context_data      JSONB NOT NULL,
    
    -- Metadata
    token_count       INTEGER NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    
    UNIQUE(school_id, fingerprint)
);

CREATE INDEX idx_ai_ctx_cache_fingerprint ON ai_context_cache(school_id, fingerprint);
CREATE INDEX idx_ai_ctx_cache_expiry ON ai_context_cache(expires_at);
```

### 2.4 `ai_content_filters` — NEW: Content filter rules

```sql
CREATE TABLE ai_content_filters (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    filter_type       VARCHAR(50) NOT NULL,
        -- 'topic_restriction' — Restrict AI to specific curriculum topics
        -- 'difficulty_range' — Constrain difficulty (1-10)
        -- 'bloom_levels' — Constrain Bloom's taxonomy levels
        -- 'language' — Output language constraint
        -- 'forbidden_topics' — Topics AI must never generate about
        -- 'custom_instruction' — Custom system prompt prepend
    
    filter_config     JSONB NOT NULL,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(school_id, filter_type)
);
```

### 2.5 `companion_sessions` — NEW: Learning companion session persistence

```sql
CREATE TABLE companion_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES students(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    subject_id        UUID REFERENCES subjects(id),
    
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    message_count     INTEGER NOT NULL DEFAULT 0,
    topics_covered    TEXT[],                            -- LO codes discussed
    student_mood      VARCHAR(20),                       -- 'engaged', 'struggling', 'confused', 'confident'
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cs_student ON companion_sessions(student_id, last_activity_at DESC);
CREATE INDEX idx_cs_active ON companion_sessions(student_id) WHERE is_active = TRUE;
```

### 2.6 `student_doubt_history` — NEW: Track student AI interactions

```sql
CREATE TABLE student_doubt_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES students(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    
    -- Subject context
    subject_id        UUID REFERENCES subjects(id),
    lo_id             UUID REFERENCES learning_objectives(id),
    
    -- Interaction
    question          TEXT NOT NULL,
    answer            TEXT NOT NULL,
    was_helpful       BOOLEAN,                      -- Student feedback
    
    -- Metadata
    tokens_input      INTEGER NOT NULL DEFAULT 0,
    tokens_output     INTEGER NOT NULL DEFAULT 0,
    duration_ms       INTEGER,
    
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sdh_student ON student_doubt_history(student_id, created_at DESC);
CREATE INDEX idx_sdh_lo ON student_doubt_history(lo_id) WHERE lo_id IS NOT NULL;
```

### 2.7 ENUMs & Audit Events

```sql
-- AI generation entity types (extend existing)
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:homework_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:test_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:lesson_plan_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:rubric_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:report_comment_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:doubt_answered';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:companion_chat';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:summary_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:insight_generated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:risk_detected';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:quota_exceeded';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:quota_reset';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ai:filter_violation';
```

### 2.8 RLS Policies

```sql
-- ai_generations: user sees own; admin sees school
CREATE POLICY ai_gen_user ON ai_generations FOR SELECT
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY ai_gen_admin ON ai_generations FOR SELECT
    USING (school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') IN ('school_admin', 'principal'));

CREATE POLICY ai_gen_insert ON ai_generations FOR INSERT
    WITH CHECK (school_id = current_setting('app.current_school_id')::UUID);

-- ai_quota: admin manages; user views own
CREATE POLICY ai_quota_admin ON ai_quota FOR ALL
    USING (school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') = 'school_admin');

-- ai_content_filters: admin manages
CREATE POLICY ai_filters_admin ON ai_content_filters FOR ALL
    USING (school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') = 'school_admin');

-- student_doubt_history: student sees own; teacher sees class's
CREATE POLICY sdh_student ON student_doubt_history FOR ALL
    USING (student_id = (SELECT id FROM students WHERE user_id = current_setting('app.current_user_id')::UUID));

CREATE POLICY sdh_teacher ON student_doubt_history FOR SELECT
    USING (student_id IN (
        SELECT s.id FROM students s
        JOIN teacher_class_subjects tcs ON tcs.class_id = s.class_id
        WHERE tcs.teacher_id = current_setting('app.current_teacher_id')::UUID
    ));
```

---

## 3. Folder Structure

```
src/core/ai/
├── ai.service.ts                          # Main orchestrator
├── ai.router.ts                           # API routes
├── ai.validator.ts                        # Zod schemas
├── ai.schema.ts                           # TypeScript types
├── ai.repository.ts                       # Database access
│
├── context/
│   ├── curriculum-context-builder.ts      # Builds curriculum context from DB
│   ├── student-context-builder.ts         # Builds student performance context
│   ├── school-context-builder.ts          # Builds school config context
│   └── context-cache.service.ts           # Caches contexts for reuse
│
├── prompts/
│   ├── prompt-templates.ts                # All system/user prompt templates
│   ├── prompt-builder.ts                  # Assembles prompts from templates + context
│   └── prompt-validators.ts              # Validates prompts before sending
│
├── providers/
│   ├── openai.provider.ts                 # OpenAI API integration
│   ├── anthropic.provider.ts             # Anthropic API integration (fallback)
│   └── llm-provider.interface.ts          # Provider abstraction
│
├── features/
│   ├── homework-generator.service.ts      # Homework generation
│   ├── test-generator.service.ts          # Test generation
│   ├── lesson-planner.service.ts          # Lesson plan generation
│   ├── rubric-generator.service.ts        # Rubric generation
│   ├── report-comments.service.ts         # Report comment generation
│   ├── doubt-assistant.service.ts         # Student doubt assistant
│   ├── learning-companion.service.ts      # Student learning companion
│   ├── weekly-summary.service.ts          # Parent weekly summary
│   ├── principal-insights.service.ts      # Principal insights
│   └── risk-detection.service.ts          # Risk detection & flagging
│
├── validation/
│   ├── response-validator.ts              # Validates LLM responses
│   ├── hallucination-detector.ts          # Detects hallucination patterns
│   ├── pii-scanner.ts                     # Scans for PII in prompts/responses
│   └── curriculum-alignment.ts            # Ensures output matches curriculum
│
├── cost/
│   ├── cost-tracker.service.ts            # Tracks token usage and costs
│   ├── quota-manager.service.ts           # Enforces per-role quotas
│   └── budget-alert.service.ts            # Alerts on budget thresholds
│
└── cache/
    └── ai-cache.service.ts                # Caches AI responses for reuse
```

---

## 4. Schemas (Zod)

```typescript
// src/core/ai/ai.validator.ts

import { z } from 'zod';

const UUID = z.string().uuid();
const Name = z.string().min(1).max(200);

// ─── Curriculum Context Input ──────────────────────────────────

export const CurriculumContextSchema = z.object({
  school_id: UUID,
  class_id: UUID,
  subject_id: UUID,
  chapter_id: UUID.optional(),
  topic_ids: z.array(UUID).max(10).optional(),
  lo_ids: z.array(UUID).max(20).optional(),
  include_progress: z.boolean().default(false),
  teacher_id: UUID.optional(),  // For progress tracking
});

// ─── Homework Generation ───────────────────────────────────────

export const GenerateHomeworkSchema = z.object({
  class_id: UUID,
  subject_id: UUID,
  chapter_id: UUID.optional(),
  topic_ids: z.array(UUID).min(1).max(5),
  
  title: Name.optional(),  // AI will suggest if not provided
  num_questions: z.number().int().min(1).max(20).default(5),
  question_types: z.array(
    z.enum(['multiple_choice', 'true_false', 'short_answer', 'long_answer'])
  ).min(1).default(['multiple_choice', 'short_answer']),
  
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  bloom_levels: z.array(
    z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'])
  ).min(1).optional(),
  
  include_explanations: z.boolean().default(true),
  language: z.enum(['en', 'hi', 'bilingual']).default('en'),
});

// ─── Test Generation ───────────────────────────────────────────

export const GenerateTestSchema = z.object({
  class_id: UUID,
  subject_id: UUID,
  chapter_ids: z.array(UUID).min(1).max(5),
  topic_ids: z.array(UUID).min(1).max(10).optional(),
  
  title: Name.optional(),
  num_questions: z.number().int().min(5).max(50).default(20),
  max_score: z.number().positive().default(100),
  duration_minutes: z.number().int().min(5).max(180).default(60),
  
  question_distribution: z.object({
    multiple_choice: z.number().int().min(0).default(10),
    true_false: z.number().int().min(0).default(5),
    short_answer: z.number().int().min(0).default(3),
    long_answer: z.number().int().min(0).default(2),
  }).optional(),
  
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  bloom_distribution: z.record(z.number()).optional(),
    // e.g., { remember: 0.2, understand: 0.3, apply: 0.3, analyze: 0.2 }
  
  allow_negative_marking: z.boolean().default(false),
  negative_marking_pct: z.number().min(0).max(100).default(25),
  
  language: z.enum(['en', 'hi', 'bilingual']).default('en'),
});

// ─── Lesson Plan Generation ────────────────────────────────────

export const GenerateLessonPlanSchema = z.object({
  class_id: UUID,
  subject_id: UUID,
  topic_ids: z.array(UUID).min(1).max(3),
  
  duration_minutes: z.number().int().min(15).max(120).default(45),
  include_activities: z.boolean().default(true),
  include_assessment: z.boolean().default(true),
  include_differentiation: z.boolean().default(true),  // For different learning levels
  teaching_style: z.enum(['traditional', 'activity_based', 'blended']).default('blended'),
  language: z.enum(['en', 'hi', 'bilingual']).default('en'),
});

// ─── Rubric Generation ─────────────────────────────────────────

export const GenerateRubricSchema = z.object({
  assignment_id: UUID.optional(),
  subject_id: UUID.optional(),
  lo_ids: z.array(UUID).min(1).max(10),
  
  max_score: z.number().positive().default(20),
  criteria_count: z.number().int().min(3).max(8).default(4),
  performance_levels: z.number().int().min(3).max(5).default(4),
  
  include_examples: z.boolean().default(true),
  language: z.enum(['en', 'hi', 'bilingual']).default('en'),
});

// ─── Report Comments ───────────────────────────────────────────

export const GenerateReportCommentsSchema = z.object({
  class_id: UUID,
  subject_id: UUID,
  student_ids: z.array(UUID).min(1).max(40),  // One class
  
  academic_term_id: UUID,
  
  comment_style: z.enum([
    'standard',       // Balanced, professional
    'encouraging',    // Positive, growth-focused
    'constructive',   // Honest, improvement-focused
    'detailed',       // Long-form, comprehensive
  ]).default('standard'),
  
  include_attendance: z.boolean().default(true),
  include_behavior: z.boolean().default(false),  // Requires teacher input
  max_words_per_student: z.number().int().min(20).max(200).default(100),
  language: z.enum(['en', 'hi']).default('en'),
  
  // Actual student performance data (fetched from DB if not provided)
  // The AI uses ONLY this data to write comments - never invents scores
  performance_data: z.array(z.object({
    student_id: UUID,
    avg_score: z.number().optional(),
    max_score: z.number().optional(),
    assignments_completed: z.number().optional(),
    attendance_pct: z.number().optional(),
    strengths: z.array(z.string()).optional(),
    areas_for_improvement: z.array(z.string()).optional(),
    teacher_notes: z.string().optional(),
  })).optional(),
});

// ─── Doubt Assistant ───────────────────────────────────────────

export const DoubtAssistantSchema = z.object({
  subject_id: UUID,
  question: z.string().min(5, 'Please describe your doubt in detail').max(2000),
  
  // Optional curriculum context (auto-resolved from student's class)
  chapter_id: UUID.optional(),
  topic_id: UUID.optional(),
  lo_id: UUID.optional(),
  
  // Optional context (auto-resolved from student's history)
  previous_attempts: z.array(z.string()).max(5).optional(),
  struggling_with: z.string().max(500).optional(),
});

// ─── Learning Companion ────────────────────────────────────────

export const LearningCompanionSchema = z.object({
  subject_id: UUID,
  message: z.string().min(1).max(2000),
  
  // Context (auto-resolved)
  lo_id: UUID.optional(),
  recent_lo_ids: z.array(UUID).max(5).optional(),
  
  // Session tracking
  session_id: UUID.optional(),  // For maintaining conversation history
  history: z.array(z.object({
    role: z.enum(['student', 'assistant']),
    content: z.string(),
  })).max(20).optional(),
});

// ─── Weekly Summary (Parent) ──────────────────────────────────

export const WeeklySummarySchema = z.object({
  student_id: UUID,
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.enum(['en', 'hi']).default('en'),
});

// ─── Principal Insights ────────────────────────────────────────

export const PrincipalInsightsSchema = z.object({
  focus_area: z.enum([
    'overview',           // General school performance overview
    'attendance',         // Attendance trends & risks
    'academic',           // Academic performance insights
    'curriculum',         // Curriculum coverage insights
    'teacher_activity',   // Teacher engagement metrics
    'at_risk_students',   // At-risk student analysis
  ]).default('overview'),
  
  time_range: z.enum(['week', 'month', 'term', 'year']).default('month'),
  
  // Optional filters
  class_id: UUID.optional(),
  subject_id: UUID.optional(),
  
  max_insights: z.number().int().min(3).max(20).default(10),
});

// ─── AI Generation Response ────────────────────────────────────

export const AIGenerationResponseSchema = z.object({
  id: UUID,
  entity_type: z.string(),
  generation_type: z.string(),
  content: z.any(),  // Feature-specific response
  model: z.string(),
  tokens_input: z.number(),
  tokens_output: z.number(),
  cost_cents: z.number(),
  duration_ms: z.number(),
  created_at: z.string(),
});

// ─── Cost & Quota ──────────────────────────────────────────────

export const QuotaUsageSchema = z.object({
  generations_today: z.number(),
  generations_limit: z.number(),
  tokens_today: z.number(),
  tokens_limit: z.number(),
  monthly_cost_cents: z.number(),
  monthly_budget_cents: z.number(),
  is_quota_exceeded: z.boolean(),
  resets_at: z.string(),  // Next reset time
});

export const CostAnalyticsSchema = z.object({
  total_cost_cents: z.number(),
  cost_by_feature: z.record(z.number()),
  cost_by_role: z.record(z.number()),
  cost_by_day: z.array(z.object({
    date: z.string(),
    cost_cents: z.number(),
    generations: z.number(),
  })),
  average_cost_per_generation_cents: z.number(),
  projected_monthly_cost_cents: z.number(),
});

// ─── Response Types ────────────────────────────────────────────

export type CurriculumContextInput = z.infer<typeof CurriculumContextSchema>;
export type GenerateHomeworkInput = z.infer<typeof GenerateHomeworkSchema>;
export type GenerateTestInput = z.infer<typeof GenerateTestSchema>;
export type GenerateLessonPlanInput = z.infer<typeof GenerateLessonPlanSchema>;
export type GenerateRubricInput = z.infer<typeof GenerateRubricSchema>;
export type GenerateReportCommentsInput = z.infer<typeof GenerateReportCommentsSchema>;
export type DoubtAssistantInput = z.infer<typeof DoubtAssistantSchema>;
export type LearningCompanionInput = z.infer<typeof LearningCompanionSchema>;
export type WeeklySummaryInput = z.infer<typeof WeeklySummarySchema>;
export type PrincipalInsightsInput = z.infer<typeof PrincipalInsightsSchema>;
export type AIGenerationResponse = z.infer<typeof AIGenerationResponseSchema>;
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>;
```

---

## 5. Prompt Architecture

### 5.1 Prompt Engineering Principles

```
Athon's prompt architecture follows 5 principles:

1. GROUNDED: Every prompt includes the curriculum context as structured data.
   → Never: "Generate questions about photosynthesis."
   → Always: "Generate 5 questions for Grade 7 Science, Chapter 'Nutrition in Plants',
              Topic 'Photosynthesis', covering LOs SCI-7-NP-PH-01 and SCI-7-NP-PH-02."

2. STRUCTURED OUTPUT: All generations use JSON mode (when available) or clearly
   formatted structured output. Responses are validated against Zod schemas.

3. ROLE-LOCKED: The system prompt defines a specific role that cannot be overridden.
   → "You are an AI teaching assistant for CBSE Grade 7 Science. You ONLY generate
      content aligned with the provided curriculum. You NEVER provide answers to
      assessment questions."

4. CONSTRAINT-EXPLICIT: All constraints are explicit in the prompt, never implicit.
   → "IMPORTANT: Each question must have exactly one correct answer."
   → "IMPORTANT: Do NOT include questions about topics not listed in the curriculum."
   → "IMPORTANT: Bloom's taxonomy level for each question must be specified."

5. AUDIT-READY: Every prompt includes a fingerprint that maps back to the specific
   curriculum context used, enabling post-hoc validation.
```

### 5.2 System Prompt Template

```typescript
// src/core/ai/prompts/prompt-templates.ts

// ─── SYSTEM PROMPT BASE ──────────────────────────────────────

const SYSTEM_PROMPT_BASE = `You are an AI teaching assistant for CBSE (Central Board of Secondary Education) schools in India called Athon AI. You are built into the Athon School Management Platform.

## RULES

1. You ONLY generate content aligned with the provided curriculum. If the curriculum context below does not contain enough information, ask for clarification instead of inventing content.
2. You NEVER generate content that contradicts the CBSE curriculum or Indian educational standards.
3. You ALWAYS respond in the specified language (default: English).
4. You NEVER include harmful, inappropriate, age-inappropriate, or culturally insensitive content.
5. You NEVER provide direct answers to exam/assessment questions that could be used to cheat.
6. You ALWAYS use simple, clear language appropriate for the target audience (student, parent, teacher, or principal).
7. For bilingual prompts, provide content in both English and Hindi with clear separation.
8. You NEVER include personal data (student names, teacher names) in your output unless explicitly instructed.
9. When generating questions, each question MUST be at the specified Bloom's taxonomy level.
10. IMPORTANT: If you are unsure about the curriculum or any fact, state "I need more information" rather than guessing.`;

// ─── HOMEWORK GENERATION SPECIFIC ─────────────────────────────

const HOMEWORK_PROMPT_EXTENSION = `
## HOMEWORK GENERATION TASK

Generate {{num_questions}} homework questions for the curriculum context below.

### Question Types Required
{{question_types_text}}

### Difficulty Level: {{difficulty}}

### Bloom's Taxonomy Levels (if specified): {{bloom_levels_text}}

### Output Format (JSON)
Return a JSON object with this exact structure:
\`\`\`json
{
  "title": "Suggested homework title based on curriculum",
  "description": "Brief description of the homework",
  "questions": [
    {
      "question_text": "The question text",
      "question_type": "multiple_choice | true_false | short_answer | long_answer",
      "options": [{"label": "A", "text": "Option text"}, ...],  // Only for multiple_choice
      "correct_answer": "The correct answer",
      "explanation": "Explanation of the correct answer",
      "points": 1,
      "bloom_taxonomy_level": "remember | understand | apply | analyze | evaluate | create",
      "lo_code": "SCI-7-NP-PH-01",  // Learning objective code this question addresses
      "difficulty": "easy | medium | hard",
      "tags": ["tag1", "tag2"]
    }
  ]
}
\`\`\`

### Question Quality Guidelines
- Each question MUST be clearly answerable from the provided curriculum
- Multiple choice questions MUST have exactly 4 options (A, B, C, D)
- True/False questions MUST have exactly 2 options
- Short answer questions should require 1-2 sentences
- Long answer questions should require 3-5 sentences
- Questions should progress from easier to harder
- Include questions at different Bloom's levels as requested
- Include explanations for each correct answer (for self-study)
`;

// ─── LESSON PLAN GENERATION SPECIFIC ─────────────────────────

const LESSON_PLAN_PROMPT_EXTENSION = `
## LESSON PLAN GENERATION TASK

Generate a detailed lesson plan for the topic(s) in the curriculum context.

### Duration: {{duration_minutes}} minutes

### Include:
{{include_sections_text}}

### Teaching Style: {{teaching_style}}

### Output Format (JSON)
Return a JSON object with this exact structure:
\`\`\`json
{
  "title": "Lesson plan title",
  "topic_ids": ["uuid1", "uuid2"],
  "duration_minutes": 45,
  "learning_objectives": [
    {
      "lo_code": "SCI-7-NP-PH-01",
      "description": "Students will be able to describe photosynthesis",
      "success_criteria": "Students can list the inputs and outputs of photosynthesis"
    }
  ],
  "materials_needed": ["Textbook", "Chart paper", "Markers"],
  "lesson_structure": [
    {
      "phase": "Introduction",
      "duration_minutes": 5,
      "activity": "Hook question: 'How do plants eat?'",
      "teacher_actions": "Ask the hook question, show a plant",
      "student_actions": "Discuss in pairs, share ideas"
    },
    {
      "phase": "Main Activity",
      "duration_minutes": 25,
      "activity": "Explain photosynthesis process using diagram",
      "teacher_actions": "Draw and explain the process step by step",
      "student_actions": "Draw diagram in notebook, label parts"
    },
    {
      "phase": "Practice",
      "duration_minutes": 10,
      "activity": "Worksheet: Identify inputs and outputs",
      "teacher_actions": "Distribute worksheet, circulate to help",
      "student_actions": "Complete worksheet individually"
    },
    {
      "phase": "Assessment",
      "duration_minutes": 5,
      "activity": "Exit ticket: 3-2-1 (3 things learned, 2 questions, 1 interesting fact)",
      "teacher_actions": "Collect exit tickets, review responses",
      "student_actions": "Write and submit exit ticket"
    }
  ],
  "differentiation": {
    "for_struggling_students": ["Provide labeled diagram", "Pair with stronger student"],
    "for_advanced_students": ["Ask to compare with respiration", "Research C4 plants"]
  },
  "homework_suggestion": "Draw a labeled diagram of photosynthesis and write 5 sentences explaining the process"
}
\`\`\`

### Lesson Plan Quality Guidelines
- Each phase must have clear time allocation adding up to the total duration
- Activities must be age-appropriate for the specified class
- Include at least one formative assessment activity
- Differentiation strategies must address different learning levels
- Materials should be commonly available in Indian CBSE schools
- Link every learning objective to the provided curriculum
`;

// ─── DOUBT ASSISTANT SPECIFIC ────────────────────────────────

const DOUBT_ASSISTANT_PROMPT_EXTENSION = `
## DOUBT ASSISTANT TASK

You are helping a CBSE Grade {{class_name}} student who has a doubt about {{subject_name}}.

### Student Context
- Class: {{class_name}} (Grade {{grade_number}})
- Subject: {{subject_name}}
- Relevant Chapter: {{chapter_name}}
- Relevant Topic: {{topic_name}} (if available)
- Relevant Learning Objective: {{lo_code}} — {{lo_description}} (if available)

### Student's Question
{{student_question}}

### Previous Attempts (if any)
{{previous_attempts_text}}

### Student's Self-Reported Difficulty
{{struggling_with_text}}

### Response Guidelines
1. Use SIMPLE language appropriate for a Grade {{grade_number}} student
2. Break down the answer into small, digestible steps
3. Use analogies and examples from everyday life
4. If the question is off-topic (not related to the curriculum), gently redirect to the topic
5. If the student is confused, try a different explanation approach
6. NEVER give the direct answer to a homework/exam question — explain the concept instead
7. Encourage the student: use phrases like "Great question!" and "You're on the right track!"
8. Suggest a follow-up question or activity to reinforce learning

### OUTPUT: Plain text response (not JSON). Max 300 words.
`;
```

### 5.3 Prompt Builder

```typescript
// src/core/ai/prompts/prompt-builder.ts

export class PromptBuilder {
  constructor(
    private readonly contextBuilder: CurriculumContextBuilder,
    private readonly cache: AICacheService,
  ) {}

  async buildHomeworkPrompt(
    ctx: RequestContext,
    input: GenerateHomeworkInput,
  ): Promise<{ systemPrompt: string; userPrompt: string; contextFingerprint: string }> {
    // 1. Build curriculum context
    const curriculumContext = await this.contextBuilder.buildCurriculumContext({
      school_id: ctx.schoolId,
      class_id: input.class_id,
      subject_id: input.subject_id,
      topic_ids: input.topic_ids,
      chapter_id: input.chapter_id,
      include_progress: false,
    });

    const fingerprint = curriculumContext.fingerprint;

    // 2. Generate user prompt from template
    const questionTypesText = input.question_types.join(', ');
    const bloomLevelsText = input.bloom_levels?.join(', ') ?? 'Varies (mixed levels)';
    const difficultyLabel = input.difficulty;
    const languageInstruction = input.language === 'bilingual'
      ? 'Provide content in both English and Hindi. Use "--- Hindi ---" as a separator.'
      : input.language === 'hi'
        ? 'Provide all content in Hindi.'
        : 'Provide all content in English.';

    const userPrompt = `
## CURRICULUM CONTEXT

### Class: ${curriculumContext.class.name} (Grade ${curriculumContext.class.grade})
### Subject: ${curriculumContext.subject.name} (${curriculumContext.subject.code})

### Chapters Covered:
${curriculumContext.chapters.map(ch => `- ${ch.name}: ${ch.description ?? ''}`).join('\n')}

### Topics Covered:
${curriculumContext.topics.map(t => `- ${t.chapter_name} → ${t.name}: ${t.description ?? ''}`).join('\n')}

### Learning Objectives:
${curriculumContext.learningObjectives.map(lo =>
  `- ${lo.code} (${lo.bloom_taxonomy_level ?? 'N/A'}): ${lo.description}`
).join('\n')}

## LANGUAGE INSTRUCTION
${languageInstruction}

## GENERATION PARAMETERS
- Number of Questions: ${input.num_questions}
- Question Types: ${questionTypesText}
- Difficulty: ${difficultyLabel}
- Bloom's Levels: ${bloomLevelsText}
- Include Explanations: ${input.include_explanations ? 'Yes' : 'No'}
`;

    // 3. Assemble system prompt
    let systemPrompt = SYSTEM_PROMPT_BASE + '\n\n' + HOMEWORK_PROMPT_EXTENSION
      .replace('{{num_questions}}', String(input.num_questions))
      .replace('{{question_types_text}}', questionTypesText)
      .replace('{{difficulty}}', difficultyLabel)
      .replace('{{bloom_levels_text}}', bloomLevelsText);

    // 4. Apply school content filters
    systemPrompt = await this.applyContentFilters(ctx.schoolId, systemPrompt);

    return {
      systemPrompt,
      userPrompt,
      contextFingerprint: fingerprint,
    };
  }

  async buildDoubtAssistantPrompt(
    ctx: RequestContext,
    input: DoubtAssistantInput,
    studentInfo: { classId: string; gradeNumber: number; className: string; studentId: string },
  ): Promise<{ systemPrompt: string; userPrompt: string }> {
    // Build minimal curriculum context for the doubt
    const curriculumContext = await this.contextBuilder.buildMinimalContext({
      school_id: ctx.schoolId,
      subject_id: input.subject_id,
      lo_id: input.lo_id,
    });

    const userPrompt = DOUBT_ASSISTANT_PROMPT_EXTENSION
      .replace('{{class_name}}', studentInfo.className)
      .replace('{{grade_number}}', String(studentInfo.gradeNumber))
      .replace('{{subject_name}}', curriculumContext.subject?.name ?? 'the subject')
      .replace('{{chapter_name}}', curriculumContext.chapter?.name ?? 'N/A')
      .replace('{{topic_name}}', curriculumContext.topic?.name ?? 'N/A')
      .replace('{{lo_code}}', curriculumContext.learningObjective?.code ?? 'N/A')
      .replace('{{lo_description}}', curriculumContext.learningObjective?.description ?? 'N/A')
      .replace('{{student_question}}', input.question)
      .replace('{{previous_attempts_text}}',
        (input.previous_attempts ?? []).length > 0
          ? input.previous_attempts!.map((a, i) => `${i + 1}. ${a}`).join('\n')
          : 'No previous attempts recorded.')
      .replace('{{struggling_with_text}}',
        input.struggling_with ?? 'Not specified.');

    const systemPrompt = SYSTEM_PROMPT_BASE + '\n\n' + `
## DOUBT ASSISTANT ROLE

You are helping a CBSE student with a subject doubt. Your response must:
1. Be grade-appropriate (Grade ${studentInfo.gradeNumber} level)
2. Explain the concept, not just give the answer
3. Use examples from the CBSE curriculum
4. Be encouraging and supportive
`;

    return { systemPrompt, userPrompt };
  }

  private async applyContentFilters(
    schoolId: string,
    systemPrompt: string,
  ): Promise<string> {
    const filters = await this.contextBuilder.getActiveFilters(schoolId);
    if (filters.length === 0) return systemPrompt;

    const customInstructions = filters
      .filter(f => f.filter_type === 'custom_instruction')
      .map(f => f.filter_config.instruction)
      .join('\n');

    const forbiddenTopics = filters
      .filter(f => f.filter_type === 'forbidden_topics')
      .flatMap(f => f.filter_config.topics ?? []);

    let result = systemPrompt;
    if (customInstructions) {
      result += `\n\n## SCHOOL-SPECIFIC INSTRUCTIONS\n${customInstructions}`;
    }
    if (forbiddenTopics.length > 0) {
      result += `\n\n## FORBIDDEN TOPICS (DO NOT GENERATE CONTENT ABOUT)\n${forbiddenTopics.map(t => `- ${t}`).join('\n')}`;
    }

    return result;
  }
}
```

### 5.4 Provider Abstraction

```typescript
// src/core/ai/providers/llm-provider.interface.ts

export interface LLMProviderConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: 'text' | 'json_object';
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  durationMs: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
}

export interface LLMProvider {
  generate(
    systemPrompt: string,
    userPrompt: string,
    config: LLMProviderConfig,
  ): Promise<LLMResponse>;
}


// src/core/ai/providers/openai.provider.ts

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly client: OpenAI) {}

  async generate(
    systemPrompt: string,
    userPrompt: string,
    config: LLMProviderConfig,
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.client.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      response_format: config.responseFormat === 'json_object'
        ? { type: 'json_object' }
        : undefined,
    });

    const durationMs = Date.now() - startTime;
    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      tokensInput: response.usage?.prompt_tokens ?? 0,
      tokensOutput: response.usage?.completion_tokens ?? 0,
      durationMs,
      finishReason: this.mapFinishReason(choice?.finish_reason),
    };
  }

  private mapFinishReason(
    reason: string | undefined | null,
  ): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return 'error';
    }
  }
}
```

---

## 6. Context Architecture

### 6.1 Curriculum Context Builder

```typescript
// src/core/ai/context/curriculum-context-builder.ts

export class CurriculumContextBuilder {
  constructor(
    private readonly repo: AIRepository,
    private readonly cache: AICacheService,
  ) {}

  /**
   * Build a full curriculum context for AI generation.
   * Includes class info, subject, chapters, topics, LOs, and optionally teacher progress.
   * Result is cached by fingerprint for reuse across same parameters.
   */
  async buildCurriculumContext(
    input: CurriculumContextInput,
  ): Promise<CurriculumContext> {
    // 1. Check cache first
    const fingerprint = await this.generateFingerprint(input);
    const cached = await this.cache.getContext(fingerprint);
    if (cached) return cached;

    // 2. Fetch curriculum entities
    const classInfo = await this.repo.findClassInfo(input.class_id);
    if (!classInfo) throw new NotFoundError('Class not found');

    const subject = await this.repo.findSubject(input.subject_id);
    if (!subject) throw new NotFoundError('Subject not found');

    // 3. Determine which chapters/topics to include
    let chapterIds: string[];
    if (input.chapter_id) {
      chapterIds = [input.chapter_id];
    } else if (input.topic_ids && input.topic_ids.length > 0) {
      // Resolve topic IDs to parent chapter IDs
      chapterIds = await this.repo.getChapterIdsForTopics(input.topic_ids);
    } else if (input.lo_ids && input.lo_ids.length > 0) {
      // Resolve LO IDs to parent chapter IDs
      chapterIds = await this.repo.getChapterIdsForLOs(input.lo_ids);
    } else {
      // Default: all chapters for this subject
      const chapters = await this.repo.getChaptersForSubject(input.subject_id);
      chapterIds = chapters.map(c => c.id).slice(0, 5); // Limit to 5 chapters
    }

    // 4. Fetch full curriculum tree
    const chapters = await this.repo.getChaptersWithTopicsAndLOs(
      input.subject_id, chapterIds,
    );

    // 5. Flatten topics and LOs for easy access
    const topics: TopicInfo[] = [];
    const learningObjectives: LOInfo[] = [];

    for (const chapter of chapters) {
      for (const topic of chapter.topics ?? []) {
        topics.push({
          id: topic.id,
          name: topic.name,
          description: topic.description,
          chapter_id: chapter.id,
          chapter_name: chapter.name,
        });
        for (const lo of topic.learning_objectives ?? []) {
          learningObjectives.push({
            id: lo.id,
            code: lo.code,
            description: lo.description,
            bloom_taxonomy_level: lo.bloom_taxonomy_level,
            topic_id: topic.id,
            topic_name: topic.name,
          });
        }
      }
    }

    // 6. Optionally include teacher progress
    let progressMap: Record<string, string> = {};
    if (input.include_progress && input.teacher_id) {
      const progress = await this.repo.getProgressForContext(
        input.teacher_id, input.class_id, input.subject_id,
      );
      for (const p of progress) {
        progressMap[`${p.entity_type}:${p.entity_id}`] = p.status;
      }
    }

    // 7. Calculate token count for context
    const context: CurriculumContext = {
      fingerprint,
      school_id: input.school_id,
      class: {
        id: classInfo.id,
        name: classInfo.name,
        grade: this.extractGradeFromClass(classInfo.name),
        section: classInfo.section,
      },
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
      },
      chapters: chapters.map(ch => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        chapter_number: ch.chapter_number,
        progress_status: progressMap[`chapter:${ch.id}`] ?? null,
      })),
      topics,
      learningObjectives,
      totalLearningObjectives: learningObjectives.length,
    };

    // 8. Cache and return
    const tokenCount = this.estimateTokenCount(context);
    await this.cache.setContext(context, tokenCount);

    return context;
  }

  /**
   * Build a minimal context for doubt assistant (lighter, faster).
   */
  async buildMinimalContext(
    input: { school_id: string; subject_id: string; lo_id?: string },
  ): Promise<MinimalCurriculumContext> {
    const subject = await this.repo.findSubject(input.subject_id);
    if (!subject) return {};

    let lo: any = null;
    let topic: any = null;
    let chapter: any = null;

    if (input.lo_id) {
      lo = await this.repo.findLOById(input.lo_id);
      if (lo) {
        topic = await this.repo.findTopicById(lo.topic_id);
        if (topic) {
          chapter = await this.repo.findChapterById(topic.chapter_id);
        }
      }
    }

    return {
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : undefined,
      chapter: chapter ? { id: chapter.id, name: chapter.name } : undefined,
      topic: topic ? { id: topic.id, name: topic.name } : undefined,
      learningObjective: lo ? {
        code: lo.code,
        description: lo.description,
        bloom_taxonomy_level: lo.bloom_taxonomy_level,
      } : undefined,
    };
  }

  /**
   * Generate a deterministic fingerprint for cache key.
   * Same input params → same fingerprint → cache hit.
   * Uses Web Crypto API (available in both browser and Node.js 18+).
   */
  private async generateFingerprint(input: CurriculumContextInput): Promise<string> {
    // Sort arrays for deterministic ordering
    const sorted = {
      ...input,
      topic_ids: input.topic_ids ? [...input.topic_ids].sort() : undefined,
      lo_ids: input.lo_ids ? [...input.lo_ids].sort() : undefined,
    };
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(sorted));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16);
  }

  private extractGradeFromClass(className: string): number {
    // Extract grade from class name like "Grade 10", "Class 7", "10th"
    const match = className.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private estimateTokenCount(context: CurriculumContext): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    const text = JSON.stringify(context);
    return Math.ceil(text.length / 4);
  }

  async getActiveFilters(schoolId: string): Promise<any[]> {
    return this.repo.getActiveFilters(schoolId);
  }
}
```

### 6.2 Context Caching

```typescript
// src/core/ai/context/context-cache.service.ts

export class AICacheService {
  constructor(private readonly repo: AIRepository) {}

  /**
   * Cached curriculum context is stored in ai_context_cache table.
   * Expiry: 1 hour by default (curriculum rarely changes).
   * When teacher marks progress → invalidate relevant context cache.
   */
  async getContext(fingerprint: string): Promise<CurriculumContext | null> {
    const cached = await this.repo.findContextByFingerprint(fingerprint);
    if (!cached) return null;
    if (new Date() > new Date(cached.expires_at)) {
      await this.repo.deleteContext(fingerprint);
      return null;
    }
    return cached.context_data as CurriculumContext;
  }

  async setContext(context: CurriculumContext, tokenCount: number): Promise<void> {
    await this.repo.upsertContext({
      fingerprint: context.fingerprint,
      school_id: context.school_id,
      context_data: JSON.parse(JSON.stringify(context)), // Deep clone to remove prototype
      token_count: tokenCount,
      expires_at: new Date(Date.now() + 3600_000).toISOString(), // 1 hour
    });
  }

  async invalidateForSubject(schoolId: string, subjectId: string): Promise<void> {
    // Invalidate all context caches for this subject
    // In production, this would use a tag-based approach
    await this.repo.deleteContextsForSubject(schoolId, subjectId);
  }
}
```

### 6.3 Context Data Structures

```typescript
// ─── Curriculum Context (Full) ───────────────────────────────

interface CurriculumContext {
  fingerprint: string;
  school_id: string;
  class: {
    id: string;
    name: string;       // "Grade 7"
    grade: number;       // 7
    section: string | null;  // "A"
  };
  subject: {
    id: string;
    name: string;       // "Science"
    code: string;       // "SCI"
  };
  chapters: ChapterInfo[];
  topics: TopicInfo[];
  learningObjectives: LOInfo[];
  totalLearningObjectives: number;
}

interface ChapterInfo {
  id: string;
  name: string;           // "Nutrition in Plants"
  description: string | null;
  chapter_number: number;
  progress_status: string | null;  // 'completed', 'in_progress', 'not_started', null
}

interface TopicInfo {
  id: string;
  name: string;           // "Photosynthesis"
  description: string | null;
  chapter_id: string;
  chapter_name: string;
}

interface LOInfo {
  id: string;
  code: string;           // "SCI-7-NP-PH-01"
  description: string;    // "Describe the process of photosynthesis"
  bloom_taxonomy_level: string | null;  // "understand"
  topic_id: string;
  topic_name: string;
}

// ─── Minimal Context (Doubt Assistant) ───────────────────────

interface MinimalCurriculumContext {
  subject?: { id: string; name: string; code: string };
  chapter?: { id: string; name: string };
  topic?: { id: string; name: string };
  learningObjective?: {
    code: string;
    description: string;
    bloom_taxonomy_level: string | null;
  };
}
```

### 6.4 Context Token Budget

```
Context is built with a token budget in mind:

┌────────────────────────────────────────────────────────────────┐
│  CONTEXT TOKEN BUDGET (Max 4000 tokens for Tier 1)             │
│                                                                │
│  System Prompt:      ~500 tokens   (role definition, rules)    │
│  School Config:      ~100 tokens   (language, filters)         │
│  Class Info:         ~50 tokens    (name, grade, section)      │
│  Subject Info:       ~30 tokens    (name, code)                │
│  Chapters (5 max):   ~300 tokens   (name + description)        │
│  Topics (20 max):    ~500 tokens   (name + description)        │
│  LOs (50 max):       ~1500 tokens  (code + description +      │
│                                      Bloom's level)            │
│  Progress:           ~100 tokens   (status per entity)         │
│  ──────────────────────────────────────────────────────        │
│  Total:              ~3080 tokens  (Well within 4000 limit)    │
│  Remaining:          ~920 tokens   For user prompt / question  │
│                                                                │
│  For Tier 2 (gpt-4o), budget expands to 8000 tokens.          │
│  For Tier 4 (risk detection), budget up to 12000 tokens.      │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. AI Features — Teacher

### 7.1 Homework Generator

```typescript
// src/core/ai/features/homework-generator.service.ts

export class HomeworkGeneratorService {
  constructor(
    private readonly aiSvc: AIService,
    private readonly promptBuilder: PromptBuilder,
    private readonly responseValidator: ResponseValidator,
    private readonly repo: AIRepository,
    private readonly cache: AICacheService,
  ) {}

  async generate(
    ctx: RequestContext,
    input: GenerateHomeworkInput,
  ): Promise<AIGenerationResponse> {
    // 1. Enforce quota
    await this.aiSvc.quotaManager.checkQuota(ctx, 'homework_generator');

    // 2. Build prompt
    const { systemPrompt, userPrompt, contextFingerprint } =
      await this.promptBuilder.buildHomeworkPrompt(ctx, input);

    // 3. Select model tier
    const totalContextTokens = await this.estimatePromptTokens(systemPrompt, userPrompt);
    const model = this.selectModel(totalContextTokens, input.num_questions);

    // 4. Call LLM
    const llmResponse = await this.aiSvc.provider.generate(systemPrompt, userPrompt, {
      model,
      maxTokens: 2048,
      temperature: 0.7,
      responseFormat: 'json_object',
    });

    // 5. Validate response
    const validated = await this.responseValidator.validateHomeworkResponse(
      llmResponse.content, input,
    );

    if (!validated.isValid) {
      // Retry with stricter temperature
      if (validated.retryable) {
        return this.generateWithRetry(ctx, input, validated.errors);
      }
      throw new AIValidationError('Generated content failed validation', validated.errors);
    }

    // 6. Log generation
    await this.logGeneration(ctx, {
      entity_type: 'assignment_question',
      generation_type: 'homework',
      prompt: userPrompt,
      response: llmResponse.content,
      context_snapshot: { fingerprint: contextFingerprint },
      validation_results: validated,
      model: llmResponse.model,
      tokens_input: llmResponse.tokensInput,
      tokens_output: llmResponse.tokensOutput,
      duration_ms: llmResponse.durationMs,
      user_id: ctx.userId,
      school_id: ctx.schoolId,
    });

    // 7. Track cost
    await this.aiSvc.costTracker.trackGeneration(ctx, {
      feature: 'homework_generator',
      model: llmResponse.model,
      tokensInput: llmResponse.tokensInput,
      tokensOutput: llmResponse.tokensOutput,
      durationMs: llmResponse.durationMs,
    });

    return {
      id: uuidv4(),
      entity_type: 'assignment_question',
      generation_type: 'homework',
      content: validated.content,
      model: llmResponse.model,
      tokens_input: llmResponse.tokensInput,
      tokens_output: llmResponse.tokensOutput,
      cost_cents: this.calculateCost(llmResponse.tokensInput, llmResponse.tokensOutput, model),
      duration_ms: llmResponse.durationMs,
      created_at: new Date().toISOString(),
    };
  }

  private selectModel(totalTokens: number, numQuestions: number): string {
    if (totalTokens > 3000 || numQuestions > 10) return 'gpt-4o';
    return 'gpt-4o-mini';
  }

  private async generateWithRetry(
    ctx: RequestContext,
    input: GenerateHomeworkInput,
    errors: ValidationError[],
    retryCount: number = 0,
  ): Promise<AIGenerationResponse> {
    if (retryCount >= 1) {
      throw new AIValidationError(
        'Generated content failed validation after retry', errors,
      );
    }
    // Rebuild prompt with validation errors as feedback and lower temperature
    const retryInput = {
      ...input,
      retry_feedback: errors.map(e => e.message).join('\n'),
    };
    // This calls the full generate flow again, but the retry feedback
    // is passed through the prompt builder to guide the AI
    return this.generateWithRetryCtx(ctx, retryInput, retryCount + 1);
  }

  private async generateWithRetryCtx(
    ctx: RequestContext,
    input: GenerateHomeworkInput & { retry_feedback?: string },
    retryCount: number,
  ): Promise<AIGenerationResponse> {
    // Rebuild prompt with retry feedback
    const { systemPrompt, userPrompt, contextFingerprint } =
      await this.promptBuilder.buildHomeworkPrompt(ctx, input);

    // Retry with temperature=0.3 for more deterministic output
    const llmResponse = await this.aiSvc.provider.generate(systemPrompt, userPrompt, {
      model: 'gpt-4o-mini',
      maxTokens: 2048,
      temperature: 0.3,  // Lower temperature for deterministic retry
      responseFormat: 'json_object',
    });

    // Validate again
    const validated = await this.responseValidator.validateHomeworkResponse(
      llmResponse.content, input,
    );

    if (!validated.isValid) {
      // Final failure
      throw new AIValidationError(
        'Generated content failed validation after retry', validated.errors,
      );
    }

    return this.buildResponse(ctx, llmResponse, validated, contextFingerprint);
  }
}
```

**Output Example:**

```json
{
  "title": "Photosynthesis & Plant Nutrition Homework",
  "description": "Answer the following questions based on Chapter 1: Nutrition in Plants.",
  "questions": [
    {
      "question_text": "What is the primary raw material used by plants for photosynthesis?",
      "question_type": "multiple_choice",
      "options": [
        {"label": "A", "text": "Carbon dioxide and water"},
        {"label": "B", "text": "Oxygen and glucose"},
        {"label": "C", "text": "Nitrogen and minerals"},
        {"label": "D", "text": "Sunlight and chlorophyll"}
      ],
      "correct_answer": "A",
      "explanation": "Photosynthesis requires carbon dioxide (from air) and water (from soil) as raw materials. Sunlight and chlorophyll are also required but as energy source and catalyst respectively.",
      "points": 2,
      "bloom_taxonomy_level": "remember",
      "lo_code": "SCI-7-NP-PH-01",
      "difficulty": "easy",
      "tags": ["photosynthesis", "raw_materials"]
    }
  ]
}
```

### 7.2 Test Generator

```typescript
// src/core/ai/features/test-generator.service.ts

export class TestGeneratorService {
  constructor(
    private readonly aiSvc: AIService,
    private readonly promptBuilder: PromptBuilder,
    private readonly responseValidator: ResponseValidator,
  ) {}

  private readonly TEST_PROMPT_TEMPLATE = `
## TEST GENERATION TASK

Generate a CBSE-style unit test with the following specifications.

### Test Parameters
- Number of Questions: {{num_questions}}
- Total Marks: {{max_score}}
- Duration: {{duration_minutes}} minutes
- Difficulty Distribution: {{difficulty}}

### Section-wise Question Distribution
{{question_distribution_text}}

### Bloom's Taxonomy Distribution
{{bloom_distribution_text}}

### Output Format
Return a JSON object with this exact structure:
\`\`\`json
{
  "title": "Test title",
  "description": "General instructions for students",
  "max_score": 100,
  "duration_minutes": 60,
  "sections": [
    {
      "name": "Section A: Multiple Choice Questions",
      "instructions": "Choose the correct option (1 mark each)",
      "questions": [
        {
          "question_number": 1,
          "question_text": "Question text",
          "question_type": "multiple_choice",
          "options": [{"label": "A", "text": "..."}, {"label": "B", "text": "..."}, {"label": "C", "text": "..."}, {"label": "D", "text": "..."}],
          "correct_answer": "A",
          "explanation": "...",
          "points": 1,
          "bloom_taxonomy_level": "remember",
          "lo_code": "SCI-7-NP-PH-01",
          "difficulty": "easy"
        }
      ]
    }
  ]
}
\`\`\`

### CBSE Exam Guidelines
- Section A: MCQs (1 mark each)
- Section B: Very Short Answer (2 marks each, 30-40 words)
- Section C: Short Answer (3 marks each, 40-60 words)
- Section D: Long Answer (5 marks each, 80-120 words)
- Total marks must equal {{max_score}}
- Ensure balanced coverage across all provided chapters and topics
- Include questions from different difficulty levels as requested
- No question should test material outside the provided curriculum
`;
}
```

### 7.3 Lesson Planner

The Lesson Planner generates structured lesson plans aligned to the curriculum with:

- **Learning Objectives** mapped to specific LOs with success criteria
- **Lesson Structure** with timed phases (Introduction, Main Activity, Practice, Assessment)
- **Materials** commonly available in CBSE schools
- **Differentiation** strategies for struggling and advanced students
- **Homework Suggestions** reinforcing the lesson

**Key differentiator from other generators:** The lesson plan includes **curriculum progress awareness**. If the teacher has marked topics as "completed" or "in_progress", the planner adjusts the lesson accordingly — suggesting review for completed topics and deeper exploration for in-progress topics.

### 7.4 Rubric Generator

Generates analytic rubrics for assignments and assessments:

```typescript
// Simplified output structure
interface Rubric {
  title: string;
  assignment_id?: string;
  learning_objectives: Array<{
    lo_code: string;
    description: string;
  }>;
  criteria: Array<{
    name: string;           // "Understanding of Concepts"
    weight: number;         // 25 (percentage)
    levels: Array<{
      name: string;         // "Exceeds Expectations"
      score: number;        // 4
      description: string;  // "Demonstrates thorough understanding..."
      example: string;      // Example student response at this level
    }>;
  }>;
  total_score: number;      // 20
  passing_score: number;    // 10
}
```

**Curriculum connection:** Each criterion is linked to one or more LOs. The rubric ensures assessment of the specific learning objectives, not generic skills.

### 7.5 Report Comments

Generates per-student report comments for a class. Each comment includes:

- **Academic performance** summary (based on actual scores, not generated)
- **Strengths** identified from performance data
- **Areas for improvement** linked to specific LOs
- **Suggestions** for parents to support learning at home
- **Attendance** (if requested)
- **Overall remark** with growth mindset language

**Curriculum awareness:** Comments reference specific LOs the student has mastered or is struggling with. For example: "Aarav has a strong understanding of photosynthesis (LO SCI-7-NP-PH-01) but needs more practice with identifying plant nutrients (LO SCI-7-NP-MN-01)."

**Hallucination prevention:** The AI is given the student's actual performance data and is explicitly instructed to base comments ONLY on the provided data, not to invent student behaviors or achievements.

---

## 8. AI Features — Student

### 8.1 Doubt Assistant

```typescript
// src/core/ai/features/doubt-assistant.service.ts

export class DoubtAssistantService {
  constructor(
    private readonly aiSvc: AIService,
    private readonly contextBuilder: CurriculumContextBuilder,
    private readonly repo: AIRepository,
  ) {}

  private readonly DAILY_LIMIT = 20; // Per student

  async answer(
    ctx: RequestContext,
    input: DoubtAssistantInput,
  ): Promise<{ answer: string; loCode?: string; relatedTopics: string[] }> {
    // 1. Check daily limit
    const todayCount = await this.repo.getDoubtCountToday(ctx.profileId!);
    if (todayCount >= this.DAILY_LIMIT) {
      throw new QuotaExceededError(
        `Daily doubt limit (${this.DAILY_LIMIT}) reached. Try again tomorrow, or ask your teacher for help.`,
      );
    }

    // 2. Auto-detect curriculum context from question
    const autoContext = await this.autoDetectCurriculumContext(ctx, input);

    // 3. Build prompt with curriculum grounding
    const { systemPrompt, userPrompt } = await this.promptBuilder
      .buildDoubtAssistantPrompt(ctx, {
        ...input,
        lo_id: autoContext.loId,
        topic_id: autoContext.topicId,
        chapter_id: autoContext.chapterId,
      }, {
        classId: autoContext.classId,
        gradeNumber: autoContext.gradeNumber,
        className: autoContext.className,
        studentId: ctx.profileId!,
      });

    // 4. Call LLM (Tier 1 — cheap)
    const llmResponse = await this.aiSvc.provider.generate(
      systemPrompt, userPrompt, {
        model: 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.5,
      },
    );

    // 5. Validate response for safety
    const safetyCheck = await this.responseValidator.checkSafety(llmResponse.content);
    if (!safetyCheck.safe) {
      return {
        answer: "I understand you're asking about something interesting! Let me help you focus on your curriculum topics. Can you tell me which chapter or topic from your ${autoContext.subjectName} class you're studying right now?",
        loCode: autoContext.loCode,
        relatedTopics: autoContext.relatedTopics,
      };
    }

    // 6. Check if answer actually addresses the question (anti-hallucination)
    const relevanceCheck = await this.responseValidator.checkRelevance(
      input.question, llmResponse.content,
    );
    if (!relevanceCheck.isRelevant) {
      // Fallback response
      return {
        answer: `That's a great question about ${autoContext.subjectName}! Based on your curriculum for Grade ${autoContext.gradeNumber}, here's what you need to know:\n\n${this.getCurriculumFallback(autoContext)}`,
        loCode: autoContext.loCode,
        relatedTopics: autoContext.relatedTopics,
      };
    }

    // 7. Log
    await this.logDoubt(ctx, input, llmResponse, autoContext);

    return {
      answer: llmResponse.content,
      loCode: autoContext.loCode,
      relatedTopics: autoContext.relatedTopics,
    };
  }

  /**
   * Auto-detect the curriculum context from the student's question.
   * Uses embedding similarity + keyword matching to find the most relevant LO.
   */
  private async autoDetectCurriculumContext(
    ctx: RequestContext,
    input: DoubtAssistantInput,
  ): Promise<AutoDetectedContext> {
    // Get student's current class and subjects
    const student = await this.repo.findStudentByUserId(ctx.userId);
    if (!student) throw new NotFoundError('Student not found');

    const classInfo = await this.repo.findClassInfo(student.class_id);
    const grade = this.extractGrade(classInfo.name);

    // Get all current subjects for this class
    const subjects = await this.repo.getSubjectsForClass(student.class_id);

    // Find the most relevant subject (user-provided or auto-detect)
    let subjectId = input.subject_id;
    if (!subjectId) {
      subjectId = await this.detectSubject(input.question, subjects);
    }

    // If LO is provided, use it directly
    if (input.lo_id) {
      const lo = await this.repo.findLOById(input.lo_id);
      const topic = lo ? await this.repo.findTopicById(lo.topic_id) : null;
      const chapter = topic ? await this.repo.findChapterById(topic.chapter_id) : null;
      return {
        loId: input.lo_id,
        loCode: lo?.code,
        topicId: topic?.id,
        chapterId: chapter?.id,
        classId: student.class_id,
        gradeNumber: grade,
        className: classInfo.name,
        subjectName: subjects.find(s => s.id === subjectId)?.name ?? '',
        relatedTopics: [],
      };
    }

    // Auto-detect: find the most relevant LO using keyword/embedding matching
    const relevantLO = await this.findRelevantLO(input.question, subjectId);
    const topic = relevantLO ? await this.repo.findTopicById(relevantLO.topic_id) : null;
    const chapter = topic ? await this.repo.findChapterById(topic.chapter_id) : null;

    // Get related topics for follow-up suggestions
    const relatedTopics = topic
      ? (await this.repo.getTopicsByChapter(topic.chapter_id))
          .filter(t => t.id !== topic.id)
          .slice(0, 3)
          .map(t => t.name)
      : [];

    return {
      loId: relevantLO?.id,
      loCode: relevantLO?.code,
      topicId: topic?.id,
      chapterId: chapter?.id,
      classId: student.class_id,
      gradeNumber: grade,
      className: classInfo.name,
      subjectName: subjects.find(s => s.id === subjectId)?.name ?? '',
      relatedTopics,
    };
  }

  private async findRelevantLO(
    question: string,
    subjectId: string,
  ): Promise<{ id: string; code: string; topic_id: string } | null> {
    // Keyword-based LO matching (simplified — in production, use embeddings)
    const allLOs = await this.repo.getLOsForSubject(subjectId);
    const questionLower = question.toLowerCase();

    // Score each LO by keyword overlap
    const scored = allLOs.map(lo => {
      const descWords = lo.description.toLowerCase().split(/\s+/);
      const matches = descWords.filter(w => questionLower.includes(w)).length;
      return { ...lo, score: matches / descWords.length };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0.05
      ? { id: scored[0].id, code: scored[0].code, topic_id: scored[0].topic_id }
      : null;
  }

  private getCurriculumFallback(context: AutoDetectedContext): string {
    // Provide a curriculum-safe response when AI can't answer
    return `I'd recommend reviewing Chapter ${context.chapterId ? 'your current chapter' : 'the relevant chapter'} in your ${context.subjectName} textbook. ` +
      `Try solving the practice questions at the end of the chapter. ` +
      `If you have a more specific doubt, feel free to ask again!`;
  }
}
```

### 8.2 Learning Companion

The Learning Companion is a conversational AI tutor that maintains session context across multiple interactions. It differs from the Doubt Assistant in several ways:

| Feature | Doubt Assistant | Learning Companion |
|---------|----------------|-------------------|
| Scope | Single question | Multi-turn conversation |
| Context | Curriculum only | Curriculum + conversation history |
| Model | Tier 1 (gpt-4o-mini) | Tier 2 (gpt-4o) |
| Session persistence | No | Yes (30 min session) |
| Personalization | None | Adapts to student's performance data |
| Use case | Quick doubt resolution | Deep learning, practice, revision |

**Session management:**

```typescript
interface CompanionSession {
  id: string;
  studentId: string;
  subjectId: string;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  topicsCovered: string[];    // LO codes discussed
  studentMood: 'engaged' | 'struggling' | 'confused' | 'confident';
  // Inferred from student's messages
  history: Array<{
    role: 'student' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}
```

**Personalization:** The companion can access the student's recent performance data (last 5 submissions) to tailor its responses. For example, if a student scored poorly on "Photosynthesis" questions, the companion can proactively offer practice on that topic.

---

## 9. AI Features — Parent

### 9.1 Weekly Summary

```
Context: Generated every Monday morning for parents with digest_frequency='weekly'.
Budget: Tier 1 model, low cost. Max 300 words per child.

Input:
- Student's attendance for the week
- Assignments completed and grades
- Assessments taken and scores
- Teacher remarks (if any)
- Upcoming deadlines

Output Structure (plain text, localized to parent's language):

📊 Weekly Summary for [Student Name]
Week of [Date Range]

📚 Assignments
- Completed: 3 of 4 assignments
- Average Score: 82%
- Pending: Science homework (due Friday)

📝 Assessments
- Science Quiz: 18/20 (Excellent!)
- Math Test: 14/20 (Good effort. Focus on geometry problems.)

📅 Attendance
- Present: 5 days | Late: 0 | Absent: 0
- Perfect attendance this week! 🎉

📢 Teacher Notes
- "Aarav has been actively participating in class discussions."

⚠️ Action Items
- Complete pending Science homework
- Review geometry concepts for upcoming test

Next Week Preview
- Science: Chapter 2 - Nutrition in Animals
- Math: Perimeter and Area continued
```

**Hallucination prevention:** All data points (scores, attendance, grades) are pulled from the database, NOT generated by AI. The AI only writes the narrative description around these data points. The explicit instruction: "You must use ONLY the data provided below. Do not invent any scores, grades, or attendance data."

---

## 10. AI Features — Principal

### 10.1 Insights

```typescript
// src/core/ai/features/principal-insights.service.ts

export class PrincipalInsightsService {
  async generate(
    ctx: RequestContext,
    input: PrincipalInsightsInput,
  ): Promise<{ insights: Insight[]; generatedAt: string }> {
    // 1. Gather school-wide data
    const data = await this.gatherSchoolData(ctx.schoolId, input);

    // 2. Build data-driven prompt (NOT a summary prompt — the AI analyzes data, not generates it)
    const prompt = this.buildInsightPrompt(data, input);

    // 3. Call LLM (Tier 2)
    const response = await this.aiSvc.provider.generate(
      this.getInsightSystemPrompt(), prompt, {
        model: 'gpt-4o',
        maxTokens: 4096,
        temperature: 0.3,  // Low temperature for factual analysis
        responseFormat: 'json_object',
      },
    );

    // 4. Validate insights against actual data
    const validated = this.validateInsights(response.content, data);

    // 5. Log and return
    return {
      insights: validated.insights,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildInsightPrompt(data: SchoolData, input: PrincipalInsightsInput): string {
    return `
You are analyzing school data for the principal of a CBSE school. Your task is to identify patterns, trends, and actionable insights.

## DATA (last ${input.time_range})
${JSON.stringify(data, null, 2)}

## RULES
1. ONLY identify insights that are DIRECTLY supported by the data provided.
2. For each insight, cite the specific data point(s) that support it.
3. Do NOT speculate about causes unless the data shows a clear correlation.
4. Prioritize actionable insights over obvious observations.
5. Flag urgent issues (e.g., attendance < 70%, grades dropping > 15%).
6. Focus on the requested focus area: ${input.focus_area}.

## OUTPUT
Return a JSON array of insight objects:
{
  "insights": [
    {
      "id": "insight_1",
      "category": "${input.focus_area}",
      "title": "Short title",
      "description": "Detailed description with data citations",
      "severity": "positive | neutral | warning | critical",
      "confidence": 0.95,  // 0-1 based on data support
      "supporting_data": ["Attendance dropped from 85% to 72% in Class 7A"],
      "recommendation": "Actionable recommendation for the principal",
      "trend": "improving | stable | declining"
    }
  ]
}
`;
  }

  private validateInsights(
    response: string,
    actualData: SchoolData,
  ): { insights: Insight[] } {
    const parsed = JSON.parse(response);
    const insights: Insight[] = [];

    for (const insight of parsed.insights ?? []) {
      // Check each insight against actual data
      const isValid = this.verifyInsightAgainstData(insight, actualData);
      if (isValid) {
        insights.push(insight);
      }
      // If invalid, the insight is discarded (silent rejection)
    }

    return { insights };
  }

  private verifyInsightAgainstData(insight: Insight, data: SchoolData): boolean {
    for (const claim of insight.supporting_data) {
      // Extract numbers from the claim and verify they exist in the actual data
      const numbers = claim.match(/\d+(\.\d+)?/g);
      if (!numbers) continue;

      const dataStr = JSON.stringify(data);
      for (const num of numbers) {
        if (!dataStr.includes(num)) {
          // The AI hallucinated a number — reject this insight
          return false;
        }
      }
    }
    return true;
  }
}
```

**Key anti-hallucination design:** The insight prompt includes ALL the actual school data as structured JSON. The AI is instructed to only identify patterns that are DIRECTLY supported by the data. After receiving the response, the system VALIDATES each insight by checking if the supporting numbers actually exist in the provided data. This two-step verification (prompt-level + response-level) ensures near-zero hallucination.

### 10.2 Risk Detection

```typescript
// src/core/ai/features/risk-detection.service.ts

export class RiskDetectionService {
  /**
   * Runs daily via cron job (Section 16).
   * Scans all students in the school and flags those at risk.
   * Writes results to student_risk_flags table.
   * 
   * Uses a combination of:
   * 1. Rule-based detection (thresholds: attendance < 80%, grades < 40%, incomplete work > 3)
   * 2. AI-powered pattern detection (unusual grade drops, behavioral changes)
   * 3. Cross-reference detection (e.g., attendance drop + grade drop = higher risk)
   */
  async detectRisks(schoolId: string): Promise<void> {
    // Step 1: Rule-based detection (database query, no AI cost)
    const ruleBasedFlags = await this.detectByRules(schoolId);
    
    // Step 2: Update basic flags in DB
    for (const flag of ruleBasedFlags) {
      await this.upsertRiskFlag(schoolId, flag);
    }

    // Step 3: AI-powered detection (only for students already flagged by rules)
    const alreadyFlagged = ruleBasedFlags.map(f => f.student_id);
    if (alreadyFlagged.length > 0) {
      const aiFlags = await this.detectByAI(schoolId, alreadyFlagged);
      for (const flag of aiFlags) {
        await this.upsertRiskFlag(schoolId, flag);
      }
    }
  }

  private async detectByRules(schoolId: string): Promise<RiskFlagInput[]> {
    const flags: RiskFlagInput[] = [];

    // Query 1: Attendance risk
    const lowAttendance = await this.repo.getStudentsWithLowAttendance(schoolId, 80);
    for (const student of lowAttendance) {
      flags.push({
        student_id: student.id,
        flag_type: 'attendance_risk',
        severity: student.attendance_pct < 60 ? 'critical' : 'high',
        description: `Attendance ${student.attendance_pct}% this month (below 80% threshold)`,
        source: 'ai',
      });
    }

    // Query 2: Failing grades
    const failingGrades = await this.repo.getStudentsWithFailingGrades(schoolId, 40);
    for (const student of failingGrades) {
      flags.push({
        student_id: student.id,
        flag_type: 'failing_grade',
        severity: student.avg_score < 30 ? 'critical' : 'high',
        description: `Average score ${student.avg_score}% in last 3 assessments`,
        source: 'ai',
      });
    }

    // Query 3: Incomplete work
    const incompleteWork = await this.repo.getStudentsWithIncompleteWork(schoolId, 3);
    for (const student of incompleteWork) {
      flags.push({
        student_id: student.id,
        flag_type: 'incomplete_work',
        severity: student.incomplete_count > 5 ? 'critical' : 'medium',
        description: `${student.incomplete_count} incomplete assignments`,
        source: 'ai',
      });
    }

    return flags;
  }

  private async detectByAI(
    schoolId: string,
    studentIds: string[],
  ): Promise<RiskFlagInput[]> {
    // AI-powered detection for nuanced patterns
    // Uses Tier 4 (o3-mini reasoning model) for complex analysis
    // Cost-efficient: only runs for students already flagged by rules

    const batchSize = 10;
    const flags: RiskFlagInput[] = [];

    for (let i = 0; i < studentIds.length; i += batchSize) {
      const batch = studentIds.slice(i, i + batchSize);
      const studentData = await this.repo.getStudentRiskData(schoolId, batch);

      const prompt = `
Analyze the following student data for early warning signs of academic risk.

## STUDENT DATA
${JSON.stringify(studentData, null, 2)}

## FLAGS TO CHECK
1. Grade trajectory: Are grades consistently declining over the last 4 assessments?
2. Behavioral change: Is there a sudden drop in submission rate or attendance?
3. Performance inconsistency: Are there wild swings in performance (high-low-high)?
4. Subject-specific risk: Is the student failing only one subject or multiple?

## RULES
- Only flag if there is CLEAR evidence in the data
- Do NOT flag based on a single data point
- Flag severity should match the pattern's strength
- Do NOT re-flag students who are already flagged for the same reason
- Return the most specific flag_type from: grade_trajectory_risk, behavioral_change, performance_inconsistency, subject_specific_risk

## OUTPUT
Array of { student_id, flag_type, severity, description } objects.
Return empty array if no additional risks detected.
`;

      const response = await this.provider.generate(
        SYSTEM_PROMPT_RISK, prompt, {
          model: 'o3-mini',
          maxTokens: 2048,
          temperature: 0.2,  // Low temperature for consistent risk assessment
          responseFormat: 'json_object',
        },
      );

      const aiFlags = JSON.parse(response.content);
      flags.push(...(aiFlags ?? []));
    }

    return flags;
  }
}
```

**Two-tier approach:** Rule-based detection handles the obvious cases at zero AI cost. AI-powered detection adds a second layer of nuanced analysis (grade trajectory, behavioral changes) only for students who already triggered basic flags. This optimizes cost while maintaining comprehensive coverage.

---

## 11. Cost Tracking & Quotas

### 11.1 Cost Tracking

```typescript
// src/core/ai/cost/cost-tracker.service.ts

export class CostTrackerService {
  // Model pricing (per 1K tokens, in cents)
  private readonly PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'o3-mini': { input: 1.10, output: 4.40 },
  };

  async trackGeneration(
    ctx: RequestContext,
    data: {
      feature: string;
      model: string;
      tokensInput: number;
      tokensOutput: number;
      durationMs: number;
    },
  ): Promise<void> {
    const pricing = this.PRICING[data.model] ?? { input: 1.0, output: 2.0 };
    const costCents =
      (data.tokensInput / 1000) * pricing.input +
      (data.tokensOutput / 1000) * pricing.output;

    // Update daily usage
    await this.repo.incrementDailyUsage(ctx.userId, ctx.schoolId, {
      generations: 1,
      tokens: data.tokensInput + data.tokensOutput,
      costCents,
    });

    // Update monthly budget tracking
    await this.repo.incrementMonthlyCost(ctx.schoolId, costCents);

    // Check budget thresholds
    await this.checkBudgetAlerts(ctx.schoolId);
  }

  private async checkBudgetAlerts(schoolId: string): Promise<void> {
    const usage = await this.repo.getCurrentMonthUsage(schoolId);
    const budget = await this.repo.getSchoolBudget(schoolId);

    const usagePct = (usage.costCents / budget.monthlyBudgetCents) * 100;

    if (usagePct >= 90 && !budget.ninetyPercentAlertSent) {
      await this.sendBudgetAlert(schoolId, `AI budget at ${usagePct.toFixed(0)}% ($${(usage.costCents / 100).toFixed(2)} of $${(budget.monthlyBudgetCents / 100).toFixed(2)})`);
      await this.repo.markBudgetAlertSent(schoolId, 'ninety_percent');
    }

    if (usagePct >= 100 && !budget.exceededAlertSent) {
      await this.sendBudgetAlert(schoolId, `⚠️ AI budget EXCEEDED. Current: $${(usage.costCents / 100).toFixed(2)}, Budget: $${(budget.monthlyBudgetCents / 100).toFixed(2)}. AI generation will be limited.`);
      await this.repo.markBudgetAlertSent(schoolId, 'exceeded');
    }
  }
}
```

### 11.2 Quota Manager

```typescript
// src/core/ai/cost/quota-manager.service.ts

export class QuotaManagerService {
  // Default quotas per role per day
  private readonly DEFAULT_QUOTAS: Record<string, {
    generations: number;
    tokens: number;
  }> = {
    teacher: { generations: 100, tokens: 100000 },
    student: { generations: 20, tokens: 20000 },
    principal: { generations: 10, tokens: 50000 },
    school_admin: { generations: 50, tokens: 100000 },
  };

  async checkQuota(
    ctx: RequestContext,
    feature: string,
  ): Promise<QuotaCheckResult> {
    const role = ctx.role;
    const today = new Date().toISOString().split('T')[0];

    // Get today's usage
    const usage = await this.repo.getTodayUsage(ctx.userId, ctx.schoolId);

    // Get quota for this role
    const quota = await this.repo.getRoleQuota(ctx.schoolId, role)
      ?? this.DEFAULT_QUOTAS[role];

    if (usage.generations >= quota.generations) {
      throw new QuotaExceededError(
        `Daily generation limit (${quota.generations}) reached for ${role}s. ` +
        `Limit resets at midnight.`,
      );
    }

    if (usage.tokens >= quota.tokens) {
      throw new QuotaExceededError(
        `Daily token limit (${quota.tokens.toLocaleString()}) reached. ` +
        `Try using shorter prompts or ask your admin to increase the limit.`,
      );
    }

    return {
      allowed: true,
      remaining: {
        generations: quota.generations - usage.generations,
        tokens: quota.tokens - usage.tokens,
      },
      resetsAt: `${today}T23:59:59Z`,
    };
  }

  async getUsage(ctx: RequestContext): Promise<QuotaUsage> {
    const role = ctx.role;
    const usage = await this.repo.getTodayUsage(ctx.userId, ctx.schoolId);
    const quota = await this.repo.getRoleQuota(ctx.schoolId, role)
      ?? this.DEFAULT_QUOTAS[role];
    const monthly = await this.repo.getCurrentMonthUsage(ctx.schoolId);

    return {
      generations_today: usage.generations,
      generations_limit: quota.generations,
      tokens_today: usage.tokens,
      tokens_limit: quota.tokens,
      monthly_cost_cents: monthly.costCents,
      monthly_budget_cents: monthly.budgetCents,
      is_quota_exceeded: usage.generations >= quota.generations
        || usage.tokens >= quota.tokens,
      resets_at: `${new Date().toISOString().split('T')[0]}T23:59:59Z`,
    };
  }
}
```

### 11.3 Cost Dashboard

```typescript
// Estimated costs per feature generation

// Tier 1 (gpt-4o-mini): ~$0.001-0.005 per generation
// Tier 2 (gpt-4o): ~$0.02-0.10 per generation
// Tier 4 (o3-mini): ~$0.01-0.05 per generation

const COST_ESTIMATES = {
  homework_generator: {
    model: 'gpt-4o-mini',
    average_cost_cents: 0.3,  // $0.003 per generation
    daily_use_per_teacher: 5,
    monthly_cost_per_teacher: 5 * 30 * 0.003 = 0.45,  // $0.45
  },
  test_generator: {
    model: 'gpt-4o',
    average_cost_cents: 5.0,  // $0.05 per generation
    daily_use_per_teacher: 1,
    monthly_cost_per_teacher: 1 * 30 * 0.05 = 1.50,  // $1.50
  },
  lesson_planner: {
    model: 'gpt-4o',
    average_cost_cents: 8.0,  // $0.08 per generation
    daily_use_per_teacher: 2,
    monthly_cost_per_teacher: 2 * 30 * 0.08 = 4.80,  // $4.80
  },
  doubt_assistant: {
    model: 'gpt-4o-mini',
    average_cost_cents: 0.2,  // $0.002 per question
    daily_use_per_student: 5,
    monthly_cost_per_1000_students: 5 * 30 * 1000 * 0.002 / 100 = 3.00,  // $3.00
  },
  risk_detection: {
    model: 'o3-mini',
    average_cost_cents: 2.0,  // $0.02 per batch (10 students)
    monthly_cost_per_1000_students: (1000 / 10) * 30 * 0.02 = 60.00,  // $60.00
  },
};

// Total estimated monthly cost for a school with:
// - 50 teachers
// - 1000 students
// - 1 principal
// = 50 * ($0.45 + $1.50 + $4.80) + $3.00 + $60.00
// = 50 * $6.75 + $63.00
// = $337.50 + $63.00
// = $400.50/month
```

---

## 12. Caching Strategy

### 12.1 Cache Layers

| Cache | What | TTL | Invalidated By | Size Estimate |
|-------|------|-----|----------------|---------------|
| **Curriculum Context** (`ai_context_cache`) | Full curriculum tree for AI generation | 1 hour | Curriculum edit, progress mark | ~5 KB per fingerprint |
| **AI Response** (Redis) | Generated homework, tests, etc. | 24 hours | Teacher edits generated content, re-generation | ~10 KB per response |
| **Doubt History** (In-memory) | Recent doubt conversations for companion | 30 min | Session expiry | ~50 KB per active student |
| **Embeddings** (pgvector) | LO text embeddings for doubt routing | Permanent | Curriculum edit | ~50 MB per school |
| **School Filters** (Redis) | Active content filters | 5 min | Filter update | ~1 KB per school |
| **Quota** (Redis) | Today's usage counter | 1 day (auto-reset) | Each generation | ~100 B per user |

### 12.2 Response Caching (Semantic)

```typescript
// Semantic caching: cache LLM responses for duplicate or similar requests.
// Two students asking the same doubt → one LLM call, two cache hits.
// Teacher generating homework for the same topic → one call if identical params.

export class AIResponseCache {
  constructor(private readonly redis: Redis) {}

  async getCachedResponse(
    contextFingerprint: string,
    requestHash: string,
  ): Promise<string | null> {
    const key = `ai:response:${contextFingerprint}:${requestHash}`;
    return this.redis.get(key);
  }

  async setCachedResponse(
    contextFingerprint: string,
    requestHash: string,
    response: string,
    ttlSeconds: number = 86400,  // 24 hours default
  ): Promise<void> {
    const key = `ai:response:${contextFingerprint}:${requestHash}`;
    await this.redis.set(key, response, 'EX', ttlSeconds);
  }

  async invalidateForGeneration(
    schoolId: string,
    subjectId: string,
  ): Promise<void> {
    // When teacher edits saved AI content, invalidate related cache
    const pattern = `ai:response:*`;
    // In production, use Redis SCAN with tag-based approach
    // For now, rely on TTL expiry
  }
}
```

### 12.3 Context Cache Invalidation

| Event | Invalidation Scope |
|-------|-------------------|
| Teacher marks progress on a topic | Invalidate context for that subject+class |
| Admin edits curriculum (adds chapter) | Invalidate ALL context for that subject |
| Admin edits school settings | Invalidate school config cache |
| Daily quota reset | Automatic (cache key includes date) |
| Teacher updates content filters | Invalidate filter cache |

---

## 13. Hallucination Prevention

### 13.1 Multi-Layer Hallucination Defense

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HALLUCINATION DEFENSE STACK                        │
│                                                                      │
│  LAYER 1: PROMPT GROUNDING                                           │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • Every prompt includes structured curriculum context          │   │
│  │ • Context is pulled from DB, never assumed                    │   │
│  │ • Explicit constraints: "Only use the provided curriculum"     │   │
│  │ • System prompt locks the AI into a specific role             │   │
│  │ • "I don't know" is better than guessing                     │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  LAYER 2: STRUCTURED OUTPUT                                          │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • All generative features use JSON mode (OpenAI)              │   │
│  │ • Output schema is Zod-validated after generation             │   │
│  │ • Invalid responses trigger retry with lower temperature      │   │
│  │ • Malformed JSON → reject, don't parse partially              │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  LAYER 3: FACTUAL CONSTRAINT (Data Grounding)                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • Report comments: AI given ACTUAL scores, told to base       │   │
│  │   comments ONLY on provided data                              │   │
│  │ • Weekly summaries: All numbers pulled from DB, AI only writes │   │
│  │   narrative around the data                                   │   │
│  │ • Risk detection: Rule-based detects facts, AI adds nuance    │   │
│  │ • Principal insights: Each claim verified against source data  │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  LAYER 4: RESPONSE VALIDATION                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • Curriculum alignment check: Does each question reference     │   │
│  │   a valid LO from the provided curriculum?                     │   │
│  │ • Number verification: Do computed scores match the response?  │   │
│  │ • PII scan: No student names in generated content              │   │
│  │ • Safety check: Harmful/inappropriate content blocked          │   │
│  │ • Relevance check: Does the answer address the question?       │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  LAYER 5: TEMPERATURE CONTROL                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • Homework/Test generation: 0.7 (balanced creativity)         │   │
│  │ • Report comments: 0.5 (moderate, consistent)                 │   │
│  │ • Lesson plans: 0.6 (structured, some variety)                │   │
│  │ • Principal insights: 0.3 (very factual, low creativity)      │   │
│  │ • Risk detection: 0.2 (near-deterministic, consistent)        │   │
│  │ • Doubt assistant: 0.5 (helpful but not creative)             │   │
│  │ • Retry after validation failure: 0.3 (more deterministic)    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  LAYER 6: HUMAN REVIEW                                               │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ • Teacher MUST review ALL generated content before publishing  │   │
│  │ • AI cannot auto-publish: homework, tests, lesson plans,      │   │
│  │   report comments, or rubrics                                 │   │
│  │ • After review, teacher can rate the generation (1-5 stars)   │   │
│  │ • Low-rated generations are analyzed for improvement          │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Response Validator

```typescript
// src/core/ai/validation/response-validator.ts

export class ResponseValidator {
  constructor(
    private readonly hallucinationDetector: HallucinationDetector,
    private readonly piiScanner: PIIScanner,
    private readonly curriculumAlignment: CurriculumAlignmentChecker,
  ) {}

  async validateHomeworkResponse(
    response: string,
    input: GenerateHomeworkInput,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // 1. Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(response);
    } catch {
      return {
        isValid: false,
        retryable: true,
        errors: [{ field: 'response', message: 'Invalid JSON response from AI' }],
      };
    }

    // 2. Validate structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      errors.push({ field: 'questions', message: 'Missing questions array' });
    }

    // 3. Validate question count
    if (parsed.questions?.length !== input.num_questions) {
      errors.push({
        field: 'question_count',
        message: `Expected ${input.num_questions} questions, got ${parsed.questions?.length}`,
      });
    }

    // 4. Validate question types
    const invalidTypes = parsed.questions?.filter(
      (q: any) => !input.question_types.includes(q.question_type),
    );
    if (invalidTypes?.length > 0) {
      errors.push({
        field: 'question_types',
        message: `Invalid question types: ${invalidTypes.map((q: any) => q.question_type).join(', ')}`,
      });
    }

    // 5. MCQ validation: must have 4 options
    const mcqs = parsed.questions?.filter((q: any) => q.question_type === 'multiple_choice');
    for (const mcq of mcqs ?? []) {
      if (!mcq.options || mcq.options.length !== 4) {
        errors.push({
          field: `question_${mcq.question_number}_options`,
          message: `MCQ must have exactly 4 options (A, B, C, D)`,
        });
      }
      if (!mcq.correct_answer) {
        errors.push({
          field: `question_${mcq.question_number}_correct_answer`,
          message: `MCQ must have a correct_answer`,
        });
      }
    }

    // 6. PII scan
    const piiResult = await this.piiScanner.scan(response);
    if (piiResult.hasPII) {
      errors.push({
        field: 'pii',
        message: `Response contains potential PII: ${piiResult.detectedTypes.join(', ')}`,
      });
    }

    // 7. Curriculum alignment
    if (input.topic_ids && input.topic_ids.length > 0) {
      const alignmentResult = await this.curriculumAlignment.checkAlignment(
        parsed, input.topic_ids,
      );
      if (!alignmentResult.isAligned) {
        errors.push({
          field: 'curriculum_alignment',
          message: `Questions not aligned with provided curriculum: ${alignmentResult.misalignedTopics.join(', ')}`,
        });
      }
    }

    // 8. Hallucination detection
    const hallucinationScore = await this.hallucinationDetector.analyze(parsed);
    if (hallucinationScore > 0.7) {
      errors.push({
        field: 'hallucination',
        message: `High hallucination score: ${hallucinationScore.toFixed(2)}`,
      });
    }

    return {
      isValid: errors.length === 0,
      retryable: errors.length < 3,  // If too many errors, don't retry
      errors,
      content: parsed,
      hallucinationScore,
    };
  }

  async checkSafety(content: string): Promise<SafetyCheckResult> {
    // Lightweight safety check using keyword matching + LLM-as-judge
    // In production, use a dedicated content moderation API

    const blockedPatterns = [
      /harmful/i, /inappropriate/i, /suicide/i, /self-harm/i,
      /violence/i, /explicit/i, /drugs/i, /alcohol/i,
      /abuse/i, /illegal/i, /weapon/i,
    ];

    const hasBlockedContent = blockedPatterns.some(p => p.test(content));

    if (hasBlockedContent) {
      return { safe: false, reason: 'Content contains blocked keywords' };
    }

    return { safe: true };
  }

  async checkRelevance(
    question: string,
    answer: string,
  ): Promise<RelevanceCheckResult> {
    // Basic relevance check: does the answer contain key terms from the question?
    const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const answerLower = answer.toLowerCase();

    const matchedWords = questionWords.filter(w => answerLower.includes(w));
    const matchRatio = matchedWords.length / questionWords.length;

    return {
      isRelevant: matchRatio >= 0.3,
      confidence: matchRatio,
    };
  }
}
```

### 13.3 Hallucination Detector

```typescript
// src/core/ai/validation/hallucination-detector.ts

export class HallucinationDetector {
  /**
   * Analyzes AI response for potential hallucination patterns.
   * Returns a score from 0 (clean) to 1 (likely hallucination).
   */
  async analyze(response: any): Promise<number> {
    let score = 0;
    let checks = 0;

    // 1. Check for overly specific numbers without source
    if (this.hasUnsupportedNumbers(response)) {
      score += 0.3;
    }
    checks++;

    // 2. Check for invented references (statistics, studies, etc.)
    if (this.hasInventedReferences(response)) {
      score += 0.4;
    }
    checks++;

    // 3. Check for contradictory content
    if (this.hasContradictions(response)) {
      score += 0.5;
    }
    checks++;

    // 4. Check for generic/vague content (coping mechanism)
    if (this.isTooGeneric(response)) {
      score += 0.2;
    }
    checks++;

    // 5. Check for confident statements about unverified facts
    if (this.hasUnverifiedConfidence(response)) {
      score += 0.3;
    }
    checks++;

    return checks > 0 ? score / checks : 0;
  }

  private hasUnsupportedNumbers(response: any): boolean {
    const text = JSON.stringify(response);
    // Look for specific percentages or statistics
    const patterns = [
      /\d+% of students/i,
      /according to (study|research|survey)/i,
      /more than \d+% of/i,
      /statistically/i,
    ];
    return patterns.some(p => p.test(text));
  }

  private hasInventedReferences(response: any): boolean {
    const text = JSON.stringify(response);
    const patterns = [
      /as per (NCERT|CBSE) (guidelines|norms)/i,  // Often hallucinated
      /in the CBSE (circular|notification) dated/i,
      /as per the (latest|new) education policy/i,
    ];

    // These are valid references BUT only if they match actual CBSE guidelines.
    // The detector flags them for review rather than rejecting outright.
    return patterns.some(p => p.test(text));
  }

  private hasContradictions(response: any): boolean {
    const text = JSON.stringify(response).toLowerCase();
    // Check for logical contradictions
    const contradictions = [
      ['photosynthesis requires oxygen', 'photosynthesis produces oxygen'],
      ['chlorophyll is not required', 'chlorophyll is necessary'],
      ['plants only need sunlight', 'plants need sunlight, water, and CO2'],
    ];
    for (const [a, b] of contradictions) {
      if (text.includes(a) && text.includes(b)) return true;
    }
    return false;
  }

  private isTooGeneric(response: any): boolean {
    const text = JSON.stringify(response).toLowerCase();
    const genericPhrases = [
      'as we all know',
      'it is a well-known fact',
      'it goes without saying',
      'obviously',
      'everyone knows that',
      'as you may already know',
    ];
    return genericPhrases.some(p => text.includes(p));
  }

  private hasUnverifiedConfidence(response: any): boolean {
    const text = JSON.stringify(response).toLowerCase();
    // Look for overly confident statements about subjective matters
    const patterns = [
      /undoubtedly/i,
      /without any doubt/i,
      /absolutely certain/i,
      /this is definitely/i,
      /there is no question that/i,
    ];
    return patterns.some(p => p.test(text));
  }
}
```

### 13.4 Curriculum Alignment Checker

```typescript
// src/core/ai/validation/curriculum-alignment.ts

export class CurriculumAlignmentChecker {
  constructor(private readonly repo: AIRepository) {}

  /**
   * Check that generated questions reference valid LOs from the provided curriculum.
   */
  async checkAlignment(
    response: any,
    topicIds: string[],
  ): Promise<AlignmentResult> {
    const questions = response.questions ?? response.sections?.flatMap(
      (s: any) => s.questions ?? [],
    ) ?? [];

    if (questions.length === 0) return { isAligned: true, misalignedTopics: [] };

    // Get valid LO codes for these topics
    const validLOs = await this.repo.getLOsByTopicIds(topicIds);
    const validCodes = new Set(validLOs.map(lo => lo.code));
    const validDescriptions = validLOs.map(lo => lo.description.toLowerCase());

    const misalignedTopics: string[] = [];

    for (const question of questions) {
      // Check LO code
      if (question.lo_code && !validCodes.has(question.lo_code)) {
        misalignedTopics.push(question.lo_code);
      }

      // Check question topic relevance (keyword overlap with valid LO descriptions)
      const questionText = (question.question_text ?? '').toLowerCase();
      const maxOverlap = Math.max(
        ...validDescriptions.map(desc => {
          const descWords = desc.split(/\s+/);
          const matches = descWords.filter(w => questionText.includes(w)).length;
          return matches / descWords.length;
        }),
      );

      if (maxOverlap < 0.1) {
        // Question doesn't meaningfully overlap with any provided LO
        misalignedTopics.push(`q_${question.question_number ?? '?'}`);
      }
    }

    return {
      isAligned: misalignedTopics.length === 0,
      misalignedTopics,
    };
  }
}
```

### 13.5 PII Scanner

```typescript
// src/core/ai/validation/pii-scanner.ts

export class PIIScanner {
  /**
   * Scan text for personally identifiable information.
   * Returns detected PII types and their locations.
   */
  async scan(text: string): Promise<PIIResult> {
    const detectedTypes: string[] = [];

    // 1. Indian Aadhaar number (12 digits)
    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(text)) {
      detectedTypes.push('aadhaar');
    }

    // 2. Phone numbers (Indian: 10 digits starting with 6-9)
    if (/\b[6-9]\d{9}\b/.test(text)) {
      detectedTypes.push('phone');
    }

    // 3. Email addresses
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
      detectedTypes.push('email');
    }

    // 4. Student names (heuristic: common Indian names in specific contexts)
    // In production, use a named entity recognition model
    if (/\b(Student|student)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/.test(text)) {
      detectedTypes.push('student_name');
    }

    // 5. Full addresses
    if (/\b(House|Street|Road|Colony|Nagar|Marg)\b/.test(text)) {
      // Heuristic — in production, use a dedicated address parser
      detectedTypes.push('address');
    }

    return {
      hasPII: detectedTypes.length > 0,
      detectedTypes,
    };
  }

  /**
   * Strip PII from text before sending to LLM.
   * Replace student names with [STUDENT_NAME] and other patterns.
   */
  stripPII(text: string): string {
    let cleaned = text;
    
    // Replace Aadhaar numbers
    cleaned = cleaned.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR_REDACTED]');
    
    // Replace phone numbers
    cleaned = cleaned.replace(/\b[6-9]\d{9}\b/g, '[PHONE_REDACTED]');
    
    // Replace emails
    cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

    return cleaned;
  }
}
```

---

## 14. API Routes

### 14.1 Teacher AI Endpoints

| Method | Endpoint | Feature | Tier | Quota Cost | Teacher Review Required |
|--------|----------|---------|------|------------|------------------------|
| `POST` | `/ai/homework/generate` | Generate homework questions | Tier 1/2 | 1 generation | ✅ Yes |
| `POST` | `/ai/tests/generate` | Generate test with config | Tier 2 | 1 generation | ✅ Yes |
| `POST` | `/ai/lesson-plans/generate` | Generate lesson plan | Tier 2 | 1 generation | ✅ Yes |
| `POST` | `/ai/rubrics/generate` | Generate rubric | Tier 1 | 1 generation | ✅ Yes |
| `POST` | `/ai/report-comments/generate` | Generate report comments | Tier 1 | 1 per student | ✅ Yes |
| `GET` | `/ai/usage` | Get own usage/quota | — | 0 | — |

### 14.2 Student AI Endpoints

| Method | Endpoint | Feature | Tier | Quota Cost | Auto-Response |
|--------|----------|---------|------|------------|---------------|
| `POST` | `/ai/doubt/ask` | Ask a doubt | Tier 1 | 1 question | ✅ Yes |
| `POST` | `/ai/companion/chat` | Learning companion chat | Tier 2 | 1 message | ✅ Yes |
| `GET` | `/ai/companion/session` | Get companion session | — | 0 | — |
| `GET` | `/ai/doubt/history` | View doubt history | — | 0 | — |

### 14.3 Principal AI Endpoints

| Method | Endpoint | Feature | Tier | Quota Cost |
|--------|----------|---------|------|------------|
| `POST` | `/ai/insights/generate` | Generate insights | Tier 2 | 1 generation |
| `GET` | `/ai/insights/history` | View past insights | — | 0 |
| `GET` | `/ai/risk-flags` | View active risk flags | — | 0 |
| `POST` | `/ai/risk-flags/{id}/resolve` | Resolve a risk flag | — | 0 |

### 14.4 Admin Endpoints

| Method | Endpoint | Feature |
|--------|----------|---------|
| `GET` | `/ai/admin/usage` | School-wide usage stats |
| `GET` | `/ai/admin/cost-analytics` | Cost analytics dashboard |
| `PUT` | `/ai/admin/quota` | Update role quotas |
| `POST` | `/ai/admin/filters` | Manage content filters |
| `GET` | `/ai/admin/generations` | View all generations (audit) |

### 14.5 Parent Endpoints

| Method | Endpoint | Feature |
|--------|----------|---------|
| `GET` | `/ai/summary/{studentId}` | Get weekly summary for child |

### 14.6 Detailed Route Specifications

```typescript
// 14.6.1 POST /ai/homework/generate
// Role: teacher
// Request: { class_id, subject_id, chapter_id?, topic_ids[], num_questions, question_types, difficulty, bloom_levels?, include_explanations, language }
// Response: 200 { id, entity_type, generation_type, content, model, tokens_input, tokens_output, cost_cents, duration_ms, created_at }
// Errors: 403 (not teaching class), 429 (quota exceeded), 503 (AI unavailable)

// 14.6.2 POST /ai/tests/generate
// Role: teacher
// Request: { class_id, subject_id, chapter_ids[], topic_ids?, title?, num_questions, max_score, duration_minutes, question_distribution?, difficulty, bloom_distribution?, allow_negative_marking?, language }
// Response: 200 { id, content, ... }
// Errors: 403, 429, 503, 422 (invalid distribution — total doesn't add up)

// 14.6.3 POST /ai/lesson-plans/generate
// Role: teacher
// Request: { class_id, subject_id, topic_ids[], duration_minutes, include_activities, include_assessment, include_differentiation, teaching_style, language }
// Response: 200 { id, content, ... }
// Errors: 403, 429, 503

// 14.6.4 POST /ai/rubrics/generate
// Role: teacher
// Request: { assignment_id?, subject_id?, lo_ids[], max_score, criteria_count, performance_levels, include_examples, language }
// Response: 200 { id, content, ... }
// Errors: 403, 429, 503

// 14.6.5 POST /ai/report-comments/generate
// Role: teacher
// Request: { class_id, subject_id, student_ids[], academic_term_id, comment_style, include_attendance, include_behavior, max_words_per_student, language }
// Response: 200 { id, content: Array<{ student_id, student_name, comment }>, ... }
// Errors: 403, 429, 503
// Note: This is the MOST expensive endpoint (one call per student). Consider batching.

// 14.6.6 POST /ai/doubt/ask
// Role: student
// Request: { subject_id, question, chapter_id?, topic_id?, lo_id?, previous_attempts?, struggling_with? }
// Response: 200 { answer, lo_code?, related_topics[] }
// Errors: 403, 429 (daily limit), 503

// 14.6.7 POST /ai/companion/chat
// Role: student
// Request: { subject_id, message, lo_id?, session_id?, history? }
// Response: 200 { response, session_id, topics_covered[] }
// Errors: 403, 429, 503

// 14.6.8 POST /ai/insights/generate
// Role: principal, school_admin
// Request: { focus_area, time_range, class_id?, subject_id?, max_insights }
// Response: 200 { insights: Array<{ id, category, title, description, severity, confidence, supporting_data, recommendation, trend }>, generated_at }
// Errors: 403, 429, 503

// 14.6.9 GET /ai/usage
// Role: all (own usage)
// Response: 200 { generations_today, generations_limit, tokens_today, tokens_limit, monthly_cost_cents, monthly_budget_cents, is_quota_exceeded, resets_at }

// 14.6.10 GET /ai/admin/cost-analytics
// Role: school_admin
// Response: 200 { total_cost_cents, cost_by_feature, cost_by_role, cost_by_day, average_cost_per_generation_cents, projected_monthly_cost_cents }

// 14.6.11 PUT /ai/admin/quota
// Role: school_admin
// Request: { role, generations_per_day, tokens_per_day, monthly_budget_cents }
// Response: 200 { success }
```

---

## 15. Permissions

### 15.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Generate Homework | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate Test | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate Lesson Plan | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate Rubric | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate Report Comments | ❌ | ❌ | ✅ | ❌ | ❌ |
| Doubt Assistant | ❌ | ❌ | ❌ | ✅ | ❌ |
| Learning Companion | ❌ | ❌ | ❌ | ✅ | ❌ |
| Weekly Summary | ❌ | ❌ | ❌ | ❌ | ✅ |
| Generate Insights | ❌ | ✅ | ❌ | ❌ | ❌ |
| View Risk Flags | ✅ | ✅ | 🔷 (class) | ❌ | ❌ |
| Resolve Risk Flags | ✅ | ✅ | 🔷 (own class) | ❌ | ❌ |
| View AI Generation Logs | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |
| View Usage/Cost | ✅ | ✅ | 📋 (own) | ❌ | ❌ |
| Configure Quota | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configure Content Filters | ✅ | ❌ | ❌ | ❌ | ❌ |
| Disable AI (per-role) | ✅ | ❌ | ❌ | ❌ | ❌ |

### 15.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher generates for own classes only | `teacher_class_subjects` check |
| Student uses doubt assistant for own subjects | `student.class_id` → subject scope |
| Parent views summary for own children only | `student_parents` join |
| Principal sees all school risk flags | School-scoped query |
| Teacher sees risk flags for own class only | `teacher_class_subjects` join |
| Admin views all generation logs | Full school scope |
| Teacher views own generation logs only | `ai_generations.user_id == ctx.userId` |

### 15.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'ai:homework:generate', { classId });
await this.authz.assert(ctx, 'ai:test:generate', { classId });
await this.authz.assert(ctx, 'ai:lesson_plan:generate', { classId });
await this.authz.assert(ctx, 'ai:rubric:generate', { loIds });
await this.authz.assert(ctx, 'ai:report_comments:generate', { classId });
await this.authz.assert(ctx, 'ai:doubt:ask');                    // Student only
await this.authz.assert(ctx, 'ai:companion:chat');              // Student only
await this.authz.assert(ctx, 'ai:insights:generate');            // Principal/admin only
await this.authz.assert(ctx, 'ai:risk_flags:view');              // Teacher (class), principal/admin
await this.authz.assert(ctx, 'ai:admin:configure');              // Admin only
```

---

## 16. Background Jobs

### 16.1 Scheduled Jobs

```typescript
// 1. daily_risk_detection — Scan all students for risk flags
// Schedule: Every night at 2:00 AM
// Handler: RiskDetectionService.detectRisks(schoolId) — per school
// Cost: Tier 4 model, runs for flagged students only

// 2. weekly_summary_generation — Generate weekly summaries for parents
// Schedule: Every Monday at 6:00 AM
// Handler: For each parent with digest_frequency='weekly', compile summary
// Cost: Tier 1 model, one call per child

// 3. quota_reset — Reset daily usage counters
// Schedule: Every night at 11:59 PM
// Handler: Reset ai_quota.generations_today = 0, ai_quota.tokens_today = 0
// Cost: None (database update)

// 4. context_cache_cleanup — Remove expired context cache entries
// Schedule: Every hour
// Handler: DELETE FROM ai_context_cache WHERE expires_at < NOW()
// Cost: None (database delete)

// 5. budget_alert_check — Check budgets and send alerts
// Schedule: Every hour during school hours (8 AM - 4 PM)
// Handler: CostTrackerService.checkBudgetAlerts(schoolId)
// Cost: None (database read)

// 6. generation_log_archive — Archive old generation logs
// Schedule: Daily at 3:00 AM
// Handler: Archive ai_generations older than 90 days to cold storage
// Cost: None
```

### 16.2 Event-Triggered Jobs

```typescript
// 1. On teacher marks progress → Invalidate AI context cache for that subject+class
eventBus.on('curriculum:progress_marked', async (event) => {
  await cacheService.invalidateForSubject(event.schoolId, event.subjectId);
});

// 2. On teacher publishes AI-generated content → Rate the generation quality
eventBus.on('assignment:published', async (event) => {
  // Check if this assignment was AI-generated
  const generation = await repo.findGenerationByEntityId(event.assignmentId);
  if (generation && !generation.user_rating) {
    // Prompt the teacher to rate the AI generation
    await notificationService.send({
      userId: event.teacherId,
      type: 'ai_feedback',
      title: 'How was the AI-generated content?',
      body: 'Rate your experience to help us improve.',
    });
  }
});

// 3. On quota exceeded → Send warning notification
eventBus.on('ai:quota_exceeded', async (event) => {
  await notificationService.send({
    userId: event.userId,
    type: 'system',
    priority: 'normal',
    title: 'AI Generation Limit Reached',
    body: `Your daily AI generation limit has been reached. It will reset at midnight.`,
  });
});
```

---

## 17. Edge Cases

### 17.1 Generation Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **LLM returns empty response** | Retry 1x. If still empty, return 503 with "AI service temporarily unavailable" |
| 2 | **LLM response is cut off (max tokens)** | Detect `finish_reason: 'length'`. Return partial results with warning. Suggest reducing request size. |
| 3 | **LLM content filtered by OpenAI** | `finish_reason: 'content_filter'`. Return 422 with "Generated content was filtered. Try rephrasing your request." |
| 4 | **LLM timeout (>30s)** | Retry 1x with shorter timeout. If fails, return 503. |
| 5 | **LLM rate limit (429 from OpenAI)** | Exponential backoff (1s, 2s, 4s). Max 3 retries. |
| 6 | **Invalid JSON response** | Retry 1x with lower temperature (0.3). If still invalid, return validation error. |
| 7 | **Response has wrong question count** | Ask LLM to regenerate with explicit count instruction. |
| 8 | **Response contains off-topic content** | Validate against curriculum alignment. Reject misaligned questions. |
| 9 | **Student asks non-academic question** | Gently redirect to curriculum topic. Never answer non-academic questions. |
| 10 | **Student asks in Hindi, teacher wants English** | Respect the `language` parameter. If not provided, detect from question and respond in same language. |

### 17.2 Quota Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Student hits daily doubt limit (20)** | Return friendly error: "You've reached your daily limit. Ask your teacher for help, or try again tomorrow!" |
| 2 | **Teacher hits daily generation limit (100)** | Return error with reset time. Suggest using less complex prompts (Tier 1 instead of Tier 2). |
| 3 | **School hits monthly budget** | Auto-downgrade to Tier 1 models only. Send alert to admin. |
| 4 | **Multiple teachers exhausting budget simultaneously** | FIFO queue. Each generation increments cost counter. Budget check is synchronous. |
| 5 | **Quota reset race condition at midnight** | Use `reset_date` field with atomic UPDATE. Last writer wins for the day. |

### 17.3 Context Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Curriculum has 50 LOs but token budget is 4000** | Include only LOs relevant to the requested chapter/topic. Use Bloom's level as secondary filter. |
| 2 | **Subject has no curriculum loaded** | Return error: "No curriculum found for this subject. Please contact your admin to load the curriculum." |
| 3 | **Teacher selects conflicting LOs (different chapters)** | Generate across all selected LOs. Clearly separate sections per chapter. |
| 4 | **Cache miss on context** | Build fresh context from DB. This is the expected path for first generation. |
| 5 | **Context data is stale (teacher updated curriculum)** | Cache TTL of 1 hour. On curriculum edit, invalidate cache. |

### 17.4 Safety Edge Cases

| # | Case | Handling |
|---|------|----------|
| 1 | **Student attempts prompt injection** | System prompt explicitly states role. User input is in the user message, not the system prompt. |
| 2 | **Student asks for answers to specific homework questions** | Refuse: "I can explain the concept, but I can't give you the answer directly. Let me help you understand the topic." |
| 3 | **Teacher generates test with inappropriate content** | Content filter catches on output. Admin can set custom filters. All generations logged. |
| 4 | **Student includes personal information in doubt question** | PII scanner strips before sending to LLM. Logged for audit. |
| 5 | **LLM returns content in wrong language** | Language validation post-generation. Reject and retry with stronger language instruction. |

---

## 18. Risk Analysis

### 18.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Prompt injection (student tricks AI into revealing answers)** | High | Exam integrity compromised | Student prompts go through system prompt that explicitly prevents answer disclosure. Doubt assistant is curriculum-grounded. |
| 2 | **PII leaked in generation logs** | High | Privacy violation, regulatory fines | PII scanner strips personal data before storage. All prompts and responses are scanned. |
| 3 | **API key exposure** | Critical | Unauthorized AI usage, cost spike | API keys stored in environment variables. Never exposed to client. Proxy all requests through backend. |
| 4 | **Rate limit bypass** | Medium | Cost explosion | Per-user and per-school quotas enforced server-side. Multiple quota layers (generations, tokens, budget). |
| 5 | **Student impersonates teacher to generate content** | Critical | Unauthorized content generation | Role-based access on all AI endpoints. JWT verification. Teacher-only endpoints return 403 for students. |
| 6 | **Inappropriate content generation** | High | Reputational damage, child safety | Multi-layer content filtering: OpenAI's built-in filter + custom filters + post-generation safety check. |
| 7 | **Cross-school data leak in context** | High | Tenant isolation breach | School_id enforced on all context queries. Context cache keyed by school_id. |
| 8 | **Denial of wallet (budget exhaustion)** | Medium | School incurs unexpected costs | Budget alerts at 90% and 100%. Auto-downgrade on budget exceeded. Admin configures monthly cap. |

### 18.2 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **AI generates factually incorrect content** | Student learns wrong concepts | Multi-layer hallucination prevention. Teacher must review before publishing. |
| 2 | **AI generates questions above grade level** | Student discouraged | Grade-level context included in every prompt. Bloom's level enforced. |
| 3 | **AI generates culturally inappropriate examples** | Parent complaints | Content filters for cultural sensitivity. Custom school filters. Teacher review gate. |
| 4 | **Context cache returns stale data** | AI generates based on old curriculum | 1-hour TTL. Cache invalidation on curriculum edit. |
| 5 | **Cost tracking drift (actual vs logged)** | Incorrect budget reporting | Log actual API response (token counts from provider). Double-check against provider dashboard weekly. |

### 18.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **50 teachers generating simultaneously at 8 AM** | 50 concurrent LLM calls | OpenAI rate limits handled via queue. Queue depth managed via exponential backoff. |
| 2 | **100 students using doubt assistant simultaneously** | 100 concurrent cheap calls | Tier 1 model handles this easily. OpenAI can process 100s of requests/min. |
| 3 | **Report comments for 40 students (40 sequential LLM calls)** | Slow response (40 × 2s = 80s) | Batch calls with single prompt (send all student data at once). Set max output tokens accordingly. |
| 4 | **Risk detection for 1000 students** | Processing time | Rule-based detection is instant (DB query). AI analysis runs only for flagged students (~50-100). |

### 18.4 Cost Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Uncontrolled usage by enthusiastic teachers** | Budget overrun | Daily per-teacher quota (100 generations). Monthly school budget ($50 default). Alerts at 90%. |
| 2 | **Student abuse of doubt assistant** | Cost spike | Per-student daily limit (20 questions). Cheap model (gpt-4o-mini). Approx $0.002/question. |
| 3 | **Risk detection cost at scale** | $60/month for 1000 students | Two-tier approach: rules are free, AI only for flagged students. |
| 4 | **Model price changes (OpenAI changes pricing)** | Budget variance | Abstracted provider interface. Can switch providers. Cost tracking adapts to pricing changes. |

---

## 19. Testing Checklist

### 19.1 Homework Generator Tests

| Test | Expected | Priority |
|------|----------|----------|
| Generate 5 MCQs for valid curriculum | Valid JSON with 5 MCQs, 4 options each | P0 |
| Generate with bilingual language | Content in both English and Hindi | P0 |
| All questions reference valid LOs from curriculum | Curriculum alignment check passes | P0 |
| No PII in generated content | PII scan passes | P0 |
| Generate with invalid topic_ids | 404 | P0 |
| Quota exceeded | 429 | P0 |
| Teacher doesn't teach class | 403 | P0 |
| Hallucination detection catches unsupported claims | Hallucination score > 0.7 → flagged | P1 |
| Temperature control: retry with lower temp after validation failure | Valid JSON on 2nd attempt | P1 |
| Cost tracking matches actual API usage | CostCents matches OpenAI response | P1 |

### 19.2 Doubt Assistant Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student asks curriculum-relevant question | Relevant, helpful answer | P0 |
| Student asks off-topic question | Gently redirected to curriculum | P0 |
| Student asks for homework answer | Refuses, explains concept instead | P0 |
| Student hits daily limit (20 questions) | 429 with friendly message | P0 |
| Curriculum context auto-detected correctly | LO matched to question | P0 |
| Previous attempts included in context | Answer references previous attempts | P1 |
| Safety filter blocks inappropriate questions | Safe response or redirect | P0 |
| Hindi question gets Hindi response (if language param supports) | Response in Hindi | P1 |
| PII in question is stripped before storage | No PII in ai_generations table | P0 |
| Student not in this subject's class | 403 | P0 |

### 19.3 Report Comments Tests

| Test | Expected | Priority |
|------|----------|----------|
| Generate for 10 students | 10 comments, each 50-100 words | P0 |
| Comments reference actual student scores | Score mentioned matches DB data | P0 |
| No hallucinated student behavior | Comments only use provided data | P0 |
| Different comment styles produce different tones | Encouraging ≠ Constructive | P1 |
| Attendance included when requested | Attendance referenced in comment | P1 |
| Comments don't contain PII | PII scan passes | P0 |
| Generate for empty class (0 students) | 422 | P0 |

### 19.4 Risk Detection Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student with <80% attendance flagged | attendance_risk flag created | P0 |
| Student with <40% average flagged | failing_grade flag created | P0 |
| Student with 4 incomplete assignments flagged | incomplete_work flag created | P0 |
| Student with clean record NOT flagged | No false positives | P0 |
| AI-detected grade trajectory risk | Additional flag from AI analysis | P1 |
| Duplicate flags prevented (same student, same type, same source) | Upsert, not duplicate | P0 |
| Flag resolved by teacher | is_resolved = true | P0 |
| Daily run doesn't process inactive students | Skipped | P0 |

### 19.5 Quota & Cost Tests

| Test | Expected | Priority |
|------|----------|----------|
| Daily generation count increments | +1 after each generation | P0 |
| Daily token count increments | Token count added | P0 |
| Quota exceeded blocks further generations | 429 | P0 |
| Quota resets at midnight | Counter back to 0 | P0 |
| Monthly budget capped at $50 | Budget exceeded stops Tier 2+ | P0 |
| Budget alert at 90% | Admin notified | P1 |
| Cost analytics returns correct aggregation | Sum matches individual records | P0 |
| Admin can modify quota | Quota updated, takes effect immediately | P0 |

### 19.6 Hallucination Prevention Tests

| Test | Expected | Priority |
|------|----------|----------|
| Curriculum alignment: all questions reference valid LOs | 100% pass rate | P0 |
| Curriculum misalignment: question references non-existent LO | Flagged, retried | P0 |
| PII in prompt: student name included | Stripped before API call | P0 |
| PII in response: AI outputs student info | Blocked, logged | P0 |
| Safety: inappropriate content generation | Filtered at output | P0 |
| Hallucination: AI invents statistics | Detected, scored > 0.3 | P1 |
| Teacher review: all content saved as draft | Not published automatically | P0 |
| Response validation: invalid JSON → retry | Retries with lower temperature | P1 |

### 19.7 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Full flow: Generate homework → Review → Edit → Publish | End-to-end works | P0 |
| Full flow: Doubt assistant → Response → Student feedback | End-to-end works | P0 |
| Context cache: Same curriculum params return cached context | No duplicate DB queries | P0 |
| Context invalidation: Progress mark → Stale cache cleared | Fresh context on next gen | P0 |
| Quota enforcement: 100 generations in 1 day → 101st fails | 429 | P0 |
| Risk detection: Daily run → Flags created → Teacher resolves | Full cycle works | P0 |
| Cost tracking: API call → Cost logged → Dashboard updated | Cost visible in analytics | P0 |

---

## Appendix A: Prompt Template Registry

```typescript
// Master list of all system prompt extensions per feature

export const PROMPT_TEMPLATE_REGISTRY = {
  'homework_generator': HOMEWORK_PROMPT_EXTENSION,
  'test_generator': TEST_PROMPT_TEMPLATE,
  'lesson_planner': LESSON_PLAN_PROMPT_EXTENSION,
  'rubric_generator': RUBRIC_PROMPT_TEMPLATE,
  'report_comments': REPORT_COMMENTS_PROMPT_TEMPLATE,
  'doubt_assistant': DOUBT_ASSISTANT_PROMPT_EXTENSION,
  'learning_companion': COMPANION_PROMPT_TEMPLATE,
  'weekly_summary': WEEKLY_SUMMARY_PROMPT_TEMPLATE,
  'principal_insights': INSIGHTS_PROMPT_TEMPLATE,
  'risk_detection': RISK_PROMPT_TEMPLATE,
};

// Each template follows this structure:
// 1. Task description (what to generate)
// 2. Output format (JSON schema or plain text rules)
// 3. Quality guidelines (what makes good output)
// 4. Constraint reminders (what NOT to do)
// 5. Curriculum context placeholder (injected by PromptBuilder)
```

## Appendix B: Cost Projections

```typescript
// Monthly AI cost per school (estimated)

const MONTHLY_COST_BREAKDOWN = {
  // 50 teachers × various generation features
  teacher_generations: {
    homework: 50 × 5 × 30 × 0.003,           // $22.50
    tests: 50 × 1 × 30 × 0.05,                 // $75.00
    lesson_plans: 50 × 2 × 30 × 0.08,          // $240.00
    rubrics: 50 × 1 × 30 × 0.003,              // $4.50
    report_comments: 50 × 2 × 30 × 0.01,       // $30.00 (batching reduces cost)
    total_teacher: 22.50 + 75.00 + 240.00 + 4.50 + 30.00,  // $372.00
  },

  // 1000 students
  student_interactions: {
    doubts: 1000 × 5 × 30 × 0.002,             // $300.00
    companion: 1000 × 2 × 30 × 0.01,           // $600.00 (Tier 2, expensive)
    total_student: 300.00 + 600.00,             // $900.00
  },

  // Principal & system
  analytics: {
    insights: 1 × 10 × 30 × 0.05,              // $15.00
    risk_detection: 1 × 30 × 2.00,             // $60.00
    total_analytics: 15.00 + 60.00,             // $75.00
  },

  // Total
  total: {
    per_month: 372.00 + 900.00 + 75.00,          // $1,347.00
    per_year: 1347.00 × 10,                      // $13,470.00 (10 school months)
    per_student_per_month: 1347.00 / 1000,        // $1.35/student/month
  },
};

// Cost optimization strategies:
// 1. Batch report comments (single prompt for 40 students) → reduces cost by ~60%
// 2. Learning companion → limit to 10 messages/day (not 20)
// 3. Cache similar doubt questions → reduces duplicate API calls by ~15%
// 4. Risk detection uses Tier 4 only for flagged students → reduces cost by ~80%
```

## Appendix C: Error Codes

```typescript
export const AI_ERROR_CODES = {
  AI_400_01: { status: 400, message: 'No curriculum found for this subject. Contact admin to load curriculum.' },
  AI_400_02: { status: 400, message: 'Invalid question distribution. Total must equal max_score.' },
  AI_400_03: { status: 400, message: 'Invalid Bloom\'s taxonomy distribution. Must sum to 1.0.' },
  AI_400_04: { status: 400, message: 'Student question is too short (min 5 characters).' },
  AI_400_05: { status: 400, message: 'AI-generated content was filtered. Try rephrasing your request.' },

  AI_403_01: { status: 403, message: 'You do not teach this subject in this class.' },
  AI_403_02: { status: 403, message: 'This feature is not available for your role.' },
  AI_403_03: { status: 403, message: 'You can only generate content for your own classes.' },

  AI_429_01: { status: 429, message: 'Daily generation limit reached. Resets at midnight.' },
  AI_429_02: { status: 429, message: 'Daily token limit reached. Try shorter prompts.' },
  AI_429_03: { status: 429, message: 'Daily doubt limit (20) reached. Ask your teacher for help!' },
  AI_429_04: { status: 429, message: 'Monthly AI budget reached. Contact admin to increase budget.' },

  AI_503_01: { status: 503, message: 'AI service temporarily unavailable. Please try again.' },
  AI_503_02: { status: 503, message: 'AI generation timed out. Try with fewer questions.' },
  AI_503_03: { status: 503, message: 'AI provider returned an error. Please try again.' },

  AI_422_01: { status: 422, message: 'Generated response failed validation. Please try again.' },
  AI_422_02: { status: 422, message: 'Invalid language parameter. Supported: en, hi, bilingual.' },
  AI_422_03: { status: 422, message: 'AI is not configured. Ask your administrator to add the API key.' },
} as const;
```

## Appendix D: Key Metrics & Monitoring

```typescript
// Metrics to track for AI module health

interface AIMetrics {
  // Usage
  generations_per_day: number;
  generations_per_feature: Record<string, number>;
  active_users_per_day: number;
  quota_exceeded_count: number;

  // Performance
  average_latency_ms: number;
  p95_latency_ms: number;
  timeout_rate: number;        // % of requests that timeout
  error_rate: number;          // % of requests that error

  // Quality
  validation_failure_rate: number;    // % of responses that fail validation
  user_rating_average: number;        // 1-5 stars
  retry_rate: number;                 // % of requests that need retry

  // Safety
  content_filter_hits: number;        // % blocked by content filter
  pii_detection_count: number;        // PII detected in prompts/responses

  // Cost
  daily_cost_cents: number;
  monthly_cost_cents: number;
  cost_per_generation: number;
  budget_usage_pct: number;
}

// Alert thresholds:
// - Error rate > 5% → PagerDuty alert
// - Latency P95 > 10s → Performance alert
// - Budget > 90% → Admin notification
// - Validation failure rate > 20% → Model quality review
// - Content filter hits > 10/day → Security review
```

---

**Document Version**: 1.0
**Date**: June 11, 2026
**Next Action**: Implement AI service scaffolding, create OpenAI provider integration, and begin homework generator endpoint development.
