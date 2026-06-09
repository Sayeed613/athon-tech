# 🏫 Athon - Project Master Plan

## Vision

Athon is an AI-powered school operating system designed for Indian schools (Classes 1-10).

The goal is simple:

* Reduce teacher administrative work
* Improve parent communication
* Digitize attendance, homework, tests, and reports
* Provide principals with school-wide visibility
* Build a modern mobile-first platform for schools

---

# Problem We Are Solving

## Teachers

Current Problems:

* Attendance in registers
* Homework tracking manually
* Test marks maintained in Excel/books
* Parent communication through WhatsApp groups
* Student performance tracking is difficult

## Parents

Current Problems:

* No visibility into child performance
* Miss attendance information
* No centralized communication
* Language barriers

## Principals

Current Problems:

* No real-time school dashboard
* Cannot track teacher activity
* Cannot identify weak-performing students quickly

---

# Athon Solution

## Teacher App

Teachers can:

* Mark attendance
* Create homework
* Create tests
* View student performance
* Communicate updates
* Track class progress

---

## Student App

Students can:

* View homework
* Attempt homework
* Attempt tests
* View performance
* View attendance
* Join subject communities

---

## Parent Experience

No app required.

Parents receive:

* Attendance alerts
* Homework updates
* Test results
* Weekly reports

via WhatsApp in their preferred language.

---

## Principal Dashboard

Principal can view:

* School attendance
* Teacher activity
* Homework completion
* Test performance
* Student performance trends
* School-wide reports

---

# Database Status

## Completed

### Database Architecture

* 27 Tables
* 11 ENUM Types
* 69 Foreign Keys

### Major Modules

* Schools
* Users
* Teachers
* Principals
* Parents
* Students
* Classes
* Subjects
* Attendance
* Homework
* Tests
* Reports
* Notifications
* AI Generations
* Audit Logs

### Security

* Multi-Tenant Architecture
* Supabase Auth
* Row Level Security
* Audit Trail

### Database Files

Completed:

* enums.sql
* tables.sql
* indexes.sql
* triggers.sql
* rls.sql
* seed.sql

Status:

✅ Complete

---

# Backend Status

## Completed

### Environment Setup

* Python 3.12
* Virtual Environment
* Dependency Management
* Environment Configuration

### FastAPI Setup

* FastAPI
* Uvicorn
* Swagger
* OpenAPI

### Database

* SQLAlchemy Async
* AsyncPG
* Supabase PostgreSQL
* Health Checks

### Migrations

* Alembic
* Async Migration Setup
* Database Versioning

Status:

✅ Complete

---

# Technology Stack

## Backend

* Python 3.12
* FastAPI
* SQLAlchemy 2.0 Async
* AsyncPG
* Alembic
* Pydantic V2

## Database

* PostgreSQL 16
* Supabase

## Authentication

* Supabase Auth
* JWT

## Background Jobs

* Celery
* Redis

## AI

* Gemini
* OpenAI
* Anthropic (Future)

## Communication

* WhatsApp Business API

## Deployment

* Docker
* Docker Compose

---

# Current Working Features

## Live Endpoints

GET

```text
/api/v1/health
```

Response:

```json
{
  "status": "healthy",
  "service": "athon-backend",
  "version": "0.1.0"
}
```

---

GET

```text
/api/v1/health/database
```

Response:

```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

# Tomorrow's Plan

## Step 7

### SQLAlchemy Models

Create:

* School Model
* User Model
* Teacher Model
* Principal Model
* Parent Model
* Student Model

Goal:

Database entities mapped to Python.

Success:

```bash
alembic revision --autogenerate
```

shows no unexpected changes.

---

## Step 8

### Supabase Authentication

Implement:

```text
GET /auth/me
```

Flow:

User JWT
↓
Verify JWT
↓
Get User
↓
Return User Profile

---

## Step 9

### Users Module

Implement:

```text
GET /users/me
```

Goal:

Return authenticated user information.

---

## Step 10

### School Context Middleware

Automatically inject:

* current_school_id
* current_user_id
* current_role

into every request.

Critical for multi-tenant security.

---

# Do Not Build Yet

Avoid:

* Attendance APIs
* Homework APIs
* Test APIs
* Reports
* Notifications
* WhatsApp
* AI Features
* Celery Jobs

Reason:

Authentication and user context must exist first.

---

# Phase 1 Goal

Complete:

* Models
* Authentication
* User Context
* User APIs

---

# Phase 2 Goal

Build:

* Attendance
* Classes
* Subjects
* Students

---

# Phase 3 Goal

Build:

* Homework
* Tests
* Performance Tracking

---

# Phase 4 Goal

Build:

* Reports
* WhatsApp Notifications
* Parent Communication

---

# Phase 5 Goal

Build:

* AI Homework Generation
* AI Test Generation
* AI Reports
* AI Insights

---

# MVP Launch Criteria

Before first school:

Must Have:

* Authentication
* Attendance
* Homework
* Tests
* Reports
* WhatsApp Notifications
* Principal Dashboard

Can Wait:

* AI Reports
* AI Recommendations
* Discord Integration
* Advanced Analytics

---

# Current Project Status

Database: 100% ✅

Backend Foundation: 100% ✅

Authentication: 0%

Business Logic: 0%

Attendance: 0%

Homework: 0%

Tests: 0%

Reports: 0%

WhatsApp: 0%

AI: 0%

Overall Progress:

≈ 25%

The foundation is complete.

The next milestone is transforming the foundation into a working school platform.
