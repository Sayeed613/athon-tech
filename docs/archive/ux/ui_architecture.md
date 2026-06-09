# 🏫 Athon — UI/UX Architecture Blueprint

> **Version**: 1.0
> **Status**: Planning — Ready for Figma Design
> **Platforms**: Web (Admin, Principal) · Mobile (Teacher, Parent, Student)
> **Backend**: Frozen — 52 API endpoints across 11 modules

---

## Table of Contents

1. [Product Information Architecture](#1-product-information-architecture)
2. [Screen Inventory](#2-screen-inventory)
3. [Navigation Architecture](#3-navigation-architecture)
4. [Dashboard Planning](#4-dashboard-planning)
5. [Component Architecture](#5-component-architecture)
6. [Design System Planning](#6-design-system-planning)
7. [Figma Project Structure](#7-figma-project-structure)
8. [UX Validation](#8-ux-validation)
9. [Design Principles & Rules](#9-design-principles--rules)

---

## 1. Product Information Architecture

### 1.1 Role Overview

| Role | Platform | Primary Device | Usage Pattern | Auth Level |
|------|----------|---------------|---------------|------------|
| **School Admin** | Web | Desktop/Laptop | Daily operations, bulk management | Full CRUD |
| **Principal** | Web | Desktop/Laptop | Weekly/Monthly review, monitoring | Read + Limited Write |
| **Teacher** | Mobile-first | Phone (primary), Tablet | Daily (morning prep, class time, post-class) | Read + Write (own scope) |
| **Parent** | Mobile | Phone | Check-in (evenings, weekends) | Read-only |
| **Student** | Mobile | Phone (at home, not in school) | Occasional (homework check, test results) | Read + Own Submit |

### 1.2 School Admin — Information Architecture

**Module Tree:**
```
Dashboard (/)                  ← First screen after login
├── Overview Widgets
│   ├── Total Students
│   ├── Total Teachers
│   ├── Active Classes
│   ├── Attendance %
│   └── Recent Announcements

School Management
├── Academic Years
│   └── Terms
├── Classes
│   ├── Create/Edit Class
│   └── Assign Class Teacher
├── Subjects
│   └── Assign to Classes
├── Periods (Time Slots)
└── Timetable Builder

User Management
├── Teachers
│   ├── List / Search
│   ├── Create / Edit
│   ├── Assign to Classes
│   └── Deactivate
├── Principals
│   ├── List / Search
│   └── Create / Edit
├── Students
│   ├── List / Search
│   ├── Import (Bulk CSV)
│   ├── Create / Edit
│   ├── Enroll / Promote
│   └── Parent Linking
└── Parents
    ├── List / Search
    └── Link to Students

Reports (Read-only)
├── Attendance Reports
├── Homework Reports
├── Test Reports
└── Exportable Summaries

Settings
├── School Profile (name, address, logo)
├── Academic Calendar
└── Notification Preferences
```

### 1.3 Principal — Information Architecture

**Module Tree:**
```
Dashboard (/)                  ← First screen after login
├── School Overview
│   ├── Total Students
│   ├── Total Teachers
│   ├── Attendance %
│   ├── Homework Completion %
│   └── Test Pass Rate

Monitoring & Analytics
├── Teacher Activity
│   ├── Homework creation frequency
│   ├── Test creation frequency
│   └── Grading completion
├── Class Performance
│   ├── Per-class attendance trends
│   ├── Per-class homework completion
│   └── Per-class test scores
├── Student Performance
│   ├── Low performers (below threshold)
│   ├── High performers
│   └── Individual student reports
└── Attendance Analytics
    ├── Daily/Monthly trends
    └── Absentee patterns

Reports
├── Attendance Report
├── Homework Report
├── Test Report
├── Teacher Summary
├── Class Summary
└── Student Summary

Announcements
├── Create (School-wide, Teacher-only, Class-specific)
├── Schedule
└── View Sent

Timetable Monitoring
├── All Timetables (read-only)
├── Teacher Schedule View
└── Class Schedule View

Notifications
├── Unread Count (Badge)
├── Notification List
└── Read / Mark All Read
```

### 1.4 Teacher — Information Architecture

**Module Tree (Mobile):**
```
Dashboard                   ← First screen after login
├── Today's Schedule
├── Classes Assigned
├── Attendance Pending
├── Homework to Grade
└── Unread Notifications

Attendance
├── Select Class → Select Date
│   ├── Mark All Present (quick action)
│   ├── Student Roster (tap to toggle status)
│   │   ├── Present
│   │   ├── Absent
│   │   ├── Late
│   │   └── Half Day
│   └── Batch Submit
└── Class Attendance History
    ├── By date
    └── Student-specific

Homework
├── Create Homework
│   ├── Select Class & Subject
│   ├── Title, Description, Due Date
│   ├── Add Questions (dynamic builder)
│   │   ├── Question type selector
│   │   ├── Question text input
│   │   └── Max score input
│   ├── Draft / Publish
│   └── Schedule publish
├── My Homeworks
│   ├── Published (viewable by students)
│   ├── Drafts (hidden)
│   └── Past Due
├── Submissions to Grade
│   ├── Per-homework list
│   ├── Per-student view
│   ├── Score input
│   └── Remarks
└── Class Homework Overview
    ├── Completion rates
    └── Missing submissions

Tests
├── Create Test
│   ├── Select Class & Subject
│   ├── Title, Duration, Total Marks
│   ├── Passing Percentage
│   ├── Questions (same builder as homework)
│   └── Publish / Schedule
├── My Tests
│   ├── Upcoming
│   ├── Published
│   └── Drafts
└── Results
    ├── Per-test results
    ├── Score distribution
    └── Grading

Notifications & Announcements
├── Send Notification (to class(es))
├── View Notifications
└── School Announcements
```

### 1.5 Parent — Information Architecture

**Module Tree (Mobile):**
```
Dashboard (/)               ← First screen after login
├── Child Cards (one per child)
│   ├── Child Name, Class
│   ├── Attendance % (colored indicator)
│   ├── Homework Completion %
│   └── Recent Test Score
└── Quick Glance
    ├── Unread Notifications
    └── Recent Announcements

Children
├── Child Selector (if multiple)
│   ├── Child 1
│   ├── Child 2
│   └── ...
└── Per-Child Dashboard
    ├── Full attendance record
    ├── Homework list with status
    ├── Test results with scores
    └── Announcements relevant to them

Attendance
├── Per-child attendance summary
│   ├── Present %
│   ├── Absent %
│   └── Monthly trend
└── Child selector (switch between children)

Homework
├── Per-child homework overview
│   ├── Total assigned
│   ├── Submitted
│   ├── Completion rate
│   └── Average score
└── Child selector (switch between children)

Notifications
├── Inbox (school notifications)
├── Read / Unread
└── Tap to view details
```

### 1.6 Student — Information Architecture

**Module Tree (Mobile):**
```
Home                        ← First screen after login
├── Today's Brief
│   ├── Homework Due
│   ├── Upcoming Tests
│   └── Attendance %
└── Quick Stats
    ├── Recent scores
    └── Unread notifications

Homework
├── Due Soon (sorted by date)
├── All Homework (published, for my class)
├── Submit Homework
│   ├── View questions
│   └── Confirm submit
└── Past Submissions

Tests
├── Upcoming Tests
├── Available Tests (published, scheduled)
├── Start Test
│   ├── Timer
│   ├── Questions (one at a time or scroll)
│   └── Submit
├── Results (when published)
└── Past Attempts

Profile
├── My Attendance %
├── My Performance
│   ├── Homework average score
│   ├── Test average score
│   └── Pass rate
└── Notifications
```

---

## 2. Screen Inventory

### 2.1 School Admin — Screens

| Screen | Purpose | Primary Actions | Secondary Actions |
|--------|---------|-----------------|-------------------|
| **Dashboard** | School overview KPIs | View metrics | Navigate to reports |
| **Teachers List** | View & manage teachers | Search, Filter, Tap to edit | Create, Deactivate |
| **Teacher Create/Edit** | Add/update teacher | Save form | Cancel, Delete |
| **Teacher Assignments** | Assign teacher to classes/subjects | Save assignments | View current assignments |
| **Students List** | View & manage students | Search, Filter, Tap | Bulk import, Create, Enroll |
| **Student Create/Edit** | Add/update student | Save form | Link parent, Cancel |
| **Student Import** | Bulk CSV upload | Upload, Map columns, Preview | Download template |
| **Parents List** | View parents | Search, Filter | Link to student |
| **Classes List** | View classes | Create class | Assign class teacher |
| **Class Create/Edit** | Add/update class | Save | Set class teacher |
| **Subjects List** | View subjects | Create subject | Assign to classes |
| **Academic Years** | Manage years/terms | Create year, Create term | Set current |
| **Periods** | Manage time slots | Create period | Set order |
| **Timetable Builder** | Visual timetable | Drag & drop entries | Save, Validate conflicts |
| **Reports View** | View all reports | Filter, Export | Navigate to detail |
| **Announcements List** | All announcements | Create, Filter | Delete expired |
| **Announcement Create** | New announcement | Set audience, Publish | Schedule |
| **Notifications** | System notifications | View, Send | Mark read |
| **School Settings** | Configure school | Change name, logo | Academic calendar |

### 2.2 Principal — Screens

| Screen | Purpose | Primary Actions | Secondary Actions |
|--------|---------|-----------------|-------------------|
| **Dashboard** | School performance KPIs | View all metrics | Drill into trends |
| **Attendance Report** | School/class attendance % | Filter by class, date range | View monthly trends |
| **Homework Report** | Completion metrics | Filter by class, teacher | Per-homework breakdown |
| **Test Report** | Score analytics | Filter by class, teacher | Per-test breakdown |
| **Student Summary** | Individual student report | Search student | View full report |
| **Class Summary** | Class-level metrics | Select class | View all metrics |
| **Teacher Summary** | Teacher performance | Select teacher | View their classes |
| **Timetable View** | School-wide schedule | View by class or teacher | Filter by day |
| **Announcements List** | View/create announcements | Create, Filter | Delete |
| **Announcement Create** | New announcement | Set audience, Publish | Schedule, Target class |
| **Notifications** | View notifications | Mark read | Filter |

### 2.3 Teacher — Screens (Mobile)

| Screen | Purpose | Primary Actions | Secondary Actions |
|--------|---------|-----------------|-------------------|
| **Dashboard** | Today's overview | View schedule, pending counts | Navigate to tasks |
| **Today's Schedule** | Period-by-period today | View entries | Expand for details |
| **Attendance Session** | Mark attendance for a class | Tap status per student, Submit | Mark all present |
| **Attendance History** | Past attendance records | Select date, Select class | View student history |
| **Homework Create** | New homework | Add questions, Set due date | Draft, Publish |
| **Homework List** | All my homeworks | Filter by status | Navigate to submissions |
| **Homework Detail** | View homework & questions | Edit (if draft), Delete | Navigate to submissions |
| **Submissions List** | Student submissions | Tap to grade | Filter by status |
| **Submission Grade** | Score & feedback | Enter score, Write remarks | Save, Submit grade |
| **Test Create** | New test | Add questions, Set duration | Draft, Publish, Schedule |
| **Test List** | All my tests | Filter by status | View results |
| **Test Detail** | View test & questions | Edit (if draft), Delete | View attempts |
| **Test Results** | Score distribution | View per-student | Navigate to individual |
| **Notifications** | Inbox | Mark read | Filter |
| **Announcements** | School announcements | Read | — |
| **Send Notification** | Notify class | Select class, Write message | Send |
| **Timetable View** | My weekly schedule | View | Filter by day |

### 2.4 Parent — Screens (Mobile)

| Screen | Purpose | Primary Actions | Secondary Actions |
|--------|---------|-----------------|-------------------|
| **Dashboard** | All children overview | Tap child for details | View notifications |
| **Children List** | Switch between children | Tap child | — |
| **Child Dashboard** | Single child progress | View all metrics | Switch child |
| **Attendance View** | Child attendance | View % and trend | Switch child |
| **Homework View** | Child homework | View status, scores | Switch child |
| **Test Results View** | Child test scores | View scores, pass rate | Switch child |
| **Notifications** | School notifications | Mark read | Filter |
| **Announcements** | School announcements | Read | — |

### 2.5 Student — Screens (Mobile)

| Screen | Purpose | Primary Actions | Secondary Actions |
|--------|---------|-----------------|-------------------|
| **Home** | Quick overview | View stats | Navigate |
| **Homework List** | My homework | View details, Submit | Filter by status |
| **Homework Detail** | View questions | Submit, View previous | — |
| **Test List** | My tests | Start test (if available) | View results |
| **Test Attempt** | Take a test | Answer questions, Submit | View timer |
| **Test Results** | My scores | View score, feedback | — |
| **My Profile** | My stats | View attendance % | Notification settings |

---

## 3. Navigation Architecture

### 3.1 Teacher Mobile — Bottom Navigation

```
┌────────────────────────────────────────────────┐
│  [Tab Bar: 5 tabs max]                        │
│                                                │
│  📊 Dashboard  │ 📝 Homework │ 📋 Tests │      │
│  👥 Attendance │ 📬 More                      │
│                                                │
│  Tab 1: Dashboard  (default, badge: unread)   │
│  Tab 2: Attendance  (quick mark access)       │
│  Tab 3: Homework   (create + grade)           │
│  Tab 4: Tests      (create + results)         │
│  Tab 5: More       (Timetable, Notifications, │
│                     Announcements, Settings)   │
└────────────────────────────────────────────────┘
```

**Tab 1 — Dashboard**: Today's schedule cards, pending counts (red badges), quick action buttons
**Tab 2 — Attendance**: Class selector dropdown → Attendance roster → Submit
**Tab 3 — Homework**: Segmented control (Create | Grading | All)
**Tab 4 — Tests**: Segmented control (Create | Results | All)
**Tab 5 — More**: Menu list (Timetable, Notifications, Announcements, Send Notification)

### 3.2 Parent Mobile — Bottom Navigation

```
┌────────────────────────────────────────────────┐
│  [Tab Bar: 5 tabs max]                        │
│                                                │
│  🏠 Dashboard │ 👶 Children │ 📚 Homework │    │
│  📊 Tests │ 🔔 Notifications                  │
│                                                │
│  Tab 1: Dashboard  (default, multi-child      │
│                     overview cards)            │
│  Tab 2: Children   (switch between children)  │
│  Tab 3: Homework   (per-child homework list)  │
│  Tab 4: Tests      (per-child test results)   │
│  Tab 5: Notifications (badge: unread count)   │
└────────────────────────────────────────────────┘
```

**Child selector pattern**: When on Homework or Tests tabs, show a child name chip bar at top for switching.

### 3.3 Student Mobile — Bottom Navigation

```
┌────────────────────────────────────────────────┐
│  [Tab Bar: 4 tabs max]                        │
│                                                │
│  🏠 Home │ 📚 Homework │ 📝 Tests │ 👤 Me   │
│                                                │
│  Tab 1: Home       (default — brief overview) │
│  Tab 2: Homework   (due soon, all homework)   │
│  Tab 3: Tests      (upcoming, results)        │
│  Tab 4: Me         (profile, attendance %,    │
│                     notifications)             │
└────────────────────────────────────────────────┘
```

### 3.4 Principal Web — Sidebar Navigation

```
┌─────────────────────────────────┐
│  [SIDEBAR — 280px]              │
│                                 │
│  🏫 School Name                 │
│  ─────────────────────────      │
│                                 │
│  📊 Dashboard                    │
│                                 │
│  📈 Reports                     │
│    ├── Attendance Report        │
│    ├── Homework Report          │
│    ├── Test Report              │
│    └── ─────────────────        │
│    ├── Student Summary          │
│    ├── Class Summary            │
│    └── Teacher Summary          │
│                                 │
│  🏛️ Timetable Monitor           │
│    ├── All Timetables           │
│    ├── By Teacher               │
│    └── By Class                 │
│                                 │
│  📣 Announcements                │
│    ├── All Announcements        │
│    └── Create Announcement      │
│                                 │
│  🔔 Notifications               │
│    └── [unread count badge]     │
│                                 │
│  ⚙️ Settings                    │
│    └── Account                  │
│                                 │
│  ─────────────────────────      │
│  👤 Principal Name              │
│     Role badge / Logout         │
└─────────────────────────────────┘
```

### 3.5 School Admin Web — Sidebar Navigation

```
┌─────────────────────────────────┐
│  [SIDEBAR — 280px]              │
│                                 │
│  🏫 School Name                 │
│  ─────────────────────────      │
│                                 │
│  📊 Dashboard                    │
│                                 │
│  🏫 School                      │
│    ├── Academic Years           │
│    ├── Classes                  │
│    ├── Subjects                 │
│    ├── Periods                  │
│    └── Timetable Builder        │
│                                 │
│  👥 Users                       │
│    ├── Teachers                 │
│    │   └── Assignments          │
│    ├── Principals               │
│    ├── Students                 │
│    │   └── Import               │
│    └── Parents                  │
│                                 │
│  📈 Reports (Read-only)         │
│    ├── Attendance               │
│    ├── Homework                 │
│    └── Tests                    │
│                                 │
│  📣 Announcements                │
│                                 │
│  🔔 Notifications               │
│                                 │
│  🎯 School Settings             │
│    ├── Profile                  │
│    ├── Academic Calendar        │
│    └── Preferences              │
│                                 │
│  ─────────────────────────      │
│  👤 Admin Name                  │
│     Role badge / Logout         │
└─────────────────────────────────┘
```

---

## 4. Dashboard Planning

### 4.1 School Admin Dashboard

| Widget | Purpose | Priority | Data Source |
|--------|---------|----------|-------------|
| **Total Students** | Quick count of enrolled, active students | P0 | `GET /dashboard/admin` |
| **Total Teachers** | Active teacher count | P0 | `GET /dashboard/admin` |
| **Active Classes** | Number of active classes | P0 | `GET /dashboard/admin` |
| **Attendance Today %** | School-wide attendance % | P0 | `GET /dashboard/admin` |
| **Recent Announcements** | Latest 5 announcements | P1 | `GET /dashboard/admin` |
| **Unread Notifications** | Badge count | P1 | `GET /notifications/unread/count` |
| **Quick Action Buttons** | Create Teacher, Import Students, Create Class | P1 | Navigation shortcuts |

**Layout (Web):** 3-column grid. Top row: 3 stat cards (Students, Teachers, Classes). Second row: Attendance % (large gauge) + Recent Announcements list.

### 4.2 Principal Dashboard

| Widget | Purpose | Priority | Data Source |
|--------|---------|----------|-------------|
| **Total Students** | School-wide count | P0 | `GET /dashboard/principal` |
| **Total Teachers** | Active teachers | P0 | `GET /dashboard/principal` |
| **Attendance %** | School-wide present % | P0 | `GET /dashboard/principal` |
| **Homework Completion %** | Overall completion rate | P0 | `GET /dashboard/principal` |
| **Test Pass Rate** | Overall pass rate | P0 | `GET /dashboard/principal` |
| **Attendance Trend Chart** | Monthly attendance trend (line chart) | P1 | `GET /reports/attendance` |
| **Low Performing Classes** | Classes below threshold | P2 | `GET /reports/class/{id}` (iterated) |
| **Recent Announcements** | Latest 5 | P1 | `GET /dashboard/principal` |
| **Unread Notifications** | Badge | P1 | `GET /notifications/unread/count` |

**Layout (Web):** 2-column grid. Left: KPIs in cards row. Right: Trend chart. Below: Announcements + Notifications.

### 4.3 Teacher Dashboard

| Widget | Purpose | Priority | Data Source |
|--------|---------|----------|-------------|
| **Today's Schedule** | Period-by-period today | P0 | `GET /dashboard/teacher` |
| **Classes Assigned** | List of class names | P0 | `GET /dashboard/teacher` |
| **Attendance Pending** | Students without today's attendance | P0 | `GET /dashboard/teacher` (count) |
| **Homework to Grade** | Submissions awaiting grading | P0 | `GET /dashboard/teacher` (count) |
| **Upcoming Tests** | Tests created but not yet taken | P1 | `GET /dashboard/teacher` (count) |
| **Quick Actions** | Mark Attendance, Create Homework, Create Test | P0 | Navigation shortcuts |
| **Unread Notifications** | Badge | P1 | `GET /dashboard/teacher` |

**Layout (Mobile):** Scrollable feed. Top: Schedule timeline (compact). Below: KPI chips (Classes, Pending Attendance, To Grade). Below: Quick action buttons (3 large cards).

### 4.4 Parent Dashboard

| Widget | Purpose | Priority | Data Source |
|--------|---------|----------|-------------|
| **Child Cards** | One card per child with key metrics | P0 | `GET /parent/dashboard` |
| **Attendance % (per child)** | Color-coded (green/orange/red) | P0 | `GET /parent/dashboard` |
| **Homework Completion (per child)** | Progress bar | P0 | `GET /parent/dashboard` |
| **Test Average (per child)** | Recent scores | P0 | `GET /parent/dashboard` |
| **Recent Announcements** | Latest 5 | P1 | `GET /parent/dashboard` |
| **Unread Notifications** | Badge | P1 | `GET /parent/dashboard` |

**Layout (Mobile):** Scrollable. Top: Child cards (swipeable if multiple). Each card: Name, class, 3 metrics (attendance ring, homework bar, test score). Below: Announcements feed.

### 4.5 Student Dashboard

| Widget | Purpose | Priority | Data Source |
|--------|---------|----------|-------------|
| **Homework Due** | Count + nearest deadline | P0 | `GET /dashboard/student` |
| **Upcoming Tests** | Count + nearest test date | P0 | `GET /dashboard/student` |
| **Attendance %** | Overall attendance % | P0 | `GET /dashboard/student` |
| **Today's Timetable** | If viewing at home (prep for next day) | P2 | `GET /dashboard/student` |
| **Unread Notifications** | Badge | P1 | `GET /dashboard/student` |

**Layout (Mobile):** Simple vertical stack. Top: Greeting + name. Cards: Homework Due (with count), Upcoming Tests (with count), Attendance % (ring chart). Minimal, no clutter.

---

## 5. Component Architecture

### 5.1 Shared Component Inventory

| Component | Variants | States | Used By |
|-----------|----------|--------|---------|
| **Button** | Primary, Secondary, Ghost, Danger, Icon-only | Default, Hover, Pressed, Disabled, Loading | All |
| **Card** | Stat, Metric, List, Dashboard Widget, Child | Default, Selected, Pressed | All |
| **Input** | Text, Email, Password, Number, Search, Date | Default, Focus, Error, Disabled, Read-only | All |
| **Dropdown** | Single Select, Multi Select | Default, Open, Selected, Disabled | Web only |
| **Table** | Simple, Sortable, Selectable, Paginated | Default, Hover row, Selected row | Web (Admin, Principal) |
| **Search Bar** | With filters, Without filters | Default, Focus, Has results, Empty results | All |
| **Filter Chip** | Single, Group | Default, Selected | All |
| **Badge** | Count, Status, Dot | Default, Pulse (unread) | All |
| **Avatar** | User, Initials, School logo | Default, Small, Large | All |
| **Loading Skeleton** | Card, Table, List, Chart | — | All |
| **Empty State** | With illustration, With action | — | All |
| **Error State** | With retry, With message | — | All |
| **Modal** | Confirmation, Form, Full-screen | Open, Closing | All |
| **Bottom Sheet** | Actions, Options, Filters | Open, Dragging, Closed | Mobile only |
| **Toast** | Success, Error, Warning, Info | Show, Auto-dismiss | All |
| **Chip** | Status, Tag, Filter | Default, Selected | All |
| **Progress Bar** | Determinate, Indeterminate | Empty, Partial, Complete | All |
| **Ring Chart** | Circular progress | N%, Color-coded | Mobile |

### 5.2 Mobile-Specific Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Bottom Tab Bar** | 4-5 tab navigation | With badge support |
| **Child Selector Chip Bar** | Horizontal scrollable chips (Parent) | Active chip highlighted |
| **Attendance Roster** | Student list with status toggles | Teacher: tap to cycle Present→Absent→Late→Half Day |
| **Question Builder** | Dynamic form for adding questions | Teacher: add/remove/reorder questions |
| **Timer Bar** | Countdown for test attempts | Student: shows remaining time, auto-submit warning |
| **Swipeable Card** | Swipe between children (Parent) | Left/right gesture |
| **Pull to Refresh** | Refresh data | All list screens |

### 5.3 Web-Specific Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| **Sidebar** | Navigation | Collapsible, with active state |
| **Data Table** | Sortable, filterable, paginated | Bulk select, export |
| **Timetable Grid** | Visual week view | Drag & drop (admin), read-only grid (principal) |
| **Bulk Import Modal** | CSV upload with mapping | Preview, error rows, confirm |
| **Date Range Picker** | Report filtering | Presets (Today, This Week, This Month, Custom) |
| **Chart** | Line, Bar, Pie | Attendance trends, score distribution |

### 5.4 State Handling Patterns

| State | Pattern | Visual |
|-------|---------|--------|
| **Loading** | Skeleton screens (not spinners) | Grey animated placeholders matching content shape |
| **Empty** | Illustration + message + action | Friendly illustration, "No homework due!", optional CTA |
| **Error** | Error card with retry | Red tint, error message, "Try Again" button |
| **Offline** | Banner at top | Yellow warning bar: "You're offline. Showing cached data." |
| **Success** | Toast notification | Green toast, auto-dismiss after 3s |

---

## 6. Design System Planning

### 6.1 Color Palette

```
Primary (School Identity):
  - Primary Blue:   #2563EB (actions, links, active states)
  - Primary Dark:   #1D4ED8 (hover, pressed)
  - Primary Light:  #DBEAFE (background tints)

Secondary (Accent):
  - Teal:           #0D9488 (success, completion)
  - Amber:          #F59E0B (warning, pending)
  - Red:            #EF4444 (errors, urgent, absent)
  - Green:          #22C55E (present, passed)

Neutral:
  - Background:     #F8FAFC (page bg)
  - Surface:        #FFFFFF (card bg)
  - Border:         #E2E8F0 (dividers)
  - Text Primary:   #0F172A (headings)
  - Text Secondary: #475569 (body)
  - Text Muted:     #94A3B8 (labels)
  - Disabled:       #CBD5E1

Status Colors (used consistently across all roles):
  - Present:        #22C55E
  - Absent:         #EF4444
  - Late:           #F59E0B
  - Half Day:       #8B5CF6
  - Graded:         #22C55E
  - Submitted:      #3B82F6
  - Pending:        #F59E0B
  - In Progress:    #3B82F6
```

### 6.2 Typography

```
Font Family: Inter (sans-serif) — Web & Mobile
Fallback: System fonts (SF Pro, Roboto)

Scale (Web):
  - H1: 32px / 40px line-height / 700 weight  → Page titles
  - H2: 24px / 32px line-height / 600 weight  → Section headers
  - H3: 20px / 28px line-height / 600 weight  → Card titles
  - H4: 16px / 24px line-height / 600 weight  → Subsection titles
  - Body: 14px / 20px line-height / 400       → Primary reading
  - Body Small: 12px / 16px line-height / 400 → Metadata, captions
  - Label: 14px / 20px line-height / 500      → Form labels
  - Button: 14px / 20px line-height / 600     → Button text
  - Badge: 11px / 14px line-height / 600      → Badges, small stats

Scale (Mobile):
  - Title: 18px / 24px / 600
  - Body: 15px / 22px / 400
  - Caption: 12px / 16px / 400
  - Stat Number: 24px / 28px / 700
```

### 6.3 Grid & Spacing

```
Web Grid:
  - 12-column grid
  - Gutter: 24px
  - Margin: 32px (desktop), 16px (tablet)
  - Breakpoints: 1280px (desktop), 1024px (tablet)

Spacing Scale (4px base):
  2 → 8px    (2 × 4)
  3 → 12px   (inside cards)
  4 → 16px   (card padding, component gap)
  6 → 24px   (section gap)
  8 → 32px   (page margin)
  10 → 40px  (major sections)
  12 → 48px  (page sections)

Mobile Padding:
  - Horizontal: 16px
  - Card gap: 12px
  - Section gap: 24px
```

### 6.4 Icon System

```
Library: Lucide Icons (open-source, consistent)
Style: Outline, 1.5px stroke, 24px default
Sizes: 16px (inline), 20px (tab bar), 24px (default), 32px (hero)

Icon Inventory by Module:
  Dashboard:    layout-dashboard, bar-chart-3
  Attendance:   clipboard-check, user-check, user-x
  Homework:     book-open, file-text, pen-tool
  Tests:        scroll-text, timer, check-square
  Notifications: bell, bell-off, bell-ring
  Announcements: megaphone, speaker
  Timetable:    calendar, clock
  School:       building-2, school
  Users:        users, user-circle, user-plus
  Settings:     settings, sliders
  Reports:      file-bar-chart, pie-chart
  Children:     baby, users (parent role)
```

### 6.5 Design Rules

**Mobile Rules:**
1. One primary action per screen (floating button or prominent CTA)
2. No hover states (touch feedback instead: tap highlight, 200ms response)
3. Bottom navigation must be reachable with thumb (no stretching)
4. Forms: single column, full-width inputs, floating labels
5. Lists: infinite scroll or page numbers with "Load More"
6. Pull-to-refresh on all data screens
7. Minimize modals — use bottom sheets for actions
8. Text in statistics: minimal (numbers visible, labels secondary)
9. Touch targets: minimum 44×44px

**Web Rules:**
1. Sidebar always visible (collapsible to icons for smaller screens)
2. Data tables: sortable columns, filterable, exportable (CSV)
3. Forms: Never more than 2 columns for inputs
4. Dashboard: max 3 columns, responsive → 2 → 1
5. Hover states on interactive elements (button lift, row highlight)
6. Keyboard shortcuts for power users (Ctrl+Enter to submit, Tab navigation)
7. Breadcrumb navigation for deep pages
8. Confirmation modals for destructive actions
9. Bulk operations: select all, select range, clear selection

---

## 7. Figma Project Structure

```
ATHON DESIGN SYSTEM
│
├── 00 🏫 Cover
│   ├── Cover Page (Logo, Tagline, Version)
│   └── Project Info
│
├── 01 🎨 Foundations
│   ├── Colors (Primary, Secondary, Neutral, Status)
│   ├── Typography (Web scale, Mobile scale, Line heights)
│   ├── Spacing (4px scale, grid examples)
│   ├── Grid (12-column web, mobile responsive)
│   ├── Shadows (Card, Dropdown, Modal, Elevation)
│   └── Icons (Library reference, icon list)
│
├── 02 🧩 Components
│   ├── Buttons (Primary, Secondary, Ghost, Danger, Icon, sizes)
│   ├── Inputs (Text, Search, Select, Date, Textarea, with states)
│   ├── Cards (Stat, Metric, List, Dashboard Widget, Child Card)
│   ├── Tables (Simple, Sortable, Selectable, Paginated)
│   ├── Navigation (Sidebar, Bottom Tab Bar, Tabs, Breadcrumbs, Chip Bar)
│   ├── Feedback (Toast, Modal, Bottom Sheet, Alert Banner)
│   ├── Data Display (Badge, Avatar, Chip, Progress Bar, Ring Chart)
│   ├── Charts (Line, Bar, Pie — with empty/loading states)
│   ├── States (Loading Skeleton, Empty State, Error State, Offline)
│   └── Forms (Single column, Two column, With validation)
│
├── 03 📱 Mobile — Teacher
│   ├── 01 Dashboard
│   ├── 02 Attendance (Session, History)
│   ├── 03 Homework (List, Create, Detail, Submissions, Grade)
│   ├── 04 Tests (List, Create, Detail, Results)
│   ├── 05 More (Timetable, Notifications, Announcements)
│   └── 06 Shared (Bottom Tab Bar, Child Selector, Roster)
│
├── 04 📱 Mobile — Parent
│   ├── 01 Dashboard
│   ├── 02 Children (List, Selector)
│   ├── 03 Attendance
│   ├── 04 Homework
│   ├── 05 Tests
│   ├── 06 Notifications
│   └── 07 Shared (Bottom Tab Bar, Child Chip Bar, Swipeable Cards)
│
├── 05 📱 Mobile — Student
│   ├── 01 Home
│   ├── 02 Homework (List, Detail, Submit)
│   ├── 03 Tests (List, Attempt, Results)
│   ├── 04 Me (Profile, Attendance %, Notifications)
│   └── 05 Shared (Bottom Tab Bar, Timer Bar, Question Viewer)
│
├── 06 💻 Web — Principal
│   ├── 01 Dashboard
│   ├── 02 Reports (Attendance, Homework, Tests)
│   ├── 03 Student Summary
│   ├── 04 Class Summary
│   ├── 05 Teacher Summary
│   ├── 06 Timetable Monitor
│   ├── 07 Announcements (List, Create)
│   ├── 08 Notifications
│   └── 09 Shared (Sidebar, Data Table, Charts, Filters)
│
├── 07 💻 Web — School Admin
│   ├── 01 Dashboard
│   ├── 02 Teachers (List, Create/Edit, Assignments)
│   ├── 03 Students (List, Create/Edit, Import, Enroll)
│   ├── 04 Parents (List, Link)
│   ├── 05 Classes (List, Create/Edit, Assign Teacher)
│   ├── 06 Subjects (List, Create)
│   ├── 07 Academic (Years, Terms, Periods)
│   ├── 08 Timetable Builder
│   ├── 09 Reports (Read-only)
│   ├── 10 Announcements
│   ├── 11 Notifications
│   ├── 12 School Settings
│   └── 13 Shared (Sidebar, Data Table, Import Modal, Bulk Actions)
│
├── 08 🧪 Prototypes
│   ├── Teacher Onboarding Flow
│   ├── Teacher Marking Attendance Flow
│   ├── Teacher Creating Homework Flow
│   ├── Teacher Grading Flow
│   ├── Parent Viewing Child Progress Flow
│   ├── Student Taking Test Flow
│   ├── Principal Viewing Reports Flow
│   └── Admin Timetable Builder Flow
│
├── 09 📐 Design Specs
│   ├── Component Specs (padding, margins, colors, typography)
│   ├── Redlines (key screens with measurements)
│   ├── Accessibility (contrast, touch targets, screen reader)
│   └── Handoff Notes (developer notes, API mappings)
│
└── 10 📋 UX Research
    ├── User Flows (complete task flows per role)
    ├── User Stories (mapped to screens)
    └── Edge Cases (error states, empty states, permissions)
```

---

## 8. UX Validation

### 8.1 Unnecessary Screens (Remove)

| Screen | Reason | Action |
|--------|--------|--------|
| **Student Timetable full view** | Students don't bring phones to school. `GET /timetable/today` is only useful for morning prep at home. | Keep minimal — show only next day's schedule on Home tab. Remove dedicated timetable screen. |
| **Parent Timetable** | Parents don't need to see schedules. They need results, not process. | Remove entirely. Parent doesn't need `/timetable/*` endpoints. |
| **Principal Student CRUD** | Principals do not manage student records. That's Admin's job. | Remove from Principal sidebar. |
| **Teacher Student List** | Teachers don't manage student profiles. They see students within attendance/homework context only. | Remove standalone student list. Students appear only within attendance roster or submission lists. |
| **Principal User Management** | Same as above. Principals view performance, not manage users. | Remove from Principal sidebar. |

### 8.2 Over-Engineered Flows (Simplify)

| Current | Problem | Simplified |
|---------|---------|------------|
| Homework creation with separate question bank, tags, templates | Teachers need speed. Too many options = abandoned homework creation. | Single form: Title, Class, Subject, Due Date, Questions (simple inline list). Remove question bank. |
| Test creation with multiple sections, random ordering, proctoring | Overkill for classes 1-10. Tests are simple. | Single form: Title, Class, Subject, Duration, Marks, Questions. No sections, no randomization (yet). |
| Student import with field mapping, duplicate detection, preview | Needed but shouldn't block quick adds. | Default: single-student create form (fast). Bulk import: drag-drop CSV → auto-map columns → confirm. |
| Attendance with excuse notes, approval workflow, substitute marking | Too complex for daily use. Teachers just need to mark present/absent/late. | Simple roster: tap to cycle status. Batch submit. No excuse workflow in MVP. |
| Parent multiple child switching with complex filters | Parents have 1-3 children max. No need for complex filtering. | Swipeable child cards or simple chip selector. No search/filter. |

### 8.3 Missing Workflows (Add)

| Workflow | Why Missing | Add To |
|----------|-------------|--------|
| **Test submission confirmation** | Student needs clear confirmation that test was submitted successfully | Student Test Attempt — after submit, show confirmation screen with "View Results (when available)" |
| **Offline indicator for attendance** | Teachers may lose connection mid-marking | Teacher Attendance — cache pending marks locally, sync when online |
| **Homework due date warning** | Teacher should see conflict if creating homework on same day as existing test | Teacher Homework Create — show warning: "There's a test scheduled on this date" |
| **Announcement audience preview** | Admin/Principal needs to know who will receive an announcement before sending | Announcement Create — show "This will be sent to: 240 students, 15 teachers" |
| **Academic term in context** | Many screens show data without indicating which term | Global header/section label — show "Term 1, 2025-2026" on attendance, homework, tests |

### 8.4 Role Confusion (Fix)

| Issue | Current | Fix |
|-------|---------|-----|
| Principal can't report on individual teachers | Only Admin has access | Principal needs `GET /reports/teacher/{id}` to monitor teacher performance |
| Teacher can't see own attendance | No endpoint for teachers to see their own attendance | Not needed — teachers don't track their own attendance. Remove from consideration. |
| Admin can't set school-wide defaults | Only in DB seed data | Add School Settings screen to Admin sidebar |
| Student can see all class tests (including ungraded) | `GET /tests/student/me` returns published tests | Already correct — `is_published` filter is in place |

### 8.5 Permission Issues (Validate Against Backend)

| Screen | Required Role | Backend Check | Status |
|--------|---------------|--------------|--------|
| Edit Teacher | school_admin | `require_role("school_admin", "super_admin")` | ✅ Match |
| Create Announcement | principal, admin, teacher | `require_role("principal","school_admin","super_admin","teacher")` | ✅ Match |
| View Reports (school-wide) | principal, admin | `require_role` + service-level checks | ✅ Match (C1 fixed) |
| View Parent Dashboard | parent | `require_role("parent")` | ✅ Match |
| Submit Homework | student | `require_role("student")` | ✅ Match |
| Bulk Import Students | school_admin | No endpoint yet (not built) | ⚠️ Needs backend |
| Timetable Builder CRUD | school_admin | No CRUD endpoints (read-only API) | ⚠️ Needs backend |

---

## 9. Design Principles & Rules

### 9.1 Core Principles

1. **Mobile-first for operators (Teacher), Web-first for managers (Admin/Principal)**
   - Teacher does everything on phone during class transitions
   - Admin manages on desktop during school hours
   - Parent checks phone in evenings
   - Student uses phone at home for homework/test prep

2. **Every screen has ONE primary action**
   - One floating button or prominent CTA per screen
   - Everything else is secondary or tertiary
   - Reduces cognitive load for daily operators

3. **Data density scales with role**
   - Admin: High density (tables, bulk operations, pagination)
   - Principal: Medium density (charts, KPIs, summaries)
   - Teacher: Low density (cards, lists, big buttons)
   - Parent: Lowest density (swipeable cards, big numbers)
   - Student: Minimal density (simple lists, count badges)

4. **Read-only by default, write as exception**
   - Parent: 100% read-only
   - Principal: 80% read-only, 20% write (announcements)
   - Teacher: 50% read, 50% write (attendance, homework, tests)
   - Admin: 30% read, 70% write (management operations)

5. **Errors are impossible for non-admin roles**
   - Teacher input should be validated before submit
   - Prevent errors, don't just surface them
   - Use progressive disclosure (show relevant options only)

### 9.2 Accessibility Rules

- All text meets WCAG AA contrast (4.5:1 normal, 3:1 large)
- Touch targets minimum 44×44px (mobile)
- All icons have text labels
- Error messages explain what happened AND how to fix it
- Color is never the only indicator (use icons + text + color)

### 9.3 Performance Expectations

| Action | Target |
|--------|--------|
| App cold start | < 3 seconds |
| Screen navigation | < 200ms (instant) |
| Data load with skeleton | < 1.5 seconds |
| Data refresh (pull to refresh) | < 2 seconds |
| Form submission | < 1 second |
| Bulk import (500 students) | < 10 seconds |
| Report generation | < 3 seconds |

---

*End of UI Architecture Blueprint — Ready for Figma Design*
