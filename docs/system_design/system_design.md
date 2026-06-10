# ATHON V2 — Complete System Design

**Reviewers**: Google Staff Engineer, Google Staff Product Designer, Principal Architect, Principal Frontend Engineer, Principal Backend Engineer, EdTech Domain Expert  
**Date**: June 10, 2026  
**Status**: Final System Design — Ready for Development  
**Product**: Athon — AI Teacher Operating System for CBSE Schools  
**Version**: V2 (Athon Zero MVP in 4 weeks, V2 in 12 weeks)

---

## Table of Contents

1. [Final Product Vision](#1-final-product-vision)
2. [Role Architecture](#2-role-architecture)
3. [Information Architecture](#3-information-architecture)
4. [Workflow Architecture](#4-workflow-architecture)
5. [Dashboard Architecture](#5-dashboard-architecture)
6. [Curriculum Architecture](#6-curriculum-architecture)
7. [AI Architecture](#7-ai-architecture)
8. [Mobile Experience](#8-mobile-experience)
9. [Analytics Architecture](#9-analytics-architecture)
10. [Notification Architecture](#10-notification-architecture)
11. [Build Roadmap & Athon Zero MVP](#11-build-roadmap--athon-zero-mvp)
12. [Success Metrics](#12-success-metrics)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Features Removed from V1](#14-features-removed-from-v1)
15. [V3 Features (Not in V2)](#15-v3-features-not-in-v2)
16. [Google's Build Order](#16-googles-build-order)

---

## 1. Final Product Vision

### The Problem

A CBSE school teacher spends 50%+ of their working hours on non-teaching tasks:

| Task | Hours/Week | What Athon Automates |
|------|-----------|---------------------|
| Taking attendance (manual roll call, register entry) | 3-4 | Batch mark via mobile in 30 seconds |
| Creating homework & test papers | 4-6 | AI generates in 30 seconds; teacher reviews |
| Grading objective answers | 3-5 | Auto-graded instantly on submission |
| Grading written answers | 4-6 | AI suggests scores; teacher approves |
| Writing report card comments | 2-3 | AI generates from data; teacher customizes |
| Lesson planning | 3-5 | AI generates from curriculum; teacher adapts |
| Parent communication | 2-4 | AI generates weekly summaries; auto-sends |
| **Total non-teaching** | **21-33** | **Target: reduce to 10-15** |

**Athon's promise**: Return 6-10 hours per week to each teacher. That's one full working day. Per teacher. Per week.

### What Athon Is

- An AI Teacher Operating System — the primary interface through which teachers manage their daily workflow
- Curriculum-connected — every assignment, test, and progress metric ties back to specific chapters, topics, and learning objectives
- Mobile-first — teachers' primary device is their phone. Desktop is for deep work (grading, lesson planning)
- Proactive — AI suggests actions before the teacher asks (e.g., "Your class 7A attendance dropped 10% this week. Want me to generate a parent update?")
- Minimal by design — every feature must answer: "Does this save a teacher time?" If the answer isn't an immediate "yes," the feature doesn't ship

### What Athon Is NOT

- Not a School ERP (no payroll, no library management, no transport tracking, no fee management)
- Not an LMS (no SCORM, no LTI, no course authoring, no discussion forums)
- Not a Communication Platform (no WhatsApp client, no email client, no video conferencing)
- Not a Student Social Network (no feeds, no posts, no likes, no messaging between students)
- Not a Gradebook (no GPA calculation, no rank generation, no report card PDF for V2)

### Design Principles

1. **Teacher-first, always** — Every feature starts with a teacher's problem. Students and parents are beneficiaries, not primary users.
2. **AI-native, not AI-wrapped** — AI is the default path. Manual creation is the fallback.
3. **Curriculum-connected** — Nothing is ad-hoc. Every assignment and assessment ties to a chapter, topic, or learning objective.
4. **Mobile-first for teachers** — Attendance, homework viewing, quick grading — all on mobile. Deep work on desktop.
5. **Offline-ready** — Core workflows (attendance, grading) work offline and sync when connected.
6. **10-second rule** — Common actions must complete in 10 seconds or less.
7. **Zero training required** — A teacher who has never seen Athon should be productive within 5 minutes.
8. **Privacy by default** — Student data never leaves the school's control. AI providers are vetted. Data is never used for training.

---

## 2. Role Architecture

### Role Definitions

| Role | Count (Example School) | Primary Goal | Secondary Goal |
|------|----------------------|--------------|----------------|
| School Admin | 1 | Configure school, manage users, oversee operations | Ensure data integrity |
| Principal | 1-2 | Monitor school performance, identify issues | Coach teachers |
| Teacher | 10 | Deliver curriculum, assess students, communicate with parents | Reduce non-teaching workload |
| Student | 700 | Complete assignments, take tests, track progress | Get help when stuck |
| Parent | 700 | Monitor child's performance, attendance, and school communication | Support child's learning |

### Role Hierarchy

```
school_admin
    |
    +-- principal (school_leader)
    |       |
    |       +-- teacher (10-20 per principal)
    |       |       |
    |       |       +-- student (30-50 per teacher)
    |       |       |       +-- parent (1-2 per student)
    |       |       |
    |       |       +-- parent (direct communication)
    |       |
    |       +-- student (school-wide view, no direct management)
    |
    +-- parent (school-wide view, no direct management)
```

### Role Scope Rules

| Rule | Description |
|------|-------------|
| School isolation | Every user sees data only within their school. Cross-school access requires super_admin. |
| Data ownership | Teachers own data they create (assignments, assessments, attendance marks). School_admin owns all school data. |
| Read vs Write | Principals have school-wide read + limited write. Teachers have full write within their classes. Students have write only to own submissions. |
| Parent scope | Parents see only their children's data. They cannot see other students. |
| Admin override | School_admin can override any teacher's data (edit assignment, override grade). All overrides are logged. |

---

## 3. Information Architecture

### Teacher Navigation

```
SIDEBAR                     MOBILE BOTTOM NAV
+------------------+        +------------------+
| Dashboard        |        | Home  Task  Create|
| My Classes       |        |       Grade   Me |
| Attendance       |        +------------------+
| Assignments      |
| Tests            |        TOP PRIORITIES:
| My Progress      |        1. Mark attendance
| Curriculum       |        2. Grade pending work
| Announcements    |        3. Review AI-generated
| Profile          |        4. Check timetable
+------------------+

TEACHER PERMISSIONS:
+ Dashboard:         View own aggregated data
+ My Classes:        View assigned classes, class rosters
+ Attendance:        Mark for own classes, view trends
+ Assignments:       Create, publish, grade (own classes)
+ Tests:             Create, publish, auto-grade (own classes)
+ Curriculum:        View curriculum, mark completion
+ My Progress:       View class performance, student progress
+ Announcements:     View school announcements
+ Profile:           Edit own profile
```

### Student Navigation

```
SIDEBAR                     MOBILE BOTTOM NAV
+------------------+        +------------------+
| Dashboard        |        | Home  HW  Tests  |
| Homework         |        |       Buddy   Me |
| Tests            |        +------------------+
| My Progress      |
| AI Doubt         |
| Announcements    |
| Profile          |

STUDENT PERMISSIONS:
+ Dashboard:         View own summary (pending HW, upcoming tests, attendance)
+ Homework:          View assigned, submit, view scores
+ Tests:             View scheduled, attempt, view results
+ My Progress:       View attendance %, scores, LO mastery
+ AI Doubt:          Ask questions, get answers
+ Announcements:     View school announcements
+ Profile:           Edit own profile (limited)
```

### Parent Navigation

```
SIDEBAR                     MOBILE BOTTOM NAV
+------------------+        +------------------+
| Dashboard        |        | Home  Child  Alerts|
| My Children      |        |     Stats     Me |
| Attendance       |        +------------------+
| Homework         |
| Test Results     |
| Announcements    |
| Profile          |

PARENT PERMISSIONS:
+ Dashboard:         View all children's summary
+ My Children:       View linked children, select active child
+ Attendance:        View each child's attendance
+ Homework:          View each child's homework (view only)
+ Test Results:      View each child's test scores
+ Announcements:     View school announcements
+ Profile:           Edit own profile (limited)
```

### Principal Navigation

```
SIDEBAR                     MOBILE (READ-ONLY)
+------------------+        +------------------+
| Dashboard        |        | Home  Analytics  |
| School Health    |        |       Risk   Me |
| Teachers         |        +------------------+
| Performance      |
| Risk Flags       |
| Curriculum       |
| Announcements    |
| Profile          |

PRINCIPAL PERMISSIONS:
+ Dashboard:         School-wide overview (attendance, performance, risk)
+ School Health:     Detailed school-wide analytics
+ Teachers:          View teacher activity, curriculum completion
+ Performance:       Subject-wise, class-wise performance breakdowns
+ Risk Flags:        View and act on at-risk student flags
+ Curriculum:        Monitor curriculum completion across classes
+ Announcements:     Create school-wide announcements
+ Profile:           Edit own profile
```

### Admin Navigation

```
SIDEBAR                     MOBILE (LIMITED)
+------------------+        +------------------+
| Dashboard        |        | Home  Setup  Me |
| School Setup     |        +------------------+
| Users            |
| Classes          |
| Subjects         |
| Teachers         |
| Students         |
| Parents          |
| Reports          |
| Profile          |

ADMIN PERMISSIONS:
+ Dashboard:         School overview (student/teacher counts, attendance)
+ School Setup:      Configure school name, academic year, terms
+ Users:             Create/edit/deactivate all user roles
+ Classes:           Create/edit classes, assign class teachers
+ Subjects:          Create/edit subjects offered
+ Teachers:          Assign teachers to classes and subjects
+ Students:          Create/edit students, enroll in classes
+ Parents:           Create/edit parents, link to students
+ Reports:           Generate school reports
+ Profile:           Edit own profile
```

---

## 4. Workflow Architecture

### 4.1 Teacher Workflows

#### Workflow A: Daily Attendance (3 min to 30 sec)

```
7:45 AM - Teacher opens Athon on phone
+ Home screen shows: "Mark attendance for 7A (Period 1)"
+ Tap "Mark attendance"
+ Student roster loads with all "Present" (last state preserved)
+ Tap 3 students -> "Absent", 1 student -> "Late"
+ Tap "Submit"
+ Done in 25 seconds
+ In-app notification sent to parents of absent students

Backend:
  GET  /attendance/today?class_id=7A    -> roster with default status
  POST /attendance/batch {records: [...]}
  -> Queue absent notifications (async)
```

#### Workflow B: Create Homework with AI (45 min to 3 min)

```
Teacher is preparing "Nutrition in Plants" for Class 7 Science

Desktop flow:
+ Click "Create Assignment"
+ Select: Class 7, Subject Science
+ Select: Chapter "Nutrition in Plants", Topic "Photosynthesis"
+ Type: Homework
+ Click "AI Generate"
  + AI generates 5 questions (2 MCQ, 2 short answer, 1 long answer)
  + Teacher reviews:
    + Keep all 5
    + Edit question 3 wording
    + Add 1 more MCQ
  + Click "Publish"
  + Done in 3 minutes
+ Students get notification
+ Teacher dashboard updates: "Pending review: 0" (auto-grade for MCQs)
```

#### Workflow C: Generate Test (60 min to 5 min)

```
Teacher needs a Unit Test for "Mensuration" in Class 8 Math

Desktop flow:
+ Click "Create Assessment"
+ Select: Class 8, Subject Math, Chapter "Mensuration"
+ Type: Unit Test
+ Set: 20 marks, 40 minutes, Medium difficulty
+ Click "AI Generate"
  + AI generates full question paper with answer key
  + Teacher reviews:
    + Good question distribution (easy/medium/hard)
    + Reduce marks for Q4 from 4 to 3
    + Remove Q7 (too similar to Q2)
  + Publish with scheduled time
  + Done in 5 minutes
```

#### Workflow D: Grade Submissions (2 hours to 20 min)

```
Teacher opens "Submissions pending" from dashboard

+ Shows: 30 submissions for "Nutrition in Plants HW"
+ For MCQ questions (15 of 30 graded instantly):
  + Auto-graded. Average: 7.2/10
  + Teacher reviews: 2 need manual override

+ For short answer questions:
  + AI suggests scores for each answer
  + Teacher swipes through:
    + Agree (80%) -> tap "Accept"
    + Adjust (15%) -> edit score
    + Disagree (5%) -> write own score
  + Learning objective progress updates automatically

+ 30 submissions graded in 20 minutes
```

#### Workflow E: Track Lesson Progress (30 sec)

```
Teacher finishes teaching "Photosynthesis" in Class 7 Science

+ Open Athon on phone (end of period)
+ Tap "Curriculum" -> Class 7 -> Science -> Nutrition in Plants
+ See: Photosynthesis (In Progress), Other Topics (Not Started)
+ Tap Photosynthesis -> "Mark as Completed"
+ Optional: Add note "Students struggled with light-dependent reactions"
+ Curriculum completion % updates: Chapter now 60% complete
+ Principal view: Mrs. Sharma is on track (3 of 5 topics done)

+ Backend:
  PATCH /curriculum/chapters/{id}/progress
  { status: "completed", note: "..." }
  -> Updates analytics: teacher curriculum completion %
```

#### Workflow F: Lesson Planning (2 hours to 10 min)

```
Teacher planning next week's lessons

Desktop flow:
+ Click "Lesson Planner"
+ Select: Class 7 Science, Chapter "Nutrition in Plants"
+ "Generate Lesson Plan"
  + AI generates:
    + Learning objectives (3-5 per lesson)
    + Materials needed
    + 5E model (Engage, Explore, Explain, Elaborate, Evaluate)
    + Do Now activity
    + Key questions to ask
    + Differentiation strategies
    + Homework suggestion
  + Teacher reviews and customizes
  + Saves to "My Lesson Plans"
+ Curriculum progress updates: "Chapter 5: 3 of 6 topics planned"
+ 1 week of lessons planned in 10 minutes
```

#### Workflow G: Report Card Comments (30 min to 2 min)

```
Teacher needs report comments for 30 students

Desktop flow:
+ Click "Reports" -> "Generate Comments"
+ Select: Class 7, Subject Science, Term 1
+ Click "Generate All"
  + AI generates personalized comments for all 30 students
  + Based on: attendance %, homework completion %, test scores
  + Teacher reviews:
    + Accept (90%)
    + Customize (10%) - add personal note
    + Regenerate (rare)
  + 30 report comments done in 2 minutes
```

### 4.2 Student Workflows

#### Workflow A: Complete Homework (15 min)

```
Student logs in (phone or desktop)
+ Dashboard shows: "2 homework due today"
+ Tap "Nutrition in Plants HW"
+ MCQ questions: tap answers
+ Short answer: type response
+ Upload image if required (photo of handwritten answer)
+ Tap "Submit"
+ Auto-graded MCQs show score immediately
+ Short answers show "Awaiting teacher review"
```

#### Workflow B: Take Test (40 min)

```
Student opens assessment at scheduled time
+ Timer starts (40 min countdown)
+ MCQ questions: tap to answer
+ Short answer: type response
+ Progress bar shows completion %
+ 5 min warning: "5 minutes remaining"
+ Auto-submit when timer expires
+ MCQs graded instantly
+ Results shown: score, correct answers, wrong answers with explanations
```

#### Workflow C: Ask AI Doubt (2 min)

```
Student stuck on "Explain photosynthesis"

+ Tap "AI Doubt" from bottom nav
+ Type: "I don't understand how photosynthesis works. Can you explain it simply?"
+ AI responds with:
  + Simple explanation (grade-appropriate)
  + Diagram suggestion (text-based)
  + Example: "Like a plant making its own food using sunlight"
  + Follow-up: "Would you like to try a practice question on this?"
+ Student understands concept in 2 minutes
+ Optional: Teacher notified if student asks >3 questions on same topic
```

#### Workflow D: Track Progress (1 min)

```
Student opens "My Progress"

+ Attendance: 92% (up 2% this month)
+ Homework completion: 85% (3 pending)
+ Test average: 72% (up 5% vs last month)
+ Learning Objectives:
  + Nutrition in Plants - Mastered
  + Fibre to Fabric - In Progress (70%)
  + Heat - Not Started
+ "Improvement areas: Short answer questions (avg 60%). Try more practice."
```

### 4.3 Parent Workflows

#### Workflow A: Weekly Check (5 min, Saturday)

```
Parent opens Athon (phone)
+ Dashboard shows child's week summary
  + Attendance: 4 of 5 days present
  + Homework: 3 submitted, 1 pending
  + Test: Scored 8/10 on Science quiz
  + AI Summary: "Rahul had a good week. His math scores improved."

+ Tap "View Details" -> full attendance, homework, test history
+ Parent informed in 5 minutes
```

#### Workflow B: Absence Alert (real-time)

```
8:00 AM - Teacher marks Rahul absent
+ Parent gets in-app notification
  + "Rahul was marked absent today (Class 7A)"
  + Time: 8:00 AM
  + Tap to mark as "Noted" or "Report error"
+ If no response by 10 AM, follow-up WhatsApp notification (V3)
```

#### Workflow C: Performance Alert (weekly)

```
Sunday - AI generates child's weekly summary
+ Notification: "Rahul's weekly report is ready"
+ Summary includes:
  + Attendance this week
  + Homework submitted vs pending
  + Test scores
  + Teacher's note (if any)
  + AI tip: "Try practicing multiplication tables for 10 min daily"
+ Available in English and Hindi
```

### 4.4 Principal Workflows

#### Workflow A: Morning Overview (2 min)

```
Principal opens Athon (phone)
+ Dashboard:
  + Attendance today: 85% (up 2% vs yesterday)
  + Class 8B: 72% attendance - tap to investigate
  + 3 teachers with pending grading >3 days
  + 5 new at-risk flags raised

+ Tap "8B" -> see teacher, recent attendance trend
+ Tap "Send message" -> "Please look into 8B attendance."
+ Full school pulse in 2 minutes
```

#### Workflow B: Weekly Review (15 min, Monday morning)

```
Principal reviews last week

+ Teacher Activity:
  + Assignments created: 45 (target: 50)
  + Assessments scheduled: 12 (target: 15)
  + Avg time to grade: 2.3 days (target: <2)
  + Mrs. Sharma: 8 assignments, 0 pending
  + Mr. Kumar: 2 assignments, 15 pending

+ By Subject:
  + Math: 78% avg (up 3%)
  + Science: 74% avg (down 2%)
  + English: 82% avg - Best performer

+ At-Risk Students:
  + High risk: 2 (attendance + performance critical)
  + Medium risk: 8
  + Resolved this week: 3

+ Export as PDF for staff meeting
```

### 4.5 Admin Workflows

#### Workflow A: School Setup (30 min, one-time)

```
Admin configures school

+ School name, address, phone
+ Academic year: April 2026 - March 2027
+ Terms: Term 1 (Apr-Sep), Term 2 (Oct-Mar)
+ Create classes: 1A through 10B (20 classes)
+ Add subjects: Math, Science, English, Hindi, Social Science, Computer Science
+ Upload curriculum: CSV or manual entry (CBSE default available)
+ Invite teachers: email - they set password
+ Import students: CSV upload or manual
+ Link parents: CSV or self-link via parent portal
+ School ready for first day
```

#### Workflow B: User Management (5 min)

```
Admin manages users

+ List all users (filter by role, class, status)
+ Click teacher -> view/set classes, subjects
+ Click student -> view class, parent links, status
+ Bulk import: CSV upload for students, teachers, parents
+ Deactivate user -> confirm -> logged in audit
+ User management complete
```

---

## 5. Dashboard Architecture

### 5.1 Teacher Dashboard

```
+------------------------------------------------------------------+
|  Good morning, Mrs. Sharma!                             8:45 AM  |
|  Today: Period 1 (7A), Period 3 (8B), Period 5 (7B)             |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------------+  +-------------------+  +----------------+ |
|  |  Today Classes    |  |  Pending Grading  |  | Class          | |
|  |                   |  |                   |  | Performance    | |
|  |  7A - Period 1    |  |  12 HW            |  | 7A: 78% avg   | |
|  |  [Mark Attn]      |  |  3 Overdue        |  | 8B: 82% avg   | |
|  |                   |  |                   |  | 7B: 71% avg   | |
|  |  8B - Period 3    |  |  [Grade Now]      |  |               | |
|  |  [Mark Attn]      |  |                   |  | [View All]    | |
|  |                   |  |                   |  |               | |
|  |  7B - Period 5    |  |                   |  |               | |
|  |  [Mark Attn]      |  |                   |  |               | |
|  +-------------------+  +-------------------+  +----------------+ |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Recent Announcements                     [View All]        |  |
|  |  8:00 AM - Science Fair on Friday. All entries due.         |  |
|  |  Yesterday - PTM on Saturday, 10 AM - 2 PM                 |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Weekly Activity                            This Week       |  |
|  |  Assignments: 4  |  Tests: 1  |  Graded: 28/30            |  |
|  |  ################++++++++++++++++++++++++++++++  45% of week|  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 5.2 Student Dashboard

```
+------------------------------------------------------------------+
|  Hey Rahul!  Your attendance: 92%                                |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------------+  +-------------------+  +----------------+ |
|  |  Due Today        |  |  Upcoming Tests   |  | My Progress    | |
|  |                   |  |                   |  |                | |
|  |  - Nutrition HW   |  |  Fri: Math Unit   |  | HW: 85%       | |
|  |    (Sci) Due 4PM  |  |  Test 20 marks    |  | Tests: 72%    | |
|  |                   |  |                   |  | Att: 92%      | |
|  |  - Algebra        |  |  Next Wed:        |  |                | |
|  |    Practice Due 8 |  |  Science Quiz     |  |                | |
|  |                   |  |                   |  |                | |
|  |  [View All]       |  |  [View All]       |  |  [View All]    | |
|  +-------------------+  +-------------------+  +----------------+ |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  AI Doubt Assistant                                        |  |
|  |  "Ask me anything about your studies!"                     |  |
|  |  [Ask a question...]                                       |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Learning Streak: 5 days                                   |  |
|  |  Complete all homework this week to unlock a badge!        |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 5.3 Parent Dashboard

```
+------------------------------------------------------------------+
|  Welcome, Mr. Verma!             Selected: Rahul (7A)            |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  My Children                                                |  |
|  |  +----------------+  +----------------+                     |  |
|  |  | Rahul (7A)     |  | Priya (5B)     |  [Switch]          |  |
|  |  | Active now     |  | Offline        |                     |  |
|  |  +----------------+  +----------------+                     |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +-------------------+  +-------------------+  +----------------+ |
|  |  Attendance       |  |  Homework         |  |  Tests         | |
|  |                   |  |                   |  |                | |
|  |  This Week:       |  |  Submitted: 3/4   |  | Last Test:     | |
|  |  4/5 days present |  |  1 pending        |  | Science: 8/10  | |
|  |  92% this month   |  |                   |  |                | |
|  |  [Details]        |  |  [Details]        |  |  [Details]     | |
|  +-------------------+  +-------------------+  +----------------+ |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Child's Weekly Summary - AI Generated                     |  |
|  |  "Rahul had a productive week! He scored well in the       |  |
|  |  Science test (8/10) and completed all homework on time.   |  |
|  |  He struggled slightly with Algebra on Tuesday - consider  |  |
|  |  extra practice. Overall: Great week!"                     |  |
|  |  [Share with family]                                       |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 5.4 Principal Dashboard

```
+------------------------------------------------------------------+
|  Good morning, Principal!                               Today     |
|  School: Athon Public School | Students: 702 | Teachers: 12      |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------------+  +-------------------+  +----------------+ |
|  |  Today Attendance |  |  This Week        |  |  Risk Alerts   | |
|  |                   |  |  Activity         |  |                | |
|  |  Overall: 85%     |  |  Assign: 12       |  |  High: 2       | |
|  |  [=====85%=====]  |  |  Tests: 4         |  |  Medium: 8     | |
|  |  8B: 72%          |  |  Grade: 60%       |  |  Low: 15       | |
|  |  [Details]        |  |  [Details]        |  |  [View All]    | |
|  +-------------------+  +-------------------+  +----------------+ |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Performance by Subject                                     |  |
|  |  Math:    ################++++  78%                         |  |
|  |  English: ####################  82%                         |  |
|  |  Science: ################+++  74%                          |  |
|  |  Hindi:   ##################+  80%                          |  |
|  |  SS:      ################++  68%                           |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Curriculum Completion                                      |  |
|  |  Mrs. Sharma (Sci): ################++++  81%  On track     |  |
|  |  Mr. Kumar (Math):  ##########+++++++  45%  Behind         |  |
|  |  Ms. Patel (Eng):   ################++  78%  On track      |  |
|  |  [Message Mr. Kumar]                                       |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 5.5 Admin Dashboard

```
+------------------------------------------------------------------+
|  School Admin - Athon Public School                              |
+------------------------------------------------------------------+
|                                                                   |
|  +-------------------+  +-------------------+  +----------------+ |
|  |  Users            |  |  Academic         |  |  School Stats  | |
|  |                   |  |                   |  |                | |
|  |  Teachers: 12     |  |  Classes: 20      |  |  Attendance    | |
|  |  Students: 702    |  |  Subjects: 7      |  |  Today: 85%    | |
|  |  Parents: 680     |  |  Sections: 20     |  |  This Month:   | |
|  |  Active: 98%      |  |                   |  |  87%           | |
|  |                   |  |                   |  |                | |
|  |  [Manage]         |  |  [Manage]         |  |                | |
|  +-------------------+  +-------------------+  +----------------+ |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Quick Actions                                               |  |
|  |  [+ New Teacher]  [+ New Student]  [Import CSV]             |  |
|  |  [Assign Classes]  [Link Parents]                           |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Recent Activity                                            |  |
|  |  - 8:15 AM - Mrs. Sharma created new assignment             |  |
|  |  - 7:50 AM - Mr. Kumar marked attendance for 8B            |  |
|  |  - 7:30 AM - System: Daily backup completed                |  |
|  |  - Yesterday - 5 new parents linked                         |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## 6. Curriculum Architecture

### 6.1 Structure

```
Class (1A, 2B, 7A, 10B...)
|
+-- Subject (Mathematics, Science, English...)
    |
    +-- Chapter (Nutrition in Plants, Mensuration...)
        |
        +-- Topic (Photosynthesis, Area of Circle...)
        |   |
        |   +-- Learning Objective (SWBAT explain photosynthesis...)
        |
        +-- [Status per class: Not Started | In Progress | Completed]
```

### 6.2 Curriculum Completion Tracking

```
Status transitions per chapter per class:

NOT STARTED
    |  Teacher opens chapter for the first time
    v
IN PROGRESS
    |  Teacher creates any assignment/assessment/lesson plan tied to this chapter
    |  OR marks "Started teaching" manually
    |
    +-- Criteria for completion:
    |   +-- 70% of topics have at least one assessment
    |   +-- At least one assignment was given
    |   +-- Teacher manually marks "Completed"
    v
COMPLETED
    |  Teacher marks as completed
    |  OR system auto-marks when:
    |     - All topics have >=1 assessment with attempts
    |     - Curriculum completion % for chapter reaches threshold
    v
Analytics updated: Curriculum completion % per teacher, class, subject
```

### 6.3 How AI Uses Curriculum Context

```
When a teacher generates homework/test/lesson plan:

1. AI receives:
   - Class: 7
   - Subject: Science
   - Chapter: Nutrition in Plants
   - Topic: Photosynthesis
   - LOs: SWBAT explain photosynthesis, SWBAT identify plant parts
   - Previous questions used: ["What is chlorophyll?", "Define photosynthesis"]
   - Student performance: Average 72% on this topic

2. AI generates:
   - Questions that cover uncovered LOs
   - Questions at appropriate difficulty based on student performance
   - Avoids duplicating previously used questions
   - Includes CBSE question patterns (HOTS, application-based)

3. Result:
   - Relevant, non-repetitive, appropriate difficulty
   - Curriculum gap coverage
   - CBSE-aligned
```

### 6.4 How Principal Monitors Curriculum

```
Principal View:
+------------------------------------------------------------------+
|  Curriculum Completion - Term 1                                  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Mrs. Sharma - Science (7A, 7B)                            |  |
|  |  Total: 12 chapters | Completed: 8 | In Prog: 3           |  |
|  |  On track:  (75% at week 10 of 20)                        |  |
|  |  ##########################++++++  75%                     |  |
|  |  [View Details]                                            |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |  Mr. Kumar - Mathematics (8A, 8B)                          |  |
|  |  Total: 10 chapters | Completed: 4 | In Prog: 3           |  |
|  |  Behind: (40% at week 10 of 20)                            |  |
|  |  ##########+++++++++++++++++++++++++  40%                  |  |
|  |  [Message Teacher] [View Details]                           |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  3 teachers behind schedule.                                     |
|  Last week's completions: 5 chapters (+2 vs prev week)          |
+------------------------------------------------------------------+
```

### 6.5 Curriculum Data Model

```
cbse_curriculum:
  Standard CBSE curriculum for each class to subject
  Pre-loaded, not editable by schools (can be customized)

school_curriculum:
  id, school_id, class_id, subject_id, chapter_name,
  chapter_order, chapter_status (not_started|in_progress|completed),
  completion_percentage (calculated), created_at, updated_at

topics:
  id, school_curriculum_id, chapter_id, topic_name,
  topic_order, created_at, updated_at

learning_objectives:
  id, topic_id, lo_text (e.g., "SWBAT explain photosynthesis"),
  lo_code (e.g., "SCI-7-NP-01"), created_at, updated_at
```

---

## 7. AI Architecture

### 7.1 Teacher AI

| Capability | Trigger | Input | Output | Latency |
|-----------|---------|-------|--------|---------|
| Homework Generator | Teacher clicks "Generate" | Class, subject, chapter, topic, count, types | Questions + answer key | <5s |
| Test Generator | Teacher clicks "Generate" | Class, subject, chapter, marks, duration, difficulty | Full question paper + answer key | <8s |
| Lesson Planner | Teacher clicks "Generate Plan" | Class, subject, chapter, duration | Full lesson plan (5E model) | <5s |
| Rubric Generator | Teacher creates assessment | Subject, question types, grade level | Grading rubric | <3s |
| Report Comment Generator | Teacher clicks "Generate Comments" | Student data, subject, tone | Personalized comments per student | <3s/student |
| Auto-Grader (MCQ/TF) | Student submits | Answer key, student answers | Score | <500ms |
| Score Suggester (Written) | Teacher opens submission | Question, student answer, rubric | Suggested score | <3s |

### 7.2 Student AI (Doubt Assistant + Learning Companion)

The Student AI has two modes:

**Doubt Assistant** (reactive): Student asks a question, AI answers. Best for quick clarification.

**Learning Companion** (proactive): AI tracks what the student has studied, suggests practice, recommends review topics based on performance, and offers encouragement. Ships in basic form in V2 (responds to questions + offers follow-up practice). Full proactive mode requires usage data and is a V3 target.

| Capability | Mode | Trigger | Input | Output | Safeguards |
|-----------|------|---------|-------|--------|------------|
| Doubt Assistant | Reactive | Student types question | Question, subject, grade | Answer, explanation, example | 20 questions/day max |
| Practice Generator | Proactive | Student asks or AI suggests | Subject, topic, difficulty | Practice questions with answers | 5 sets/day max |
| Concept Explainer | Both | Student asks "Explain X" | Concept name, grade level | Simple explanation + examples | No restrictions |
| Homework Hint | Reactive | Student stuck on question | Question, student's attempt | Hint (not answer) | First hint free |

### 7.3 Parent AI

| Capability | Trigger | Input | Output | Frequency |
|-----------|---------|-------|--------|-----------|
| Weekly Summary | Scheduled (Sunday) | Child's attendance, HW, test data, teacher notes | Personalized summary + tips | Weekly |
| Alert Message | Below-threshold event | Child's name, issue type, severity | Notification message | Real-time |
| PTA Message Generator | Teacher clicks "Notify Parent" | Issue, student data | Draft message | On-demand |

### 7.4 Principal AI

| Capability | Trigger | Input | Output | Frequency |
|-----------|---------|-------|--------|-----------|
| Risk Detection | Daily batch | All student attendance + performance + HW data | Risk flags (low/med/high/critical) | Daily |
| Teacher Performance Insights | Weekly batch | Teacher activity data | Performance summary per teacher | Weekly |
| Curriculum Insights | On-demand | Curriculum completion data | Status report with alerts | On-demand |
| Attendance Trend Analysis | Weekly batch | Attendance data | Trend report + anomaly detection | Weekly |

### 7.5 AI Architecture Layers

```
+--------------------------------------------------------------+
|                      TEACHER AI                               |
|  +----------+  +----------+  +----------+  +--------------+  |
|  | Homework |  |   Test   |  |  Lesson  |  |   Report     |  |
|  | Generator|  | Generator|  | Planner  |  |  Generator   |  |
|  +----+-----+  +----+-----+  +----+-----+  +------+-------+  |
|       |             |              |                |          |
+-------+-------------+--------------+----------------+----------+
                        |
+-----------------------+----------------------------------------+
|                   ORCHESTRATION LAYER                          |
|  . Prompt assembly (templates + curriculum context)           |
|  . Curriculum context injection (class, subject, chapter, LO) |
|  . Caching check (lesson plans, rubrics)                      |
|  . Rate limiting                                              |
|  . Token tracking & cost monitoring                           |
|  . Fallback routing (OpenAI to Anthropic)                     |
+-----------------------+----------------------------------------+
                        |
+-----------------------+----------------------------------------+
|                      SAFETY LAYER                             |
|  . Content filtering (profanity, inappropriate content)       |
|  . Prompt injection detection                                 |
|  . Output validation (JSON parsing, schema check)             |
|  . PII detection & stripping                                  |
|  . Teacher approval required before publishing                |
+-----------------------+----------------------------------------+
                        |
+-----------------------+----------------------------------------+
|                    PROVIDER LAYER                              |
|  +------------------+  +------------------+                   |
|  |   OpenAI         |  | Anthropic        |  (fallback)       |
|  |   gpt-4o-mini    |  | Claude Sonnet    |                   |
|  +------------------+  +------------------+                   |
+-----------------------+----------------------------------------+
                        |
+-----------------------+----------------------------------------+
|                      CACHING LAYER                             |
|  . SHORT (5 min): Dashboard, attendance                       |
|  . MEDIUM (1 hr): Teacher class list, curriculum tree         |
|  . LONG (24 hr): Lesson plans, rubrics, parent summaries      |
|  . NEVER: Homework questions, test papers (always fresh)      |
+---------------------------------------------------------------+
```

### 7.6 AI Data Storage Rules

| Data Type | Stored? | Where | Retention |
|-----------|---------|-------|-----------|
| Generated questions (final) | Yes | assignments/questions table | Permanent |
| Generated test papers (final) | Yes | assessments/questions table | Permanent |
| AI generation logs (prompt, response, tokens) | Yes | ai_generations table | 90 days |
| Raw LLM responses | No | Never stored | N/A |
| Student PII in prompts | No | Stripped before sending | N/A |
| Teacher edits to AI content | No | Only final version stored | N/A |
| Failed generations | No | Count only (no content) | N/A |
| Student AI chat history | Session | In-memory + Redis | 24 hours |
| Token usage per teacher | Yes | ai_generations table | Monthly rollup |

---

## 8. Mobile Experience

### Phasing Summary

| App | Ships In | Features |
|-----|----------|----------|
| Teacher Mobile | Phase 2 (Week 3-4) | Attendance, HW creation, grading |
| Student Mobile | Phase 4 (Week 7-8) | HW submission, tests, AI doubts |
| Parent Mobile | Phase 4 (Week 7-8) | Child monitoring, weekly reports |
| Principal Mobile | Phase 5 (Week 9-10) | Analytics, risk flags, read-only |

All apps are PWA (Progressive Web App) - installed from browser, works offline, push notifications. No native app store submission required for V2.

### 8.1 Design Principles (All Roles)

1. Bottom navigation - primary actions within thumb reach
2. Swipeable cards - quick review of submissions, attendance
3. Pull to refresh - always fresh data
4. Offline first - attendance marking works without internet
5. Push notifications - real-time alerts for high-priority events
6. Progress indicators - clear feedback for every action
7. Vibration haptics - confirm actions without looking
8. Hindi language support - UI available in English and Hindi

### 8.2 Teacher Mobile App

```
Bottom Navigation:
+--------+--------+--------+--------+--------+
|  Home  | Classes| Create | Grade  | Profile|
+--------+--------+--------+--------+--------+

Home Screen (default):
+ Today's schedule (with attendance buttons)
+ Pending grading count (tap to jump to grading)
+ Recent activity (new submissions, absent students)
+ Quick actions: [Mark Attendance] [Check HW]

Classes Screen:
+ List of assigned classes
+ Each class shows: name, student count, pending items
+ Tap class -> class detail (roster, attendance, assignments)

Create Screen:
+ [New Assignment] [New Test] [Lesson Plan] [Report Comment]
+ Each launches guided creation flow with AI generation

Grade Screen:
+ List of pending submissions per assignment/test
+ Swipe left/right to grade next/prev student
+ Tap score to edit, hold to accept AI suggestion

Key Mobile-First Features:
+ Attendance: Checkbox list, tap to toggle status
+ Grading: Swipeable cards, tap to edit score
+ HW review: View responses, tap to mark correct/incorrect
+ Notifications: Badge on Home tab, tap to view
```

### 8.3 Student Mobile App

```
Bottom Navigation:
+--------+--------+--------+--------+--------+
|  Home  | Homework| Tests | AI Buddy| Profile|
+--------+--------+--------+--------+--------+

Home Screen:
+ Today's timetable (next class, current subject)
+ Pending homework count
+ Upcoming tests
+ Quick stats: attendance, HW completion, streak

Homework Screen:
+ List: Due Today, Due This Week, Past Due
+ Each item: subject, title, due time, status
+ Tap -> view questions, submit answers

Tests Screen:
+ Upcoming tests (with countdown timer)
+ Past tests (with scores)
+ Tap upcoming -> view details (cannot start before scheduled time)

AI Buddy Screen:
+ Chat interface (Doubt Assistant + Learning Companion)
+ Suggested questions: "Explain photosynthesis" "Help with Q3"
+ History of recent conversations
+ "Ask a question..." text input
```

### 8.4 Parent Mobile App

```
Bottom Navigation:
+--------+--------+--------+--------+
|  Home  | My Child| Alerts| Profile|
+--------+--------+--------+--------+

Home Screen:
+ Child selector (if multiple children)
+ Weekly summary card (AI-generated)
+ Quick stats: attendance, HW completion, test avg
+ Recent alerts

My Child Screen:
+ Attendance calendar view
+ Homework list (view only)
+ Test scores chart
+ Learning objective progress

Alerts Screen:
+ Absence notifications (with "Noted" button)
+ Performance alerts (score below threshold)
+ Teacher messages
+ Weekly summary archive

Note: Parent app is view-only. No submission, no grading.
```

### 8.5 Principal Mobile App

```
Bottom Navigation:
+--------+--------+--------+--------+
|  Home  | Insights| Alerts| Profile|
+--------+--------+--------+--------+

Home Screen:
+ Today's attendance (school-wide)
+ Key metrics: teachers active, new flags, pending items
+ Action items: "3 teachers behind schedule"

Insights Screen:
+ Performance by class, subject, teacher
+ Attendance trends (this month vs last)
+ Curriculum completion rates
+ Tap any metric -> detailed breakdown

Alerts Screen:
+ Risk flags by severity
+ Attendance anomalies (class dropped >10%)
+ Teacher inactivity warnings
+ Tap -> view details, send message
```

---

## 9. Analytics Architecture

### 9.1 Data Sources

```
Analytics Data Flows:
+-------------+    +-------------+    +-------------+
| Attendance  |    | Assignments |    | Assessments |
| Database    |    | Database    |    | Database    |
+------+------+    +------+------+    +------+------+
       |                  |                   |
       +------------------+-------------------+
                          |
              +-----------v-----------+
              |   ANALYTICS ENGINE     |
              |                       |
              |  +-----------------+  |
              |  | Real-time        |  |  Dashboard queries (<5 min stale)
              |  | (Redis cache)    |  |
              |  +-----------------+  |
              |                       |
              |  +-----------------+  |
              |  | Daily Batch      |  |  Risk detection, progress update
              |  | (Celery job)     |  |  (24h fresh)
              |  +-----------------+  |
              |                       |
              |  +-----------------+  |
              |  | Materialized     |  |  Monthly trends, performance
              |  | Views (PG)       |  |  (configurable refresh)
              |  +-----------------+  |
              +-----------------------+
                          |
              +-----------v-----------+
              |    ANALYTICS DB        |
              |  (dashboard_cache,     |
              |   daily_summaries,     |
              |   student_risk_flags)  |
              +-----------------------+
```

### 9.2 Metrics Definitions

| Metric | Formula | Update Frequency | Cached? |
|--------|---------|-----------------|---------|
| Attendance % | (Present + Late + HalfDay) / Total x 100 | Real-time on mark | 5 min |
| Homework completion % | Submitted / Assigned x 100 | On submission/grade | 5 min |
| Assignment avg score | Sum(scores) / Count(graded) | On grade | 5 min |
| Test pass rate | Passed / Attempted x 100 | On grade | 5 min |
| Curriculum completion % | Completed / Total chapters x 100 | On teacher mark | 1 hr |
| Teacher activity score | Assignments + tests + graded / week | Daily batch | 1 hr |
| Student risk level | Composite: attendance %, perf trend, HW | Daily batch | 1 hr |
| LO mastery | Correct attempts / Total attempts per LO | On grade | 1 hr |

### 9.3 Dashboard Composition Strategy

```
Role-based dashboard = Pre-computed cache + Live data

Cache Keys:
+ dashboard:teacher:{teacher_id}      (5 min TTL)
+ dashboard:student:{student_id}      (5 min TTL)
+ dashboard:parent:{parent_id}        (5 min TTL)
+ dashboard:principal:{school_id}     (5 min TTL)
+ dashboard:admin:{school_id}         (5 min TTL)

Cache Invalidation:
+ On attendance mark -> invalidate teacher + principal dashboards
+ On assignment publish -> invalidate teacher + student dashboards
+ On submission -> invalidate student + teacher dashboards
+ On grade -> invalidate teacher + student + principal dashboards
+ Daily batch -> risk flags, parent summaries, curriculum insights
+ On school config change -> invalidate admin dashboard

Backend handles cache-miss gracefully: compute from DB in <500ms
```

### 9.4 Risk Detection Algorithm

```
Risk Detection - Daily Batch Job:

For each student:
  + attendance_pct = last 30 days attendance %
  + hw_completion_pct = last 30 days HW completion %
  + performance_avg = avg score of last 3 assessments
  + performance_trend = slope of last 5 scores (-1 to +1)

  + Risk Score = weighted composite:
    + attendance_pct < 80% -> +30 points
    + hw_completion_pct < 60% -> +25 points
    + performance_avg < 40% -> +30 points
    + performance_trend < -0.3 -> +15 points
    + consecutive_absences > 3 -> +20 points

  + Risk Level:
    + 0-20: Low (green) - monitor
    + 21-50: Medium (yellow) - notify teacher
    + 51-80: High (orange) - notify teacher + principal
    + 81+: Critical (red) - immediate alert to all

  + Store in student_risk_flags table

Alert Thresholds:
+ High risk: Teacher notified in-app, principal notified
+ Critical risk: Teacher + principal notified immediately
+ Attendance drop >10% in 1 week: Principal notified
+ Performance drop >20% in 1 month: Teacher notified
```

---

## 10. Notification Architecture

### 10.1 Notification Channels

| Channel | Supported in V2? | Latency | Cost | Best For |
|---------|-----------------|---------|------|----------|
| In-app | Yes | Real-time | Free | All notifications |
| Push | Yes | <30s | Free (basic) | Time-sensitive alerts |
| WhatsApp | V3 | <1min | Per-message | Parent absence alerts |
| Email | V3 | <5min | Free | Weekly summaries |
| SMS | No | <10s | Per-message | Emergency only |

### 10.2 Notification Events

| Event | Channel | Recipients | Priority | Content |
|-------|---------|------------|----------|---------|
| Student absent | In-app + Push | Parent | High | Rahul was marked absent today |
| New assignment | In-app + Push | Students in class | Medium | New Science HW due tomorrow |
| New test scheduled | In-app + Push | Students in class | Medium | Math Unit Test on Friday |
| Submission graded | In-app | Student | Medium | Your Science HW was graded: 8/10 |
| Grading pending >3 days | In-app | Teacher | Low | You have 12 submissions pending |
| Attendance dropped | In-app | Principal | Low | Class 8B attendance dropped to 72% |
| Risk flag raised | In-app + Push | Teacher | High | Rahul flagged as high risk |
| Weekly summary ready | In-app | Parent | Low | Rahul's weekly report is ready |
| Announcement posted | In-app | All users | Medium | Science Fair on Friday |
| Curriculum behind | In-app | Principal | Low | 3 teachers behind schedule |
| Low teacher activity | In-app | Principal | Low | Mr. Kumar no assignments this week |

### 10.3 Notification Delivery Rules

```
Priority-based throttling:

HIGH (Absence, Risk flag):
+ In-app: Immediate
+ Push: Immediate
+ WhatsApp (V3): If no in-app read in 30 min
+ Rate limit: 5 per hour per user

MEDIUM (New assignment, test scheduled):
+ In-app: Immediate
+ Push: Batch every 5 min
+ Rate limit: 20 per day per user

LOW (Weekly summary, curriculum update):
+ In-app: Immediate
+ Push: No push (in-app only)
+ Rate limit: 10 per day per user

Quiet Hours:
+ Default: 8 PM - 7 AM
+ Only HIGH priority notifications during quiet hours
+ Configurable per user

Notification Retention:
+ In-app: 90 days
+ Push: Delivered once, not stored
+ Read receipts: Tracked for HIGH priority
```

### 10.4 Notification Data Model

```
notifications:
  id, school_id,
  type (absent|new_assignment|grade|risk|announcement|summary),
  title, body,
  priority (high|medium|low),
  sender_id (user_id, nullable for system),
  recipient_role (teacher|student|parent|principal|admin),
  link (deep link to relevant page),
  requires_ack (boolean - for high priority),
  created_at

notification_recipients:
  id, notification_id, user_id,
  is_read (boolean),
  read_at,
  is_acknowledged (boolean),
  push_sent (boolean),
  push_sent_at
```

---

## 11. Build Roadmap & Athon Zero MVP

### Athon Zero / MVP (Weeks 1-4)

**Athon Zero** is the smallest possible version of Athon that delivers measurable value to a teacher: auth + attendance + AI-generated homework with auto-grading. It ships at the end of Week 4. Everything beyond this point is "nice to have" until Athon Zero is stable and adopted.

```
Athon Zero Scope:
+ Auth (login, register, roles)
+ School setup (admin creates classes, subjects, users)
+ Curriculum browser (view chapters, topics)
+ Attendance marking (batch, mobile-first)
+ Homework creation (with AI generation)
+ Homework submission (student)
+ Auto-grading (MCQ/TF)
+ Manual grading (written answers)
+ Basic dashboards (teacher, student)
+ In-app notifications

Users: 1 admin, 1-2 principals, 10 teachers, 700 students, 700 parents
Time saved per teacher: ~4 hours/week
Build time: 4 weeks
```

---

### V2 Feature Summary

**Athon V2** includes everything from Athon Zero (Phases 1-2) plus:

| Feature | Phase | Ships Week |
|---------|-------|------------|
| Auth + RBAC + school setup | 1 | 1-2 |
| Curriculum browser | 1 | 1-2 |
| Attendance marking (batch, mobile) | 2 | 3-4 |
| Homework with AI generation | 2 | 3-4 |
| Auto-grading (MCQ/TF) | 2 | 3-4 |
| Test creation with AI generation | 2 | 3-4 |
| Assessment attempt flow (timer) | 2 | 3-4 |
| Teacher grading interface | 2 | 3-4 |
| File uploads | 2 | 3-4 |
| Lesson planner (AI) | 3 | 5-6 |
| Report comment generator | 3 | 5-6 |
| Rubric generator | 3 | 5-6 |
| Curriculum completion tracking | 3 | 5-6 |
| Per-LO progress tracking | 3 | 5-6 |
| Principal dashboard | 3 | 5-6 |
| Student AI (Doubt Assistant + Learning Companion) | 4 | 7-8 |
| Parent portal + weekly summaries | 4 | 7-8 |
| In-app + push notifications | 4 | 7-8 |
| Risk detection (daily batch) | 4 | 7-8 |
| Principal advanced analytics | 5 | 9-10 |
| Teacher performance insights | 5 | 9-10 |
| Alert system (automated) | 5 | 9-10 |
| PWA offline support | 6 | 11-12 |
| Hindi language support | 6 | 11-12 |
| Production deployment | 6 | 11-12 |

**Out of scope for V2** (deferred to V3): WhatsApp integration, full offline sync, PDF report cards, native mobile apps, predictive analytics, multi-language beyond Hindi.

---

### Phase 1: Foundation (Week 1-2)

**Stack**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL (Supabase) | Next.js 14 + Tailwind + shadcn/ui | Redis | OpenAI (gpt-4o-mini) | Celery (background jobs)

```
Goal: Working auth + school setup + curriculum

Backend:
+ FastAPI bootstrap + database connection
+ Supabase Auth (login, me, refresh, logout)
+ RBAC decorators + permission system
+ BaseRepository + migrations
+ Redis cache client + rate limiting middleware
+ Error taxonomy + standard response format
+ Health checks (system, database, AI)

Database Tables:
+ schools, users, teachers, students, parents
+ classes, subjects, chapters, topics, curriculum
+ attendance
+ assignments, questions, submissions, answers (unified)
+ notifications, announcements
+ progress, student_risk_flags

Frontend:
+ Next.js project setup + Tailwind + shadcn/ui
+ Auth flow (login, signup, forgot password)
+ Layout + navigation (sidebar + mobile bottom nav)
+ School setup wizard (admin)
+ User management (admin CRUD)
+ Curriculum browser (view chapters, topics, LOs)

AI:
+ OpenAI provider (basic)
+ Prompt templates for homework + test generation
+ Basic generation endpoint

Milestone: Admin can set up school, create users, view curriculum
```

### Phase 2: Core School Operations (Week 3-4)

```
Goal: Teachers can take attendance, give homework, grade

Backend:
+ Attendance module (batch mark, today view, trends)
+ Assignment module (create, publish, submit, grade)
+ Assessment module (create, publish, attempt, auto-grade)
+ Question CRUD (manual + AI generation)
+ File upload service (homework attachments)

Frontend:
+ Teacher Dashboard (classes, pending grading, schedule)
+ Teacher Mobile: Attendance marking (batch UI, today's roster)
+ Teacher Mobile: Assignment creation (with AI generation flow)
+ Teacher Mobile: Grading interface (swipeable cards)
+ Assignment submission (student)
+ Assessment attempt (student, with timer)
+ Auto-grading results display
+ Student Dashboard (homework due, upcoming tests)

AI:
+ Homework generator
+ Test generator
+ MCQ/TF auto-grader
+ Short answer score suggester

Milestone: Teacher can complete full homework cycle (create - AI generate - publish - student submits - AI grades MCQs - teacher grades written - results published)
```

### Phase 3: Teacher AI (Week 5-6)

```
Goal: AI-powered lesson planning, report comments, curriculum insights

Backend:
+ Lesson planner endpoint
+ Rubric generator endpoint
+ Report comment generator endpoint
+ Curriculum completion tracking
+ Progress tracking (per-LO mastery)
+ Analytics endpoints (dashboard data)

Frontend:
+ Lesson planner UI (view, edit, save AI-generated plans)
+ Rubric editor
+ Report comment generator UI
+ Curriculum completion view (teacher)
+ Progress tracking view (student + teacher)
+ Principal Dashboard (attendance, performance, curriculum)
+ Admin Dashboard (users, classes, school stats)

AI:
+ Lesson planner
+ Rubric generator
+ Report comment generator
+ Curriculum insights for principal
+ Cache tier implementation (lesson plans, rubrics)

Milestone: Teacher can plan lessons, generate reports, view curriculum progress. Principal can view school-wide analytics.
```

### Phase 4: Student + Parent Experience (Week 7-8)

```
Goal: Student AI assistant, parent portal, notifications

Backend:
+ Student AI doubt assistant endpoint
+ Practice question generator
+ Parent dashboard endpoints
+ Notification engine (in-app + push)
+ Weekly summary generator
+ Risk detection (daily batch job)
+ Parent weekly report endpoints

Frontend:
+ Student Mobile: AI Buddy chat interface (Doubt Assistant + Learning Companion)
+ Student progress dashboard (attendance, scores, LO mastery)
+ Parent Mobile: Dashboard (child attendance, homework, tests)
+ Parent Mobile: Weekly summary view
+ Notification center (in-app)
+ Push notification integration

AI:
+ Doubt assistant (student)
+ Practice question generator
+ Parent weekly summary generator
+ Risk detection algorithm

Milestone: Full student experience. Full parent experience. Automated risk detection.
```

### Phase 5: Principal Intelligence (Week 9-10)

```
Goal: Advanced analytics, teacher performance insights, automated alerts

Backend:
+ Teacher performance analytics
+ Advanced attendance trend analysis
+ Curriculum completion alerts
+ Automated notification triggers
+ Export endpoints (CSV, PDF)
+ Materialized views for monthly trends

Frontend:
+ Principal Mobile: Analytics dashboard (advanced)
+ Teacher performance view
+ Risk management interface (review, acknowledge, resolve)
+ Alert configuration (thresholds, quiet hours)
+ Report export (CSV, PDF)

AI:
+ Teacher performance insights
+ Anomaly detection (attendance drops, performance declines)
+ Alert prioritization algorithm
+ Predictive risk (students likely to fall behind)

Milestone: Principal can monitor entire school, identify issues, take action. Automated alert system operational.
```

### Phase 6: Scale + Polish (Week 11-12)

```
Goal: Performance optimization, security hardening, production deployment

Backend:
+ Database query optimization (index review, slow query log)
+ Caching optimization (hit rate monitoring)
+ Rate limiting final tuning
+ Security audit (dependency scan, penetration testing)
+ Load testing (100x concurrent users)
+ Error monitoring setup (Sentry)
+ CI/CD pipeline (GitHub Actions to deploy)
+ Documentation (API docs, deployment guide)

Frontend:
+ Performance optimization (bundle size, lazy loading)
+ Accessibility audit
+ Loading states, error states, empty states
+ Offline support (PWA manifest, service worker)
+ Responsive design final pass
+ Hindi language support

Infrastructure:
+ Production server setup (VPS/cloud)
+ PostgreSQL configuration (connection pooling, backup)
+ Redis configuration
+ SSL certificate
+ Monitoring (uptime, error rate, response time)
+ Backup strategy (daily DB backup, file backup)

Milestone: Production-ready, documented, tested, monitored.
```

---

## 12. Success Metrics

### Teacher Impact

| Metric | Baseline | Athon Zero Target | Athon V2 Target |
|--------|----------|-------------------|-----------------|
| Time to mark attendance (30 students) | 5 min | 30 sec | 30 sec |
| Time to create homework | 45 min | 5 min | 3 min |
| Time to create test paper | 90 min | 10 min | 5 min |
| Time to grade 30 submissions | 120 min | 40 min | 20 min |
| Time to write 30 report comments | 30 min | 5 min | 2 min |
| Time to plan 1 week of lessons | 120 min | 20 min | 10 min |
| **Total weekly time saved** | **0 hours** | **~4 hours** | **~8 hours** |

### Product Metrics

| Metric | Athon Zero (Week 4) | Athon V2 (Week 12) |
|--------|--------------------|--------------------|
| Active teachers (DAU/MAU) | >50% | >80% |
| Attendance marked on time | >70% | >90% |
| Homework published on time | >50% | >80% |
| Grading completed within 48h | >30% | >70% |
| AI acceptance rate (generations kept) | >70% | >80% |
| Parent weekly summary open rate | N/A | >60% |
| Student AI doubt resolution rate | N/A | >80% |
| NPS (Teacher) | >30 | >50 |
| NPS (Principal) | >20 | >40 |

### Technical Metrics

| Metric | Target |
|--------|--------|
| API response time (p95) | <500ms |
| Dashboard load time (p95) | <2s |
| AI generation time (p95) | <8s |
| Uptime | >99.5% |
| Error rate | <0.1% |
| Test coverage | >70% |

---

## 13. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| AI cost exceeds budget | Medium | High | Per-teacher daily limits, cost alerts, caching, provider fallback |
| AI quality insufficient | Medium | Medium | Teacher review required before publishing, feedback loop |
| Internet unreliability (Indian schools) | High | High | PWA offline support in Phase 2 |
| Teacher tech adoption low | Medium | High | Zero-training UI, mobile-first, AI reduces friction |
| Parent WhatsApp not ready | Medium | Medium | In-app + push first, WhatsApp in V3 |
| Principal ignores analytics | Medium | Medium | Start with 5 core metrics, mobile-first |
| Data privacy concerns | Medium | High | OpenAI data not used for training, school-owned data |
| Student AI generates wrong answers | Low | Medium | AI responses reviewed, disclaimer displayed |
| Risk detection false positives | Medium | Low | Conservative thresholds, teacher review required |
| Scaling to 100+ schools | Low (V2) | Medium | Designed for horizontal scaling from start |
| Admin setup complexity | Medium | Medium | CSV import, default CBSE curriculum, setup wizard |

---

## 14. Features Removed from V1

| V1 Feature | Reason Removed | V2 Equivalent |
|------------|---------------|---------------|
| Full Academic Calendar | Over-engineered. Years/terms are config. | School settings |
| Period/Timetable CRUD | Complex for V2. Read-only view. | Simple period listing |
| Separate Homework/Tests | Same data model, different metadata | Unified Assignments + Assessments |
| Student-Parent CRUD | Single action, not full CRUD | POST /users/{id}/link-parent |
| Teacher Assignments CRUD | Single action, not full CRUD | POST /classes/{id}/assign-teacher |
| School CRUD | School is tenant context | Part of school setup wizard |
| Full Reports Module | Reports generated on-demand | Analytics module |
| Announcements Module | Merged into communications | Part of communications |
| Celery Stubs | Not implemented, would add maintenance | Implement in Phase 4 |
| WhatsApp Provider | Not implemented, high complexity | Deferred to V3 |
| Storage Service | Not implemented, not needed yet | File upload in Phase 2 |
| School Admin vs Principal split | Confusing, overlapping scope | school_leader role |
| super_admin role | Not needed until multi-school | Config flag |

**Total removed: ~40% of V1 feature surface.**

---

## 15. V3 Features (Not in V2)

| Feature | Priority | Why Deferred |
|---------|----------|--------------|
| WhatsApp integration | High | Business verification, costs, compliance |
| Offline sync engine | High | Complex PWA + background sync |
| Multi-language support | High | Localization infrastructure significant |
| PDF report cards | Medium | PDF generation + formatting complex |
| Advanced AI doubt assistant | Medium | Needs student interaction data |
| Practice test recommendations | Medium | Needs enough assessment data |
| Teacher collaboration (share assignments) | Medium | Multi-user permissions complex |
| Biometric attendance | Low | Hardware integration |
| Integration with other school systems | Low | No standard APIs in Indian schools |
| Advanced analytics (predictive) | Low | Needs 6+ months of data |
| Full native mobile apps (React Native) | Low | PWA sufficient for V2 |
| Video lesson uploads | Low | Storage + streaming costs |
| Student peer learning | Low | Social features are risky |
| Fee management | Not Athon | ERP feature |
| Library management | Not Athon | ERP feature |

---

## 16. Google's Build Order

> If Google were building Athon from scratch today, what would they build first, second, third, and why?

### First: Auth + Identity + School Setup

**Why?** Everything depends on knowing who the user is and which school they belong to. Without auth, nothing else works. Without school setup, there's no curriculum, no classes, no students.

**What Google would build:**
1. Supabase Auth integration (login, JWT verification)
2. User profiles API (teachers, students, parents with role-based access)
3. School setup wizard (name, classes, subjects)
4. Simple user CRUD (admin creates teachers and students)
5. CSV import for bulk users

**Time**: Week 1
**Team**: 1 backend, 1 frontend
**"Done" when**: Admin can set up school and create 10 teachers and 700 students in <30 minutes

### Second: Attendance + Assignments (Unified)

**Why?** Attendance and assignments are the two highest-frequency teacher tasks. A teacher does them daily. Getting these right creates immediate habit formation and daily active usage.

**What Google would build:**
1. Batch attendance marking (mobile-first, <30s for 30 students)
2. Unified assignment creator (homework, worksheets with AI generation)
3. Student submission flow (mobile-friendly)
4. Auto-grading for MCQ/TF
5. Teacher grading interface (with AI suggestions)
6. In-app notifications

**Time**: Week 2-3
**Team**: 2 backend, 2 frontend
**"Done" when**: A teacher can mark attendance, create an AI-generated homework, have students submit, and grade it - all on their phone - in under 10 minutes total

### Third: Curriculum Engine + Assessments

**Why?** Curriculum-connected learning is Athon's differentiator. Once teachers are using attendance and homework daily, connecting everything to a curriculum graph makes the platform sticky and prevents commoditization.

**What Google would build:**
1. Curriculum browser (class to subject to chapter to topic to LO)
2. AI test generator (connected to curriculum)
3. Assessment attempt flow (with timer)
4. Auto-grading + results
5. Curriculum completion tracking
6. Learning objective progress tracking

**Time**: Week 4-5
**Team**: 2 backend, 2 frontend
**"Done" when**: Teacher can create a curriculum-connected test with AI, students attempt it, auto-grading completes, and learning objective progress updates automatically

### Fourth: Analytics + Risk Detection

**Why?** Principals are the buyers. Teachers are the users. You need analytics to sell to principals. But analytics only work once you have data from attendance, assignments, and assessments.

**What Google would build:**
1. Teacher dashboard (today's classes, pending items, weekly activity)
2. Student dashboard (homework due, upcoming tests, progress)
3. Principal dashboard (attendance, performance, curriculum completion)
4. Risk detection algorithm
5. Parent dashboard (child monitoring)

**Time**: Week 6-7
**Team**: 1 backend (analytics), 1 frontend (dashboards)
**"Done" when**: Principal can see school-wide metrics, identify at-risk students, and drill down to individual teacher/class performance

### Fifth: AI Depth + Polish

**Why?** The foundation must work reliably before adding AI complexity. By this point, you have user data, curriculum context, and working workflows. AI enhancements now have maximum impact because they're layered on real usage patterns.

**What Google would build:**
1. Lesson planner (AI generates, teacher customizes)
2. Report comment generator
3. Rubric generator
4. Student AI doubt assistant + learning companion
5. Parent weekly summary (AI-generated)
6. Cache tier implementation

**Time**: Week 8-10
**Team**: 2 AI + 1 backend, 1 frontend
**"Done" when**: AI generates 80%+ of homework, tests, lesson plans, and report comments. Teachers accept >75% without modification.

### Sixth: Scale + Production Readiness

**Why?** You don't optimize what doesn't exist. By week 10, you have real users, real data, and real bottlenecks. Now you optimize, harden, and deploy with confidence.

**What Google would build:**
1. Performance optimization (query tuning, caching strategy)
2. Load testing (100+ concurrent schools)
3. Security audit (penetration testing, dependency scan)
4. CI/CD pipeline (automated testing, deployment)
5. Monitoring (Sentry, uptime, response time)
6. Documentation (API docs, deployment guide, user manual)
7. Production infrastructure (VPS/cloud, backup, SSL)

**Time**: Week 11-12
**Team**: Full team
**"Done" when**: System handles 10,000 concurrent requests with <500ms p95 response time. 99.5% uptime. All documentation complete.

### Google's Rationale Summary

| Phase | Focus | Reason |
|-------|-------|--------|
| Week 1 | Auth + Identity | "You can't do anything without knowing who the user is." |
| Week 2-3 | Attendance + Assignments | "The daily habit. If teachers don't use Athon every day, it fails." |
| Week 4-5 | Curriculum + Assessments | "The differentiator. Curriculum-connected everything." |
| Week 6-7 | Analytics + Risk | "What the principal buys. Data-driven school management." |
| Week 8-10 | AI Depth | "Leverage. AI on top of real workflows, not empty scaffolding." |
| Week 11-12 | Scale + Polish | "Production readiness. Don't optimize prematurely." |

---

**Document Version**: 1.0
**Review Date**: June 10, 2026
**Next Review**: After Athon Zero Implementation (Week 4)
**Authors**: Google Staff Engineer, Google Staff Product Designer, Principal Architect, Principal Frontend Engineer, Principal Backend Engineer, EdTech Domain Expert
