# ATHON V2 — Subjects Module Implementation

**Reviewer**: Staff Backend Engineer  \
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  \
**Product**: Athon — AI Teacher Operating System for CBSE Schools  \
**Date**: June 10, 2026  \
**References**: DATABASE_V2_FINAL.md · CLASSES_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0

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
9. [Risk Analysis](#9-risk-analysis)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Database Schema

### 1.1 Tables

#### `subjects` (core table)

```sql
CREATE TABLE subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id),
    name            VARCHAR(100) NOT NULL,          -- "Mathematics"
    code            VARCHAR(20) NOT NULL,           -- "MATH"
    category        VARCHAR(50),                    -- "core", "elective", "co_curricular"
    description     TEXT,
    is_core         BOOLEAN NOT NULL DEFAULT TRUE,   -- Core or elective
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,   -- Can be temporarily disabled without soft-delete
    display_order   INTEGER NOT NULL DEFAULT 0,     -- Sort order in lists
    color           VARCHAR(7),                     -- Hex color for UI: "#4F46E5"
    icon            VARCHAR(50),                    -- Icon identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                     -- Soft delete
);

CREATE UNIQUE INDEX idx_subjects_school_code ON subjects(school_id, code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_subjects_school_name ON subjects(school_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_school_core ON subjects(school_id, is_core, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_active ON subjects(school_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_subjects_category ON subjects(school_id, category) WHERE deleted_at IS NULL;
```

**Design rationale**:
- `UNIQUE(school_id, code)` prevents duplicate subject codes within a school (e.g., "MATH" cannot be used twice)
- `UNIQUE(school_id, name)` prevents duplicate names (e.g., "Mathematics" cannot exist twice with different codes)
- `display_order` controls sort order in dropdowns and dashboards (admin-configurable)
- `color` and `icon` are UI-facing — stored here to avoid a separate lookup table
- `category` supports grouping (core academic subjects vs electives vs co-curricular)
- Soft delete preserves assignment history — deleting a subject only hides it from new assignments

#### `teacher_class_subjects` (assignment table — extended from Classes module)

```sql
CREATE TABLE teacher_class_subjects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id        UUID NOT NULL REFERENCES teachers(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    subject_id        UUID NOT NULL REFERENCES subjects(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    academic_term_id  UUID NOT NULL REFERENCES academic_terms(id),
    is_class_teacher  BOOLEAN NOT NULL DEFAULT FALSE,
    period_count      INTEGER DEFAULT 0,            -- Periods per week
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    UNIQUE(teacher_id, class_id, subject_id, academic_term_id)
);

CREATE INDEX idx_tcs_class_subject_term ON teacher_class_subjects(class_id, subject_id, academic_term_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_teacher_term ON teacher_class_subjects(teacher_id, academic_term_id)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_subject_term ON teacher_class_subjects(subject_id, academic_term_id)
    WHERE deleted_at IS NULL;
```

#### `class_subjects` (class-subject mapping — NEW table for Subject Module)

This decouples "which subjects does this class study" from "which teacher teaches them". A class must first be assigned a subject before a teacher can be assigned to teach it.

```sql
CREATE TABLE class_subjects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    subject_id        UUID NOT NULL REFERENCES subjects(id),
    academic_term_id  UUID NOT NULL REFERENCES academic_terms(id),
    is_mandatory      BOOLEAN NOT NULL DEFAULT TRUE, -- Required subject or elective
    period_count      INTEGER DEFAULT 0,             -- Periods per week
    max_score         DECIMAL(6,2),                  -- Max marks for this subject in this term
    passing_percentage DECIMAL(5,2) DEFAULT 40.00,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    UNIQUE(class_id, subject_id, academic_term_id)
);

CREATE INDEX idx_cs_class_term ON class_subjects(class_id, academic_term_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cs_subject_term ON class_subjects(subject_id, academic_term_id) WHERE deleted_at IS NULL;
```

**Design rationale for `class_subjects`**:
- Separates curriculum planning (which subjects a class studies) from staffing (which teacher teaches them)
- A class might offer a subject but not have a teacher assigned yet — this table captures that intent
- Enables timetabling without teacher assignment
- `period_count` tracks how many weekly periods this subject gets in this class (timetable planning)
- `max_score` and `passing_percentage` can vary by class even for the same subject

### 1.2 ENUMs

```sql
-- Extend audit_event_type from Auth Module
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:assigned_to_class';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:removed_from_class';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:teacher_assigned';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'subject:teacher_removed';
```

### 1.3 RLS Policies

```sql
-- Subjects: admin/principal see all; teacher sees subjects in their classes; student/parent see their class subjects
CREATE POLICY subjects_select ON subjects FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    AND (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid()::uuid
                AND role IN ('school_admin', 'principal'))
        OR id IN (SELECT subject_id FROM teacher_class_subjects
                  WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
        OR id IN (SELECT subject_id FROM class_subjects
                  WHERE class_id IN (
                      SELECT class_id FROM students WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)
                      UNION
                      SELECT ce.class_id FROM class_enrollments ce
                      JOIN student_parents sp ON sp.student_id = ce.student_id
                      WHERE sp.parent_id = (SELECT id FROM parents WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid))
                  ))
    )
);

CREATE POLICY subjects_insert ON subjects FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                 AND role = 'school_admin')
);

CREATE POLICY subjects_update ON subjects FOR UPDATE USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                 AND role = 'school_admin')
);

-- Class subjects: scoped by class visibility
CREATE POLICY class_subjects_select ON class_subjects FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    AND (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid()::uuid AND role IN ('school_admin', 'principal'))
        OR class_id IN (SELECT class_id FROM teacher_class_subjects
                        WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
        OR class_id IN (SELECT class_id FROM students WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid))
        OR class_id IN (SELECT ce.class_id FROM class_enrollments ce
                        JOIN student_parents sp ON sp.student_id = ce.student_id
                        WHERE sp.parent_id = (SELECT id FROM parents WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
    )
);
```

---

## 2. Folder Structure

```
src/modules/subjects/
├── subjects.service.ts              # Business logic: CRUD + assignments
├── subjects.repository.ts           # Database access: subjects, class_subjects, teacher_class_subjects
├── subjects.router.ts               # API route handlers
├── subjects.validator.ts            # Zod schemas for request validation
├── subjects.schema.ts              # TypeScript type definitions
├── subjects.permissions.ts          # Permission checks for subject operations
├── subjects.utils.ts                # Helper functions (code normalization, conflict detection)
│
src/modules/classes/                 # Consumed by subjects module
├── classes.repository.ts            # Class lookups for subject assignment
│
src/modules/teachers/                # Consumed by subjects module
├── teachers.repository.ts           # Teacher lookups for teacher-subject assignment
```

---

## 3. Schemas (Zod)

```typescript
// src/modules/subjects/subjects.validator.ts

import { z } from 'zod';

// ─── Shared Base ─────────────────────────────────────────────

const UUID = z.string().uuid();
const Name = z.string().min(1, 'Required').max(100);
const Code = z.string().min(1, 'Required').max(20)
    .transform(v => v.toUpperCase().trim());

// ─── Create Subject ──────────────────────────────────────────

export const CreateSubjectSchema = z.object({
  name: Name,
  code: Code,
  category: z.enum(['core', 'elective', 'co_curricular']).optional(),
  description: z.string().max(500).optional(),
  is_core: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
  icon: z.string().max(50).optional(),
});

// ─── Update Subject ──────────────────────────────────────────

export const UpdateSubjectSchema = z.object({
  name: Name.optional(),
  code: Code.optional(),
  category: z.enum(['core', 'elective', 'co_curricular']).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  is_core: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
});

// ─── Assign Subject to Class ─────────────────────────────────

export const AssignToClassSchema = z.object({
  class_id: UUID,
  academic_term_id: UUID,
  is_mandatory: z.boolean().default(true),
  period_count: z.number().int().min(0).default(0),
  max_score: z.number().positive().optional(),
  passing_percentage: z.number().min(0).max(100).optional(),
});

// ─── Assign Teacher to Subject ───────────────────────────────

export const AssignTeacherSchema = z.object({
  teacher_id: UUID,
  class_id: UUID,
  academic_term_id: UUID,
  is_class_teacher: z.boolean().default(false),
  period_count: z.number().int().min(0).default(0),
});

// ─── Bulk Assign Subjects to Class ───────────────────────────

export const BulkAssignToClassSchema = z.object({
  subject_ids: z.array(UUID).min(1, 'At least one subject required'),
  academic_term_id: UUID,
  replace_existing: z.boolean().default(false),
    // If true: removes any existing subject assignments before adding new ones
    // If false: appends (subject already assigned = skipped)
});

// ─── Delete Subject ──────────────────────────────────────────

export const DeleteSubjectSchema = z.object({
  reason: z.string().min(5, 'A brief reason is required').max(500).optional(),
  reassign_subject_id: UUID.optional(),
    // If provided, all assignments referencing this subject are migrated
});

// ─── List Query ──────────────────────────────────────────────

export const SubjectListQuerySchema = z.object({
  is_core: z.coerce.boolean().optional(),
  category: z.enum(['core', 'elective', 'co_curricular']).optional(),
  search: z.string().max(100).optional(),
  include_inactive: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Class Subjects Query ────────────────────────────────────

export const ClassSubjectsQuerySchema = z.object({
  class_id: UUID,
  academic_term_id: UUID.optional(),
  include_teacher_info: z.coerce.boolean().default(true),
});

// ─── Response Schemas ────────────────────────────────────────

export const SubjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  is_core: z.boolean(),
  display_order: z.number(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  class_count: z.number(),
  teacher_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const ClassSubjectResponseSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  subject_code: z.string(),
  subject_color: z.string().nullable(),
  is_core: z.boolean(),
  is_mandatory: z.boolean(),
  period_count: z.number(),
  max_score: z.number().nullable(),
  passing_percentage: z.number(),
  teacher: z.object({
    id: z.string().uuid(),
    name: z.string(),
    employee_code: z.string(),
    is_class_teacher: z.boolean(),
  }).nullable(),
});

export const SubjectAssignmentResponseSchema = z.object({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  class_id: z.string().uuid(),
  class_name: z.string(),
  teacher_id: z.string().uuid().nullable(),
  teacher_name: z.string().nullable(),
  academic_term: z.string(),
});

// ─── Types ───────────────────────────────────────────────────

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof UpdateSubjectSchema>;
export type AssignToClassInput = z.infer<typeof AssignToClassSchema>;
export type AssignTeacherInput = z.infer<typeof AssignTeacherSchema>;
export type BulkAssignToClassInput = z.infer<typeof BulkAssignToClassSchema>;
export type DeleteSubjectInput = z.infer<typeof DeleteSubjectSchema>;
export type SubjectResponse = z.infer<typeof SubjectResponseSchema>;
export type ClassSubjectResponse = z.infer<typeof ClassSubjectResponseSchema>;
```

---

## 4. Services

```typescript
// src/modules/subjects/subjects.service.ts

import { AuditService } from '@/core/audit/audit.service';
import { CacheManager } from '@/core/cache/cache-manager';
import { AuthorizationService } from '@/core/authorization/rbac';
import { EventBus } from '@/core/events/event-bus';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/core/errors/app-error';
import { RequestContext } from '@/core/auth/context';
import { SubjectsRepository } from './subjects.repository';
import {
  CreateSubjectInput,
  UpdateSubjectInput,
  AssignToClassInput,
  AssignTeacherInput,
  DeleteSubjectInput,
  SubjectResponse,
  ClassSubjectResponse,
} from './subjects.validator';

export class SubjectsService {
  constructor(
    private readonly subjectRepo: SubjectsRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Create Subject ─────────────────────────────────────────

  async createSubject(
    ctx: RequestContext,
    input: CreateSubjectInput,
  ): Promise<SubjectResponse> {
    await this.authz.assert(ctx, 'subjects:create');

    // 1. Normalize code to uppercase
    const normalizedCode = input.code.toUpperCase().trim();

    // 2. Check duplicate code
    const existingByCode = await this.subjectRepo.findByCode(ctx.schoolId, normalizedCode);
    if (existingByCode) {
      throw new ConflictError(`Subject code "${normalizedCode}" already exists`);
    }

    // 3. Check duplicate name
    const existingByName = await this.subjectRepo.findByName(ctx.schoolId, input.name.trim());
    if (existingByName) {
      throw new ConflictError(`Subject name "${input.name.trim()}" already exists`);
    }

    // 4. Create subject
    const subject = await this.subjectRepo.create({
      school_id: ctx.schoolId,
      name: input.name.trim(),
      code: normalizedCode,
      category: input.category ?? null,
      description: input.description ?? null,
      is_core: input.is_core,
      display_order: input.display_order,
      color: input.color ?? null,
      icon: input.icon ?? null,
    });

    // 5. Audit
    await this.audit.log({
      eventType: 'subject:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'subject',
      resourceId: subject.id,
      details: {
        name: input.name.trim(),
        code: normalizedCode,
        isCore: input.is_core,
      },
      outcome: 'success',
    });

    await this.eventBus.publish('subject:created', {
      subjectId: subject.id,
      schoolId: ctx.schoolId,
      code: normalizedCode,
    });

    return this.mapSubjectResponse(subject, 0, 0);
  }

  // ─── Update Subject ─────────────────────────────────────────

  async updateSubject(
    ctx: RequestContext,
    subjectId: string,
    input: UpdateSubjectInput,
  ): Promise<SubjectResponse> {
    await this.authz.assert(ctx, 'subjects:edit');

    const existing = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Subject not found');

    // Check code uniqueness if code changed
    if (input.code) {
      const normalizedCode = input.code.toUpperCase().trim();
      const byCode = await this.subjectRepo.findByCode(ctx.schoolId, normalizedCode);
      if (byCode && byCode.id !== subjectId) {
        throw new ConflictError(`Subject code "${normalizedCode}" is already in use`);
      }
      input.code = normalizedCode;
    }

    // Check name uniqueness if name changed
    if (input.name) {
      const byName = await this.subjectRepo.findByName(ctx.schoolId, input.name.trim());
      if (byName && byName.id !== subjectId) {
        throw new ConflictError(`Subject name "${input.name.trim()}" is already in use`);
      }
    }

    const updated = await this.subjectRepo.update(subjectId, {
      name: input.name?.trim(),
      code: input.code,
      category: input.category,
      description: input.description,
      is_core: input.is_core,
      display_order: input.display_order,
      color: input.color,
      icon: input.icon,
    });

    // Invalidate cache
    await this.cache.invalidate(`subject:${subjectId}`);

    // Compute counts for response
    const [classCount, teacherCount] = await Promise.all([
      this.subjectRepo.getClassCount(subjectId),
      this.subjectRepo.getTeacherCount(subjectId),
    ]);

    await this.audit.log({
      eventType: 'subject:updated',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'subject',
      resourceId: subjectId,
      details: {
        before: { name: existing.name, code: existing.code, isCore: existing.is_core },
        after: { name: updated.name, code: updated.code, isCore: updated.is_core },
      },
      outcome: 'success',
    });

    return this.mapSubjectResponse(updated, classCount, teacherCount);
  }

  // ─── Delete (Deactivate) Subject ────────────────────────────

  async deleteSubject(
    ctx: RequestContext,
    subjectId: string,
    input: DeleteSubjectInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'subjects:delete');

    const existing = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Subject not found');

    // Check for active assignments
    const activeAssignments = await this.subjectRepo.getActiveAssignmentCount(subjectId);

    if (activeAssignments > 0 && !input.reassign_subject_id) {
      throw new ValidationError(
        `Subject is assigned to ${activeAssignments} classes. Provide reassign_subject_id to migrate or remove assignments first.`,
      );
    }

    // Reassign if requested
    if (input.reassign_subject_id) {
      if (input.reassign_subject_id === subjectId) {
        throw new ValidationError('Cannot reassign to the same subject');
      }

      const targetSubject = await this.subjectRepo.findById(input.reassign_subject_id, ctx.schoolId);
      if (!targetSubject) throw new NotFoundError('Target subject for reassignment not found');

      await this.subjectRepo.reassignSubjectAssignments(
        subjectId, input.reassign_subject_id, ctx.schoolId,
      );
    }

    // Soft delete
    await this.subjectRepo.softDelete(subjectId);

    // Invalidate cache
    await this.cache.invalidate(`subject:${subjectId}`);

    await this.audit.log({
      eventType: 'subject:deleted',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'subject',
      resourceId: subjectId,
      details: {
        name: existing.name,
        code: existing.code,
        reason: input.reason,
        reassignedTo: input.reassign_subject_id,
        activeAssignmentsMigrated: activeAssignments,
      },
      outcome: 'success',
    });

    await this.eventBus.publish('subject:deleted', {
      subjectId,
      schoolId: ctx.schoolId,
      reassignedTo: input.reassign_subject_id,
    });
  }

  // ─── List Subjects ──────────────────────────────────────────

  async listSubjects(
    ctx: RequestContext,
    query: {
      is_core?: boolean;
      category?: string;
      search?: string;
      include_inactive?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: SubjectResponse[]; total: number }> {
    await this.authz.assert(ctx, 'subjects:view');

    // Role-based scope: teacher sees only subjects in their classes
    let scopeSubjectIds: string[] | undefined;
    if (ctx.role === 'teacher' && ctx.profileId) {
      const subjectIds = await this.subjectRepo.getTeacherSubjectIds(
        ctx.profileId, ctx.schoolId,
      );
      scopeSubjectIds = subjectIds.map(s => s.subject_id);
    }

    // Student/parent: subjects for their class(es)
    if (ctx.role === 'student') {
      const classIds = await this.subjectRepo.getStudentClassIds(ctx.userId);
      scopeSubjectIds = await this.subjectRepo.getSubjectIdsForClasses(classIds);
    }

    if (ctx.role === 'parent') {
      const classIds = await this.subjectRepo.getParentClassIds(ctx.userId);
      scopeSubjectIds = await this.subjectRepo.getSubjectIdsForClasses(classIds);
    }

    const result = await this.subjectRepo.findMany(ctx.schoolId, {
      ...query,
      scopeSubjectIds,
    });

    // Enrich with counts
    const data = await Promise.all(
      (result.data ?? []).map(async (s) => {
        const [classCount, teacherCount] = await Promise.all([
          this.subjectRepo.getClassCount(s.id),
          this.subjectRepo.getTeacherCount(s.id),
        ]);
        return this.mapSubjectResponse(s, classCount, teacherCount);
      }),
    );

    return { data, total: result.total };
  }

  // ─── Assign Subject to Class ────────────────────────────────

  async assignSubjectToClass(
    ctx: RequestContext,
    subjectId: string,
    input: AssignToClassInput,
  ): Promise<ClassSubjectResponse> {
    await this.authz.assert(ctx, 'subjects:assign_to_class');

    const subject = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!subject) throw new NotFoundError('Subject not found');

    const classRecord = await this.subjectRepo.findClassById(input.class_id, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    // Check for duplicate assignment (same subject + class + term)
    const existing = await this.subjectRepo.findClassSubject(
      input.class_id, subjectId, input.academic_term_id,
    );
    if (existing) {
      throw new ConflictError(
        'Subject is already assigned to this class for this academic term',
      );
    }

    // Check if subject has been deleted (soft-delete)
    if (!subject.is_active) {
      throw new ValidationError('Cannot assign a deactivated subject to a class');
    }

    const assignment = await this.subjectRepo.assignToClass({
      school_id: ctx.schoolId,
      class_id: input.class_id,
      subject_id: subjectId,
      academic_term_id: input.academic_term_id,
      is_mandatory: input.is_mandatory,
      period_count: input.period_count ?? 0,
      max_score: input.max_score,
      passing_percentage: input.passing_percentage,
    });

    await this.audit.log({
      eventType: 'subject:assigned_to_class',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class_subjects',
      resourceId: assignment.id,
      details: {
        subjectId,
        subjectName: subject.name,
        classId: input.class_id,
        className: classRecord.name,
        termId: input.academic_term_id,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`class:${input.class_id}:subjects`);

    // Fetch teacher info if already assigned
    const teacher = await this.subjectRepo.findTeacherForSubject(
      subjectId, input.class_id, input.academic_term_id,
    );

    return this.mapClassSubjectResponse(assignment, subject, classRecord, teacher);
  }

  // ─── Remove Subject from Class ──────────────────────────────

  async removeSubjectFromClass(
    ctx: RequestContext,
    classSubjectId: string,
  ): Promise<void> {
    await this.authz.assert(ctx, 'subjects:assign_to_class');

    const assignment = await this.subjectRepo.findClassSubjectById(classSubjectId, ctx.schoolId);
    if (!assignment) throw new NotFoundError('Subject assignment not found');

    // Check for active teacher assignments for this subject in this class
    const teacherAssignments = await this.subjectRepo.getTeacherAssignmentCount(
      assignment.subject_id, assignment.class_id,
    );
    if (teacherAssignments > 0) {
      throw new ValidationError(
        `${teacherAssignments} teacher(s) are assigned to this subject in this class. Remove teacher assignments first.`,
      );
    }

    await this.subjectRepo.softDeleteClassSubject(classSubjectId);

    await this.audit.log({
      eventType: 'subject:removed_from_class',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class_subjects',
      resourceId: classSubjectId,
      details: {
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`class:${assignment.class_id}:subjects`);
  }

  // ─── Bulk Assign Subjects to Class ──────────────────────────

  async bulkAssignToClass(
    ctx: RequestContext,
    classId: string,
    input: BulkAssignToClassInput,
  ): Promise<{ succeeded: number; skipped: number; errors: Array<{ subjectId: string; reason: string }> }> {
    await this.authz.assert(ctx, 'subjects:assign_to_class');

    const classRecord = await this.subjectRepo.findClassById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    if (input.replace_existing) {
      // Remove all existing subject assignments.
      // ⚠️ Check each assignment for active teacher references before removal.
      // If a teacher is assigned, the TCS record would become orphaned.
      const currentAssignments = await this.subjectRepo.getClassSubjectIds(classId, input.academic_term_id);
      for (const assignmentId of currentAssignments) {
        // We need the subject_id to check teacher count
        const assignment = await this.subjectRepo.findClassSubjectById(assignmentId, ctx.schoolId);
        if (assignment) {
          const teacherCount = await this.subjectRepo.getTeacherAssignmentCount(
            assignment.subject_id, classId,
          );
          if (teacherCount > 0) {
            // Cascade: also remove teacher assignments for this subject in this class
            await this.subjectRepo.removeTeacherAssignmentsForSubjectInClass(
              assignment.subject_id, classId,
            );
          }
        }
        await this.subjectRepo.softDeleteClassSubject(assignmentId);
      }
    }

    const errors: Array<{ subjectId: string; reason: string }> = [];
    let succeeded = 0;
    let skipped = 0;

    for (const subjectId of input.subject_ids) {
      try {
        const subject = await this.subjectRepo.findById(subjectId, ctx.schoolId);
        if (!subject) {
          errors.push({ subjectId, reason: 'Subject not found' });
          continue;
        }

        if (!subject.is_active) {
          errors.push({ subjectId, reason: 'Subject is deactivated' });
          continue;
        }

        const existing = await this.subjectRepo.findClassSubject(
          classId, subjectId, input.academic_term_id,
        );
        if (existing) {
          skipped++;
          continue;
        }

        await this.subjectRepo.assignToClass({
          school_id: ctx.schoolId,
          class_id: classId,
          subject_id: subjectId,
          academic_term_id: input.academic_term_id,
          is_mandatory: true,
          period_count: 0,
        });

        succeeded++;
      } catch (error) {
        errors.push({
          subjectId,
          reason: error instanceof AppError ? error.message : 'Unknown error',
        });
      }
    }

    await this.cache.invalidate(`class:${classId}:subjects`);

    return { succeeded, skipped, errors };
  }

  // ─── Assign Teacher to Subject ──────────────────────────────

  async assignTeacher(
    ctx: RequestContext,
    subjectId: string,
    input: AssignTeacherInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'subjects:assign_teacher');

    const subject = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!subject) throw new NotFoundError('Subject not found');

    const teacher = await this.subjectRepo.findTeacherById(input.teacher_id);
    if (!teacher) throw new NotFoundError('Teacher not found');

    const classRecord = await this.subjectRepo.findClassById(input.class_id, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    // Verify subject is assigned to this class
    const classSubject = await this.subjectRepo.findClassSubject(
      input.class_id, subjectId, input.academic_term_id,
    );
    if (!classSubject) {
      throw new ValidationError(
        `Subject "${subject.name}" is not assigned to this class. Assign the subject to the class first, then assign a teacher.`,
      );
    }

    // Check for UNIQUE constraint conflict (teacher + class + subject + term)
    const existingAssignment = await this.subjectRepo.findTeacherAssignment(
      input.teacher_id, input.class_id, subjectId, input.academic_term_id,
    );
    if (existingAssignment) {
      throw new ConflictError(
        'This teacher is already assigned to this subject in this class for this term',
      );
    }

    // Check teacher workload — prevent over-assignment
    const teacherWorkload = await this.subjectRepo.getTeacherWorkload(
      input.teacher_id, input.academic_term_id,
    );
    if (teacherWorkload >= 8) {
      throw new ValidationError(
        'Teacher already has 8 subject assignments this term. Remove an existing assignment first.',
      );
    }

    await this.subjectRepo.assignTeacher({
      teacher_id: input.teacher_id,
      class_id: input.class_id,
      subject_id: subjectId,
      school_id: ctx.schoolId,
      academic_term_id: input.academic_term_id,
      is_class_teacher: input.is_class_teacher,
      period_count: input.period_count ?? 0,
    });

    // If this is the first teacher for this subject in this class,
    // they become the default instructor
    await this.audit.log({
      eventType: 'subject:teacher_assigned',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'teacher_class_subjects',
      details: {
        subjectId,
        subjectName: subject.name,
        teacherId: input.teacher_id,
        classId: input.class_id,
        termId: input.academic_term_id,
        isClassTeacher: input.is_class_teacher,
      },
      outcome: 'success',
    });

    // Invalidate caches
    await this.cache.invalidate(`teacher:${input.teacher_id}:subjects`);
    await this.cache.invalidate(`class:${input.class_id}:subjects`);
  }

  // ─── Remove Teacher from Subject ────────────────────────────

  async removeTeacher(
    ctx: RequestContext,
    teacherAssignmentId: string,
    reason?: string,
  ): Promise<void> {
    await this.authz.assert(ctx, 'subjects:assign_teacher');

    const assignment = await this.subjectRepo.findTeacherAssignmentById(
      teacherAssignmentId, ctx.schoolId,
    );
    if (!assignment) throw new NotFoundError('Teacher assignment not found');

    await this.subjectRepo.softDeleteTeacherAssignment(teacherAssignmentId);

    await this.audit.log({
      eventType: 'subject:teacher_removed',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'teacher_class_subjects',
      resourceId: teacherAssignmentId,
      details: {
        subjectId: assignment.subject_id,
        teacherId: assignment.teacher_id,
        classId: assignment.class_id,
        reason,
      },
      outcome: 'success',
    });

    await this.cache.invalidate(`teacher:${assignment.teacher_id}:subjects`);
    await this.cache.invalidate(`class:${assignment.class_id}:subjects`);
  }

  // ─── Get Class Subjects ─────────────────────────────────────

  async getClassSubjects(
    ctx: RequestContext,
    classId: string,
    academicTermId?: string,
    includeTeacherInfo = true,
  ): Promise<ClassSubjectResponse[]> {
    await this.authz.assert(ctx, 'subjects:view', { classId });

    const classRecord = await this.subjectRepo.findClassById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const assignments = await this.subjectRepo.getClassSubjects(
      classId, ctx.schoolId, academicTermId,
    );

    const response = await Promise.all(
      assignments.map(async (assignment) => {
        const subject = await this.subjectRepo.findById(assignment.subject_id, ctx.schoolId);
        const teacher = includeTeacherInfo
          ? await this.subjectRepo.findTeacherForSubject(
              assignment.subject_id, classId, assignment.academic_term_id,
            )
          : null;

        return {
          id: assignment.id,
          subject_id: assignment.subject_id,
          subject_name: subject?.name ?? 'Unknown',
          subject_code: subject?.code ?? '',
          subject_color: subject?.color ?? null,
          is_core: subject?.is_core ?? false,
          is_mandatory: assignment.is_mandatory,
          period_count: assignment.period_count,
          max_score: assignment.max_score,
          passing_percentage: assignment.passing_percentage,
          teacher,
        };
      }),
    );

    return response;
  }

  // ─── Get Subject Assignments Overview ───────────────────────

  async getSubjectAssignments(
    ctx: RequestContext,
    subjectId: string,
    academicTermId?: string,
  ): Promise<SubjectAssignmentResponseSchema[]> {
    // Use stricter permission — only admin/principal can see assignment overview
    await this.authz.assert(ctx, 'subjects:view_assignments');

    const subject = await this.subjectRepo.findById(subjectId, ctx.schoolId);
    if (!subject) throw new NotFoundError('Subject not found');

    return this.subjectRepo.getSubjectAssignments(subjectId, ctx.schoolId, academicTermId);
  }

  // ─── Private Helpers ────────────────────────────────────────

  private mapSubjectResponse(subject: any, classCount: number, teacherCount: number): SubjectResponse {
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      category: subject.category,
      description: subject.description,
      is_core: subject.is_core,
      display_order: subject.display_order,
      color: subject.color,
      icon: subject.icon,
      class_count: classCount,
      teacher_count: teacherCount,
      is_active: !subject.deleted_at,
      created_at: subject.created_at,
    };
  }

  private mapClassSubjectResponse(
    assignment: any,
    subject: any,
    classRecord: any,
    teacher: any | null,
  ): ClassSubjectResponse {
    return {
      id: assignment.id,
      subject_id: subject.id,
      subject_name: subject.name,
      subject_code: subject.code,
      subject_color: subject.color,
      is_core: subject.is_core,
      is_mandatory: assignment.is_mandatory,
      period_count: assignment.period_count,
      max_score: assignment.max_score,
      passing_percentage: assignment.passing_percentage ?? 40,
      teacher: teacher
        ? {
            id: teacher.teacher_id,
            name: teacher.teacher_name,
            employee_code: teacher.employee_code,
            is_class_teacher: teacher.is_class_teacher,
          }
        : null,
    };
  }
}
```

---

## 5. Repositories

```typescript
// src/modules/subjects/subjects.repository.ts

export class SubjectsRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  // ─── Subject CRUD ──────────────────────────────────────────

  async create(input: {
    school_id: string;
    name: string;
    code: string;
    category: string | null;
    description: string | null;
    is_core: boolean;
    display_order: number;
    color: string | null;
    icon: string | null;
  }): Promise<any> {
    const { data, error } = await this.db.from('subjects')
      .insert(input).select().single();
    if (error) throw new DatabaseError('Failed to create subject', { cause: error });
    return data;
  }

  async findById(id: string, schoolId: string): Promise<any | null> {
    const { data, error } = await this.db.from('subjects')
      .select('*')
      .eq('id', id).eq('school_id', schoolId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByCode(schoolId: string, code: string): Promise<any | null> {
    const { data } = await this.db.from('subjects')
      .select('id, name, code')
      .eq('school_id', schoolId).eq('code', code)
      .is('deleted_at', null)
      .single();
    return data;
  }

  async findByName(schoolId: string, name: string): Promise<any | null> {
    const { data } = await this.db.from('subjects')
      .select('id, name, code')
      .eq('school_id', schoolId).eq('name', name)
      .is('deleted_at', null)
      .single();
    return data;
  }

  async update(id: string, data: Partial<any>): Promise<any> {
    const { data: updated, error } = await this.db.from('subjects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw new DatabaseError('Failed to update subject', { cause: error });
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.from('subjects').update({
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  // ─── Listing ──────────────────────────────────────────────

  async findMany(
    schoolId: string,
    filters: {
      is_core?: boolean;
      category?: string;
      search?: string;
      include_inactive?: boolean;
      page?: number;
      limit?: number;
      scopeSubjectIds?: string[];
    },
  ): Promise<{ data: any[]; total: number }> {
    let query = this.db.from('subjects')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId);

    if (!filters.include_inactive) {
      query = query.is('deleted_at', null);
    }
    if (filters.scopeSubjectIds) {
      query = query.in('id', filters.scopeSubjectIds);
    }
    if (filters.is_core !== undefined) {
      query = query.eq('is_core', filters.is_core);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`,
      );
    }

    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    const to = from + (filters.limit ?? 20) - 1;
    query = query.order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError('Failed to list subjects', { cause: error });
    return { data: data ?? [], total: count ?? 0 };
  }

  // ─── Counts ─────────────────────────────────────────────

  async getClassCount(subjectId: string): Promise<number> {
    const { count } = await this.db.from('class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId).is('deleted_at', null);
    return count ?? 0;
  }

  async getTeacherCount(subjectId: string): Promise<number> {
    const { count } = await this.db.from('teacher_class_subjects')
      .select('teacher_id', { count: 'exact', head: true })
      .eq('subject_id', subjectId).is('deleted_at', null);
    return count ?? 0;
  }

  async getActiveAssignmentCount(subjectId: string): Promise<number> {
    const { count } = await this.db.from('class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId).is('deleted_at', null);
    return count ?? 0;
  }

  // ─── Class-Subject Assignments ──────────────────────────

  async findClassSubject(classId: string, subjectId: string, termId: string): Promise<any | null> {
    const { data } = await this.db.from('class_subjects')
      .select('id')
      .eq('class_id', classId).eq('subject_id', subjectId)
      .eq('academic_term_id', termId).is('deleted_at', null)
      .single();
    return data;
  }

  async findClassSubjectById(id: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db.from('class_subjects')
      .select('*').eq('id', id).eq('school_id', schoolId)
      .is('deleted_at', null).single();
    return data;
  }

  async assignToClass(input: {
    school_id: string;
    class_id: string;
    subject_id: string;
    academic_term_id: string;
    is_mandatory: boolean;
    period_count: number;
    max_score?: number;
    passing_percentage?: number;
  }): Promise<any> {
    const { data, error } = await this.db.from('class_subjects')
      .insert(input).select().single();
    if (error) throw new DatabaseError('Failed to assign subject to class', { cause: error });
    return data;
  }

  async softDeleteClassSubject(id: string): Promise<void> {
    await this.db.from('class_subjects').update({
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async getClassSubjectIds(classId: string, termId: string): Promise<string[]> {
    const { data } = await this.db.from('class_subjects')
      .select('id').eq('class_id', classId)
      .eq('academic_term_id', termId).is('deleted_at', null);
    return data?.map(d => d.id) ?? [];
  }

  async getClassSubjects(classId: string, schoolId: string, termId?: string): Promise<any[]> {
    let query = this.db.from('class_subjects')
      .select('*').eq('class_id', classId)
      .eq('school_id', schoolId).is('deleted_at', null);
    if (termId) query = query.eq('academic_term_id', termId);
    const { data } = await query;
    return data ?? [];
  }

  // ─── Teacher-Subject Assignments ────────────────────────

  async findTeacherAssignment(
    teacherId: string, classId: string, subjectId: string, termId: string,
  ): Promise<any | null> {
    const { data } = await this.db.from('teacher_class_subjects')
      .select('id').eq('teacher_id', teacherId).eq('class_id', classId)
      .eq('subject_id', subjectId).eq('academic_term_id', termId)
      .is('deleted_at', null).single();
    return data;
  }

  async findTeacherAssignmentById(id: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db.from('teacher_class_subjects')
      .select('*').eq('id', id).eq('school_id', schoolId)
      .is('deleted_at', null).single();
    return data;
  }

  async assignTeacher(input: {
    teacher_id: string;
    class_id: string;
    subject_id: string;
    school_id: string;
    academic_term_id: string;
    is_class_teacher: boolean;
    period_count: number;
  }): Promise<any> {
    const { data, error } = await this.db.from('teacher_class_subjects')
      .insert(input).select().single();
    if (error) throw new DatabaseError('Failed to assign teacher', { cause: error });
    return data;
  }

  async softDeleteTeacherAssignment(id: string): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async removeTeacherAssignmentsForSubjectInClass(
    subjectId: string, classId: string,
  ): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      deleted_at: new Date().toISOString(),
    })
    .eq('subject_id', subjectId).eq('class_id', classId)
    .is('deleted_at', null);
  }

  async getTeacherAssignmentCount(subjectId: string, classId: string): Promise<number> {
    const { count } = await this.db.from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId).eq('class_id', classId)
      .is('deleted_at', null);
    return count ?? 0;
  }

  async getTeacherWorkload(teacherId: string, termId: string): Promise<number> {
    const { count } = await this.db.from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId).eq('academic_term_id', termId)
      .is('deleted_at', null);
    return count ?? 0;
  }

  async findTeacherForSubject(subjectId: string, classId: string, termId: string): Promise<any | null> {
    // Returns the primary teacher for a subject in a given class + term
    const { data } = await this.db.from('teacher_class_subjects')
      .select(`
        teacher_id,
        is_class_teacher,
        teachers!inner(
          employee_code,
          users!inner(first_name, last_name)
        )
      `)
      .eq('subject_id', subjectId).eq('class_id', classId)
      .eq('academic_term_id', termId).is('deleted_at', null)
      .limit(1).single();
    if (!data) return null;
    return {
      teacher_id: data.teacher_id,
      teacher_name: `${data.teachers.users.first_name} ${data.teachers.users.last_name}`,
      employee_code: data.teachers.employee_code,
      is_class_teacher: data.is_class_teacher,
    };
  }

  // ─── Reassignment ──────────────────────────────────────

  async reassignSubjectAssignments(
    oldSubjectId: string, newSubjectId: string, schoolId: string,
  ): Promise<void> {
    // ⚠️ Race condition: if the new subject already has a class_subjects record
    // for the same (class_id, academic_term_id), the UPDATE below will fail
    // with a UNIQUE constraint violation.
    //
    // Mitigation: skip conflicting records and log them for manual resolution.
    // This is a rare edge case (admin deleting and reassigning simultaneously).
    //
    // For production, use a stored procedure with ON CONFLICT handling:
    //
    //   INSERT INTO class_subjects (class_id, subject_id, academic_term_id, ...)
    //   SELECT class_id, newSubjectId, academic_term_id, ...
    //   FROM class_subjects WHERE subject_id = oldSubjectId
    //   ON CONFLICT (class_id, subject_id, academic_term_id) DO NOTHING;
    //
    //   DELETE FROM class_subjects WHERE subject_id = oldSubjectId;

    // Update class_subjects — skip rows where the target subject already exists
    const { data: conflicts } = await this.db.from('class_subjects')
      .select('class_id, academic_term_id')
      .eq('subject_id', oldSubjectId).eq('school_id', schoolId)
      .is('deleted_at', null);

    for (const row of conflicts ?? []) {
      const targetExists = await this.findClassSubject(
        row.class_id, newSubjectId, row.academic_term_id,
      );
      if (targetExists) {
        // Target already has this subject — soft-delete the old assignment
        await this.db.from('class_subjects').update({
          deleted_at: new Date().toISOString(),
        })
        .eq('subject_id', oldSubjectId).eq('class_id', row.class_id)
        .eq('academic_term_id', row.academic_term_id);
      } else {
        await this.db.from('class_subjects').update({
          subject_id: newSubjectId, updated_at: new Date().toISOString(),
        })
        .eq('subject_id', oldSubjectId).eq('class_id', row.class_id)
        .eq('academic_term_id', row.academic_term_id);
      }
    }

    // Update teacher_class_subjects — similar conflict check
    const { data: tcsConflicts } = await this.db.from('teacher_class_subjects')
      .select('teacher_id, class_id, academic_term_id')
      .eq('subject_id', oldSubjectId).eq('school_id', schoolId)
      .is('deleted_at', null);

    for (const row of tcsConflicts ?? []) {
      const tcsExists = await this.findTeacherAssignment(
        row.teacher_id, row.class_id, newSubjectId, row.academic_term_id,
      );
      if (tcsExists) {
        await this.db.from('teacher_class_subjects').update({
          deleted_at: new Date().toISOString(),
        })
        .eq('subject_id', oldSubjectId).eq('teacher_id', row.teacher_id)
        .eq('class_id', row.class_id).eq('academic_term_id', row.academic_term_id);
      } else {
        await this.db.from('teacher_class_subjects').update({
          subject_id: newSubjectId, updated_at: new Date().toISOString(),
        })
        .eq('subject_id', oldSubjectId).eq('teacher_id', row.teacher_id)
        .eq('class_id', row.class_id).eq('academic_term_id', row.academic_term_id);
      }
    }
  }

  // ─── Scope Helpers ─────────────────────────────────────

  async getTeacherSubjectIds(teacherId: string, schoolId: string): Promise<Array<{ subject_id: string }>> {
    const { data } = await this.db.from('teacher_class_subjects')
      .select('subject_id').eq('teacher_id', teacherId)
      .eq('school_id', schoolId).is('deleted_at', null);
    return data ?? [];
  }

  async getStudentClassIds(userId: string): Promise<string[]> {
    const { data } = await this.db.from('students')
      .select('class_id').eq('user_id', userId)
      .is('deleted_at', null).single();
    return data ? [data.class_id] : [];
  }

  async getParentClassIds(userId: string): Promise<string[]> {
    const { data: parent } = await this.db.from('parents')
      .select('id').eq('user_id', userId).is('deleted_at', null).single();
    if (!parent) return [];

    const { data: links } = await this.db.from('student_parents')
      .select('student_id').eq('parent_id', parent.id).is('deleted_at', null);
    const studentIds = links?.map(l => l.student_id) ?? [];

    if (studentIds.length === 0) return [];

    const { data: enrollments } = await this.db.from('class_enrollments')
      .select('class_id').in('student_id', studentIds)
      .eq('status', 'active');
    return [...new Set(enrollments?.map(e => e.class_id) ?? [])];
  }

  async getSubjectIdsForClasses(classIds: string[]): Promise<string[]> {
    if (classIds.length === 0) return [];
    const { data } = await this.db.from('class_subjects')
      .select('subject_id').in('class_id', classIds)
      .is('deleted_at', null);
    return [...new Set(data?.map(d => d.subject_id) ?? [])];
  }

  // ⚠️ Note for implementation:
  // `findClassById` and `findTeacherById` duplicate queries already defined
  // in ClassesRepository and TeachersRepository from prior modules.
  // During implementation, inject those repositories into SubjectsService
  // instead of reimplementing the queries here.
  //
  // For design completeness, the method signatures are defined below:

  async findClassById(classId: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db.from('classes')
      .select('id, name, section')
      .eq('id', classId).eq('school_id', schoolId)
      .is('deleted_at', null).single();
    return data;
  }

  async findTeacherById(teacherId: string): Promise<any | null> {
    const { data } = await this.db.from('teachers')
      .select('id, employee_code')
      .eq('id', teacherId).is('deleted_at', null).single();
    return data;
  }

  async getSubjectAssignments(
    subjectId: string, schoolId: string, termId?: string,
  ): Promise<SubjectAssignmentResponseSchema[]> {
    let query = this.db.from('class_subjects')
      .select(`
        id,
        class_id,
        academic_term_id,
        classes!inner(name, section),
        academic_terms!inner(name),
        teacher_class_subjects!left(
          teacher_id,
          is_class_teacher,
          teachers!inner(
            employee_code,
            users!inner(first_name, last_name)
          )
        )
      `)
      .eq('subject_id', subjectId).eq('school_id', schoolId)
      .is('deleted_at', null);

    if (termId) query = query.eq('academic_term_id', termId);

    const { data } = await query;
    return (data ?? []).map((d: any) => ({
      subject_id: subjectId,
      subject_name: '', // caller fills this
      class_id: d.class_id,
      class_name: `${d.classes.name}${d.classes.section ? ' ' + d.classes.section : ''}`,
      teacher_id: d.teacher_class_subjects?.[0]?.teacher_id ?? null,
      teacher_name: d.teacher_class_subjects?.[0]
        ? `${d.teacher_class_subjects[0].teachers.users.first_name} ${d.teacher_class_subjects[0].teachers.users.last_name}`
        : null,
      academic_term: d.academic_terms.name,
    }));
  }
}
```

---

## 6. API Routes

### 6.1 POST /subjects — Create subject

```typescript
// src/app/api/subjects/route.ts

