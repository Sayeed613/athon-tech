# ATHON V2 — Curriculum Module Implementation

**Reviewer**: Principal Software Architect  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026  
**References**: DATABASE_V2_FINAL.md · SUBJECTS_MODULE_IMPLEMENTATION.md · CLASSES_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Folder Structure](#2-folder-structure)
3. [Schemas (Zod)](#3-schemas-zod)
4. [Services](#4-services)
5. [Repositories](#5-repositories)
6. [API Routes](#6-api-routes)
7. [Permissions](#7-permissions)
8. [Validation Rules](#8-validation-rules)
9. [How Curriculum Drives the Platform](#9-how-curriculum-drives-the-platform)
10. [Risk Analysis](#10-risk-analysis)
11. [Testing Checklist](#11-testing-checklist)

---

## 1. Database Schema

### 1.1 The Curriculum Hierarchy

```
School → Classes → Subjects → Chapters → Topics → Learning Objectives
                                       ↓                    ↓
                              curriculum_progress    assignments.lo_id
                              (teacher marks          (homework, tests,
                               completion status)      AI content linked to LOs)
```

### 1.2 Tables

#### `chapters`

```sql
CREATE TABLE chapters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    school_id       UUID NOT NULL REFERENCES schools(id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    chapter_number  INTEGER NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_periods INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_chapters_subject_name ON chapters(subject_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_chapters_subject_order ON chapters(subject_id, sort_order, chapter_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_chapters_school ON chapters(school_id) WHERE deleted_at IS NULL;
```

#### `topics`

```sql
CREATE TABLE topics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id          UUID NOT NULL REFERENCES chapters(id),
    school_id           UUID NOT NULL REFERENCES schools(id),
    name                VARCHAR(200) NOT NULL,
    description         TEXT,
    learning_objectives_text TEXT,
    estimated_periods   INTEGER DEFAULT 0,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_topics_chapter_name ON topics(chapter_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_topics_chapter_order ON topics(chapter_id, sort_order) WHERE deleted_at IS NULL;
```

#### `learning_objectives`

```sql
CREATE TABLE learning_objectives (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id            UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    school_id           UUID NOT NULL REFERENCES schools(id),
    code                VARCHAR(30) NOT NULL,
    description         TEXT NOT NULL,
    bloom_taxonomy_level VARCHAR(30),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_lo_topic_code ON learning_objectives(topic_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_lo_topic_order ON learning_objectives(topic_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_lo_code ON learning_objectives(school_id, code) WHERE deleted_at IS NULL;
```

#### `curriculum_progress`

```sql
CREATE TABLE curriculum_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    entity_type     VARCHAR(20) NOT NULL,
    entity_id       UUID NOT NULL,
    school_id       UUID NOT NULL REFERENCES schools(id),
    class_id        UUID NOT NULL REFERENCES classes(id),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'not_started',
    marked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(teacher_id, entity_type, entity_id, class_id)
);

CREATE INDEX idx_cp_teacher_class ON curriculum_progress(teacher_id, class_id, entity_type, status);
CREATE INDEX idx_cp_class_subject ON curriculum_progress(class_id, subject_id, status);
CREATE INDEX idx_cp_completion ON curriculum_progress(entity_type, entity_id, class_id, status) WHERE status = 'completed';
```

### 1.3 ENUMs

```sql
CREATE TYPE progress_status AS ENUM ('not_started','in_progress','completed','skipped');
CREATE TYPE bloom_taxonomy AS ENUM ('remember','understand','apply','analyze','evaluate','create');

ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:chapter_created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:chapter_updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:chapter_deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:topic_created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:topic_updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:topic_deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:lo_created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:lo_updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:lo_deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:progress_marked';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:progress_bulk';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'curriculum:cbse_seeded';
```

### 1.4 Row-Level Security

```sql
-- Chapters: teachers can only view chapters in their assigned subjects
CREATE POLICY chapters_school_isolation ON chapters
  USING (school_id = current_setting('app.current_school_id')::UUID);

CREATE POLICY chapters_admin_all ON chapters FOR ALL TO school_admin
  USING (school_id = current_setting('app.current_school_id')::UUID);

-- Topics: inherited scope through chapter → subject → school
CREATE POLICY topics_read_teacher ON topics FOR SELECT
  USING (chapter_id IN (
    SELECT c.id FROM chapters c
    JOIN teacher_class_subjects tcs ON tcs.subject_id = c.subject_id
    WHERE tcs.teacher_id = current_setting('app.current_teacher_id')::UUID
      AND c.deleted_at IS NULL
  ));

-- Learning Objectives: student/parent see only their own class's subjects
CREATE POLICY lo_read_student ON learning_objectives FOR SELECT
  USING (school_id = current_setting('app.current_school_id')::UUID
    AND topic_id IN (
      SELECT t.id FROM topics t
      JOIN chapters c ON c.id = t.chapter_id
      JOIN class_subjects cs ON cs.subject_id = c.subject_id
      JOIN class_enrollments ce ON ce.class_id = cs.class_id
      WHERE ce.student_id = current_setting('app.current_student_id')::UUID
        AND ce.status = 'active'
    ));

-- Curriculum Progress: teacher can upsert own records, principal/admin can view
CREATE POLICY progress_teacher_manage ON curriculum_progress FOR ALL
  USING (teacher_id = current_setting('app.current_teacher_id')::UUID);
CREATE POLICY progress_admin_view ON curriculum_progress FOR SELECT
  USING (school_id = current_setting('app.current_school_id')::UUID);
```

### 1.5 Materialized View: Curriculum Completion

```sql
CREATE MATERIALIZED VIEW mv_curriculum_completion AS
SELECT
    cp.school_id, cp.class_id, cp.subject_id, cp.teacher_id,
    COUNT(DISTINCT CASE WHEN cp.entity_type = 'chapter' AND cp.status = 'completed' THEN cp.entity_id END) AS completed_chapters,
    COUNT(DISTINCT CASE WHEN cp.entity_type = 'chapter' THEN cp.entity_id END) AS total_chapters,
    COUNT(DISTINCT CASE WHEN cp.entity_type = 'topic' AND cp.status = 'completed' THEN cp.entity_id END) AS completed_topics,
    COUNT(DISTINCT CASE WHEN cp.entity_type = 'topic' THEN cp.entity_id END) AS total_topics,
    MAX(cp.marked_at) AS last_progress_update
FROM curriculum_progress cp
GROUP BY cp.school_id, cp.class_id, cp.subject_id, cp.teacher_id;
```

---

## 2. Folder Structure

```
src/modules/curriculum/
├── curriculum.service.ts           # Business logic
├── curriculum.repository.ts        # Database access
├── curriculum.router.ts            # API route handlers
├── curriculum.validator.ts         # Zod schemas
├── curriculum.schema.ts            # TypeScript types
├── curriculum.seeder.ts            # CBSE default curriculum loader
├── curriculum.utils.ts             # LO code generation, tree builder
│
src/modules/subjects/
├── subjects.repository.ts
│
src/core/analytics/
├── curriculum-analytics.service.ts # Completion analytics, progress reports
```

---

## 3. Schemas (Zod)

```typescript
const UUID = z.string().uuid();
const Name = z.string().min(1).max(200);
const LO_Code = z.string().regex(/^[A-Z]{3,4}-\d{1,2}-[A-Z]{2,3}-[A-Z]{2,3}-\d{2}$/);

export const CreateChapterSchema = z.object({
  subject_id: UUID, name: Name, description: z.string().max(1000).optional(),
  chapter_number: z.number().int().positive(), sort_order: z.number().int().min(0).default(0),
  is_required: z.boolean().default(true), estimated_periods: z.number().int().min(0).default(0),
});

export const UpdateChapterSchema = z.object({
  name: Name.optional(), description: z.string().max(1000).nullable().optional(),
  chapter_number: z.number().int().positive().optional(), sort_order: z.number().int().min(0).optional(),
  is_required: z.boolean().optional(), estimated_periods: z.number().int().min(0).optional(),
});

export const CreateTopicSchema = z.object({
  chapter_id: UUID, name: Name, description: z.string().max(1000).optional(),
  learning_objectives_text: z.string().max(500).optional(),
  estimated_periods: z.number().int().min(0).default(0), sort_order: z.number().int().min(0).default(0),
});

export const UpdateTopicSchema = z.object({
  name: Name.optional(), description: z.string().max(1000).nullable().optional(),
  learning_objectives_text: z.string().max(500).nullable().optional(),
  estimated_periods: z.number().int().min(0).optional(), sort_order: z.number().int().min(0).optional(),
});

export const CreateLOSchema = z.object({
  topic_id: UUID, code: LO_Code,
  description: z.string().min(10).max(500),
  bloom_taxonomy_level: z.enum(['remember','understand','apply','analyze','evaluate','create']).optional(),
  sort_order: z.number().int().min(0).default(0),
});

export const BulkCreateLOSchema = z.object({
  learning_objectives: z.array(z.object({
    code: LO_Code, description: z.string().min(10).max(500),
    bloom_taxonomy_level: z.enum(['remember','understand','apply','analyze','evaluate','create']).optional(),
    sort_order: z.number().int().min(0).default(0),
  })).min(1).max(20),
});

export const MarkProgressSchema = z.object({
  entity_type: z.enum(['chapter', 'topic']), entity_id: UUID,
  class_id: UUID, subject_id: UUID,
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
  notes: z.string().max(500).optional(),
});

export const BulkMarkProgressSchema = z.object({
  class_id: UUID, subject_id: UUID,
  marks: z.array(z.object({
    entity_type: z.enum(['chapter', 'topic']), entity_id: UUID,
    status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
    notes: z.string().max(500).optional(),
  })).min(1).max(50),
});

export const CurriculumTreeQuerySchema = z.object({
  subject_id: UUID, class_id: UUID.optional(),
  include_progress: z.coerce.boolean().default(false),
  progress_teacher_id: UUID.optional(),
});

export const ChapterResponseSchema = z.object({
  id: z.string().uuid(), subject_id: z.string().uuid(), name: z.string(),
  description: z.string().nullable(), chapter_number: z.number(), sort_order: z.number(),
  is_required: z.boolean(), estimated_periods: z.number(),
  topic_count: z.number(), progress_status: z.string().nullable(), created_at: z.string(),
});

export const TopicResponseSchema = z.object({
  id: z.string().uuid(), chapter_id: z.string().uuid(), name: z.string(),
  description: z.string().nullable(), estimated_periods: z.number(),
  sort_order: z.number(), lo_count: z.number(),
  progress_status: z.string().nullable(), created_at: z.string(),
});

export const LearningObjectiveResponseSchema = z.object({
  id: z.string().uuid(), topic_id: z.string().uuid(), code: z.string(),
  description: z.string(), bloom_taxonomy_level: z.string().nullable(), sort_order: z.number(),
});

export const CurriculumTreeResponseSchema = z.object({
  subject: z.object({ id: z.string().uuid(), name: z.string(), code: z.string() }),
  chapters: z.array(z.object({
    id: z.string().uuid(), name: z.string(), chapter_number: z.number(), sort_order: z.number(),
    is_required: z.boolean(), estimated_periods: z.number(),
    description: z.string().nullable(), topic_count: z.number(),
    progress_status: z.string().nullable(), created_at: z.string(),
    topics: z.array(z.object({
      id: z.string().uuid(), chapter_id: z.string().uuid(), name: z.string(),
      description: z.string().nullable(), estimated_periods: z.number(),
      sort_order: z.number(), lo_count: z.number(),
      progress_status: z.string().nullable(), created_at: z.string(),
      learning_objectives: z.array(LearningObjectiveResponseSchema),
    })),
  })),
  completion_percentage: z.number().nullable(),
});
```

---

## 4. Services

```typescript
export class CurriculumService {
  constructor(
    private readonly repo: CurriculumRepository,
    private readonly subjectRepo: SubjectsRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Curriculum Tree ─────────────────────────────────────────

  async getCurriculumTree(ctx: RequestContext, subjectId: string, options?: {
    classId?: string; progressTeacherId?: string
  }): Promise<CurriculumTreeResponse> {
    await this.authz.assert(ctx, 'curriculum:view');
    const subject = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!subject) throw new NotFoundError('Subject not found');

    const cacheKey = `curriculum:tree:${subjectId}:${options?.classId ?? ''}:${options?.progressTeacherId ?? ''}`;
    return this.cache.getOrSet(cacheKey, async () => {        // Teacher scope enforcement: only subjects the teacher teaches in their classes
        if (ctx.role === 'teacher' && options?.classId) {
          const teaches = await this.repo.teacherTeachesSubjectInClass(
            ctx.profileId!, options.classId, subjectId);
          if (!teaches) throw new ForbiddenError('You do not teach this subject in this class');
        } else if (ctx.role === 'teacher') {
          // Teacher must specify a class_id to scope the tree
          throw new ValidationError('Teacher must provide class_id to view curriculum tree');
        }

        const chapters = await this.repo.getChaptersWithTopics(subjectId, ctx.schoolId);

      let progressMap = new Map<string, string>();
      if (options?.classId && options?.progressTeacherId) {
        const progress = await this.repo.getProgressForTree(
          options.progressTeacherId, options.classId, subjectId);
        for (const p of progress) progressMap.set(`${p.entity_type}:${p.entity_id}`, p.status);
      }

      const chapterData = await Promise.all(chapters.map(async (ch) => {
        const topics = await this.repo.getTopicsWithLOs(ch.id, ctx.schoolId);
        return {
          ...ch, progress_status: progressMap.get(`chapter:${ch.id}`) ?? null,
          topic_count: topics.length,
          topics: topics.map(t => ({
            ...t, progress_status: progressMap.get(`topic:${t.id}`) ?? null,
            lo_count: t.learning_objectives?.length ?? 0,
            learning_objectives: t.learning_objectives ?? [],
          })),
        };
      }));

      const total = chapterData.reduce((s, ch) => s + 1 + ch.topics.length, 0);
      const completed = chapterData.reduce((s, ch) => {
        let c = ch.progress_status === 'completed' ? 1 : 0;
        c += ch.topics.filter(t => t.progress_status === 'completed').length;
        return s + c;
      }, 0);

      return {
        subject: { id: subject.id, name: subject.name, code: subject.code },
        chapters: chapterData,
        completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }, 300);
  }

  // ─── Chapter CRUD ────────────────────────────────────────────

  async createChapter(ctx: RequestContext, input: CreateChapterInput): Promise<ChapterResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const subject = await this.subjectRepo.findById(input.subject_id, ctx.schoolId);
    if (!subject) throw new NotFoundError('Subject not found');

    const dup = await this.repo.findChapterByName(input.subject_id, input.name);
    if (dup) throw new ConflictError(`Chapter "${input.name}" already exists in this subject`);

    const chapter = await this.repo.createChapter({ ...input, school_id: ctx.schoolId });
    await this.cache.invalidate(`curriculum:tree:${input.subject_id}:*`);
    await this.audit.log({ eventType: 'curriculum:chapter_created', actorId: ctx.userId,
      resourceType: 'chapter', resourceId: chapter.id, outcome: 'success' });
    return { ...chapter, topic_count: 0, progress_status: null, created_at: chapter.created_at };
  }

  async updateChapter(ctx: RequestContext, chapterId: string, input: UpdateChapterInput): Promise<ChapterResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const existing = await this.repo.findChapterById(chapterId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Chapter not found');

    if (input.name && input.name !== existing.name) {
      const dup = await this.repo.findChapterByName(existing.subject_id, input.name);
      if (dup) throw new ConflictError('Chapter name already exists in this subject');
    }

    const updated = await this.repo.updateChapter(chapterId, input);
    await this.cache.invalidate(`curriculum:tree:${existing.subject_id}:*`);
    const topicCount = await this.repo.getTopicCount(chapterId);
    return { ...updated, topic_count: topicCount, progress_status: null, created_at: updated.created_at };
  }

  async deleteChapter(ctx: RequestContext, chapterId: string): Promise<void> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const existing = await this.repo.findChapterById(chapterId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Chapter not found');

    const assignCount = await this.repo.getAssignmentCountForChapter(chapterId);
    if (assignCount > 0) {
      throw new ValidationError(`Chapter has ${assignCount} linked assignments. Remove curriculum links first.`);
    }

    await this.repo.softDeleteChapter(chapterId);
    await this.cache.invalidate(`curriculum:tree:${existing.subject_id}:*`);
    await this.audit.log({ eventType: 'curriculum:chapter_deleted', ... });
  }

  // ─── Topic CRUD ──────────────────────────────────────────────

  async createTopic(ctx: RequestContext, input: CreateTopicInput): Promise<TopicResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const chapter = await this.repo.findChapterById(input.chapter_id, ctx.schoolId);
    if (!chapter) throw new NotFoundError('Chapter not found');

    const dup = await this.repo.findTopicByName(input.chapter_id, input.name);
    if (dup) throw new ConflictError(`Topic "${input.name}" already exists`);

    const topic = await this.repo.createTopic({ ...input, school_id: ctx.schoolId });
    await this.cache.invalidate(`curriculum:tree:${chapter.subject_id}:*`);
    await this.audit.log({ eventType: 'curriculum:topic_created', actorId: ctx.userId,
      resourceType: 'topic', resourceId: topic.id, outcome: 'success' });
    return { ...topic, lo_count: 0, progress_status: null, created_at: topic.created_at };
  }

  async updateTopic(ctx: RequestContext, topicId: string, input: UpdateTopicInput): Promise<TopicResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const existing = await this.repo.findTopicById(topicId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Topic not found');

    if (input.name && input.name !== existing.name) {
      const dup = await this.repo.findTopicByName(existing.chapter_id, input.name);
      if (dup) throw new ConflictError('Topic name already exists in this chapter');
    }

    const updated = await this.repo.updateTopic(topicId, input);
    const chapter = await this.repo.findChapterById(existing.chapter_id, ctx.schoolId);
    await this.cache.invalidate(`curriculum:tree:${chapter.subject_id}:*`);
    await this.audit.log({ eventType: 'curriculum:topic_updated', actorId: ctx.userId,
      resourceType: 'topic', resourceId: topicId, outcome: 'success' });
    return { ...updated, lo_count: await this.repo.getLOCount(topicId),
      progress_status: null, created_at: updated.created_at };
  }

  async deleteTopic(ctx: RequestContext, topicId: string): Promise<void> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const existing = await this.repo.findTopicById(topicId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Topic not found');

    const assignCount = await this.repo.getAssignmentCountForTopic(topicId);
    if (assignCount > 0) throw new ValidationError('Topic has linked assignments');

    await this.repo.softDeleteTopic(topicId);
    await this.cache.invalidate(`curriculum:tree:*`);
  }

  // ─── Learning Objective CRUD ─────────────────────────────────

  async createLO(ctx: RequestContext, input: CreateLOInput): Promise<LearningObjectiveResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const topic = await this.repo.findTopicById(input.topic_id, ctx.schoolId);
    if (!topic) throw new NotFoundError('Topic not found');

    const dup = await this.repo.findLOByCode(input.code, ctx.schoolId);
    if (dup) throw new ConflictError(`LO code "${input.code}" already exists`);

    const lo = await this.repo.createLO({ ...input, school_id: ctx.schoolId });
    await this.audit.log({ eventType: 'curriculum:lo_created', actorId: ctx.userId,
      resourceType: 'learning_objective', resourceId: lo.id, outcome: 'success' });
    return lo;
  }

  async updateLO(ctx: RequestContext, loId: string, input: UpdateLOSchema): Promise<LearningObjectiveResponse> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const existing = await this.repo.findLOById(loId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Learning Objective not found');

    if (input.code && input.code !== existing.code) {
      const dup = await this.repo.findLOByCode(input.code, ctx.schoolId);
      if (dup) throw new ConflictError(`LO code "${input.code}" already exists`);
    }

    const updated = await this.repo.updateLO(loId, input);
    await this.audit.log({ eventType: 'curriculum:lo_updated', actorId: ctx.userId,
      resourceType: 'learning_objective', resourceId: loId, outcome: 'success' });
    return updated;
  }

  async bulkCreateLOs(ctx: RequestContext, topicId: string, input: BulkCreateLOSchema): Promise<{ created: LearningObjectiveResponse[]; skipped: string[] }> {
    await this.authz.assert(ctx, 'curriculum:manage');
    const topic = await this.repo.findTopicById(topicId, ctx.schoolId);
    if (!topic) throw new NotFoundError('Topic not found');

    const created: LearningObjectiveResponse[] = [];
    const skipped: string[] = [];
    for (const lo of input.learning_objectives) {
      const existing = await this.repo.findLOByCode(lo.code, ctx.schoolId);
      if (existing) { skipped.push(lo.code); continue; }
      created.push(await this.repo.createLO({
        topic_id: topicId, school_id: ctx.schoolId, code: lo.code,
        description: lo.description, bloom_taxonomy_level: lo.bloom_taxonomy_level ?? null,
        sort_order: lo.sort_order,
      }));
    }
    return { created, skipped };
  }

  // ─── Progress Marking ────────────────────────────────────────

  async markProgress(ctx: RequestContext, input: MarkProgressInput): Promise<void> {
    await this.authz.assert(ctx, 'curriculum:mark_progress');

    const entityExists = input.entity_type === 'chapter'
      ? await this.repo.findChapterById(input.entity_id, ctx.schoolId)
      : await this.repo.findTopicById(input.entity_id, ctx.schoolId);
    if (!entityExists) throw new NotFoundError(`${input.entity_type} not found`);

    const teaches = await this.repo.teacherTeachesSubjectInClass(
      ctx.profileId!, input.class_id, input.subject_id);
    if (!teaches && ctx.role !== 'school_admin') {
      throw new ForbiddenError('You do not teach this subject in this class');
    }

    await this.repo.upsertProgress({
      teacher_id: ctx.profileId!, entity_type: input.entity_type,
      entity_id: input.entity_id, school_id: ctx.schoolId,
      class_id: input.class_id, subject_id: input.subject_id,
      status: input.status, notes: input.notes ?? null,
      completed_at: input.status === 'completed' ? new Date().toISOString() : null,
    });

    await this.cache.invalidate(`curriculum:tree:${input.subject_id}:*`);

    // Auto-mark chapter complete if all topics done
    if (input.entity_type === 'topic' && input.status === 'completed') {
      await this.autoMarkChapterIfComplete(ctx, input.class_id, input.subject_id,
        (entityExists as any).chapter_id);
    }
  }

  private async autoMarkChapterIfComplete(ctx: RequestContext, classId: string, subjectId: string, chapterId: string): Promise<void> {
    const topics = await this.repo.getTopicsByChapter(chapterId);
    const completedTopics = await this.repo.getCompletedTopicCount(ctx.profileId!, chapterId, classId);
    if (topics.length > 0 && completedTopics >= topics.length) {
      await this.repo.upsertProgress({ teacher_id: ctx.profileId!, entity_type: 'chapter',
        entity_id: chapterId, school_id: ctx.schoolId, class_id: classId, subject_id: subjectId,
        status: 'completed', notes: 'Auto-completed: all topics complete',
        completed_at: new Date().toISOString() });
    }
  }

  // ─── Progress Reports ────────────────────────────────────────

  async getClassProgress(ctx: RequestContext, classId: string, subjectId?: string): Promise<any[]> {
    await this.authz.assert(ctx, 'curriculum:view_progress', { classId });
    const progress = await this.repo.getClassProgress(ctx.schoolId, classId, subjectId);
    return this.aggregateProgress(progress);
  }

  async getPrincipalOverview(ctx: RequestContext): Promise<any[]> {
    await this.authz.assert(ctx, 'curriculum:view_progress');
    const progress = await this.repo.getSchoolProgress(ctx.schoolId);
    return this.aggregateProgress(progress);
  }

  private aggregateProgress(progress: any[]): any[] {
    const bySubject: Record<string, any> = {};
    for (const p of progress) {
      const key = `${p.class_id}:${p.subject_id}`;
      if (!bySubject[key]) {
        bySubject[key] = { class_id: p.class_id, class_name: p.class_name,
          subject_id: p.subject_id, subject_name: p.subject_name,
          teacher_id: p.teacher_id, chapters: 0, chapters_completed: 0,
          topics: 0, topics_completed: 0 };
      }
      if (p.entity_type === 'chapter') {
        bySubject[key].chapters++;
        if (p.status === 'completed') bySubject[key].chapters_completed++;
      } else {
        bySubject[key].topics++;
        if (p.status === 'completed') bySubject[key].topics_completed++;
      }
    }
    return Object.values(bySubject).map((s: any) => ({
      ...s,
      completion_pct: s.chapters + s.topics > 0
        ? Math.round(((s.chapters_completed + s.topics_completed) / (s.chapters + s.topics)) * 100) : 0,
    }));
  }
}
```

---

## 5. Repositories

```typescript
export class CurriculumRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  // Chapters
  async createChapter(input: any) { /* INSERT INTO chapters ... */ }
  async findChapterById(id: string, schoolId: string) { /* SELECT ... */ }
  async findChapterByName(subjectId: string, name: string) { /* SELECT ... */ }
  async updateChapter(id: string, data: any) { /* UPDATE ... */ }
  async softDeleteChapter(id: string) { /* UPDATE deleted_at ... */ }
  async getTopicCount(chapterId: string): Promise<number> { /* COUNT ... */ }
  async getLOCount(topicId: string): Promise<number> { /* COUNT learning_objectives WHERE topic_id AND deleted IS NULL */ }
  async findLOById(id: string, schoolId: string) { /* SELECT ... WHERE school_id AND deleted IS NULL */ }
  async getAssignmentCountForChapter(chapterId: string): Promise<number> {
    // ⚠️ Nested subqueries in Supabase JS client can silently fail or return 0.
    // Use two-step approach: fetch LO IDs first, then count assignments.
    const { data: loIds } = await this.db.from('learning_objectives')
      .select('id')
      .in('topic_id', this.db.from('topics').select('id').eq('chapter_id', chapterId));
    if (!loIds || loIds.length === 0) return 0;
    const { count } = await this.db.from('assignments')
      .select('id', { count: 'exact', head: true })
      .in('lo_id', loIds.map(lo => lo.id));
    return count ?? 0;
  }

  // Topics
  async createTopic(input: any) { /* INSERT INTO topics ... */ }
  async findTopicById(id: string, schoolId: string) { /* SELECT ... */ }
  async findTopicByName(chapterId: string, name: string) { /* SELECT ... */ }
  async updateTopic(id: string, data: any) { /* UPDATE ... */ }
  async softDeleteTopic(id: string) { /* UPDATE deleted_at ... */ }
  async getTopicsByChapter(chapterId: string): Promise<any[]> { /* SELECT ... */ }
  async getAssignmentCountForTopic(topicId: string): Promise<number> {
    // Count assignments linked to LOs in this topic
    const { count } = await this.db.from('assignments').select('id', { count: 'exact', head: true })
      .in('lo_id', this.db.from('learning_objectives').select('id').eq('topic_id', topicId));
    return count ?? 0;
  }

  // Learning Objectives
  async createLO(input: any) { /* INSERT INTO learning_objectives ... */ }
  async findLOByCode(code: string, schoolId: string) { /* SELECT ... */ }
  async updateLO(id: string, data: any) { /* UPDATE ... */ }
  async softDeleteLO(id: string) { /* UPDATE deleted_at ... */ }

  // Tree Query
  async getChaptersWithTopics(subjectId: string, schoolId: string): Promise<any[]> {
    const { data } = await this.db.from('chapters')
      .select('*, topics(*, learning_objectives(*))')
      .eq('subject_id', subjectId).eq('school_id', schoolId)
      .is('deleted_at', null).order('sort_order', { ascending: true });
    return data ?? [];
  }

  async getTopicsWithLOs(chapterId: string, schoolId: string): Promise<any[]> {
    const { data } = await this.db.from('topics')
      .select('*, learning_objectives(*)')
      .eq('chapter_id', chapterId).eq('school_id', schoolId)
      .is('deleted_at', null).order('sort_order', { ascending: true });
    return data ?? [];
  }

  // Progress
  async upsertProgress(input: any): Promise<void> {
    await this.db.from('curriculum_progress').upsert(input, {
      onConflict: 'teacher_id, entity_type, entity_id, class_id',
    });
  }

  async getProgressForTree(teacherId: string, classId: string, subjectId: string): Promise<any[]> {
    const { data } = await this.db.from('curriculum_progress')
      .select('entity_type, entity_id, status')
      .eq('teacher_id', teacherId).eq('class_id', classId).eq('subject_id', subjectId);
    return data ?? [];
  }

  async getCompletedTopicCount(teacherId: string, chapterId: string, classId: string): Promise<number> {
    const { count } = await this.db.from('curriculum_progress')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).eq('class_id', classId)
      .eq('entity_type', 'topic').eq('status', 'completed')
      .in('entity_id', this.db.from('topics').select('id').eq('chapter_id', chapterId));
    return count ?? 0;
  }

  async teacherTeachesSubjectInClass(teacherId: string, classId: string, subjectId: string): Promise<boolean> {
    const { data } = await this.db.from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).eq('class_id', classId)
      .eq('subject_id', subjectId).is('deleted_at', null);
    return !!data;
  }

  // Reports
  async getClassProgress(schoolId: string, classId: string, subjectId?: string): Promise<any[]> {
    let query = this.db.from('curriculum_progress')
      .select('*, classes!inner(name, section), subjects!inner(name)')
      .eq('school_id', schoolId).eq('class_id', classId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    const { data } = await query;
    return data ?? [];
  }

  async getSchoolProgress(schoolId: string): Promise<any[]> {
    const { data } = await this.db.from('curriculum_progress')
      .select('*, classes!inner(name, section), subjects!inner(name)')
      .eq('school_id', schoolId);
    return data ?? [];
  }
}
```

---

## 6. API Routes

### 6.1 GET /curriculum/tree — Get curriculum tree

```
GET /curriculum/tree?subject_id=...&class_id=...&include_progress=true&progress_teacher_id=...
Role: school_admin, principal, teacher (own), student (own class), parent (children's)

Response: 200 { data: CurriculumTreeResponse }
Cached: 5 min
```

### 6.2 POST /curriculum/chapters — Create chapter

```
POST /curriculum/chapters
Role: school_admin
Request: { subject_id, name, chapter_number, description?, is_required?, estimated_periods? }
Response: 201 { data: ChapterResponse }
Errors: 404 (subject), 409 (duplicate name), 422
```

### 6.3 PATCH /curriculum/chapters/{id} — Update chapter

```
PATCH /curriculum/chapters/{id}
Role: school_admin
Response: 200 { data: ChapterResponse }
Errors: 404, 409 (duplicate name), 422
```

### 6.4 POST /curriculum/chapters/{id}/deactivate — Delete chapter

```
POST /curriculum/chapters/{id}/deactivate
Role: school_admin
Errors: 400 (has linked assignments), 404
```

### 6.5 POST /curriculum/topics — Create topic

```
POST /curriculum/topics
Role: school_admin
Request: { chapter_id, name, description?, estimated_periods?, sort_order? }
Errors: 404 (chapter), 409 (duplicate name), 422
```

### 6.6 POST /curriculum/topics/{id}/deactivate — Delete topic

```
POST /curriculum/topics/{id}/deactivate
Role: school_admin
Errors: 400 (has linked assignments), 404
```

### 6.7 PATCH /curriculum/topics/{id} — Update topic

```
PATCH /curriculum/topics/{id}
Role: school_admin
Request: { name?, description?, learning_objectives_text?, estimated_periods?, sort_order? }
Response: 200 { data: TopicResponse }
Errors: 404, 409 (duplicate name), 422
```

### 6.8 POST /curriculum/learning-objectives — Create LO

```
POST /curriculum/learning-objectives
Role: school_admin
Request: { topic_id, code, description, bloom_taxonomy_level?, sort_order? }
Audit: curriculum:lo_created
Errors: 404 (topic), 409 (duplicate code), 422
```

### 6.9 PATCH /curriculum/learning-objectives/{id} — Update LO

```
PATCH /curriculum/learning-objectives/{id}
Role: school_admin
Request: { code?, description?, bloom_taxonomy_level?, sort_order? }
Response: 200 { data: LearningObjectiveResponse }
Audit: curriculum:lo_updated
Errors: 404, 409 (duplicate code), 422
```

### 6.10 POST /curriculum/learning-objectives/bulk — Bulk create LOs

```
POST /curriculum/learning-objectives/bulk?topic_id=...
Role: school_admin
Request: { learning_objectives: Array<{code, description, bloom_taxonomy_level?, sort_order?}> }
Response: 201 { data: { created: LearningObjectiveResponse[], skipped: string[] } }
Max: 20 LOs per call
```

### 6.11 POST /curriculum/progress — Mark progress

```
POST /curriculum/progress
Role: teacher, school_admin
Request: { entity_type, entity_id, class_id, subject_id, status, notes? }
Errors: 403 (doesn't teach class+subject), 404 (entity not found), 422
```

### 6.12 POST /curriculum/progress/bulk — Bulk mark progress

```
POST /curriculum/progress/bulk
Role: teacher, school_admin
Request: { class_id, subject_id, marks: Array<{entity_type, entity_id, status, notes?}> }
Max: 50 marks per batch
Audit: curriculum:progress_bulk
```

### 6.13 GET /curriculum/progress/class — Class progress report

```
GET /curriculum/progress/class?class_id=...&subject_id=...
Role: school_admin, principal, teacher (own), parent (children's)
Response: 200 { data: Array<{subject, chapters, topics, completion_pct}> }
```

### 6.14 GET /curriculum/progress/school — Principal overview

```
GET /curriculum/progress/school
Role: school_admin, principal
Response: 200 { data: Array<{class, subject, completion_pct}> }
```

---

## 7. Permissions

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| View curriculum tree | ✅ | ✅ | ✅ (class) | ✅ (own) | ✅ (children) |
| Create/edit chapter | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete chapter | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Create/edit topic | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete topic | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Create/edit LO | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark progress | ❌ | ❌ | 🔷 (own) | ❌ | ❌ |
| View class progress | ✅ | ✅ | 🔷 (own) | 📋 (own) | 🔷 (children) |
| View school progress | ✅ | ✅ | ❌ | ❌ | ❌ |
| Seed CBSE curriculum | ✅ | ❌ | ❌ | ❌ | ❌ |

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher marks progress only for own classes | `teacher_class_subjects` check |
| Teacher views progress for own classes | `curriculum_progress.teacher_id == ctx.profileId` |
| Student views own class curriculum | `students.class_id` scope |
| Parent views children's class curriculum | `student_parents` join scope |
| Principal views all school progress | No scope filter (within school) |

### 7.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'curriculum:manage');   // Admin only
await this.authz.assert(ctx, 'curriculum:mark_progress', { classId, subjectId });  // Teacher + scope
await this.authz.assert(ctx, 'curriculum:view_progress', { classId });  // Role-dependent scope
```

---

## 8. Validation Rules

| Rule | Layer | Error |
|------|-------|-------|
| Chapter name unique per subject | DB UNIQUE + Service check | 409 |
| Topic name unique per chapter | DB UNIQUE + Service check | 409 |
| LO code unique per school | DB UNIQUE + Service check | 409 |
| LO code format: `SCI-7-NP-PH-01` | Zod regex | 422 |
| Max 20 LOs per bulk create | Zod | 422 |
| Max 50 marks per bulk progress | Zod | 422 |
| Progress entity must exist | Service lookup | 404 |
| Teacher must teach class+subject | Service scope check | 403 |
| Chapter delete blocked if assignments linked | Service count check | 400 |
| Topic delete blocked if assignments linked | Service count check | 400 |

---

## 9. How Curriculum Drives the Platform

### 9.1 How Curriculum Drives Homework

**Link**: `assignments` table has optional `lo_id` FK → `learning_objectives.id`

When a teacher creates a homework assignment in the UI:
1. Teacher selects a class and subject
2. System loads the curriculum tree for that subject
3. Teacher selects a specific Learning Objective (or topic/chapter) to tie the assignment to
4. The assignment is stored with `lo_id` pointing to the selected LO

**Query**: `SELECT * FROM assignments WHERE lo_id = :loId AND class_id = :classId`

**Impact**: Homework is no longer freestanding. Every assignment is curriculum-aligned. Teachers can see "I need to create an assignment for LO SCI-7-NP-PH-01 (Photosynthesis)". Students see assignments grouped by chapter/topic in their dashboard.

**Auto-suggestion system**: When a teacher marks a topic as "completed" via curriculum progress, the system can suggest: "You marked 'Photosynthesis' as complete. Would you like to create a homework assignment to assess this topic?"

### 9.2 How Curriculum Drives Tests

**Link**: `assignments` table with `assignment_type = 'quiz' | 'unit_test'` and `lo_id` FK

**Test creation flow**:
1. Teacher navigates to curriculum tree → selects a chapter
2. Clicks "Create Unit Test" — the test is pre-populated with the chapter's LOs
3. AI generates questions targeting the selected LOs (see Section 9.3)
4. The test's `lo_id` is set to the chapter or specific LO

**Grading impact**: When grading, the system can compute per-LO mastery:
```sql
SELECT lo_id, AVG(score) FROM submissions
JOIN assignment_questions ON ...
WHERE lo_id IN (SELECT id FROM learning_objectives WHERE topic_id = :topicId)
GROUP BY lo_id
```

**Adaptive testing**: If a student scores <40% on LOs for "Photosynthesis", the system can recommend remedial assignments targeting those LOs.

### 9.3 How Curriculum Drives AI

**Link**: AI generation prompts include curriculum context

When a teacher clicks "Generate Homework with AI" for Class 7 Science, Chapter "Nutrition in Plants", the system sends the following context to the AI provider:

```json
{
  "context": {
    "class": "Grade 7",
    "subject": "Science",
    "chapter": "Nutrition in Plants",
    "topics": ["Photosynthesis", "Mode of Nutrition in Plants", "Saprotrophs", "Parasites"],
    "learning_objectives": [
      {"code": "SCI-7-NP-PH-01", "description": "Describe the process of photosynthesis"},
      {"code": "SCI-7-NP-PH-02", "description": "Identify the reactants and products of photosynthesis"},
      {"code": "SCI-7-NP-MN-01", "description": "Differentiate between autotrophic and heterotrophic nutrition"}
    ]
  },
  "prompt": "Generate 5 homework questions for Grade 7 Science covering..."
}
```

**Benefits**:
- AI generates *curriculum-aligned* content — not generic questions
- Teachers save time: no need to manually specify which topics to cover
- AI can generate questions at the right Bloom's taxonomy level
- Cost efficiency: AI calls are curriculum-aware, reducing irrelevant generation

**For student doubt assistant**:
> Student: "I don't understand photosynthesis"
> System: Looks up the LO code, finds relevant chapters, provides curriculum-specific context to AI
> AI response is tailored to Grade 7 Science Chapter 1, not a generic Wikipedia answer

**For lesson plan generation**:
> Teacher clicks "Generate Lesson Plan" for Topic "Photosynthesis"
> System sends LOs, Bloom's levels, estimated periods, and class information
> AI generates a complete lesson plan with activities mapped to each LO

### 9.4 How Curriculum Drives Analytics

**Link**: Materialized views and dashboard queries aggregate by curriculum entity

**Mastery tracking** (via `mv_progress_mastery`):

```sql
SELECT
  lo.id, lo.code, lo.description,
  AVG(sub.total_score / a.max_score * 100) AS mastery_pct,
  COUNT(sub.id) AS attempts,
  MAX(sub.graded_at) AS last_assessed
FROM learning_objectives lo
LEFT JOIN assignments a ON a.lo_id = lo.id
LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = :studentId AND sub.is_graded = TRUE
WHERE lo.topic_id = :topicId AND lo.deleted_at IS NULL
GROUP BY lo.id, lo.code, lo.description;
```

**Principal dashboard widgets powered by curriculum**:

| Widget | Data Source | Question Answered |
|--------|-------------|-------------------|
| Curriculum Completion % | `mv_curriculum_completion` | "How much of the syllabus has been covered?" |
| Per-Class Progress | `curriculum_progress` WHERE class_id = ... | "Is Class 7A ahead of 7B in Science?" |
| Teacher Coverage | `curriculum_progress` GROUP BY teacher_id | "Which teachers are falling behind schedule?" |
| Student Mastery | `mv_progress_mastery` | "Which students are struggling with which LOs?" |
| At-Risk by LO | `mv_progress_mastery` WHERE mastery_pct < 40 | "Which LOs need to be re-taught?" |
| Bloom's Level Distribution | `learning_objectives.bloom_taxonomy_level` | "Are we assessing enough 'analyze' level skills?" |

**Curriculum report**: School admin can generate a report showing:
- Total chapters: 15, Covered: 12 (80%)
- Total topics: 45, Covered: 38 (84%)
- Topics with <60% mastery: 3 (Need intervention)
- LOs never assessed: 5 (Create assignments for these)

**AI-powered insights**: When curriculum completion falls behind schedule (e.g., 40% of topics covered at 60% of the term elapsed), the system flags the teacher and principal for intervention.

---

## 10. Risk Analysis

### 10.1 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Orphaned LOs when topic deleted** | Assignments reference deleted LOs | `ON DELETE CASCADE` on `learning_objectives.topic_id`. Assignments keep `lo_id` (null allowed). |
| 2 | **Chapter deleted with topic assignments** | Broken curriculum tree | Block delete if assignments linked to LOs within chapter's topics |
| 3 | **Progress recorded for non-existent entity** | Data inconsistency | Service checks entity exists before insert |
| 4 | **Duplicate progress records** | Conflicting status for same teacher+entity+class | `UNIQUE(teacher_id, entity_type, entity_id, class_id)` with upsert |

### 10.2 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **Curriculum tree with progress for 50+ schools** | Principal loads all school progress | Paginate by class/subject. Cache tree for 5 min. Use MV for aggregate. |
| 2 | **Progress update triggers cache invalidation** | 30 teachers marking progress simultaneously | Cache key includes teacher_id. Only invalidate relevant tree cache. |
| 3 | **Curriculum tree for subject with 20 chapters, 100 topics, 400 LOs** | Full tree query with nested joins | Single query with Supabase nested select. Cache for 5 min. |
| 4 | **MV refresh blocks writes** | Concurrent progress updates | Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| 5 | **Cache wildcard invalidation not supported** | `curriculum:tree:${id}:*` uses Redis-style key pattern matching | Document cache requirement in Appendix. Use tagged cache or explicit key enumeration as fallback. |

### 10.3 CBSE Curriculum Seeding Risk

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Curriculum doesn't match CBSE 2026-27 syllabus** | Outdated content | Annual update process. Admin can override individual chapters/topics. |
| 2 | **Seed script runs multiple times** | Duplicate curriculum | Use upsert on (subject_id, name) for chapters and topics. |
| 3 | **Seed script too large (5,250 records)** | Timeout or memory issues | Batch insert in chunks of 100. Run async with progress reporting. |

### 10.4 V1 Mistakes Not to Repeat

| V1 Mistake | V2 Fix |
|-----------|--------|
| No curriculum entities at all | Chapters, topics, LOs with proper hierarchy |
| Assignments had no curriculum link | `assignments.lo_id` FK |
| No progress tracking | `curriculum_progress` with auto-complete |
| AI generated blind (no curriculum context) | Prompts include curriculum tree |
| Analytics had no per-LO mastery | `mv_progress_mastery` with per-LO aggregation |

---

## 11. Testing Checklist

### 11.1 Unit Tests

| Test | Expected | Priority |
|------|----------|----------|
| `get_tree: full tree` | Returns chapters → topics → LOs nested | P0 |
| `get_tree: with progress` | Attaches status per entity | P0 |
| `get_tree: cached` | Returns from cache on 2nd call | P1 |
| `get_tree: teacher scoped` | Only subjects in teacher's classes | P0 |
| `create_chapter: valid` | Chapter created, cache invalidated | P0 |
| `create_chapter: duplicate name` | 409 ConflictError | P0 |
| `create_chapter: invalid subject` | 404 | P1 |
| `delete_chapter: has linked assignments` | 400 | P0 |
| `delete_chapter: no linked assignments` | Soft deleted, cache cleared | P0 |
| `create_topic: valid` | Topic created under chapter | P0 |
| `create_topic: duplicate name in chapter` | 409 | P0 |
| `create_lo: valid` | LO created under topic | P0 |
| `create_lo: duplicate code` | 409 | P0 |
| `create_lo: invalid code format` | 422 | P1 |
| `bulk_create_lo: 10 LOs` | 10 created, duplicates skipped | P0 |
| `mark_progress: valid` | Upsert progress record | P0 |
| `mark_progress: teacher doesn't teach class` | 403 | P0 |
| `mark_progress: topic completed → auto-mark chapter` | Chapter auto-completed if all topics done | P0 |
| `mark_progress: entity not found` | 404 | P1 |
| `bulk_mark_progress: 50 marks` | All 50 created | P0 |
| `get_class_progress: aggregated` | Returns completion percentages by subject | P0 |

### 11.2 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Create subject → Create 3 chapters → Create 5 topics → Create 20 LOs | Full tree built | P0 |
| Mark 4 of 5 topics complete → Verify auto-complete | Chapter auto-completes | P0 |
| Mark topic complete → Verify cache invalidated | Tree returns new status on next call | P0 |
| Create LO → Create assignment linked to LO → Delete chapter | 400, blocked by assignment | P0 |
| Teacher views curriculum: only assigned subjects | Scoped correctly | P0 |
| Principal overview: all classes across school | Aggregated correctly | P0 |

### 11.3 Security Tests

| Test | Expected | Priority |
|------|----------|----------|
| Teacher creates chapter | 403 | P0 |
| Student marks progress | 403 | P0 |
| Teacher marks progress for non-assigned class | 403 | P0 |
| Parent views curriculum tree of non-child class | 403 or empty | P0 |
| Cross-school curriculum access | 403 or empty | P0 |

### 11.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Curriculum tree (400 LOs) | <200ms | Cached query |
| Mark progress with auto-complete | <300ms | Upsert + count check |
| Principal overview (100 classes) | <1s | Materialized view |
| Bulk progress (50 marks) | <2s | Sequential upserts |

---

## Appendix A: CBSE Seed Data Structure

```typescript
// src/modules/curriculum/curriculum.seeder.ts

interface CBSESubjectSeed {
  subject_name: string;
  subject_code: string;
  chapters: Array<{
    name: string;
    chapter_number: number;
    topics: Array<{
      name: string;
      sort_order: number;
      learning_objectives: Array<{
        code: string;
        description: string;
        bloom_taxonomy_level: string;
      }>;
    }>;
  }>;
}

// Example for Grade 7 Science
const SEED_DATA: Record<string, CBSESubjectSeed[]> = {
  "7": [
    {
      subject_name: "Science",
      subject_code: "SCI",
      chapters: [
        {
          name: "Nutrition in Plants",
          chapter_number: 1,
          topics: [
            {
              name: "Photosynthesis",
              sort_order: 1,
              learning_objectives: [
                { code: "SCI-7-NP-PH-01", description: "Describe the process of photosynthesis",
                  bloom_taxonomy_level: "understand" },
                { code: "SCI-7-NP-PH-02", description: "Identify reactants and products of photosynthesis",
                  bloom_taxonomy_level: "remember" },
              ],
            },
            // ... more topics per chapter
          ],
        },
        // ... more chapters per subject
      ],
    },
    // ... more subjects per class
  ],
};
```

## Appendix B: Cache Architecture Notes

```typescript
// ⚠️ Cache Key Pattern Note:
// The curriculum module uses `*` wildcard for cache invalidation:
//   await this.cache.invalidate(`curriculum:tree:${subjectId}:*`);
// This pattern assumes Redis-style key matching (KEYS or SCAN).
// If using in-memory cache (e.g., lru-cache), manually track key prefixes:
//   this.cacheKeys.push(key);
//   await this.cache.invalidate(this.cacheKeys.filter(k => k.startsWith(
//     `curriculum:tree:${subjectId}`)));
// For Supabase edge functions, use tags: cache.set(key, value, { tags: [`tree:${subjectId}`] })
```

## Appendix C: Error Codes

```typescript
export const CURRICULUM_ERROR_CODES = {
  CURR_400_01: { status: 400, message: 'Chapter has linked assignments. Remove curriculum links first.' },
  CURR_400_02: { status: 400, message: 'Topic has linked assignments. Remove curriculum links first.' },
  CURR_400_03: { status: 400, message: 'You do not teach this subject in this class.' },
  CURR_400_04: { status: 400, message: 'LO code format is invalid. Expected: SUB-CLASS-CH-TP-NN' },

  CURR_403: { status: 403, message: 'You do not have permission to manage curriculum.' },

  CURR_404_01: { status: 404, message: 'Chapter not found.' },
  CURR_404_02: { status: 404, message: 'Topic not found.' },
  CURR_404_03: { status: 404, message: 'Learning Objective not found.' },
  CURR_404_04: { status: 404, message: 'Subject not found.' },

  CURR_409_01: { status: 409, message: 'Chapter with this name already exists in this subject.' },
  CURR_409_02: { status: 409, message: 'Topic with this name already exists in this chapter.' },
  CURR_409_03: { status: 409, message: 'LO code already exists in this school.' },
} as const;
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement module scaffolding, create CBSE seed data, and begin API endpoint development
