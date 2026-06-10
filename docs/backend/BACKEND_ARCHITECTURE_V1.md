# ATHON V2 — Backend Architecture

**Reviewers**: Staff Backend Engineer (Stripe, Linear)  
**Date**: June 10, 2026  
**Stack**: Next.js · TypeScript · Supabase · PostgreSQL · OpenAI · Redis  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**References**: DATABASE_V2_FINAL.md · API Spec v2.0 · Permission Matrix v1.0 · Security Model v1.0

---

## Table of Contents

1. [Final Folder Structure](#1-final-folder-structure)
2. [Module Boundaries](#2-module-boundaries)
3. [Repository Pattern](#3-repository-pattern)
4. [Service Layer Architecture](#4-service-layer-architecture)
5. [Validation Architecture](#5-validation-architecture)
6. [Authorization Architecture](#6-authorization-architecture)
7. [Error Handling Architecture](#7-error-handling-architecture)
8. [Background Jobs](#8-background-jobs)
9. [Caching Strategy](#9-caching-strategy)
10. [File Upload Architecture](#10-file-upload-architecture)
11. [Production Deployment Architecture](#11-production-deployment-architecture)

---

## 1. Final Folder Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (providers, fonts, metadata)
│   │   ├── page.tsx                      # Landing / login redirect
│   │   └── (auth)/
│   │       ├── login/page.tsx
│   │       └── forgot-password/page.tsx
│   │
│   ├── modules/                          # ← CORE ARCHITECTURE DECISION
│   │   ├── auth/                         # Authentication
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.validator.ts
│   │   │   ├── auth.schema.ts            # Zod schemas
│   │   │   ├── auth.middleware.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── users/                        # User management
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── users.router.ts
│   │   │   ├── users.validator.ts
│   │   │   ├── users.schema.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── teachers/                     # Teacher profiles
│   │   │   ├── teachers.service.ts
│   │   │   ├── teachers.repository.ts
│   │   │   ├── teachers.router.ts
│   │   │   ├── teachers.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── students/                     # Student profiles
│   │   │   ├── students.service.ts
│   │   │   ├── students.repository.ts
│   │   │   ├── students.router.ts
│   │   │   ├── students.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── parents/                      # Parent profiles
│   │   │   ├── parents.service.ts
│   │   │   ├── parents.repository.ts
│   │   │   ├── parents.router.ts
│   │   │   ├── parents.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── classes/                      # Class groups
│   │   │   ├── classes.service.ts
│   │   │   ├── classes.repository.ts
│   │   │   ├── classes.router.ts
│   │   │   ├── classes.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── subjects/                     # Academic subjects
│   │   │   ├── subjects.service.ts
│   │   │   ├── subjects.repository.ts
│   │   │   ├── subjects.router.ts
│   │   │   ├── subjects.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── curriculum/                   # Chapters, topics, LOs
│   │   │   ├── curriculum.service.ts
│   │   │   ├── curriculum.repository.ts
│   │   │   ├── curriculum.router.ts
│   │   │   ├── curriculum.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── attendance/                   # Attendance marking
│   │   │   ├── attendance.service.ts
│   │   │   ├── attendance.repository.ts
│   │   │   ├── attendance.router.ts
│   │   │   ├── attendance.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── announcements/                # School announcements
│   │   │   ├── announcements.service.ts
│   │   │   ├── announcements.repository.ts
│   │   │   ├── announcements.router.ts
│   │   │   ├── announcements.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── assignments/                  # Unified assignments + questions
│   │   │   ├── assignments.service.ts
│   │   │   ├── assignments.repository.ts
│   │   │   ├── assignments.router.ts
│   │   │   ├── assignments.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── submissions/                  # Submissions + answers
│   │   │   ├── submissions.service.ts
│   │   │   ├── submissions.repository.ts
│   │   │   ├── submissions.router.ts
│   │   │   ├── submissions.validator.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── notifications/                # Notifications + recipients
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.repository.ts
│   │   │   ├── notifications.router.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── ai/                           # AI generation + doubt assistant
│   │   │   ├── ai.service.ts
│   │   │   ├── ai.repository.ts
│   │   │   ├── ai.router.ts
│   │   │   ├── ai.validator.ts
│   │   │   ├── ai.provider.ts            # OpenAI client wrapper
│   │   │   └── __tests__/
│   │   │
│   │   ├── analytics/                    # Dashboards + risk detection
│   │   │   ├── analytics.service.ts
│   │   │   ├── analytics.repository.ts
│   │   │   ├── analytics.router.ts
│   │   │   └── __tests__/
│   │   │
│   │   └── timetable/                    # Timetable slots + entries
│   │       ├── timetable.service.ts
│   │       ├── timetable.repository.ts
│   │       ├── timetable.router.ts
│   │       ├── timetable.validator.ts
│   │       └── __tests__/
│   │
│   ├── core/                             # Cross-cutting concerns
│   │   ├── database/
│   │   │   ├── client.ts                 # Supabase client (server-side)
│   │   │   ├── migrations/               # SQL migration files
│   │   │   └── seed/                     # Seed data scripts
│   │   │
│   │   ├── auth/
│   │   │   ├── session.ts                # Server-side session handling
│   │   │   ├── middleware.ts             # Next.js middleware (route protection)
│   │   │   └── providers.ts             # Auth providers configuration
│   │   │
│   │   ├── authorization/
│   │   │   ├── rbac.ts                   # Role-based access control
│   │   │   ├── scoping.ts               # Data scope enforcement
│   │   │   └── policies/                # Per-module permission policies
│   │   │       ├── attendance.policy.ts
│   │   │       ├── assignments.policy.ts
│   │   │       └── ...
│   │   │
│   │   ├── validation/
│   │   │   ├── zod.ts                    # Zod utility schemas
│   │   │   ├── pagination.ts            # Pagination validation
│   │   │   └── enrichment.ts            # UUID validation, date ranges
│   │   │
│   │   ├── errors/
│   │   │   ├── app-error.ts              # Base AppError class
│   │   │   ├── error-catalog.ts          # All error codes
│   │   │   └── error-handler.ts          # Global error handler
│   │   │
│   │   ├── cache/
│   │   │   ├── redis.ts                  # Redis client
│   │   │   ├── cache-manager.ts          # Cache abstraction
│   │   │   └── invalidation.ts          # Cache invalidation triggers
│   │   │
│   │   ├── queue/
│   │   │   ├── queue.ts                  # Queue client (Bull/BullMQ)
│   │   │   ├── workers/                  # Background job workers
│   │   │   └── jobs/                     # Job definitions
│   │   │
│   │   ├── logger/
│   │   │   ├── logger.ts                 # Structured logging
│   │   │   └── middleware.ts            # Request logging middleware
│   │   │
│   │   ├── audit/
│   │   │   ├── audit.service.ts          # Audit logging service
│   │   │   └── audit.middleware.ts       # Auto-audit middleware
│   │   │
│   │   ├── storage/
│   │   │   ├── storage.service.ts        # File upload abstraction
│   │   │   └── providers/               # S3, local, etc.
│   │   │
│   │   └── config/
│   │       ├── env.ts                    # Environment variables
│   │       └── app.ts                    # App configuration
│   │
│   └── middleware.ts                      # Global middleware (auth, logging, rate-limit)
│
├── workers/                               # Separate worker process
│   ├── index.ts                           # Worker entry point
│   ├── risk-detection.worker.ts           # Student risk detection
│   ├── notification.worker.ts             # Notification delivery
│   ├── progress-refresh.worker.ts         # MV refresh
│   ├── curriculum-seed.worker.ts          # CBSE curriculum seeding
│   └── parent-summary.worker.ts           # Weekly parent summary generation
│
├── scripts/                               # One-off scripts
│   ├── seed-curriculum.ts
│   └── migrate-v1-to-v2.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── supabase/
│   ├── config.toml                        # Supabase local config
│   └── migrations/                        # Supabase SQL migrations
│
├── .env.example
├── .env.local
├── next.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
└── docker-compose.yml
```

### 1.1 File Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `{module}.service.ts` | `assignments.service.ts` | Business logic |
| `{module}.repository.ts` | `assignments.repository.ts` | Data access |
| `{module}.router.ts` | `assignments.router.ts` | Route definitions (Next.js App Router handlers) |
| `{module}.validator.ts` | `assignments.validator.ts` | Zod validation schemas |
| `{module}.schema.ts` | `assignments.schema.ts` | TypeScript type definitions |
| `{module}.middleware.ts` | `auth.middleware.ts` | Module-specific middleware |
| `{module}.policy.ts` | `assignments.policy.ts` | Permission policies |
| `{module}.provider.ts` | `ai.provider.ts` | External service integration |

### 1.2 RequestContext Type

```typescript
// src/core/auth/context.ts

// This type is used by every service method. Defined once, referenced everywhere.
export interface RequestContext {
  /** Supabase Auth user ID (from JWT subject claim) */
  userId: string;

  /** School UUID — set by school context middleware */
  schoolId: string;

  /** User role — one of: school_admin, principal, teacher, student, parent */
  role: UserRole;

  /** Profile ID — the {role}s table PK for this user (teacher_id, student_id, etc.) */
  profileId: string;

  /** User's email address (from auth provider) */
  email: string;

  /** Current academic term UUID (set by middleware, refreshed from cache) */
  currentTermId: string;

  /** Unique request identifier for tracing */
  requestId: string;

  /** ISO timestamp when the request started */
  timestamp: string;
}
```

### 1.3 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Module-per-domain** (not file-per-layer) | Each module is self-contained. Easier to reason about, test, and eventually extract into microservices. |
| **Next.js App Router + Server Actions** | For a school OS, server-rendered pages with progressive enhancement are more appropriate than a full SPA. Fewer moving parts. |
| **Supabase as backend platform** | Auth, database, storage, and realtime in one product. Reduces DevOps burden for a small team. |
| **BullMQ for background jobs** | Mature, Redis-backed queue with good TypeScript support. |
| **Centralized `core/` directory** | Cross-cutting concerns (auth, errors, caching) live in one place. Modules import from `core/`, never from other modules. |
| **No shared entities directory** | Each module owns its types. Cross-module types live in `core/`. Prevents dependency spaghetti. |

---

## 2. Module Boundaries

### 2.1 Module Dependency Graph

```
                    ┌──────────┐
                    │   auth   │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │   users   │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐   ┌──────▼──────┐  ┌────▼─────┐
    │ teachers│   │  students   │  │ parents  │
    └────┬────┘   └──────┬──────┘  └────┬─────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐   ┌──────▼──────┐  ┌────▼─────┐
    │ classes │   │ subjects    │  │curriculum│
    └────┬────┘   └──────┬──────┘  └────┬─────┘
         └───────────────┼──────────────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
 ┌────▼─────┐     ┌──────▼──────┐    ┌─────▼──────┐
 │attendance│     │ assignments │    │ timetable  │
 └──────────┘     └──────┬──────┘    └────────────┘
                         │
                    ┌────▼──────┐
                    │submissions│
                    └───────────┘
                         │
      ┌──────────────────┼──────────────────┐
      │                  │                  │
 ┌────▼─────┐     ┌──────▼──────┐    ┌─────▼──────┐
 │notifcns  │     │     ai      │    │ analytics  │
 └──────────┘     └─────────────┘    └────────────┘
```

### 2.2 Module Responsibilities

#### auth
- Login/logout via Supabase Auth
- Session management (httpOnly cookies with JWT)
- Password reset flow
- Role-based login redirect
- **Does NOT**: manage user profiles (delegates to `users`)

#### users
- CRUD for users (create teacher/student/parent/admin)
- User lookup by role and school
- CSV import for bulk user creation
- Profile editing
- **Does NOT**: authenticate users (delegates to `auth`)

#### teachers
- Teacher-specific profile (extends users)
- Teacher-to-class assignment lookup
- Form teacher status management

#### students
- Student-specific profile (extends users)
- Class roster queries
- Enrollment history
- Transfer between classes

#### parents
- Parent-specific profile (extends users)
- Parent-child linking
- Child data access (attendance, grades, assignments)

#### classes
- CRUD for class groups
- Class teacher assignment
- Capacity management

#### subjects
- CRUD for academic subjects
- Core/elective management

#### curriculum
- Chapter/Topic/LO CRUD
- CBSE curriculum seeding
- Curriculum tree queries (chapters → topics → LOs)
- Curriculum progress marking (per-teacher)
- Progress queries for principal dashboard

#### attendance
- Mark attendance (single + batch)
- Daily attendance sheet
- Student attendance history
- Attendance trends
- Attendance override (principal)

#### assignments
- Unified assignment CRUD (homework, quiz, test, worksheet, project, practice)
- AI generation of questions
- Publish/unpublish workflow
- Assignment listing by class/subject
- Curriculum-linked assignment creation

#### submissions
- Student submission
- Auto-grading (MCQ/TF)
- Manual grading (teacher)
- Grade override
- Submission queue for teachers

#### notifications
- Create notifications
- Multi-channel delivery (in-app, email, WhatsApp, push)
- Delivery tracking
- Read/unread status
- Notification preferences

#### ai
- Homework question generation
- Test question generation
- Lesson plan generation
- Report comment generation
- Doubt assistant (student-facing)
- Parent weekly summary
- Principal insights
- Cost tracking and rate limiting

#### analytics
- Teacher dashboard data
- Student dashboard data
- Parent dashboard data
- Principal dashboard data
- Risk detection
- Report generation (PDF)

#### timetable
- Time slot definitions
- Timetable entries (who teaches what, when, where)
- Teacher schedule query
- Class schedule query
- Room assignment

### 2.3 Module Communication Rules

| Rule | Description |
|------|-------------|
| **No direct module-to-module imports** | Modules communicate through `core/` or through the API layer. |
| **Repository access is module-scoped** | Module A cannot import Module B's repository. |
| **Service composition** | If Module A needs Module B's data, Module A's service calls Module B's service through an interface. |
| **Event-driven for cross-cutting** | Use events for notifications, audit logging, analytics updates. |
| **Supabase Realtime for live updates** | Dashboard updates, notification delivery. |

### 2.4 Event Bus

```typescript
// src/core/events/event-bus.ts

type EventHandler<T = unknown> = (payload: T) => Promise<void>;

interface AthonEvent<T = unknown> {
  type: string;
  payload: T;
  metadata: {
    source: string;       // Module name, e.g. 'attendance'
    userId: string;
    schoolId: string;
    timestamp: string;
  };
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
  }

  async publish<T>(event: AthonEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    // Fire-and-forget — handlers run concurrently, errors are caught per-handler
    const promises = Array.from(handlers).map(handler =>
      handler(event.payload).catch(err =>
        logger.error({ eventType: event.type, error: err }, 'Event handler failed')
      )
    );

    await Promise.all(promises);
  }
}

// Global singleton
export const eventBus = new EventBus();
```

**Event Catalog (pre-defined):**

| Event | Publisher | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `attendance:marked` | AttendanceService | NotificationService, AnalyticsService | `{ classId, date, absentStudentIds[] }` |
| `assignment:published` | AssignmentService | NotificationService, AnalyticsService | `{ assignmentId, classId, title }` |
| `submission:graded` | SubmissionService | NotificationService, ProgressService | `{ submissionId, studentId, score }` |
| `student:risk` | RiskDetectionWorker | NotificationService, AnalyticsService | `{ studentId, flagType, severity }` |
| `user:created` | UserService | NotificationService | `{ userId, role, schoolId }` |
| `curriculum:progress` | CurriculumService | AnalyticsService | `{ teacherId, classId, subjectId, topicId, status }` |

**Usage in a service:**

```typescript
// src/modules/attendance/attendance.service.ts

export class AttendanceService {
  async markAttendance(ctx: RequestContext, input: MarkAttendanceInput[]): Promise<void> {
    // ... save to DB ...

    const absentIds = input.filter(i => i.status === 'absent').map(i => i.studentId);

    await eventBus.publish({
      type: 'attendance:marked',
      payload: { classId: input[0].classId, date: input[0].date, absentStudentIds: absentIds },
      metadata: {
        source: 'attendance',
        userId: ctx.userId,
        schoolId: ctx.schoolId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

---

## 3. Repository Pattern

### 3.1 Base Repository

```typescript
// src/core/database/base.repository.ts

export abstract class BaseRepository<T extends { id: string }> {
  constructor(
    protected readonly db: SupabaseClient,
    protected readonly tableName: string,
  ) {}

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(options?.select ?? '*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw DatabaseException.from(error);
    return data as T | null;
  }

  async findMany(filter: QueryFilter, options?: QueryOptions): Promise<T[]> {
    let query = this.db
      .from(this.tableName)
      .select(options?.select ?? '*', { count: 'exact' })
      .is('deleted_at', null);

    if (filter.school_id) query = query.eq('school_id', filter.school_id);
    if (filter.limit) query = query.range(0, filter.limit - 1);
    if (filter.orderBy) query = query.order(filter.orderBy, { ascending: filter.ascending ?? false });

    const { data, error } = await query;
    if (error) throw DatabaseException.from(error);
    return data as T[];
  }

  async create(data: CreateInput<T>): Promise<T> {
    const { data: created, error } = await this.db
      .from(this.tableName)
      .insert({ ...data, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw DatabaseException.from(error);
    return created as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: updated, error } = await this.db
      .from(this.tableName)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw DatabaseException.from(error);
    return updated as T;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw DatabaseException.from(error);
  }
}
```

### 3.2 Concrete Repository Example

```typescript
// src/modules/assignments/assignments.repository.ts

export class AssignmentsRepository extends BaseRepository<Assignment> {
  constructor(db: SupabaseClient) {
    super(db, 'assignments');
  }

  async findByClassAndSubject(
    classId: string,
    subjectId: string,
    options?: { includeDrafts?: boolean; termId?: string }
  ): Promise<Assignment[]> {
    let query = this.db
      .from('assignments')
      .select(`
        *,
        teacher:teachers!inner(first_name, last_name),
        learning_objective:learning_objectives(id, code, description)
      `)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .is('deleted_at', null);

    if (options?.termId) query = query.eq('academic_term_id', options.termId);
    if (!options?.includeDrafts) query = query.eq('is_published', true);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw DatabaseException.from(error);
    return data as Assignment[];
  }

  async findWithSubmissionStatus(
    assignmentId: string,
    studentId: string
  ): Promise<AssignmentWithSubmission | null> {
    const { data, error } = await this.db
      .from('assignments')
      .select(`
        *,
        questions:assignment_questions(*),
        submissions!left(*)
      `)
      .eq('id', assignmentId)
      .eq('submissions.student_id', studentId)
      .single();

    if (error) throw DatabaseException.from(error);
    return data as AssignmentWithSubmission | null;
  }

  async getTeacherAssignments(
    teacherId: string,
    termId: string
  ): Promise<Assignment[]> {
    const { data, error } = await this.db
      .from('assignments')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('academic_term_id', termId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw DatabaseException.from(error);
    return data as Assignment[];
  }

  async getPendingGrading(
    teacherId: string
  ): Promise<{ assignment: Assignment; pending: number }[]> {
    // Uses the grading queue index idx_submissions_grading_queue
    const { data, error } = await this.db.rpc('get_pending_grading_count', {
      p_teacher_id: teacherId,
    });

    if (error) throw DatabaseException.from(error);
    return data as { assignment: Assignment; pending: number }[];
  }
}
```

### 3.3 Repository Count & Justification

| Module | Repository | Why Separate? |
|--------|-----------|---------------|
| auth | `AuthRepository` | Session management, token storage |
| users | `UsersRepository` | User CRUD, role filters, CSV import |
| teachers | `TeachersRepository` | Teacher-specific queries (schedule, assignments) |
| students | `StudentsRepository` | Student roster, enrollment filters |
| parents | `ParentsRepository` | Parent profile, child linking |
| classes | `ClassesRepository` | Class CRUD, capacity checks |
| subjects | `SubjectsRepository` | Subject CRUD |
| curriculum | `CurriculumRepository` | Chapter/Topic/LO tree queries, progress |
| attendance | `AttendanceRepository` | Daily attendance, batch operations, trends |
| assignments | `AssignmentsRepository` | Assignment CRUD, publish workflow |
| submissions | `SubmissionsRepository` | Submission CRUD, grading queue |
| notifications | `NotificationsRepository` | Notification CRUD, delivery tracking |
| ai | `AIGenerationsRepository` | AI usage audit, cost tracking |
| analytics | `AnalyticsRepository` | Dashboard queries, risk flags |
| timetable | `TimetableRepository` | Timetable CRUD, schedule queries |
| files | `FilesRepository` | File metadata tracking, upload confirmations |
| audit | `AuditRepository` | Audit log queries |

**Total: 17 repositories** (down from 26 in V1).

### 3.4 Anti-Patterns to Avoid

| Anti-Pattern | Why | Solution |
|---|---|---|
| **God repository** | Repository that queries 5+ tables | Split into module repositories |
| **Repository returning DTOs** | Repository should return domain models | Transform in service layer |
| **Repository calling other repositories** | Creates circular dependencies | Services compose repositories |
| **Raw SQL in service layer** | Bypasses repository abstraction | Always go through repository |
| **Repository with business logic** | Violates separation of concerns | Business logic in service layer |

---

## 4. Service Layer Architecture

### 4.1 Service Pattern

```typescript
// src/modules/assignments/assignments.service.ts

// Side effects (notifications, audit) are delegated to injected services
// or published through the event bus — never called inline.

export class AssignmentsService {
  constructor(
    private readonly repo: AssignmentsRepository,
    private readonly curriculumRepo: CurriculumRepository,
    private readonly aiService: AIService,
    private readonly auditService: AuditService,
    private readonly authorization: AuthorizationService,
    private readonly notifications: NotificationService,
    private readonly submissionRepo: SubmissionsRepository,
    private readonly answerRepo: AnswersRepository,
  ) {}

  async createAssignment(
    ctx: RequestContext,
    input: CreateAssignmentInput,
  ): Promise<Assignment> {
    // 1. Validate
    const data = CreateAssignmentSchema.parse(input);

    // 2. Authorize
    await this.authorization.assert(ctx, 'assignments:create', {
      teacherId: ctx.profileId,
      classId: data.classId,
    });

    // 3. Check business rules
    if (data.loId) {
      const lo = await this.curriculumRepo.findLearningObjectiveById(data.loId);
      if (!lo) throw new NotFoundException('Learning objective not found');
    }

    // 4. Execute
    const assignment = await this.repo.create({
      ...data,
      teacher_id: ctx.profileId,
      school_id: ctx.schoolId,
      academic_term_id: ctx.currentTermId,
    });

    // 5. Side effects — audit + notify via event bus
    this.auditService.log(ctx, 'assignments:create', assignment.id, null, assignment);
    await eventBus.publish({
      type: 'assignment:published',
      payload: { assignmentId: assignment.id, classId: assignment.class_id, title: assignment.title },
      metadata: { source: 'assignments', userId: ctx.userId, schoolId: ctx.schoolId, timestamp: new Date().toISOString() },
    });

    return assignment;
  }

  async publishAssignment(
    ctx: RequestContext,
    assignmentId: string,
  ): Promise<Assignment> {
    const assignment = await this.repo.findById(assignmentId);
    if (!assignment) throw new NotFoundException('Assignment not found');

    await this.authorization.assert(ctx, 'assignments:publish', {
      teacherId: assignment.teacher_id,
    });

    if (assignment.is_published) {
      throw new ConflictException('Assignment already published');
    }

    if (!assignment.questions?.length) {
      throw new ValidationException('Cannot publish assignment with no questions');
    }

    const published = await this.repo.update(assignmentId, {
      is_published: true,
      published_at: new Date().toISOString(),
    });

    this.auditService.log(ctx, 'assignments:publish', assignmentId, assignment, published);
    await eventBus.publish({
      type: 'assignment:published',
      payload: { assignmentId, classId: assignment.class_id, title: assignment.title },
      metadata: { source: 'assignments', userId: ctx.userId, schoolId: ctx.schoolId, timestamp: new Date().toISOString() },
    });

    return published;
  }

  async gradeSubmission(
    ctx: RequestContext,
    submissionId: string,
    grades: GradeInput[],
  ): Promise<Submission> {
    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) throw new NotFoundException('Submission not found');

    const assignment = await this.repo.findById(submission.assignment_id);
    if (!assignment) throw new NotFoundException('Assignment not found');

    await this.authorization.assert(ctx, 'submissions:grade', {
      teacherId: assignment.teacher_id,
    });

    if (submission.is_graded) {
      throw new ConflictException('Submission already graded');
    }

    // Update each answer
    for (const grade of grades) {
      await this.answerRepo.update(grade.answerId, {
        score_manual: grade.score,
        remarks: grade.remarks,
      });
    }

    // Recalculate total
    const totalScore = grades.reduce((sum, g) => sum + g.score, 0);

    const graded = await this.submissionRepo.update(submissionId, {
      is_graded: true,
      graded_by: ctx.userId,
      graded_at: new Date().toISOString(),
      total_score_manual: totalScore,
      total_score: (submission.total_score_auto ?? 0) + totalScore,
    });

    this.auditService.log(ctx, 'submissions:grade', submissionId, submission, graded);
    await eventBus.publish({
      type: 'submission:graded',
      payload: { submissionId, studentId: submission.student_id, score: graded.total_score },
      metadata: { source: 'assignments', userId: ctx.userId, schoolId: ctx.schoolId, timestamp: new Date().toISOString() },
    });

    return graded;
  }
}
```

### 4.2 Service Layer Rules

| Rule | Description |
|------|-------------|
| **Services are stateless** | All state is in the database or cache. Services are instantiated per-request. |
| **Services compose repositories** | A service can use multiple repositories. |
| **Services can call other services** | Only through constructor injection, never direct imports. |
| **Services never import from other modules directly** | Use shared interfaces in `core/`. |
| **Services handle authorization** | Every mutation starts with an authorization assertion. |
| **Services handle audit logging** | Every mutation logs to audit trail. |
| **Services never return raw database errors** | All errors are wrapped in typed AppErrors. |

### 4.3 Service Map

| Service | Repositories Used | Key Collaborators |
|---------|------------------|-------------------|
| AuthService | AuthRepository | session.ts |
| UserService | UsersRepository | — |
| TeacherService | TeachersRepository | UsersService |
| StudentService | StudentsRepository | UsersService |
| ParentService | ParentsRepository | UsersService |
| ClassService | ClassesRepository | TeacherService |
| SubjectService | SubjectsRepository | — |
| CurriculumService | CurriculumRepository | — |
| AttendanceService | AttendanceRepository | ClassService, NotificationService |
| AssignmentService | AssignmentsRepository | CurriculumService, AIService, AuditService |
| SubmissionService | SubmissionsRepository, AnswersRepository | AssignmentService |
| NotificationService | NotificationsRepository | — |
| AIService | AIGenerationsRepository | CurriculumService, AssignmentService |
| AnalyticsService | AnalyticsRepository | AttendanceRepo, SubmissionRepo, RiskRepo |
| TimetableService | TimetableRepository | ClassService, TeacherService |

---

## 5. Validation Architecture

### 5.1 Validation Layers

```
Layer 1: Schema validation (Zod)
    ├── Input validation: every API endpoint validates request body
    ├── Query validation: pagination, filters, sort parameters
    ├── Type coercion: string → number, string → UUID, string → Date
    └── Business rules: due_date > now(), max_score > 0

Layer 2: Database constraints
    ├── UNIQUE constraints (email, admission_number)
    ├── CHECK constraints (score > 0, date range)
    ├── NOT NULL constraints
    └── Foreign key constraints

Layer 3: Business logic validation
    ├── Service-level checks (teacher teaches class, no double-submission)
    ├── State machine checks (can't grade unsubmitted, can't publish draft without questions)
    └── Permission checks (role + scope)
```

### 5.2 Schema Organization

```typescript
// src/modules/assignments/assignments.validator.ts

import { z } from 'zod';

// Shared base schemas
const AssignmentType = z.enum([
  'homework', 'quiz', 'unit_test', 'worksheet', 'project', 'practice',
]);

const QuestionType = z.enum([
  'multiple_choice', 'true_false', 'short_answer', 'long_answer', 'essay',
]);

// Input schemas
export const CreateAssignmentSchema = z.object({
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  lo_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assignment_type: AssignmentType,
  max_score: z.number().positive(),
  duration_minutes: z.number().int().positive().optional(),
  due_date: z.string().datetime().optional(),
  passing_percentage: z.number().min(0).max(100).default(40),
  questions: z.array(CreateQuestionSchema).optional(),
});

export const CreateQuestionSchema = z.object({
  question_text: z.string().min(1),
  question_type: QuestionType,
  options: z.array(z.object({
    label: z.string().length(1),
    text: z.string().min(1),
  })).optional(),
  correct_answer: z.string().optional(),
  explanation: z.string().optional(),
  points: z.number().positive().default(1),
  sort_order: z.number().int().min(0).default(0),
});

export const GradeSubmissionSchema = z.object({
  grades: z.array(z.object({
    answer_id: z.string().uuid(),
    score: z.number().min(0),
    remarks: z.string().optional(),
  })).min(1),
});

export const AssignmentFilterSchema = z.object({
  class_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  assignment_type: AssignmentType.optional(),
  is_published: z.boolean().optional(),
  due_before: z.string().datetime().optional(),
  due_after: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Response schemas
export const AssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  assignment_type: AssignmentType,
  // ... computed fields
});
```

### 5.3 Validation Patterns

```typescript
// Pattern 1: Standard API validation
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateAssignmentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const result = await assignmentService.createAssignment(ctx, parsed.data);
  return Response.json({ data: result }, { status: 201 });
}

// Pattern 2: Server action validation
export async function createAssignmentAction(formData: FormData) {
  'use server';
  
  const parsed = CreateAssignmentSchema.safeParse({
    title: formData.get('title'),
    // ...
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  return await assignmentService.createAssignment(ctx, parsed.data);
}

// Pattern 3: Query parameter validation
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  
  const parsed = AssignmentFilterSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const assignments = await assignmentService.listAssignments(ctx, parsed.data);
  return Response.json({ data: assignments });
}
```

### 5.4 Common Validation Schemas

```typescript
// src/core/validation/zod.ts

export const UUID = z.string().uuid();
export const SchoolId = UUID.brand('SchoolId');
export const UserId = UUID.brand('UserId');
export const ClassId = UUID.brand('ClassId');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const DateRangeSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
});

export const SortSchema = z.object({
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});
```

---

## 6. Authorization Architecture

### 6.1 Three-Layer Authorization

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ATHON AUTHORIZATION MODEL                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: Authentication                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Next.js Middleware: check session cookie                    │   │
│  │  API Routes: verify JWT via Supabase                         │   │
│  │  Server Actions: verify session                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  Layer 2: Role-Based Access (RBAC)                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  requireRole('teacher', 'admin')                             │   │
│  │  Based on users.role from database                           │   │
│  │  Reject with 403 if wrong role                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  Layer 3: Data Scoping                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  requireScope('teacher_teaches_class', classId)              │   │
│  │  requireScope('parent_owns_student', studentId)              │   │
│  │  requireScope('own_resource', resourceId)                    │   │
│  │  Based on teacher_class_subjects, student_parents, etc.      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Authorization Service

```typescript
// src/core/authorization/rbac.ts

export class AuthorizationService {
  constructor(
    private readonly db: SupabaseClient,
  ) {}

  async assert(
    ctx: RequestContext,
    permission: string,
    resource?: Record<string, string>,
  ): Promise<void> {
    // Layer 2: Role check
    const role = ctx.role;
    if (!this.hasRolePermission(role, permission)) {
      throw new ForbiddenException(`Role ${role} cannot ${permission}`);
    }

    // Layer 3: Scope check
    if (resource) {
      const scoped = await this.checkScope(ctx, permission, resource);
      if (!scoped) {
        throw new ForbiddenException(`Cannot ${permission} on this resource`);
      }
    }
  }

  private hasRolePermission(role: string, permission: string): boolean {
    // Permission format: "module:action"
    // e.g. "assignments:create", "attendance:mark"
    const permissionMap: Record<string, string[]> = {
      school_admin: ['*'], // Admin can do everything
      principal: [
        'users:view', 'users:create_student', 'users:create_parent',
        'attendance:view', 'attendance:override',
        'assignments:view', 'assignments:export',
        'curriculum:view', 'curriculum:export',
        'analytics:view', 'analytics:export',
        'notifications:send', 'notifications:view',
        'announcements:create', 'announcements:edit', 'announcements:delete',
        'ai:view_usage', 'ai:generate_insights',
        'reports:view', 'reports:generate', 'reports:export',
        'progress:view',
        'timetable:view',
        'lesson_plans:view',
        'students:view', 'students:export',
        'teachers:view', 'teachers:export',
      ],
      teacher: [
        'attendance:mark', 'attendance:view', 'attendance:edit_own',
        'assignments:create', 'assignments:edit', 'assignments:delete',
        'assignments:publish', 'assignments:view',
        'submissions:view', 'submissions:grade',
        'curriculum:view', 'curriculum:mark_progress',
        'notifications:send_to_class',
        'ai:generate_homework', 'ai:generate_test',
        'ai:generate_lesson_plan', 'ai:generate_report_comments',
        'reports:generate_class', 'reports:view',
        'progress:view_class',
        'lesson_plans:create', 'lesson_plans:edit', 'lesson_plans:delete',
        'students:view_class',
        'timetable:view_own',
      ],
      student: [
        'assignments:view_published',
        'submissions:create', 'submissions:view_own',
        'attendance:view_own',
        'curriculum:view',
        'progress:view_own',
        'ai:doubt_assistant',
        'notifications:view', 'notifications:mark_read',
      ],
      parent: [
        'students:view_children',
        'attendance:view_children',
        'assignments:view_children',
        'submissions:view_children',
        'progress:view_children',
        'notifications:view', 'notifications:mark_read',
        'curriculum:view',
        'announcements:view',
      ],
    };

    const allowed = permissionMap[role];
    if (!allowed) return false;
    if (allowed.includes('*')) return true;
    return allowed.includes(permission);
  }

  private async checkScope(
    ctx: RequestContext,
    permission: string,
    resource: Record<string, string>,
  ): Promise<boolean> {
    switch (permission) {
      case 'attendance:mark':
        return this.teacherTeachesClass(ctx.profileId, resource.classId);
      case 'assignments:create':
        return this.teacherTeachesClass(ctx.profileId, resource.classId);
      case 'submissions:grade':
        return this.teacherOwnsAssignment(ctx.profileId, resource.assignmentId);
      case 'students:view_class':
        return this.teacherTeachesClass(ctx.profileId, resource.classId);
      case 'students:view_children':
        return this.parentOwnsStudent(ctx.profileId, resource.studentId);
      case 'attendance:view_children':
        return this.parentOwnsStudent(ctx.profileId, resource.studentId);
      case 'own_resource':
        return ctx.userId === resource.userId;
      default:
        return true; // No scope check needed (e.g., notifications:view)
    }
  }

  private async teacherTeachesClass(
    teacherId: string,
    classId: string,
  ): Promise<boolean> {
    const { count, error } = await this.db
      .from('teacher_class_subjects')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .is('deleted_at', null);

    return !error && count! > 0;
  }

  private async parentOwnsStudent(
    parentId: string,
    studentId: string,
  ): Promise<boolean> {
    const { count, error } = await this.db
      .from('student_parents')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', parentId)
      .eq('student_id', studentId);

    return !error && count! > 0;
  }

  private async teacherOwnsAssignment(
    teacherId: string,
    assignmentId: string,
  ): Promise<boolean> {
    const { data, error } = await this.db
      .from('assignments')
      .select('teacher_id')
      .eq('id', assignmentId)
      .single();

    return !error && data?.teacher_id === teacherId;
  }
}
```

### 6.3 Policy Files

Each module can have a policy file for complex permission logic:

```typescript
// src/core/authorization/policies/assignments.policy.ts

export class AssignmentPolicy {
  constructor(private readonly auth: AuthorizationService) {}

  async canCreate(ctx: RequestContext, classId: string): Promise<boolean> {
    if (ctx.role === 'school_admin') return true;
    if (ctx.role !== 'teacher') return false;
    return this.auth.teacherTeachesClass(ctx.profileId, classId);
  }

  async canEdit(ctx: RequestContext, assignment: Assignment): Promise<boolean> {
    if (ctx.role === 'school_admin') return true;
    if (ctx.role !== 'teacher') return false;
    return assignment.teacher_id === ctx.profileId;
  }

  async canDelete(ctx: RequestContext, assignment: Assignment): Promise<boolean> {
    if (ctx.role === 'school_admin') return true;
    if (ctx.role !== 'teacher') return false;
    if (assignment.teacher_id !== ctx.profileId) return false;
    // Can delete only if no submissions exist
    return !await this.hasSubmissions(assignment.id);
  }

  async canView(ctx: RequestContext, assignment: Assignment): Promise<boolean> {
    if (['school_admin', 'principal'].includes(ctx.role)) return true;
    if (ctx.role === 'teacher') {
      return await this.auth.teacherTeachesClass(ctx.profileId, assignment.class_id);
    }
    if (ctx.role === 'student') {
      return assignment.is_published && 
             await this.studentInClass(ctx.userId, assignment.class_id);
    }
    if (ctx.role === 'parent') {
      return assignment.is_published && 
             await this.parentHasChildInClass(ctx.profileId, assignment.class_id);
    }
    return false;
  }

  private async hasSubmissions(assignmentId: string): Promise<boolean> {
    const { count } = await this.db
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);
    return count! > 0;
  }
}
```

---

## 7. Error Handling Architecture

### 7.1 Error Hierarchy

```
AppError (abstract)
├── AuthenticationException    (401)  — Not logged in
│   └── SessionExpiredException       — Token expired
├── AuthorizationException     (403)  — Wrong role or no access
│   ├── ForbiddenException            — Role doesn't have permission
│   └── ScopeException                — Wrong data scope
├── NotFoundException          (404)  — Resource doesn't exist
├── ConflictException          (409)  — Duplicate, state conflict
├── ValidationException        (422)  — Invalid input
│   └── BusinessRuleException         — Business rule violation
├── RateLimitException         (429)  — Too many requests
├── ServiceUnavailableException(503)  — External service down
└── DatabaseException          (500)  — Database error
    ├── UniqueViolationException       — Duplicate key
    ├── ForeignKeyViolationException   — Invalid reference
    └── CheckViolationException        — Constraint violation
```

### 7.2 Error Catalog

```typescript
// src/core/errors/error-catalog.ts

export const ErrorCodes = {
  // Auth (AUTH-*)
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_001', status: 401, message: 'Invalid email or password' },
  AUTH_SESSION_EXPIRED: { code: 'AUTH_002', status: 401, message: 'Session expired, please log in again' },
  AUTH_ACCOUNT_LOCKED: { code: 'AUTH_003', status: 423, message: 'Account locked due to too many attempts' },
  
  // Authorization (AUTHZ-*)
  AUTHZ_ROLE_DENIED: { code: 'AUTHZ_001', status: 403, message: 'Your role does not have permission for this action' },
  AUTHZ_SCOPE_DENIED: { code: 'AUTHZ_002', status: 403, message: 'You do not have access to this resource' },
  AUTHZ_SCHOOL_MISMATCH: { code: 'AUTHZ_003', status: 403, message: 'Cross-school access is not permitted' },

  // Validation (VAL-*)
  VAL_INPUT_ERROR: { code: 'VAL_001', status: 422, message: 'Invalid input' },
  VAL_REQUIRED_FIELD: { code: 'VAL_002', status: 422, message: 'Required field missing' },
  VAL_INVALID_UUID: { code: 'VAL_003', status: 422, message: 'Invalid UUID format' },

  // Business Rules (BIZ-*)
  BIZ_ALREADY_PUBLISHED: { code: 'BIZ_001', status: 409, message: 'Resource already published' },
  BIZ_ALREADY_GRADED: { code: 'BIZ_002', status: 409, message: 'Submission already graded' },
  BIZ_CANNOT_DELETE_WITH_SUBMISSIONS: { code: 'BIZ_003', status: 409, message: 'Cannot delete assignment with existing submissions' },
  BIZ_DUE_DATE_PASSED: { code: 'BIZ_004', status: 400, message: 'Due date has already passed' },
  BIZ_NOT_IN_CLASS: { code: 'BIZ_005', status: 403, message: 'Student is not enrolled in this class' },
  BIZ_ATTENDANCE_ALREADY_MARKED: { code: 'BIZ_006', status: 409, message: 'Attendance already marked for this date' },
  BIZ_EDIT_WINDOW_CLOSED: { code: 'BIZ_007', status: 400, message: 'Edit window has closed (24 hours)' },

  // Not Found (NF-*)
  NF_RESOURCE: { code: 'NF_001', status: 404, message: 'Resource not found' },
  NF_USER: { code: 'NF_002', status: 404, message: 'User not found' },
  NF_CLASS: { code: 'NF_003', status: 404, message: 'Class not found' },
  NF_ASSIGNMENT: { code: 'NF_004', status: 404, message: 'Assignment not found' },

  // Rate Limit (RL-*)
  RL_PER_MINUTE: { code: 'RL_001', status: 429, message: 'Too many requests. Please wait.' },
  RL_AI_DAILY: { code: 'RL_002', status: 429, message: 'Daily AI generation limit reached' },
  RL_LOGIN_ATTEMPTS: { code: 'RL_003', status: 429, message: 'Too many login attempts. Try again later.' },

  // External Service (EXT-*)
  EXT_AI_UNAVAILABLE: { code: 'EXT_001', status: 503, message: 'AI service is unavailable. Try again later.' },
  EXT_AI_CONFIGURED: { code: 'EXT_002', status: 503, message: 'AI generation is not configured. Ask your administrator to add the API key.' },
  EXT_EMAIL_FAILED: { code: 'EXT_003', status: 502, message: 'Failed to send email notification' },
} as const;
```

### 7.3 Error Response Format

```typescript
// Standard error response
interface ErrorResponse {
  error: {
    code: string;       // e.g., "BIZ_001"
    message: string;    // Human-readable
    details?: unknown;  // Field-level errors for validation
    requestId?: string; // For debugging
  };
}

// Validation error response
interface ValidationErrorResponse {
  error: {
    code: 'VAL_001';
    message: 'Invalid input';
    details: {
      fields: Record<string, string[]>; // Field → error messages
    };
  };
}

// Examples:
// 401: { error: { code: 'AUTH_001', message: 'Invalid email or password' } }
// 403: { error: { code: 'AUTHZ_001', message: 'Role does not have permission' } }
// 409: { error: { code: 'BIZ_001', message: 'Assignment already published' } }
// 422: { error: { code: 'VAL_001', message: 'Invalid input', details: { fields: { title: ['Required'] } } } }
```

### 7.4 Global Error Handler

```typescript
// src/core/errors/error-handler.ts

export function handleError(error: unknown, request?: Request): Response {
  // Log the error
  logger.error({ error, requestId: request?.headers.get('x-request-id') });

  // Known application errors
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  // Zod validation errors
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: 'VAL_001',
          message: 'Invalid input',
          details: { fields: error.flatten().fieldErrors },
        },
      },
      { status: 422 }
    );
  }

  // Supabase/PostgreSQL errors
  if (error instanceof PostgrestError) {
    return handleDatabaseError(error);
  }

  // Unknown errors — don't leak details
  logger.error('Unhandled error', error);
  return Response.json(
    {
      error: {
        code: 'INT_001',
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}

function handleDatabaseError(error: PostgrestError): Response {
  switch (error.code) {
    case '23505': // unique_violation
      return Response.json(
        { error: { code: 'CONFLICT', message: 'A record with this value already exists' } },
        { status: 409 }
      );
    case '23503': // foreign_key_violation
      return Response.json(
        { error: { code: 'INVALID_REF', message: 'Referenced record does not exist' } },
        { status: 400 }
      );
    default:
      return Response.json(
        { error: { code: 'DB_ERROR', message: 'Database error' } },
        { status: 500 }
      );
  }
}
```

---

## 8. Background Jobs

### 8.1 Job Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ATHON BACKGROUND JOBS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  API Server                          Worker Process                  │
│  ┌──────────────┐                    ┌──────────────────────┐      │
│  │ POST /attenda│                    │  BullMQ Worker        │      │
│  │   nce/batch  │                    │                      │      │
│  │   ↓          │                    │  ┌──────────────────┐│      │
│  │  Attendance  │                    │  │ risk-detection   ││      │
│  │  Service     │                    │  │ notification     ││      │
│  │   ↓          │   ┌──────────┐     │  │ progress-refresh ││      │
│  │  Queue:      │──►│  Redis   │◄────│  │ parent-summary   ││      │
│  │  notification│   │  (BullMQ)│     │  │ curriculum-seed  ││      │
│  │              │◄──│          │──►  │  └──────────────────┘│      │
│  └──────────────┘   └──────────┘     └──────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Job Definitions

| Job | Schedule | Queue | Priority | Description |
|-----|----------|-------|----------|-------------|
| `notification.deliver` | On event | `notifications` | High | Deliver pending notifications via appropriate channel |
| `risk.detect` | Every 6 hours | `analytics` | Low | Scan all students for risk flags |
| `progress.refresh` | Every 15 min | `analytics` | Low | Refresh `mv_progress_mastery` |
| `parent.summary` | Weekly (Sunday) | `ai` | Low | Generate AI parent summaries |
| `attendance.reminder` | Daily (8AM) | `notifications` | Normal | Remind teachers to mark attendance |
| `attendance.alert` | On mark absent | `notifications` | High | Notify parents of absence |
| `curriculum.seed` | On school creation | `admin` | Low | Seed CBSE curriculum for new school |
| `audit.archive` | Monthly | `system` | Low | Archive audit logs per retention policy |
| `session.cleanup` | Daily | `system` | Low | Clean expired sessions |

### 8.3 Job Implementation Example

```typescript
// src/core/queue/jobs/notification.deliver.job.ts

interface NotificationJobData {
  notificationId: string;
  channel: 'in_app' | 'email' | 'whatsapp' | 'push';
}

export const notificationDeliveryJob = {
  queue: 'notifications',
  concurrency: 5,
  
  async handler(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, channel } = job.data;
    
    const recipients = await notificationsRepo.getPendingRecipients(
      notificationId, channel
    );

    for (const recipient of recipients) {
      try {
        await deliveryService.deliver(channel, recipient);
        await notificationsRepo.markDelivered(recipient.id);
      } catch (error) {
        await notificationsRepo.markFailed(recipient.id, error.message);
        // Retry logic handled by BullMQ
        if (recipient.retry_count < 3) {
          throw error; // BullMQ will retry
        }
      }
    }
  },

  options: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
};
```

### 8.4 Worker Entry Point

```typescript
// workers/index.ts

import { Worker } from 'bullmq';
import { redis } from '@/core/cache/redis';
import { riskDetectionJob } from './risk-detection.worker';
import { notificationDeliveryJob } from './notification.worker';
// ...

const workers = [
  new Worker('notifications', notificationDeliveryJob.handler, {
    connection: redis,
    concurrency: notificationDeliveryJob.concurrency,
    ...notificationDeliveryJob.options,
  }),
  new Worker('analytics', riskDetectionJob.handler, {
    connection: redis,
    concurrency: 2,
  }),
  // ...
];

process.on('SIGTERM', async () => {
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
});
```

---

## 9. Caching Strategy

### 9.1 Cache Layers

```
Layer 1: In-memory (Next.js Server)
    ├── Static data: curriculum tree, subjects list (TTL: 5 min)
    ├── User session (TTL: request lifetime)
    └── Config: school settings (TTL: 10 min)

Layer 2: Redis (Shared)
    ├── Dashboard data: teacher dashboard, principal dashboard
    ├── Rate limit counters
    ├── BullMQ job queues
    └── Supabase Realtime presence

Layer 3: Materialized Views (PostgreSQL)
    ├── mv_progress_mastery (refresh: 15 min)
    ├── mv_daily_attendance_summary (refresh: hourly)
    └── mv_teacher_activity (refresh: hourly)
```

### 9.2 Cache Manager

```typescript
// src/core/cache/cache-manager.ts

export class CacheManager {
  constructor(private readonly redis: Redis) {}

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as T;

    const data = await fetcher();
    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    return data;
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      await this.redis.del(`tag:${tag}`);
    }
  }

  async withTag(key: string, tag: string): Promise<void> {
    await this.redis.sadd(`tag:${tag}`, key);
  }
}
```

### 9.3 Cache Invalidation Map

| Trigger | Invalidation | TTL |
|---------|-------------|-----|
| Attendance marked | `cache:attendance:{classId}:{date}` | — |
| Assignment created | `cache:teacher:{teacherId}:dashboard` | — |
| Assignment published | `cache:class:{classId}:assignments` | — |
| Grade updated | `cache:student:{studentId}:progress` | — |
| Profile updated | `cache:user:{userId}:profile` | — |
| Curriculum edited | `cache:curriculum:{subjectId}:tree` | — |
| Teacher dashboard | — | 60s |
| Student dashboard | — | 60s |
| Principal dashboard | — | 5min |
| Curriculum tree | — | 1hr |
| Student profile | — | 5min |

### 9.4 Cache Patterns

```typescript
// Pattern 1: Dashboard caching
export class AnalyticsService {
  async getTeacherDashboard(teacherId: string): Promise<TeacherDashboard> {
    return this.cache.getOrSet(
      `cache:teacher:${teacherId}:dashboard`,
      () => this.computeTeacherDashboard(teacherId),
      60, // 60 second TTL
    );
  }

  private async computeTeacherDashboard(teacherId: string): Promise<TeacherDashboard> {
    const [classes, todayAttendance, pendingGrading, upcomingDeadlines] = 
      await Promise.all([
        this.classRepo.findByTeacher(teacherId),
        this.attendanceRepo.getTodayByTeacher(teacherId),
        this.submissionRepo.getPendingGrading(teacherId),
        this.assignmentRepo.getUpcomingDeadlines(teacherId),
      ]);

    return { classes, todayAttendance, pendingGrading, upcomingDeadlines };
  }
}

// Pattern 2: Tag-based invalidation
export class AttendanceService {
  async markAttendance(ctx: RequestContext, input: MarkAttendanceInput[]): Promise<void> {
    // ... mark attendance in DB ...

    // Invalidate affected caches
    await this.cache.invalidate(`cache:attendance:${input[0].classId}:*`);
    await this.cache.invalidate(`cache:teacher:${ctx.profileId}:dashboard`);
    
    // Enqueue notification job
    await this.queue.add('notification.deliver', {
      type: 'attendance_marked',
      classId: input[0].classId,
    });
  }
}

// Pattern 3: Stale-while-revalidate for slow queries
export class AnalyticsService {
  async getPrincipalDashboard(schoolId: string): Promise<PrincipalDashboard> {
    const cacheKey = `cache:principal:${schoolId}:dashboard`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      // Return stale data, revalidate in background
      this.revalidateDashboard(schoolId, cacheKey);
      return JSON.parse(cached);
    }

    return this.revalidateDashboard(schoolId, cacheKey);
  }

  private async revalidateDashboard(
    schoolId: string, 
    cacheKey: string
  ): Promise<PrincipalDashboard> {
    const data = await this.computePrincipalDashboard(schoolId);
    await this.redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
    return data;
  }
}
```

---

## 10. File Upload Architecture

### 10.1 Architecture

```
Client                    Next.js Server              Supabase Storage
  │                           │                           │
  │ POST /api/upload          │                           │
  │ (FormData with file)      │                           │
  │ ─────────────────────────►│                           │
  │                           │                           │
  │                    1. Validate file                   │
  │                       - type (image/pdf/doc)          │
  │                       - size (< 10MB)                 │
  │                       - virus scan                    │
  │                           │                           │
  │                    2. Generate signed URL             │
  │                           │──────────────────────────►│
  │                           │◄───────── signed URL ────│
  │                           │                           │
  │                    3. Upload to signed URL            │
  │                           │ (client-side upload)      │
  │◄──── signed URL ──────────│                           │
  │                           │                           │
  │ PUT {signed URL}          │                           │
  │ (file bytes)              │                           │
  │ ─────────────────────────────────────────────────────►│
  │                           │                           │
  │                    4. Confirm upload                  │
  │ ─────────────────────────►│                           │
  │                           │                           │
  │                    5. Save file metadata              │
  │                           │                           │
  │◄──── { url, filename } ───│                           │
```

### 10.2 File Upload Service

```typescript
// src/core/storage/storage.service.ts

export class StorageService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly bucket: string = 'uploads',
  ) {}

  async getSignedUploadUrl(
    ctx: RequestContext,
    file: { name: string; type: string; size: number },
  ): Promise<UploadResponse> {
    // 1. Validate file
    this.validateFile(file);

    // 2. Generate path
    const path = this.generatePath(ctx, file);

    // 3. Get signed URL
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path, {
        contentType: file.type,
      });

    if (error) throw new ServiceException('Failed to generate upload URL');
    
    // 4. Save file metadata
    const fileRecord = await this.fileRepo.create({
      school_id: ctx.schoolId,
      user_id: ctx.userId,
      path,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      signed_url_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    });

    return {
      url: data.signedUrl,
      token: data.token,
      fileId: fileRecord.id,
      path,
    };
  }

  async confirmUpload(fileId: string): Promise<FileRecord> {
    return this.fileRepo.update(fileId, {
      is_uploaded: true,
      uploaded_at: new Date().toISOString(),
    });
  }

  async getPublicUrl(path: string, expiresIn = 3600): Promise<string> {
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(path, { download: false });

    return data.publicUrl;
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([path]);

    if (error) throw new ServiceException('Failed to delete file');
  }

  private validateFile(file: { name: string; type: string; size: number }): void {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw new ValidationException(`File type ${file.type} is not allowed`);
    }

    if (file.size > maxSize) {
      throw new ValidationException('File size exceeds 10MB limit');
    }
  }

  private generatePath(ctx: RequestContext, file: { name: string }): string {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${ctx.schoolId}/${ctx.userId}/${timestamp}_${safeName}`;
  }
}
```

### 10.3 Upload API Route

```typescript
// src/app/api/upload/route.ts

export async function POST(request: Request) {
  const ctx = getRequestContext(request);
  if (!ctx) return unauthorized();

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json(
      { error: { code: 'VAL_001', message: 'No file provided' } },
      { status: 422 }
    );
  }

  const uploadResponse = await storageService.getSignedUploadUrl(ctx, {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  return Response.json({ data: uploadResponse });
}

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');

  if (!fileId) {
    return Response.json(
      { error: { code: 'VAL_001', message: 'fileId required' } },
      { status: 422 }
    );
  }

  const confirmed = await storageService.confirmUpload(fileId);
  return Response.json({ data: confirmed });
}
```

### 10.4 File Types & Limits

| Use Case | Allowed Types | Max Size | Storage Path |
|----------|--------------|----------|--------------|
| Student photo | JPEG, PNG, WebP | 5MB | `{schoolId}/photos/{userId}.jpg` |
| Assignment attachment | PDF, DOC, DOCX | 10MB | `{schoolId}/assignments/{assignmentId}/` |
| Report export | PDF | 20MB | `{schoolId}/reports/{reportId}.pdf` |
| Bulk import CSV | CSV | 5MB | `{schoolId}/imports/{timestamp}.csv` |
| Lesson plan resource | PDF, images | 10MB | `{schoolId}/lesson-plans/{planId}/` |

---

## 11. Production Deployment Architecture

### 11.1 Architecture Diagram

```
                              ┌─────────────────────┐
                              │   Cloudflare / Vercel│
                              │   (CDN + Edge)      │
                              └─────────┬───────────┘
                                        │
                              ┌─────────▼───────────┐
                              │   Next.js App        │
                              │   (Vercel / Docker)  │
                              │                      │
                              │  - Server Components │
                              │  - API Routes        │
                              │  - Server Actions    │
                              └─────────┬───────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
    ┌──────▼──────┐            ┌────────▼────────┐         ┌────────▼────────┐
    │   Supabase   │            │     Redis        │         │   OpenAI API    │
    │  (Managed)   │            │   (Upstash /     │         │   (External)    │
    │              │            │   Redis Cloud)   │         │                │
    │  - PostgreSQL│            │                  │         │  - gpt-4o-mini │
    │  - Auth      │            │  - Cache         │         │  - gpt-4o      │
    │  - Storage   │            │  - BullMQ Queue  │         │  - tiktoken    │
    │  - Realtime  │            │  - Rate Limits   │         └────────────────┘
    └──────────────┘            └──────────────────┘
                                        │
                                ┌───────▼────────┐
                                │   Worker Process│
                                │   (Docker)      │
                                │                 │
                                │  - BullMQ Worker│
                                │  - Risk Detect  │
                                │  - Notifications│
                                └─────────────────┘
```

### 11.2 Deployment Configuration

```yaml
# docker-compose.yml

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    env_file: .env.production
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 512M

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "workers/index.js"]
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=${REDIS_URL}
    env_file: .env.production
    depends_on:
      - redis
      - web
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

volumes:
  redis_data:
```

### 11.3 Environment Variables

```bash
# .env.production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ... # Service role key (server-side only)

# Auth
JWT_SECRET=your-jwt-secret
SESSION_COOKIE_NAME=athon_session
SESSION_COOKIE_DOMAIN=.athonschool.com

# Redis
REDIS_URL=redis://:password@redis:6379

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4000

# Storage
STORAGE_BUCKET=athon-uploads
STORAGE_REGION=ap-south-1

# Queue
BULLMQ_PREFIX=athon
BULLMQ_CONCURRENCY=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://...

# School
DEFAULT_CURRENCY=INR
TIMEZONE=Asia/Kolkata
```

### 11.4 Scaling Strategy

| Scale Level | Web Replicas | Worker Replicas | Redis | DB Size |
|-------------|-------------|-----------------|-------|---------|
| 1 school (early) | 1 | 1 | 256MB (free) | 1GB |
| 10 schools | 2 | 1 | 512MB | 5GB |
| 50 schools | 3 | 2 | 1GB | 20GB |
| 100 schools | 5 | 3 | 2GB | 50GB |
| 500 schools | 10 | 5 | 5GB | 250GB |
| 1,000 schools | 20 | 10 | 10GB | 500GB+ |

### 11.5 Monitoring & Observability

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking + performance monitoring |
| Supabase Dashboard | Database performance, auth metrics |
| Redis Insight | Cache hit rates, queue depth |
| OpenAI Usage Dashboard | AI cost tracking |
| Custom health endpoint | `/api/health` — DB, Redis, AI connectivity |
| Custom metrics endpoint | `/api/metrics` — Prometheus format |

### 11.6 Health Check

```typescript
// src/app/api/health/route.ts

export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkOpenAI(),
  ]);

  const status = checks.every(c => c.status === 'fulfilled' && c.value)
    ? 'healthy'
    : 'degraded';

  return Response.json({
    status,
    version: process.env.APP_VERSION ?? '1.0.0',
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].status === 'fulfilled' ? checks[0].value : 'unhealthy',
      redis: checks[1].status === 'fulfilled' ? checks[1].value : 'unhealthy',
      openai: checks[2].status === 'fulfilled' ? checks[2].value : 'unhealthy',
    },
  }, { status: status === 'healthy' ? 200 : 503 });
}
```

### 11.7 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test

  deploy-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t athon-web .
      - run: docker push registry.example.com/athon-web:latest
      - run: kubectl set image deployment/web web=registry.example.com/athon-web:latest

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f Dockerfile.worker -t athon-worker .
      - run: docker push registry.example.com/athon-worker:latest
      - run: kubectl set image deployment/worker worker=registry.example.com/athon-worker:latest
```

### 11.8 V1 → V2 Backend Changes Summary

| Aspect | V1 | V2 |
|--------|:--:|:--:|
| Framework | FastAPI (Python) | Next.js (TypeScript) |
| Auth | Supabase JWT + JWKS | Supabase Auth + httpOnly cookies |
| Validation | Pydantic | Zod |
| Database | SQLAlchemy 2.0 Async | Supabase JS client (auto-RLS) |
| Background Jobs | Celery + Redis | BullMQ + Redis |
| File Upload | Manual multipart | Supabase Storage signed URLs |
| Error Handling | Inline try/except | Centralized AppError hierarchy |
| Authorization | Inline role checks | Decorator + service + RLS (3-layer) |
| Module Count | 23 route files, 26 repos | 16 modules, 17 repos |
| API Pattern | REST (FastAPI routes) | Next.js App Router + Server Actions |

---

## Appendix: Key Libraries

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "@supabase/supabase-js": "^2.45",
    "@supabase/ssr": "^0.5",
    "zod": "^3.23",
    "bullmq": "^5.12",
    "ioredis": "^5.4",
    "openai": "^4.56",
    "pino": "^9.3",
    "date-fns": "^3.6",
    "nanoid": "^5.0"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vitest": "^2.0",
    "@playwright/test": "^1.45",
    "eslint": "^9.0",
    "prettier": "^3.3",
    "supabase": "^1.187"
  }
}
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Generate backend module scaffolding (modules directory, core infrastructure, base repository, auth flow)
