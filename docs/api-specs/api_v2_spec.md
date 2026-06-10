# ATHON V2 — Complete API Specification

**Architects**: Google API Architect, Principal Backend Engineer, Staff Software Engineer, EdTech Domain Expert  
**Date**: June 10, 2026  
**Base URL**: `https://api.athonschool.com/api/v2/` (production) | `http://localhost:8000/api/v2/` (development)  
**Format**: JSON  
**Auth**: JWT via Supabase Auth (Bearer token in Authorization header, or httpOnly cookie)  
**Pagination**: `?page=1&page_size=50` (default), max `page_size=200`  
**Error format**: `{ "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }`  
**Success format**: `{ "data": {...}, "meta": { "page": 1, "page_size": 50, "total": 100, "pages": 2 } }`

---

## Role Access Key

| Shorthand | Role |
|-----------|------|
| SA | School Admin |
| PR | Principal |
| T | Teacher |
| S | Student |
| P | Parent |
| A | All authenticated users |

---

## Table of Contents

1. [Auth APIs](#1-auth-apis)
2. [School APIs](#2-school-apis)
3. [User APIs](#3-user-apis)
4. [Teacher APIs](#4-teacher-apis)
5. [Student APIs](#5-student-apis)
6. [Parent APIs](#6-parent-apis)
7. [Curriculum APIs](#7-curriculum-apis)
8. [Class APIs](#8-class-apis)
9. [Subject APIs](#9-subject-apis)
10. [Attendance APIs](#10-attendance-apis)
11. [Assignment APIs](#11-assignment-apis)
12. [Assessment APIs](#12-assessment-apis)
13. [Progress APIs](#13-progress-apis)
14. [Analytics APIs](#14-analytics-apis)
15. [Notification APIs](#15-notification-apis)
16. [AI APIs](#16-ai-apis)

---

## 1. Auth APIs

### GET /health

System health check endpoint.

**Role Access**: A (unauthenticated)

**Request**: (empty)

**Response (200)**:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime_seconds": 86400,
  "timestamp": "2026-06-10T08:00:00Z"
}
```

---

### GET /health/database

Database connectivity health check.

**Role Access**: A (unauthenticated)

**Request**: (empty)

**Response (200)**:
```json
{
  "status": "connected",
  "latency_ms": 2,
  "pool_active": 5,
  "pool_idle": 15
}
```

**Errors**: `503` (database unreachable)

---

### GET /health/ai

AI provider health check.

**Role Access**: A (unauthenticated)

**Request**: (empty)

**Response (200)**:
```json
{
  "status": "available",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "configured": true
}
```

**Response (503)**:
```json
{
  "status": "unavailable",
  "configured": false,
  "message": "OpenAI API key not configured. Ask your administrator to add the API key."
}
```

---

### POST /auth/login

Authenticate user via Supabase Auth and return JWT tokens.

**Role Access**: A (unauthenticated)

**Request**:
```json
{
  "email": "teacher@athonschool.com",
  "password": "secure_password"
}
```

**Response (200)**:
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "name": "Priya Sharma",
    "email": "teacher@athonschool.com",
    "role": "teacher",
    "school_id": "uuid",
    "school_name": "Athon Public School"
  }
}
```

**Errors**: `401` (invalid credentials), `422` (validation error), `503` (Supabase unreachable)

---

### POST /auth/logout

Invalidate the current session and clear refresh token.

**Role Access**: A (authenticated)

**Request**: (empty, cookie-based)

**Response (200)**:
```json
{
  "message": "Logged out successfully"
}
```

**Errors**: `401` (not authenticated)

---

### GET /auth/me

Return the currently authenticated user's profile.

**Role Access**: A (authenticated)

**Request**: (empty, JWT in header or cookie)

**Response (200)**:
```json
{
  "id": "uuid",
  "name": "Priya Sharma",
  "email": "teacher@athonschool.com",
  "role": "teacher",
  "school_id": "uuid",
  "school_name": "Athon Public School",
  "profile_id": "uuid",
  "phone": "+919876543210",
  "avatar_url": null,
  "last_login_at": "2026-06-10T07:45:00Z"
}
```

**Errors**: `401` (invalid/expired token)

---

### POST /auth/refresh

Exchange a refresh token for a new access token pair.

**Role Access**: A (unauthenticated, uses refresh token)

**Request**: (cookie-based, or body-based)
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response (200)**:
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbG..."
}
```

**Errors**: `401` (invalid/expired refresh token)

---

### POST /auth/forgot-password

Request a password reset email.

**Role Access**: A (unauthenticated)

**Request**:
```json
{
  "email": "teacher@athonschool.com"
}
```

**Response (200)**:
```json
{
  "message": "Password reset email sent if account exists"
}
```

**Note**: Always returns 200 to prevent email enumeration attacks. If the email exists, Supabase sends a reset link.

**Errors**: `422` (invalid email format)

---

### POST /auth/reset-password

Complete password reset with token from email.

**Role Access**: A (unauthenticated, uses reset token)

**Request**:
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecurePass123!"
}
```

**Response (200)**:
```json
{
  "message": "Password reset successfully"
}
```

**Errors**: `401` (invalid/expired token), `422` (weak password)

---

## 2. School APIs

### GET /schools

Get school information (always scoped to the authenticated user's school).

**Role Access**: SA, PR

**Request**: (empty)

**Response (200)**:
```json
{
  "id": "uuid",
  "name": "Athon Public School",
  "address": "123 Education Lane, New Delhi",
  "phone": "+911234567890",
  "email": "admin@athonschool.com",
  "academic_year": {
    "start_date": "2026-04-01",
    "end_date": "2027-03-31",
    "current_term": "Term 1",
    "term_start": "2026-04-01",
    "term_end": "2026-09-30"
  },
  "stats": {
    "total_teachers": 12,
    "total_students": 702,
    "total_parents": 680,
    "total_classes": 20,
    "total_subjects": 7
  },
  "created_at": "2026-01-15T00:00:00Z"
}
```

**Errors**: `404` (school not found)

---

### PATCH /schools

Update school configuration.

**Role Access**: SA

**Request**:
```json
{
  "name": "Athon Public School (Updated)",
  "address": "456 Education Lane, New Delhi",
  "phone": "+911234567891",
  "academic_year": {
    "start_date": "2026-04-01",
    "end_date": "2027-03-31"
  }
}
```

**Response (200)**: Updated school object

**Errors**: `403` (not admin), `422` (validation error)

---

## 3. User APIs

### GET /users

List all users in the school with filtering.

**Role Access**: SA, PR

**Query Parameters**:
- `role` (optional): Filter by role (teacher, student, parent, school_leader)
- `status` (optional): active, inactive, all
- `class_id` (optional): Filter by class (for students)
- `q` (optional): Search by name or email
- `page`, `page_size` (pagination)

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Priya Sharma",
      "email": "teacher@athonschool.com",
      "role": "teacher",
      "status": "active",
      "last_login_at": "2026-06-10T07:45:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "total": 12,
    "pages": 1
  }
}
```

**Errors**: `403` (insufficient permissions)

---

### POST /users/teachers

Create a new teacher user.

**Role Access**: SA

**Request**:
```json
{
  "first_name": "Raj",
  "last_name": "Kumar",
  "email": "raj.kumar@athonschool.com",
  "phone": "+919876543210",
  "employee_code": "TCH-023",
  "class_ids": ["uuid-7a", "uuid-8b"],
  "subject_ids": ["uuid-math", "uuid-science"]
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "name": "Raj Kumar",
  "email": "raj.kumar@athonschool.com",
  "role": "teacher",
  "employee_code": "TCH-023",
  "created_at": "2026-06-10T08:00:00Z"
}
```

**Errors**: `409` (email already exists), `422` (validation error), `403` (not admin)

---

### POST /users/students

Create a new student user (or import via CSV).

**Role Access**: SA, PR

**Request**:
```json
{
  "first_name": "Rahul",
  "last_name": "Verma",
  "email": "rahul.verma@athonschool.com",
  "admission_number": "STU-2026-0421",
  "class_id": "uuid-7a",
  "date_of_birth": "2013-05-15",
  "guardian_name": "Mr. Amit Verma",
  "guardian_phone": "+919876543211"
}
```

**Response (201)**: Created student object

**Errors**: `409` (duplicate admission number), `422` (validation error)

---

### POST /users/parents

Create a new parent user.

**Role Access**: SA, PR

**Request**:
```json
{
  "first_name": "Amit",
  "last_name": "Verma",
  "email": "amit.verma@email.com",
  "phone": "+919876543211",
  "student_ids": ["uuid-rahul", "uuid-priya"]
}
```

**Response (201)**: Created parent object

**Errors**: `409` (email already exists)

---

### POST /users/import

Bulk import users via CSV upload.

**Role Access**: SA

**Request**: `multipart/form-data`
- `file`: CSV file with headers (role, first_name, last_name, email, class_id, etc.)
- `role`: "teachers" | "students" | "parents"

**Response (200)**:
```json
{
  "created": 45,
  "updated": 3,
  "errors": [
    {"row": 12, "reason": "Duplicate email: john@email.com"},
    {"row": 23, "reason": "Invalid class_id"}
  ]
}
```

**Errors**: `422` (invalid CSV format), `400` (empty file)

---

### PATCH /users/{user_id}

Update a user's profile.

**Role Access**: A (own profile), SA (any user)

**Request**:
```json
{
  "first_name": "Updated Name",
  "phone": "+919876543212"
}
```

**Response (200)**: Updated user object

**Errors**: `403` (cannot edit other users), `404` (not found)

---

### DELETE /users/{user_id}

Soft-deactivate a user. Does not delete data.

**Role Access**: SA

**Request**: (empty)

**Response (200)**:
```json
{
  "message": "User deactivated",
  "user_id": "uuid"
}
```

**Errors**: `403` (not admin), `404` (not found)

---

### POST /users/{user_id}/link-parent

Link a parent to a student.

**Role Access**: SA, PR

**Request**:
```json
{
  "parent_id": "uuid-parent",
  "relationship": "father"
}
```

**Response (200)**:
```json
{
  "message": "Parent linked to student",
  "student_id": "uuid-student",
  "parent_id": "uuid-parent"
}
```

**Errors**: `404` (parent or student not found), `409` (already linked)

---

## 4. Teacher APIs

### GET /teachers

List all teachers in the school.

**Role Access**: SA, PR

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid-user",
      "name": "Priya Sharma",
      "employee_code": "TCH-001",
      "email": "priya@athonschool.com",
      "phone": "+919876543210",
      "classes": [
        {"id": "uuid", "name": "7A", "subject": "Science"},
        {"id": "uuid", "name": "7B", "subject": "Science"}
      ],
      "is_class_teacher": true,
      "status": "active"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 12, "pages": 1 }
}
```

---

### GET /teachers/{teacher_id}/schedule

Get a teacher's weekly schedule (timetable).

**Role Access**: T (own), SA, PR

**Query Parameters**:
- `day` (optional): 1-7 (Monday-Sunday)

**Response (200)**:
```json
{
  "data": [
    {
      "day": 1,
      "day_name": "Monday",
      "periods": [
        {
          "period": 1,
          "start_time": "08:00",
          "end_time": "08:45",
          "class_name": "7A",
          "subject": "Science",
          "room": "Lab 1"
        }
      ]
    }
  ]
}
```

---

### POST /teachers/{teacher_id}/assign

Assign a teacher to classes and subjects.

**Role Access**: SA

**Request**:
```json
{
  "class_ids": ["uuid-7a", "uuid-8b"],
  "subject_ids": ["uuid-science", "uuid-bio"],
  "is_class_teacher": false
}
```

**Response (200)**: Updated teacher object

**Errors**: `404` (teacher not found), `422` (invalid assignment)

---

## 5. Student APIs

### GET /students

List students with filtering.

**Role Access**: SA, PR, T (own classes)

**Query Parameters**:
- `class_id` (required for teachers): Filter by class
- `status`: active, inactive, all
- `q`: Search by name or admission number
- `page`, `page_size`: Pagination

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid-user",
      "name": "Rahul Verma",
      "admission_number": "STU-2026-0421",
      "class_name": "7A",
      "attendance_percentage": 92.5,
      "homework_completion": 85.0,
      "test_average": 72.0,
      "parent_name": "Amit Verma",
      "parent_phone": "+919876543211",
      "status": "active"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 35, "pages": 1 }
}
```

---

### GET /students/{student_id}

Get detailed student information.

**Role Access**: T, SA, PR, P (own child), S (own)

**Response (200)**:
```json
{
  "id": "uuid",
  "name": "Rahul Verma",
  "admission_number": "STU-2026-0421",
  "class": {"id": "uuid", "name": "7A"},
  "date_of_birth": "2013-05-15",
  "guardian": {"name": "Amit Verma", "phone": "+919876543211"},
  "enrolled_at": "2026-04-01",
  "stats": {
    "attendance_percentage": 92.5,
    "homework_completion": 85.0,
    "test_average": 72.0,
    "learning_objectives_mastered": 12,
    "learning_objectives_total": 18
  }
}
```

---

### PATCH /students/{student_id}/class

Change a student's class assignment.

**Role Access**: SA, PR

**Request**:
```json
{
  "class_id": "uuid-new-class"
}
```

**Response (200)**: Updated student object

**Errors**: `404` (class not found)

---

## 6. Parent APIs

### GET /parents/me/children

Get the authenticated parent's linked children.

**Role Access**: P

**Response (200)**:
```json
{
  "data": [
    {
      "student_id": "uuid",
      "name": "Rahul Verma",
      "class_name": "7A",
      "relationship": "son",
      "attendance_percentage": 92.5,
      "homework_pending": 1,
      "test_average": 72.0,
      "recent_activity": "Submitted Science HW",
      "weekly_summary": "Rahul had a good week..."
    }
  ]
}
```

---

### GET /parents/me/children/{student_id}/attendance

Get a child's attendance history.

**Role Access**: P

**Query Parameters**:
- `term_id`: Academic term
- `month`: Filter by month (YYYY-MM)

**Response (200)**:
```json
{
  "data": [
    {
      "date": "2026-06-10",
      "status": "present",
      "marked_by": "Priya Sharma"
    }
  ],
  "summary": {
    "present": 42,
    "absent": 3,
    "late": 1,
    "percentage": 92.5
  }
}
```

---

### GET /parents/me/children/{student_id}/weekly-summary

Get the latest AI-generated weekly summary for a child.

**Role Access**: P

**Response (200)**:
```json
{
  "week_start": "2026-06-03",
  "week_end": "2026-06-09",
  "attendance": "4 of 5 days present",
  "homework": "3 submitted, 1 pending",
  "tests": "Scored 8/10 on Science quiz",
  "teacher_note": "Rahul is doing well. Needs practice with Algebra.",
  "ai_summary": "Rahul had a productive week! He scored well in Science and completed all homework on time. He struggled slightly with Algebra on Tuesday - consider extra practice. Overall: Great week!",
  "language": "en",
  "generated_at": "2026-06-10T06:00:00Z"
}
```

---

## 7. Curriculum APIs

### GET /curriculum/tree

Get the full curriculum tree for a class and subject.

**Role Access**: T, SA, PR, S (own class), P (child's class)

**Query Parameters**:
- `class_id` (required)
- `subject_id` (required)

**Response (200)**:
```json
{
  "class": {"id": "uuid", "name": "7A"},
  "subject": {"id": "uuid", "name": "Science"},
  "chapters": [
    {
      "id": "uuid",
      "name": "Nutrition in Plants",
      "order": 1,
      "status": "completed",
      "completion_percentage": 100,
      "topics": [
        {
          "id": "uuid",
          "name": "Photosynthesis",
          "order": 1,
          "learning_objectives": [
            {
              "id": "uuid",
              "code": "SCI-7-NP-01",
              "text": "SWBAT explain the process of photosynthesis",
              "mastery_level": 0.85
            }
          ]
        }
      ]
    }
  ]
}
```

---

### GET /curriculum/chapters

List chapters for a class and subject.

**Role Access**: T, SA, PR, S, P

**Query Parameters**:
- `class_id` (required)
- `subject_id` (required)

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Nutrition in Plants",
      "order": 1,
      "status": "completed",
      "topic_count": 5,
      "topic_completed": 5
    }
  ]
}
```

---

### GET /curriculum/chapters/{chapter_id}/topics

List topics within a chapter.

**Role Access**: T, SA, PR, S, P

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Photosynthesis",
      "order": 1,
      "lo_count": 3,
      "status": "completed"
    }
  ]
}
```

---

### GET /curriculum/topics/{topic_id}/learning-objectives

List learning objectives within a topic.

**Role Access**: T, SA, PR, S, P

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "SCI-7-NP-01",
      "text": "SWBAT explain the process of photosynthesis",
      "order": 1
    }
  ]
}
```

---

### PATCH /curriculum/chapters/{chapter_id}/progress

Update the teacher's progress status for a chapter.

**Role Access**: T

**Request**:
```json
{
  "status": "completed",
  "note": "Students understood well. Spent extra time on light-dependent reactions."
}
```

**Response (200)**:
```json
{
  "id": "uuid",
  "status": "completed",
  "completion_percentage": 100,
  "updated_at": "2026-06-10T08:30:00Z"
}
```

**Errors**: `403` (teacher not assigned to this class), `422` (invalid status)

---

### PATCH /curriculum/topics/{topic_id}/progress

Mark a topic as completed or update its status.

**Role Access**: T

**Request**:
```json
{
  "status": "completed",
  "note": "Covered in 2 periods. Most students understood."
}
```

**Response (200)**: Updated topic status

**Errors**: `403` (teacher not assigned to this class)

---

### POST /curriculum/upload

Upload a CBSE curriculum via CSV.

**Role Access**: SA

**Request**: `multipart/form-data`
- `file`: CSV with columns (class, subject, chapter, chapter_order, topics[], learning_objectives[])

**Response (200)**:
```json
{
  "chapters_created": 45,
  "topics_created": 180,
  "los_created": 540,
  "errors": []
}
```

---

## 8. Class APIs

### GET /classes

List all classes in the school.

**Role Access**: A

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "7A",
      "section": "A",
      "student_count": 35,
      "class_teacher": {"id": "uuid", "name": "Priya Sharma"},
      "subjects": ["Science", "Math", "English"]
    }
  ]
}
```

---

### POST /classes

Create a new class.

**Role Access**: SA

**Request**:
```json
{
  "name": "7A",
  "section": "A",
  "class_teacher_id": "uuid-teacher",
  "room_number": "201"
}
```

**Response (201)**: Created class object

---

### GET /classes/{class_id}/roster

Get the student roster for a class.

**Role Access**: T, SA, PR, S (own), P (child's)

**Response (200)**:
```json
{
  "class": {"id": "uuid", "name": "7A"},
  "students": [
    {
      "id": "uuid",
      "name": "Rahul Verma",
      "admission_number": "STU-2026-0421",
      "roll_number": 1,
      "status": "active"
    }
  ],
  "total": 35
}
```

---

### DELETE /classes/{class_id}

Soft-delete a class.

**Role Access**: SA

**Errors**: `409` (class has active students, move them first)

---

## 9. Subject APIs

### GET /subjects

List all subjects offered by the school.

**Role Access**: A

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Science",
      "code": "SCI",
      "teacher_count": 3,
      "class_count": 8
    }
  ]
}
```

---

### POST /subjects

Add a new subject.

**Role Access**: SA

**Request**:
```json
{
  "name": "Computer Science",
  "code": "CS",
  "description": "Computer Science and Programming"
}
```

**Response (201)**: Created subject object

---

## 10. Attendance APIs

### POST /attendance/mark

Mark attendance for a single student.

**Role Access**: T (own class)

**Request**:
```json
{
  "student_id": "uuid",
  "class_id": "uuid",
  "academic_term_id": "uuid",
  "date": "2026-06-10",
  "status": "present",
  "remarks": null
}
```

**Status options**: `present`, `absent`, `late`, `half_day`

**Response (201)**:
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "date": "2026-06-10",
  "status": "present",
  "marked_by": "uuid-teacher",
  "created_at": "2026-06-10T07:50:00Z"
}
```

**Errors**: `409` (already marked), `403` (teacher not assigned to this class)

---

### POST /attendance/batch

Batch-mark attendance for an entire class.

**Role Access**: T (own class)

**Request**:
```json
{
  "class_id": "uuid",
  "academic_term_id": "uuid",
  "date": "2026-06-10",
  "records": [
    {"student_id": "uuid-1", "status": "present"},
    {"student_id": "uuid-2", "status": "absent", "remarks": "Sick"},
    {"student_id": "uuid-3", "status": "late"},
    {"student_id": "uuid-4", "status": "present"}
  ]
}
```

**Response (201)**:
```json
{
  "marked": 30,
  "errors": [],
  "absent_count": 2,
  "records": [
    {"student_id": "uuid-1", "status": "present", "success": true},
    {"student_id": "uuid-2", "status": "absent", "success": true}
  ]
}
```

**Errors**: `403` (teacher not assigned), `409` (conflict - some already marked)

---

### GET /attendance/today

Get today's attendance records for the authenticated user's scope.

**Role Access**: A (role-aware)

**Query Parameters**:
- `class_id` (required for teachers): Teacher's class
- `academic_term_id` (optional): Override current term

**Response (200)**:
```json
{
  "date": "2026-06-10",
  "class_id": "uuid",
  "records": [
    {
      "student_id": "uuid",
      "student_name": "Rahul Verma",
      "status": "present",
      "remarks": null
    }
  ],
  "summary": {
    "present": 28,
    "absent": 2,
    "late": 1,
    "total": 31,
    "percentage": 93.5
  }
}
```

**Role-specific behavior**:
- **Teacher**: Attendance for their classes today
- **Student**: Own attendance record
- **Principal**: School-wide summary
- **Parent**: Children's attendance today

---

### GET /students/{student_id}/attendance

Get a student's attendance history.

**Role Access**: T, SA, PR, S (own), P (child)

**Query Parameters**:
- `academic_term_id` (required)
- `month` (optional): Filter by month (YYYY-MM)

**Response (200)**:
```json
{
  "student_id": "uuid",
  "student_name": "Rahul Verma",
  "academic_term_id": "uuid",
  "records": [
    {"date": "2026-06-10", "status": "present"},
    {"date": "2026-06-09", "status": "present"}
  ],
  "summary": {
    "present": 42,
    "absent": 3,
    "late": 1,
    "percentage": 92.5
  }
}
```

---

### GET /attendance/classes/{class_id}

Get attendance records for a class (date range or single date).

**Role Access**: T, SA, PR

**Query Parameters**:
- `date` (optional): Specific date
- `start_date` (optional): Date range start
- `end_date` (optional): Date range end

**Response (200)**: List of attendance records with summary

---

### GET /attendance/trends

Get attendance trend data for analytics.

**Role Access**: T, SA, PR

**Query Parameters**:
- `class_id` (optional): Filter by class
- `range`: "week" | "month" | "term"
- `subject_id` (optional): Filter by subject (teachers only)

**Response (200)**:
```json
{
  "data": [
    {"date": "2026-06-01", "percentage": 88.0},
    {"date": "2026-06-02", "percentage": 92.0}
  ],
  "summary": {
    "average": 90.5,
    "trend": "improving",
    "change_vs_last_period": 2.5,
    "alert": null
  }
}
```

---

## 11. Assignment APIs

The Assignment model unifies homework, worksheets, projects, revisions, and quizzes. The `type` field discriminates behavior.

### POST /assignments

Create a new assignment.

**Role Access**: T (own class)

**Request**:
```json
{
  "class_id": "uuid",
  "subject_id": "uuid",
  "chapter_id": "uuid",
  "topic_id": "uuid",
  "type": "homework",
  "title": "Nutrition in Plants Homework",
  "instructions": "Answer all questions. Due by tomorrow 4 PM.",
  "max_score": 10.0,
  "due_date": "2026-06-11T16:00:00Z",
  "is_published": false,
  "questions": [
    {
      "type": "mcq",
      "question_text": "What is the primary pigment involved in photosynthesis?",
      "options": ["Chlorophyll", "Carotene", "Xanthophyll", "Anthocyanin"],
      "correct_answer": "Chlorophyll",
      "marks": 1.0,
      "difficulty": "easy",
      "order": 1
    },
    {
      "type": "short",
      "question_text": "Explain the process of photosynthesis in 3-4 sentences.",
      "marks": 3.0,
      "difficulty": "medium",
      "order": 2
    }
  ]
}
```

**Assignment types**: `homework`, `worksheet`, `project`, `revision`, `quiz`

**Response (201)**:
```json
{
  "id": "uuid",
  "type": "homework",
  "title": "Nutrition in Plants Homework",
  "question_count": 5,
  "auto_gradeable_count": 2,
  "requires_grading": true,
  "created_at": "2026-06-10T08:00:00Z",
  "status": "draft"
}
```

**Errors**: `403` (teacher not assigned to this class+subject), `422` (invalid questions)

---

### PATCH /assignments/{assignment_id}

Update an existing assignment (draft only).

**Role Access**: T (own assignment)

**Request**: (partial update)
```json
{
  "title": "Updated Title",
  "due_date": "2026-06-12T16:00:00Z",
  "is_published": false
}
```

**Errors**: `403` (not the owner), `400` (already published)

---

### POST /assignments/{assignment_id}/publish

Publish an assignment, making it visible to students.

**Role Access**: T (own assignment)

**Request**: (empty)

**Response (200)**:
```json
{
  "id": "uuid",
  "status": "published",
  "published_at": "2026-06-10T08:30:00Z",
  "student_count": 35
}
```

**Errors**: `403` (not the owner), `400` (no questions), `409` (already published)

---

### POST /assignments/{assignment_id}/submit

Submit answers for an assignment.

**Role Access**: S (own class)

**Request**:
```json
{
  "answers": [
    {
      "question_id": "uuid-q1",
      "answer_choice": "Chlorophyll"
    },
    {
      "question_id": "uuid-q2",
      "answer_text": "Photosynthesis is the process by which..."
    }
  ],
  "files": [
    {"url": "https://storage.athonschool.com/uploads/photo.jpg", "type": "image"}
  ]
}
```

**Response (201)**:
```json
{
  "submission_id": "uuid",
  "status": "submitted",
  "auto_graded_score": 2.0,
  "auto_graded_max": 3.0,
  "requires_teacher_review": true,
  "submitted_at": "2026-06-10T14:00:00Z"
}
```

**Errors**: `403` (not enrolled in this class), `400` (past due date), `409` (already submitted)

---

### POST /assignments/{assignment_id}/resubmit

Re-submit answers for an already-submitted assignment (before due date). Can only re-submit if not yet graded.

**Role Access**: S (own submission)

**Request**:
```json
{
  "answers": [
    {"question_id": "uuid-q1", "answer_choice": "Chlorophyll"},
    {"question_id": "uuid-q2", "answer_text": "Updated answer..."}
  ]
}
```

**Response (200)**:
```json
{
  "submission_id": "uuid",
  "status": "resubmitted",
  "previous_auto_score": 2.0,
  "resubmitted_at": "2026-06-10T15:00:00Z"
}
```

**Errors**: `400` (past due date or already graded), `404` (no existing submission)

---

### POST /assignments/{assignment_id}/grade

Teacher grades written answers in a submission.

**Role Access**: T (own assignment)

**Request**:
```json
{
  "submission_id": "uuid",
  "grades": [
    {
      "question_id": "uuid-q2",
      "score": 2.5,
      "feedback": "Good explanation, but missing the role of chloroplasts."
    }
  ]
}
```

**Response (200)**:
```json
{
  "submission_id": "uuid",
  "total_score": 9.5,
  "max_score": 10.0,
  "percentage": 95.0,
  "graded_at": "2026-06-11T10:00:00Z",
  "status": "graded"
}
```

**Errors**: `403` (not the owner), `400` (score exceeds max marks)

---

### GET /assignments

List assignments with filtering.

**Role Access**: T (own), SA, PR, S (own class), P (child's class)

**Query Parameters**:
- `class_id` (optional): Filter by class
- `subject_id` (optional): Filter by subject
- `type` (optional): homework, worksheet, project, revision, quiz
- `status` (optional): draft, published
- `page`, `page_size`: Pagination

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Nutrition in Plants Homework",
      "type": "homework",
      "class_name": "7A",
      "subject": "Science",
      "due_date": "2026-06-11T16:00:00Z",
      "status": "published",
      "submission_count": 28,
      "graded_count": 0,
      "created_at": "2026-06-10T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 8, "pages": 1 }
}
```

**Role-specific behavior**:
- **Teacher**: Own assignments
- **Student**: Published assignments for their class
- **Parent**: Published assignments for their child's class
- **Principal/Admin**: All assignments in school

---

### GET /assignments/{assignment_id}

Get detailed assignment information with questions.

**Role Access**: T (own), SA, PR, S (own class), P (child's class)

**Response (200)**:
```json
{
  "id": "uuid",
  "title": "Nutrition in Plants Homework",
  "type": "homework",
  "class": {"id": "uuid", "name": "7A"},
  "subject": {"id": "uuid", "name": "Science"},
  "chapter": "Nutrition in Plants",
  "topic": "Photosynthesis",
  "max_score": 10.0,
  "due_date": "2026-06-11T16:00:00Z",
  "status": "published",
  "ai_generated": true,
  "questions": [
    {
      "id": "uuid",
      "type": "mcq",
      "question_text": "What is...",
      "options": ["A", "B", "C", "D"],
      "marks": 1.0,
      "order": 1,
      "correct_answer": "A"
    }
  ],
  "stats": {
    "total_students": 35,
    "submitted": 28,
    "graded": 0,
    "average_score": null
  }
}
```

---

### GET /assignments/{assignment_id}/submissions

Get all submissions for an assignment.

**Role Access**: T (own assignment)

**Query Parameters**:
- `status`: submitted, graded, all
- `page`, `page_size`: Pagination

**Response (200)**:
```json
{
  "data": [
    {
      "student_id": "uuid",
      "student_name": "Rahul Verma",
      "status": "submitted",
      "submitted_at": "2026-06-10T14:00:00Z",
      "auto_graded_score": 2.0,
      "total_score": null,
      "is_graded": false
    }
  ]
}
```

---

## 12. Assessment APIs

Assessment model uses the same question/submission/answer structure as assignments. The `type` field adds: timed, single-attempt, scheduled, auto-grade-first behavior.

### POST /assessments

Create a new assessment.

**Role Access**: T (own class)

**Request**:
```json
{
  "class_id": "uuid",
  "subject_id": "uuid",
  "chapter_id": "uuid",
  "topic_id": "uuid",
  "type": "unit_test",
  "title": "Mensuration Unit Test",
  "instructions": "Answer all questions. No calculators.",
  "total_marks": 20,
  "passing_percentage": 40,
  "duration_minutes": 40,
  "scheduled_at": "2026-06-14T10:00:00Z",
  "is_published": false,
  "difficulty": "medium",
  "questions": [
    {
      "type": "mcq",
      "question_text": "What is the area of a circle with radius 7cm?",
      "options": ["144 cm", "154 cm", "164 cm", "174 cm"],
      "correct_answer": "154 cm",
      "marks": 1.0,
      "difficulty": "easy",
      "order": 1
    }
  ]
}
```

**Assessment types**: `unit_test`, `midterm`, `final`, `quiz`, `practice`

**Response (201)**:
```json
{
  "id": "uuid",
  "type": "unit_test",
  "title": "Mensuration Unit Test",
  "total_marks": 20,
  "duration_minutes": 40,
  "question_count": 10,
  "status": "draft",
  "created_at": "2026-06-10T08:00:00Z"
}
```

---

### POST /assessments/generate

AI generates an assessment with question paper and answer key.

**Role Access**: T

**Request**:
```json
{
  "class_id": "uuid",
  "subject_id": "uuid",
  "chapter_id": "uuid",
  "topic_ids": ["uuid"],
  "type": "unit_test",
  "total_marks": 20,
  "duration_minutes": 40,
  "difficulty": "medium",
  "question_types": ["mcq", "short", "long"]
}
```

**Response (200)**:
```json
{
  "title": "Mensuration Unit Test (AI Generated)",
  "questions": [
    {
      "type": "mcq",
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "marks": 1,
      "difficulty": "easy"
    }
  ],
  "total_marks": 20,
  "auto_gradeable_marks": 8,
  "estimated_duration": 40,
  "difficulty_breakdown": {
    "easy": 5,
    "medium": 3,
    "hard": 2
  }
}
```

---

### POST /assessments/{assessment_id}/publish

Publish an assessment, making it available to students.

**Role Access**: T (own assessment)

**Request**: (empty)

**Response (200)**:
```json
{
  "id": "uuid",
  "status": "published",
  "scheduled_at": "2026-06-14T10:00:00Z"
}
```

---

### POST /assessments/{assessment_id}/start

Student starts an assessment attempt (timer begins).

**Role Access**: S (enrolled in class)

**Request**: (empty)

**Response (200)**:
```json
{
  "attempt_id": "uuid",
  "assessment_id": "uuid",
  "started_at": "2026-06-14T10:00:00Z",
  "ends_at": "2026-06-14T10:40:00Z",
  "duration_minutes": 40,
  "questions": [
    {
      "id": "uuid",
      "type": "mcq",
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "marks": 1,
      "order": 1
    }
  ]
}
```

**Note**: `correct_answer` is NOT sent to students. Answer keys are server-side only.

**Errors**: `400` (not yet scheduled), `409` (already attempted), `403` (not enrolled)

---

### POST /assessments/{assessment_id}/submit

Student submits their assessment attempt.

**Role Access**: S (own attempt)

**Request**:
```json
{
  "attempt_id": "uuid",
  "answers": [
    {"question_id": "uuid-q1", "answer_choice": "A"},
    {"question_id": "uuid-q2", "answer_text": "Photosynthesis is..."}
  ]
}
```

**Response (200)**:
```json
{
  "attempt_id": "uuid",
  "submitted_at": "2026-06-14T10:35:00Z",
  "auto_graded_score": 8,
  "auto_graded_max": 10,
  "total_score": null,
  "status": "pending_review",
  "results": [
    {"question_id": "uuid-q1", "is_correct": true, "auto_graded": true, "score": 1},
    {"question_id": "uuid-q2", "is_correct": null, "auto_graded": false, "score": null}
  ]
}
```

**Auto-submit**: Server auto-submits when timer expires with whatever answers are entered.

---

### POST /assessments/{assessment_id}/grade

Teacher grades written answers and publishes final scores.

**Role Access**: T (own assessment)

**Request**:
```json
{
  "attempt_id": "uuid",
  "grades": [
    {
      "question_id": "uuid-q2",
      "score": 7,
      "feedback": "Good work! Show your working next time."
    }
  ]
}
```

**Response (200)**:
```json
{
  "attempt_id": "uuid",
  "total_score": 15,
  "max_score": 20,
  "percentage": 75.0,
  "passing": true,
  "status": "graded"
}
```

---

### GET /assessments/{assessment_id}/results

Get assessment results (role-aware).

**Role Access**: T (own), SA, PR, S (own), P (child)

**Response (200)** (Teacher view):
```json
{
  "assessment": {"id": "uuid", "title": "Mensuration Unit Test"},
  "stats": {
    "total_students": 35,
    "attempted": 33,
    "passed": 25,
    "average_score": 13.5,
    "highest_score": 19,
    "lowest_score": 4,
    "pass_rate": 75.8
  },
  "submissions": [
    {
      "student_name": "Rahul Verma",
      "score": 15,
      "percentage": 75.0,
      "passed": true,
      "status": "graded"
    }
  ]
}
```

**Response (200)** (Student view):
```json
{
  "score": 15,
  "max_score": 20,
  "percentage": 75.0,
  "passed": true,
  "results": [
    {"question": "Q1", "is_correct": true, "correct_answer": "A", "your_answer": "A"},
    {"question": "Q2", "is_correct": true, "correct_answer": null, "your_answer": "...", "score": 7, "feedback": "Good work!"}
  ]
}
```

---

## 13. Progress APIs

### GET /progress/students/{student_id}

Get per-LO mastery breakdown for a student.

**Role Access**: S (own), T (own class), P (child), SA, PR

**Response (200)**:
```json
{
  "student_id": "uuid",
  "student_name": "Rahul Verma",
  "summary": {
    "learning_objectives_total": 18,
    "mastered": 12,
    "in_progress": 4,
    "not_started": 2,
    "overall_mastery": 66.7
  },
  "subjects": [
    {
      "subject": "Science",
      "mastery": 75.0,
      "learning_objectives": [
        {
          "code": "SCI-7-NP-01",
          "text": "SWBAT explain photosynthesis",
          "mastery_level": 0.85,
          "status": "mastered",
          "last_assessment_score": 85.0,
          "attempts": 3
        }
      ]
    }
  ]
}
```

---

### GET /progress/classes/{class_id}

Get aggregated progress for a class.

**Role Access**: T, SA, PR

**Response (200)**:
```json
{
  "class_id": "uuid",
  "class_name": "7A",
  "summary": {
    "students": 35,
    "average_mastery": 68.2,
    "subject_breakdown": [
      {"subject": "Science", "average_mastery": 75.0},
      {"subject": "Math", "average_mastery": 72.0}
    ],
    "at_risk_students": 3,
    "struggling_topics": ["Algebra: Linear Equations"]
  }
}
```

---

### GET /progress/risk

Get at-risk students for a school or class.

**Role Access**: SA, PR, T (own class)

**Query Parameters**:
- `class_id` (optional): Filter by class
- `risk_level` (optional): low, medium, high, critical
- `page`, `page_size`: Pagination

**Response (200)**:
```json
{
  "data": [
    {
      "student_id": "uuid",
      "student_name": "Rahul Verma",
      "class_name": "7A",
      "risk_level": "high",
      "risk_score": 65,
      "reasons": [
        {"type": "attendance", "value": 72, "threshold": 80, "trend": "declining"},
        {"type": "performance", "value": 38, "threshold": 40, "trend": "declining"}
      ],
      "flagged_at": "2026-06-09T06:00:00Z",
      "teacher_name": "Priya Sharma",
      "status": "open"
    }
  ],
  "summary": {
    "total_flagged": 15,
    "critical": 2,
    "high": 8,
    "medium": 5,
    "low": 0,
    "resolved_this_week": 3
  }
}
```

---

### PATCH /progress/risk/{flag_id}/resolve

Mark a risk flag as reviewed/resolved.

**Role Access**: T, SA, PR

**Request**:
```json
{
  "resolution": "Met with student and parents. Attendance improving. Set up extra tutoring."
}
```

**Response (200)**:
```json
{
  "flag_id": "uuid",
  "status": "resolved",
  "resolved_at": "2026-06-10T10:00:00Z"
}
```

---

## 14. Analytics APIs

### GET /analytics/dashboard/teacher

Get teacher's personal dashboard data.

**Role Access**: T

**Response (200)**:
```json
{
  "today_classes": [
    {"class_name": "7A", "period": 1, "subject": "Science", "attendance_marked": false}
  ],
  "pending_grading": {
    "assignments": 12,
    "assessments": 0,
    "overdue": 3
  },
  "class_performance": [
    {"class_name": "7A", "average": 78.0},
    {"class_name": "8B", "average": 82.0}
  ],
  "weekly_activity": {
    "assignments_created": 4,
    "assessments_created": 1,
    "submissions_graded": 28,
    "total_submissions": 30
  },
  "recent_announcements": [
    {"title": "Science Fair", "body": "...", "created_at": "2026-06-10T08:00:00Z"}
  ],
  "unread_notifications": 3
}
```

---

### GET /analytics/dashboard/student

Get student's personal dashboard data.

**Role Access**: S

**Response (200)**:
```json
{
  "attendance_percentage": 92.5,
  "homework_due": [
    {"id": "uuid", "title": "Nutrition HW", "subject": "Science", "due_date": "2026-06-11T16:00:00Z", "days_remaining": 1}
  ],
  "upcoming_tests": [
    {"id": "uuid", "title": "Math Unit Test", "subject": "Math", "scheduled_at": "2026-06-14T10:00:00Z", "total_marks": 20}
  ],
  "recent_scores": [
    {"title": "Science Quiz", "score": 8, "max_score": 10, "percentage": 80.0}
  ],
  "learning_streak": 5,
  "learning_objectives": {
    "mastered": 12,
    "in_progress": 4,
    "not_started": 2
  }
}
```

---

### GET /analytics/dashboard/parent

Get parent's dashboard data for their children.

**Role Access**: P

**Response (200)**:
```json
{
  "children": [
    {
      "student_id": "uuid",
      "name": "Rahul Verma",
      "class_name": "7A",
      "attendance_percentage": 92.5,
      "homework_pending": 1,
      "test_average": 72.0,
      "recent_test": {"title": "Science Quiz", "score": 8, "max_score": 10},
      "weekly_summary": "Rahul had a good week..."
    }
  ]
}
```

---

### GET /analytics/dashboard/principal

Get principal's school-wide dashboard.

**Role Access**: PR, SA

**Response (200)**:
```json
{
  "attendance": {
    "today": 85.0,
    "trend": "improving",
    "change": 2.0,
    "lowest_class": {"name": "8B", "percentage": 72.0}
  },
  "performance": {
    "overall_average": 74.5,
    "by_subject": [
      {"subject": "Math", "average": 78.0},
      {"subject": "Science", "average": 74.0}
    ],
    "trend": "stable"
  },
  "curriculum": {
    "school_wide": 62.0,
    "on_track_teachers": 8,
    "behind_teachers": 3
  },
  "teacher_activity": {
    "assignments_this_week": 45,
    "assessments_scheduled": 12,
    "avg_grading_time": "2.3 days",
    "inactive_teachers": ["Mr. Kumar"]
  },
  "risk_summary": {
    "critical": 2,
    "high": 8,
    "medium": 5,
    "resolved_this_week": 3
  },
  "unread_notifications": 5
}
```

---

### GET /analytics/dashboard/admin

Get admin's school overview dashboard.

**Role Access**: SA

**Response (200)**:
```json
{
  "total_students": 702,
  "total_teachers": 12,
  "total_parents": 680,
  "active_classes": 20,
  "attendance_percentage": 87.0,
  "recent_activity": [
    {"action": "Mrs. Sharma created a new assignment", "timestamp": "2026-06-10T08:15:00Z"}
  ],
  "unread_notifications": 2
}
```

---

### GET /analytics/reports

Generate a report (on-demand, cached).

**Role Access**: SA, PR, T

**Query Parameters**:
- `type`: "attendance" | "performance" | "teacher_activity" | "curriculum"
- `class_id` (optional): Filter by class
- `subject_id` (optional): Filter by subject
- `teacher_id` (optional): Filter by teacher
- `start_date`, `end_date` (optional): Date range (defaults to current term)

**Response (200)**: Varies by type

---

## 15. Notification APIs

### GET /notifications

Get the authenticated user's notifications.

**Role Access**: A

**Query Parameters**:
- `is_read` (optional): true, false
- `type` (optional): Filter by type
- `page`, `page_size`: Pagination

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "absent",
      "title": "Absence Alert",
      "body": "Rahul Verma was marked absent today (Class 7A)",
      "priority": "high",
      "is_read": false,
      "requires_ack": true,
      "link": "/attendance/today",
      "created_at": "2026-06-10T07:50:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total": 8, "pages": 1 }
}
```

---

### POST /notifications/{notification_id}/read

Mark a notification as read.

**Role Access**: A (own notification)

**Request**: (empty)

**Response (200)**:
```json
{
  "message": "Notification marked as read"
}
```

---

### POST /notifications/read-all

Mark all notifications as read.

**Role Access**: A

**Response (200)**:
```json
{
  "message": "All notifications marked as read",
  "count": 8
}
```

---

### GET /notifications/unread-count

Get the count of unread notifications (for badge display).

**Role Access**: A

**Response (200)**:
```json
{
  "count": 3
}
```

---

### POST /notifications/{notification_id}/acknowledge

Acknowledge a high-priority notification (e.g., parent noting absence alert).

**Role Access**: A (own notification)

**Request**: (empty)

**Response (200)**:
```json
{
  "message": "Acknowledged",
  "acknowledged_at": "2026-06-10T08:00:00Z"
}
```

---

### POST /announcements

Create a school-wide announcement.

**Role Access**: SA, PR

**Request**:
```json
{
  "title": "Science Fair",
  "body": "The annual Science Fair will be held on Friday, June 20. All entries due by June 18.",
  "priority": "medium",
  "target_roles": ["teacher", "student", "parent"],
  "expires_at": "2026-06-21T23:59:59Z"
}
```

**Response (201)**:
```json
{
  "id": "uuid",
  "title": "Science Fair",
  "created_at": "2026-06-10T08:00:00Z"
}
```

---

### GET /announcements

Get active announcements.

**Role Access**: A

**Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Science Fair",
      "body": "...",
      "priority": "medium",
      "created_by": "Principal",
      "created_at": "2026-06-10T08:00:00Z",
      "expires_at": "2026-06-21T23:59:59Z"
    }
  ]
}
```

---

## 16. AI APIs

### POST /ai/generate-homework

AI generates homework questions for a given context.

**Role Access**: T

**Request**:
```json
{
  "subject_name": "Science",
  "class_name": "7A",
  "chapter_name": "Nutrition in Plants",
  "topic_name": "Photosynthesis",
  "question_count": 5,
  "question_types": ["mcq", "short_answer", "long_answer"]
}
```

**Response (200)**:
```json
{
  "title": "Nutrition in Plants - Homework (AI Generated)",
  "questions": [
    {
      "type": "mcq",
      "question_text": "What is the primary pigment in photosynthesis?",
      "options": ["Chlorophyll", "Carotene", "Xanthophyll", "Anthocyanin"],
      "correct_answer": "Chlorophyll",
      "marks": 1,
      "difficulty": "easy"
    }
  ],
  "total_marks": 10,
  "auto_gradeable_marks": 4,
  "model_used": "gpt-4o-mini",
  "tokens_used": 450,
  "generated_at": "2026-06-10T08:00:00Z"
}
```

**Errors**: `503` (AI service unavailable), `429` (rate limited), `400` (invalid parameters)

---

### POST /ai/generate-test

AI generates a test paper.

**Role Access**: T

**Request**:
```json
{
  "subject_name": "Mathematics",
  "class_name": "8A",
  "chapter_name": "Mensuration",
  "topic_names": ["Area of Circle", "Volume of Cylinder"],
  "test_type": "unit_test",
  "question_count": 10,
  "total_marks": 20,
  "duration_minutes": 40,
  "difficulty": "medium",
  "question_types": ["mcq", "short_answer", "long_answer"]
}
```

**Response (200)**: Full question paper + answer key + metadata

**Errors**: `503` (AI unavailable), `429` (rate limited)

---

### POST /ai/generate-lesson-plan

AI generates a lesson plan for a chapter/topic.

**Role Access**: T

**Request**:
```json
{
  "subject_name": "Science",
  "class_name": "7A",
  "chapter_name": "Nutrition in Plants",
  "topic_name": "Photosynthesis",
  "duration_minutes": 40,
  "model": "5E"
}
```

**Response (200)**:
```json
{
  "title": "Photosynthesis - Lesson Plan",
  "learning_objectives": [
    "SWBAT define photosynthesis",
    "SWBAT identify the reactants and products of photosynthesis"
  ],
  "materials": ["Diagram of plant cell", "Worksheet"],
  "structure": {
    "engage": {"duration": 5, "activity": "Show a plant and ask 'How does it get food?'"},
    "explore": {"duration": 10, "activity": "Students examine leaf diagram"},
    "explain": {"duration": 10, "activity": "Lecture on photosynthesis process"},
    "elaborate": {"duration": 10, "activity": "Group discussion on real-world applications"},
    "evaluate": {"duration": 5, "activity": "Quick quiz: 3 questions"}
  },
  "key_questions": ["What would happen if there were no plants?"],
  "differentiation": {
    "struggling": "Provide labeled diagram",
    "advanced": "Ask about C3 vs C4 plants"
  },
  "homework_suggestion": "Write a paragraph on why photosynthesis is important"
}
```

---

### POST /ai/generate-report-comments

AI generates personalized report comments for students.

**Role Access**: T

**Request**:
```json
{
  "teacher_name": "Priya Sharma",
  "subject_name": "Science",
  "class_name": "7A",
  "tone": "formal",
  "students": [
    {
      "name": "Rahul Verma",
      "attendance_percentage": 92.5,
      "days_attended": 42,
      "total_days": 45,
      "homework_completion": 85.0,
      "test_average": 72.0,
      "test_highest": 85.0,
      "test_lowest": 55.0
    }
  ]
}
```

**Response (200)**:
```json
{
  "comments": [
    {
      "student_name": "Rahul Verma",
      "comment": "Rahul has shown consistent effort in Science this term. His attendance is excellent at 92.5%, and he maintains a good homework completion rate of 85%. His test average of 72% reflects solid understanding of core concepts, though there is room for improvement in application-based questions. I encourage Rahul to practice more numerical problems and participate actively in class discussions. With continued effort, he is well-positioned to improve further in the next term.",
      "strengths": ["Excellent attendance", "Consistent homework submission"],
      "areas_for_improvement": ["Application-based questions", "Class participation"],
      "generated_at": "2026-06-10T08:00:00Z"
    }
  ]
}
```

---

### POST /ai/doubt-assistant

Student asks a doubt, AI responds.

**Role Access**: S

**Request**:
```json
{
  "question": "I don't understand how photosynthesis works. Can you explain it simply?",
  "subject": "Science",
  "grade": 7,
  "topic": "Photosynthesis"
}
```

**Response (200)**:
```json
{
  "answer": "Think of photosynthesis as a plant making its own food! Plants use sunlight, water, and carbon dioxide to create their food (sugar) and release oxygen. It's like a kitchen where:\n\n1. Sunlight = the stove\n2. Water + Carbon Dioxide = ingredients\n3. Chlorophyll (the green part) = the chef\n4. Glucose (sugar) = the meal\n5. Oxygen = a byproduct (like steam)\n\nThe chemical equation is: 6CO2 + 6H2O + sunlight -> C6H12O6 + 6O2\n\nWould you like to try a practice question on this?",
  "suggested_followups": [
    "What is chlorophyll?",
    "Why are plants green?",
    "Give me a practice question on photosynthesis"
  ],
  "remaining_quota": 19
}
```

**Errors**: `429` (daily quota exceeded), `503` (AI unavailable)

---

### POST /ai/parent-weekly-summary

Generate a parent weekly summary (triggered by teacher or scheduled).

**Role Access**: T

**Request**:
```json
{
  "student_id": "uuid",
  "week_start": "2026-06-03",
  "week_end": "2026-06-09",
  "language": "en"
}
```

**Response (200)**:
```json
{
  "student_name": "Rahul Verma",
  "class_name": "7A",
  "week_start": "2026-06-03",
  "week_end": "2026-06-09",
  "attendance": "4 of 5 days present",
  "homework": "3 submitted, 1 pending",
  "tests": "Scored 8/10 on Science quiz",
  "teacher_note": "Rahul is doing well. Needs practice with Algebra.",
  "ai_summary": "Rahul had a productive week! He scored well in the Science test (8/10) and completed all homework on time. He struggled slightly with Algebra on Tuesday. Overall: Great week!",
  "language": "en"
}
```

---

### POST /ai/principal-insights

Generate insights for the principal (on-demand).

**Role Access**: PR, SA

**Request**:
```json
{
  "insight_types": ["risk_summary", "teacher_performance", "curriculum_health"]
}
```

**Response (200)**:
```json
{
  "risk_summary": {
    "critical": 2,
    "high": 8,
    "medium": 5,
    "trend": "improving",
    "new_flags_this_week": 5,
    "resolved_this_week": 3
  },
  "teacher_performance": [
    {"teacher_name": "Mrs. Sharma", "assignments": 8, "avg_score": 78, "status": "on_track"},
    {"teacher_name": "Mr. Kumar", "assignments": 2, "avg_score": 65, "status": "needs_attention"}
  ],
  "curriculum_health": {
    "school_wide_completion": 62,
    "on_track_teachers": 8,
    "behind_teachers": 3,
    "chapters_covered_this_week": 5
  },
  "generated_at": "2026-06-10T08:00:00Z"
}
```

---

## Appendix A: API Analysis

### Duplicate Endpoints

| # | Endpoints | Issue | Action |
|---|-----------|-------|--------|
| 1 | `GET /attendance/students/{student_id}` and `GET /parents/me/children/{student_id}/attendance` | Same data, different access | **KEEP both** — different role access scopes (teacher vs parent) |
| 2 | `POST /ai/generate-homework` and `POST /assignments` with AI generation | AI generation could be embedded in assignment creation | **KEEP both** — AI endpoint is stateless preview, assignment create is stateful save |
| 3 | `GET /analytics/dashboard/principal` and `GET /analytics/dashboard/admin` | Similar data | **KEEP both** — different audience (buyer vs operator) |

### Unnecessary Endpoints (Removed from V1)

| Endpoint (V1) | Reason Removed |
|---------------|----------------|
| CRUD `/academic-years` | Years are config, not REST resources |
| CRUD `/academic-terms` | Terms are date ranges in school settings |
| CRUD `/periods` | Periods are seed data, not managed via API |
| CRUD `/timetable` | Too complex for V2. Timetable is a read-only view. |
| CRUD `/student-parents` | Single `POST /users/{id}/link-parent` replaces it |
| CRUD `/teacher-assignments` | Single `POST /teachers/{id}/assign` replaces it |
| CRUD `/schools` | School is tenant context, not managed via CRUD |
| Full `/reports` module | Reports generated on-demand via analytics |
| Full `/annotations` | Merged into `/announcements` |

### Dangerous Endpoints (Need Careful Protection)

| Endpoint | Danger | Protection |
|----------|--------|------------|
| `DELETE /users/{user_id}` | Data loss | Soft-delete only. Cannot delete self. Audit log. |
| `POST /users/import` | Bulk data corruption | Validate every row. Return errors per row. Max 500 rows. |
| `PATCH /schools` | School config corruption | Validate all fields. Log all changes. |
| `POST /assessments/{id}/grade` | Score manipulation | Only the teacher who created the assessment can grade. All overrides logged. |
| `PATCH /progress/risk/{flag_id}/resolve` | Conceal at-risk students | Resolution reason required. Cannot resolve without notes. Logged. |
| `POST /ai/*` | Cost overflow | Rate limited per teacher. Token budget per request. Cost alerts. |

### Missing Endpoints (Should be Added)

| Endpoint | Reason Missing |
|----------|---------------|
| `POST /auth/forgot-password` | Needed for self-service password reset |
| `POST /auth/reset-password` | Completes password reset flow |
| `GET /health` | System health check (already exists from V1) |
| `GET /health/database` | Database connectivity check |
| `GET /health/ai` | AI provider health check (is API key configured?) |
| `GET /uploads/{file_id}` | File download/serve endpoint |
| `POST /uploads` | File upload endpoint |
| `POST /classes/{class_id}/assign-teacher` | Assign teacher to class |
| `GET /analytics/export?type=pdf` | PDF export endpoint |
| `GET /analytics/export?type=csv` | CSV export endpoint |

---

## Appendix B: Standard Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body fails validation |
| `CONFLICT` | 409 | Duplicate or business rule violation |
| `AUTH_ERROR` | 401 | Invalid, missing, or expired token |
| `PERMISSION_DENIED` | 403 | Insufficient role or data access |
| `RATE_LIMITED` | 429 | Too many requests |
| `AI_UNAVAILABLE` | 503 | AI provider error or not configured |
| `AI_RATE_LIMITED` | 429 | AI generation quota exceeded for teacher |
| `UPSTREAM_ERROR` | 502 | External service (Supabase, AI) error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Appendix C: What Google Would Change

> If Google were designing Athon's APIs, what would they change?

### 1. API First: Design Before Code

Google would insist on an **OpenAPI 3.0 spec** written before any implementation begins. The spec would be the source of truth — code is generated from it, not the other way around. This prevents:
- Inconsistent field naming (`student_name` in one endpoint, `name` in another)
- Missing error codes
- Backward-incompatible changes

### 2. Problem: Inconsistent Resource Nesting

Athon V1 has `/attendance/students/{student_id}` and `/students/{student_id}/attendance` both being valid paths. Google would enforce a single nesting convention:

```
Bad:  /attendance/students/{student_id}   (resource first, then scope)
Good: /students/{student_id}/attendance   (scope first, then resource)
```

**Fix**: All student-scoped endpoints should be `/students/{student_id}/attendance`, `/students/{student_id}/progress`, etc.

### 3. Problem: No Standard Pagination

Some V1 list endpoints support pagination, some don't. Google would enforce:
- Every list endpoint supports `?page_token` (cursor-based, not offset) for >1000 items
- Every list endpoint returns `next_page_token` in meta
- Default `page_size` = 50, max = 200
- Rate limits returned in headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)

### 4. Problem: Non-DRY Permission Checks

V1 scatters `require_role("teacher", "principal", "school_admin")` across 23 route files. Google would use:
- **Annotation-based RBAC**: `@requires_role("teacher")` on the class/method
- **Resource-scoped decorators**: `@scoped_to_school`, `@scoped_to_own_class`
- **No permission logic in route handlers** — decorators only

### 5. Problem: No API Versioning Semantics

Athon uses `/api/v1/` but makes breaking changes without a version bump. Google would enforce:
- `v1`, `v2`, etc. are permanent. `v1` never changes.
- Breaking changes require a new version.
- Deprecated versions are supported for 6 months.
- Header-based versioning: `Accept: application/vnd.athon.v2+json`

### 6. Problem: Inconsistent Response Envelope

Some V1 endpoints return `{data: {...}, error: null}`, others return just the object, others return `{...}`. Google would enforce:
- **Every** response uses the `{data, meta, error}` envelope — no exceptions
- Success: `{data: {...}, meta: {...}, error: null}`
- Error: `{data: null, meta: null, error: {code: "NOT_FOUND", message: "..."}}`
- List: `{data: [...], meta: {page, page_size, total, pages}, error: null}`

### 7. Problem: No Idempotency Keys

Write endpoints can be accidentally called twice (network retry, double-click). Google would enforce:
- Every `POST` and `PATCH` accepts `Idempotency-Key` header
- Duplicate keys within 24h return the original response
- Prevents duplicate attendance marks, duplicate submissions, duplicate payments

### 8. Problem: No Field Masking

List endpoints always return all fields, even when the client only needs 2-3. Google would enforce:
- `?fields=id,name,score` — client specifies needed fields
- Reduces payload by 60-80% for list endpoints
- Speeds up mobile rendering

### 9. Problem: No Async Operation Pattern

AI generation can take 5-8 seconds. Google would use:
- `POST /ai/generate` returns `202 Accepted` with `operation_id`
- `GET /operations/{operation_id}` returns `{status: "pending" | "completed", result: {...}}`
- Frontend polls until complete
- Prevents HTTP timeout for long-running AI tasks

### 10. Problem: No Rate Limit Discovery

Clients have no way to discover their rate limits before hitting them. Google would enforce:
- Every response includes: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `429` response includes `Retry-After` header
- Rate limits documented per endpoint in the spec

---

**Document Version**: 1.0  
**Total Endpoints**: ~70 (down from 107 in V1)  
**Date**: June 10, 2026  
**Next Action**: Code generation from this spec
