# ATHON V2 — Classes Module Implementation

**Reviewer**: Principal Software Architect  \
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  \
**Product**: Athon — AI Teacher Operating System for CBSE Schools  \
**Date**: June 10, 2026  \
**References**: AUTH_MODULE_IMPLEMENTATION.md · USERS_MODULE_IMPLEMENTATION.md · DATABASE_V2_FINAL.md · Permission Matrix v1.0

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Folder Structure](#2-folder-structure)
3. [Schemas (Zod)](#3-schemas-zod)
4. [Services](#4-services)
5. [Repositories](#5-repositories)
6. [API Routes](#6-api-routes)
7. [Permissions & Scope](#7-permissions--scope)
8. [Audit Logging](#8-audit-logging)
9. [Workflows](#9-workflows)
10. [Edge Cases](#10-edge-cases)
11. [Scalability Review](#11-scalability-review)
12. [Testing Checklist](#12-testing-checklist)

---

## 1. Database Schema

### 1.1 Tables

#### `classes` (core table)

```sql
CREATE TABLE classes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    name              VARCHAR(50) NOT NULL,        -- "Grade 10"
    section           VARCHAR(20),                  -- "A", "B", etc.
    academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
    class_teacher_id  UUID REFERENCES teachers(id), -- Form teacher (denormalized, also in teacher_class_subjects)
    room_number       VARCHAR(20),
    capacity          INTEGER NOT NULL DEFAULT 30 CHECK (capacity >= 1 AND capacity <= 100),
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ                    -- Soft delete
);

CREATE UNIQUE INDEX idx_classes_unique ON classes(school_id, name, section, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_school_year ON classes(school_id, academic_year_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_teacher ON classes(class_teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_active ON classes(school_id, is_active) WHERE deleted_at IS NULL;
```

**Design rationale**:
- `name + section + academic_year_id` UNIQUE prevents duplicate cohorts (e.g., two "Grade 10 A" in the same year)
- `class_teacher_id` is denormalized for quick lookups; the authoritative source is `teacher_class_subjects.is_class_teacher = true`
- `capacity` prevents over-enrollment (checked on student assignment)
- Soft delete preserves class history — students enrolled in a deleted class remain in `class_enrollments`

#### `class_enrollments` (historical tracking)

```sql
CREATE TABLE class_enrollments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id         UUID NOT NULL REFERENCES schools(id),
    student_id        UUID NOT NULL REFERENCES students(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    academic_year_id  UUID NOT NULL REFERENCES academic_years(id),
    enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,                    -- When student left/completed
    status            enrollment_status NOT NULL DEFAULT 'active',
        -- 'active', 'promoted', 'transferred', 'graduated', 'withdrawn'
    reason            VARCHAR(255),                    -- Optional reason for status change
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_ce_student_year ON class_enrollments(student_id, academic_year_id);
CREATE INDEX idx_ce_current_enrollments ON class_enrollments(student_id, status) WHERE status = 'active';
CREATE INDEX idx_ce_class_history ON class_enrollments(class_id, academic_year_id, status);
CREATE INDEX idx_ce_school_status ON class_enrollments(school_id, status, academic_year_id);
```

**Design rationale**:
- `UNIQUE(student_id, academic_year_id)` ensures a student is enrolled in exactly one class per academic year
- `status` enables historical queries: "Which class was this student in during 2024-25?"
- This is the golden source for attendance queries — you must check `class_enrollments` to know which class a student belonged to on a given date (important for students who transferred mid-year)

#### `teacher_class_subjects` (teacher-class-subject assignments)

```sql
CREATE TABLE teacher_class_subjects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id        UUID NOT NULL REFERENCES teachers(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    subject_id        UUID NOT NULL REFERENCES subjects(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    academic_term_id  UUID NOT NULL REFERENCES academic_terms(id),
    is_class_teacher  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    UNIQUE(teacher_id, class_id, subject_id, academic_term_id)
);

CREATE INDEX idx_tcs_teacher_term ON teacher_class_subjects(teacher_id, academic_term_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_class_subject ON teacher_class_subjects(class_id, subject_id, academic_term_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_class_teacher ON teacher_class_subjects(class_id, teacher_id) WHERE deleted_at IS NULL AND is_class_teacher = TRUE;
```

**Design rationale**:
- `UNIQUE(teacher_id, class_id, subject_id, academic_term_id)` prevents duplicate assignments
- A teacher can have multiple subjects in the same class (e.g., Science + Math in Grade 7)
- `is_class_teacher` flag designates the form teacher — only one per class per term

### 1.2 ENUMs

```sql
CREATE TYPE enrollment_status AS ENUM (
    'active',
    'promoted',
    'transferred',
    'graduated',
    'withdrawn'
);

-- Extend audit_event_type from Auth Module
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:teacher_assigned';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:teacher_removed';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:student_moved';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:bulk_enrollment';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'class:enrollment_changed';
```

### 1.3 RLS Policies

```sql
-- Classes: admin/principal see all; teacher sees own; student sees own
CREATE POLICY classes_select ON classes FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    AND (
        EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid()::uuid
                AND role IN ('school_admin', 'principal'))
        OR id IN (SELECT class_id FROM teacher_class_subjects
                  WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
        OR id IN (SELECT class_id FROM students
                  WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid))
        OR id IN (SELECT sp.class_id FROM student_parents sp
                  JOIN students s ON sp.student_id = s.id
                  WHERE sp.parent_id = (SELECT id FROM parents WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
    )
);

CREATE POLICY classes_insert ON classes FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                 AND role = 'school_admin')
);

CREATE POLICY classes_update ON classes FOR UPDATE USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                 AND role = 'school_admin')
);

-- Class enrollments
CREATE POLICY class_enrollments_select ON class_enrollments FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid)
    AND (
        student_id = (SELECT id FROM students WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid))
        OR EXISTS (SELECT 1 FROM users WHERE supabase_user_id = auth.uid()::uuid AND role IN ('school_admin', 'principal'))
        OR class_id IN (SELECT class_id FROM teacher_class_subjects
                        WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
        OR student_id IN (SELECT student_id FROM student_parents
                          WHERE parent_id = (SELECT id FROM parents WHERE user_id = (SELECT id FROM users WHERE supabase_user_id = auth.uid()::uuid)))
    )
);
```

### 1.4 Triggers

```sql
-- Maintain denormalized students.class_id when enrollment changes
CREATE OR REPLACE FUNCTION sync_student_class_id()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status = 'active' THEN
            UPDATE students SET class_id = NEW.class_id, updated_at = NOW()
            WHERE id = NEW.student_id;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active' THEN
        -- Student left the class — don't clear class_id immediately
        -- (teacher still needs to see the student until re-assigned)
        -- Only clear if student is withdrawn or graduated
        IF NEW.status IN ('withdrawn', 'graduated') THEN
            UPDATE students SET class_id = NULL, updated_at = NOW()
            WHERE id = NEW.student_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_student_class_id
    AFTER INSERT OR UPDATE ON class_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION sync_student_class_id();
```

---

## 2. Folder Structure

```
src/modules/classes/
├── classes.service.ts              # Business logic: create, edit, delete, roster, statistics
├── classes.repository.ts           # Database access: classes, enrollments, teacher_class_subjects
├── classes.router.ts               # API route handlers
├── classes.validator.ts            # Zod schemas for request validation
├── classes.schema.ts              # TypeScript type definitions
├── classes.permissions.ts          # Permission checks for class operations
├── classes.utils.ts                # Helper functions (capacity check, conflict detection)
│
src/modules/teachers/               # Consumed by classes module
├── teachers.repository.ts          # Teacher lookups for class teacher assignment
│
src/modules/students/               # Consumed by classes module
├── students.repository.ts          # Student lookups for roster, moves
│
src/core/authorization/
├── policies/
│   ├── classes.policy.ts           # Class-specific permission policies
│   └── ...
```

---

## 3. Schemas (Zod)

```typescript
// src/modules/classes/classes.validator.ts

import { z } from 'zod';

// ─── Shared Base ─────────────────────────────────────────────

const UUID = z.string().uuid();
const Name = z.string().min(1, 'Required').max(50);
const YearId = z.string().uuid('Invalid academic year');

// ─── Create Class ─────────────────────────────────────────────

export const CreateClassSchema = z.object({
  name: Name,
  section: z.string().max(20).optional(),
  academic_year_id: YearId,
  class_teacher_id: UUID.optional(),
  room_number: z.string().max(20).optional(),
  capacity: z.number().int().min(1).max(100).default(30),
});

// ─── Update Class ─────────────────────────────────────────────

export const UpdateClassSchema = z.object({
  name: Name.optional(),
  section: z.string().max(20).optional(),
  class_teacher_id: UUID.nullable().optional(),  // null = remove form teacher
  room_number: z.string().max(20).nullable().optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});

// ─── Assign Class Teacher ─────────────────────────────────────

export const AssignClassTeacherSchema = z.object({
  teacher_id: UUID,
  subject_ids: z.array(UUID).min(1, 'At least one subject required'),
  is_class_teacher: z.boolean().default(false),
  academic_term_id: YearId,
});

// ─── Remove Class Teacher ─────────────────────────────────────

export const RemoveClassTeacherSchema = z.object({
  teacher_id: UUID,
  subject_ids: z.array(UUID).optional(),  // If omitted, remove all
  reason: z.string().max(255).optional(),
});

// ─── Move Student ─────────────────────────────────────────────

export const MoveStudentSchema = z.object({
  student_id: UUID,
  target_class_id: UUID,
  reason: z.string().max(255).optional(),       // Required for audit
  transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ─── Bulk Enroll ──────────────────────────────────────────────

export const BulkEnrollSchema = z.object({
  student_ids: z.array(UUID).min(1, 'At least one student required').max(100, 'Max 100 per batch'),
  academic_year_id: YearId,
});

// ─── Delete Class ─────────────────────────────────────────────

export const DeleteClassSchema = z.object({
  reason: z.string().min(10, 'A detailed reason is required').max(500),
  move_students_to_class_id: UUID.optional(),
});

// ─── Roster Query ─────────────────────────────────────────────

export const RosterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort_by: z.enum(['roll_number', 'first_name', 'last_name', 'admission_number']).default('roll_number'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().max(100).optional(),
  status: z.enum(['active', 'transferred', 'graduated', 'withdrawn']).optional(),
});

// ─── Class Statistics ─────────────────────────────────────────

export const StatisticsQuerySchema = z.object({
  class_id: UUID,
  academic_term_id: YearId.optional(),
});

// ─── Response Schemas ─────────────────────────────────────────

export const ClassResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  section: z.string().nullable(),
  academic_year: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  class_teacher: z.object({
    id: z.string().uuid(),
    name: z.string(),
    employee_code: z.string(),
  }).nullable(),
  room_number: z.string().nullable(),
  capacity: z.number(),
  student_count: z.number(),
  is_active: z.boolean(),
  created_at: z.string(),
});

export const RosterResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().uuid(),
    roll_number: z.number().nullable(),
    first_name: z.string(),
    last_name: z.string(),
    admission_number: z.string(),
    email: z.string(),
    date_of_birth: z.string().nullable(),
    blood_group: z.string().nullable(),
    emergency_contact: z.any().nullable(),
    enrollment_status: z.string(),
    enrolled_at: z.string(),
  })),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const ClassStatisticsSchema = z.object({
  class_id: z.string().uuid(),
  class_name: z.string(),
  section: z.string().nullable(),
  total_students: z.number(),
  active_students: z.number(),
  capacity_utilization: z.number(),           // Percentage
  gender_distribution: z.record(z.number()).optional(),
  teachers_count: z.number(),
  subjects_count: z.number(),
  average_attendance: z.number().nullable(),   // Percentage (term-to-date)
  assignments_count: z.number(),
  avg_completion_rate: z.number().nullable(),
  enrollments_trend: z.array(z.object({
    date: z.string(),
    action: z.enum(['enrolled', 'transferred_out', 'graduated']),
    count: z.number(),
  })).optional(),
});

// ─── Types ───────────────────────────────────────────────────

export type CreateClassInput = z.infer<typeof CreateClassSchema>;
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>;
export type AssignClassTeacherInput = z.infer<typeof AssignClassTeacherSchema>;
export type RemoveClassTeacherInput = z.infer<typeof RemoveClassTeacherSchema>;
export type MoveStudentInput = z.infer<typeof MoveStudentSchema>;
export type BulkEnrollInput = z.infer<typeof BulkEnrollSchema>;
export type DeleteClassInput = z.infer<typeof DeleteClassSchema>;
export type ClassResponse = z.infer<typeof ClassResponseSchema>;
export type RosterResponse = z.infer<typeof RosterResponseSchema>;
export type ClassStatistics = z.infer<typeof ClassStatisticsSchema>;
```

---

## 4. Services

```typescript
// src/modules/classes/classes.service.ts

import { createClient } from '@/core/database/client';
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
import { ClassesRepository } from './classes.repository';
import { TeachersRepository } from '../teachers/teachers.repository';
import { StudentsRepository } from '../students/students.repository';
import {
  CreateClassInput,
  UpdateClassInput,
  AssignClassTeacherInput,
  RemoveClassTeacherInput,
  MoveStudentInput,
  DeleteClassInput,
  ClassResponse,
  RosterResponse,
  ClassStatistics,
} from './classes.validator';

export class ClassesService {
  constructor(
    private readonly classRepo: ClassesRepository,
    private readonly teacherRepo: TeachersRepository,
    private readonly studentRepo: StudentsRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Create Class ───────────────────────────────────────────

  async createClass(
    ctx: RequestContext,
    input: CreateClassInput,
  ): Promise<ClassResponse> {
    await this.authz.assert(ctx, 'classes:create');

    // 1. Verify academic year exists and belongs to school
    const year = await this.classRepo.findAcademicYear(input.academic_year_id, ctx.schoolId);
    if (!year) throw new NotFoundError('Academic year not found');

    // 2. Check for duplicate name + section + year
    const duplicate = await this.classRepo.findByNameSectionYear(
      ctx.schoolId, input.name, input.section, input.academic_year_id,
    );
    if (duplicate) {
      throw new ConflictError(
        `Class ${input.name}${input.section ? ' ' + input.section : ''} already exists in this academic year`,
      );
    }

    // 3. If class teacher specified, verify teacher exists
    if (input.class_teacher_id) {
      const teacher = await this.teacherRepo.findById(input.class_teacher_id);
      if (!teacher) throw new NotFoundError('Teacher not found');
    }

    // 4. Create class
    const created = await this.classRepo.create({
      school_id: ctx.schoolId,
      name: input.name,
      section: input.section ?? null,
      academic_year_id: input.academic_year_id,
      class_teacher_id: input.class_teacher_id ?? null,
      room_number: input.room_number ?? null,
      capacity: input.capacity,
    });

    // 5. Audit
    await this.audit.log({
      eventType: 'class:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class',
      resourceId: created.id,
      details: {
        name: input.name,
        section: input.section,
        academicYearId: input.academic_year_id,
        capacity: input.capacity,
      },
      outcome: 'success',
    });

    // 6. Publish event for downstream systems (timetable, notifications)
    await this.eventBus.publish('class:created', {
      classId: created.id,
      schoolId: ctx.schoolId,
      name: input.name,
      section: input.section,
    });

    return this.mapClassResponse(created, 0);
  }

  // ─── Update Class ───────────────────────────────────────────

  async updateClass(
    ctx: RequestContext,
    classId: string,
    input: UpdateClassInput,
  ): Promise<ClassResponse> {
    await this.authz.assert(ctx, 'classes:edit');

    const existing = await this.classRepo.findById(classId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Class not found');

    // If class_teacher_id is provided, verify new teacher
    if (input.class_teacher_id !== undefined && input.class_teacher_id !== null) {
      const teacher = await this.teacherRepo.findById(input.class_teacher_id);
      if (!teacher) throw new NotFoundError('Teacher not found');
    }

    // If capacity reduced, check current enrollment
    if (input.capacity && input.capacity < existing.capacity) {
      const studentCount = await this.classRepo.getActiveStudentCount(classId);
      if (studentCount > input.capacity) {
        throw new ValidationError(
          `Cannot reduce capacity to ${input.capacity}. Current enrollment is ${studentCount}.`,
        );
      }
    }

    // Sync teacher_class_subjects.is_class_teacher flag when class_teacher_id changes
    if (
      input.class_teacher_id !== undefined &&
      input.class_teacher_id !== existing.class_teacher_id
    ) {
      // Clear the old class teacher's flag
      await this.classRepo.clearClassTeacherFlag(classId);

      // If a new teacher is assigned, set their flag
      if (input.class_teacher_id) {
        // Find the matching teacher_class_subjects record for this teacher
        await this.classRepo.setClassTeacherFlag(
          classId,
          input.class_teacher_id,
        );
      }
    }

    const updated = await this.classRepo.update(classId, {
      name: input.name,
      section: input.section,
      class_teacher_id: input.class_teacher_id ?? (input.class_teacher_id === null ? null : undefined),
      room_number: input.room_number,
      capacity: input.capacity,
      is_active: input.is_active,
    });

    // Invalidate cache
    await this.cache.invalidate(`class:${classId}`);

    // Audit
    await this.audit.log({
      eventType: 'class:updated',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class',
      resourceId: classId,
      details: {
        before: { name: existing.name, capacity: existing.capacity, classTeacherId: existing.class_teacher_id },
        after: { name: updated.name, capacity: updated.capacity, classTeacherId: updated.class_teacher_id },
      },
      outcome: 'success',
    });

    const studentCount = await this.classRepo.getActiveStudentCount(classId);
    return this.mapClassResponse(updated, studentCount);
  }

  // ─── Delete (Deactivate) Class ─────────────────────────────

  async deleteClass(
    ctx: RequestContext,
    classId: string,
    input: DeleteClassInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'classes:delete');

    const existing = await this.classRepo.findById(classId, ctx.schoolId);
    if (!existing) throw new NotFoundError('Class not found');

    // Check for active students
    const activeStudentCount = await this.classRepo.getActiveStudentCount(classId);
    if (activeStudentCount > 0 && !input.move_students_to_class_id) {
      throw new ValidationError(
        `Class has ${activeStudentCount} active students. Provide move_students_to_class_id or remove students first.`,
      );
    }

    // Move students if requested
    if (input.move_students_to_class_id && activeStudentCount > 0) {
      const targetClass = await this.classRepo.findById(input.move_students_to_class_id, ctx.schoolId);
      if (!targetClass) throw new NotFoundError('Target class for student move not found');

      const targetCapacity = await this.classRepo.getAvailableCapacity(input.move_students_to_class_id);
      if (activeStudentCount > targetCapacity) {
        throw new ValidationError(
          `Target class has only ${targetCapacity} available seats. Cannot move ${activeStudentCount} students.`,
        );
      }

      // Bulk move all students
      await this.classRepo.bulkTransferStudents(
        classId,
        input.move_students_to_class_id,
        ctx.schoolId,
        'transferred',
      );
    }

    // Soft delete class
    await this.classRepo.softDelete(classId);
    await this.classRepo.removeAllTeacherAssignments(classId);

    // ⚠️ Note: timetable entries referencing this class become orphaned.
    // The timetable module must handle this via its own cleanup on the
    // `class:deleted` event. See Edge Case 5 for details.

    // Invalidate cache
    await this.cache.invalidate(`class:${classId}`);

    // Audit
    await this.audit.log({
      eventType: 'class:deleted',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class',
      resourceId: classId,
      details: {
        name: existing.name,
        section: existing.section,
        reason: input.reason,
        studentsMovedTo: input.move_students_to_class_id,
        activeStudentCount,
      },
      outcome: 'success',
    });

    await this.eventBus.publish('class:deleted', {
      classId,
      schoolId: ctx.schoolId,
      reason: input.reason,
    });
  }

  // ─── Assign Class Teacher ───────────────────────────────────

  async assignClassTeacher(
    ctx: RequestContext,
    classId: string,
    input: AssignClassTeacherInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'classes:assign_teacher');

    const classRecord = await this.classRepo.findById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const teacher = await this.teacherRepo.findById(input.teacher_id);
    if (!teacher) throw new NotFoundError('Teacher not found');

    // Verify all subject_ids exist
    for (const subjectId of input.subject_ids) {
      const subject = await this.classRepo.findSubjectById(subjectId, ctx.schoolId);
      if (!subject) throw new NotFoundError(`Subject ${subjectId} not found`);
    }

    // Check for conflicts: teacher already assigned to these subjects in this class this term
    const conflicts = await this.classRepo.findTeacherSubjectConflicts(
      input.teacher_id,
      classId,
      input.subject_ids,
      input.academic_term_id,
    );
    if (conflicts.length > 0) {
      // Soft-overwrite: revoke old, assign new
      await this.classRepo.removeTeacherAssignmentsBySubjects(
        input.teacher_id, classId, conflicts,
      );
    }

    // Assign teacher to each subject
    for (const subjectId of input.subject_ids) {
      await this.classRepo.assignTeacherToSubject({
        teacher_id: input.teacher_id,
        class_id: classId,
        subject_id: subjectId,
        school_id: ctx.schoolId,
        academic_term_id: input.academic_term_id,
        is_class_teacher: input.is_class_teacher,
      });
    }

    // If designated as class teacher, update classes table
    if (input.is_class_teacher) {
      // Remove existing class teacher flag for this class
      await this.classRepo.clearClassTeacherFlag(classId);
      await this.classRepo.update(classId, { class_teacher_id: input.teacher_id });
    }

    // Audit
    await this.audit.log({
      eventType: 'class:teacher_assigned',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'teacher_class_subjects',
      details: {
        classId,
        teacherId: input.teacher_id,
        subjectIds: input.subject_ids,
        isClassTeacher: input.is_class_teacher,
        academicTermId: input.academic_term_id,
      },
      outcome: 'success',
    });

    // Invalidate cache for both teacher and class
    await this.cache.invalidate(`class:${classId}:teachers`);
    await this.cache.invalidate(`teacher:${input.teacher_id}:classes`);
  }

  // ─── Remove Class Teacher ───────────────────────────────────

  async removeClassTeacher(
    ctx: RequestContext,
    classId: string,
    input: RemoveClassTeacherInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'classes:assign_teacher');

    const classRecord = await this.classRepo.findById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const teacher = await this.teacherRepo.findById(input.teacher_id);
    if (!teacher) throw new NotFoundError('Teacher not found');

    if (input.subject_ids && input.subject_ids.length > 0) {
      await this.classRepo.removeTeacherAssignmentsBySubjects(
        input.teacher_id, classId, input.subject_ids,
      );
    } else {
      await this.classRepo.removeAllTeacherAssignmentsForTeacher(
        input.teacher_id, classId,
      );
    }

    // Check if this teacher was the class teacher — clear if so
    if (classRecord.class_teacher_id === input.teacher_id) {
      // Only clear if no other teacher has is_class_teacher flag for this class
      const hasOtherClassTeacher = await this.classRepo.hasOtherClassTeacher(classId, input.teacher_id);
      if (!hasOtherClassTeacher) {
        await this.classRepo.update(classId, { class_teacher_id: null });
      }
    }

    await this.audit.log({
      eventType: 'class:teacher_removed',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'teacher_class_subjects',
      details: {
        classId,
        teacherId: input.teacher_id,
        subjectIds: input.subject_ids ?? 'all',
        reason: input.reason,
      },
      outcome: 'success',
    });
  }

  // ─── View Roster ────────────────────────────────────────────

  async getRoster(
    ctx: RequestContext,
    classId: string,
    query: {
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: string;
      search?: string;
      status?: string;
    },
  ): Promise<RosterResponse> {
    await this.authz.assert(ctx, 'classes:view_roster', { classId });

    const classRecord = await this.classRepo.findById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    // Get the student list from class_enrollments (active by default)
    const enrollmentStatus = query.status ?? 'active';
    const { data: enrollments, total } = await this.classRepo.getRosterPaginated(
      classId,
      ctx.schoolId,
      {
        page,
        limit,
        sortBy: query.sort_by ?? 'roll_number',
        sortOrder: query.sort_order ?? 'asc',
        search: query.search,
        status: enrollmentStatus,
      },
    );

    return {
      data: enrollments,
      total,
      page,
      limit,
    };
  }

  // ─── Move Student ───────────────────────────────────────────

  async moveStudent(
    ctx: RequestContext,
    input: MoveStudentInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'classes:move_student');

    const student = await this.studentRepo.findById(input.student_id);
    if (!student) throw new NotFoundError('Student not found');

    const targetClass = await this.classRepo.findById(input.target_class_id, ctx.schoolId);
    if (!targetClass) throw new NotFoundError('Target class not found');

    // Get current active enrollment
    const currentEnrollment = await this.classRepo.findActiveEnrollment(input.student_id, ctx.schoolId);
    if (!currentEnrollment) {
      throw new ValidationError('Student is not currently enrolled in any class');
    }

    if (currentEnrollment.class_id === input.target_class_id) {
      throw new ValidationError('Student is already in this class');
    }

    // Check target class capacity
    const availableCapacity = await this.classRepo.getAvailableCapacity(input.target_class_id);
    if (availableCapacity <= 0) {
      throw new ValidationError('Target class is at full capacity');
    }

    // Check for attendance on the same day — prevent mid-day move
    const todayDate = input.transfer_date ?? new Date().toISOString().split('T')[0];
    const hasAttendanceToday = await this.classRepo.hasAttendanceRecord(
      input.student_id, todayDate,
    );
    if (hasAttendanceToday) {
      throw new ValidationError(
        'Student already has an attendance record today. Transfer must take effect tomorrow.',
      );
    }

    // Execute transfer
    await this.classRepo.transferStudent(
      input.student_id,
      currentEnrollment.class_id,
      input.target_class_id,
      ctx.schoolId,
      input.reason ?? 'Class transfer',
      todayDate,
    );

    // Audit
    await this.audit.log({
      eventType: 'class:student_moved',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class_enrollment',
      details: {
        studentId: input.student_id,
        fromClassId: currentEnrollment.class_id,
        fromClassName: currentEnrollment.class_name,
        toClassId: input.target_class_id,
        toClassName: targetClass.name,
        reason: input.reason,
        transferDate: todayDate,
      },
      outcome: 'success',
    });

    // Notify both teachers
    await this.eventBus.publish('class:student_transferred', {
      studentId: input.student_id,
      fromClassId: currentEnrollment.class_id,
      toClassId: input.target_class_id,
      schoolId: ctx.schoolId,
      reason: input.reason,
      transferDate: todayDate,
    });

    // Invalidate caches
    await this.cache.invalidate(`class:${currentEnrollment.class_id}:roster`);
    await this.cache.invalidate(`class:${input.target_class_id}:roster`);
    await this.cache.invalidate(`student:${input.student_id}`);
  }

  // ─── Bulk Enroll Students ──────────────────────────────────

  async bulkEnrollStudents(
    ctx: RequestContext,
    classId: string,
    input: BulkEnrollInput,
  ): Promise<{ succeeded: number; failed: number; errors: Array<{ studentId: string; reason: string }> }> {
    await this.authz.assert(ctx, 'classes:bulk_enroll');

    const classRecord = await this.classRepo.findById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const errors: Array<{ studentId: string; reason: string }> = [];
    let succeeded = 0;

    // Check available capacity
    const availableCapacity = await this.classRepo.getAvailableCapacity(classId);
    if (input.student_ids.length > availableCapacity) {
      throw new ValidationError(
        `Not enough capacity. Available: ${availableCapacity}, Requested: ${input.student_ids.length}`,
      );
    }

    for (const studentId of input.student_ids) {
      try {
        const student = await this.studentRepo.findById(studentId);
        if (!student) {
          errors.push({ studentId, reason: 'Student not found' });
          continue;
        }

        // Check if already enrolled in this year
        const existingEnrollment = await this.classRepo.findEnrollmentByStudentYear(
          studentId, input.academic_year_id,
        );
        if (existingEnrollment) {
          if (existingEnrollment.class_id === classId) {
            errors.push({ studentId, reason: 'Already enrolled in this class' });
            continue;
          }
          // Student is in another class this year — need to transfer
          await this.classRepo.transferStudent(
            studentId,
            existingEnrollment.class_id,
            classId,
            ctx.schoolId,
            'Bulk enrollment',
            new Date().toISOString().split('T')[0],
          );
        } else {
          // New enrollment
          await this.classRepo.enrollStudent({
            student_id: studentId,
            class_id: classId,
            school_id: ctx.schoolId,
            academic_year_id: input.academic_year_id,
          });
        }

        succeeded++;
      } catch (error) {
        errors.push({
          studentId,
          reason: error instanceof AppError ? error.message : 'Unknown error',
        });
      }
    }

    // Audit
    await this.audit.log({
      eventType: 'class:bulk_enrollment',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'class_enrollment',
      resourceId: classId,
      details: {
        classId,
        requested: input.student_ids.length,
        succeeded,
        failed: errors.length,
        errors: errors.slice(0, 10), // Truncate to 10 for audit
      },
      outcome: errors.length > 0 ? 'failure' : 'success',
    });

    await this.cache.invalidate(`class:${classId}:roster`);

    return { succeeded, failed: errors.length, errors };
  }

  // ─── Class Statistics ──────────────────────────────────────

  async getStatistics(
    ctx: RequestContext,
    classId: string,
    academicTermId?: string,
  ): Promise<ClassStatistics> {
    await this.authz.assert(ctx, 'classes:view_statistics', { classId });

    const classRecord = await this.classRepo.findById(classId, ctx.schoolId);
    if (!classRecord) throw new NotFoundError('Class not found');

    const cacheKey = `class:${classId}:stats:${academicTermId ?? 'current'}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const [
        totalStudents,
        activeStudents,
        capacityUtilization,
        genderDistribution,
        teachersCount,
        subjectsCount,
        averageAttendance,
        assignmentsCount,
        avgCompletionRate,
      ] = await Promise.all([
        this.classRepo.getTotalStudentCount(classId),
        this.classRepo.getActiveStudentCount(classId),
        this.classRepo.getCapacityUtilization(classId),
        this.classRepo.getGenderDistribution(classId),
        this.classRepo.getTeachersCount(classId),
        this.classRepo.getSubjectsCount(classId),
        academicTermId
          ? this.classRepo.getAverageAttendance(classId, academicTermId)
          : this.classRepo.getAverageAttendance(classId),
        this.classRepo.getAssignmentsCount(classId),
        this.classRepo.getAverageCompletionRate(classId),
      ]);

      return {
        class_id: classId,
        class_name: `${classRecord.name}${classRecord.section ? ' ' + classRecord.section : ''}`,
        section: classRecord.section,
        total_students: totalStudents,
        active_students: activeStudents,
        capacity_utilization: capacityUtilization,
        gender_distribution: genderDistribution,
        teachers_count: teachersCount,
        subjects_count: subjectsCount,
        average_attendance: averageAttendance,
        assignments_count: assignmentsCount,
        avg_completion_rate: avgCompletionRate,
      };
    }, 300); // Cache for 5 minutes
  }

  // ─── List Classes ──────────────────────────────────────────

  async listClasses(
    ctx: RequestContext,
    filters: {
      academic_year_id?: string;
      is_active?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: ClassResponse[]; total: number }> {
    await this.authz.assert(ctx, 'classes:view');

    // Teacher scope: only their assigned classes
    let scopeClassIds: string[] | undefined;
    if (ctx.role === 'teacher' && ctx.profileId) {
      const teacherClasses = await this.classRepo.getTeacherClassIds(
        ctx.profileId, filters.academic_year_id,
      );
      scopeClassIds = teacherClasses.map(c => c.class_id);
    }

    // Student scope: only their own class
    if (ctx.role === 'student') {
      const studentProfile = await this.studentRepo.findByUserId(ctx.userId);
      if (studentProfile?.class_id) {
        scopeClassIds = [studentProfile.class_id];
      } else {
        return { data: [], total: 0 };
      }
    }

    // Parent scope: children's classes
    if (ctx.role === 'parent') {
      const parentProfile = await this.classRepo.getParentProfile(ctx.userId);
      if (parentProfile) {
        const studentIds = await this.classRepo.getParentStudentIds(parentProfile.id);
        const enrollments = await this.classRepo.getActiveEnrollmentsForStudents(studentIds);
        scopeClassIds = [...new Set(enrollments.map(e => e.class_id))];
      } else {
        return { data: [], total: 0 };
      }
    }

    return this.classRepo.findMany(ctx.schoolId, {
      ...filters,
      scopeClassIds,
    });
  }

  // ─── Private Helpers ───────────────────────────────────────

  private mapClassResponse(classRecord: any, studentCount: number): ClassResponse {
    return {
      id: classRecord.id,
      name: classRecord.name,
      section: classRecord.section,
      academic_year: classRecord.academic_year_name
        ? { id: classRecord.academic_year_id, name: classRecord.academic_year_name }
        : { id: classRecord.academic_year_id, name: '' },
      class_teacher: classRecord.teacher_id
        ? {
            id: classRecord.teacher_id,
            name: `${classRecord.teacher_first_name} ${classRecord.teacher_last_name}`,
            employee_code: classRecord.employee_code,
          }
        : null,
      room_number: classRecord.room_number,
      capacity: classRecord.capacity,
      student_count: studentCount,
      is_active: classRecord.is_active,
      created_at: classRecord.created_at,
    };
  }
}
```

---

## 5. Repositories

```typescript
// src/modules/classes/classes.repository.ts

export class ClassesRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  // ─── CRUD ──────────────────────────────────────────────────

  async create(input: {
    school_id: string;
    name: string;
    section: string | null;
    academic_year_id: string;
    class_teacher_id: string | null;
    room_number: string | null;
    capacity: number;
  }): Promise<any> {
    const { data, error } = await this.db
      .from('classes')
      .insert(input)
      .select(`
        *,
        academic_years!inner(name),
        teachers!left(id, user_id, employee_code, users!inner(first_name, last_name))
      `)
      .single();
    if (error) throw new DatabaseError('Failed to create class', { cause: error });
    return data;
  }

  async findById(id: string, schoolId: string): Promise<any | null> {
    const { data, error } = await this.db
      .from('classes')
      .select(`
        *,
        academic_years!inner(name),
        teachers!left(id, employee_code, users!inner(first_name, last_name))
      `)
      .eq('id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByNameSectionYear(
    schoolId: string, name: string, section: string | undefined, yearId: string,
  ): Promise<any | null> {
    let query = this.db
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', name)
      .eq('academic_year_id', yearId)
      .is('deleted_at', null);
    if (section) query = query.eq('section', section);
    else query = query.is('section', null);

    const { data } = await query.single();
    return data;
  }

  async update(id: string, data: Partial<any>): Promise<any> {
    const { data: updated, error } = await this.db
      .from('classes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new DatabaseError('Failed to update class', { cause: error });
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.from('classes').update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  // ─── Listing ──────────────────────────────────────────────

  async findMany(
    schoolId: string,
    filters: {
      academic_year_id?: string;
      is_active?: boolean;
      search?: string;
      page?: number;
      limit?: number;
      scopeClassIds?: string[];
    },
  ): Promise<{ data: any[]; total: number }> {
    let query = this.db
      .from('classes')
      .select(`
        *,
        academic_years!inner(name),
        teachers!left(id, employee_code, users!inner(first_name, last_name))
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .is('deleted_at', null);

    if (filters.scopeClassIds) {
      query = query.in('id', filters.scopeClassIds);
    }
    if (filters.academic_year_id) {
      query = query.eq('academic_year_id', filters.academic_year_id);
    }
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,section.ilike.%${filters.search}%`,
      );
    }

    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    const to = from + (filters.limit ?? 20) - 1;
    query = query.order('name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError('Failed to list classes', { cause: error });
    return { data: data ?? [], total: count ?? 0 };
  }

  // ─── Teacher Assignments ─────────────────────────────────

  async assignTeacherToSubject(input: {
    teacher_id: string;
    class_id: string;
    subject_id: string;
    school_id: string;
    academic_term_id: string;
    is_class_teacher: boolean;
  }): Promise<any> {
    const { data, error } = await this.db
      .from('teacher_class_subjects')
      .upsert(input, {
        onConflict: 'teacher_id, class_id, subject_id, academic_term_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();
    if (error) throw new DatabaseError('Failed to assign teacher', { cause: error });
    return data;
  }

  async findTeacherSubjectConflicts(
    teacherId: string, classId: string, subjectIds: string[], termId: string,
  ): Promise<string[]> {
    const { data } = await this.db
      .from('teacher_class_subjects')
      .select('subject_id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .eq('academic_term_id', termId)
      .in('subject_id', subjectIds)
      .is('deleted_at', null);
    return data?.map(d => d.subject_id) ?? [];
  }

  async removeTeacherAssignmentsBySubjects(
    teacherId: string, classId: string, subjectIds: string[],
  ): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      deleted_at: new Date().toISOString(),
    })
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .in('subject_id', subjectIds);
  }

  async removeAllTeacherAssignmentsForTeacher(
    teacherId: string, classId: string,
  ): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      deleted_at: new Date().toISOString(),
    })
    .eq('teacher_id', teacherId)
    .eq('class_id', classId);
  }

  async removeAllTeacherAssignments(classId: string): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      deleted_at: new Date().toISOString(),
    }).eq('class_id', classId);
  }

  async clearClassTeacherFlag(classId: string): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      is_class_teacher: false,
    }).eq('class_id', classId).eq('is_class_teacher', true);
  }

  async setClassTeacherFlag(classId: string, teacherId: string): Promise<void> {
    await this.db.from('teacher_class_subjects').update({
      is_class_teacher: true,
    })
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .is('deleted_at', null);
  }

  async hasOtherClassTeacher(classId: string, excludeTeacherId: string): Promise<boolean> {
    const { data } = await this.db
      .from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('is_class_teacher', true)
      .neq('teacher_id', excludeTeacherId)
      .is('deleted_at', null);
    return (data?.length ?? 0) > 0;
  }

  async getTeacherClassIds(teacherId: string, academicYearId?: string): Promise<any[]> {
    let query = this.db
      .from('teacher_class_subjects')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .is('deleted_at', null);

    if (academicYearId) {
      query = query.eq('academic_term_id', academicYearId);
      // Note: This assumes academic_term_id matches academic_year. In practice,
      // join through academic_terms to academic_years.
    }

    const { data } = await query;
    return data ?? [];
  }

  // ─── Rosters & Enrollments ──────────────────────────────

  async getRosterPaginated(
    classId: string,
    schoolId: string,
    options: {
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: string;
      search?: string;
      status?: string;
    },
  ): Promise<{ data: any[]; total: number }> {
    let query = this.db
      .from('class_enrollments')
      .select(`
        student_id,
        status,
        enrolled_at,
        completed_at,
        students!inner(
          id,
          user_id,
          admission_number,
          roll_number,
          date_of_birth,
          blood_group,
          emergency_contact,
          users!inner(first_name, last_name, email)
        )
      `, { count: 'exact' })
      .eq('class_id', classId)
      .eq('school_id', schoolId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.search) {
      query = query.or(
        `students.users.first_name.ilike.%${options.search}%,` +
        `students.users.last_name.ilike.%${options.search}%,` +
        `students.admission_number.ilike.%${options.search}%`,
      );
    }

    const from = (options.page - 1) * options.limit;
    const to = from + options.limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError('Failed to get roster', { cause: error });

    // Transform nested structure
    const transformed = (data ?? []).map(e => ({
      id: e.students.id,
      roll_number: e.students.roll_number,
      first_name: e.students.users.first_name,
      last_name: e.students.users.last_name,
      admission_number: e.students.admission_number,
      email: e.students.users.email,
      date_of_birth: e.students.date_of_birth,
      blood_group: e.students.blood_group,
      emergency_contact: e.students.emergency_contact,
      enrollment_status: e.status,
      enrolled_at: e.enrolled_at,
    }));

    return { data: transformed, total: count ?? 0 };
  }

  async findActiveEnrollment(
    studentId: string, schoolId: string,
  ): Promise<{ class_id: string; class_name: string } | null> {
    const { data, error } = await this.db
      .from('class_enrollments')
      .select(`
        class_id,
        classes!inner(name, section)
      `)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;
    return {
      class_id: data.class_id,
      class_name: `${data.classes.name}${data.classes.section ? ' ' + data.classes.section : ''}`,
    };
  }

  async findEnrollmentByStudentYear(
    studentId: string, academicYearId: string,
  ): Promise<{ class_id: string } | null> {
    const { data } = await this.db
      .from('class_enrollments')
      .select('class_id')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .not('status', 'eq', 'withdrawn')
      .single();
    return data;
  }

  async enrollStudent(input: {
    student_id: string;
    class_id: string;
    school_id: string;
    academic_year_id: string;
  }): Promise<void> {
    const { error } = await this.db
      .from('class_enrollments')
      .insert({
        student_id: input.student_id,
        class_id: input.class_id,
        school_id: input.school_id,
        academic_year_id: input.academic_year_id,
      });
    if (error) throw new DatabaseError('Failed to enroll student', { cause: error });
  }

  async transferStudent(
    studentId: string,
    fromClassId: string,
    toClassId: string,
    schoolId: string,
    reason: string,
    transferDate: string,
  ): Promise<void> {
    // ⚠️ Race condition warning:
    // The three operations below (UPDATE old enrollment, UPDATE students, INSERT new enrollment)
    // are NOT wrapped in a single database transaction. In Supabase's REST API, each call
    // is an independent request. A concurrent read between steps 1 and 2 could see
    // students.class_id = NULL (set by the DB trigger on step 1).
    //
    // Mitigation options (ordered by preference):
    //   A. Use a Supabase RPC (stored procedure) that runs all 3 operations in a single
    //      transaction with SELECT ... FOR UPDATE on the enrollments row.
    //   B. Accept the brief inconsistency window (< 50ms) since the direct UPDATE in step 2
    //      immediately overwrites the NULL. This is the current approach.
    //   C. Disable the DB trigger (`trg_sync_student_class_id`) and manage class_id purely
    //      through application-level writes to students.class_id.

    // Close old enrollment
    await this.db.from('class_enrollments')
      .update({
        status: 'transferred',
        completed_at: transferDate,
        reason,
      })
      .eq('student_id', studentId)
      .eq('class_id', fromClassId)
      .eq('status', 'active');

    // Update students.class_id directly (overwrites the trigger-set NULL from step 1)
    await this.db.from('students')
      .update({ class_id: toClassId, updated_at: new Date().toISOString() })
      .eq('id', studentId);

    // Create new enrollment for current year
    const newEnrollment = await this.db.from('class_enrollments')
      .select('academic_year_id')
      .eq('student_id', studentId)
      .eq('class_id', fromClassId)
      .single();
    const academicYearId = newEnrollment.data?.academic_year_id;

    if (academicYearId) {
      await this.db.from('class_enrollments').insert({
        student_id: studentId,
        class_id: toClassId,
        school_id: schoolId,
        academic_year_id: academicYearId,
        status: 'active',
        enrolled_at: new Date().toISOString(),
      });
    }
  }

  async bulkTransferStudents(
    fromClassId: string,
    toClassId: string,
    schoolId: string,
    reason: string,
  ): Promise<void> {
    const { data: activeEnrollments } = await this.db
      .from('class_enrollments')
      .select('student_id, academic_year_id')
      .eq('class_id', fromClassId)
      .eq('status', 'active');

    if (!activeEnrollments) return;

    // Mark old enrollments as transferred
    await this.db.from('class_enrollments')
      .update({
        status: 'transferred',
        completed_at: new Date().toISOString(),
        reason: `Bulk transfer: class deleted. ${reason}`,
      })
      .eq('class_id', fromClassId)
      .eq('status', 'active');

    // Create new enrollments
    const newEnrollments = activeEnrollments.map(e => ({
      student_id: e.student_id,
      class_id: toClassId,
      school_id: schoolId,
      academic_year_id: e.academic_year_id,
      status: 'active',
    }));

    // Batch insert — partition into chunks of 50
    for (let i = 0; i < newEnrollments.length; i += 50) {
      const chunk = newEnrollments.slice(i, i + 50);
      await this.db.from('class_enrollments').insert(chunk);
    }

    // Update all students' class_id
    const studentIds = activeEnrollments.map(e => e.student_id);
    await this.db.from('students')
      .update({ class_id: toClassId, updated_at: new Date().toISOString() })
      .in('id', studentIds);
  }

  // ─── Statistics ─────────────────────────────────────────

  async getActiveStudentCount(classId: string): Promise<number> {
    const { count } = await this.db
      .from('class_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', 'active');
    return count ?? 0;
  }

  async getTotalStudentCount(classId: string): Promise<number> {
    const { count } = await this.db
      .from('class_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId);
    return count ?? 0;
  }

  async getAvailableCapacity(classId: string): Promise<number> {
    const { data } = await this.db
      .from('classes')
      .select('capacity')
      .eq('id', classId)
      .single();

    if (!data) return 0;
    const currentCount = await this.getActiveStudentCount(classId);
    return data.capacity - currentCount;
  }

  async getCapacityUtilization(classId: string): Promise<number> {
    const { data } = await this.db
      .from('classes')
      .select('capacity')
      .eq('id', classId)
      .single();
    if (!data || data.capacity === 0) return 0;
    const count = await this.getActiveStudentCount(classId);
    return Math.round((count / data.capacity) * 100);
  }

  async getGenderDistribution(classId: string): Promise<Record<string, number>> {
    const { data } = await this.db
      .from('class_enrollments')
      .select(`
        students!inner(
          users!inner(gender)
        )
      `)
      .eq('class_id', classId)
      .eq('status', 'active');

    const distribution: Record<string, number> = {};
    for (const enroll of data ?? []) {
      const gender = (enroll.students as any)?.users?.gender ?? 'unknown';
      distribution[gender] = (distribution[gender] ?? 0) + 1;
    }
    return distribution;
  }

  async getTeachersCount(classId: string): Promise<number> {
    const { count } = await this.db
      .from('teacher_class_subjects')
      .select('teacher_id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .is('deleted_at', null);
    return count ?? 0;
  }

  async getSubjectsCount(classId: string): Promise<number> {
    const { count } = await this.db
      .from('teacher_class_subjects')
      .select('subject_id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .is('deleted_at', null);
    return count ?? 0;
  }

  async getAverageAttendance(classId: string, termId?: string): Promise<number | null> {
    let query = this.db
      .from('attendance')
      .select('status', { count: 'exact', head: false })
      .eq('class_id', classId);

    if (termId) query = query.eq('academic_term_id', termId);

    const { data } = await query;
    if (!data || data.length === 0) return null;

    const present = data.filter(a => a.status === 'present' || a.status === 'late').length;
    return Math.round((present / data.length) * 100);
  }

  async getAssignmentsCount(classId: string): Promise<number> {
    const { count } = await this.db
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .is('deleted_at', null);
    return count ?? 0;
  }

  async getAverageCompletionRate(classId: string): Promise<number | null> {
    // ⚠️ Current implementation loads all assignments + submissions into JS memory.
    // For a class with 20 assignments × 50 students = 1,000 rows. Acceptable for
    // single-class stats (< 50ms), but should be refactored to a SQL aggregation
    // query for multi-class dashboards:
    //
    //   SELECT AVG(
    //     sub.submission_count::FLOAT / NULLIF(CE.student_count, 0)
    //   ) * 100
    //   FROM assignments A
    //   LEFT JOIN (
    //     SELECT assignment_id, COUNT(*) AS submission_count
    //     FROM submissions WHERE is_graded = TRUE
    //     GROUP BY assignment_id
    //   ) sub ON sub.assignment_id = A.id
    //   CROSS JOIN (
    //     SELECT COUNT(*) AS student_count
    //     FROM class_enrollments
    //     WHERE class_id = $1 AND status = 'active'
    //   ) CE
    //   WHERE A.class_id = $1 AND A.deleted_at IS NULL

    const { data } = await this.db
      .from('assignments')
      .select(`
        id,
        submissions!inner(id)
      `)
      .eq('class_id', classId)
      .is('deleted_at', null);

    if (!data || data.length === 0) return null;

    const totalAssignments = data.length;
    const totalSubmissions = data.reduce((sum: number, a: any) =>
      sum + (a.submissions?.length ?? 0), 0);

    const activeStudents = await this.getActiveStudentCount(classId);
    if (activeStudents === 0) return null;

    const expectedSubmissions = totalAssignments * activeStudents;
    if (expectedSubmissions === 0) return null;

    return Math.round((totalSubmissions / expectedSubmissions) * 100);
  }

  async hasAttendanceRecord(studentId: string, date: string): Promise<boolean> {
    const { data } = await this.db
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('date', date);
    return (data?.length ?? 0) > 0;
  }

  async findAcademicYear(yearId: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db
      .from('academic_years')
      .select('id, name')
      .eq('id', yearId)
      .eq('school_id', schoolId)
      .single();
    return data;
  }

  async findSubjectById(subjectId: string, schoolId: string): Promise<any | null> {
    const { data } = await this.db
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .eq('school_id', schoolId)
      .single();
    return data;
  }

  // ─── Parent Access ─────────────────────────────────────

  async getParentProfile(userId: string): Promise<{ id: string } | null> {
    const { data } = await this.db
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    return data;
  }

  async getParentStudentIds(parentId: string): Promise<string[]> {
    const { data } = await this.db
      .from('student_parents')
      .select('student_id')
      .eq('parent_id', parentId)
      .is('deleted_at', null);
    return data?.map(d => d.student_id) ?? [];
  }

  async getActiveEnrollmentsForStudents(
    studentIds: string[],
  ): Promise<Array<{ class_id: string; student_id: string }>> {
    if (studentIds.length === 0) return [];
    const { data } = await this.db
      .from('class_enrollments')
      .select('class_id, student_id')
      .in('student_id', studentIds)
      .eq('status', 'active');
    return data ?? [];
  }
}
```

---

## 6. API Routes

### 6.1 POST /classes — Create class

```typescript
// src/app/api/classes/route.ts

export async function POST(request: NextRequest) {
  try {
    const ctx = await authorize(request, ['school_admin']);
    const body = await request.json();
    const parsed = CreateClassSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VAL_001', message: 'Invalid input', details: parsed.error.flatten() } },
        { status: 422 },
      );
    }

    const service = createClassesService();
    const result = await service.createClass(ctx, parsed.data);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleClassError(error);
  }
}
```

### 6.2 GET /classes — List classes

```
GET /classes?academic_year_id=...&is_active=true&search=...&page=1&limit=20
Role: school_admin, principal, teacher (own classes), student (own), parent (children's)

Response: 200 { data: ClassResponse[], total: number, page: number, limit: number }
```

Scope enforcement:
- `school_admin` / `principal`: All classes in school
- `teacher`: Only classes they are assigned to via `teacher_class_subjects`
- `student`: Only their own class (from `students.class_id`)
- `parent`: Classes of their linked children

### 6.3 GET /classes/{id} — Get class detail

```
GET /classes/{id}
Role: school_admin, principal, teacher (own), student (own), parent (children's)

Response: 200 { data: ClassResponse }
Errors: 403 (not authorized), 404 (not found)
```

### 6.4 PATCH /classes/{id} — Update class

```
PATCH /classes/{id}
Role: school_admin

Request: { name?, section?, class_teacher_id?, room_number?, capacity?, is_active? }
Response: 200 { data: ClassResponse }
Errors: 400 (capacity conflict), 403, 404, 409 (duplicate name/section/year), 422
```

### 6.5 POST /classes/{id}/deactivate — Deactivate class (soft-delete)

```
POST /classes/{id}/deactivate
Role: school_admin

Request: {
  reason: string (min 10 chars),
  move_students_to_class_id?: UUID  // Required if students exist
}
Response: 200 { data: { message: 'Class deactivated', studentsMoved: true/false } }
Errors: 400 (active students without target), 409 (target at capacity), 422
```

### 6.6 POST /classes/{id}/assign-teacher — Assign teacher to class

```
POST /classes/{id}/assign-teacher
Role: school_admin

Request: {
  teacher_id: UUID,
  subject_ids: UUID[],
  is_class_teacher: boolean,
  academic_term_id: UUID
}
Response: 200 { data: { message: 'Teacher assigned' } }
Errors: 404 (teacher/subject/class not found), 422
```

### 6.7 POST /classes/{id}/remove-teacher — Remove teacher from class

```
POST /classes/{id}/remove-teacher
Role: school_admin

Request: {
  teacher_id: UUID,
  subject_ids?: UUID[],  // Omit to remove all
  reason?: string
}
Response: 200 { data: { message: 'Teacher removed' } }
Errors: 404, 422
```

### 6.8 GET /classes/{id}/roster — View class roster

```
GET /classes/{id}/roster?page=1&limit=50&sort_by=roll_number&sort_order=asc&search=...&status=active
Role: school_admin, principal, teacher (own), parent (children's)

Response: 200 { data: RosterResponse }
Errors: 403 (not authorized), 404
```

The roster returns all students currently enrolled in the class, with their profile information. Sorting options: `roll_number`, `first_name`, `last_name`, `admission_number`. The `status` filter can show historical enrollments.

### 6.9 POST /classes/move-student — Move student between classes

```
POST /classes/move-student
Role: school_admin, principal

Request: {
  student_id: UUID,
  target_class_id: UUID,
  reason?: string,
  transfer_date?: YYYY-MM-DD  // Default: today
}
Response: 200 { data: { message: 'Student moved', from: 'Class A', to: 'Class B' } }
Errors: 400 (mid-day attendance, duplicate class, full capacity), 404, 422
```

### 6.10 POST /classes/{id}/enroll — Bulk enroll students

```
POST /classes/{id}/enroll
Role: school_admin, principal

Request: { student_ids: UUID[] (1-100), academic_year_id: UUID }
Response: 200 { data: { succeeded: number, failed: number, errors: Array<{studentId, reason}> } }
Errors: 400 (capacity exceeded), 404, 422
```

### 6.11 GET /classes/{id}/statistics — Get class statistics

```
GET /classes/{id}/statistics?academic_term_id=...
Role: school_admin, principal, teacher (own), parent (children's)

Response: 200 { data: ClassStatistics }
Errors: 403, 404
```

### 6.12 Error Handler

```typescript
export function handleClassError(error: unknown): NextResponse {
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: { code: 'CLASS_404', message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: { code: 'CLASS_409', message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: { code: 'CLASS_400', message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: { code: 'CLASS_403', message: error.message } },
      { status: 403 },
    );
  }

  console.error('Unhandled class error:', error);
  return NextResponse.json(
    { error: { code: 'INT_001', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
```

---

## 7. Permissions & Scope

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create class | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit class | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete class | 🔶 | ❌ | ❌ | ❌ | ❌ |
| View class list | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View class detail | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View roster | ✅ | ✅ | 🔷 (own) | 🔷 (own) | 🔷 (children) |
| View statistics | ✅ | ✅ | 🔷 (own) | 📋 (own) | 🔷 (children) |
| Assign teacher | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove teacher | ✅ | ❌ | ❌ | ❌ | ❌ |
| Move student | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bulk enroll | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export roster | ✅ | ✅ | 🔷 (own) | ❌ | ❌ |

**Legend**: ✅ = Full access · 🔷 = Scoped access · ❌ = No access · 🔶 = Audit required · 📋 = Read-only

### 7.2 Scope Rules

| Rule | Enforcement | Method |
|------|-------------|--------|
| Teacher sees own classes only | `teacher_class_subjects.teacher_id == ctx.profileId` | Service-level query filter |
| Student sees own class only | `students.class_id` from student profile | Service-level filter |
| Parent sees children's classes | Join through `student_parents → students → class_enrollments` | Service-level query |
| Principal cannot create/edit/delete | `school_admin` role required for mutations | Route-level `@RequireRole('school_admin')` |
| Delete requires reason + capacity check | `DeleteClassSchema.reason` min 10 chars; active student check | Service-level validation |
| Move student requires reason | `MoveStudentSchema.reason` optional but recommended | Audit requirement |
| Teacher cannot move students | Only admin/principal can initiate moves | Route-level role check |

### 7.3 Permission Assertion Patterns

```typescript
// Pattern 1: Simple role check
await this.authz.assert(ctx, 'classes:create');
// → ctx.role must be 'school_admin'

// Pattern 2: Class-scoped view (teacher, student, parent)
await this.authz.assert(ctx, 'classes:view_roster', { classId });
// → Checks teacher_class_subjects / students.class_id / student_parents

// Pattern 3: Principal-scoped mutation
await this.authz.assert(ctx, 'classes:move_student');
// → ctx.role must be school_admin or principal

// Pattern 4: Statistics (aggregate data, no PII)
await this.authz.assert(ctx, 'classes:view_statistics', { classId });
// → Same scope as view_roster, but student gets limited stats
```

---

## 8. Audit Logging

### 8.1 Class Events

| Event | Trigger | Data Captured | Retention |
|-------|---------|---------------|-----------|
| `class:created` | New class created | name, section, capacity, academicYearId | Permanent |
| `class:updated` | Class fields changed | before/after: name, capacity, classTeacherId | 1 year |
| `class:deleted` | Soft-delete (admin only) | reason, studentsMovedTo, activeStudentCount | Permanent |
| `class:teacher_assigned` | Teacher assigned to subjects | teacherId, subjectIds, isClassTeacher, termId | Permanent |
| `class:teacher_removed` | Teacher removed from subjects | teacherId, subjectIds ('all' if removed all), reason | Permanent |
| `class:student_moved` | Student transferred between classes | fromClass, toClass, studentId, reason | Permanent |
| `class:bulk_enrollment` | Batch student enrollment | requested, succeeded, failed, error list (truncated) | 1 year |
| `class:enrollment_changed` | Individual enrollment status change | studentId, fromStatus, toStatus | 1 year |

### 8.2 Audit Enforcement Rules

```typescript
// Synchronous audit (critical events, permanent retention):
await this.audit.logSync({
  eventType: 'class:deleted',
  actorId: ctx.userId,
  resourceType: 'class',
  resourceId: classId,
  details: { reason, movedStudents },
  outcome: 'success',
});

// Fire-and-forget (standard events):
await this.audit.log({
  eventType: 'class:updated',
  actorId: ctx.userId,
  resourceType: 'class',
  resourceId: classId,
  details: { before, after },
  outcome: 'success',
});
```

---

## 9. Workflows

### 9.1 Create Class with Teacher Assignment

```
Admin                          API                         Database
  │                             │                            │
  │  POST /classes              │                            │
  │  { name, section, year,     │                            │
  │    teacher_id, capacity }   │                            │
  │ ──────────────────────────►│                            │
  │                             │ 1. Validate input (Zod)    │
  │                             │ 2. Check duplicate name    │
  │                             │    + section + year        │
  │                             │    ── SELECT classes ─────►│
  │                             │◄── null ──────────────────│
  │                             │                            │
  │                             │ 3. Verify teacher exists   │
  │                             │    ── SELECT teachers ────►│
  │                             │◄── Teacher ───────────────│
  │                             │                            │
  │                             │ 4. INSERT class            │
  │                             │    ── INSERT classes ─────►│
  │                             │◄── Class ────────────────│
  │                             │                            │
  │                             │ 5. INSERT teacher_subject  │
  │                             │    ── INSERT tcs ─────────►│
  │                             │                            │
  │                             │ 6. INSERT audit_logs       │
  │                             │    ── INSERT audit_logs ──►│
  │                             │                            │
  │◄── 201 { data: Class } ────│                            │
```

### 9.2 Move Student Between Classes

```
Admin                          API                        Database
  │                             │                            │
  │  POST /classes/move-student │                            │
  │  { student_id, target_id,   │                            │
  │    reason, date }           │                            │
  │ ──────────────────────────►│                            │
  │                             │ 1. Validate input          │
  │                             │ 2. Verify student exists   │
  │                             │    ── SELECT students ────►│
  │                             │◄── Student ──────────────│
  │                             │                            │
  │                             │ 3. Verify target class     │
  │                             │    ── SELECT classes ─────►│
  │                             │◄── Target class ─────────│
  │                             │                            │
  │                             │ 4. Find active enrollment  │
  │                             │    ── SELECT enrollments ─►│
  │                             │◄── Enrollment (Class A) ──│
  │                             │                            │
  │                             │ 5. Check capacity          │
  │                             │    ── SELECT capacity ────►│
  │                             │◄── Available: 5 ─────────│
  │                             │                            │
  │                             │ 6. Check attendance today  │
  │                             │    ── SELECT attendance ──►│
  │                             │◄── No record ────────────│
  │                             │                            │
  │                             │ 7. UPDATE enrollment       │
  │                             │    (mark Class A as        │
  │                             │     transferred)           │
  │                             │    ── UPDATE enrollments ─►│
  │                             │                            │
  │                             │ 8. INSERT enrollment       │
  │                             │    (Class B, active)       │
  │                             │    ── INSERT enrollments ─►│
  │                             │                            │
  │                             │ 9. UPDATE students         │
  │                             │    (class_id = Class B)    │
  │                             │    ── UPDATE students ────►│
  │                             │                            │
  │                             │ 10. Audit + EventBus       │
  │                             │                            │
  │◄── 200 { moved } ──────────│                            │
  │                             │                            │
  │  (Old teacher notified)     │                            │
  │  (New teacher notified)     │                            │
```

### 9.3 Delete Class with Student Move

```
Admin                          API                        Database
  │                             │                            │
  │  POST /classes/{id}/delete  │                            │
  │  { reason,                  │                            │
  │    move_to_class_id }       │                            │
  │ ──────────────────────────►│                            │
  │                             │ 1. Verify admin role       │
  │                             │ 2. Find active students    │
  │                             │    ── SELECT count ───────►│
  │                             │◄── 25 active students ────│
  │                             │                            │
  │                             │ 3. Verify target capacity  │
  │                             │    ── SELECT capacity ────►│
  │                             │◄── Available: 30 ────────│
  │                             │                            │
  │                             │ 4. Bulk transfer all       │
  │                             │    ── BATCH INSERT ───────►│
  │                             │    (Chunks of 50)          │
  │                             │                            │
  │                             │ 5. Remove teacher assigns  │
  │                             │    ── UPDATE tcs ─────────►│
  │                             │    (deleted_at = now)      │
  │                             │                            │
  │                             │ 6. Soft-delete class       │
  │                             │    ── UPDATE classes ─────►│
  │                             │    (deleted_at = now)      │
  │                             │                            │
  │                             │ 7. Audit + EventBus        │
  │                             │                            │
  │◄── 200 { deleted } ────────│                            │
```

---

## 10. Edge Cases

### Edge Case 1: Mid-Year Class Splitting

**Scenario**: A class has 60 students but admin wants to split into two sections (e.g., Grade 10 splits into 10A and 10B).

**Solution**: Admin creates a new class (10B), then moves 30 students to it using the bulk enrollment endpoint. The move-student endpoint handles individual transfers. For large splits, use bulk enroll with 2 calls (30 students each). Each transfer is audited independently.

**Risk**: Attendance records remain linked to the original class. After split, new attendance records go to the new class. Historical data stays with the original class — keep `class_enrollments` for accurate historical queries.

### Edge Case 2: Student Transferred Mid-Day

**Scenario**: Admin moves a student from Class A to Class B at 2 PM. Attendance for Class A was already marked at 8 AM.

**Solution**: The service checks for attendance records on the transfer date. If attendance exists, the transfer is rejected with a message: "Student already has an attendance record today. Transfer must take effect tomorrow." This prevents attendance data inconsistency.

**Alternative**: Admin can set `transfer_date` to tomorrow explicitly, allowing the move to be queued in advance.

### Edge Case 3: Teacher Leaves Mid-Term

**Scenario**: A class teacher resigns mid-term. All their class assignments must be reassigned.

**Solution**: Two-step process:
1. `POST /classes/{id}/remove-teacher` with the old teacher's ID and `subject_ids: ['all']`
2. `POST /classes/{id}/assign-teacher` with the new teacher's info

The `removeClassTeacher` service handles clearing the `class_teacher_id` from the classes table if applicable. All affected classes need individual updates. The event bus notifies the principal.

### Edge Case 4: Class Capacity Reduced Below Current Enrollment

**Scenario**: Admin changes capacity from 40 to 25 but 30 students are enrolled.

**Solution**: The `updateClass` service checks current active enrollment count before reducing capacity. If `newCapacity < currentEnrollment`, it returns a `ValidationError` with the message: "Cannot reduce capacity to {newCapacity}. Current enrollment is {currentCount}."

**Workaround**: Admin must move students out first, then reduce capacity.

### Edge Case 5: Deleting a Class with Active Teacher Assignments

**Scenario**: Admin deletes Class 10A. Teachers are still assigned to it.

**Solution**: The `deleteClass` service automatically calls `removeAllTeacherAssignments(classId)` which soft-deletes all `teacher_class_subjects` records. This prevents orphaned assignments.

**Risk**: If the class is accidentally deleted and later restored, teacher assignments are lost. Mitigation: soft-delete only; data can be recovered by admin.

### Edge Case 6: Student Enrolled in Two Classes (Constraint Violation)

**Scenario**: API bug or race condition tries to enroll a student in two classes in the same academic year.

**Solution**: Database-level `UNIQUE(student_id, academic_year_id)` constraint on `class_enrollments` prevents this. The `ON CONFLICT` behavior ensures only one enrollment exists. Additionally, the service checks `findEnrollmentByStudentYear` before every enrollment.

### Edge Case 7: Parent Views Roster of Child's Class

**Scenario**: Parent of student in Class 7A requests the roster.

**Solution**: The `listClasses` and `getRoster` endpoints scope parent access through the `student_parents` link table. The parent sees only the classes their children are enrolled in. The roster endpoint returns student names and basic info — NOT contact details, NOT other parents' data.

**Boundary**: A parent with children in different classes sees both classes. A parent with no children sees an empty list.

### Edge Case 8: Archived Academic Year

**Scenario**: Admin needs to view classes from 2024-25 (previous year).

**Solution**: The `listClasses` endpoint accepts `academic_year_id` as a filter. Classes are never deleted (soft-delete only). Previous year data is always available for read queries. Historical `class_enrollments` with `status = 'graduated'` or `'promoted'` are preserved.

### Edge Case 9: Concurrent Capacity Checks

**Scenario**: Two admins simultaneously enroll students in the same class, both seeing 5 available capacity slots.

**Solution**: Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) on the classes row during enrollment. The `getAvailableCapacity` method should run inside a transaction with `FOR UPDATE` to prevent race conditions. In practice, this is a low-frequency operation, so optimistic locking is sufficient.

### Edge Case 10: Roll Number Collision

**Scenario**: Student transfers into a class where their roll number is already taken.

**Solution**: The service allows roll numbers to be reassigned upon transfer. When moving a student, the old enrollment's roll number is freed. The new class's roll number assignment is handled as a separate operation (either auto-assign or admin chooses). The `UNIQUE(school_id, class_id, roll_number)` constraint prevents duplicates at the database level.

---

## 11. Scalability Review

### 11.1 Query Performance Analysis

| Query | Frequency | Complexity | Index Used | Expected P99 |
|-------|-----------|------------|------------|-------------|
| List classes (school) | 1000/day | 1 table, eq + is null | `idx_classes_school_year` | <10ms |
| Get class detail | 5000/day | 1 table + joins | PK index | <10ms |
| View roster (50 students) | 3000/day | 2 tables (enrollments + students/users) | `idx_ce_current_enrollments` | <50ms |
| Assign teacher | 200/day | 3 tables (check + insert) | PK + unique indexes | <100ms |
| Move student | 50/day | 5 tables (check + update + insert + audit) | Various PKs | <200ms |
| Statistics (aggregate) | 2000/day | 5+ tables (counts, joins) | Various PKs + cached | <500ms (cached: <10ms) |
| Delete class | 10/day | Multiple tables (update + bulk insert) | Various PKs | <2s |

### 11.2 Data Volume Projections

| Table | Rows (100 schools, 50K students) | Growth/Year | Partitioning |
|-------|---------------------------------|-------------|-------------|
| `classes` | 2,500 (25 classes/school × 100) | +500 (new year) | No |
| `class_enrollments` | 50,000 (one per student per year) | +50,000 | No |
| `teacher_class_subjects` | 25,000 (7 subjects × 25 classes × ~15 teachers) | +5,000 | No |
| `classes` archive | 50,000 (10 years × 5K rows) | Negligible | No |

All class-related tables are small (< 100K rows) and do not require partitioning. The `class_enrollments` table grows by ~50K rows/year — still manageable without partitioning for 5+ years.

### 11.3 Cache Strategy

| Cache Key | Data | TTL | Invalidation |
|-----------|------|-----|-------------|
| `class:{id}` | Class detail with teacher and academic year | 5 min | On update, delete |
| `class:{id}:roster` | Paginated roster (first 3 pages) | 1 min | On enroll, transfer, bulk enroll |
| `class:{id}:stats` | Statistics aggregation | 5 min | On enroll, unenroll |
| `class:{id}:teachers` | Teacher assignments | 10 min | On assign, remove |
| `teacher:{id}:classes` | Teacher's assigned class IDs | 5 min | On assign, remove |
| `school:{id}:classes:year:{yearId}` | Class list for school+year | 5 min | On create, delete |

**Total cache memory estimate**: < 10 MB at 100 schools — negligible.

### 11.4 Hot Paths

**Teacher Dashboard (highest frequency)**:
```
1. GET /classes (teacher scoped) → 1 query → cached
2. GET /classes/{id}/roster → 1 query → cached for 60s
3. GET /classes/{id}/statistics → 5 counts → cached for 5 min
```

**Parent Dashboard (moderate frequency)**:
```
1. GET /classes (parent scoped) → 2 queries (children → classes) → cached
2. GET /classes/{id}/roster → scope check through children → cached
```

**Admin Operations (low frequency, no caching)**:
```
1. POST /classes → 3-4 queries (validation + insert + audit)
2. POST /classes/move-student → 8-10 queries (validation + update + audit + events)
3. DELETE /classes → 10+ queries (students + capacity + transfer + assignments + audit)
```

### 11.5 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **Roster search scalability** | Wildcard search on 500+ student names with `ilike` | Add trigram index: `CREATE INDEX idx_users_name_trgm ON users USING gin(first_name gin_trgm_ops, last_name gin_trgm_ops);` |
| 2 | **Statistics aggregation over 5+ tables** | Dashboard loading 10 classes simultaneously | Cache statistics with 5-min TTL. Single class stats are fast (<50ms uncached). |
| 3 | **Bulk transfer during delete** | Moving 100+ students at once | Chunked inserts (50 per batch). Runs inside a single request (max 2s for 100 students). |
| 4 | **Concurrent enrollment checks** | Two admins enrolling simultaneously with stale capacity count | Use `SELECT ... FOR UPDATE` or Supabase's built-in transaction handling. |
| 5 | **Historical roster queries** | Querying enrollments from 5 years ago with no year filter | Default filter to current academic year. Explicit year filter required for historical. |

### 11.6 Index Recommendations

```sql
-- P0 (query performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_class_active ON class_enrollments(class_id, status)
    INCLUDE (student_id, enrolled_at) WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_classes_year_active ON classes(academic_year_id, is_active)
    INCLUDE (id, name, section, capacity) WHERE deleted_at IS NULL;

-- P1 (search performance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm ON users
    USING gin(first_name gin_trgm_ops, last_name gin_trgm_ops);

-- P2 (historical queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ce_student_history ON class_enrollments(student_id, academic_year_id, status)
    INCLUDE (class_id);
```

---

## 12. Testing Checklist

### 12.1 Unit Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| `create_class: valid` | All fields correct | Class created, audit logged | P0 |
| `create_class: duplicate name+section+year` | Same combo exists | 409 ConflictError | P0 |
| `create_class: teacher not found` | Invalid teacher_id | 404 NotFoundError | P1 |
| `create_class: missing required fields` | No name provided | 422 validation error | P1 |
| `update_class: valid` | Change name, capacity | Updated, audit logged | P0 |
| `update_class: capacity below enrollment` | 30 students, capacity 20 | 400 ValidationError | P0 |
| `update_class: class not found` | Invalid class_id | 404 | P1 |
| `update_class: non-admin caller` | Teacher calls endpoint | 403 | P0 |
| `delete_class: with student move` | 25 students, valid target | All transferred, class deleted | P0 |
| `delete_class: no students` | Empty class | Soft deleted immediately | P0 |
| `delete_class: students without target` | Has students, no target_id | 400 | P0 |
| `delete_class: target at capacity` | Target has 0 capacity | 409 | P1 |
| `assign_teacher: valid` | Teacher + 2 subjects | TCS records created, flag set | P0 |
| `assign_teacher: conflict with existing` | Teacher already assigned | Soft-overwrite | P1 |
| `assign_teacher: subject not found` | Invalid subject_id | 404 | P1 |
| `remove_teacher: all subjects` | Remove all | All records soft-deleted, class_teacher_id cleared | P0 |
| `remove_teacher: specific subjects` | Remove 2 of 4 | Only 2 records deleted | P1 |
| `get_roster: active students` | 30 active | Returns 30 students | P0 |
| `get_roster: with search` | Search "Sharma" | Filters matching students | P1 |
| `get_roster: teacher from other class` | Teacher accessing non-assigned class | 403 | P0 |
| `move_student: valid` | Complete transfer | Old done, new created, student updated | P0 |
| `move_student: same class` | target = current | 400 | P1 |
| `move_student: capacity full` | Target full | 400 | P0 |
| `move_student: has attendance today` | Attendace marked today | 400 | P0 |
| `move_student: student not enrolled` | No active enrollment | 400 | P1 |
| `bulk_enroll: 50 students` | All valid | 50 enrolled | P0 |
| `bulk_enroll: capacity exceeded` | 60 students, capacity 50 | 400 before any enrollment | P0 |
| `bulk_enroll: some already enrolled` | 10 of 50 already enrolled | Partial success with errors | P1 |
| `list_classes: teacher scoped` | Teacher with 3 classes | Only 3 returned | P0 |
| `list_classes: student scoped` | Student in 1 class | Only 1 returned, or empty | P0 |
| `list_classes: parent scoped` | Parent with 2 children in different classes | Both returned | P0 |
| `list_classes: admin scoped` | Admin | All school classes returned | P0 |
| `get_statistics: cached` | Multiple requests | Cached response after first | P1 |
| `get_statistics: teacher from other class` | Non-assigned teacher | 403 | P0 |

### 12.2 Integration Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Create class → Assign teacher → View roster | Full setup flow | All steps succeed, roster shows 0 students | P0 |
| Create student → Enroll in class → Verify roster | New enrollment flow | Student appears in roster | P0 |
| Move student → Verify old teacher loses access | Scope check | Old teacher cannot see student in roster | P0 |
| Create 2 classes → Bulk enroll 30 students each | Capacity utilization | Both classes at 30/40 | P1 |
| Delete class with student move → Verify teachers | Teacher assignments removed | No teacher_class_subjects for deleted class | P0 |
| Concurrent enrollments → Verify count | 5 parallel requests | Exactly 5 enrolled, no duplicates | P1 |
| Year-end promotion → Create new classes → Enroll | Academic year transition | Students carry forward to new year | P0 |

### 12.3 Security Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Teacher views non-assigned class roster | Different class_id | 403 | P0 |
| Student views other class roster | Different class_id | 403 or own class only | P0 |
| Parent views non-child class roster | Different class_id | 403 or children's classes only | P0 |
| Unauthenticated create class | No session | 401 | P0 |
| Cross-school class access | School A admin views School B class | 403 or empty | P0 |
| SQL injection in search parameter | `' OR 1=1--` | 422 or escaped (parameterized query) | P0 |
| Rate limit on bulk enroll | 10 rapid requests | 429 after 5 | P1 |
| Admin self-assign to class | Admin sets own ID as class_teacher | 400 (admin is not a teacher) | P1 |

### 12.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| List classes (25 classes) | <20ms (p95) | Indexed query |
| View roster (50 students) | <100ms (p95) | Composite index |
| Move student | <500ms (p95) | 5 table operations + audit |
| Bulk enroll 100 students | <2s | Chunked inserts |
| Statistics aggregation | <200ms (p95) | Cached after first request |
| Delete class with 50 student transfers | <3s | Chunked bulk operations |

---

## Appendix A: Error Codes

```typescript
export const CLASS_ERROR_CODES = {
  CLASS_400_01: { status: 400, message: 'Cannot reduce capacity below current enrollment' },
  CLASS_400_02: { status: 400, message: 'Student already in this class' },
  CLASS_400_03: { status: 400, message: 'Target class is at full capacity' },
  CLASS_400_04: { status: 400, message: 'Student not currently enrolled in any class' },
  CLASS_400_05: { status: 400, message: 'Student has attendance record today. Transfer must take effect tomorrow.' },
  CLASS_400_06: { status: 400, message: 'Active students exist. Provide move_students_to_class_id.' },
  CLASS_400_07: { status: 400, message: 'Admin is not a teacher. Cannot be class teacher.' },
  CLASS_400_08: { status: 400, message: 'Reason must be at least 10 characters for class deletion' },

  CLASS_403: { status: 403, message: 'You do not have access to this class' },

  CLASS_404_01: { status: 404, message: 'Class not found' },
  CLASS_404_02: { status: 404, message: 'Teacher not found' },
  CLASS_404_03: { status: 404, message: 'Student not found' },
  CLASS_404_04: { status: 404, message: 'Academic year not found' },
  CLASS_404_05: { status: 404, message: 'Subject not found' },
  CLASS_404_06: { status: 404, message: 'Target class not found' },

  CLASS_409: { status: 409, message: 'Class with this name, section, and year already exists' },

  CLASS_429: { status: 429, message: 'Too many requests. Max 5 bulk enrolls per minute.' },
} as const;
```

## Appendix B: Dependency Injection

```typescript
// src/modules/classes/classes.container.ts

export function createClassesService(): ClassesService {
  const db = createClient();
  const cache = new CacheManager();
  const eventBus = EventBus.getInstance();

  return new ClassesService(
    new ClassesRepository(db),
    new TeachersRepository(db),
    new StudentsRepository(db),
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
**Next Action**: Implement module scaffolding, run migration generation, and begin API endpoint development
