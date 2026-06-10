# ATHON V2 — Attendance Module Implementation

**Reviewer**: Staff Backend Engineer  
**Stack**: Next.js 15 · TypeScript · Supabase Auth · PostgreSQL · Zod  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Date**: June 10, 2026  
**Scale**: 700 students · 20 classes · 10 teachers · 200 school days/year = ~140K attendance rows/year  
**References**: DATABASE_V2_FINAL.md · Permission Matrix v1.0 · CURRICULUM_MODULE_IMPLEMENTATION.md · NOTIFICATIONS_MODULE_IMPLEMENTATION.md

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
9. [Notifications](#9-notifications)
10. [Analytics & Reporting](#10-analytics--reporting)
11. [Performance Optimization](#11-performance-optimization)
12. [Parent Alerts](#12-parent-alerts)
13. [Principal Monitoring Dashboard](#13-principal-monitoring-dashboard)
14. [Risk Analysis](#14-risk-analysis)
15. [Testing Checklist](#15-testing-checklist)

---

## 1. Database Schema

### 1.1 `attendance` Table

```sql
CREATE TYPE attendance_status AS ENUM (
    'present',      -- Student attended full day
    'absent',       -- Student did not attend
    'late',         -- Student arrived after start time
    'half_day'      -- Student attended only part of the day
);

CREATE TYPE attendance_override_reason AS ENUM (
    'medical',          -- Medical certificate provided
    'family_emergency', -- Family emergency documented
    'administrative',   -- Admin correction (audited)
    'system_error',     -- System error correction (rare)
    'other'             -- Other reason (requires text explanation)
);

CREATE TABLE attendance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           UUID NOT NULL REFERENCES schools(id),
    student_id          UUID NOT NULL REFERENCES students(id),
    class_id            UUID NOT NULL REFERENCES classes(id),
    academic_term_id    UUID NOT NULL REFERENCES academic_terms(id),
    date                DATE NOT NULL,
    status              attendance_status NOT NULL,
    marked_by           UUID NOT NULL REFERENCES teachers(id),
    marked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    remarks             TEXT,
    
    -- Override tracking (principal/admin)
    overridden_by       UUID REFERENCES users(id),
    overridden_at       TIMESTAMPTZ,
    override_reason     attendance_override_reason,
    override_notes      TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Exactly one record per student per day
    UNIQUE(student_id, date)
) PARTITION BY RANGE (date);

-- Create partitions (monthly for this scale)
-- At 700 students × 200 days = 140K rows/year (~11.7K/month)
-- Monthly partitions are well-sized
CREATE TABLE attendance_2026_04 PARTITION OF attendance
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE attendance_2026_05 PARTITION OF attendance
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE attendance_2026_06 PARTITION OF attendance
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE attendance_2026_07 PARTITION OF attendance
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- Auto-create next month's partition via pg_cron

-- Critical indexes
CREATE INDEX idx_attendance_class_date ON attendance(class_id, date)
    INCLUDE (student_id, status);
-- Powers: teacher daily sheet, batch marking load

CREATE INDEX idx_attendance_student_date ON attendance(student_id, date)
    INCLUDE (status, class_id);
-- Powers: student history, parent view, trends

CREATE INDEX idx_attendance_term_class ON attendance(academic_term_id, class_id, student_id)
    INCLUDE (status, date);
-- Powers: term reports, analytics rollup

CREATE INDEX idx_attendance_date_status ON attendance(school_id, date, status)
    INCLUDE (class_id)
    WHERE status IN ('absent', 'late');
-- Powers: principal monitoring, parent alert queries

CREATE INDEX idx_attendance_marked_by ON attendance(marked_by, date)
    WHERE overridden_by IS NULL;
-- Powers: teacher audit, edit-own-marks check
```

### 1.2 ENUMs

```sql
-- Already exists in V2:
-- attendance_status: present, absent, late, half_day

-- New for V2:
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:marked';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:batch_marked';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:edited';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:overridden';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:deleted';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:exported';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'attendance:alert_sent';
```

### 1.3 Materialized View: Daily Attendance Summary

```sql
CREATE MATERIALIZED VIEW mv_daily_attendance AS
SELECT
    school_id,
    class_id,
    date,
    COUNT(*) AS total_students,
    COUNT(*) FILTER (WHERE status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_count,
    COUNT(*) FILTER (WHERE status = 'late') AS late_count,
    COUNT(*) FILTER (WHERE status = 'half_day') AS half_day_count,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('present', 'late'))::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
    ) AS present_percentage,
    MAX(marked_at) AS last_marked_at
FROM attendance
GROUP BY school_id, class_id, date;

CREATE UNIQUE INDEX idx_mv_daily_attendance ON mv_daily_attendance(school_id, class_id, date);

-- Refresh strategy: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_attendance;
-- Run via pg_cron every 5 min during school hours, hourly otherwise
```

### 1.4 Materialized View: Student Monthly Rollup

```sql
-- Powers: trends, parent dashboard, risk detection
CREATE MATERIALIZED VIEW mv_student_monthly_attendance AS
SELECT
    school_id,
    student_id,
    class_id,
    DATE_TRUNC('month', date) AS month,
    COUNT(*) AS total_days,
    COUNT(*) FILTER (WHERE status = 'present') AS present_days,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_days,
    COUNT(*) FILTER (WHERE status = 'late') AS late_days,
    COUNT(*) FILTER (WHERE status = 'half_day') AS half_day_days,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('present', 'late'))::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
    ) AS attendance_percentage
FROM attendance
GROUP BY school_id, student_id, class_id, DATE_TRUNC('month', date);

CREATE UNIQUE INDEX idx_mv_student_monthly ON mv_student_monthly_attendance(school_id, student_id, month);
CREATE INDEX idx_mv_student_monthly_class ON mv_student_monthly_attendance(class_id, month);

-- Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_monthly_attendance;
-- Run via pg_cron daily at midnight
```

### 1.5 RLS Policies

```sql
-- Attendance: teacher can manage own class's attendance
CREATE POLICY attendance_teacher_manage ON attendance FOR ALL
    USING (
        school_id = current_setting('app.current_school_id')::UUID
        AND class_id IN (
            SELECT tcs.class_id FROM teacher_class_subjects tcs
            WHERE tcs.teacher_id = current_setting('app.current_teacher_id')::UUID
              AND tcs.deleted_at IS NULL
        )
    );

-- Attendance: student views own records only
CREATE POLICY attendance_student_view ON attendance FOR SELECT
    USING (
        student_id = current_setting('app.current_student_id')::UUID
    );

-- Attendance: parent views children's records
CREATE POLICY attendance_parent_view ON attendance FOR SELECT
    USING (
        student_id IN (
            SELECT sp.student_id FROM student_parents sp
            JOIN parents p ON p.id = sp.parent_id
            WHERE p.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Attendance: principal/admin view all
CREATE POLICY attendance_admin_view ON attendance FOR SELECT
    USING (
        school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') IN ('school_admin', 'principal')
    );

-- Override: principal/admin can UPDATE (not INSERT) with override fields
CREATE POLICY attendance_override ON attendance FOR UPDATE
    USING (
        school_id = current_setting('app.current_school_id')::UUID
        AND current_setting('app.current_role') IN ('school_admin', 'principal')
    )
    WITH CHECK (
        overridden_by = current_setting('app.current_user_id')::UUID
        AND override_reason IS NOT NULL
    );
```

---

## 2. Folder Structure

```
src/modules/attendance/
├── attendance.service.ts            # Business logic
├── attendance.repository.ts         # Database access
├── attendance.router.ts             # API route handlers
├── attendance.validator.ts          # Zod schemas
├── attendance.schema.ts             # TypeScript types
├── attendance.utils.ts              # Date helpers, status utilities
│
src/core/notifications/
├── attendance-alert.service.ts      # Parent alert triggers
│
src/core/analytics/
├── attendance-analytics.service.ts  # Trends, rollups, MV refresh
│
src/core/dashboard/
├── principal-attendance.widget.ts   # Principal dashboard widget
```

---

## 3. Schemas (Zod)

```typescript
const UUID = z.string().uuid();
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const AttendanceStatus = z.enum(['present', 'absent', 'late', 'half_day']);
const OverrideReason = z.enum(['medical', 'family_emergency', 'administrative', 'system_error', 'other']);

// ─── Single Student Marking ────────────────────────────────────

export const MarkAttendanceSchema = z.object({
  student_id: UUID,
  class_id: UUID,
  date: DateString,
  status: AttendanceStatus,
  remarks: z.string().max(200).optional(),
});

// ─── Batch Marking ─────────────────────────────────────────────

export const BatchAttendanceMarkSchema = z.object({
  class_id: UUID,
  date: DateString,
  academic_term_id: UUID,
  records: z.array(
    z.object({
      student_id: UUID,
      status: AttendanceStatus,
      remarks: z.string().max(200).optional(),
    })
  ).min(1).max(50),  // One class at a time; max 50 for atomic batch
});

// ─── Quick Mark (class defaults) ───────────────────────────────

export const QuickMarkSchema = z.object({
  class_id: UUID,
  date: DateString,
  academic_term_id: UUID,
  default_status: AttendanceStatus,       // Applied to ALL students
  exceptions: z.array(
    z.object({
      student_id: UUID,
      status: AttendanceStatus,           // Override for specific students
    })
  ).max(10).optional(),
});

// ─── Edit / Override ───────────────────────────────────────────

export const EditAttendanceSchema = z.object({
  status: AttendanceStatus,
  remarks: z.string().max(200).nullable().optional(),
}).refine(data => data.status !== undefined || data.remarks !== undefined, {
  message: 'At least one of status or remarks must be provided',
});

export const OverrideAttendanceSchema = z.object({
  status: AttendanceStatus,
  override_reason: OverrideReason,
  override_notes: z.string().min(10).max(500),  // Required for audit
  remarks: z.string().max(200).nullable().optional(),
});

// ─── History Query ─────────────────────────────────────────────

export const AttendanceHistorySchema = z.object({
  student_id: UUID.optional(),
  class_id: UUID.optional(),
  from_date: DateString.optional(),
  to_date: DateString.optional(),
  status: AttendanceStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Trends ────────────────────────────────────────────────────

export const AttendanceTrendSchema = z.object({
  class_id: UUID.optional(),
  student_id: UUID.optional(),
  from_date: DateString,
  to_date: DateString,
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});

// ─── Principal Dashboard ───────────────────────────────────────

export const PrincipalAttendanceQuerySchema = z.object({
  class_id: UUID.optional(),
  from_date: DateString.optional(),
  to_date: DateString.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Response Types ────────────────────────────────────────────

export const AttendanceRecordSchema = z.object({
  id: z.string().uuid(),
  student_id: z.string().uuid(),
  student_name: z.string(),
  roll_number: z.string().nullable(),
  class_id: z.string().uuid(),
  date: z.string(),
  status: AttendanceStatus,
  marked_by: z.string().uuid(),
  marked_by_name: z.string(),
  marked_at: z.string(),
  remarks: z.string().nullable(),
  overridden_by: z.string().uuid().nullable(),
  override_reason: z.string().nullable(),
  override_notes: z.string().nullable(),
});

export const BatchAttendanceResultSchema = z.object({
  total: z.number(),
  errors: z.array(z.object({
    student_id: z.string().uuid(),
    error: z.string(),
  })),
});

export const AttendanceSummarySchema = z.object({
  class_id: z.string().uuid(),
  class_name: z.string(),
  date: z.string(),
  total: z.number(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  half_day: z.number(),
  present_percentage: z.number(),
  marked_by: z.string().nullable(),
  status: z.enum(['marked', 'partial', 'unmarked']),
});

export const StudentAttendanceTrendSchema = z.object({
  student_id: z.string().uuid(),
  student_name: z.string(),
  periods: z.array(z.object({
    period: z.string(),
    present_days: z.number(),
    total_days: z.number(),
    percentage: z.number(),
  })),
  overall_percentage: z.number(),
  trend_direction: z.enum(['improving', 'stable', 'declining', 'critical']),
});

export const PrincipalAttendanceOverviewSchema = z.object({
  today: z.object({
    total_students: z.number(),
    marked: z.number(),
    unmarked: z.number(),
    present_pct: z.number(),
    classes_with_low_attendance: z.array(z.object({
      class_id: z.string().uuid(),
      class_name: z.string(),
      present_pct: z.number(),
    })),
  }),
  weekly_trend: z.array(z.object({
    date: z.string(),
    present_pct: z.number(),
  })),
  top_alert_students: z.array(z.object({
    student_id: z.string().uuid(),
    student_name: z.string(),
    class_name: z.string(),
    attendance_pct: z.number(),
    consecutive_absences: z.number(),
    alert_level: z.enum(['warning', 'critical']),
  })),
  classes_summary: z.array(z.object({
    class_id: z.string().uuid(),
    class_name: z.string(),
    total_students: z.number(),
    attendance_pct: z.number(),
    trend: z.enum(['improving', 'stable', 'declining']),
  })),
});
```

---

## 4. Services

```typescript
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly audit: AuditService,
    private readonly cache: CacheManager,
    private readonly authz: AuthorizationService,
    private readonly alertSvc: AttendanceAlertService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── Mark Attendance ─────────────────────────────────────────

  async markAttendance(
    ctx: RequestContext,
    input: MarkAttendanceInput,
  ): Promise<AttendanceRecordResponse> {
    await this.authz.assert(ctx, 'attendance:mark', { classId: input.class_id });

    // Validate student belongs to class
    const student = await this.repo.getStudentInClass(input.student_id, input.class_id);
    if (!student) throw new NotFoundError('Student not in this class');

    // Validate date is within current academic term (no holidays, weekends are allowed — teacher decides)
    const isSchoolDay = await this.repo.isDateInAcademicTerm(input.date, ctx.schoolId);
    if (!isSchoolDay) {
      throw new ValidationError('Date is outside the current academic term');
    }

    // Resolve academic term if not provided (required for NOT NULL DB column)
    const termId = await this.repo.getCurrentTermId(ctx.schoolId);
    if (!termId) throw new ValidationError('No active academic term found. Cannot mark attendance.');

    // Check for duplicate (upsert)
    const existing = await this.repo.findByStudentAndDate(input.student_id, input.date);
    if (existing) {
      // Teacher can edit own marks within 24 hours
      const hoursSinceMark = diffHours(new Date(), existing.marked_at);
      if (existing.marked_by !== ctx.profileId || hoursSinceMark > 24) {
        throw new ForbiddenError(
          'Marks older than 24 hours or created by another teacher require principal override'
        );
      }
    }

    const record = await this.repo.upsert({
      student_id: input.student_id,
      class_id: input.class_id,
      date: input.date,
      status: input.status,
      remarks: input.remarks,
      academic_term_id: termId,
      school_id: ctx.schoolId,
      marked_by: ctx.profileId!,
      marked_at: new Date().toISOString(),
    });

    await this.invalidateAttendanceCache(input.class_id, input.date);
    await this.audit.log({
      eventType: existing ? 'attendance:edited' : 'attendance:marked',
      actorId: ctx.userId,
      resourceType: 'attendance',
      resourceId: record.id,
      outcome: 'success',
      changes: { before: existing ?? null, after: { status: input.status } },
    });

    // Trigger parent alert for absent/late
    if (input.status === 'absent' || input.status === 'late') {
      await this.eventBus.publish('attendance:alert', {
        studentId: input.student_id,
        date: input.date,
        status: input.status,
        schoolId: ctx.schoolId,
      });
    }

    return record;
  }

  // ─── Batch Mark ──────────────────────────────────────────────

  async batchMarkAttendance(
    ctx: RequestContext,
    input: BatchAttendanceMarkInput,
  ): Promise<BatchAttendanceResult> {
    await this.authz.assert(ctx, 'attendance:mark', { classId: input.class_id });

    // Verify teacher teaches this class
    const teaches = await this.repo.teacherTeachesClass(ctx.profileId!, input.class_id);
    if (!teaches) throw new ForbiddenError('You do not teach this class');

    // Validate all students belong to class
    const classStudents = await this.repo.getClassStudentIds(input.class_id);
    const studentSet = new Set(classStudents.map(s => s.id));
    const errors: BatchError[] = [];

    for (const rec of input.records) {
      if (!studentSet.has(rec.student_id)) {
        errors.push({ student_id: rec.student_id, error: 'Student not in this class' });
      }
    }
    if (errors.length > 0) {
      throw new ValidationError(`${errors.length} student(s) not in this class`, errors);
    }

    // Resolve academic term if not provided
    const termId = input.academic_term_id ?? await this.repo.getCurrentTermId(ctx.schoolId);
    if (!termId) throw new ValidationError('No active academic term found. Cannot mark attendance.');

    const result = await this.repo.batchUpsert({
      records: input.records,
      class_id: input.class_id,
      date: input.date,
      academic_term_id: termId,
      school_id: ctx.schoolId,
      marked_by: ctx.profileId!,
    });

    await this.invalidateAttendanceCache(input.class_id, input.date);
    await this.audit.log({
      eventType: 'attendance:batch_marked',
      actorId: ctx.userId,
      resourceType: 'attendance',
      resourceId: `batch:${input.class_id}:${input.date}`,
      outcome: 'success',
      changes: { count: result.total },
    });

    // Trigger absent parent alerts in background
    const absentStudents = input.records.filter(r => r.status === 'absent' || r.status === 'late');
    for (const s of absentStudents) {
      await this.eventBus.publish('attendance:alert', {
        studentId: s.student_id,
        date: input.date,
        status: s.status,
        schoolId: ctx.schoolId,
      });
    }

    return result;
  }

  // ─── Quick Mark (default + exceptions) ──────────────────────

  async quickMarkAttendance(
    ctx: RequestContext,
    input: QuickMarkInput,
  ): Promise<BatchAttendanceResult> {
    await this.authz.assert(ctx, 'attendance:mark', { classId: input.class_id });

    const classStudents = await this.repo.getClassStudentIds(input.class_id);
    const exceptionMap = new Map(input.exceptions?.map(e => [e.student_id, e.status]));

    const records = classStudents.map(s => ({
      student_id: s.id,
      status: exceptionMap.get(s.id) ?? input.default_status,
    }));

    return this.batchMarkAttendance(ctx, {
      ...input,
      records,
    });
  }

  // ─── Edit Attendance ─────────────────────────────────────────

  async editAttendance(
    ctx: RequestContext,
    attendanceId: string,
    input: EditAttendanceInput,
  ): Promise<AttendanceRecordResponse> {
    await this.authz.assert(ctx, 'attendance:edit');

    const existing = await this.repo.findById(attendanceId);
    if (!existing) throw new NotFoundError('Attendance record not found');

    // Self-edit within 24 hours
    const hoursSinceMark = diffHours(new Date(), existing.marked_at);
    if (existing.marked_by !== ctx.profileId && ctx.role !== 'school_admin') {
      throw new ForbiddenError('Only the marking teacher or admin can edit this record');
    }
    if (hoursSinceMark > 24 && ctx.role !== 'school_admin') {
      throw new ForbiddenError('Records older than 24 hours require principal override');
    }

    const updated = await this.repo.update(attendanceId, {
      status: input.status,
      remarks: input.remarks ?? existing.remarks,
    });

    await this.invalidateAttendanceCache(existing.class_id, existing.date);
    await this.audit.log({
      eventType: 'attendance:edited',
      actorId: ctx.userId,
      resourceType: 'attendance',
      resourceId: attendanceId,
      outcome: 'success',
      changes: { before: { status: existing.status }, after: { status: input.status } },
    });

    return updated;
  }

  // ─── Override Attendance (principal/admin) ──────────────────

  async overrideAttendance(
    ctx: RequestContext,
    attendanceId: string,
    input: OverrideAttendanceInput,
  ): Promise<AttendanceRecordResponse> {
    await this.authz.assert(ctx, 'attendance:override');

    const existing = await this.repo.findById(attendanceId);
    if (!existing) throw new NotFoundError('Attendance record not found');

    const updated = await this.repo.update(attendanceId, {
      status: input.status,
      remarks: input.remarks ?? existing.remarks,
      overridden_by: ctx.userId,
      overridden_at: new Date().toISOString(),
      override_reason: input.override_reason,
      override_notes: input.override_notes,
    });

    await this.invalidateAttendanceCache(existing.class_id, existing.date);

    // Notify original teacher about override
    await this.eventBus.publish('attendance:overridden', {
      attendanceId,
      teacherId: existing.marked_by,
      schoolId: ctx.schoolId,
      date: existing.date,
      studentId: existing.student_id,
      oldStatus: existing.status,
      newStatus: input.status,
      reason: input.override_notes,
    });

    await this.audit.log({
      eventType: 'attendance:overridden',
      actorId: ctx.userId,
      resourceType: 'attendance',
      resourceId: attendanceId,
      outcome: 'success',
      changes: {
        before: { status: existing.status, marked_by: existing.marked_by },
        after: { status: input.status, overridden_by: ctx.userId, reason: input.override_reason },
      },
    });

    return updated;
  }

  // ─── History ─────────────────────────────────────────────────

  async getHistory(
    ctx: RequestContext,
    query: AttendanceHistoryQuery,
  ): Promise<PaginatedResult<AttendanceRecordResponse>> {
    // Scope enforcement
    if (ctx.role === 'student' && query.student_id !== ctx.profileId) {
      throw new ForbiddenError('Students can only view their own attendance');
    }
    if (ctx.role === 'parent') {
      const isChild = await this.repo.isParentOfStudent(ctx.userId, query.student_id!);
      if (!isChild) throw new ForbiddenError('Not your child');
    }
    if (ctx.role === 'teacher' && query.class_id) {
      const teaches = await this.repo.teacherTeachesClass(ctx.profileId!, query.class_id);
      if (!teaches) throw new ForbiddenError('You do not teach this class');
    }

    await this.authz.assert(ctx, 'attendance:view', query);

    const cacheKey = `attendance:history:${JSON.stringify(query)}`;
    return this.cache.getOrSet(cacheKey, async () => {
      return this.repo.findHistory({
        schoolId: ctx.schoolId,
        ...query,
      });
    }, 120); // 2 min cache
    // Note: `getTodayDate()`, `diffHours()`, `subDays()` are shared utility functions
    // imported from `src/utils/date-utils.ts`
  }

  // ─── Trends ──────────────────────────────────────────────────

  async getTrends(
    ctx: RequestContext,
    query: AttendanceTrendQuery,
  ): Promise<StudentAttendanceTrendResponse> {
    await this.authz.assert(ctx, 'attendance:view_trends', query);

    if (ctx.role === 'student' && query.student_id !== ctx.profileId) {
      throw new ForbiddenError('Students can only view their own trends');
    }

    const cacheKey = `attendance:trends:${query.student_id}:${query.from_date}:${query.to_date}`;
    return this.cache.getOrSet(cacheKey, async () => {
      return this.repo.getTrends(ctx.schoolId, query);
    }, 300); // 5 min cache
  }

  // ─── Principal Dashboard ─────────────────────────────────────

  async getPrincipalOverview(
    ctx: RequestContext,
  ): Promise<PrincipalAttendanceOverviewResponse> {
    await this.authz.assert(ctx, 'attendance:view_all');

    const cacheKey = `attendance:principal:dashboard:${ctx.schoolId}:${getTodayDate()}`;
    return this.cache.getOrSet(cacheKey, async () => {  const today = getTodayDate();

          // 1. Today's summary (from MV or direct query)
          const todaySummary = await this.repo.getTodaySummary(ctx.schoolId, today);

          // 2. Weekly trend (last 7 school days)
          const weeklyTrend = await this.repo.getWeeklyTrend(ctx.schoolId, today);

          // 3. At-risk students (consecutive absences, low attendance)
          const atRiskStudents = await this.repo.getAtRiskStudents(ctx.schoolId, {
        thresholdPct: 75,        // Below 75% attendance
        consecutiveAbsences: 3,  // 3+ consecutive absences
        limit: 10,
      });

      // 4. Per-class summary
      const classesSummary = await this.repo.getClassSummaries(ctx.schoolId);

      return {
        today: {
          ...todaySummary,
          classes_with_low_attendance: classesSummary
            .filter(c => c.attendance_pct < 80)
            .map(c => ({ class_id: c.class_id, class_name: c.class_name, present_pct: c.attendance_pct })),
        },
        weekly_trend: weeklyTrend,
        top_alert_students: atRiskStudents,
        classes_summary: classesSummary,
      };
    }, 60); // 1 min cache
  }

  // ─── Teacher Daily Sheet ─────────────────────────────────────

  async getDailySheet(
    ctx: RequestContext,
    classId: string,
    date: string,
  ): Promise<DailySheetResponse> {
    await this.authz.assert(ctx, 'attendance:mark', { classId });

    const cacheKey = `attendance:daily_sheet:${classId}:${date}`;
    return this.cache.getOrSet(cacheKey, async () => {
      const students = await this.repo.getClassStudentsWithAttendance(classId, date);
      const markedCount = students.filter(s => s.status !== null).length;

      return {
        class_id: classId,
        date,
        total_students: students.length,
        marked_count: markedCount,
        status: markedCount === 0 ? 'unmarked'
          : markedCount < students.length ? 'partial' : 'marked',
        students: students.map(s => ({
          student_id: s.id,
          roll_number: s.roll_number,
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status ?? 'unmarked',
          remarks: s.remarks ?? null,
        })),
      };
    }, 30); // 30 sec cache (teacher might be actively marking)
  }

  // ─── Cache Helpers ──────────────────────────────────────────

  private async invalidateAttendanceCache(classId: string, date: string): Promise<void> {
    await this.cache.invalidate(`attendance:daily_sheet:${classId}:${date}`);
    await this.cache.invalidate(`attendance:principal:dashboard:*`);
    // MV will be refreshed by scheduled job — stale data acceptable for 5 min
  }
}
```

---

## 5. Repositories

```typescript
export class AttendanceRepository {
  constructor(private readonly db: ReturnType<typeof createClient>) {}

  // ─── Core Queries ───────────────────────────────────────────

  async findByStudentAndDate(studentId: string, date: string): Promise<any | null> {
    const { data } = await this.db.from('attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('date', date)
      .single();
    return data;
  }

  async findById(id: string): Promise<any | null> {
    const { data } = await this.db.from('attendance')
      .select('*, students!inner(first_name, last_name), teachers!inner(first_name, last_name)')
      .eq('id', id)
      .single();
    return data;
  }

  async upsert(input: any): Promise<any> {
    const { data } = await this.db.from('attendance').upsert({
      school_id: input.school_id,
      student_id: input.student_id,
      class_id: input.class_id,
      academic_term_id: input.academic_term_id,
      date: input.date,
      status: input.status,
      marked_by: input.marked_by,
      marked_at: input.marked_at,
      remarks: input.remarks ?? null,
    }, { onConflict: 'student_id, date' }).select().single();
    return data;
  }

  async batchUpsert(input: {
    records: Array<{ student_id: string; status: string; remarks?: string }>;
    class_id: string;
    date: string;
    academic_term_id: string;
    school_id: string;
    marked_by: string;
  }): Promise<{ total: number }> {
    // ⚠️ Supabase upsert does not distinguish created vs updated in the response.
    // The `count` from .select('id', { count: 'exact' }) returns ALL matched rows,
    // not just newly inserted ones. Return total only.
    // For accurate created/updated breakdown, run a pre-check query first.

    const rows = input.records.map(r => ({
      school_id: input.school_id,
      student_id: r.student_id,
      class_id: input.class_id,
      academic_term_id: input.academic_term_id,
      date: input.date,
      status: r.status,
      marked_by: input.marked_by,
      remarks: r.remarks ?? null,
    }));

    const { error } = await this.db.from('attendance')
      .upsert(rows, { onConflict: 'student_id, date', ignoreDuplicates: false });

    if (error) throw error;
    return { total: input.records.length };
  }

  async update(id: string, data: any): Promise<any> {
    const { data: updated } = await this.db.from('attendance')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return updated;
  }

  // ─── Student Validation ─────────────────────────────────────

  async getStudentInClass(studentId: string, classId: string): Promise<any | null> {
    const { data } = await this.db.from('students')
      .select('id, roll_number')
      .eq('id', studentId)
      .eq('class_id', classId)
      .is('deleted_at', null)
      .single();
    return data;
  }

  async getClassStudentIds(classId: string): Promise<Array<{ id: string }>> {
    const { data } = await this.db.from('students')
      .select('id')
      .eq('class_id', classId)
      .is('deleted_at', null)
      .order('roll_number', { ascending: true });
    return data ?? [];
  }

  async teacherTeachesClass(teacherId: string, classId: string): Promise<boolean> {
    const { data } = await this.db.from('teacher_class_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .is('deleted_at', null);
    return !!data;
  }

  async isParentOfStudent(userId: string, studentId: string): Promise<boolean> {
    const { data } = await this.db.from('student_parents')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .in('parent_id', this.db.from('parents').select('id').eq('user_id', userId));
    return !!data;
  }

  async isDateInAcademicTerm(date: string, schoolId: string): Promise<boolean> {
    const { data } = await this.db.from('academic_terms')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .gte('start_date', date)
      .lte('end_date', date);
    return !!data;
  }

  async getCurrentTermId(schoolId: string): Promise<string | null> {
    const { data } = await this.db.from('academic_terms')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single();
    return data?.id ?? null;
  }

  // ─── Parent Alert Queries ──────────────────────────────────

  async getStudentParents(studentId: string): Promise<Array<{ user_id: string }>> {
    const { data } = await this.db.from('student_parents')
      .select('parents!inner(user_id)')
      .eq('student_id', studentId);
    return (data ?? []).map((r: any) => ({ user_id: r.parents.user_id }));
  }

  async getStudentBasic(studentId: string): Promise<{ id: string; first_name: string; last_name: string } | null> {
    const { data } = await this.db.from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();
    return data;
  }

  async getConsecutiveAbsenceCount(studentId: string, latestDate: string): Promise<number> {
    // Count consecutive absent days ending at latestDate
    const { data } = await this.db.rpc('get_consecutive_absences', {
      p_student_id: studentId,
      p_latest_date: latestDate,
    });
    return data ?? 0;
  }

  // ─── Daily Sheet ────────────────────────────────────────────

  async getClassStudentsWithAttendance(classId: string, date: string): Promise<any[]> {
    // ⚠️ Use parameterized query — do NOT interpolate date string directly.
    // Supabase's `eq` filter on a join doesn't support `attendance.date.eq` syntax.
    // Instead, use rpc or a two-query approach:

    // Step 1: Fetch all students in class
    const { data: students } = await this.db.from('students')
      .select('id, first_name, last_name, roll_number')
      .eq('class_id', classId)
      .is('deleted_at', null)
      .order('roll_number', { ascending: true });

    // Step 2: Fetch attendance for this class+date
    const { data: attendance } = await this.db.from('attendance')
      .select('student_id, status, remarks, marked_at, marked_by')
      .eq('class_id', classId)
      .eq('date', date);

    // Step 3: Merge
    const attendanceMap = new Map((attendance ?? []).map((a: any) => [a.student_id, a]));
    return (students ?? []).map((s: any) => ({
      ...s,
      status: attendanceMap.get(s.id)?.status ?? null,
      remarks: attendanceMap.get(s.id)?.remarks ?? null,
      marked_by: attendanceMap.get(s.id)?.marked_by ?? null,
      marked_at: attendanceMap.get(s.id)?.marked_at ?? null,
    }));
  }

  // ─── History ────────────────────────────────────────────────

  async findHistory(query: any): Promise<any> {
    let q = this.db.from('attendance')
      .select('*, students!inner(first_name, last_name, roll_number), teachers!inner(first_name, last_name)')
      .eq('school_id', query.schoolId);

    if (query.student_id) q = q.eq('student_id', query.student_id);
    if (query.class_id) q = q.eq('class_id', query.class_id);
    if (query.from_date) q = q.gte('date', query.from_date);
    if (query.to_date) q = q.lte('date', query.to_date);
    if (query.status) q = q.eq('status', query.status);

    q = q.order('date', { ascending: false })
      .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    const { data, count } = await q;
    return { data: data ?? [], total: count ?? 0, page: query.page, limit: query.limit };
  }

  // ─── Trends ─────────────────────────────────────────────────

  async getTrends(schoolId: string, query: any): Promise<any> {
    // Use materialized view for monthly rollups
    const { data } = await this.db.from('mv_student_monthly_attendance')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', query.student_id)
      .gte('month', query.from_date)
      .lte('month', query.to_date)
      .order('month', { ascending: true });

    const periods = data ?? [];
    const overall = periods.length > 0
      ? periods.reduce((s: number, p: any) => s + p.attendance_percentage, 0) / periods.length
      : 0;

    // Trend direction: compare last 2 periods
    let trend: string;
    if (periods.length < 2) {
      trend = 'stable';
    } else {
      const latest = periods[periods.length - 1].attendance_percentage;
      const prev = periods[periods.length - 2].attendance_percentage;
      const diff = latest - prev;
      trend = diff > 5 ? 'improving' : diff < -5 ? 'declining' : 'stable';
    }

    return {
      student_id: query.student_id,
      student_name: '',
      periods,
      overall_percentage: Math.round(overall * 10) / 10,
      trend_direction: overall < 40 ? 'critical' : trend,
    };
  }

  // ─── Principal Dashboard ────────────────────────────────────

  async getTodaySummary(schoolId: string, date: string): Promise<any> {
    // Use materialized view for fast aggregation
    const { data } = await this.db.from('mv_daily_attendance')
      .select('*')
      .eq('school_id', schoolId)
      .eq('date', date);

    const rows = data ?? [];
    return {
      total_students: rows.reduce((s: number, r: any) => s + r.total_students, 0),
      marked: rows.filter((r: any) => r.present_percentage !== null).length,
      unmarked: rows.filter((r: any) => r.present_percentage === null).length,
      present_pct: rows.length > 0
        ? Math.round(rows.reduce((s: number, r: any) => s + r.present_percentage, 0) / rows.length)
        : 100,
    };
  }

  async getWeeklyTrend(schoolId: string, today: string): Promise<any[]> {
    const sevenDaysAgo = subDays(today, 7); // subDays from src/utils/date-utils.ts
    const { data } = await this.db.from('mv_daily_attendance')
      .select('date, present_percentage')
      .eq('school_id', schoolId)
      .gte('date', sevenDaysAgo)
      .lte('date', today)
      .order('date', { ascending: true });

    return (data ?? []).map((r: any) => ({
      date: r.date,
      present_pct: r.present_percentage,
    }));
  }

  async getAtRiskStudents(schoolId: string, opts: {
    thresholdPct: number;
    consecutiveAbsences: number;
    limit: number;
  }): Promise<any[]> {
    // Query: students with low monthly attendance AND recent consecutive absences
    const { data } = await this.db.rpc('get_at_risk_attendance_students', {
      p_school_id: schoolId,
      p_threshold_pct: opts.thresholdPct,
      p_consecutive_absences: opts.consecutiveAbsences,
      p_limit: opts.limit,
    });
    return data ?? [];
  }

  async getClassSummaries(schoolId: string): Promise<any[]> {
    const { data } = await this.db.from('mv_daily_attendance')
      .select(`
        class_id,
        classes!inner(name, section),
        total_students,
        present_percentage
      `)
      .eq('school_id', schoolId)
      .eq('date', getTodayDate()) // getTodayDate from src/utils/date-utils.ts
      .order('present_percentage', { ascending: true });

    return (data ?? []).map((r: any) => ({
      class_id: r.class_id,
      class_name: `${r.classes.name} ${r.classes.section ?? ''}`.trim(),
      total_students: r.total_students,
      attendance_pct: r.present_percentage,
      trend: 'stable', // Computed by comparing to day before
    }));
  }
}
```

---

## 6. API Routes

### 6.1 POST /attendance/mark — Mark a single student

```http
POST /attendance/mark
Role: teacher (own class), school_admin

Request: {
  student_id: UUID,
  class_id: UUID,
  date: "2026-06-10",
  status: "present|absent|late|half_day",
  remarks?: string (max 200)
}

Response: 201 { data: AttendanceRecordResponse }
Response: 200 { data: AttendanceRecordResponse } (if upsert)

Errors:
- 403: Teacher does not teach this class
- 404: Student not in this class
- 422: Validation error

Audit: attendance:marked / attendance:edited
Cache: invalidates daily_sheet for class+date
Notifications: triggers absent/late parent alert
```

### 6.2 POST /attendance/batch — Batch mark entire class

```http
POST /attendance/batch
Role: teacher (own class), school_admin

Request: {
  class_id: UUID,
  date: "2026-06-10",
  academic_term_id: UUID,
  records: [
    { student_id: UUID, status: "present", remarks?: string },
    ...
  ]  // 1-50 records
}

Response: 200 {
  data: {
    total: 35,
    errors: []
  }
}

Errors:
- 403: Teacher does not teach this class
- 422: Student(s) not in class (with details)

Audit: attendance:batch_marked
Cache: invalidates daily_sheet
Notifications: triggers absent/late alerts for all absent students
```

### 6.3 POST /attendance/quick-mark — Quick mark with defaults

```http
POST /attendance/quick-mark
Role: teacher (own class), school_admin

Request: {
  class_id: UUID,
  date: "2026-06-10",
  academic_term_id: UUID,
  default_status: "present",
  exceptions?: [
    { student_id: UUID, status: "absent" },
    ...
  ]  // max 10 exceptions
}

Response: 200 { data: BatchAttendanceResult }

Use case: "Everyone was present except these 3 students"
Performance: Single batch upsert, no per-student lookups
```

### 6.4 PATCH /attendance/{id} — Edit attendance (self-edit within 24h)

```http
PATCH /attendance/{id}
Role: teacher (own marks within 24h), school_admin

Request: {
  status?: "present|absent|late|half_day",
  remarks?: string | null
}

Response: 200 { data: AttendanceRecordResponse }

Errors:
- 403: Not the marking teacher, or >24h old
- 404: Record not found

Constraints:
- Teacher can only edit own marks
- Teacher can only edit within 24 hours of marking
- After 24h: use POST /attendance/{id}/override
```

### 6.5 POST /attendance/{id}/override — Principal/admin override

```http
POST /attendance/{id}/override
Role: principal, school_admin

Request: {
  status: "present|absent|late|half_day",
  override_reason: "medical|family_emergency|administrative|system_error|other",
  override_notes: string (10-500 chars, required for audit)
}

Response: 200 { data: AttendanceRecordResponse }

Audit: attendance:overridden (with before/after + reason)
Notifications: notifies original teacher via event bus
Constraints: override_reason and override_notes are REQUIRED
```

### 6.6 GET /attendance/daily-sheet — Get class daily sheet

```http
GET /attendance/daily-sheet?class_id=UUID&date=2026-06-10
Role: teacher (own class), school_admin, principal

Response: 200 {
  data: {
    class_id: UUID,
    date: "2026-06-10",
    total_students: 35,
    marked_count: 30,
    status: "partial",          // "unmarked" | "partial" | "marked"
    students: [
      { student_id, roll_number, first_name, last_name, status, remarks },
      ...
    ]
  }
}

Cached: 30 seconds
```

### 6.7 GET /attendance/history — Attendance history

```http
GET /attendance/history?student_id=UUID&from_date=...&to_date=...
  &class_id=UUID&status=absent&page=1&limit=50
Role: school_admin, principal, teacher (own class), student (own), parent (children)

Response: 200 {
  data: [
    { id, student_id, student_name, roll_number, date, status,
      marked_by, marked_by_name, marked_at, remarks,
      overridden_by, override_reason }
  ],
  total: 200,
  page: 1,
  limit: 50
}

Cached: 2 min
Scoping: filters by role (student=own, parent=children, teacher=own class)
```

### 6.8 GET /attendance/trends — Attendance trends

```http
GET /attendance/trends?student_id=UUID&from_date=2026-04-01&to_date=2026-06-10
  &granularity=monthly
Role: school_admin, principal, teacher (own class), student (own), parent (children)

Response: 200 {
  data: {
    student_id: UUID,
    student_name: "Priya Sharma",
    periods: [
      { period: "2026-04", present_days: 18, total_days: 20, percentage: 90 },
      { period: "2026-05", present_days: 15, total_days: 22, percentage: 68.2 },
    ],
    overall_percentage: 78.6,
    trend_direction: "declining"
  }
}

Cached: 5 min (uses mv_student_monthly_attendance)
```

### 6.9 GET /attendance/principal/dashboard — Principal monitoring

```http
GET /attendance/principal/dashboard
Role: school_admin, principal

Response: 200 {
  data: PrincipalAttendanceOverviewResponse
}

Cached: 1 min
Powers the principal attendance monitoring widget
```

### 6.10 GET /attendance/summary — Class summary for a date

```http
GET /attendance/summary?class_id=UUID&date=2026-06-10
Role: school_admin, principal, teacher (own class)

Response: 200 {
  data: AttendanceSummary
}
```

### 6.11 POST /attendance/export — Export attendance to CSV

```http
POST /attendance/export
Role: school_admin, principal, teacher (own class)

Request: {
  class_id?: UUID,
  from_date: "2026-04-01",
  to_date: "2026-06-10",
  status?: "present|absent|late|half_day",
  format: "csv"
}

Response: 200 { data: { download_url: string } }

Audit: attendance:exported
Limits: max 6 months per export, async processing for >1000 records
```

---

## 7. Permissions

### 7.1 Permission Map

| Action | School Admin | Principal | Teacher | Student | Parent |
|--------|:-----------:|:---------:|:-------:|:-------:|:------:|
| View attendance | ✅ | ✅ | 🔷 (class) | 📋 (own) | 🔷 (children) |
| Mark attendance | ✅ | ❌ | 🔷 (class) | ❌ | ❌ |
| Batch mark | ✅ | ❌ | 🔷 (class) | ❌ | ❌ |
| Quick mark | ✅ | ❌ | 🔷 (class) | ❌ | ❌ |
| Edit own marks (≤24h) | ✅ | ❌ | 🔷 (own) | ❌ | ❌ |
| Override (any mark) | ✅ | 🔶 | ❌ | ❌ | ❌ |
| View trends | ✅ | ✅ | 🔷 (class) | 📋 (own) | 🔷 (children) |
| View daily sheet | ✅ | ✅ | 🔷 (class) | ❌ | ❌ |
| Principal dashboard | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export attendance | ✅ | ✅ | 🔷 (class) | ❌ | ❌ |

### 7.2 Scope Rules

| Rule | Enforcement |
|------|-------------|
| Teacher marks only own classes | `teacher_class_subjects` + `attendance.class_id` match |
| Teacher edits only own marks | `attendance.marked_by == ctx.profileId` |
| Teacher edit window ≤24h | Service-level check on `marked_at` |
| Student views own records only | `attendance.student_id == ctx.profileId` |
| Parent views children only | `student_parents` join check |
| Principal overrides require reason | `override_reason` and `override_notes` required |

### 7.3 Permission Assertion Patterns

```typescript
await this.authz.assert(ctx, 'attendance:mark', { classId });
await this.authz.assert(ctx, 'attendance:edit');              // Own marks, 24h window
await this.authz.assert(ctx, 'attendance:override');          // Principal/admin only
await this.authz.assert(ctx, 'attendance:view', { classId }); // Role-scoped
await this.authz.assert(ctx, 'attendance:view_trends', { studentId });
await this.authz.assert(ctx, 'attendance:view_all');          // Principal dashboard
```

---

## 8. Validation Rules

| Rule | Layer | Error |
|------|-------|-------|
| One record per student per day | DB UNIQUE + upsert | Auto handled (upsert) |
| Date not in future | Service + Zod | 422 |
| Date not in past academic year | Service | 422 |
| Student belongs to class | Repository check | 404 |
| Teacher teaches class | Repository check | 403 |
| Batch max 50 records | Zod | 422 |
| Exceptions max 10 in quick mark | Zod | 422 |
| Edit within 24h | Service | 403 |
| Override requires reason | Zod + service | 422 |
| Remarks max 200 chars | Zod | 422 |
| Override notes min 10 chars | Zod | 422 |
| Export max 6 months | Service | 400 |

---

## 9. Notifications

### 9.1 Parent Alert Triggers

| Event | Channel | Priority | Message Template |
|-------|---------|----------|------------------|
| Student marked **absent** | in_app, whatsapp | normal | `{{child_name}} was marked absent on {{date}}. Reason: {{remarks or "not specified"}}` |
| Student marked **late** | in_app | normal | `{{child_name}} arrived late on {{date}} at {{time}}.` |
| Student marked **absent 3+ consecutive days** | in_app, whatsapp, email | high | `{{child_name}} has been absent for {{count}} consecutive days ({{from_date}} - {{to_date}}). Please contact the school.` |
| Student attendance < 75% (monthly) | in_app, email | high | `{{child_name}}'s attendance has dropped to {{pct}}% this month. Regular attendance is essential for academic progress.` |
| Attendance record **overridden** | in_app | normal | `{{child_name}}'s attendance record for {{date}} has been updated. New status: {{status}}.` |

### 9.2 Alert Service

```typescript
export class AttendanceAlertService {
  constructor(
    private readonly notifSvc: NotificationService,
    private readonly repo: AttendanceRepository,
  ) {}

  async handleAttendanceMarked(event: {
    studentId: string;
    date: string;
    status: string;
    schoolId: string;
  }): Promise<void> {
    if (event.status === 'present' || event.status === 'half_day') return;

    const parents = await this.repo.getStudentParents(event.studentId);
    if (parents.length === 0) return;

    const student = await this.repo.getStudentBasic(event.studentId);
    const alertType = event.status === 'absent' ? 'attendance:absent' : 'attendance:late';

    // Send alert to all linked parents
    for (const parent of parents) {
      await this.notifSvc.send({
        userId: parent.user_id,
        type: alertType,
        channels: event.status === 'absent' ? ['in_app', 'whatsapp'] : ['in_app'],
        title: 'Attendance Alert',
        body: `${student.first_name} ${student.last_name} was marked ${event.status} on ${event.date}.`,
        metadata: {
          studentId: event.studentId,
          date: event.date,
          status: event.status,
        },
      });
    }

    // Check for consecutive absences (3+)
    if (event.status === 'absent') {
      const consecutive = await this.repo.getConsecutiveAbsenceCount(
        event.studentId, event.date);
      if (consecutive >= 3) {
        await this.sendConsecutiveAbsenceAlert(parents, student, consecutive, event.date);
      }
    }
  }

  private async sendConsecutiveAbsenceAlert(
    parents: any[], student: any, count: number, latestDate: string,
  ): Promise<void> {
    for (const parent of parents) {
      await this.notifSvc.send({
        userId: parent.user_id,
        type: 'attendance:consecutive_absence',
        channels: ['in_app', 'whatsapp', 'email'],
        priority: 'high',
        title: '⚠️ Repeated Absence Alert',
        body: `${student.first_name} ${student.last_name} has been absent for ${count} consecutive school days. Please contact the class teacher urgently.`,
        metadata: { studentId: student.id, count, latestDate },
      });
    }
  }
}
```

### 9.3 Notification Delivery Rules

| Rule | Detail |
|------|--------|
| Present/half_day | No notification (no news is good news) |
| Late | In-app only (low urgency) |
| Absent | In-app + WhatsApp (immediate notification) |
| 3+ consecutive absences | All channels + high priority |
| Monthly <75% | End-of-month summary |
| Quiet hours | No WhatsApp/email 9PM–7AM |
| Parent opt-out | Per-channel per-student (stored in preferences) |

---

## 10. Analytics & Reporting

### 10.1 Materialized Views (Refreshed)

| View | Refresh | Data Staleness | Powers |
|------|---------|----------------|--------|
| `mv_daily_attendance` | Every 5 min during school hours | ~5 min | Daily sheet, principal dashboard, class summaries |
| `mv_student_monthly_attendance` | Nightly at midnight | ~1 day | Trends, parent dashboard, risk detection |

### 10.2 Dashboard Widgets

| Widget | Source | Role |
|--------|--------|------|
| **Today's attendance %** | `mv_daily_attendance` TODAY | Teacher, Principal |
| **Class coverage** (marked vs unmarked) | `attendance` direct query | Teacher |
| **Weekly trend** (7-day line chart) | `mv_daily_attendance` last 7 days | Principal |
| **Low-attendance classes** (<80%) | `mv_daily_attendance` TODAY | Principal |
| **At-risk students** (consecutive absences) | `rpc get_at_risk_attendance_students` | Principal, Teacher |
| **Student monthly trend** | `mv_student_monthly_attendance` | Student, Parent |
| **Student vs class average** | `mv_student_monthly_attendance` + class avg | Student, Parent |

### 10.3 Risk Detection

```typescript
// Attendance risk detection runs daily via pg_cron or Celery
// Writes to student_risk_flags table (see DATABASE_V2_FINAL.md)

const RISK_THRESHOLDS = {
  WARNING: {
    monthly_attendance_pct: 80,    // Below 80% = warning
    consecutive_absences: 3,       // 3+ consecutive = warning
  },
  CRITICAL: {
    monthly_attendance_pct: 60,    // Below 60% = critical
    consecutive_absences: 5,       // 5+ consecutive = critical
  },
};

// Detection query:
// SELECT student_id, COUNT(*) AS absent_days
// FROM attendance
// WHERE date >= NOW() - INTERVAL '30 days'
//   AND status = 'absent'
// GROUP BY student_id
// HAVING COUNT(*) >= 7;  // 7+ absences in 30 days = risk
```

### 10.4 Principal Attendance Report

```sql
-- Weekly attendance report for principal
SELECT
    c.name AS class_name,
    c.section,
    COUNT(DISTINCT a.student_id) AS total_students,
    COUNT(*) AS total_records,
    ROUND(COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::NUMERIC
        / NULLIF(COUNT(*), 0) * 100, 1) AS overall_pct,
    ROUND(AVG(
        COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::NUMERIC
        / NULLIF(COUNT(*), 0) * 100
    ) OVER (PARTITION BY a.class_id ORDER BY a.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1)
        AS rolling_7_day_avg
FROM attendance a
JOIN classes c ON c.id = a.class_id
WHERE a.school_id = :schoolId
  AND a.date >= NOW() - INTERVAL '7 days'
GROUP BY c.name, c.section, a.class_id;
```

---

## 11. Performance Optimization

### 11.1 Scale Profile: 700 students · 20 classes · 10 teachers

| Metric | Value |
|--------|-------|
| Students per class | ~35 (700 / 20) |
| Classes per teacher | ~6 (some teachers share across classes) |
| Daily attendance rows | 700 (one per student) |
| Monthly rows | ~14,000 (700 × 20 school days) |
| Annual rows | ~140,000 |
| Batch size per teacher | ~35 students / class |

### 11.2 Caching Strategy

| Cache Key | TTL | Invalidation | Size |
|-----------|-----|-------------|------|
| `attendance:daily_sheet:{classId}:{date}` | 30s | On mark/edit/override | ~5 KB per class |
| `attendance:history:{query}` | 120s | None (read-only) | ~50 KB per query |
| `attendance:trends:{studentId}:{dates}` | 300s | On mark (daily only) | ~1 KB per student |
| `attendance:principal:dashboard:{schoolId}` | 60s | On any mark | ~10 KB per school |
| `attendance:summary:{classId}:{date}` | 60s | On mark/edit | ~500 B per class |

**Memory estimate at peak**: ~20 classes × 5 KB + 1 principal dashboard × 10 KB ≈ **110 KB total** — negligible.

### 11.3 Query Optimization

| Query | Strategy | Expected P99 |
|-------|----------|-------------|
| Daily sheet (35 students) | LEFT JOIN with date filter on attendance index | <20ms |
| Batch upsert (35 records) | Single upsert with onConflict | <50ms |
| History (paginated, 50 rows) | Covering index on (student_id, date) INCLUDE (status) | <30ms |
| Monthly trend (1 student) | Materialized view mv_student_monthly_attendance | <10ms |
| Principal dashboard | Materialized view mv_daily_attendance + RPC | <100ms |
| At-risk students | `rpc get_at_risk_attendance_students` (optimized SQL) | <200ms |

### 11.4 Index Maintenance

```sql
-- At 140K rows/year, index maintenance is lightweight.
-- Reindex quarterly after partition creation:
REINDEX INDEX idx_attendance_class_date;
REINDEX INDEX idx_attendance_student_date;
REINDEX INDEX idx_attendance_term_class;
REINDEX INDEX idx_attendance_date_status;

-- Refresh MVs concurrently (non-blocking):
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_attendance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_monthly_attendance;
```

### 11.5 Partition Management

```sql
-- Auto-create next month's partition (pg_cron):
SELECT cron.schedule('create-attendance-partition', '0 0 1 * *',
  $$
  DO $$
  DECLARE
    next_month DATE := DATE_TRUNC('month', NOW() + INTERVAL '2 months');
    partition_name TEXT := 'attendance_' || TO_CHAR(next_month, 'YYYY_MM');
    start_date TEXT := TO_CHAR(next_month, 'YYYY-MM-DD');
    end_date TEXT := TO_CHAR(next_month + INTERVAL '1 month', 'YYYY-MM-DD');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF attendance
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  END $$;
  $$
);
```

### 11.6 API Rate Limiting

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /attendance/batch` | 30 | 1 minute | Per teacher |
| `POST /attendance/quick-mark` | 30 | 1 minute | Per teacher |
| `POST /attendance/mark` | 60 | 1 minute | Per teacher |
| `PATCH /attendance/{id}` | 30 | 1 minute | Per user |
| `POST /attendance/{id}/override` | 10 | 1 minute | Per user |
| `GET /attendance/*` | 120 | 1 minute | Per user |

---

## 12. Parent Alerts

### 12.1 Alert Flow

```
Teacher marks absent ──> AttendanceService.markAttendance()
                                │
                                ▼
                       eventBus.publish('attendance:alert')
                                │
                                ▼
                   AttendanceAlertService.handleAttendanceMarked()
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              Check status  Check count  Lookup parents
                    │           │           │
                    ▼           ▼           ▼
              Send in-app   If 3+ days:  Send to all
              + WhatsApp    all channels  linked parents
                    │
                    ▼
              NotificationService.send()
```

### 12.2 Alert Templates

| Scenario | Channel | Priority | Template |
|----------|---------|----------|----------|
| Absent (1-2 days) | in_app, whatsapp | normal | `📢 {{child}} was absent on {{date}}.` |
| Late arrival | in_app | low | `⏰ {{child}} was marked late on {{date}}.` |
| 3+ consecutive absences | in_app, whatsapp, email | high | `⚠️ {{child}} has been absent for {{count}} days. Please contact the school.` |
| Monthly <75% | in_app, email | high | `📊 {{child}}'s attendance this month: {{pct}}%. Regular attendance is important.` |
| Mark corrected | in_app | normal | `✅ {{child}}'s attendance for {{date}} has been updated to {{status}}.` |

### 12.3 Alert Suppression

| Rule | Implementation |
|------|----------------|
| No duplicate alerts for same student+date | Check existing alert before sending |
| Quiet hours (9PM–7AM) | Queue and send at 8AM |
| Weekly digest instead of daily | Optional parent preference |
| Opt-out per channel | `notification_preferences` table |
| School holidays auto-detected | No alerts on non-school days |

---

## 13. Principal Monitoring Dashboard

### 13.1 Widget Definitions

```typescript
interface PrincipalAttendanceDashboard {
  // Widget 1: Today's Overview (top card)
  today: {
    total_students: number;      // 700
    marked: number;              // 680
    unmarked: number;            // 20
    present_pct: number;         // 89.5 (% of marked)
    absent_pct: number;          // 10.5
    classes_with_low_attendance: Array<{
      class_id: string;
      class_name: string;        // "Grade 10 A"
      present_pct: number;       // 62%
    }>;
  };

  // Widget 2: Weekly Trend (line chart, 7 datapoints)
  weekly_trend: Array<{
    date: string;                // "2026-06-04"
    present_pct: number;         // 91.2
  }>;

  // Widget 3: At-Risk Students (alert list, max 10)
  top_alert_students: Array<{
    student_id: string;
    student_name: string;         // "Rahul Verma"
    class_name: string;           // "Grade 10 B"
    attendance_pct: number;       // 45.0
    consecutive_absences: number; // 5
    alert_level: 'warning' | 'critical';
  }>;

  // Widget 4: Per-Class Summary (sortable table, 20 rows)
  classes_summary: Array<{
    class_id: string;
    class_name: string;           // "Grade 10 A"
    total_students: number;       // 35
    attendance_pct: number;       // 82.3
    trend: 'improving' | 'stable' | 'declining';
  }>;
}
```

### 13.2 Query Profile

```sql
-- Widget 1 & 4: Today's summary per class (from MV)
SELECT * FROM mv_daily_attendance
WHERE school_id = :schoolId AND date = CURRENT_DATE
ORDER BY present_percentage ASC;

-- Widget 2: Weekly trend (from MV)
SELECT date, AVG(present_percentage) AS present_pct
FROM mv_daily_attendance
WHERE school_id = :schoolId
  AND date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date ORDER BY date;

-- Widget 3: At-risk students (optimized RPC)
SELECT s.id, s.first_name, s.last_name,
       c.name AS class_name,
       ROUND(
         COUNT(*) FILTER (WHERE a.status = 'absent' AND a.date >= DATE_TRUNC('month', CURRENT_DATE))::NUMERIC
         / NULLIF(COUNT(*) FILTER (WHERE a.date >= DATE_TRUNC('month', CURRENT_DATE)), 0) * 100
       ) AS attendance_pct,
       COUNT(*) FILTER (WHERE a.status = 'absent' AND a.date >= CURRENT_DATE - 5) AS consecutive_absences
FROM students s
JOIN classes c ON c.id = s.class_id
JOIN attendance a ON a.student_id = s.id
WHERE s.school_id = :schoolId AND s.deleted_at IS NULL
  AND a.date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY s.id, s.first_name, s.last_name, c.name
HAVING
  COUNT(*) FILTER (WHERE a.status = 'absent' AND a.date >= DATE_TRUNC('month', CURRENT_DATE))::NUMERIC
  / NULLIF(COUNT(*), 0) * 100 >= 25
  OR COUNT(*) FILTER (WHERE a.status = 'absent' AND a.date >= CURRENT_DATE - 5) >= 3
ORDER BY consecutive_absences DESC, attendance_pct ASC
LIMIT 10;
```

---

## 14. Risk Analysis

### 14.1 Security Risks

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Teacher marks attendance for wrong class** | Medium | Incorrect attendance records | Backend validates `teacher_class_subjects` before mark. RLS enforces scope. |
| 2 | **Batch mark includes wrong students** | Medium | Wrong students get absent/late marks | All student_ids validated against class roster before upsert |
| 3 | **Principal override without reason** | High | Audit trail broken | `override_reason` and `override_notes` are Zod-required (10-500 chars) |
| 4 | **Teacher edits marks beyond 24h** | Medium | Stale data manipulated | Service-level check on `marked_at`. After 24h, requires principal override |
| 5 | **Parent sees another child's attendance** | High | Privacy violation | `student_parents` join check on every parent query |
| 6 | **Student manipulates attendance data** | Critical | Fraudulent attendance | Student role has SELECT-only on attendance table (RLS). No INSERT/UPDATE/DELETE. |
| 7 | **Cross-school data leak** | High | Tenant isolation breach | `school_id` filter on every query + RLS |

### 14.2 Data Integrity Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Duplicate attendance records** | Conflicting status for same student+date | `UNIQUE(student_id, date)` constraint with upsert |
| 2 | **Override without audit trail** | Undocumented grade changes | Override requires reason + notes. All changes logged. |
| 3 | **Missing attendance for a day** | Incomplete reports | Daily sheet shows "unmarked" vs "partial" vs "marked" status. Principal dashboard flags unmarked classes. |
| 4 | **Attendance marked on school holiday** | Incorrect statistics | Frontend calendar restricts to school days. Backend validates against academic_term. |
| 5 | **Student transferred mid-month** | Attendance split across classes | Attendance history preserved per class_id. New class starts fresh. |

### 14.3 Performance Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 1 | **Batch mark for 35 students × 10 teachers = 350 writes in 5 min window** | Partition contention | Monthly partitions spread writes. Batch upsert is atomic per class. 35 rows is negligible. |
| 2 | **Principal dashboard query scans all 140K rows** | Slow dashboard load | Materialized views pre-compute rollups. RPC optimized for at-risk query. |
| 3 | **Cache stampede at 8:00 AM (all teachers marking)** | DB connection spike | 30s TTL on daily sheet prevents stampede. Each class has separate cache key. |
| 4 | **MV refresh at same time as batch marking** | Lock contention | `REFRESH MATERIALIZED VIEW CONCURRENTLY` is non-blocking. 5-min refresh window. |
| 5 | **History query across 6 months** | Slow paginated query | Covering index on `(student_id, date) INCLUDE (status)`. Pagination limits to 50 rows. |

### 14.4 Concurrency Note: Batch Upsert Race Condition

**Scenario**: Two teachers in the same class (e.g., a subject teacher and a class teacher) mark attendance simultaneously for the same students but different dates.
- **Risk**: Low — `UNIQUE(student_id, date)` means they operate on different rows.

**Scenario**: Two teachers mark the SAME student for the SAME date simultaneously.
- **Risk**: Last-write-wins. The second upsert overwrites the first.
- **Mitigation**: The `marked_by` and `marked_at` fields will reflect the last writer. This is acceptable for a school system — the last teacher to mark has the correct status. If both teachers mark at the exact same millisecond, one wins by DB transaction order. Audit log captures both attempts.
- **V2 limitation**: No row-level locking or advisory locks. Not needed for 10 teachers × 700 students scale.

### 14.5 V1 Mistakes Not to Repeat

| V1 Mistake | V2 Fix |
|-----------|--------|
| No batch marking — teachers marked one student at a time | `POST /attendance/batch` and `POST /attendance/quick-mark` |
| No parent alerts for absence | `AttendanceAlertService` with real-time event bus |
| No edit window enforcement | 24-hour self-edit window, then principal override required |
| No principal monitoring dashboard | `GET /attendance/principal/dashboard` with 4 widgets |
| No attendance trends | `mv_student_monthly_attendance` with trend direction (improving/stable/declining/critical) |
| No materialized views — dashboard queries scanned full table | `mv_daily_attendance` (5-min refresh) + `mv_student_monthly_attendance` (nightly) |
| No override audit trail | `override_reason` + `override_notes` required. Before/after logged in audit. |
| No partitioning — V1 had 29 tables with no partitioning | Monthly partitions auto-created via pg_cron |

---

## 15. Testing Checklist

### 15.1 Unit Tests

| Test | Expected | Priority |
|------|----------|----------|
| `mark: single student present` | Record created, cache invalidated | P0 |
| `mark: duplicate for same student+date` | Upsert — existing record updated | P0 |
| `mark: student not in class` | 404 | P0 |
| `mark: teacher doesn't teach class` | 403 | P0 |
| `mark: triggers absent alert` | Event published for absent/late | P0 |
| `batch: 35 students` | All 35 created, result returned | P0 |
| `batch: one student not in class` | 422 with details | P0 |
| `batch: validates max 50 records` | 422 | P1 |
| `batch: triggers alerts for absent students` | 1 event per absent student | P0 |
| `quick-mark: default present, 3 exceptions` | 32 present + 3 absent = 35 total | P0 |
| `edit: own mark within 24h` | Updated | P0 |
| `edit: own mark after 24h` | 403, suggests override | P0 |
| `edit: another teacher's mark` | 403 | P0 |
| `override: valid reason provided` | Updated with override fields | P0 |
| `override: no reason provided` | 422 | P0 |
| `history: student view own` | Returns only their records | P0 |
| `history: parent view child` | Returns child's records | P0 |
| `history: parent view non-child` | 403 | P0 |
| `history: teacher view own class` | Returns class records | P0 |
| `trends: returns periods from MV` | 4 monthly periods | P0 |
| `trends: declining trend detected` | trend_direction = 'declining' | P1 |
| `principal-dashboard: returns all widgets` | 4 widgets populated | P0 |
| `daily-sheet: 35 students, 30 marked` | status='partial', 30 marked | P0 |

### 15.2 Integration Tests

| Test | Expected | Priority |
|------|----------|----------|
| Batch mark → verify daily sheet updated | Sheet shows all 35 marked | P0 |
| Mark absent → verify parent gets notification | Alert created for both parents | P0 |
| 3 consecutive absences → verify high-priority alert | Alert with 'high' priority sent via all channels | P0 |
| Override attendance → verify original teacher notified | In-app notification for teacher | P0 |
| Principal dashboard → verify all widgets match raw queries | Data consistent with direct SQL | P0 |
| MV refresh → verify dashboard reflects latest marks | After refresh, marks appear in dashboard | P1 |

### 15.3 Security Tests

| Test | Expected | Priority |
|------|----------|----------|
| Student marks own attendance | 403 | P0 |
| Parent marks attendance for child | 403 | P0 |
| Teacher marks attendance for non-assigned class | 403 | P0 |
| Teacher edits another teacher's mark | 403 | P0 |
| Teacher edits mark after 24 hours | 403 | P0 |
| Principal overrides without reason | 422 | P0 |
| Parent views non-child attendance | 403 or empty | P0 |
| Student views another student's attendance | 403 or empty | P0 |
| Cross-school attendance access | 403 or empty | P0 |

### 15.4 Performance Tests

| Test | Target | Method |
|------|--------|--------|
| Batch mark 35 students | <100ms | Single upsert |
| Daily sheet load (35 students) | <20ms | LEFT JOIN with index |
| History page (50 rows, 6 months) | <50ms | Covering index |
| Principal dashboard (700 students) | <200ms | Materialized views |
| Weekly trend (7 days) | <20ms | MV + 7 rows |
| At-risk query (10 students) | <100ms | Optimized RPC |

---

## Appendix A: Error Codes

```typescript
export const ATTENDANCE_ERROR_CODES = {
  ATT_400_01: { status: 400, message: 'Export limited to 6 months of data.' },
  ATT_400_02: { status: 400, message: 'Date cannot be in the future.' },
  ATT_400_03: { status: 400, message: 'Date outside current academic term.' },

  ATT_403_01: { status: 403, message: 'You do not teach this class.' },
  ATT_403_02: { status: 403, message: 'Only the marking teacher can edit this record.' },
  ATT_403_03: { status: 403, message: 'Records older than 24 hours require principal override.' },
  ATT_403_04: { status: 403, message: 'Students can only view their own attendance.' },
  ATT_403_05: { status: 403, message: 'Not your child.' },

  ATT_404_01: { status: 404, message: 'Student not found in this class.' },
  ATT_404_02: { status: 404, message: 'Attendance record not found.' },

  ATT_422_01: { status: 422, message: 'Override reason and notes are required.' },
  ATT_422_02: { status: 422, message: 'Batch limited to 50 records.' },
  ATT_422_03: { status: 422, message: 'Exception list limited to 10 students.' },
  ATT_422_04: { status: 422, message: 'Student(s) not in this class.' },
} as const;
```

---

## Appendix B: SQL Functions

```sql
-- Function: get_at_risk_attendance_students
-- Used by principal dashboard, risk detection
CREATE OR REPLACE FUNCTION get_at_risk_attendance_students(
    p_school_id UUID,
    p_threshold_pct NUMERIC DEFAULT 75,
    p_consecutive_absences INTEGER DEFAULT 3,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    student_id UUID,
    student_name TEXT,
    class_name TEXT,
    attendance_pct NUMERIC,
    consecutive_absences INTEGER,
    alert_level TEXT
) LANGUAGE SQL STABLE AS $$
  WITH monthly_attendance AS (
    SELECT
      s.id,
      s.first_name || ' ' || s.last_name AS student_name,
      c.name || ' ' || COALESCE(c.section, '') AS class_name,
      ROUND(
        COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'late')::NUMERIC
        / NULLIF(COUNT(*) FILTER (WHERE a.date >= DATE_TRUNC('month', CURRENT_DATE)), 0) * 100, 1
      ) AS attendance_pct,
      COUNT(*) FILTER (WHERE a.status = 'absent' AND a.date >= CURRENT_DATE - 5) AS consecutive_absences
    FROM students s
    JOIN classes c ON c.id = s.class_id
    LEFT JOIN attendance a ON a.student_id = s.id
      AND a.date >= DATE_TRUNC('month', CURRENT_DATE)
    WHERE s.school_id = p_school_id AND s.deleted_at IS NULL
    GROUP BY s.id, s.first_name, s.last_name, c.name, c.section
  )
  SELECT
    id, student_name, class_name, attendance_pct, consecutive_absences,
    CASE
      WHEN attendance_pct < 60 OR consecutive_absences >= 5 THEN 'critical'
      ELSE 'warning'
    END AS alert_level
  FROM monthly_attendance
  WHERE attendance_pct < p_threshold_pct OR consecutive_absences >= p_consecutive_absences
  ORDER BY consecutive_absences DESC, attendance_pct ASC
  LIMIT p_limit;
$$;
```

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement module scaffolding, create SQL migration for attendance partitions + MVs, and begin API endpoint development