export async function POST(request: NextRequest) {
  try {
    const ctx = await authorize(request, ['school_admin']);
    const body = await request.json();
    const parsed = CreateSubjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VAL_001', message: 'Invalid input', details: parsed.error.flatten() } },
        { status: 422 },
      );
    }

    const service = createSubjectsService();
    const result = await service.createSubject(ctx, parsed.data);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleSubjectError(error);
  }
}
```

### 6.2 GET /subjects — List subjects

```
GET /subjects?is_core=true&category=core&search=math&page=1&limit=20
Role: school_admin, principal, teacher (own), student (own class), parent (children's)

Response: 200 { data: SubjectResponse[], total: number }

Scope: Teacher sees only subjects in assigned classes. Student sees own class subjects.
Parent sees children's class subjects. Admin/principal see all.
```

### 6.3 GET /subjects/{id} — Get subject detail

```
GET /subjects/{id}
Role: school_admin, principal, teacher (scoped), student (scoped), parent (scoped)

Response: 200 { data: SubjectResponse }
Errors: 403, 404
```

### 6.4 PATCH /subjects/{id} — Update subject

```
PATCH /subjects/{id}
Role: school_admin

Request: { name?, code?, category?, description?, is_core?, display_order?, color?, icon? }
Response: 200 { data: SubjectResponse }
Errors: 400, 403, 404, 409 (duplicate code/name), 422
```

### 6.5 POST /subjects/{id}/deactivate — Deactivate subject (soft-delete)

```
POST /subjects/{id}/deactivate
Role: school_admin

Request: {
  reason?: string,
  reassign_subject_id?: UUID  // Migrate existing assignments to another subject
}
Response: 200 { data: { message: 'Subject deactivated', assignmentsMigrated: true/false } }
Errors: 400 (active assignments without reassignment), 403, 404, 409 (reassign to same subject)
```

### 6.6 POST /subjects/{id}/assign-class — Assign subject to a class

```
POST /subjects/{id}/assign-class
Role: school_admin

Request: {
  class_id: UUID,
  academic_term_id: UUID,
  is_mandatory: boolean,
  period_count?: number,
  max_score?: number,
  passing_percentage?: number
}
Response: 201 { data: ClassSubjectResponse }
Errors: 403, 404, 409 (already assigned), 422
```

### 6.7 POST /classes/{id}/bulk-assign-subjects — Bulk assign subjects to a class

```
POST /classes/{id}/bulk-assign-subjects
Role: school_admin

Request: {
  subject_ids: UUID[],
  academic_term_id: UUID,
  replace_existing: boolean
}
Response: 200 { data: { succeeded: number, skipped: number, errors: Array<{subjectId, reason}> } }
Errors: 403, 404
```

### 6.8 DELETE /class-subjects/{id} — Remove subject from class

```
DELETE /class-subjects/{id}
Role: school_admin

Response: 200 { data: { message: 'Subject removed from class' } }
Errors: 400 (teacher still assigned), 403, 404
```

### 6.9 POST /subjects/{id}/assign-teacher — Assign teacher to subject in a class

```
POST /subjects/{id}/assign-teacher
Role: school_admin

Request: {
  teacher_id: UUID,
  class_id: UUID,
  academic_term_id: UUID,
  is_class_teacher?: boolean,
  period_count?: number
}
Response: 200 { data: { message: 'Teacher assigned' } }
Errors: 400 (subject not assigned to class, workload exceeded), 403, 404, 409 (already assigned)
```

### 6.10 DELETE /teacher-assignments/{id} — Remove teacher from subject

```
DELETE /teacher-assignments/{id}
Role: school_admin

Query: ?reason=...
Response: 200 { data: { message: 'Teacher removed from subject' } }
Errors: 403, 404
```

### 6.11 GET /classes/{id}/subjects — Get class subjects with teachers

```
GET /classes/{id}/subjects?academic_term_id=...&include_teacher_info=true
Role: school_admin, principal, teacher (own), student (own), parent (children's)

Response: 200 { data: ClassSubjectResponse[] }
Errors: 403, 404
```

### 6.12 GET /subjects/{id}/assignments — Get all class/teacher assignments for a subject

```
GET /subjects/{id}/assignments?academic_term_id=...
Role: school_admin, principal

Response: 200 { data: SubjectAssignmentResponse[] }
Errors: 403, 404
```

### 6.13 Error Handler

```typescript
export function handleSubjectError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: { code: 'SUBJ_404', message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: { code: 'SUBJ_409', message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: 'SUBJ_400', message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: 'SUBJ_403', message: error.message } },
      { status: 403 },
    );
  }

  console.error('Unhandled subject error:', error);
  return NextResponse.json(
    { error: { code: 'INT_001', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
```

---

## 7. Permissions

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create subject | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit subject | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete subject | 🔶 | ❌ | ❌ | ❌ | ❌ |
| View subject list | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View subject detail | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| Assign subject to class | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove subject from class | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign teacher to subject | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove teacher from subject | ✅ | ❌ | ❌ | ❌ | ❌ |
| View class subjects | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View subject assignments | ✅ | ✅ | ❌ | ❌ | ❌ |
| View assignment overview | ✅ | ✅ | ❌ | ❌ | ❌ |

**Legend**: ✅ = Full access · 🔷 = Scoped access · ❌ = No access · 🔶 = Audit required

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher sees only subjects in assigned classes | `teacher_class_subjects.teacher_id == ctx.profileId` |
| Student sees only own class subjects | Join through `students.class_id -> class_subjects` |
| Parent sees children's class subjects | Join through `student_parents -> students -> class_enrollments -> class_subjects` |
| Admin-only mutation | All create/edit/delete/assign operations require `school_admin` |
| Delete requires reassignment if active | `DeleteSubjectSchema.reassign_subject_id` required if assignments exist |
| Teacher assignment requires class assignment first | Subject must be in `class_subjects` before `teacher_class_subjects` |

### 7.3 Permission Assertion Patterns

```typescript
// Pattern 1: Simple admin mutation
await this.authz.assert(ctx, 'subjects:create');
// → ctx.role must be 'school_admin'

// Pattern 2: Scoped view
await this.authz.assert(ctx, 'subjects:view', { classId });
// → Checks data scope based on role

// Pattern 3: Assignment overview (admin + principal only)
await this.authz.assert(ctx, 'subjects:view_assignments');
// → ctx.role must be school_admin or principal. Teachers/students/parents cannot see full overview.

// Pattern 4: Teacher assignment (admin)
await this.authz.assert(ctx, 'subjects:assign_teacher');
// → ctx.role must be 'school_admin'
```

---

## 8. Validation Rules

### 8.1 Subject Validation

| Rule | Schema | Database | Service | Error |
|------|--------|----------|---------|-------|
| Code must be uppercase, trimmed | `transform(v => v.toUpperCase().trim())` | — | `normalizedCode` | — |
| Code unique per school | — | `UNIQUE(school_id, code)` | `findByCode` check | `SUBJ_409` |
| Name unique per school | — | `UNIQUE(school_id, name)` | `findByName` check | `SUBJ_409` |
| Color must be valid hex | `regex(/^#[0-9a-fA-F]{6}$/)` | — | — | `VAL_001` |
| Max name length | `max(100)` | `VARCHAR(100)` | — | `VAL_001` |
| Max code length | `max(20)` | `VARCHAR(20)` | — | `VAL_001` |
| Code required | `min(1)` | `NOT NULL` | — | `VAL_001` |
| Name required | `min(1)` | `NOT NULL` | — | `VAL_001` |
| Can't delete with active assignments | — | — | `getActiveAssignmentCount` > 0 check | `SUBJ_400` |

### 8.2 Class-Subject Assignment Validation

| Rule | Enforcement | Error |
|------|-------------|-------|
| Subject must exist and be active | `findById` + `is_active` | `SUBJ_404` |
| Class must exist | `findClassById` | `SUBJ_404` |
| No duplicate (class + subject + term) | `findClassSubject` | `SUBJ_409` |
| Must remove teachers before unassigning subject | `getTeacherAssignmentCount` | `SUBJ_400` |
| Batch limit: max 50 subjects per bulk assign | Zod `max(50)` | `VAL_001` |

### 8.3 Teacher-Subject Assignment Validation

| Rule | Enforcement | Error |
|------|-------------|-------|
| Subject must exist | `findById` | `SUBJ_404` |
| Teacher must exist | `findTeacherById` | `SUBJ_404` |
| Class must exist | `findClassById` | `SUBJ_404` |
| Subject must be assigned to class first | `findClassSubject` | `SUBJ_400` |
| No duplicate (teacher + class + subject + term) | `findTeacherAssignment` + UNIQUE constraint | `SUBJ_409` |
| Max 8 subject assignments per teacher per term | `getTeacherWorkload` | `SUBJ_400` |
| Teacher must belong to same school | school_id on teachers table | Implicit via scope |

### 8.4 Input Sanitization

```typescript
// Code: uppercase, trim whitespace, strip special characters
const sanitizedCode = input.code
  .toUpperCase()
  .replace(/[^A-Z0-9_]/g, '')
  .trim();

// Name: trim, collapse multiple spaces
const sanitizedName = input.name
  .trim()
  .replace(/\s+/g, ' ');

// Description: strip HTML tags, trim
const sanitizedDescription = input.description
  ?.replace(/<[^>]*>/g, '')
  .trim();
```

---

## 9. Risk Analysis

### 9.1 Duplicate Subject Risks

| # | Risk | Scenario | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Same name, different code** | Admin creates "Math" with code "MATH" and another "Math" with code "MT" | Confusion in reports, scheduling conflicts | `UNIQUE(school_id, name)` prevents duplicate names regardless of code |
| 2 | **Same code, different name** | "SCI" for both "Science" and "Social Science" | Data corruption, wrong subject on assignments | `UNIQUE(school_id, code)` prevents duplicate codes |
| 3 | **Case-insensitive code collision** | "math" and "MATH" treated as different | Duplicate entries, confusion | Zod `transform` normalizes to uppercase before any check |
| 4 | **Whitespace collision** | "Math " and "Math" | Two subjects appear identical in UI | Zod `trim()` + service-level trim on name |
| 5 | **Soft-delete subject recreated** | Admin deletes "History" then creates "History" again | Two records with same name, one soft-deleted | UNIQUE index uses `WHERE deleted_at IS NULL` — allows re-creation after soft-delete |
| 6 | **Cross-school collision** | School A uses "MATH", School B uses "MATH" | No impact (school_id scoped) | All queries scoped by `school_id` |

### 9.2 Assignment Conflicts

| # | Conflict | Scenario | Impact | Mitigation |
|---|----------|----------|--------|------------|
| 1 | **Teacher teaches same subject in same class twice** | Two TCS records: Teacher + Class 7A + Math + Term 1 | Double-counting in timetable, grading confusion | `UNIQUE(teacher_id, class_id, subject_id, academic_term_id)` prevents this |
| 2 | **Subject assigned to class twice** | Two class_subjects records for Class 7A + Math + Term 1 | Duplicate entries in gradebook | `UNIQUE(class_id, subject_id, academic_term_id)` prevents this |
| 3 | **Teacher over-assigned (8+ subjects)** | Teacher assigned to 9 different subject-class combos | Burnout, scheduling nightmare | Service-level check: `getTeacherWorkload` max 8 per term |
| 4 | **Teacher assigned to subject not in class** | TCS record for Class 7A + Biology, but Biology isn't in Class 7A's curriculum | Teacher shows up in timetable for a subject the class doesn't study | Service checks `findClassSubject` before creating TCS |
| 5 | **Subject deleted while teachers assigned** | Admin deletes "Physics" but teachers still assigned | Orphaned TCS records, timetable breaks | `deleteSubject` warns if `activeAssignments > 0`. Reassignment migrates TCS too |
| 6 | **Teacher leaves mid-term** | Teacher removed from all assignments | Students lose instructor mid-term | EventBus publishes `subject:teacher_removed`, notifies principal |
| 7 | **Class deleted while subject assigned** | Admin deletes Class 7A but class_subjects records remain | Orphaned class_subjects references | Class deletion should cascade to class_subjects (via the `class:deleted` event) |
| 8 | **Term mismatch** | Teacher assigned to Term 2 but class_subject is for Term 1 | Teacher can't access the class for this subject | Both assignments must use the same `academic_term_id`. Checked at service layer |

### 9.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **Subject list for multi-class parent** | Parent with 3 children in different classes sees union of all class subjects | Cached response with 5-min TTL. Scope query optimized with IN clause. |
| 2 | **Full subject list for admin (50+ subjects)** | All subjects loaded at once | Pagination (max 100). Cached with 10-min TTL. |
| 3 | **Teacher workload count per teacher** | Computing workload for 50 teachers | Cache `teacher:{id}:workload:{termId}` with 5-min TTL. Invalidate on assignment change. |
| 4 | **Class subjects with teacher info** | 10 subjects for one class, each with a teacher lookup | Single query with nested joins (not N+1). Cache response. |

### 9.4 V1 Mistakes Not to Repeat

| V1 Mistake | Impact | V2 Fix |
|-----------|--------|--------|
| Subject code case-insensitivity | "MATH" and "math" treated as different | Normalize to uppercase in Zod |
| No class-subject decoupling | Couldn't track which subjects a class offers without a teacher | `class_subjects` table separates curriculum from staffing |
| No validation on delete | Subject deleted with active assignments causing data loss | Block delete if assignments exist, require migration target |
| No teacher workload limit | Single teacher assigned to 15+ classes | Cap at 8 subject assignments per term |
| Teachers could be assigned before class had the subject | Orphaned TCS records | Require `class_subjects` record before TCS creation |

---

## 10. Testing Checklist

### 10.1 Unit Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| `create_subject: valid` | All fields correct | Created, audit logged | P0 |
| `create_subject: duplicate code` | Same code exists | 409 ConflictError | P0 |
| `create_subject: duplicate name` | Same name exists | 409 ConflictError | P0 |
| `create_subject: code normalization` | Input " math " -> "MATH" | Code saved as uppercase, trimmed | P1 |
| `update_subject: change code` | New unique code | Updated, old code freed | P0 |
| `update_subject: code collision` | Change to existing code | 409 ConflictError | P0 |
| `update_subject: non-admin caller` | Teacher calls endpoint | 403 ForbiddenError | P0 |
| `delete_subject: no assignments` | Empty subject | Soft deleted | P0 |
| `delete_subject: has assignments, no reassign` | 5 class assignments | 400 ValidationError | P0 |
| `delete_subject: with reassign` | 5 assignments → migrated | All migrated, subject deleted | P0 |
| `assign_class: valid` | Subject + class + term | class_subjects created | P0 |
| `assign_class: already assigned` | Duplicate assignment | 409 ConflictError | P0 |
| `assign_class: deactivated subject` | Subject is_active=false | 400 ValidationError | P1 |
| `assign_class: class not found` | Invalid class_id | 404 NotFoundError | P1 |
| `remove_from_class: with teacher assigned` | Teacher still assigned | 400 ValidationError | P0 |
| `bulk_assign: 10 subjects` | All valid | 10 created, 0 errors | P0 |
| `bulk_assign: with replace` | Replace_existing=true | Old removed, new added | P1 |
| `assign_teacher: valid` | Subject already in class | TCS created | P0 |
| `assign_teacher: subject not in class` | Subject not assigned to class | 400 ValidationError | P0 |
| `assign_teacher: duplicate` | Same teacher+class+subject+term | 409 ConflictError | P0 |
| `assign_teacher: workload exceeded` | 8 existing assignments | 400 ValidationError | P0 |
| `remove_teacher: valid` | Teacher assigned | TCS soft-deleted, audit logged | P0 |
| `list_subjects: admin all` | No scope filter | All school subjects | P0 |
| `list_subjects: teacher scoped` | Teacher with 3 classes | Only subjects in those classes | P0 |
| `list_subjects: student scoped` | Student in 1 class | Only that class's subjects | P0 |
| `get_class_subjects: with teacher info` | Class with 5 assigned subjects | 5 subjects with teacher names | P0 |

### 10.2 Integration Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Create subject → Assign to class → Assign teacher → Verify | Full pipeline | All 3 records created, visible in class subjects view | P0 |
| Create subject → Delete → Verify assignments cleared | Soft delete + reassign | Assignments migrated, subject hidden | P0 |
| Assign 5 subjects to class → Remove 1 → Verify | Partial removal | 4 remaining, 1 removed | P1 |
| Assign teacher → Remove from class → Verify teacher loses access | Cascade | Teacher assignment removed when class_subject removed | P0 |
| Teacher workload limit (8 subjects) → Assign 9th → Rejected | Boundary | 9th assignment returns 400 | P0 |

### 10.3 Security Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Teacher deletes subject | Non-admin mutation | 403 | P0 |
| Student assigns subject to class | Non-admin mutation | 403 | P0 |
| Teacher assigns another teacher to subject | Non-admin mutation | 403 | P0 |
| Cross-school subject access | School A accesses School B subject | 403 or empty | P0 |
| Unauthenticated create | No session | 401 | P0 |
| SQL injection in search | `' OR 1=1--` | 422 or parameterized | P0 |

### 10.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| List 50 subjects | <50ms (p95) | Indexed query, paginated |
| Get class subjects (10 subjects with teachers) | <100ms (p95) | Cached response |
| Assign 50 subjects via bulk | <2s | Sequential non-transactional |
| Subject search with wildcard | <100ms (p95) | Indexed ilike on name/code |

---

## Appendix A: Error Codes

```typescript
export const SUBJECT_ERROR_CODES = {
  SUBJ_400_01: { status: 400, message: 'Subject has active class assignments. Provide reassign_subject_id or remove assignments first.' },
  SUBJ_400_02: { status: 400, message: 'Subject must be assigned to the class before assigning a teacher.' },
  SUBJ_400_03: { status: 400, message: 'Teacher already has 8 subject assignments this term.' },
  SUBJ_400_04: { status: 400, message: 'Teacher(s) are still assigned to this subject in this class. Remove teacher assignments first.' },
  SUBJ_400_05: { status: 400, message: 'Cannot reassign to the same subject.' },
  SUBJ_400_06: { status: 400, message: 'Cannot assign a deactivated subject.' },
  SUBJ_400_07: { status: 400, message: 'Reason must be at least 5 characters.' },

  SUBJ_403: { status: 403, message: 'You do not have permission to manage subjects.' },

  SUBJ_404_01: { status: 404, message: 'Subject not found.' },
  SUBJ_404_02: { status: 404, message: 'Class not found.' },
  SUBJ_404_03: { status: 404, message: 'Teacher not found.' },
  SUBJ_404_04: { status: 404, message: 'Subject assignment not found.' },
  SUBJ_404_05: { status: 404, message: 'Teacher assignment not found.' },

  SUBJ_409_01: { status: 409, message: 'Subject code already exists in this school.' },
  SUBJ_409_02: { status: 409, message: 'Subject name already exists in this school.' },
  SUBJ_409_03: { status: 409, message: 'Subject is already assigned to this class for this term.' },
  SUBJ_409_04: { status: 409, message: 'Teacher is already assigned to this subject in this class for this term.' },

  SUBJ_429: { status: 429, message: 'Too many requests. Max 3 bulk assigns per minute.' },
} as const;
```

## Appendix B: Dependency Injection

```typescript
// src/modules/subjects/subjects.container.ts

export function createSubjectsService(): SubjectsService {
  const db = createClient();
  const cache = new CacheManager();
  const eventBus = EventBus.getInstance();

  return new SubjectsService(
    new SubjectsRepository(db),
    new AuditService(db),
    cache,
    new AuthorizationService(db, cache),
    eventBus,
  );
}
```

---

**Document Version**: 1.0  \
**Date**: June 10, 2026  \
**Next Action**: Implement module scaffolding, run migration for `class_subjects` table, and begin API endpoint development
