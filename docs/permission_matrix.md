# ATHON V2 — Permission Matrix & Security Review

**Reviewers**: Google Security Engineer, Principal Backend Engineer, Principal SaaS Architect, EdTech Compliance Expert  
**Date**: June 10, 2026  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Reference**: API Spec v2.0, System Design v1.0, Backend Architecture v1.0

---

## Table of Contents

1. [Permission Matrix](#1-permission-matrix)
2. [RBAC Design](#2-rbac-design)
3. [Least Privilege Model](#3-least-privilege-model)
4. [Audit Log Requirements](#4-audit-log-requirements)
5. [Recommended Security Architecture](#5-recommended-security-architecture)
6. [Security Risks & Mitigations](#6-security-risks--mitigations)
7. [Permission Leaks & Data Exposure Risks](#7-permission-leaks--data-exposure-risks)
8. [Key Security Questions Answered](#8-key-security-questions-answered)

---

## 1. Permission Matrix

### Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Full access (own scope) |
| 🔷 | Limited access (scoped) |
| ❌ | No access |
| 🔶 | Requires approval/audit |
| 📋 | Read-only access |

### School Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | 🔷 | ❌ | ❌ | ❌ |

### Users Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Create | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Edit | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | 🔷 | ❌ | ❌ | ❌ |

**Notes**:
- Principal can create/edit students and parents, but NOT teachers or admins
- Principal CANNOT delete any user (admin only, with audit)
- Teacher can view students in their own classes only
- All user deletions are soft-delete + logged

### Teachers Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | ✅ | ❌ | ❌ | ❌ |

**Notes**:
- Teacher can view other teacher names only (for collaboration), not their full profile
- Teacher CANNOT edit or delete other teachers
- All teacher assignments to classes are logged

### Students Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Create | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Edit | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | ❌ | 🔷 |
| Export | ✅ | ✅ | 🔷 | ❌ | ❌ |

**Notes**:
- Teacher views students in own classes only
- Parent views own children only
- Student views own profile only
- Teacher CANNOT delete students
- Student data export requires admin approval (compliance)

### Parents Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | ❌ | 📋 |
| Create | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Edit | ✅ | 🔷 | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | ✅ | ❌ | ❌ | ❌ |

**Notes**:
- Teacher can view parent contact info for students in own class only
- Parent views own profile only
- Parent CANNOT edit other parents or their own children's data

### Classes Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 🔷 | 🔷 |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Export | ✅ | ✅ | 🔷 | ❌ | ❌ |

**Notes**:
- Teacher views own classes only
- Student views own class only
- Parent views child's class only
- Deleting a class requires moving students first

### Subjects Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | 🔷 | 🔷 |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export | ✅ | ✅ | ✅ | ❌ | ❌ |

**Notes**:
- Student views subjects in their class only
- Parent views subjects in their child's class only
- Deleting a subject is audited and prevented if it has active assignments

### Curriculum Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Export | ✅ | ✅ | ✅ | ❌ | ❌ |

**Notes**:
- Curriculum is school-owned, not teacher-owned
- CBSE default curriculum is pre-loaded; admin can customize
- Teacher CANNOT delete chapters/topics, only mark progress
- Progress marking is per-teacher, not shared

### Attendance Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Create | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Edit | 🔶 | 🔶 | 🔷 | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Export | ✅ | ✅ | 🔷 | ❌ | ❌ |

**Notes**:
- Teacher marks attendance for own classes only
- Teacher can edit their own marks within 24 hours; after that, requires principal approval
- Principal CANNOT mark attendance but CAN override with reason (audited)
- Student views own attendance only
- Parent views own children's attendance only
- All attendance edits are logged with before/after values

### Assignments Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 🔷 | 🔷 |
| Create | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Edit | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Delete | 🔶 | ❌ | 🔷 | ❌ | ❌ |
| Approve | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit | ❌ | ❌ | ❌ | 🔷 | ❌ |
| Grade | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Export | ✅ | ✅ | 🔷 | ❌ | ❌ |

**Notes**:
- Teacher creates/edits/deletes assignments for own classes only
- Teacher CANNOT delete an assignment after submissions exist (must archive)
- Student submits own assignments only
- Student CANNOT see other students' submissions or grades
- Parent views child's assignments (view only, no submission)
- Admin can override any teacher's assignment (audited)

### Assessments Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 🔷 | 🔷 |
| Create | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Edit | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Delete | 🔶 | ❌ | 🔷 | ❌ | ❌ |
| Approve | ❌ | ❌ | ❌ | ❌ | ❌ |
| Attempt | ❌ | ❌ | ❌ | 🔷 | ❌ |
| Grade | ✅ | ❌ | 🔷 | ❌ | ❌ |
| Override Grade | 🔶 | 🔶 | ❌ | ❌ | ❌ |

**Notes**:
- Teacher creates/edits/deletes assessments for own classes only
- Teacher CANNOT see answer keys for a published assessment until grading begins
- Student CANNOT see correct answers during an attempt
- Student sees own results only after teacher publishes
- Grade override by admin or principal is audited with reason required
- Parent views child's results only

### Progress Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Create | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve | ❌ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Export | ✅ | ✅ | 🔷 | ❌ | ❌ |

**Notes**:
- Progress is system-computed, never manually created or edited
- No role can create, edit, or delete progress records
- Risk flags can be resolved by teachers but not deleted

### Analytics Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Create | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve | ❌ | ❌ | ❌ | ❌ | ❌ |
| Monitor | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Export | ✅ | ✅ | 🔷 | 📋 | 🔷 |

**Notes**:
- Analytics is read-only for all roles
- Teacher views own class analytics only
- Student views own analytics only
- Parent views child's analytics only
- No role can create/edit/delete analytics data (system-computed)

### Notifications Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Create Template | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acknowledge | ✅ | ✅ | ✅ | ✅ | ✅ |

**Notes**:
- Teacher sends notifications to students in own classes and their parents
- Principal sends school-wide notifications
- Admin manages notification templates
- All sent notifications are logged with delivery status

### Announcements Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | 🔶 | 🔶 | ❌ | ❌ | ❌ |
| Pin | ✅ | ✅ | ❌ | ❌ | ❌ |
| Archive | ✅ | ✅ | ❌ | ❌ | ❌ |

**Notes**:
- Announcements are school-wide by default
- Principal CANNOT delete announcements created by admin (and vice versa)
- Deletion is soft-delete with audit
- Teacher CANNOT create announcements (use notifications for class-level)

### AI Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate (HW/Test/Lesson) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate (Report Comments) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate (Weekly Summary) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Generate (Insights) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Doubt Assistant | ❌ | ❌ | ❌ | ✅ | ❌ |
| Configure API | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Usage/Cost | ✅ | ✅ | 📋 | ❌ | ❌ |
| Disable AI (per-role) | ✅ | ❌ | ❌ | ❌ | ❌ |

**Notes**:
- AI generation is teacher-only (prevents abuse by students)
- Principal can generate insights (read-only aggregation, no cost concern)
- Student AI is limited to 20 questions/day with content safety
- Admin can disable AI per-role or school-wide
- All AI usage is logged for cost tracking

### Reports Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | 📋 | 🔷 |
| Generate | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Export (PDF) | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Export (CSV) | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Schedule | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |

**Notes**:
- Teacher generates reports for own classes only
- School-wide reports require principal or admin
- Student views own learning report only
- Parent views child's report only
- Report deletion requires admin

### Timetable Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | 🔶 | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export | ✅ | ✅ | ✅ | ✅ | ❌ |

**Notes**:
- Timetable is admin-managed; teachers and students view only
- Teacher views own schedule only
- Student views own class timetable only
- Parent views child's class timetable only
- Timetable changes trigger notification to affected teachers

### Lesson Plans Module

| Action | Admin | Principal | Teacher | Student | Parent |
|--------|:-----:|:---------:|:-------:|:-------:|:------:|
| View | ✅ | ✅ | 🔷 | ❌ | ❌ |
| Create | ❌ | ❌ | 🔷 | ❌ | ❌ |
| Edit | ❌ | ❌ | 🔷 | ❌ | ❌ |
| Delete | ❌ | ❌ | 🔷 | ❌ | ❌ |
| Share | ❌ | ❌ | 🔷 | ❌ | ❌ |
| Export | ✅ | ✅ | ✅ | ❌ | ❌ |

**Notes**:
- Lesson plans are teacher-owned; other teachers cannot view them by default
- Teacher can optionally share lesson plans (not in V2, V3 feature)
- Principal can view all lesson plans (monitoring, not editing)
- Admin CANNOT edit lesson plans (teacher intellectual property)

---

## 2. RBAC Design

### 2.1 Role Hierarchy

```
system_role (reserved for platform)
    |
super_admin (reserved for multi-school)
    |
school_admin
    |
    +-- principal (school_leader)
    |
    +-- teacher
    |       |
    |       +-- student (data-level, not role-level)
    |
    +-- parent (data-level, not role-level)
```

**Note**: `school_leader` and `principal` are the same role internally. `parent` and `student` inherit no roles — access is purely data-scoped.

### 2.2 Permission Inheritance Rules

| Rule | Description |
|------|-------------|
| **Upward inheritance** | Admin inherits principal's permissions (admin can do everything principal can, plus more) |
| **No downward inheritance** | Principal does NOT inherit teacher permissions. Principal cannot mark attendance or create assignments. |
| **Scope expansion** | Admin scope = whole school. Principal scope = whole school (read) + limited write. Teacher scope = own classes. Student scope = own data. Parent scope = own children. |
| **Override with audit** | Admin can override any teacher's action. Principal can override with limited scope. All overrides logged with reason. |

### 2.3 Role Assignment Rules

- **Super Admin**: Assigned by system (not available in UI)
- **School Admin**: One per school, assigned by super admin during setup
- **Principal**: Assigned by school admin. Maximum 2 per school.
- **Teacher**: Created by school admin. Automatically scoped to assigned classes.
- **Student**: Created by school admin or principal. Scoped to one class.
- **Parent**: Created by school admin or principal. Scoped to linked children.

### 2.4 Data Scoping

```
Every query must filter by BOTH role AND data scope:

Role check:   Is user allowed to perform this action at all?
Scope check:  Is user allowed to perform this action on THIS resource?

Examples:
- Teacher views student:     Role=teacher + Scope=own_class
- Teacher views other student:  Role=teacher + Scope=own_class -> FAIL (not in class)
- Parent views child:        Role=parent + Scope=own_children
- Parent views other child:  Role=parent + Scope=own_children -> FAIL
- Principal edits grade:     Role=principal -> FAIL (principal cannot grade)
- Admin edits grade:         Role=admin + Scope=whole_school + Audit required
```

### 2.5 Implementation Strategy

```
Backend enforcement (3 layers):

Layer 1: Route decorator (FastAPI middleware)
    @requires_role("teacher")
    @requires_school_access
    - Rejects unauthenticated requests
    - Rejects wrong-role requests
    - Rejects cross-school requests

Layer 2: Service assertion (business logic)
    await self.assert_teacher_teaches_class(teacher_id, class_id)
    - Ensures data-level access
    - Checks class ownership, subject assignment

Layer 3: Database RLS (defense-in-depth)
    CREATE POLICY student_access ON assignments
        FOR SELECT USING (school_id = app.current_school_id());
    - Even if API bug bypasses layers 1 and 2, RLS prevents data leak
```

---

## 3. Least Privilege Model

### 3.1 Principle

Every role has the MINIMUM permissions needed to perform their job function. No more.

### 3.2 Role-Specific Minimum Access

| Role | Why They Need | What They Do NOT Need |
|------|---------------|----------------------|
| **Admin** | Configure school, create users, monitor system | Grade assignments, view student passwords, access AI API keys |
| **Principal** | Monitor school-wide, identify issues, coach teachers | Mark attendance, create assignments, grade submissions, access student PII (health data) |
| **Teacher** | Mark attendance, create assignments, grade, communicate with parents | View other teachers' students, delete users, configure school, access other teachers' lesson plans |
| **Student** | Submit homework, take tests, view own progress | View other students' data, see answer keys, message other students, access AI generation tools |
| **Parent** | View own children's attendance, homework, test results | Submit assignments, message teachers directly, see other children's data, edit any data |

### 3.3 Edge Cases (Least Privilege Applied)

| Scenario | V1 Behaviour | V2 Least Privilege Behaviour |
|----------|-------------|-----------------------------|
| Teacher leaves school | Manual deactivation | Auto-scheduled deactivation after notice period. Data preserved for audit. |
| Student transfers class | Admin manually moves | Move requires both old and new class teacher notification. |
| Parent divorce | One parent loses access | Admin can split parent-student links. Only one parent notified of change. |
| Substitute teacher | Full teacher access | Temporary role with same-scope access, expires after 30 days. |
| Audit investigation | No restriction | Auditor role (read-only, all data, no export) for compliance. |
| Student graduates | Data archived | Automatic archiving after 90 days. No new data written. |

---

## 4. Audit Log Requirements

### 4.1 What Gets Logged

| Category | Events Logged | Retention |
|----------|---------------|-----------|
| **Authentication** | Login, logout, refresh, failed login attempts | 90 days |
| **User Management** | Create, update, deactivate, reactivate, role change | Permanent |
| **Data Access** | Bulk exports, student list views (by non-teachers), PII access | 1 year |
| **Data Mutation** | Create, edit, delete of all entities | 1 year |
| **Permission Changes** | Role changes, class assignment changes, override actions | Permanent |
| **Grade Changes** | Grade creation, grade override, grade revert | Permanent |
| **AI Usage** | Generation requests (teacher_id, type, tokens, cost) | 90 days |
| **Security Events** | Rate limit exceeded, suspicious activity, failed authorization | 1 year |
| **Configuration** | School config changes, AI enable/disable, notification settings | 1 year |
| **Data Export** | CSV/PDF exports triggered (who, what, when) | 1 year |

### 4.2 Audit Log Schema

```json
{
  "id": "uuid",
  "timestamp": "2026-06-10T08:15:00Z",
  "actor_id": "uuid",
  "actor_name": "Priya Sharma",
  "actor_role": "teacher",
  "action": "create",
  "resource_type": "assignment",
  "resource_id": "uuid",
  "resource_summary": "Created homework: Nutrition in Plants HW",
  "changes": {
    "before": null,
    "after": {
      "title": "Nutrition in Plants HW",
      "class_id": "uuid",
      "due_date": "2026-06-11T16:00:00Z"
    }
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "school_id": "uuid",
  "session_id": "uuid"
}
```

### 4.3 Audit Log Access

| Role | Can View | Can Export | Can Delete |
|------|----------|------------|------------|
| Super Admin | All logs | Yes | No (append-only) |
| School Admin | School logs | Yes | No |
| Principal | School logs (read-only) | No | No |
| Teacher | Own actions only | No | No |
| Student | Own actions only | No | No |
| Parent | Own actions only | No | No |

**Note**: Audit logs are append-only. No role can delete or modify audit records.

---

## 5. Recommended Security Architecture

### 5.1 Multi-Layer Security

```
Layer 1: Network
    - HTTPS only (TLS 1.3)
    - CORS whitelist (no wildcard origins)
    - API gateway rate limiting
    - DDoS protection

Layer 2: Authentication
    - Supabase JWT (JWKS-verified)
    - httpOnly cookies (no localStorage tokens)
    - Token refresh rotation
    - Account lockout after 5 failed attempts

Layer 3: Authorization (RBAC)
    - Route-level role decorators
    - Service-level data scoping
    - Resource-level ownership checks

Layer 4: Data Access
    - Row-Level Security (PostgreSQL RLS)
    - School_id scoping on every query
    - Soft-delete only (no hard deletes)
    - PII encryption at rest

Layer 5: Input/Output
    - Pydantic validation on all inputs
    - Output encoding (XSS prevention)
    - Content-Security-Policy headers
    - SQL injection prevention (parameterized queries)

Layer 6: Monitoring
    - Audit logging (all mutations)
    - Rate limit monitoring
    - Anomaly detection (unusual access patterns)
    - Security event alerting
```

### 5.2 School Isolation Architecture

```
Every request must pass 3 isolation checks:

1. JWT sub claim -> User lookup -> school_id
2. Route handler: @requires_school_access
3. Database query filters: WHERE school_id = current_school_id

Impossible to bypass because:
- JWT is signed by Supabase (cannot forge)
- school_id comes from DB, not request body
- RLS is final defense even if application layer fails

Cross-school data access requires super_admin role (not available in V2 UI)
```

### 5.3 PII Protection

| Data Element | Classification | Protection |
|-------------|---------------|------------|
| Student name | PII | Encrypted at rest. Access logged. |
| Student photo | PII | Encrypted at rest. S3 signed URLs expire 1hr. |
| Parent phone | PII | Encrypted at rest. Not exposed in list APIs. |
| Parent email | PII | Standard encryption. No bulk export. |
| Attendance records | Sensitive | Standard encryption. School-scoped. |
| Grades/scores | Educational record | Standard encryption. No cross-class access. |
| AI prompt data | Transient | Never stored. Stripped of PII before API call. |
| IP addresses | Security | Logged for 90 days. Not exposed to users. |

### 5.4 Rate Limiting Strategy

| Endpoint Group | Limit | Window | Scope |
|---------------|-------|--------|-------|
| `POST /auth/login` | 5 | 1 minute | Per IP |
| `POST /auth/forgot-password` | 3 | 1 hour | Per email |
| `GET /auth/me` | 60 | 1 minute | Per user |
| `POST /attendance/batch` | 30 | 1 minute | Per teacher |
| `POST /assignments` | 20 | 1 hour | Per teacher |
| `POST /assessments/attempt` | 3 | 1 hour | Per student |
| `POST /ai/*` | 10 | 1 minute | Per teacher |
| `POST /ai/doubt-assistant` | 20 | 1 day | Per student |
| `GET /analytics/*` | 30 | 1 minute | Per user |
| All other endpoints | 120 | 1 minute | Per user |

### 5.5 AI Abuse Prevention

```
Layer 1: Authentication
    - AI endpoints are role-gated (teacher-only for generation, student-only for doubts)
    - No anonymous AI access

Layer 2: Rate Limiting
    - Teacher: 10 generations/minute, 100/day
    - Student: 20 doubt questions/day, 5 practice sets/day
    - Principal: 10 insight generations/day

Layer 3: Content Safety
    - Input filtering (profanity, prompt injection attempts)
    - Output filtering (inappropriate content)
    - PII stripping before API call

Layer 4: Cost Control
    - Token budget per request: 4000 max
    - Daily cost limit per teacher: configurable
    - Cost alert: notify admin if daily AI cost exceeds $X
    - Usage dashboard for admin

Layer 5: Approval
    - All AI-generated content requires teacher review before publishing
    - AI cannot auto-publish homework, tests, or report comments
    - Student AI responses are pre-moderated (no harmful content)
```

### 5.6 Security Headers

```
All API responses:
    Strict-Transport-Security: max-age=31536000; includeSubDomains
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Content-Security-Policy: default-src 'self'
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    Cache-Control: no-store (for auth endpoints)

All frontend responses:
    Content-Security-Policy: (appropriate for SPA)
    X-XSS-Protection: 1; mode=block
```

---

## 6. Security Risks & Mitigations

| # | Risk | Severity | Impact | Mitigation |
|---|------|----------|--------|------------|
| 1 | **Privilege escalation**: Student calls AI generation endpoint | Critical | Student generates unlimited AI content, costs spike | Rate-limited per role. AI generation requires teacher role. No exceptions. |
| 2 | **Data leak**: Teacher accesses another teacher's class data | High | Privacy violation, grade manipulation | Service-level scope check: `assert_teacher_teaches_class()` before any data access |
| 3 | **Data leak**: Parent accesses another child's data | High | Privacy violation, legal risk | Parent endpoints filter by `parent_id` from JWT, NOT from request body |
| 4 | **Data leak**: Student sees answer key during exam | High | Exam integrity compromised | Server never sends `correct_answer` in assessment attempt response. Only sent after grading. |
| 5 | **Privilege escalation**: Admin creates super_admin account | High | Unauthorized platform access | `super_admin` role cannot be created via API. System-only assignment. |
| 6 | **Data manipulation**: Teacher deletes assessment after submissions | Medium | Data loss | Block deletion if submissions exist. Use "archive" instead of "delete". |
| 7 | **Data manipulation**: Principal overrides grade without reason | Medium | Grade inflation/deflation | Grade override requires written reason. Logged with before/after values. Notified to admin. |
| 8 | **Data leak**: Bulk student data export by unauthorized role | High | Mass PII exposure | Export restricted to admin/principal. All exports logged. Max 500 rows per export. |
| 9 | **Auth bypass**: JWT stolen from localStorage | Critical | Complete account takeover | Use httpOnly cookies (not localStorage). Short token expiry (1h). Refresh token rotation. |
| 10 | **Rate limit bypass**: Distributed attack on login | Medium | Account lockout attacks | Rate limit per IP AND per email. CAPTCHA after 3 failed attempts. |
| 11 | **CSRF**: Cross-site request forgery on cookie-based auth | Medium | Unauthorized actions | `SameSite=Strict` on cookies. CSRF token for state-changing requests. |
| 12 | **XSS**: Malicious script in homework question text | Medium | Session hijacking | Output encoding. Content-Security-Policy headers. No HTML in question text. |

---

## 7. Permission Leaks & Data Exposure Risks

### Data Exposure Risk Matrix

| Data | Exposed To | Leak Risk | Mitigation |
|------|-----------|-----------|------------|
| Student PII (name, photo, DOB) | Teachers (own class), Admin, Principal | Medium | Access logged. Photo URLs expire. No bulk PII export. |
| Student grades | Student, Parent, Teacher (own class), Principal | Medium | Grade changes logged. No "class rank" feature. |
| Teacher contact info | Admin, Principal, Other teachers (limited) | Low | Phone not shown to students. Email exposed for collaboration. |
| Parent contact info | Admin, Principal, Teacher (own class only) | Medium | Not shown to other parents. Not shown to students. |
| Attendance data | Student, Parent, Teacher (own class), Principal | Low | Aggregate only in reports. Individual attendance is private. |
| AI generation logs | Teacher (own), Admin (usage only) | Low | Content not shown to admin. Only token count and cost. |
| Curriculum progress | Teacher (own), Principal (school-wide), Admin | Low | No individual student data in curriculum view. |
| Notification preferences | User (own) | Low | Not exposed to any other role. |

### Permission Leak Scenarios (V1 -> V2 Fixes)

| V1 Leak | Fix in V2 |
|---------|-----------|
| Student could view ALL teachers in school | Student views only teachers assigned to their class |
| Parent could view ALL announcements (including teacher-targeted) | Announcements filtered by target role |
| Teacher could view ANY student's attendance | Teacher views students in own classes only |
| Admin could view ANY teacher's AI generation content | Admin views only usage metrics (cost, count), not content |
| Principal could edit ANY teacher's assignment | Principal has read-only access to assignments |
| Student could view other students' submission status | Student sees only own submission status |
| Teacher could export ALL students (school-wide) | Teacher exports students in own classes only |

---

## 8. Key Security Questions Answered

### Q1: Can a teacher view another teacher's students?

**No.** A teacher can only view students in classes they are assigned to. The system checks `teacher_class_subjects` table on every student list/detail request. A teacher assigned to Class 7A Science cannot view students in Class 8B unless they are also assigned to 8B.

**Exception**: Teacher can see other teacher names (for messaging/collaboration) but NOT their full profile or student roster.

### Q2: Can a parent view another child?

**No.** Parent data access is strictly limited to children linked to their account via the `student_parents` table. The parent_id is derived from the JWT, never from the request body. A parent cannot manipulate the `student_id` parameter to access another child's data.

**Exception**: School admin can temporarily grant access (e.g., guardian during parent absence). This is logged and time-bound.

### Q3: Can a principal edit grades?

**No (by default).** Principals cannot create or edit grades. They can view grades school-wide for monitoring purposes.

**Exception**: Principal can **override** grades with a mandatory written reason, logged with before/after values. Override triggers a notification to the teacher and admin. Override is tracked in audit logs and cannot be undone without admin approval.

### Q4: Can a student see answer keys before grading?

**No.** The assessment attempt API (`POST /assessments/{id}/start`) never includes `correct_answer` in the response. Answer keys are server-side only and are only revealed after:
1. The student submits their attempt
2. The teacher publishes results
3. Auto-graded questions show correct/incorrect status per answer

**For self-practice assessments**: Answer key is shown after submission (student chose "practice" type).

### Q5: Can an admin impersonate users?

**No.** There is no "log in as user" feature in V2. Admin cannot use another user's JWT or bypass authentication. Admin can:
- Edit user profiles (name, email, status)
- Reset user passwords (via Supabase admin API)
- Override grades (with audit)
- Deactivate users

Admin CANNOT:
- Submit assignments as a student
- Take assessments as a student
- View student's personal dashboard or AI history
- Post announcements as another user

**Security principle**: No role can perform actions "as" another user. All actions are attributed to the authenticated user and logged.

### Q6: Can a teacher delete assessments?

**Yes, with restrictions.**
- Teacher can delete assessments they created **only if no submissions exist**
- If submissions exist, the assessment is "archived" (hidden from students, data preserved for audit)
- Teacher cannot delete assessments created by another teacher
- Admin can force-delete with audit

### Q7: Can a principal override attendance?

**Yes, with restrictions.**
- Principal cannot mark attendance (that's teacher's job)
- Principal can override attendance records with a mandatory reason
- Override is logged with before/after values
- Teacher is notified of the override
- Principal cannot override attendance older than 30 days (admin only)

---

## Appendix A: Permission Enforcement Code Pattern

```python
# Recommended pattern for backend enforcement

from fastapi import Depends, HTTPException, status
from app.models.enums import Role

def require_role(*roles: Role):
    """Decorator: user must have one of the specified roles."""
    def decorator(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "PERMISSION_DENIED",
                    "message": f"Required role: {', '.join(r.value for r in roles)}",
                    "details": {"user_role": current_user.role.value}
                }
            )
        return current_user
    return decorator

def scoped_to_class(class_id_param: str = "class_id"):
    """Decorator: teacher must teach the class in the request."""
    async def decorator(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        class_id = request.path_params.get(class_id_param) or request.query_params.get(class_id_param)
        if not class_id:
            return
        if current_user.role == Role.TEACHER:
            # Check teacher_class_subjects
            repo = TeacherClassSubjectRepository(db)
            is_assigned = await repo.teacher_teaches_class(
                teacher_id=current_user.profile_id,
                class_id=class_id
            )
            if not is_assigned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "PERMISSION_DENIED",
                        "message": "You are not assigned to this class"
                    }
                )
    return decorator

def scoped_to_own_resource(resource_id_param: str = "id"):
    """Decorator: user must own the resource (or be admin)."""
    async def decorator(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        if current_user.role in [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN]:
            return  # Admins can access any resource
        resource_id = request.path_params.get(resource_id_param)
        if not resource_id:
            return
        # Check ownership - implementation varies by resource type
        # Examples:
        # - Assignment: check teacher_id == current_user.profile_id
        # - Submission: check student_id == current_user.profile_id
        # - Notification: check user_id == current_user.id
    return decorator
```

## Appendix B: V1 Permission Mistakes (Not to Repeat)

| V1 Mistake | Impact | V2 Fix |
|-----------|--------|--------|
| Permission strings inline across 23 route files | Fragile, easy to miss | Centralized decorator-based RBAC |
| No data-scope checks (teacher could view any class) | Privacy violation | `scoped_to_class()` decorator |
| No audit on grade overrides | Undocumented grade changes | Grade override requires reason + log |
| Student could view all teachers in school | Unnecessary data exposure | Student sees only assigned teachers |
| Parent could view all announcements | Information overload | Announcements filtered by target role |
| No rate limiting on AI endpoints | Cost explosion risk | Role-based rate limiting + token budget |
| No IP-based rate limiting on login | Brute force risk | IP + email rate limiting |
| Cookies not configured for security | CSRF risk | httpOnly + SameSite=Strict + Secure |

---

**Document Version**: 1.0  
**Date**: June 10, 2026  
**Next Action**: Implement permission decorators in backend code generation
