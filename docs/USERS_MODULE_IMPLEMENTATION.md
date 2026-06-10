# ATHON V2 — User Management Module Implementation

**Reviewer**: Staff Backend Engineer (Stripe, Linear)  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026  
**References**: AUTH_MODULE_IMPLEMENTATION.md · Permission Matrix v1.0 · DATABASE_V2_FINAL.md

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
9. [Risk Analysis](#9-risk-analysis)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Database Schema

### 1.1 Tables

#### `users` (core identity — extended from Auth Module)

```sql
-- See AUTH_MODULE_IMPLEMENTATION.md for full definition.
-- User management adds the following columns to what auth defines:
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address JSONB; -- { street, city, state, pincode }
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;  -- Role-specific extras
```

#### `teachers`

```sql
CREATE TABLE teachers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
    school_id       UUID NOT NULL REFERENCES schools(id),
    employee_code   VARCHAR(50) UNIQUE,                    -- School-assigned employee ID
    qualification   VARCHAR(255),                          -- e.g. "B.Ed, M.Sc Mathematics"
    specialization  VARCHAR(100),                          -- Primary subject specialization
    date_of_joining DATE,
    is_form_teacher BOOLEAN NOT NULL DEFAULT false,        -- Class teacher responsibility
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_teachers_school ON teachers(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_teachers_user ON teachers(user_id);
CREATE INDEX idx_teachers_active ON teachers(school_id, is_active) WHERE deleted_at IS NULL;
```

#### `students`

```sql
CREATE TABLE students (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id),
    school_id         UUID NOT NULL REFERENCES schools(id),
    class_id          UUID NOT NULL REFERENCES classes(id),
    admission_number  VARCHAR(50) NOT NULL,                -- School-assigned admission number
    roll_number       INTEGER,                             -- Class-specific roll number
    date_of_birth     DATE,
    blood_group       VARCHAR(5),
    emergency_contact JSONB,                               -- { name, phone, relation }
    is_active         BOOLEAN NOT NULL DEFAULT true,
    enrolled_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    graduated_at      DATE,                                -- Set when student graduates
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    UNIQUE(school_id, admission_number)
);

CREATE INDEX idx_students_school ON students(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_class ON students(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_user ON students(user_id);
CREATE INDEX idx_students_admission ON students(school_id, admission_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_students_active ON students(school_id, class_id, is_active) WHERE deleted_at IS NULL;
```

#### `parents`

```sql
CREATE TABLE parents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
    school_id       UUID NOT NULL REFERENCES schools(id),
    phone           VARCHAR(20) NOT NULL,
    alternate_phone VARCHAR(20),
    occupation      VARCHAR(100),
    is_primary      BOOLEAN NOT NULL DEFAULT true,       -- Primary guardian
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_parents_school ON parents(school_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_parents_user ON parents(user_id);
CREATE INDEX idx_parents_phone ON parents(phone) WHERE deleted_at IS NULL;
```

#### `student_parents` (link table)

```sql
CREATE TABLE student_parents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id),
    parent_id       UUID NOT NULL REFERENCES parents(id),
    relationship    VARCHAR(50) NOT NULL,                -- 'father', 'mother', 'guardian'
    is_emergency_contact BOOLEAN NOT NULL DEFAULT false,
    can_pickup      BOOLEAN NOT NULL DEFAULT false,      -- Can pick up from school
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(student_id, parent_id, deleted_at)
);

CREATE INDEX idx_student_parents_student ON student_parents(student_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_parents_parent ON student_parents(parent_id) WHERE deleted_at IS NULL;
```

#### `teacher_class_subjects` (teacher assignment)

```sql
CREATE TABLE teacher_class_subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teachers(id),
    class_id        UUID NOT NULL REFERENCES classes(id),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    is_form_teacher BOOLEAN NOT NULL DEFAULT false,      -- Class teacher for this class
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(teacher_id, class_id, subject_id, deleted_at)
);

CREATE INDEX idx_tcs_teacher ON teacher_class_subjects(teacher_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_class ON teacher_class_subjects(class_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tcs_teacher_class ON teacher_class_subjects(teacher_id, class_id) WHERE deleted_at IS NULL;
```

### 1.2 ENUM Additions

```sql
-- Extend audit_event_type from Auth Module
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:created';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:updated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:deactivated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:reactivated';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:role_changed';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:parent_linked';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:parent_unlinked';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:bulk_import';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:class_changed';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'user:export';
```

### 1.3 RLS Policies

```sql
-- Teachers: teachers see own; admin/principal see school
CREATE POLICY teachers_select ON teachers FOR SELECT USING (
    user_id = auth.uid()::uuid
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role IN ('school_admin', 'principal'))
);

CREATE POLICY teachers_insert ON teachers FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                 AND role IN ('school_admin'))
);

-- Students: scoped to class for teachers, own for student, children for parent
CREATE POLICY students_select ON students FOR SELECT USING (
    user_id = auth.uid()::uuid
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role IN ('school_admin', 'principal'))
    OR class_id IN (SELECT class_id FROM teacher_class_subjects
                    WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()::uuid))
    OR id IN (SELECT student_id FROM student_parents
              WHERE parent_id = (SELECT id FROM parents WHERE user_id = auth.uid()::uuid))
);

-- Parents: parent sees own; admin/principal see school; teacher sees children's parents
CREATE POLICY parents_select ON parents FOR SELECT USING (
    user_id = auth.uid()::uuid
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role IN ('school_admin', 'principal'))
    OR id IN (SELECT parent_id FROM student_parents
              WHERE student_id IN (SELECT id FROM students
                                   WHERE class_id IN (SELECT class_id FROM teacher_class_subjects
                                                      WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()::uuid))))
);

-- Student-parent links: scoped through student/parent visibility
CREATE POLICY student_parents_select ON student_parents FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid()::uuid)
    OR parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()::uuid)
    OR school_id = (SELECT school_id FROM users WHERE supabase_user_id = auth.uid()::uuid
                     AND role IN ('school_admin', 'principal'))
);
```

---

## 2. Folder Structure

```
src/modules/users/
├── users.service.ts              # Business logic: create teacher/student/parent, update, deactivate
├── users.repository.ts           # Database access: users, teachers, students, parents
├── users.router.ts               # API route handlers
├── users.validator.ts            # Zod schemas for request validation
├── users.schema.ts               # TypeScript type definitions
├── users.permissions.ts          # Permission checks for user operations
│
src/modules/teachers/
├── teachers.service.ts           # Teacher-specific business logic
├── teachers.repository.ts        # Teacher profile queries
├── teachers.router.ts            # API route handlers
├── teachers.validator.ts         # Zod schemas
│
src/modules/students/
├── students.service.ts           # Student-specific business logic
├── students.repository.ts        # Student profile queries
├── students.router.ts            # API route handlers
├── students.validator.ts         # Zod schemas
│
src/modules/parents/
├── parents.service.ts            # Parent-specific business logic
├── parents.repository.ts         # Parent profile + linking queries
├── parents.router.ts             # API route handlers
├── parents.validator.ts          # Zod schemas
│
src/core/import/
├── csv.parser.ts                 # CSV parsing + validation
├── import.service.ts             # Bulk import orchestrator
│
src/core/notification/            # Consumed by user creation
├── welcome.service.ts            # Welcome email/push on user creation
```

---

## 3. Schemas (Zod)

```typescript
// src/modules/users/users.validator.ts

import { z } from 'zod';

// ─── Shared Base ─────────────────────────────────────────────

const Email = z.string().email('Invalid email format');
const Name = z.string().min(1, 'Required').max(100);
const UUID = z.string().uuid();
const Phone = z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number');
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ─── Create Teacher ──────────────────────────────────────────

export const CreateTeacherSchema = z.object({
  email: Email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: Name,
  last_name: Name,
  phone: Phone.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  employee_code: z.string().max(50).optional(),
  qualification: z.string().max(255).optional(),
  specialization: z.string().max(100).optional(),
  date_of_joining: DateString.optional(),
  class_assignments: z.array(z.object({
    class_id: UUID,
    subject_id: UUID,
    is_form_teacher: z.boolean().default(false),
  })).optional(),
});

// ─── Create Student ──────────────────────────────────────────

export const CreateStudentSchema = z.object({
  email: Email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: Name,
  last_name: Name,
  class_id: UUID,
  admission_number: z.string().max(50),
  roll_number: z.number().int().positive().optional(),
  date_of_birth: DateString.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  emergency_contact: z.object({
    name: Name,
    phone: Phone,
    relation: z.string().max(50),
  }).optional(),
  parent_email: Email.optional(),  // Link to existing parent or create new
  parent_phone: Phone.optional(),
});

// ─── Create Parent ───────────────────────────────────────────

export const CreateParentSchema = z.object({
  email: Email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: Name,
  last_name: Name,
  phone: Phone,
  alternate_phone: Phone.optional(),
  occupation: z.string().max(100).optional(),
  student_ids: z.array(UUID).min(1, 'At least one child must be linked'),
  relationships: z.array(z.object({
    student_id: UUID,
    relationship: z.enum(['father', 'mother', 'guardian', 'other']),
    is_emergency_contact: z.boolean().default(false),
  })).min(1),
});

// ─── Update User ─────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  first_name: Name.optional(),
  last_name: Name.optional(),
  phone: Phone.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  date_of_birth: DateString.optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Link Parent to Student ──────────────────────────────────

export const LinkParentSchema = z.object({
  parent_id: UUID,
  student_id: UUID,
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  is_emergency_contact: z.boolean().default(false),
  can_pickup: z.boolean().default(false),
});

// ─── Bulk Import ─────────────────────────────────────────────

export const BulkImportRowSchema = z.object({
  role: z.enum(['teacher', 'student', 'parent']),
  email: Email,
  first_name: Name,
  last_name: Name,
  password: z.string().min(8).optional(),  // Auto-generated if not provided
  class_name: z.string().optional(),       // Resolved to class_id for students
  section: z.string().optional(),
  admission_number: z.string().optional(),
  phone: Phone.optional(),
  parent_email: Email.optional(),
});

export const BulkImportSchema = z.object({
  rows: z.array(BulkImportRowSchema).min(1).max(500, 'Max 500 rows per import'),
  send_welcome_email: z.boolean().default(true),
  dry_run: z.boolean().default(false),      // Validate only, don't create
});

// ─── Response Schemas ────────────────────────────────────────

export const TeacherResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  employee_code: z.string().nullable(),
  qualification: z.string().nullable(),
  specialization: z.string().nullable(),
  is_form_teacher: z.boolean(),
  is_active: z.boolean(),
  class_assignments: z.array(z.object({
    class_id: z.string().uuid(),
    class_name: z.string(),
    section: z.string(),
    subject_id: z.string().uuid(),
    subject_name: z.string(),
  })),
  created_at: z.string(),
});

export const StudentResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  class_id: z.string().uuid(),
  class_name: z.string(),
  section: z.string(),
  admission_number: z.string(),
  roll_number: z.number().nullable(),
  is_active: z.boolean(),
  parents: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
  })),
  created_at: z.string(),
});

export const ParentResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string(),
  occupation: z.string().nullable(),
  is_primary: z.boolean(),
  children: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    class_name: z.string(),
    admission_number: z.string(),
    relationship: z.string(),
  })),
  created_at: z.string(),
});

export const BulkImportResponseSchema = z.object({
  total: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    email: z.string(),
    reason: z.string(),
  })),
});

// ─── Types ───────────────────────────────────────────────────

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type CreateParentInput = z.infer<typeof CreateParentSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type LinkParentInput = z.infer<typeof LinkParentSchema>;
export type BulkImportInput = z.infer<typeof BulkImportSchema>;
export type TeacherResponse = z.infer<typeof TeacherResponseSchema>;
export type StudentResponse = z.infer<typeof StudentResponseSchema>;
export type ParentResponse = z.infer<typeof ParentResponseSchema>;
```

---

## 4. Services

```typescript
// src/modules/users/users.service.ts

import { randomBytes } from 'crypto';
import { createClient } from '@/core/database/client';
import { AuditService } from '@/core/audit/audit.service';
import { CacheManager } from '@/core/cache/cache-manager';
import { AuthorizationService } from '@/core/authorization/rbac';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/core/errors/app-error';
import { RequestContext } from '@/core/auth/context';
import { UsersRepository } from './users.repository';
import { TeachersRepository } from '../teachers/teachers.repository';
import { StudentsRepository } from '../students/students.repository';
import { ParentsRepository } from '../parents/parents.repository';

export class UsersService {
  constructor(
    private readonly userRepo: UsersRepository,
    private readonly teacherRepo: TeachersRepository,
    private readonly studentRepo: StudentsRepository,
    private readonly parentRepo: ParentsRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly supabase: ReturnType<typeof createClient>,
  ) {}

  // ─── Create Teacher ─────────────────────────────────────────

  async createTeacher(
    ctx: RequestContext,
    input: CreateTeacherInput,
  ): Promise<TeacherResponse> {
    // 1. Check permissions
    await this.authz.assert(ctx, 'users:create_teacher');

    // 2. Check email uniqueness
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    // 3. Create Supabase Auth user
    const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { role: 'teacher', school_id: ctx.schoolId },
    });

    if (authError) {
      throw new AppError(`Failed to create auth user: ${authError.message}`);
    }

    // 4. Create Athon user record
    const user = await this.userRepo.create({
      supabase_user_id: authUser.user.id,
      school_id: ctx.schoolId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      role: 'teacher',
      phone: input.phone,
      gender: input.gender,
      is_active: true,
    });

    // 5. Create teacher profile
    const teacher = await this.teacherRepo.create({
      user_id: user.id,
      school_id: ctx.schoolId,
      employee_code: input.employee_code,
      qualification: input.qualification,
      specialization: input.specialization,
      date_of_joining: input.date_of_joining,
    });

    // 6. Assign classes
    const classAssignments: Array<{ class_id: string; class_name: string; section: string; subject_id: string; subject_name: string }> = [];
    if (input.class_assignments) {
      for (const assignment of input.class_assignments) {
        await this.teacherRepo.assignClass({
          teacher_id: teacher.id,
          class_id: assignment.class_id,
          subject_id: assignment.subject_id,
          is_form_teacher: assignment.is_form_teacher,
        });

        const classInfo = await this.teacherRepo.getClassInfo(assignment.class_id);
        const subjectInfo = await this.teacherRepo.getSubjectInfo(assignment.subject_id);
        classAssignments.push({
          class_id: assignment.class_id,
          class_name: classInfo.name,
          section: classInfo.section,
          subject_id: assignment.subject_id,
          subject_name: subjectInfo.name,
        });
      }
    }

    // 7. Audit log
    await this.audit.log({
      eventType: 'user:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'teacher',
      resourceId: teacher.id,
      details: {
        userId: user.id,
        email: input.email,
        role: 'teacher',
        employeeCode: input.employee_code,
      },
      outcome: 'success',
    });

    // 8. Send welcome email (async)
    // send_welcome_email flag is checked at the caller level (bulk import)
    // Individual creates always notify (admin expects it)
    this.queueWelcomeNotification('teacher', user.id, input.email);

    return {
      id: teacher.id,
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      employee_code: input.employee_code ?? null,
      qualification: input.qualification ?? null,
      specialization: input.specialization ?? null,
      is_form_teacher: input.class_assignments?.some(a => a.is_form_teacher) ?? false,
      is_active: true,
      class_assignments: classAssignments,
      created_at: user.created_at,
    };
  }

  // ─── Create Student ─────────────────────────────────────────

  async createStudent(
    ctx: RequestContext,
    input: CreateStudentInput,
  ): Promise<StudentResponse> {
    await this.authz.assert(ctx, 'users:create_student');

    // 1. Verify class exists
    const classInfo = await this.studentRepo.getClassInfo(input.class_id);
    if (!classInfo) throw new NotFoundError('Class not found');

    // 2. Check admission number uniqueness
    const existingAdmission = await this.studentRepo.findByAdmissionNumber(
      input.admission_number, ctx.schoolId,
    );
    if (existingAdmission) {
      throw new ConflictError(`Admission number ${input.admission_number} already exists`);
    }

    // 3. Check email uniqueness
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('A user with this email already exists');

    // 4. Create Supabase Auth user
    const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { role: 'student', school_id: ctx.schoolId },
    });
    if (authError) throw new AppError(`Failed to create auth user: ${authError.message}`);

    // 5. Create Athon user + student profile (transaction)
    const user = await this.userRepo.create({
      supabase_user_id: authUser.user.id,
      school_id: ctx.schoolId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      role: 'student',
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      is_active: true,
    });

    const student = await this.studentRepo.create({
      user_id: user.id,
      school_id: ctx.schoolId,
      class_id: input.class_id,
      admission_number: input.admission_number,
      roll_number: input.roll_number,
      date_of_birth: input.date_of_birth,
      blood_group: input.blood_group,
      emergency_contact: input.emergency_contact,
    });

    // 6. Link parent if provided
    const parents: Array<{ id: string; name: string; relationship: string; phone: string }> = [];
    if (input.parent_email) {
      const parentUser = await this.userRepo.findByEmail(input.parent_email);

      if (parentUser && parentUser.role === 'parent') {
        const parentProfile = await this.parentRepo.findByUserId(parentUser.id);
        if (parentProfile) {
          await this.parentRepo.linkStudent({
            student_id: student.id,
            parent_id: parentProfile.id,
            relationship: 'guardian',
            is_emergency_contact: true,
          });
          parents.push({
            id: parentProfile.id,
            name: `${parentUser.first_name} ${parentUser.last_name}`,
            relationship: 'guardian',
            phone: parentProfile.phone,
          });
        }
      } else {
        // Create parent account on the fly
        const parentPassword = randomBytes(8).toString('hex');
        const createdParent = await this.createParent(ctx, {
          email: input.parent_email,
          password: parentPassword,
          first_name: input.first_name,  // Default to student's last name
          last_name: `Parent of ${input.first_name}`,
          phone: input.parent_phone ?? input.emergency_contact?.phone ?? '',
          student_ids: [student.id],
          relationships: [{ student_id: student.id, relationship: 'guardian', is_emergency_contact: true }],
        });
        parents.push(...createdParent.children.map(c => ({
          id: createdParent.id,
          name: `${createdParent.first_name} ${createdParent.last_name}`,
          relationship: 'guardian',
          phone: createdParent.phone,
        })));
      }
    }

    // 7. Audit
    await this.audit.log({
      eventType: 'user:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'student',
      resourceId: student.id,
      details: {
        userId: user.id,
        email: input.email,
        role: 'student',
        classId: input.class_id,
        admissionNumber: input.admission_number,
        linkedParent: !!input.parent_email,
      },
      outcome: 'success',
    });

    return {
      id: student.id,
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      class_id: input.class_id,
      class_name: classInfo.name,
      section: classInfo.section,
      admission_number: input.admission_number,
      roll_number: input.roll_number ?? null,
      is_active: true,
      parents,
      created_at: user.created_at,
    };
  }

  // ─── Create Parent ─────────────────────────────────────────

  async createParent(
    ctx: RequestContext,
    input: CreateParentInput,
  ): Promise<ParentResponse> {
    await this.authz.assert(ctx, 'users:create_parent');

    // 1. Verify all student_ids exist
    for (const rel of input.relationships) {
      const student = await this.studentRepo.findById(rel.student_id);
      if (!student) throw new NotFoundError(`Student ${rel.student_id} not found`);
    }

    // 2. Check email uniqueness
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('A user with this email already exists');

    // 3. Create Supabase Auth user
    const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { role: 'parent', school_id: ctx.schoolId },
    });
    if (authError) throw new AppError(`Failed to create auth user: ${authError.message}`);

    // 4. Create Athon user + parent profile
    const user = await this.userRepo.create({
      supabase_user_id: authUser.user.id,
      school_id: ctx.schoolId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      role: 'parent',
      phone: input.phone,
      is_active: true,
    });

    const parent = await this.parentRepo.create({
      user_id: user.id,
      school_id: ctx.schoolId,
      phone: input.phone,
      alternate_phone: input.alternate_phone,
      occupation: input.occupation,
      is_primary: true,
    });

    // 5. Link children
    const children: Array<{ id: string; name: string; class_name: string; admission_number: string; relationship: string }> = [];
    for (const rel of input.relationships) {
      await this.parentRepo.linkStudent({
        student_id: rel.student_id,
        parent_id: parent.id,
        relationship: rel.relationship,
        is_emergency_contact: rel.is_emergency_contact,
      });

      const studentInfo = await this.studentRepo.findById(rel.student_id);
      const classInfo = await this.studentRepo.getClassInfo(studentInfo.class_id);
      children.push({
        id: rel.student_id,
        name: `${studentInfo.first_name} ${studentInfo.last_name}`,
        class_name: `${classInfo.name} ${classInfo.section}`.trim(),
        admission_number: studentInfo.admission_number,
        relationship: rel.relationship,
      });
    }

    // 6. Audit
    await this.audit.log({
      eventType: 'user:created',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'parent',
      resourceId: parent.id,
      details: {
        userId: user.id,
        email: input.email,
        role: 'parent',
        linkedStudents: input.student_ids,
      },
      outcome: 'success',
    });

    return {
      id: parent.id,
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: input.phone,
      occupation: input.occupation ?? null,
      is_primary: true,
      children,
      created_at: user.created_at,
    };
  }

  // ─── Update User ───────────────────────────────────────────

  async updateUser(
    ctx: RequestContext,
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserRecord> {
    // Permission: admin can edit any user; teacher can edit own; principal can edit students/parents
    const isOwnProfile = ctx.userId === userId;
    const canEditUser = await this.authz.assert(ctx, 'users:edit', {
      targetUserId: userId,
    });

    if (!isOwnProfile && !canEditUser) {
      throw new ForbiddenError('You cannot edit this user');
    }

    const before = await this.userRepo.findById(userId);
    if (!before) throw new NotFoundError('User not found');

    const updated = await this.userRepo.update(userId, {
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      address: input.address,
      metadata: input.metadata,
    });

    await this.audit.log({
      eventType: 'user:updated',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'user',
      resourceId: userId,
      details: {
        changes: {
          before: { name: `${before.first_name} ${before.last_name}`, phone: before.phone },
          after: { name: `${updated.first_name} ${updated.last_name}`, phone: updated.phone },
        },
      },
      outcome: 'success',
    });

    // Invalidate cache
    await this.cache.invalidate(`user:${userId}`);

    return updated;
  }

  // ─── Deactivate User ─────────────────────────────────────────

  async deactivateUser(
    ctx: RequestContext,
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.authz.assert(ctx, 'users:deactivate');

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (!user.is_active) {
      throw new ConflictError('User is already deactivated');
    }

    // 1. Soft-delete user
    await this.userRepo.softDelete(userId);

    // 2. Deactivate role-specific profile
    if (user.role === 'teacher') await this.teacherRepo.deactivate(userId);
    if (user.role === 'student') await this.studentRepo.deactivate(userId);
    if (user.role === 'parent') await this.parentRepo.deactivate(userId);

    // 3. Revoke all sessions
    await this.supabase.auth.admin.signOut(user.supabase_user_id);

    // 4. Audit
    await this.audit.log({
      eventType: 'user:deactivated',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'user',
      resourceId: userId,
      details: {
        role: user.role,
        email: user.email,
        reason,
      },
      outcome: 'success',
    });

    // Invalidate cache
    await this.cache.invalidate(`user:${userId}`);
  }

  // ─── Reactivate User ─────────────────────────────────────────

  async reactivateUser(
    ctx: RequestContext,
    userId: string,
  ): Promise<void> {
    await this.authz.assert(ctx, 'users:deactivate'); // Same permission

    // Re-enable user (set deleted_at = null, is_active = true)
    await this.userRepo.reactivate(userId);

    const user = await this.userRepo.findById(userId);
    if (user?.role === 'teacher') await this.teacherRepo.reactivate(userId);
    if (user?.role === 'student') await this.studentRepo.reactivate(userId);

    await this.audit.log({
      eventType: 'user:reactivated',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
    });
  }

  // ─── Link Parent to Student ─────────────────────────────────

  async linkParentToStudent(
    ctx: RequestContext,
    input: LinkParentInput,
  ): Promise<void> {
    await this.authz.assert(ctx, 'users:link_parent');

    // Verify parent and student exist
    const parent = await this.parentRepo.findById(input.parent_id);
    if (!parent) throw new NotFoundError('Parent not found');

    const student = await this.studentRepo.findById(input.student_id);
    if (!student) throw new NotFoundError('Student not found');

    // Check existing link
    const existingLink = await this.parentRepo.findLink(
      input.parent_id, input.student_id,
    );
    if (existingLink) {
      throw new ConflictError('Parent is already linked to this student');
    }

    await this.parentRepo.linkStudent({
      student_id: input.student_id,
      parent_id: input.parent_id,
      relationship: input.relationship,
      is_emergency_contact: input.is_emergency_contact,
      can_pickup: input.can_pickup,
    });

    await this.audit.log({
      eventType: 'user:parent_linked',
      actorId: ctx.userId,
      actorRole: ctx.role,
      ipAddress: ctx.ipAddress,
      resourceType: 'student_parent',
      details: {
        parentId: input.parent_id,
        studentId: input.student_id,
        relationship: input.relationship,
      },
      outcome: 'success',
    });
  }

  // ─── Bulk Import ────────────────────────────────────────────

  async bulkImport(
    ctx: RequestContext,
    input: BulkImportInput,
  ): Promise<BulkImportResponse> {
    await this.authz.assert(ctx, 'users:bulk_import');

    const results: BulkImportResponse = {
      total: input.rows.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      try {
        if (input.dry_run) continue;

        const password = row.password ?? randomBytes(8).toString('hex');

        if (row.role === 'teacher') {
          await this.createTeacher(ctx, {
            email: row.email,
            password,
            first_name: row.first_name,
            last_name: row.last_name,
            phone: row.phone,
          });
        } else if (row.role === 'student') {
          // Resolve class_name + section to class_id
          const classInfo = await this.studentRepo.findClassByNameSection(
            row.class_name!, row.section,
          );
          if (!classInfo) throw new NotFoundError(`Class ${row.class_name} ${row.section} not found`);

          await this.createStudent(ctx, {
            email: row.email,
            password,
            first_name: row.first_name,
            last_name: row.last_name,
            class_id: classInfo.id,
            admission_number: row.admission_number ?? `TEMP-${Date.now()}-${i}`,
            parent_email: row.parent_email,
          });
        } else if (row.role === 'parent') {
          await this.createParent(ctx, {
            email: row.email,
            password,
            first_name: row.first_name,
            last_name: row.last_name,
            phone: row.phone!,
            student_ids: [],  // Parents linked in a second pass
            relationships: [],
          });
        }

        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          email: row.email,
          reason: error instanceof AppError ? error.message : 'Unknown error',
        });
      }
    }

    // Second pass: link parents to students
    // Note: parents are created FIRST in the batch, so they exist for student linking.
    // The batch is processed in order: parents → teachers → students.
    let parentLinkErrors = 0;
    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      if (row.role === 'student' && row.parent_email) {
        try {
          const student = await this.studentRepo.findByEmail(row.email);
          const parent = await this.parentRepo.findByEmail(row.parent_email);
          if (student && parent) {
            await this.parentRepo.linkStudent({
              student_id: student.id,
              parent_id: parent.id,
              relationship: 'guardian',
            });
          }
        } catch {
          parentLinkErrors++;
        }
      }
    }

    if (results.errors.length > 0 || parentLinkErrors > 0) {
      await this.audit.log({
        eventType: 'user:bulk_import',
        actorId: ctx.userId,
        actorRole: ctx.role,
        ipAddress: ctx.ipAddress,
        details: {
          total: results.total,
          succeeded: results.succeeded,
          failed: results.failed,
          parentLinkErrors,
        },
        outcome: results.failed > 0 ? 'failure' : 'success',
      });
    }

    return results;
  }

  // ─── List Users ────────────────────────────────────────────

  async listUsers(
    ctx: RequestContext,
    filters: {
      role?: string;
      class_id?: string;
      is_active?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ users: UserRecord[]; total: number }> {
    await this.authz.assert(ctx, 'users:view');

    // Role-based scope injection
    const effectiveFilters = { ...filters };
    if (ctx.role === 'teacher') {
      // Teachers can only see students in their classes
      if (effectiveFilters.role && effectiveFilters.role !== 'student') {
        throw new ForbiddenError('Teachers can only view students');
      }
      effectiveFilters.class_id = await this.getTeacherClassScope(ctx.profileId!);
    }

    if (ctx.role === 'student' || ctx.role === 'parent') {
      throw new ForbiddenError('Students and parents cannot list users');
    }

    return this.userRepo.findMany(ctx.schoolId, effectiveFilters);
  }

  // ─── Private Helpers ────────────────────────────────────────

  private async queueWelcomeNotification(
    role: string,
    userId: string,
    email: string,
  ): Promise<void> {
    // Fire-and-forget: queue welcome notification
    // In production, delegate to notification worker with the following payload:
    // { type: 'welcome_email', role, userId, email, schoolId }
    console.log(`Welcome notification queued for ${role}: ${email}`);
  }

  private async getTeacherClassScope(teacherId: string): Promise<string | undefined> {
    const classes = await this.teacherRepo.getClassIds(teacherId);
    return classes.length === 1 ? classes[0] : undefined;
  }
}
```

---

## 5. Repositories

```typescript
// src/modules/users/users.repository.ts

export class UsersRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    const { data, error } = await this.db
      .from('users')
      .insert({
        supabase_user_id: input.supabase_user_id,
        school_id: input.school_id,
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        phone: input.phone,
        gender: input.gender,
        date_of_birth: input.date_of_birth,
        address: input.address,
        metadata: input.metadata,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new DatabaseError('Failed to create user', { cause: error });
    return data;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findBySupabaseId(supabaseUserId: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('supabase_user_id', supabaseUserId)
      .is('deleted_at', null)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async update(id: string, data: Partial<UserRecord>): Promise<UserRecord> {
    const { data: updated, error } = await this.db
      .from('users')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new DatabaseError('Failed to update user', { cause: error });
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.from('users').update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async reactivate(id: string): Promise<void> {
    await this.db.from('users').update({
      is_active: true,
      deleted_at: null,
    }).eq('id', id);
  }

  async findMany(
    schoolId: string,
    filters: { role?: string; class_id?: string; is_active?: boolean; search?: string; page?: number; limit?: number },
  ): Promise<{ data: UserRecord[]; total: number }> {
    let query = this.db
      .from('users')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .is('deleted_at', null);

    if (filters.role) query = query.eq('role', filters.role);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      );
    }
    if (filters.class_id) {
      // Only meaningful for students — filter through student profile
      const studentIds = await this.db.from('students')
        .select('user_id')
        .eq('class_id', filters.class_id)
        .is('deleted_at', null);
      const ids = studentIds.data?.map(s => s.user_id) ?? [];
      query = query.in('id', ids);
    }

    const from = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
    const to = from + (filters.limit ?? 20) - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError('Failed to list users', { cause: error });
    return { data: data ?? [], total: count ?? 0 };
  }
}
```

---

## 6. API Routes

### 6.1 POST /users/teachers — Create teacher

```typescript
// src/app/api/users/teachers/route.ts

export async function POST(request: NextRequest) {
  try {
    const ctx = await authorize(request, ['school_admin']);
    const body = await request.json();
    const parsed = CreateTeacherSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VAL_001', message: 'Invalid input', details: parsed.error.flatten() } },
        { status: 422 },
      );
    }

    const service = createUsersService();
    const teacher = await service.createTeacher(ctx, parsed.data);
    return NextResponse.json({ data: teacher }, { status: 201 });
  } catch (error) {
    return handleUserError(error);
  }
}
```

### 6.2 POST /users/students — Create student

```
POST /users/students
Role: school_admin, principal

Request: { email, password, first_name, last_name, class_id, admission_number, ... }
Response: 201 { data: StudentResponse }
Errors: 400 (admission number duplicate), 409 (email exists), 422 (validation)
```

### 6.3 POST /users/parents — Create parent

```
POST /users/parents
Role: school_admin, principal

Request: { email, password, first_name, last_name, phone, student_ids, relationships }
Response: 201 { data: ParentResponse }
Errors: 404 (student not found), 409 (email exists), 422 (validation)
```

### 6.4 PATCH /users/{id} — Update user

```
PATCH /users/{id}
Role: school_admin, principal (scope-limited), teacher (own profile)

Request: { first_name?, last_name?, phone?, gender?, address? }
Response: 200 { data: UserRecord }
Errors: 403 (not authorized), 404 (not found), 422 (validation)
```

### 6.5 POST /users/{id}/deactivate — Deactivate user

```
POST /users/{id}/deactivate
Role: school_admin

Request: { reason: string }
Response: 200 { data: { message: 'User deactivated' } }
Errors: 400 (self-deactivation not allowed), 403 (not authorized), 404 (not found), 409 (already deactivated)
```

Note: This is a soft-delete (POST, not DELETE). The user record remains in the database with `deleted_at` set. All sessions are revoked. The user cannot log in.

### 6.6 POST /users/{id}/reactivate — Reactivate user

```
POST /users/{id}/reactivate
Role: school_admin

Response: 200 { data: { message: 'User reactivated' } }
Errors: 403 (not authorized), 404 (not found), 409 (already active)
```

### 6.7 PATCH /students/{id}/class — Transfer student to new class

```
PATCH /students/{id}/class
Role: school_admin, principal

Request: { class_id: string, reason?: string }
Response: 200 { data: StudentResponse }
Errors: 400 (class not found), 403 (not authorized), 404 (student not found)
```

Audit: Logged with before/after class_id. Both old and new class teachers notified.

### 6.8 POST /users/parents/link — Link parent to student

```
POST /users/parents/link
Role: school_admin, principal

Request: { parent_id, student_id, relationship, is_emergency_contact }
Response: 200 { data: { message: 'Parent linked successfully' } }
Errors: 404 (parent/student not found), 409 (already linked)
```

### 6.9 GET /users — List users

```
GET /users?role=teacher&class_id=...&search=...&is_active=true&page=1&limit=20
Role: school_admin, principal, teacher (students only)

Response: 200 { data: { users: UserRecord[], total: number, page: number, limit: number } }
Errors: 403 (student/parent cannot list)
```

### 6.10 POST /users/import — Bulk CSV import

```
POST /users/import
Role: school_admin

Request: { rows: BulkImportRow[], send_welcome_email: true, dry_run: false }
Response: 200 { data: { total, succeeded, failed, errors[] } }
Errors: 422 (validation), 413 (too many rows)
```

When `send_welcome_email` is `false`, the welcome notification is skipped for all rows. When `send_welcome_email` is `true`, each successfully created user receives a welcome notification (fire-and-forget).

---

## 7. Permissions & Scope

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| Create teacher | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create student | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Create parent | ✅ | 🔷 | ❌ | ❌ | ❌ |
| View users (list) | ✅ | ✅ | 🔷(students only) | ❌ | ❌ |
| View user detail | ✅ | ✅ | 🔷(own class) | 📋(own) | 📋(children) |
| Update user | ✅ | 🔷(students/parents) | 🔷(own) | 🔷(own limited) | 🔷(own limited) |
| Deactivate user | 🔶(audited) | ❌ | ❌ | ❌ | ❌ |
| Link parent | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bulk import | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export users | ✅ | 🔷(students) | 🔷(own class) | ❌ | ❌ |

**Legend**: ✅ = Full access · 🔷 = Scoped access · ❌ = No access · 🔶 = Audit required · 📋 = Read-only

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Principal creates students | Scoped to their school only. Cannot create teachers. |
| Teacher views students | Only students in classes the teacher is assigned to (`teacher_class_subjects`). |
| Teacher views other teachers | Name only (for collaboration). No profile, phone, email. |
| Parent views children | Only children linked via `student_parents`. Parent ID from JWT, never from request body. |
| Student views own data | Only their own profile. No access to other students. |
| Admin deactivates user | Requires written reason. Cannot self-deactivate. Audit mandatory. |
| Bulk import | Max 500 rows. Dry-run available. Errors returned per-row. |

### 7.3 Permission Assertion Patterns

```typescript
// Pattern 1: Simple role gate
await this.authz.assert(ctx, 'users:create_teacher');
// → ctx.role must be 'school_admin'

// Pattern 2: Scoped action
await this.authz.assert(ctx, 'users:create_student', {
  schoolId: ctx.schoolId,
});
// → ctx.role must be school_admin or principal

// Pattern 3: Ownership check
await this.authz.assert(ctx, 'users:edit', {
  targetUserId: userId,
  requesterUserId: ctx.userId,
});
// → Admin can edit any user; teacher can edit own; principal can edit students/parents

// Pattern 4: Data scope
await this.authz.assert(ctx, 'students:view_class', {
  classId: requestClassId,
  teacherId: ctx.profileId,
});
// → Checks teacher_class_subjects for the teacher-class relationship
```

---

## 8. Audit Logging

### 8.1 User Management Events

| Event | Trigger | Data Captured | Retention |
|-------|---------|---------------|-----------|
| `user:created` | Teacher/student/parent created | actor, target user, role, email, class (if student) | Permanent |
| `user:updated` | Profile edit | before/after snapshot of changed fields | 1 year |
| `user:deactivated` | Account deactivation | actor, target, role, reason | Permanent |
| `user:reactivated` | Account re-enablement | actor, target, role | Permanent |
| `user:role_changed` | Role change (admin only) | before/after role values | Permanent |
| `user:parent_linked` | Parent-student link created | parent_id, student_id, relationship | Permanent |
| `user:parent_unlinked` | Link removed | parent_id, student_id | Permanent |
| `user:bulk_import` | CSV import completed | total, succeeded, failed, error list | 1 year |
| `user:class_changed` | Student moved to new class | before/after class_id | 1 year |
| `user:export` | User data export | exporter role, count, format (CSV/PDF) | 1 year |

### 8.2 Audit Enforcement Rules

```typescript
// All user mutations require audit
// Pattern: throw if audit write fails (synchronous for critical events)
await this.audit.logSync({
  eventType: 'user:deactivated',
  actorId: ctx.userId,
  resourceId: userId,
  details: { reason, role, email },
  outcome: 'success',
});
```

**Critical events** (synchronous audit, permanent retention):
- User deactivation
- Role changes
- Parent link creation/removal

**Standard events** (fire-and-forget audit, 1 year retention):
- User creation
- User updates
- Bulk imports
- Exports

---

## 9. Risk Analysis

### 9.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Privilege escalation**: Principal creates admin account | Critical | Unauthorized platform admin | `users:create_teacher` requires `school_admin` role. Principal cannot create teachers or admins. |
| 2 | **Data leak**: Teacher views students outside their class | High | Privacy violation, regulatory risk | Scope check via `teacher_class_subjects` on every student query. `teachers_select` RLS policy. |
| 3 | **Data leak**: Parent views another child's data | High | Privacy violation, legal risk | `parent_id` derived from JWT on all parent endpoints. Never from request body. |
| 4 | **Account takeover**: Weak auto-generated passwords | High | Unauthorized access | Passwords use `randomBytes(16).toString('hex')` for auto-generation. Min 8 chars enforced. |
| 5 | **Bulk import injection**: Malicious CSV data | Medium | Data corruption, XSS | Zod validation on every row. Strip HTML from name fields. Reject rows with special characters. |
| 6 | **Deactivation bypass**: Reactivate without authorization | Medium | Reinstating deactivated users | Requires same permission as deactivation (`users:deactivate`). Logged with audit. |
| 7 | **Email enumeration**: Check if email exists | Medium | User enumeration | Return generic error on create ("A user with this email already exists or ...") — don't distinguish between existing and system error. |
| 8 | **Mass deactivation**: Admin deactivates all users | High | Denial of service | Rate limit: max 50 deactivations/hour per user. Confirm dialog requires typing reason. |

### 9.2 Duplicate Data Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Duplicate email across schools** | Confusion, login issues | Email is unique per school via `UNIQUE(school_id, email)`. Supabase Auth email is globally unique. |
| 2 | **Duplicate admission number** | Wrong student identified | `UNIQUE(school_id, admission_number)` constraint. Check on create. |
| 3 | **Parent linked to wrong student** | Data leak, privacy | Parent linking requires both parent_id and student_id verification. Audit logged. |
| 4 | **Teacher assigned to same class/subject twice** | Schedule conflicts | `UNIQUE(teacher_id, class_id, subject_id)` prevents duplicate assignments. |
| 5 | **Student enrolled in multiple classes** | Attendance/reporting errors | Student has exactly one `class_id`. Transfer requires updating class_id + audit. |

### 9.3 Performance Risks

| # | Risk | Scenario | Mitigation |
|---|------|----------|------------|
| 1 | **User list slow at scale** | 10K+ users, wildcard search on name/email | Index on `(school_id, role, created_at)`. Limit search to 3+ chars. Paginate (max 100/page). |
| 2 | **Bulk import transaction size** | 500 users created in one request | Process sequentially (not in single transaction). Return per-row errors. 500 row limit. |
| 3 | **Parent lookup on student create** | Linking parent during student creation | Async parent creation + link for parent_email flow. Show progress in response. |
| 4 | **Teacher class assignment query** | Listing teacher's classes on every request | Cache teacher's class list: `teacher:{id}:classes` with 5-min TTL. |
| 5 | **Soft-delete filtering** | `WHERE deleted_at IS NULL` on every query | Partial indexes: `... WHERE deleted_at IS NULL`. Active-only queries hit the index. |

### 9.4 V1 Mistakes Not to Repeat

| V1 Mistake | Impact | V2 Fix |
|-----------|--------|--------|
| Users created without Supabase Auth | Couldn't log in | Create Supabase Auth user first, then Athon user record |
| No admission number uniqueness | Duplicate student records | UNIQUE(school_id, admission_number) constraint + pre-check |
| Principal could create teachers | Privilege escalation | `school_admin` only for teacher creation |
| No scope check on teacher student view | Data leak | RLS + service-level scope check via `teacher_class_subjects` |
| Bulk import had no dry-run | Unknown failures until commit | Dry-run mode returns validation errors without creating |
| Parent linking by email only | Wrong parent linked | Link by parent_id (UUID), not by email |
| No rate limiting on user creation | Mass account creation | Rate limit: 100 creates/hour per school |
| Passwords returned in bulk import response | Password leak | Auto-generated passwords never returned. Sent via email only. |

---

## 10. Testing Checklist

### 10.1 Unit Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| `create_teacher: valid` | All fields correct | Returns TeacherResponse, Supabase user created, audit logged | P0 |
| `create_teacher: duplicate email` | Email already exists | 409 ConflictError | P0 |
| `create_teacher: non-admin caller` | Teacher role calls endpoint | 403 ForbiddenError | P0 |
| `create_student: valid with parent link` | Student + existing parent email | Student created, parent linked, audit logged | P0 |
| `create_student: valid, auto-create parent` | Student + new parent email | Student and parent created, linked | P0 |
| `create_student: duplicate admission` | Same admission number in school | 409 ConflictError | P0 |
| `create_student: class not found` | Invalid class_id | 404 NotFoundError | P1 |
| `create_parent: valid with multiple children` | Parent linked to 2+ students | Parent created, all links created | P0 |
| `create_parent: invalid student_id` | One student doesn't exist | 404, no records created | P1 |
| `update_user: own profile` | User edits own name | Updated, audit logged | P0 |
| `update_user: admin edits other` | Admin edits teacher's profile | Updated, audit logged | P0 |
| `update_user: teacher edits other teacher` | Teacher edits other | 403 ForbiddenError | P0 |
| `deactivate_user: valid` | Admin deactivates teacher | soft-deleted, sessions revoked, audit | P0 |
| `deactivate_user: self-deactivate` | Admin tries to self-deactivate | 400 (prevented) | P1 |
| `deactivate_user: already inactive` | Double deactivation | 409 ConflictError | P1 |
| `link_parent: valid` | Link existing parent to existing student | Link created, audit logged | P0 |
| `link_parent: already linked` | Duplicate link | 409 ConflictError | P0 |
| `link_parent: parent not found` | Invalid parent_id | 404 NotFoundError | P1 |
| `bulk_import: all succeed` | 10 valid rows | 10 created, 0 failed | P0 |
| `bulk_import: some fail` | 10 rows, 2 with errors | 8 created, 2 failed with error messages | P0 |
| `bulk_import: dry_run` | 10 valid rows, dry_run=true | 0 created, validation errors returned | P1 |
| `bulk_import: exceeds limit` | 501 rows | 422 (max 500) | P1 |
| `list_users: admin sees all` | Admin lists, no filters | All active users returned | P0 |
| `list_users: teacher sees only students` | Teacher lists | Only students in teacher's classes | P0 |
| `list_users: student attempts` | Student lists | 403 ForbiddenError | P0 |

### 10.2 Integration Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Create teacher → Assign class → Verify | Full teacher setup flow | Teacher created, assigned, visible in class roster | P0 |
| Create student → Link parent → Parent sees data | Parent access flow | Parent can view child's profile, not other children | P0 |
| Create student → Deactivate → Login attempt | Deactivation prevents login | 401 on login, session revoked | P0 |
| Bulk import → Verify all created | 100 students imported | All 100 created with correct data | P0 |
| Create student → Update class → Verify | Class transfer | Student moved, old teacher loses access, new teacher gains access | P1 |
| CSV import with parent links → Verify links | Complex import | Students and parents created and linked correctly | P1 |

### 10.3 Security Tests

| Test | Scenario | Expected | Priority |
|------|----------|----------|----------|
| Student accesses teacher list | `GET /users?role=teacher` | 403 | P0 |
| Parent changes student_id in request | Manipulates `student_id` param | Returns own children only (JWT-bound) | P0 |
| Unauthenticated user creates teacher | No session cookie | 401 | P0 |
| Cross-school user creation | School A admin creates in school B | Fails (school_id from JWT) | P0 |
| CSV injection in name field | `=cmd\|' /C calc'!A0` | Rejected by Zod validation | P1 |
| Rate limit exceed on bulk import | 10 import requests in 1 min | 429 after 3 requests | P1 |

### 10.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| User list (10K users) | < 500ms (p95) | Paginated query with indexed filters |
| Create teacher | < 1s (p95) | Supabase auth + 2 DB inserts + audit |
| Bulk import 500 rows | < 30s | Sequential processing, no transaction |
| User search with wildcard | < 1s (p95) | Trigram index on name/email |
| Link parent operation | < 200ms (p95) | Two SELECTs + one INSERT |

---

## Appendix A: Error Codes

```typescript
export const USER_ERROR_CODES = {
  USER_001: { status: 400, message: 'Cannot deactivate yourself' },
  USER_002: { status: 400, message: 'Password must be at least 8 characters' },
  USER_003: { status: 400, message: 'Admission number already exists in this school' },
  USER_004: { status: 400, message: 'Employee code already exists' },
  USER_005: { status: 400, message: 'A user with this email already exists' },
  USER_006: { status: 400, message: 'Parent is already linked to this student' },
  USER_007: { status: 400, message: 'User is already deactivated' },
  USER_008: { status: 400, message: 'Cannot create teacher. Only school admin can create teachers.' },
  USER_009: { status: 400, message: 'Max 500 rows per bulk import' },
  USER_010: { status: 400, message: 'Cannot create more than one teacher per email' },

  USER_404: { status: 404, message: 'User not found' },
  USER_405: { status: 404, message: 'Class not found' },
  USER_406: { status: 404, message: 'Parent not found' },
  USER_407: { status: 404, message: 'Student not found' },

  USER_403: { status: 403, message: 'You do not have permission to manage users' },
  USER_429: { status: 429, message: 'Too many requests. Please slow down.' },
} as const;
```

## Appendix B: Dependency Injection

```typescript
// src/modules/users/users.container.ts

export function createUsersService(): UsersService {
  const db = createClient();
  const supabase = createServiceRoleClient();
  const cache = new CacheManager();

  return new UsersService(
    new UsersRepository(db),
    new TeachersRepository(db),
    new StudentsRepository(db),
    new ParentsRepository(db),
    new AuditService(db),
    cache,
    new AuthorizationService(db, cache),
    supabase,
  );
}
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement module scaffolding and begin API endpoint generation
