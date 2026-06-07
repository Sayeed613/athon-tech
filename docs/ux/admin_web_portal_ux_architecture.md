# 🏫 Athon — School Admin Web Portal
## UX Architecture & Product Design Blueprint

> **Version**: 1.0  
> **Role**: School Admin (Web Portal)  
> **Backend**: 107 Routes — Fully Complete & Frozen  
> **Design Phase**: Pre-Figma — Architecture & UX Planning  
> **Audience**: Senior UI Designer → Production Figma  
> **Status**: ✅ Ready for Figma Design

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Information Architecture](#2-information-architecture)
3. [Sidebar Navigation](#3-sidebar-navigation)
4. [Screen Inventory](#4-screen-inventory)
5. [Dashboard Planning](#5-dashboard-planning)
6. [User Management UX](#6-user-management-ux)
7. [Academic Management UX](#7-academic-management-ux)
8. [Timetable Management UX](#8-timetable-management-ux)
9. [School Settings UX](#9-school-settings-ux)
10. [Tables Strategy](#10-tables-strategy)
11. [Forms Strategy](#11-forms-strategy)
12. [Empty States](#12-empty-states)
13. [Error Handling](#13-error-handling)
14. [Design System Planning](#14-design-system-planning)
15. [Responsive Strategy](#15-responsive-strategy)
16. [Figma Structure](#16-figma-structure)

---

## 1. Product Overview

### 1.1 Role Definition

The **School Admin** is the highest operational role in the school. This is not a back-office IT role — it is the person who runs the school's day-to-day operations. In small schools this is the principal or owner. In large schools this is the administrative officer or registrar.

**Who they are:**
- School secretary, registrar, or administrative officer
- Works 8 AM–4 PM, seated at a desktop computer
- Manages data entry for new teachers, students, and classes
- Handles bulk operations at term start (enrollments, timetable setup)
- Answers to: Principal (operationally), Owner/Board (strategically)

**What they do:**
- 70% of their time: Data management (entering new teachers, students, class changes)
- 15% of their time: Academic structure setup (years, terms, timetable)
- 10% of their time: Reports and verification
- 5% of their time: Settings and configuration

**What they do NOT do:**
- Mark attendance (teacher's job)
- Create homework or tests (teacher's job)
- Grade submissions (teacher's job)
- Monitor classroom performance (principal's job)

### 1.2 Scale Considerations

| Dimension | Small School (300) | Medium School (2,000) | Large School (10,000+) |
|-----------|:-----------------:|:--------------------:|:---------------------:|
| Teachers | 15–25 | 80–120 | 350–500 |
| Students | 300 | 2,000 | 10,000+ |
| Classes | 10–15 | 60–80 | 300–400 |
| Parents | 500 | 3,000 | 15,000+ |
| Timetable entries | 100 | 1,200 | 6,000+ |
| Admin staff | 1 person (part-time) | 1–2 people | 3–5 person team |

**Design Implications:**
- Tables must paginate, search, and filter — always. No "load all" pattern.
- Bulk import is a P0 feature for medium and large schools.
- Searches must work on partial text matches (admin types name, gets results instantly).
- Timetable builder must handle 6,000+ entries without crashing the browser.
- Page loads must be < 1.5 seconds even at 10,000+ student scale.

### 1.3 Design Principles for This Portal

1. **Data density is a feature.** Admin users want to see 50 rows at once, not 10. They scan tables quickly. Don't hide data behind expandable rows.

2. **Bulk operations are the default.** If an action can be done on one item, it should also be doable on many items. Multi-select, select all, bulk edit, bulk delete.

3. **Forms should be fast, not fancy.** Admin fills out the same teacher creation form 50 times at term start. Every extra click is multiplied by 50. No multi-step wizards unless the form genuinely requires it.

4. **Search before browse.** An admin managing 10,000 students does not scroll. They type the first 3 letters of the name. Search must be persistent and always visible.

5. **Validation happens on blur, not submit.** Tell the admin immediately if an email is invalid, not after they've filled all 15 fields and clicked Submit.

6. **Navigation is permanent.** The sidebar stays. No hamburger menus on desktop. Admin users orient themselves by the sidebar.

7. **Export is more important than print.** Admin works in spreadsheets. Every table should have CSV export. Don't optimize for printing.

8. **Audit trail is implicit.** Every create, update, and delete should be logged. Admin should see "Last updated by Jane Doe, 2 hours ago" without having to dig into audit logs.

---

## 2. Information Architecture

### 2.1 Complete Module Hierarchy

```
Dashboard (/admin)
├── Today's Overview
│   ├── Total Students (active)
│   ├── Total Teachers (active)
│   ├── Total Parents (linked)
│   ├── Active Classes
│   └── Class Capacity Utilization %
├── Alerts & Flags
│   ├── Classes Over Capacity
│   ├── Unassigned Teachers (no class/subject)
│   ├── Students Without Parent Links
│   └── Missing Timetable Entries
├── Recent Activity Feed
│   ├── Newest additions (teachers, students, classes)
│   └── Latest updates (edits, deactivations)
└── Quick Action Cards
    ├── Add New Teacher
    ├── Import Students
    ├── Create Class
    └── Open Timetable Builder

Users
├── Teachers
│   ├── Teacher List (table)
│   ├── Create Teacher (form)
│   ├── Edit Teacher (form)
│   ├── Teacher Profile (detail view)
│   └── Teacher Assignments (manage class-subject mapping)
├── Students
│   ├── Student List (table)
│   ├── Create Student (form)
│   ├── Edit Student (form)
│   ├── Student Profile (detail view)
│   ├── Import Students (bulk CSV)
│   └── Enroll / Promote (class change)
├── Parents
│   ├── Parent List (table)
│   └── Link Parent to Student (modal)
└── Principals
    ├── Principal List (table)
    ├── Create Principal (form)
    └── Edit Principal (form)

Academic
├── Classes
│   ├── Class List (table)
│   ├── Create Class (form)
│   ├── Edit Class (form)
│   └── Class Detail (students, teachers, timetable)
├── Subjects
│   ├── Subject List (table)
│   └── Create Subject (form)
├── Academic Years
│   ├── Year List (table)
│   ├── Create Year (form)
│   └── Set Current Year
├── Academic Terms
│   ├── Term List (table)
│   └── Create Term (form)
└── Periods (Time Slots)
    ├── Period List (table)
    └── Create Period (form)

Timetable
├── Timetable Builder
│   ├── Weekly Grid View
│   ├── Class Schedule View
│   ├── Teacher Schedule View
│   ├── Add Entry (modal)
│   ├── Edit Entry (modal)
│   └── Conflict Checker

Reports (Read-Only)
├── Attendance Report
├── Homework Report
├── Test Report
└── Export Dashboard (CSV)

Settings
├── School Profile
│   ├── Name, Code, Address, Phone, Email
│   ├── Logo Upload
│   └── Domain Configuration
├── Academic Configuration
│   ├── Current Academic Year / Term
│   ├── Grading Scale Preferences
│   └── Class Capacity Default
└── System Preferences
    ├── Notification Defaults
    ├── Locale / Timezone
    └── Security Settings
```

### 2.2 Module Dependency Map

```
School Profile (Settings)
    └── Must exist before anything else

Academic Years + Terms
    └── Must exist before Classes, Subjects, Timetable

Classes
    ├── Requires: Academic Year
    └── Required by: Students, Timetable, Teacher Assignments

Subjects
    ├── Requires: School (exists by default)
    └── Required by: Teacher Assignments, Timetable

Teachers
    ├── Requires: School
    └── Required by: Teacher Assignments, Timetable

Students
    ├── Requires: Classes
    └── Required by: Parent Linking

Periods
    ├── Requires: School
    └── Required by: Timetable

Teacher Assignments
    ├── Requires: Teachers, Classes, Subjects, Academic Term
    └── Required by: Timetable

Timetable
    ├── Requires: Classes, Subjects, Teachers, Periods, Academic Term
    └── Final assembly step
```

**Recommended setup order for a new school:**
1. School Profile → Academic Year → Terms → Periods
2. Classes → Subjects
3. Teachers → Teacher Assignments
4. Students → Student Import → Parent Linking
5. Timetable Builder (last — depends on everything)

---

## 3. Sidebar Navigation

### 3.1 Full Sidebar Design

```
┌─────────────────────────────────────────────────────┐
│  🏫  [School Name]                                  │
│      [Academic Year & Term]                         │
│  ───────────────────────────────────────────────    │
│                                                      │
│  📊  Dashboard                                       │
│                                                      │
│  ──── USERS ──────────────────────────────────────  │
│                                                      │
│  👨‍🏫  Teachers                                       │
│  👩‍🎓  Students                                       │
│  👪  Parents                                         │
│  👑  Principals                                      │
│                                                      │
│  ──── ACADEMIC ───────────────────────────────────  │
│                                                      │
│  🏛️  Classes                                         │
│  📚  Subjects                                        │
│  📅  Academic Calendar                               │
│  ⏰  Periods                                         │
│                                                      │
│  ──── OPERATIONS ─────────────────────────────────  │
│                                                      │
│  📋  Timetable Builder                               │
│  📣  Announcements                                   │
│  📈  Reports                                         │
│                                                      │
│  ──── SYSTEM ─────────────────────────────────────  │
│                                                      │
│  ⚙️  School Settings                                 │
│                                                      │
│  ───────────────────────────────────────────────    │
│                                                      │
│  👤  [Admin Name]                                    │
│      School Admin • Logout                           │
└─────────────────────────────────────────────────────┘
```

### 3.2 Navigation Rationale

| Menu Item | Why It Exists | What Actions Happen Here |
|-----------|---------------|-------------------------|
| **Dashboard** | First screen after login. Admin needs a pulse check before diving into operations. | View KPIs, see alerts, click quick actions |
| **Teachers** | Core HR function. Admin manages teacher profiles, not teacher work. | Create/edit/deactivate teachers, search, view assignments |
| **Students** | Largest data set. Administers the student lifecycle from enrollment to graduation. | CRUD, import CSV, promote, link parents |
| **Parents** | Supporting module. Parents come from student linking, not standalone creation. | View list, link/unlink to students |
| **Principals** | Rarely used. Principal changes happen once every few years. | Create/edit principal profiles |
| **Classes** | Core academic structure. Setup at year start, occasional changes mid-year. | Create/edit classes, assign class teachers |
| **Subjects** | Setup once per academic year. Rare changes. | Create subjects, mark as core/elective |
| **Academic Calendar** | Annual setup. Define years and terms so everything else references them. | Create years, create terms, set current |
| **Periods** | Setup once. Defines the school day structure. | Create time slots, order them |
| **Timetable Builder** | Most complex module. Done at term start, occasional tweaks. | Visual grid, add/edit/delete entries, conflict check |
| **Reports** | Read-only reference. Admin may need to verify data integrity. | View attendance/homework/test reports, export CSV |
| **School Settings** | One-time setup with rare updates. | Profile, academic config, branding |

### 3.3 Section Grouping Logic

- **Users** — People management. Grouped because admin thinks of them together (I'm adding teachers AND students for the new term).
- **Academic** — Structure. These are the building blocks that define how the school day is organized.
- **Operations** — Active processes. The timetable is the final operational output of all academic setup.
- **System** — Configuration. Rarely touched, important when needed.

### 3.4 Navigation Behaviors

- **Active state**: Current section highlighted with bold text + left border accent (primary blue, 3px).
- **Hover state**: Subtle background tint on row hover (#F1F5F9).
- **Collapse**: No collapsible sections for Admin. The full tree must be visible. Admin users navigate by scanning the full menu.
- **Context persistence**: Clicking a section shows the list view first. Breadcrumbs enable navigation back.
- **Badges**: Optional unread count badge on Dashboard (if notifications enabled).
- **Keyboard shortcut**: `Cmd/Ctrl + K` opens command palette for instant navigation.

---

## 4. Screen Inventory

### 4.1 Complete Screen Map

| # | Screen Name | Purpose | Primary Goal | Primary Actions | Secondary Actions | Expected Data |
|----|------------|---------|--------------|-----------------|-------------------|---------------|
| 01 | **Dashboard** | Operational overview | See health of school at a glance | View KPI cards, scan alerts | Click quick actions, export | 5 KPI numbers, 4 alert types, recent activity feed |
| 02 | **Teachers List** | View all teachers | Find teacher quickly, take action | Search, filter, sort table | Create teacher, export CSV | Table: 10–50 rows with name, employee code, qualifications, class count, status |
| 03 | **Create Teacher** | Add new teacher | Create teacher + user account in one step | Fill form, submit | Cancel, discard draft | Form: first/last name, email, phone, employee code, qualification, specialization, hire date |
| 04 | **Edit Teacher** | Update teacher | Change profile information | Edit fields, save | Deactivate teacher, view class assignments | Pre-filled form + current assignment list |
| 05 | **Teacher Profile** | Full teacher view | See all teacher details in one place | View info, view class assignments | Edit, deactivate | Profile card + assignments table + timetable snippet |
| 06 | **Teacher Assignments** | Manage class-subject-teacher mapping | Assign teacher to a class and subject for a term | Add assignment row, remove assignment | Filter by class, filter by term | Table: class, subject, term columns per teacher |
| 07 | **Students List** | View all students | Find student quickly | Search, filter, sort | Create, import CSV, bulk actions | Table: 10–50 rows with name, admission number, class, roll number, parent count, status |
| 08 | **Create Student** | Add new student | Create student + user account + enroll in class | Fill form, select class, submit | Cancel | Form: first/last name, email, phone, admission number, class, roll number, DOB, gender, enrollment date |
| 09 | **Edit Student** | Update student | Change profile info or change class | Edit fields, save | Deactivate, change class, link parent | Pre-filled form + current enrollment info |
| 10 | **Student Profile** | Full student view | See all student details | View info, class, parent links | Edit, deactivate, view attendance | Profile card + enrollment history + parent card(s) + attendance summary |
| 11 | **Student Import** | Bulk CSV upload | Add 50–1000 students at once | Upload CSV, map columns, preview, confirm | Download template, cancel | Upload zone + column mapping UI + error report |
| 12 | **Parents List** | View all parents | Find parent linked to a student | Search, filter | View linked students | Table: name, email, phone, linked children count |
| 13 | **Link Parent** | Connect parent to student | Link parent to existing student | Search parent, search student, set relationship | Cancel | Modal: parent selector + student selector + relationship type dropdown |
| 14 | **Principals List** | View principals | Find or verify principal assignments | Search, filter | Create principal | Table: name, school, appointment type, tenure |
| 15 | **Create Principal** | Add new principal | Create principal profile | Fill form, submit | Cancel | Form: first/last name, email, phone, employee code, qualification, appointment type, tenure dates |
| 16 | **Edit Principal** | Update principal | Change principal info | Edit fields, save | Cancel | Pre-filled form + tenure info |
| 17 | **Classes List** | View all classes | See class structure at a glance | Search, filter | Create class, assign class teacher | Table: name, section, academic year, class teacher, students count, capacity |
| 18 | **Create Class** | Add new class | Create a new class section | Fill form, submit | Cancel | Form: name, section, academic year, class teacher, room number, capacity |
| 19 | **Edit Class** | Update class | Change class details | Edit fields, save | Cancel, change class teacher | Pre-filled form + student list |
| 20 | **Subjects List** | View all subjects | See subjects offered | Search, filter | Create subject | Table: name, code, description, core/elective status |
| 21 | **Create Subject** | Add new subject | Add subject to curriculum | Fill form, submit | Cancel | Form: name, code, description, is core toggle |
| 22 | **Academic Years List** | Manage years | See all academic years | Create year, set current | Filter | Table: name, start date, end date, is current flag |
| 23 | **Create Academic Year** | Add new year | Define academic calendar | Set name, start date, end date, submit | Cancel | Form: name, start date, end date |
| 24 | **Edit Academic Year** | Update year | Change year dates | Edit, save | Cancel | Pre-filled form |
| 25 | **Terms List** | Manage terms per year | See all terms for a year | Create term, set current | Filter by year | Table: name, start date, end date, is current |
| 26 | **Create Term** | Add new term | Define term within year | Select year, set dates, submit | Cancel | Form: select year, name, start date, end date |
| 27 | **Edit Term** | Update term | Change term dates | Edit, save | Cancel | Pre-filled form |
| 28 | **Periods List** | Manage time slots | View school day structure | Create period, reorder | Filter | Table: period number, name, start time, end time, is break |
| 29 | **Create Period** | Add new period | Define time slot | Fill form, submit | Cancel | Form: period number, name, start time, end time, is break toggle |
| 30 | **Edit Period** | Update period | Change slot time | Edit, save | Cancel | Pre-filled form |
| 31 | **Timetable Builder** | Visual schedule | Set weekly schedule for all classes | Add entries, edit, delete, check conflicts | View by class or teacher | Grid: days × periods grid with subject cards |
| **Announcements List** | View & manage announcements | See all school announcements | Search, filter, tap to view | Create announcement, delete expired | Table: title, audience, sender, date, scheduled status |
| **Announcement Create** | New announcement | Create & publish to audience | Select audience, write content, publish/schedule | Schedule for later, save draft | Form: title, content, audience selector (all/teachers/students/class-specific), schedule toggle |
| **Notifications** | View sent notifications | Review notification delivery status | Filter by type, view status | Resend failed, export | Table: recipient, type, channel, status, sent date |
| 32 | **Reports** | View reports | Verify school data | Select report type, filter | Export CSV | Charts + tables per report type |
| 33 | **School Settings** | Configure school | Change school profile and preferences | Edit profile, upload logo, set defaults | Save | Form sections: profile, academic config, system prefs |

### 4.2 Screen Flow (Critical Paths)

**New Year Setup Flow:**
```
Settings → Set Current Year → Create Terms → Classes List → Create Classes
    → Subjects List → Create Subjects → Teachers List → Create Teachers
    → Teacher Assignments → Timetable Builder → Students Import
```

**Mid-Year New Student Flow:**
```
Dashboard (quick action) → Create Student → Fill form → Select Class → Submit
    → Student Profile → Link Parent → Done
```

**Teacher Onboarding Flow:**
```
Teachers List → Create Teacher → Fill profile → Save
    → Teacher Assignments → Add class-subject assignments → Save
```

**Daily Verification Flow:**
```
Dashboard → View KPIs → Reports (if needed) → Export (if needed)
```

---

## 5. Dashboard Planning

### 5.1 Layout Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  🏫 Dashboard                        [Academic Year: 2025-2026]   │
│  Welcome back, [Admin Name]                                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ 📊 Students │  │ 👨‍🏫 Teachers │  │ 🏛️ Classes  │  │ 📋      │ │
│  │    1,247    │  │     87      │  │     32      │  │  82%    │ │
│  │  +12 this   │  │   +3 this   │  │   2 over    │  │ Capacity│ │
│  │  month      │  │   month     │  │   capacity  │  │ Util.   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────┐  ┌─────────────────────┐ │
│  │ ⚠️ Alerts & Flags                   │  │ ⚡ Quick Actions    │ │
│  │                                     │  │                     │ │
│  │ • 2 classes over capacity           │  │ + Add Teacher       │ │
│  │ • 5 teachers unassigned             │  │ + Import Students   │ │
│  │ • 12 students without parent link   │  │ + Create Class      │ │
│  │ • 3 classes missing timetable       │  │ + Open Timetable    │ │
│  │                                     │  │                     │ │
│  │ [View All Alerts →]                 │  │ • View Reports      │ │
│  └─────────────────────────────────────┘  └─────────────────────┘ │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🕐 Recent Activity                                           │ │
│  │                                                              │ │
│  │ • John Smith → Created Teacher (2 min ago)                   │ │
│  │ • Jane Doe → Imported 45 Students (25 min ago)               │ │
│  │ • Admin → Updated Class 10-A capacity (1 hour ago)           │ │
│  │ • Sarah Lee → Linked Parent to Student (3 hours ago)         │ │
│  │                                                              │ │
│  │ [View All Activity →]                                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 KPI Cards — Priority & Specification

| # | KPI | Why It Matters | Priority | Data Source | Visual Treatment |
|----|-----|---------------|:--------:|-------------|------------------|
| 1 | **Active Students** | Core metric. Growing, declining, or stable? | P0 | `GET /dashboard/admin` | Large number (bold 32px) + trend arrow + monthly delta text |
| 2 | **Active Teachers** | Staffing health. Teacher-student ratio insight. | P0 | `GET /dashboard/admin` | Large number + trend arrow |
| 3 | **Active Classes** | School scale at a glance. | P0 | `GET /dashboard/admin` | Large number + "X over capacity" subtext |
| 4 | **Class Capacity Utilization** | Hall health. Are classes full? | P0 | `GET /dashboard/admin` | Percentage + color (green < 80%, amber 80–95%, red > 95%) |
| 5 | **Linked Parents** | Parent engagement proxy. How many students have at least one linked parent? | P1 | `GET /dashboard/admin` | Large number + "% of students covered" subtext |

### 5.3 Alerts Section — Specification

| Alert Condition | Severity | Action Link | Dismissible? |
|----------------|:--------:|-------------|:------------:|
| Class capacity > 95% | ⚠️ Warning | Opens class edit (capacity field) | Yes |
| Teacher with no class/subject assignments | ⚠️ Warning | Opens teacher assignments | Yes |
| Students with no parent links | ℹ️ Info | Opens link parent flow | Yes |
| Classes with incomplete timetable (missing entries for current term) | 🔴 Critical | Opens timetable builder for that class | No (clears when resolved) |
| No current academic year set | 🔴 Critical | Opens academic years | No (clears when resolved) |
| No current term set | 🔴 Critical | Opens terms | No (clears when resolved) |

**Alert Display Rules:**
- Max 5 alerts shown. If more exist, show count: "+3 more alerts"
- Critical alerts stay until resolved. Warnings dismissible.
- Alerts are ordered: Critical first, then by severity, then by recency.

### 5.4 Recent Activity Feed

| Column | Type | Source |
|--------|------|--------|
| Who | User name | Audit log |
| What | Action description | Audit log action + entity type |
| When | Relative time ("2 min ago") | Audit log timestamp |
| Entity | Clickable link to affected record | Audit log entity_id |

**Display Rules:**
- Max 10 recent items shown
- Auto-refresh every 60 seconds (polling) or real-time (WebSocket)
- Actions shown: CREATE, UPDATE, DELETE on User, Teacher, Student, Class, Subject, Timetable entities
- Activities older than 24 hours not shown here (accessible via full audit trail)

### 5.5 Quick Actions

| Action | Destination | Keyboard Shortcut | Why This Exists |
|--------|------------|:-----------------:|-----------------|
| **+ Add Teacher** | Create Teacher form | `T` | Most common daily action |
| **+ Import Students** | Student Import page | `I` | Term-start bulk action |
| **+ Create Class** | Create Class form | `C` | New year setup |
| **📋 Open Timetable** | Timetable Builder | `B` | Complex enough to need its own card |
| **📈 View Reports** | Reports page | `R` | Quick verification |

### 5.6 Widget Priority Matrix

| Widget | Priority | Reason |
|--------|:--------:|--------|
| Student Count (KPI) | P0 | Core metric — every admin checks this first |
| Teacher Count (KPI) | P0 | Core metric |
| Class Count (KPI) | P0 | Core metric |
| Capacity Utilization (KPI) | P0 | Operational health indicator |
| Alerts & Flags | P0 | Prevents problems from going unnoticed |
| Quick Actions | P0 | Reduces clicks for common tasks |
| Recent Activity | P1 | Useful but not time-sensitive |
| Parent Coverage (KPI) | P2 | Important but not daily |

### 5.7 Dashboard Empty State

When the school has no data yet (fresh setup):
- Show the same layout but with zero values
- Replace alerts with a **Setup Checklist**: "Step 1: Create Academic Year → Step 2: Create Terms → Step 3: Create Classes → ..."
- Quick actions become prominent, with the first 3 shown as large cards with call-to-action text
- Recent activity shows: "No activity yet — get started by adding your first teacher!"

---

## 6. User Management UX

### 6.1 Teacher Management

#### 6.1.1 Teacher List Page

**Layout:**
```
[Search Bar]          [Filter: Status ▼]    [Filter: Department ▼]     [+ Add Teacher]  [⋮ Export]

┌──────┬──────────┬──────────────┬──────────┬──────────┬─────────┬────────────┬──────────┐
│ Name │ Employee │ Email        │ Phone    │ Qualif.  │ Spec.   │ Class/Subj │ Status   │
│      │ Code     │              │          │          │         │ Count      │          │
├──────┼──────────┼──────────────┼──────────┼──────────┼─────────┼────────────┼──────────┤
│ ...  │ ...      │ ...          │ ...      │ ...      │ ...     │ ...        │ Active ● │
└──────┴──────────┴──────────────┴──────────┴──────────┴─────────┴────────────┴──────────┘

                                        [Page 1 of 8]  [← Prev] [1] [2] [...] [8] [Next →]
```

**Columns:**
1. Name (first + last, clickable → profile)
2. Employee Code
3. Email
4. Phone
5. Qualification
6. Specialization
7. Assignments Count (badge: "3 classes, 4 subjects") — clickable → assignments view
8. Status (Active ● / Inactive ○)

**Filters:**
- Status: All | Active | Inactive
- Search: name, employee code, email (partial match, as-you-type with 300ms debounce)

**Bulk Actions (with checkbox selection):**
- Deactivate selected (soft delete)
- Activate selected
- Export selected as CSV

**Empty State:**
- "No teachers yet. Add your first teacher to get started." + [Add Teacher] button
- Show teacher import if available

#### 6.1.2 Create Teacher Form

**Form Type:** Single page with sections (no wizard — this is a frequently used form)

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Create New Teacher                                   │
│  ───────────────────────────────────────              │
│                                                        │
│  Personal Information                                  │
│  ┌─────────────┐  ┌─────────────┐                    │
│  │ First Name* │  │ Last Name*  │                    │
│  └─────────────┘  └─────────────┘                    │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Email*           │  │ Phone            │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                        │
│  Employment Details                                    │
│  ┌──────────────────┐  ┌─────────────┐               │
│  │ Employee Code*   │  │ Hire Date*  │               │
│  └──────────────────┘  └─────────────┘               │
│  ┌──────────────────┐                                 │
│  │ Qualification    │                                 │
│  └──────────────────┘                                 │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Specialization   │  │ is Class Teacher │          │
│  └──────────────────┘  └──────[ ☐ ]─────┘          │
│                                                        │
│  [Cancel]                              [Create Teacher] │
└──────────────────────────────────────────────────────┘
```

**Validation Rules:**
| Field | Rule | Error Message |
|-------|------|---------------|
| First Name | Required, max 100 chars | "First name is required" |
| Last Name | Required, max 100 chars | "Last name is required" |
| Email | Required, valid email format, unique per school | "Enter a valid email" / "This email is already in use" |
| Phone | Optional, valid format | "Enter a valid phone number" |
| Employee Code | Required, unique per school, max 30 chars | "Employee code is required" / "This code is already assigned" |
| Hire Date | Required, not in future | "Hire date is required" / "Hire date cannot be in the future" |
| Qualification | Optional, max 200 chars | — |
| Specialization | Optional, max 200 chars | — |

**Post-Submit Flow:**
1. Show success toast: "Teacher created successfully"
2. Transition to **Teacher Profile** page
3. Show secondary CTA: "Assign this teacher to classes and subjects →" (links to Teacher Assignments)

**Error States:**
- Network error: Toast "Failed to create teacher. Please try again." + Retry button
- Validation error: Inline errors on fields + summary at top of form
- Duplicate email: Highlight email field + "This email is already registered"

#### 6.1.3 Teacher Profile View

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Teachers List                   [Edit] [Deactivate] │
│                                                              │
│  ┌────────────────────┐                                     │
│  │ 👤 Avatar          │  John Smith                          │
│  │                    │  jsmith@school.edu                    │
│  │       Initials     │  Employee: TCH-0042                  │
│  │                    │  Active ●                            │
│  └────────────────────┘                                     │
│                                                              │
│  ┌───────────┬───────────┬───────────┬──────────────┐      │
│  │ Qualif.   │ Specializ.│ Hire Date │ Class Teacher│      │
│  │ M.Ed      │ Math      │ 2024-03-15│ Yes          │      │
│  └───────────┴───────────┴───────────┴──────────────┘      │
│                                                              │
│  📋 Current Assignments                                      │
│  ┌──────────┬──────────┬──────────┬────────────┐            │
│  │ Class    │ Subject  │ Term     │ Form Teach │            │
│  │ 10-A     │ Math     │ Term 1   │ ✓          │            │
│  │ 10-B     │ Math     │ Term 1   │            │            │
│  │ 9-A      │ Physics  │ Term 1   │            │            │
│  └──────────┴──────────┴──────────┴────────────┘            │
│  [Manage Assignments →]                                      │
│                                                              │
│  📅 Today's Timetable                                         │
│  ┌──────┬──────────┬──────────┬────────┐                    │
│  │ Prd  │ Class    │ Subject  │ Time   │                    │
│  │ P1   │ 10-A     │ Math     │ 8-9 AM │                    │
│  │ P3   │ 9-A      │ Physics  │ 10-11  │                    │
│  └──────┴──────────┴──────────┴────────┘                    │
│  [View Full Timetable →]                                     │
│                                                              │
│  📜 Activity Log                                             │
│  • Created by Admin on 2024-03-15                            │
│  • Assignments updated by Admin on 2024-04-01                │
└──────────────────────────────────────────────────────────────┘
```

**Deactivate Confirmation Modal:**
```
┌─────────────────────────────────────┐
│  ⚠️ Deactivate Teacher              │
│                                      │
│  Are you sure you want to           │
│  deactivate John Smith?             │
│                                      │
│  This will:                          │
│  • Remove all class assignments      │
│  • Remove from timetable             │
│  • Prevent login                     │
│                                      │
│  [Cancel]    [✓ Yes, Deactivate]    │
└─────────────────────────────────────┘
```

### 6.2 Student Management

#### 6.2.1 Student List Page

**Layout:**
```
[Search Bar]     [Filter: Class ▼]  [Filter: Status ▼]    [+ Add Student]  [📥 Import]  [⋮ Export]

┌──────┬──────────┬──────────┬──────────┬────────┬────────────┬──────────┬────────────┐
│ Name │ Adm. No. │ Class    │ Roll #   │ DOB    │ Gender     │ Parents  │ Status     │
├──────┼──────────┼──────────┼──────────┼────────┼────────────┼──────────┼────────────┤
│ ...  │ ...      │ ...      │ ...      │ ...    │ ...        │ ...      │ Active ●   │
└──────┴──────────┴──────────┴──────────┴────────┴────────────┴──────────┴────────────┘

                                                      [Page 1 of 25] [...]
```

**Key Design Decisions:**
- Search is the primary interaction for large schools. Search bar is always visible, never hidden behind an icon.
- Class filter uses a dropdown of all classes (searchable dropdown for large schools).
- "Parents" column shows count + clickable to view/link parents.

**Bulk Actions:**
- Change class (promote / transfer)
- Deactivate selected
- Export CSV
- Link parent (opens modal)

#### 6.2.2 Create Student Form

**Form Type:** Single page (same pattern as Teacher — forms must be fast)

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| First Name | Text | ✅ | |
| Last Name | Text | ✅ | |
| Email | Email | ✅ | Unique per school |
| Phone | Text | ❌ | |
| Admission Number | Text | ✅ | Unique per school, auto-generate option |
| Class | Dropdown | ✅ | List of active classes for current year |
| Roll Number | Text | ❌ | Unique per class, auto-assign option |
| Date of Birth | Date | ❌ | |
| Gender | Select (Male/Female/Other) | ❌ | |
| Enrollment Date | Date | ✅ | Default: today |

**Auto-generate Feature:**
- "Auto-generate" link next to Admission Number field — generates ADM-YYYY-NNN format
- "Auto-assign" link next to Roll Number — assigns next available roll number in the selected class

#### 6.2.3 Student Import — Bulk CSV

**Step-by-Step UX:**

```
Step 1: Download Template
┌──────────────────────────────────────────────────────────┐
│  📥 Import Students via CSV                              │
│                                                          │
│  Download template CSV file with required columns.       │
│  [Download Template]                                     │
└──────────────────────────────────────────────────────────┘

Step 2: Upload
┌──────────────────────────────────────────────────────────┐
│  📤 Drag & drop your CSV file here, or click to browse   │
│                                                          │
│  [Choose File]  or drop file here                        │
│                                                          │
│  Supported: .csv files up to 10MB                        │
└──────────────────────────────────────────────────────────┘

Step 3: Column Mapping (auto-detected, editable)
┌──────────────────────────────────────────────────────────┐
│  Column Mapping                                          │
│                                                          │
│  CSV Column     → System Field        Status             │
│  ─────────────────────────────────────────────────────   │
│  First Name     → first_name           ✓ Auto-mapped     │
│  Last Name      → last_name            ✓ Auto-mapped     │
│  Email          → email                ✓ Auto-mapped     │
│  Admission No   → admission_number     ✗ Unmapped        │
│  ...            → ...                                    │
│                                                          │
│  [Map Column ▼]  [Skip Column]                           │
└──────────────────────────────────────────────────────────┘

Step 4: Preview & Confirm
┌──────────────────────────────────────────────────────────┐
│  Preview — 47 rows detected                              │
│                                                          │
│  ┌──────────┬──────────┬──────────┬──────────┬───────┐  │
│  │ First    │ Last     │ Email    │ Class    │ Status│  │
│  ├──────────┼──────────┼──────────┼──────────┼───────┤  │
│  │ Alice    │ Smith    │ a@b.com  │ 10-A     │ ✓ OK  │  │
│  │ Bob      │ Jones    │ b@c.com  │ 10-A     │ ✓ OK  │  │
│  │ ...      │ ...      │ ...      │ ...      │ ...   │  │
│  │ Charlie  │ Brown    │ c@d.com  │          │ ✗ No  │  │
│  │          │          │          │          │ class │  │
│  └──────────┴──────────┴──────────┴──────────┴───────┘  │
│                                                          │
│  Validation: 45 valid, 2 errors                          │
│  [Download Errors]  [Cancel]  [✓ Import 45 Students]    │
└──────────────────────────────────────────────────────────┘

Step 5: Success
┌──────────────────────────────────────────────────────────┐
│  ✅ Import Successful                                     │
│                                                          │
│  45 students imported successfully.                      │
│  2 rows skipped due to errors.                           │
│                                                          │
│  [Download Error Report]  [View Students]  [Import More]│
└──────────────────────────────────────────────────────────┘
```

**Validation During Import:**
| Check | Error Behavior |
|-------|---------------|
| Missing required field | Skip row, add to error report |
| Duplicate email | Skip row, add to error report |
| Invalid class name | Skip row, suggest closest match |
| Invalid date format | Skip row, show expected format |
| Duplicate admission number | Skip row, show existing |

#### 6.2.4 Student Profile View

Similar to Teacher Profile but with:
- **Enrollment History** section (timeline-style): shows class changes across years
- **Parent Cards**: linked parents with relationship type, primary contact flag
- **Attendance Summary**: simple percentage + monthly trend (mini bar chart)
- **Performance Summary**: homework average, test average (if available)

#### 6.2.5 Link Parent to Student

**Trigger:** From Student Profile → "Link Parent" button

**Modal Design:**
```
┌──────────────────────────────────────────────┐
│  🔗 Link Parent to Student                    │
│                                               │
│  Student: Alice Smith (ADM-2025-001)          │
│  Class: 10-A                                  │
│                                               │
│  Find Parent:                                 │
│  ┌─────────────────────────────────┐         │
│  │ Search by name or email...      │         │
│  └─────────────────────────────────┘         │
│                                               │
│  Results (type 3+ characters):                │
│  ┌──────────┬──────────┬──────────┬──────┐  │
│  │ Name     │ Email    │ Phone    │      │  │
│  ├──────────┼──────────┼──────────┼──────┤  │
│  │ Mary Sm. │ m@b.com  │ 555-0100 │ Select│  │
│  └──────────┴──────────┴──────────┴──────┘  │
│                                               │
│  Relationship: [Select ▼]                     │
│  ├── Father                                   │
│  ├── Mother                                   │
│  ├── Guardian                                 │
│  └── Other                                    │
│                                               │
│  ☐ Set as primary contact                     │
│  ☐ Enable WhatsApp notifications              │
│                                               │
│  [Cancel]           [✓ Link Parent]           │
└──────────────────────────────────────────────┘
```

**If parent doesn't exist:**
- Show "Parent not found?" → "Create New Parent" link
- Opens quick-create parent form in a drawer/modal

### 6.3 Parent Management

#### 6.3.1 Parents List

**Purpose:** Reference list. Admin searches for a parent to see which students they're linked to.

**Table Columns:**
- Name
- Email
- Phone
- Linked Students (count, clickable → list of student names)
- Relationship (father/mother/guardian/other)
- Status (verified/unverified)

**Actions:**
- Click row → view parent detail (which students, link date, relationship)
- Delete link → unlink parent from student

**Key constraint:** Parents are created via student import or student creation, not stand-alone. The "Create Parent" button is secondary (small, ghost style) because it's rarely needed.

### 6.4 Principal Management

#### 6.4.1 Principals List

**Purpose:** Manage principal profiles. This is used infrequently (once per tenure change).

**Table Columns:**
- Name
- Email
- Employee Code
- Appointment Type
- Tenure Start
- Tenure End (NULL = current)
- Status (Active/Former)

**Actions:**
- Create Principal
- Edit Principal
- View Principal

#### 6.4.2 Create Principal Form

**Unique Fields (vs Teacher):**
- Appointment Type: dropdown (Permanent, Acting, Interim)
- Tenure Start Date: required
- Tenure End Date: optional (leave blank for current)
- Qualification: optional
- Same employee_code unique constraint

---

## 7. Academic Management UX

### 7.1 Classes Management

#### 7.1.1 Classes List

**Table Columns:**
- Name (e.g., "10")
- Section (e.g., "A" — combined display: "10-A")
- Academic Year
- Class Teacher (name, clickable → teacher profile)
- Students Enrolled / Capacity (e.g., "28 / 30")
- Utilization % (color-coded bar)

**Key UX Decision:**
Display "10-A" as a single combined label by default, with separate sortable columns for name and section.

**Filters:**
- Academic Year
- Class Teacher
- Capacity Status (Under / Full / Over)

#### 7.1.2 Create Class Form

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Name | Text | ✅ | e.g., "Grade 10" |
| Section | Text | ❌ | e.g., "A" — combined with name |
| Academic Year | Dropdown | ✅ | Current year pre-selected |
| Class Teacher | Dropdown | ❌ | List of available teachers |
| Room Number | Text | ❌ | |
| Capacity | Number | ✅ | Default: 30, min: 1, max: 100 |

**Validation:**
- Unique (name + section + academic year) per school
- Capacity between 1–100

#### 7.1.3 Class Detail View

**Layout:**
```
← Back to Classes List

10-A (Grade 10, Section A)
Academic Year: 2025-2026 | Class Teacher: John Smith | Room: 201

┌─────────┬──────────┐  ┌───────────────────────────────────┐
│ Stats   │          │  │ Students (28/30)                  │
│         │          │  │                                   │
│ 28      │ 93%      │  │ ┌──────┬──────────┬──────────┐   │
│ Students│ Capacity  │  │ │ Roll │ Name     │ Status   │   │
│         │          │  │ ├──────┼──────────┼──────────┤   │
│ 1       │ 2 Free   │  │ │ 1    │ Alice..  │ Active ● │   │
│ Teacher │ Seats    │  │ │ 2    │ Bob...   │ Active ● │   │
│         │          │  │ │ ...  │ ...      │ ...      │   │
│ 5       │          │  │ └──────┴──────────┴──────────┘   │
│ Subjects│          │  │ [View All Students →]             │
└─────────┴──────────┘  └───────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Teachers Assigned to This Class                           │
│ ┌──────────┬──────────┬──────────┬──────────┐            │
│ │ Teacher  │ Subject  │ Day/Time │ Term     │            │
│ │ John Sm. │ Math     │ Mon P1   │ Term 1   │            │
│ │ Jane Do. │ English  │ Mon P2   │ Term 1   │            │
│ └──────────┴──────────┴──────────┴──────────┘            │
│ [Manage Assignments →]                                     │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ Timetable for This Class                                   │
│ [Mini weekly grid view — read-only]                        │
│ [Open in Timetable Builder →]                               │
└───────────────────────────────────────────────────────────┘
```

### 7.2 Subjects Management

#### 7.2.1 Subjects List

**Table Columns:**
- Name
- Code
- Description
- Type (Core / Elective)
- Assigned Classes (count, clickable → list)
- Teachers (count, clickable → list)

#### 7.2.2 Create Subject Form

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Name | Text | ✅ | e.g., "Mathematics" |
| Code | Text | ✅ | e.g., "MATH" — unique per school |
| Description | Textarea | ❌ | Optional |
| Is Core Subject | Toggle | ✅ | Default: Yes |

### 7.3 Academic Years Management

#### 7.3.1 Academic Years List

**Purpose:** Define the school's academic calendar.

**Table Columns:**
- Name (e.g., "2025-2026")
- Start Date
- End Date
- Status (Current / Past / Future)
- Terms (count, clickable)

**Key Actions:**
- **Set as Current**: Radio button or "Make Current" button. Only one year can be current.
- **Create Year**: Opens form.

**Display Rule:**
Current year is highlighted (blue badge) and always at top of list, regardless of sort order.

#### 7.3.2 Create Academic Year Form

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Name | Text | ✅ | e.g., "2025-2026" |
| Start Date | Date | ✅ | |
| End Date | Date | ✅ | Must be after start date |

**Post-Create Flow:**
1. Toast: "Academic year created"
2. CTA: "Add terms to this year →" (links to Terms page with year pre-selected)

### 7.4 Academic Terms Management

#### 7.4.1 Terms List

**Context Header:**
Shows selected academic year at top, with dropdown to switch years.

**Table Columns:**
- Name (e.g., "Term 1")
- Start Date
- End Date
- Status (Current / Past / Future)

**Key Actions:**
- **Set as Current Term**: Only one term per year can be current.
- **Create Term**: Opens form.

#### 7.4.2 Create Term Form

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Academic Year | Dropdown | ✅ | Pre-selected from context |
| Name | Text | ✅ | e.g., "Term 1" |
| Start Date | Date | ✅ | Must be within year dates |
| End Date | Date | ✅ | Must be after start, within year dates |

**Validation:**
- Term dates must be within the parent academic year's date range
- Term names must be unique within the academic year

### 7.5 Periods (Time Slots) Management

#### 7.5.1 Periods List

**Purpose:** Define the structure of the school day.

**Table Columns:**
| Period # | Name | Start Time | End Time | Duration | Type |
|:--------:|------|:----------:|:--------:|:--------:|:----:|
| 1 | Period 1 | 08:00 | 08:45 | 45 min | Instructional |
| 2 | Period 2 | 08:45 | 09:30 | 45 min | Instructional |
| 3 | Morning Break | 09:30 | 09:50 | 20 min | Break |
| 4 | Period 3 | 09:50 | 10:35 | 45 min | Instructional |
| ... | ... | ... | ... | ... | ... |

**Key UX Decisions:**
- Table is sorted by period_number by default
- "Type" column uses badge: Instructional (blue) vs Break (gray)
- Duration is calculated automatically (end_time - start_time)
- Period number can be reordered via drag-and-drop or numeric input
- No overlapping time slots allowed (validated on save)

#### 7.5.2 Create Period Form

**Fields:**
| Field | Type | Required | Notes |
|-------|------|:--------:|-------|
| Period Number | Number | ✅ | Sequential, unique per school |
| Name | Text | ✅ | e.g., "Period 1" |
| Start Time | Time | ✅ | |
| End Time | Time | ✅ | Must be after start |
| Is Break | Toggle | ✅ | |

**Conflict Detection:**
When saving, check if:
- New period overlaps with any existing period's time range
- Period number is already taken
On conflict, show inline error: "This time range overlaps with 'Morning Break' (09:30–09:50)"

### 7.6 Teacher Assignments

#### 7.6.1 Teacher Assignments Page

**Purpose:** Map which teacher teaches which subject to which class in which term.

**Layout Strategy:**
This is a **cross-reference management page**, not a simple list. Best approach: filter-driven assignment table.

```
Teacher: [Select Teacher ▼]     Class: [All Classes ▼]     Term: [Current Term ▼]

┌──────────┬──────────┬──────────┬────────────┬──────────┐
│ Teacher  │ Class    │ Subject  │ Term       │ Actions  │
├──────────┼──────────┼──────────┼────────────┼──────────┤
│ John Sm. │ 10-A     │ Math     │ Term 1    │ [🗑️]    │
│ John Sm. │ 10-B     │ Math     │ Term 1    │ [🗑️]    │
│ Jane Do. │ 10-A     │ English  │ Term 1    │ [🗑️]    │
└──────────┴──────────┴──────────┴────────────┴──────────┘

                     [+ Add Assignment]
```

**Alternative View — By Teacher (recommended default):**
When "Teacher" filter is selected, show that teacher's assignments as a clean table. Then admin can add/remove assignments for that teacher.

**Add Assignment Modal:**
```
┌──────────────────────────────────────────────┐
│  Add Assignment                               │
│                                               │
│  Teacher: John Smith                          │
│                                               │
│  Class:    [Select Class ▼]                   │
│  Subject:  [Select Subject ▼]                 │
│            (filtered by selected class)        │
│  Term:     [Current Term ▼]                   │
│                                               │
│  ☐ Also set as class teacher for this class   │
│                                               │
│  [Cancel]    [✓ Add Assignment]               │
└──────────────────────────────────────────────┘
```

**Duplicate Detection:**
If the same (teacher, class, subject, term) combination already exists:
- Show inline error: "This assignment already exists"
- Prevent duplicate creation

**Delete Confirmation:**
```
┌─────────────────────────────────┐
│  Remove Assignment?              │
│                                  │
│  John Smith → Math → 10-A       │
│                                  │
│  This will also remove related   │
│  timetable entries for this      │
│  combination.                    │
│                                  │
│  [Cancel]    [✓ Remove]         │
└─────────────────────────────────┘
```

#### 7.6.2 Workflow Recommendation

**Best workflow for term start:**
1. Set current academic year + current term
2. Create classes
3. Create subjects
4. Create teachers (or import existing)
5. Go to Teacher Assignments → filter by "Unassigned Teachers"
6. Assign each teacher to their classes/subjects via the modal
7. Filter by "All" to verify completeness (check for teachers with zero assignments)

---

## 8. Timetable Management UX

### 8.1 Overview

The timetable builder is the most complex screen in the Admin portal. It must be:
- **Visual**: A grid that shows the entire weekly schedule at a glance
- **Interactive**: Add, edit, delete entries directly in the grid
- **Conflict-aware**: Prevent double-booking teachers or classes
- **Performant**: Handle 6,000+ entries for large schools

### 8.2 View Modes

#### 8.2.1 Weekly Grid View (Default)

```
Academic Term: Term 1, 2025-2026       View: [Class: 10-A ▼]

         │ Mon     │ Tue     │ Wed     │ Thu     │ Fri     │ Sat
─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P1       │         │         │         │         │         │
08:00–   │  Math   │  Math   │  Math   │  Math   │  Math   │
08:45    │  J.Sm.  │  J.Sm.  │  J.Sm.  │  J.Sm.  │  J.Sm.  │
         │  Room201│  Room201│  Room201│  Room201│  Room201│
─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P2       │         │         │         │         │         │
08:45–   │ English │  Sci.   │ English │  Sci.   │ English │
09:30    │  J.Doe  │  R.Brown│  J.Doe  │  R.Brown│  J.Doe  │
         │  Room203│  Lab 1  │  Room203│  Lab 1  │  Room203│
─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────
Break    │  🟡 Morning Break                                       │
─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P3       │         │         │         │         │         │
09:50–   │  Sci.   │ English │  Sci.   │ English │  Sci.   │
10:35    │  R.Brown│  J.Doe  │  R.Brown│  J.Doe  │  R.Brown│
         │  Lab 1  │  Room203│  Lab 1  │  Room203│  Lab 1  │
─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P4       │  ...    │  ...    │  ...    │  ...    │  ...    │
...      │         │         │         │         │         │
─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────

[+ Add Entry]  🔍 Check Conflicts  [View: ▼]  [Export CSV]
```

**Grid Cell Behavior:**
- **Empty cell** (no entry): Dashed border, "+" icon on hover → click to add
- **Occupied cell**: Colored card showing subject, teacher, room
  - Hover: Slight lift shadow, shows delete (✕) and edit (pencil) icons
  - Click: Opens edit modal
- **Break row**: Gray background with centered text, non-interactive

**Color Coding by Subject:**
Each subject gets a consistent color across the grid (e.g., Math = blue, English = green, Science = purple). This enables pattern recognition at a glance.

#### 8.2.2 Teacher Schedule View

```
View: [Teacher: John Smith ▼]

         │ Mon     │ Tue     │ Wed     │ Thu     │ Fri
─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P1       │ 10-A    │ 10-A    │ 10-A    │ 10-A    │ 10-A
08:00    │ Math    │ Math    │ Math    │ Math    │ Math
         │ Rm 201  │ Rm 201  │ Rm 201  │ Rm 201  │ Rm 201
─────────┼─────────┼─────────┼─────────┼─────────┼─────────
P2       │ 9-A     │         │ 9-A     │         │ 9-A
08:45    │ Physics │  Free   │ Physics │  Free   │ Physics
         │ Rm 305  │         │ Rm 305  │         │ Rm 305
─────────┼─────────┼─────────┼─────────┼─────────┼─────────
...
```

- Free periods shown as light gray with "Free" label
- Teacher can see their entire weekly workload at a glance
- Useful for verifying teacher workload balance

#### 8.2.3 Class Schedule View (same as Weekly Grid but always showing one class)

### 8.3 Add/Edit Entry Modal

```
┌──────────────────────────────────────────────┐
│  ✏️ Add Timetable Entry                        │
│                                                │
│  Class:    [10-A ▼]                            │
│  Subject:  [Math ▼]                            │
│            (filtered by class assignments)      │
│  Teacher:  [John Smith ▼]                      │
│            (filtered by class+subject)          │
│  Day:      [Monday ▼]                          │
│  Period:   [P1 (08:00–08:45) ▼]                │
│  Room:     [201]                               │
│                                                │
│  [Cancel]    [✓ Save Entry]                    │
└──────────────────────────────────────────────┘
```

**Smart Filtering:**
- When a Class is selected, Subject dropdown shows only subjects assigned to that class
- When Class + Subject is selected, Teacher dropdown shows only teachers assigned to that class+subject
- This prevents the admin from creating entries that don't match existing teacher assignments

### 8.4 Conflict Detection

**Two types of conflicts:**

| Conflict Type | Trigger | Visual Feedback |
|--------------|---------|-----------------|
| **Teacher double-booking** | Same teacher, same day, same period, different class | Red toast: "John Smith is already teaching 10-A in P1 on Monday" |
| **Class double-booking** | Same class, same day, same period, different subject/teacher | Red toast: "10-A already has Math in P1 on Monday" |

**Conflict Check Button:**
"🔍 Check Conflicts" scans all entries for the current term and shows a report:

```
┌──────────────────────────────────────────────┐
│  ⚠️ Conflict Report — 2 conflicts found      │
│                                               │
│  1. 🟡 John Smith → P1 Mon → 10-A & 9-A     │
│     Teacher assigned to two classes at once   │
│     [Fix: Edit 9-A P1 Mon]                    │
│                                               │
│  2. 🔴 10-A → P3 Wed → Math & English       │
│     Class has two subjects in same period     │
│     [Fix: Edit 10-A English P3 Wed]           │
│                                               │
│  [Dismiss]  [Export Report]                  │
└──────────────────────────────────────────────┘
```

**Auto-check on Save:**
When saving any entry, the system automatically checks for conflicts. If found:
- Show conflict modal with option to "Save Anyway" or "Cancel"
- The UNIQUE constraint on (term, class, day, period) prevents true duplicates at DB level

### 8.5 Timetable Bulk Operations

- **Copy from previous term**: Button to copy last term's timetable as a starting point (admin can then tweak)
- **Clear term**: Dangerous action with confirmation: "Clear all timetable entries for Term 1?"
- **Export**: CSV export of the current view (all entries for selected class/teacher)
- **Print**: Not supported. Use export instead.

### 8.6 Empty State

**When no timetable exists for a class:**
```
┌───────────────────────────────────────────────────────────┐
│  📋 No timetable entries for 10-A yet                       │
│                                                             │
│  Before building a timetable, make sure:                    │
│  ✅ Classes are created                                     │
│  ✅ Subjects are defined                                    │
│  ✅ Teachers are assigned to classes & subjects             │
│  ✅ Periods are defined                                     │
│                                                             │
│  [Start Adding Entries]     [Copy from Another Class ▼]    │
└───────────────────────────────────────────────────────────┘
```

### 8.7 Error States

| Error | UX |
|-------|-----|
| Conflict on save | Red toast + conflict detail in modal |
| Network error on save | Toast "Failed to save. Retry?" + Retry button |
| Grid fails to load | Skeleton grid, then error state with Retry |

---

## 9. School Settings UX

### 9.1 Settings Page Layout

Settings is a single page with multiple sections using a side-tab or accordion pattern.

```
Settings
├── School Profile        ← DEFAULT OPEN
├── Academic Configuration
└── System Preferences
```

### 9.2 School Profile Section

```
┌──────────────────────────────────────────────────────┐
│  School Profile                                       │
│  ──────────────────────────────                       │
│  ┌──────────────────┐                                 │
│  │ Logo Upload      │  Current logo displayed         │
│  │ [Upload Logo]    │  Max 2MB, PNG/JPG/SVG          │
│  └──────────────────┘                                 │
│                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ School Name*         │  │ School Code*         │  │
│  │ "Athon International"│  │ "ATH-001"            │  │
│  └──────────────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────┐        │
│  │ Address                                   │        │
│  │ 123 Education Lane, City, State          │        │
│  └──────────────────────────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ Phone                │  │ Email                │  │
│  │ +1-555-0100          │  │ admin@athon.edu      │  │
│  └──────────────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────┐        │
│  │ Domain (for white-label portal)          │        │
│  │ portal.athon.edu                          │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  [Reset]                                        [Save]  │
└──────────────────────────────────────────────────────┘
```

### 9.3 Academic Configuration Section

```
┌──────────────────────────────────────────────────────┐
│  Academic Configuration                                │
│  ──────────────────────────────                       │
│                                                        │
│  📅 Current Status                                     │
│  Academic Year: 2025-2026        [Change ▼]            │
│  Current Term:  Term 1           [Change ▼]            │
│                                                        │
│  🏛️ Defaults                                           │
│  ┌──────────────────────────────────────────┐        │
│  │ Default Class Capacity                   │        │
│  │ [30] students                            │        │
│  └──────────────────────────────────────────┘        │
│  ┌──────────────────────────────────────────┐        │
│  │ Grading Scale                             │        │
│  │ [A: 90-100, B: 75-89, C: 50-74, D: <50 ▼]│        │
│  └──────────────────────────────────────────┘        │
│  ┌──────────────────────────────────────────┐        │
│  │ Passing Percentage                       │        │
│  │ [50] %                                   │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  [Reset]                                        [Save]  │
└──────────────────────────────────────────────────────┘
```

### 9.4 System Preferences Section

```
┌──────────────────────────────────────────────────────┐
│  System Preferences                                    │
│  ──────────────────────────────                       │
│                                                        │
│  🔔 Notification Defaults                              │
│  ┌──────────────────────────────────────────┐        │
│  │ Default notification channel             │        │
│  │ ● Email   ○ WhatsApp   ○ Push   ○ SMS   │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  🌐 Locale & Timezone                                   │
│  ┌──────────────────────────────────────────┐        │
│  │ Language: [English ▼]                     │        │
│  │ Timezone: [(UTC+05:30) India ▼]          │        │
│  │ Date Format: [DD/MM/YYYY ▼]              │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  🔒 Security                                           │
│  ┌──────────────────────────────────────────┐        │
│  │ ☐ Require verification for new users     │        │
│  │ ☐ Auto-deactivate after 90 days inactive │        │
│  │ ☐ Allow multiple sessions                │        │
│  └──────────────────────────────────────────┘        │
│                                                        │
│  [Reset]                                        [Save]  │
└──────────────────────────────────────────────────────┘
```

### 9.5 Settings Form Behaviors

- **Save button** is always at bottom of each section
- **Reset button** reverts to last saved state
- **Unsaved changes warning**: If admin navigates away with unsaved changes, show confirmation: "You have unsaved changes. Discard?"
- **Success toast**: "Settings saved successfully"
- **Logo upload**: Shows preview immediately after upload; only saved on form submit
- **Domain change warning**: "Changing the domain will require users to log in through the new portal URL. Continue?"

---

## 10. Tables Strategy

### 10.1 Design Philosophy

Admin lives inside tables. Every management page is a table. The table is not just a data display — it's the primary interaction surface.

### 10.2 Table Component Specification

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search...]       [Filter 1 ▼] [Filter 2 ▼]       [📥 Import] [+ Add] │
│                                                                             │
│  ☐ Select All  ┌──────┬──────┬──────────┬──────────┬──────────┬──────────┐│
│  Filters       │ Name │ Code │ Class    │ Status   │  Actions │          ││
│  Active filters│      │      │          │          │          │          ││
│  shown as chips│      │      │          │          │          │          ││
│  [Class: 10-A ✕]│      │      │          │          │          │          ││
│               ├──────┼──────┼──────────┼──────────┼──────────┼──────────┤│
│               │ ☐    │ ...  │ ...      │ Active ● │ [Edit]   │          ││
│               │ ☐    │ ...  │ ...      │ Inactive │ [Edit]   │          ││
│               │ ☐    │ ...  │ ...      │ Active ● │ [Edit]   │          ││
│               ├──────┼──────┼──────────┼──────────┼──────────┼──────────┤│
│               │ 25 rows selected                        [Bulk Actions ▼] ││
│               └──────┴──────┴──────────┴──────────┴──────────┴──────────┘│
│                                                                             │
│  [← Prev]  [1] [2] [3] ... [25] [Next →]    Showing 25 of 1,247 results  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Search Strategy

- **Persistent search bar**: Always visible at top of every table page
- **Debounced**: 300ms delay after last keystroke
- **Partial match**: Searches across all text columns (name, code, email)
- **Minimum characters**: Search activates after 2+ characters
- **Clear button**: One-click to clear search and return to full list
- **Visual indicator**: Show search term in filter chips "Search: 'John' ✕"

### 10.4 Filtering Strategy

| Filter Type | UX Pattern | Example |
|-------------|-----------|---------|
| **Dropdown select** | Single select | Class, Academic Year |
| **Multi-select** | Checkbox dropdown | Status (Active, Inactive) |
| **Date range** | Calendar picker | Enrollment Date, Hire Date |
| **Search within filter** | Typeahead dropdown | Filter by teacher (100+ options) |

**Filter Chip Display:**
- Active filters shown as chips below search bar
- Each chip has ✕ to remove that filter
- "Clear all" link when 3+ filters active

### 10.5 Sorting Strategy

- Click column header to sort ascending (↑), click again for descending (↓)
- Default sort: created_at DESC (newest first) or name ASC (alphabetical)
- Only one sort column active at a time
- Sort indicator (↑/↓ arrow) visible on active sort column

### 10.6 Bulk Selection

- **Select All**: Checkbox in header selects all visible rows on current page
- **Select All Pages**: After selecting all visible, show: "All 25 on this page selected. Select all 1,247 results?"
- **Select range**: Click checkbox + Shift-click checkbox to select range
- **Clear selection**: "Clear selection" link when rows are selected
- **Bulk action bar**: Appears when 1+ rows selected, shows count and action dropdown

**Bulk Actions Available per Module:**
| Module | Bulk Actions |
|--------|-------------|
| Teachers | Deactivate, Activate, Export CSV |
| Students | Change Class, Deactivate, Export CSV, Link Parent |
| Parents | Export CSV |
| Classes | Export CSV |
| Subjects | Export CSV |

### 10.7 Pagination Strategy

- **Page size**: 25 (default), toggle to 50, 100
- **Position**: Bottom of table, centered
- **Page numbers**: Show first, last, and 5 surrounding pages with ellipsis
- **Total count**: "Showing 25 of 1,247 results"
- **Infinite scroll**: NOT recommended for Admin. Pagination is better because:
  - Admin needs to jump to specific pages
  - Admin needs to know total result count
  - Admin works methodically through pages

### 10.8 Export Strategy

- **Format**: CSV only (admin works in Excel/Google Sheets)
- **Scope**: Export all filtered results (not just visible page)
- **Button**: "Export" in table header area, always visible
- **Behavior**: Triggers download. For large exports (>10,000 rows), show progress indicator.
- **Column export**: Export visible columns only (admins can hide columns then export)

### 10.9 Column Visibility

- Click "Columns" button → dropdown with checkbox list of all columns
- Admin can show/hide columns as needed
- Visibility preference stored in localStorage (not persisted to backend)
- Default visibility set per module (most important columns shown by default)

### 10.10 Saved Views (Future Enhancement)

For power users:
- Save current filter/search/sort configuration as a named view
- Switch between saved views via dropdown
- Examples: "Active Teachers", "Full Classes", "Students Without Parents"

---

## 11. Forms Strategy

### 11.1 Form Type Decision Matrix

| Form | Type | Rationale |
|------|------|-----------|
| Create Teacher | Single Page | Frequently used. Speed matters. No complex branching. |
| Create Student | Single Page | Frequently used. Speed matters. Class selection is a single dropdown. |
| Create Principal | Single Page | Infrequently used. Simple form. No need for multi-step. |
| Create Class | Single Page | Simple. 6 fields. Done in 30 seconds. |
| Create Subject | Single Page | Simplest form. 4 fields. |
| Create Academic Year | Single Page | Simple date picker form. |
| Create Term | Single Page | Simple date picker form. |
| Create Period | Single Page | Simple time picker form. |
| Add Timetable Entry | Modal | Context-dependent. Admin needs to see the grid while adding. Modal keeps context. |
| Bulk Import Students | Multi-step (5 steps) | Complex process with multiple stages: template → upload → map → preview → confirm. Each step needs full attention. |
| Link Parent to Student | Modal (§6.2.5) | Context-dependent. Admin is on the student profile and needs to link without navigation. Search parent + select relationship. |
| Teacher Assignments | Single Page | Filter + add/remove rows. Better as a page than modal (too much data). |
| School Settings | Tabbed Single Page | Different settings categories. Side tabs keep all settings accessible. |
| Create Announcement | Single Page | Moderate complexity. Title + content + audience selector + schedule toggle. Done in 1 minute. |

### 11.2 Form Design Rules

**General Rules:**
1. **Save button is always visible** — don't require scroll to submit
2. **Cancel button is always visible** — don't trap admin in forms
3. **Validation on blur** — validate each field when admin leaves it, not on submit
4. **Inline errors** — error message appears below the field, not in a toast
5. **Success feedback** — toast notification only (don't redirect to a "success page")
6. **Same page on save** — after saving, show success toast and stay on the form for the next entry
7. **Tab through fields** — proper tab order, enter to submit

**Field Rules:**
- **Required fields** marked with red asterisk (*)
- **Optional fields** labeled "(optional)" — don't use asterisks for optional
- **Dropdowns with 10+ options** should have typeahead search
- **Dates** use a date picker with keyboard input support (admin may type dates)
- **Phone numbers** use input mask (automatically format as admin types)
- **Auto-capitalize** first letter of name fields

### 11.3 Form Behaviors by Type

#### Single Page Form
```
[Page Title]
[Form Fields in logical groups]
[Cancel] [Save]
```
- Used for: Teacher, Student, Principal, Class, Subject
- Save stays on page for next entry
- "Save & Add Another" option for batch entry

#### Modal Form
```
┌────────────────────────────────────────┐
│  Title                                 │
│                                        │
│  [Form Fields]                         │
│                                        │
│  [Cancel]  [Save]                      │
└────────────────────────────────────────┘
```
- Used for: Link Parent, Add Timetable Entry
- Modal closes on save
- Modal dismisses on click outside (with unsaved changes warning)

#### Multi-step Form (Import)
```
Step 1 of 5: Download Template
Step 2 of 5: Upload
Step 3 of 5: Column Mapping
Step 4 of 5: Preview
Step 5 of 5: Confirm

[Back] [Next]
```
- Step indicator at top (numbered circles)
- Back button returns to previous step (data preserved)
- Cannot skip steps
- Cancel available at any step

#### Tabbed Form (Settings)
```
[Profile] [Academic] [System]
┌──────────────────────────┐
│  Fields for selected tab │
│                          │
│  [Cancel] [Save]         │
└──────────────────────────┘
```
- Tabs at top or side
- Each tab can be saved independently
- Unsaved changes warning on tab switch

### 11.4 Form Validation Patterns

| Pattern | Implementation | Example |
|---------|---------------|---------|
| **On blur** | Validate when field loses focus | Email format validation |
| **On change (delayed)** | 500ms after last keystroke | Unique code check |
| **On submit** | Full form validation | All required fields |

**Error Message Style:**
```
┌──────────────────────┐
│  Email               │
│  ┌──────────────────┐│
│  │ invalid-email    ││  ← Red border
│  └──────────────────┘│
│  ⚠️ Enter a valid    │  ← Red text below
│     email address    │
└──────────────────────┘
```

**Success Message Style:**
```
┌──────────────────────────────────────────────────┐
│  ✅ Teacher created successfully                  │
│     [Add Another]  [View Profile]  [Dismiss]    │
│                                                  │
│  Toast — appears top right, auto-dismiss 5s      │
└──────────────────────────────────────────────────┘
```

---

## 12. Empty States

### 12.1 Empty State Design System

Every table and list page must have a meaningful empty state. No blank white page.

**Pattern:**
```
┌────────────────────────────────────────────────────────────┐
│                                                             │
│                        [Illustration]                       │
│                                                             │
│                     📋 No teachers yet                       │
│                                                             │
│      Add your first teacher to get started managing         │
│      your school's teaching staff.                          │
│                                                             │
│         [+ Add Your First Teacher]                          │
│                                                             │
│      Learn more about teacher management →                  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 12.2 Empty States by Module

| Module | Empty Title | Empty Description | CTA | Illustration |
|--------|------------|-------------------|-----|-------------|
| Teachers | "No teachers yet" | "Add your first teacher to start building your teaching staff." | [+ Add Teacher] | 👨‍🏫 |
| Students | "No students yet" | "Enroll your first student or import a batch via CSV." | [+ Add Student] or [📥 Import CSV] | 👩‍🎓 |
| Parents | "No parents linked" | "Parents are created when you add students. Link parents to students after enrollment." | — (informational) | 👪 |
| Principals | "No principal assigned" | "Set up your school's principal to grant them administrative access." | [+ Add Principal] | 👑 |
| Classes | "No classes created" | "Classes are the foundation of your school structure. Start by creating your first class." | [+ Create Class] | 🏛️ |
| Subjects | "No subjects defined" | "Define the subjects your school offers. Core subjects are marked by default." | [+ Add Subject] | 📚 |
| Academic Years | "No academic years set up" | "Define your school calendar by creating academic years and terms." | [+ Create Year] | 📅 |
| Terms | "No terms in this year" | "Add terms to organize your academic year into manageable periods." | [+ Create Term] | 📆 |
| Periods | "No time slots defined" | "Define your school day by adding periods with start and end times." | [+ Add Period] | ⏰ |
| Teacher Assignments | "No teacher assignments" | "Assign teachers to classes and subjects to enable timetable creation." | [+ Add Assignment] | 📋 |
| Timetable | "No timetable entries" | "Start building your weekly schedule after setting up classes, subjects, and teacher assignments." | [+ Add Entry] | 📅 |
| Dashboard (fresh) | "Welcome to Athon!" | "Your school is ready. Let's set it up step by step." | [Start Setup Checklist] | 🏫 |
| Announcements | "No announcements yet" | "Create your first announcement to communicate with teachers, students, or parents." | [+ Create Announcement] | 📣 |
| Reports | "No data yet" | "Reports will populate as teachers create homework, tests, and mark attendance." | — (informational) | 📊 |

### 12.3 Setup Checklist (Dashboard Empty State)

For a brand-new school with no data:

```
┌────────────────────────────────────────────────────────────┐
│  🏫 Getting Started Checklist                               │
│                                                             │
│  Complete these steps to set up your school:                │
│                                                             │
│  ☐ Step 1: Set up School Profile                           │
│  ☐ Step 2: Create Academic Year                            │
│  ☐ Step 3: Add Terms                                       │
│  ☐ Step 4: Define Periods (time slots)                     │
│  ☐ Step 5: Create Classes                                  │
│  ☐ Step 6: Define Subjects                                 │
│  ☐ Step 7: Add Teachers                                    │
│  ☐ Step 8: Assign Teachers to Classes & Subjects           │
│  ☐ Step 9: Import or Add Students                          │
│  ☐ Step 10: Build Timetable                                │
│  ☐ Step 11: Link Parents to Students                       │
│                                                             │
│  [Start Step 1: School Profile →]                          │
└────────────────────────────────────────────────────────────┘
```

---

## 13. Error Handling

### 13.1 Error Types & UX Responses

| Error Type | When | UX Response | Visual |
|------------|------|-------------|--------|
| **Validation Error** | Form submission | Inline field error + summary at form top | Red border on field + red text below |
| **Duplicate Entity** | Create/Update | Inline error on specific field + clear message | "This employee code is already assigned" |
| **Permission Error** | API call (role check) | Full page error with explanation | 🔒 "You don't have permission to perform this action" |
| **Network Error** | API call failure | Toast notification + retry option | "Connection lost. Retry?" + [Retry] button |
| **Server Error (500)** | API call fails server-side | Toast + "Something went wrong" + support contact | "An unexpected error occurred. Contact support." |
| **Conflict Error** | Timetable save | Modal with conflict details + resolution options | ⚠️ "2 conflicts found" |
| **Import Error** | CSV upload | Error report + download errors | "45 imported, 2 errors" + [Download Errors] |

### 13.2 Validation Error Patterns

**Inline Field Error:**
```
┌──────────────────────┐
│  Email               │
│  ┌──────────────────┐│
│  │ invalid-email    ││  ← Red border (1.5px, #EF4444)
│  └──────────────────┘│
│  ⚠️ Enter a valid    │  ← #EF4444, 12px, below field
│     email address    │
└──────────────────────┘
```

**Summary Error (top of form):**
```
┌──────────────────────────────────────────────────┐
│  ⚠️ Please fix 3 errors before saving             │
│  • Email is required                              │
│  • Employee code is already taken                 │
│  • Hire date cannot be in the future              │
└──────────────────────────────────────────────────┘
```

**Duplicate Detection (async):**
- Check email/employee_code/admission_number uniqueness on blur (after field loses focus)
- Show spinner/loading state while checking
- Show result immediately: ✓ Available or ✗ Already in use

### 13.3 Permission Error Page

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│                  🔒 Access Denied                      │
│                                                        │
│  You don't have permission to access this page.        │
│                                                        │
│  If you believe this is a mistake, contact your        │
│  school administrator.                                 │
│                                                        │
│  [← Go to Dashboard]                                   │
│                                                        │
└──────────────────────────────────────────────────────┘
```

### 13.4 Network Error Pattern

```
┌──────────────────────────────────────────────────┐
│  🔴 Connection Lost                               │
│                                                    │
│  We're having trouble connecting to the server.    │
│  Check your internet connection and try again.     │
│                                                    │
│  [🔄 Retry]                                        │
│                                                    │
│  Auto-retrying in 5 seconds...                     │
└──────────────────────────────────────────────────┘
```

**Behavior:**
- Show inline (not toast) for persistent data loads
- Show as toast for quick operations (save, delete)
- Auto-retry up to 3 times with exponential backoff
- After 3 failures, show "Still having trouble? [Contact Support]"

### 13.5 Conflict Error — Timetable

```
┌──────────────────────────────────────────────┐
│  ⚠️ Schedule Conflict Detected                │
│                                               │
│  This entry conflicts with:                   │
│                                               │
│  John Smith is already teaching               │
│  📘 Math → 10-A → Monday, P1                  │
│                                               │
│  You can:                                     │
│  • Choose a different period                  │
│  • Choose a different day                     │
│  • Choose a different teacher                 │
│  • Save anyway (override)                     │
│                                               │
│  [Edit Entry]           [Save Anyway]        │
└──────────────────────────────────────────────┘
```

### 13.6 Import Failure Pattern

After import completes (partial or total failure):

```
┌──────────────────────────────────────────────────────┐
│  ✅ 45 students imported successfully                  │
│  ⚠️ 2 rows skipped due to errors                      │
│                                                        │
│  Error Summary:                                        │
│  ┌─────────────┬──────────┬────────────────────────┐ │
│  │ Row         │ Field    │ Error                   │ │
│  ├─────────────┼──────────┼────────────────────────┤ │
│  │ #23         │ Email    │ Invalid email format    │ │
│  │ #47         │ Class    │ "10-Z" not found        │ │
│  └─────────────┴──────────┴────────────────────────┘ │
│                                                        │
│  [📥 Download Full Error Report]                       │
│  [View Imported Students]    [Import More]            │
└──────────────────────────────────────────────────────┘
```

---

## 14. Design System Planning

### 14.1 Color Palette

```
Primary (Actions & Identity)
  - 50:  #EFF6FF
  - 100: #DBEAFE
  - 200: #BFDBFE
  - 300: #93C5FD
  - 400: #60A5FA
  - 500: #3B82F6  ← Primary buttons, links, active states
  - 600: #2563EB  ← Hover states
  - 700: #1D4ED8  ← Pressed states
  - 800: #1E40AF
  - 900: #1E3A8A

Secondary (Success & Completion)
  - 500: #10B981  ← Success, present, graded
  - 600: #059669  ← Hover

Warning
  - 500: #F59E0B  ← Pending, late, warning alerts
  - 600: #D97706  ← Hover

Danger
  - 500: #EF4444  ← Errors, absent, destructive actions
  - 600: #DC2626  ← Hover

Info
  - 500: #6366F1  ← Informational, in-progress

Neutrals
  - 50:  #F8FAFC  ← Page background
  - 100: #F1F5F9  ← Sidebar, card backgrounds
  - 200: #E2E8F0  ← Borders, dividers
  - 300: #CBD5E1  ← Disabled states
  - 400: #94A3B8  ← Placeholder text, muted labels
  - 500: #64748B  ← Secondary text
  - 600: #475569  ← Body text
  - 700: #334155  ← Subheadings
  - 800: #1E293B  ← Headings
  - 900: #0F172A  ← Highest emphasis text

Status Colors
  - Active:       #10B981  (green)
  - Inactive:     #94A3B8  (gray)
  - Present:      #10B981  (green)
  - Absent:       #EF4444  (red)
  - Late:         #F59E0B  (amber)
  - Half Day:     #8B5CF6  (purple)
  - Graded:       #10B981  (green)
  - Pending:      #F59E0B  (amber)
  - In Progress:  #6366F1  (indigo)
  - Core Subject: #3B82F6  (blue)
  - Elective:     #8B5CF6  (purple)

Table-Specific Colors
  - Hover row:    #F8FAFC
  - Selected row: #EFF6FF
  - Stripe:       #FAFBFC (alternating rows)
  - Border:       #E2E8F0
  - Header bg:    #F8FAFC
```

### 14.1.5 Chart Color Scheme

Charts appear in KPIs (capacity utilization bar), dashboard trends (attendance mini chart), and reports (score distribution).

```
Chart Colors (ordered by usage priority):
  ┌──────────┬────────────┬──────────────────────────────────────────┐
  │ Series   │ Color      │ Usage                                    │
  ├──────────┼────────────┼──────────────────────────────────────────┤
  │ Primary  │ #3B82F6   │ Main data series (attendance %, scores)   │
  │ Secondary│ #10B981   │ Comparison series, positive indicators    │
  │ Tertiary │ #F59E0B   │ Warning indicators, pending metrics       │
  │ Contrast │ #8B5CF6   │ Third comparison series                   │
  │ Negative │ #EF4444   │ Negative indicators, absences             │
  │ Neutral  │ #94A3B8   │ Baseline, target line, reference          │
  └──────────┴────────────┴──────────────────────────────────────────┘

Chart Specifications:
  - Bar chart (horizontal): height 24px per bar, rounded corners 4px
  - Bar chart (vertical): height 200px (dashboard), 300px (reports)
  - Line chart: stroke 2px, dot radius 4px on hover
  - Pie/donut chart: donut thickness 24px, center label 18px/700
  - Mini chart (dashboard inline): height 60px, width 100% of parent
  
Chart States:
  - Loading: Skeleton rectangle matching chart dimensions
  - Empty: Centered label "No data for this period" + muted icon
  - Error: Centered label "Failed to load chart" + retry icon button
  - Single data point: Show the point with a note "Only 1 data point"
  
Chart Axes:
  - X-axis labels: 11px/400/#64748B
  - Y-axis labels: 11px/400/#64748B
  - Grid lines: dashed 1px #E2E8F0
  - Tooltip: bg #FFF, border-radius 6px, shadow md, padding 8px 12px
```

### 14.2 Typography

```
Font Family: Inter (sans-serif)
Fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

Web Scale:
  ┌──────────────┬────────┬──────────┬──────┬──────────────────────┐
  │ Style        │ Size   │ Line Ht  │ Wt   │ Usage                │
  ├──────────────┼────────┼──────────┼──────┼──────────────────────┤
  │ H1           │ 28px   │ 36px     │ 700  │ Page titles          │
  │ H2           │ 22px   │ 28px     │ 600  │ Section headers      │
  │ H3           │ 18px   │ 24px     │ 600  │ Card titles          │
  │ H4           │ 16px   │ 22px     │ 600  │ Modal titles         │
  │ Body         │ 14px   │ 20px     │ 400  │ Table cells, content │
  │ Body Small   │ 12px   │ 16px     │ 400  │ Metadata, captions   │
  │ Label        │ 14px   │ 20px     │ 500  │ Form labels          │
  │ Button       │ 14px   │ 20px     │ 600  │ Button text          │
  │ Badge        │ 11px   │ 14px     │ 600  │ Status badges        │
  │ Stat Number  │ 28px   │ 36px     │ 700  │ KPI card numbers     │
  │ Sidebar Item│ 14px   │ 20px     │ 500  │ Navigation items     │
  │ Table Header │ 12px   │ 16px     │ 600  │ Column headers       │
  │ Table Cell   │ 14px   │ 20px     │ 400  │ Cell content         │
  │ Code         │ 13px   │ 18px     │ 400  │ Employee codes, IDs  │
  └──────────────┴────────┴──────────┴──────┴──────────────────────┘
```

### 14.3 Spacing & Grid

```
Spacing Scale (4px base):
  ┌─────────┬────────┬──────────────────────────┐
  │ Token   │ Pixels │ Usage                    │
  ├─────────┼────────┼──────────────────────────┤
  │ 1       │ 4px    │ Icon padding             │
  │ 2       │ 8px    │ Inner card padding       │
  │ 3       │ 12px   │ Button padding           │
  │ 4       │ 16px   │ Card padding, form gap   │
  │ 5       │ 20px   │ Section padding          │
  │ 6       │ 24px   │ Component gap            │
  │ 8       │ 32px   │ Page margin              │
  │ 10      │ 40px   │ Major section gap        │
  │ 12      │ 48px   │ Page padding (top)       │
  │ 16      │ 64px   │ Page sections            │
  └─────────┴────────┴──────────────────────────┘

Web Grid:
  - 12-column grid
  - Gutter: 24px
  - Max width: 1440px
  - Min margin: 32px (desktop), 16px (tablet)
  - Breakpoints: 1280px (desktop), 1024px (tablet), 768px (mobile)

Layout Patterns:
  Dashboard: 4-column KPI row → 2-column (alerts + quick actions) → 1-column (activity)
  Table page: Full-width (12 columns) for data density
  Profile page: 4-column sidebar + 8-column content
  Form page: 6-column centered (max 720px width)
  Settings: 4-column tabs + 8-column content
```

### 14.4 Shadows

```
  ┌──────────────┬──────────────────────┬────────────────────┐
  | Token        | Elevation            | Usage              |
  ├──────────────┼──────────────────────┼────────────────────┤
  | sm           | 0 1px 2px 0         | Cards, input states |
  | md           | 0 4px 6px -2px      | Dropdowns, modals  |
  | lg           | 0 10px 15px -3px    | Sidebar, dialogs   |
  | xl           | 0 20px 25px -5px    | Toast, full modals |
  └──────────────┴──────────────────────┴────────────────────┘
  All shadows use rgba(0, 0, 0, 0.05) with rgba(0, 0, 0, 0.1) for second value
```

### 14.5 Component Specifications

#### Tables
```
  ┌─────────────────────────────────────────────┐
  │ Header: bg #F8FAFC, text #64748B, 12px/600 │
  ├─────────────────────────────────────────────┤
  │ Cell: bg #FFF, text #334155, 14px/400       │
  │ Border: bottom #E2E8F0, 1px                │
  │ Hover: bg #F8FAFC                           │
  │ Selected: bg #EFF6FF                        │
  │ Stripe: bg #FAFBFC (every other row)        │
  │ Height: 48px (standard row)                 │
  └─────────────────────────────────────────────┘
```

#### Buttons
```
  ┌──────────────┬──────────┬──────────┬────────┬──────────┐
  │ Variant      | bg       | text     | border | hover    │
  ├──────────────┼──────────┼──────────┼────────┼──────────┤
  | Primary      | #3B82F6  | #FFF     | none   | #2563EB  │
  | Secondary    | #FFF     | #334155  | #E2E8F0| #F8FAFC  │
  | Ghost        | transparent| #475569| none   | #F1F5F9  │
  | Danger       | #EF4444  | #FFF     | none   | #DC2626  │
  | Icon         | transparent| #64748B| none   | #F1F5F9  │
  └──────────────┴──────────┴──────────┴────────┴──────────┘
  
  Sizes:
    - sm: 32px height, 8px horizontal padding
    - md: 40px height, 16px horizontal padding (default)
    - lg: 48px height, 24px horizontal padding
  
  States: default, hover, pressed (scale 0.98), disabled (opacity 0.5), loading (spinner icon)
```

#### Inputs
```
  ┌──────────┬──────────┬──────────┬───────────┐
  │ State    | border   | bg       | text      │
  ├──────────┼──────────┼──────────┼───────────┤
  │ Default  | #E2E8F0  | #FFF     | #334155   │
  │ Focus    | #3B82F6  | #FFF     | #334155   │
  │ Error    | #EF4444  | #FFF     | #334155   │
  │ Disabled | #E2E8F0  | #F8FAFC  | #94A3B8   │
  │ Readonly | #E2E8F0  | #F8FAFC  | #475569   │
  └──────────┴──────────┴──────────┴───────────┘
  
  Height: 40px (default), 32px (sm), 48px (lg)
  Border radius: 6px (all inputs)
  Padding: 12px horizontal, 8px vertical
```

#### Cards
```
  Dashboard KPI Card:
    - bg: #FFF
    - border radius: 8px
    - shadow: sm (0 1px 2px 0 rgba(0,0,0,0.05))
    - padding: 16px
    - title: 12px/600/#64748B
    - number: 28px/700/#0F172A
  
  Dashboard Alert Card:
    - Same as KPI but with left border color (red for critical, amber for warning, blue for info)
    
  Quick Action Card:
    - Same as KPI but hover: shadow md, cursor pointer, border #3B82F6
    - Icon + text layout
```

#### Modals
```
  ┌──────────────────────────────────┐
  │ Overlay: bg rgba(0,0,0,0.5)     │
  │                                  │
  │ ┌────────────────────────────┐   │
  │ │ Modal: bg #FFF             │   │
  │ │ Border radius: 12px        │   │
  │ │ Shadow: lg                 │   │
  │ │ Max width: 480px           │   │
  │ │                           │   │
  │ │ Title: 16px/600            │   │
  │ │ Content: 14px/400          │   │
  │ │ Footer: bg #F8FAFC          │   │
  │ └────────────────────────────┘   │
  └──────────────────────────────────┘
```

### 14.6 Icon System

- **Library**: Lucide Icons (open-source, consistent)
- **Style**: Outline, 1.5px stroke, 24px default
- **Sizes**: 16px (table inline), 20px (sidebar), 24px (default), 32px (empty state hero)

**Admin-Specific Icon Map:**
| Concept | Icon |
|---------|------|
| Dashboard | layout-dashboard |
| Teachers | users, user-plus, user-check |
| Students | graduation-cap, user-plus |
| Parents | users, user-circle |
| Principals | crown, user-circle |
| Classes | building-2 |
| Subjects | book-open, book |
| Academic Year | calendar |
| Terms | calendar-check |
| Periods | clock |
| Timetable | calendar-range, calendar-clock |
| Reports | file-bar-chart, file-text |
| Settings | settings, sliders |
| School | building-2, school |
| Search | search |
| Filter | filter |
| Export | download |
| Import | upload |
| Add | plus-circle |
| Edit | pencil |
| Delete | trash-2 |
| Deactivate | user-x |
| Link | link-2 |
| Alert | alert-triangle, alert-circle, info |
| Success | check-circle-2 |
| Loading | loader-2 (with spin animation) |

---

## 15. Responsive Strategy

### 15.1 Breakpoints

| Device | Breakpoint | Grid Columns | Layout Behavior |
|--------|:----------:|:------------:|-----------------|
| Desktop XL | > 1440px | 12 | Full layout, max-width: 1440px centered |
| Desktop | 1280px–1440px | 12 | Full layout, no max-width constraint |
| Laptop | 1024px–1280px | 12 | Sidebar collapsed to icon-only (64px) |
| Tablet (landscape) | 768px–1024px | 8 | Sidebar hidden (hamburger), tables horizontal scroll |
| Mobile | < 768px | 4 | Sidebar hidden, single column, stacked layout |

### 15.2 Desktop/Laptop (1024px+)

**Primary target for School Admin.** Full experience.

- **Sidebar**: Always visible, 280px width. On laptop (1024–1280), collapse to icon-only (64px) with tooltips.
- **Content area**: Full remaining width
- **Tables**: Full horizontal, no scroll needed
- **Dashboard**: 4-column KPI row → 2-column middle section → 1-column bottom
- **Forms**: Never more than 2 columns for inputs
- **Grid**: 12-column with 24px gutter

### 15.3 Tablet (768px–1024px)

**Secondary usage.** Admin may use tablet for light tasks (verification, quick edits).

- **Sidebar**: Hidden by default. Access via hamburger menu (top-left).
- **Content**: Single column with 16px margins
- **Tables**: Horizontal scroll enabled. Pin first column (Name) on scroll.
- **Dashboard**: 2-column KPI row → single column below
- **Forms**: Single column for all inputs
- **Action bars**: Move from top-right to below the title
- **Modals**: Full-width (margin: 16px on each side)

### 15.4 Mobile (< 768px)

**Emergency/Casual usage.** Admin may check something on phone.

- **Sidebar**: Hidden. Full-screen overlay when opened.
- **Content**: Single column, 16px margins
- **Tables**: Minimized view. Show 3–4 key columns. Rest accessible via row expansion.
- **Dashboard**: Single column stack
- **Forms**: Single column, full-width inputs
- **Buttons**: Full-width, 48px height (touch-friendly)
- **Modals**: Full-screen with close button
- **Pagination**: "Load More" instead of page numbers
- **Search**: Always visible at top
- **Filter**: Access via "Filters" button that opens bottom sheet

### 15.5 Specific Component Behaviors by Breakpoint

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| Sidebar | 280px, always visible | Hidden, hamburger | Hidden, overlay |
| Data Table | Full columns | Horizontal scroll, pin first column | 3–4 columns + row expansion |
| Dashboard KPIs | 4 columns | 2 columns | 1 column (stacked) |
| Dashboard Alerts | 2-column | 2-column | 1-column |
| Form Layout | 2-column inputs | 1–2 column inputs | 1 column |
| Timetable Grid | Full week view | 3-day scrollable | Single day (swipeable) |
| Modals | Centered, 480px max | Centered, 80% width | Full-screen |
| Action Buttons | Inline (top-right) | Inline | Full-width at bottom |
| Search Bar | 320px width | Full width | Full width |
| Filter Chips | Inline row | Wrapping row | Wrapping row |
| Pagination | Page numbers | Page numbers + Load More | Load More |

---

## 16. Figma Structure

### 16.1 Project Structure

```
ATHON ADMIN WEB PORTAL
│
├── 00 🏫 Cover
│   ├── Cover Page (Logo, Tagline, "School Admin Web Portal v1.0")
│   ├── Project Info (Version, Date, Designer, Stakeholders)
│   ├── Changelog
│   └── Links (UX Blueprint, Backend API Docs, User Research)
│
├── 01 🎨 Design Foundations
│   ├── Colors (Primary, Neutral, Status, Table-specific)
│   ├── Typography (Web scale table with all styles)
│   ├── Spacing (4px scale with examples)
│   ├── Grid (12-column layout at 1280px, 1024px, 768px)
│   ├── Shadows (sm, md, lg, xl with examples)
│   ├── Icons (Complete icon inventory with sizes)
│   └── Logo Usage (School logo placement, favicon)
│
├── 02 🧩 Core Components
│   ├── Buttons (All variants: Primary, Secondary, Ghost, Danger, Icon)
│   │   ├── Sizes: sm, md, lg
│   │   └── States: Default, Hover, Pressed, Disabled, Loading
│   ├── Inputs (Text, Email, Password, Number, Search, Date, Phone)
│   │   └── States: Default, Focus, Error, Disabled, Readonly
│   ├── Dropdowns (Single, Multi-select, Searchable)
│   ├── Date Pickers (Single, Range)
│   ├── Toggles & Checkboxes & Radios
│   ├── Badges (Status, Count, Dot, Pill)
│   ├── Avatars (User, Initials, School logo — sm, md, lg)
│   └── Loading Skeleton (Table, Card, List, Detail)
│
├── 03 📊 Data Display
│   ├── Tables
│   │   ├── Table — Simple (default)
│   │   ├── Table — Selectable (with checkboxes + bulk bar)
│   │   ├── Table — Expandable rows
│   │   ├── Table — Empty state
│   │   ├── Table — Loading state (skeleton)
│   │   ├── Table — Error state
│   │   ├── Table — with inline actions
│   │   └── Table responsive variants (tablet, mobile)
│   ├── Cards
│   │   ├── KPI Card (dashboard stat)
│   │   ├── Alert Card (with severity color)
│   │   ├── Quick Action Card (clickable)
│   │   └── Profile Card (user detail)
│   ├── Chips & Tags (Filter chip, Status chip, Entity tag)
│   └── Timeline (Activity feed, Enrollment history)
│
├── 04 📋 Forms & Inputs
│   ├── Single Column Form (with validation)
│   ├── Two Column Form (with validation)
│   ├── Modal Form (with context preservation)
│   ├── Multi-Step Form (Import Wizard)
│   ├── Tabbed Form (Settings)
│   ├── Search Bar (with filters)
│   └── File Upload (CSV import zone)
│
├── 05 🧭 Navigation
│   ├── Sidebar — Expanded (280px)
│   ├── Sidebar — Collapsed (64px icons)
│   ├── Sidebar — Mobile Overlay
│   ├── Breadcrumbs
│   ├── Page Header (title + actions)
│   ├── Tabs (Horizontal tab bar)
│   └── Command Palette (Ctrl+K)
│
├── 06 🔔 Feedback & States
│   ├── Toasts (Success, Error, Warning, Info)
│   ├── Modals (Confirmation, Form, Full-screen)
│   ├── Alert Banners (Inline page alerts)
│   ├── Empty States (All 12 module empty states)
│   ├── Error States (Permission, Network, Server)
│   ├── Loading States (Page load, Section load, Action load)
│   └── Confirmation Dialogs (Delete, Deactivate, Bulk action)
│
├── 07 💻 Dashboard
│   ├── Dashboard — With Data (Default)
│   ├── Dashboard — With Alerts
│   ├── Dashboard — Empty (Fresh school setup)
│   ├── KPI Cards (4 variants with different data)
│   ├── Alerts Section (Critical, Warning, Info)
│   ├── Quick Actions (4 cards)
│   └── Activity Feed (List items)
│
├── 08 👥 User Management
│   ├── Teachers List (with search, filters, bulk actions)
│   ├── Create Teacher (form + validation states)
│   ├── Edit Teacher (pre-filled form)
│   ├── Teacher Profile (full detail view + assignments)
│   ├── Teacher Assignments (filter + table + add modal)
│   ├── Deactivate Teacher (confirmation)
│   ├── Students List (with class filter, bulk actions)
│   ├── Create Student (form + auto-generate options)
│   ├── Edit Student (pre-filled + class change)
│   ├── Student Profile (profile + enrollment history + parents)
│   ├── Student Import (all 5 steps: template, upload, map, preview, confirm)
│   ├── Parents List (search + linked students)
│   ├── Link Parent (modal with search)
│   ├── Create Parent (quick-create drawer)
│   ├── Principals List
│   ├── Create Principal (form)
│   └── Edit Principal (pre-filled form)
│
├── 09 🏛️ Academic Management
│   ├── Classes List (with filters, capacity bar)
│   ├── Create Class (form)
│   ├── Edit Class (pre-filled form)
│   ├── Class Detail (stats + students + teachers + timetable)
│   ├── Subjects List (with core/elective badge)
│   ├── Create Subject (form)
│   ├── Academic Years List (with current year highlight)
│   ├── Create Academic Year (form)
│   ├── Edit Academic Year (form)
│   ├── Terms List (year context header)
│   ├── Create Term (form)
│   ├── Edit Term (form)
│   ├── Periods List (with time & duration)
│   ├── Create Period (form)
│   └── Edit Period (form)
│
├── 10 📋 Timetable Builder
│   ├── Timetable Grid — Class View (default)
│   ├── Timetable Grid — Teacher View
│   ├── Timetable Grid — Empty (no entries)
│   ├── Add Entry Modal (with smart filters)
│   ├── Edit Entry Modal (pre-filled)
│   ├── Delete Entry Confirmation
│   ├── Conflict Report (modal with fix links)
│   ├── Conflict Toast (inline save conflict)
│   ├── Copy From Previous Term (confirmation)
│   └── Clear Term (danger confirmation)
│
├── 11 ⚙️ Settings
│   ├── School Profile (tab)
│   ├── Academic Configuration (tab)
│   ├── System Preferences (tab)
│   ├── Logo Upload (with preview)
│   ├── Unsaved Changes Warning
│   └── Success Toast (settings saved)
│
├── 12 📈 Reports (Read-Only)
│   ├── Attendance Report
│   ├── Homework Report
│   ├── Test Report
│   └── Export Modal (CSV download)
│
├── 13 🔐 Auth & Onboarding
│   ├── Login Page
│   ├── Forgot Password
│   ├── Session Timeout Warning
│   └── Permission Denied Page
│
├── 14 🔬 Interaction Prototypes
│   ├── Full Teacher Onboarding Flow
│   │   (Dashboard → Create Teacher → Profile → Assignments)
│   ├── Full Student Import Flow
│   │   (Dashboard → Import → Upload → Map → Preview → Confirm)
│   ├── Full Timetable Setup Flow
│   │   (Settings: Year → Terms → Periods → Classes → Subjects → Teachers → Assignments → Timetable)
│   ├── New Student Enrollment Flow
│   │   (Create Student → Select Class → Link Parent → Done)
│   ├── Table Interaction Prototype
│   │   (Search → Filter → Sort → Select → Bulk Action)
│   └── Responsive Behavior Prototype
│       (Desktop → Tablet → Mobile transitions)
│
├── 15 📐 Design Specs & Handoff
│   ├── Component Specs (padding, margins, colors, typography per component)
│   ├── Redlines (Key screens with measurements)
│   ├── Spacing Examples (Page layout, section spacing)
│   ├── Accessibility Checklist
│   │   ├── Color contrast ratios (WCAG AA)
│   │   ├── Touch targets (44×44px minimum)
│   │   ├── Focus states (visible focus ring)
│   │   ├── Screen reader labels
│   │   └── Keyboard navigation order
│   ├── Developer Handoff Notes
│   │   ├── API endpoint mappings per screen
│   │   ├── State handling expectations
│   │   ├── Loading/empty/error requirements
│   │   └── Responsive breakpoint behaviors
│   └── Export Assets (Icons, Logo, Favicon)
│
└── 16 📋 UX Research & Archive
    ├── User Personas (School Admin archetypes)
    ├── User Flow Diagrams (Complete task flows)
    ├── Competitive Analysis (School management software review)
    ├── Edge Cases Document
    └── Usability Test Scripts
```

### 16.2 Page Naming Convention

**Format:** `[Page #] [Screen Name] — [State]`

Examples:
- `08.01 Teachers List — Default`
- `08.01 Teachers List — Empty`
- `08.01 Teachers List — With Search Results`
- `08.01 Teachers List — Bulk Selection Active`
- `08.02 Create Teacher — Default`
- `08.02 Create Teacher — Validation Errors`

### 16.3 Component Naming Convention

**Format:** `Component / Variant / State`

Examples:
- `Buttons / Primary / Hover`
- `Buttons / Danger / Disabled`
- `Tables / Selectable / With Selected Rows`
- `Inputs / Text / Error State`

### 16.4 Design Handoff Deliverables

| Deliverable | Format | Contents |
|-------------|--------|----------|
| Component Specs | Figma "Inspect" + annotations | Padding, margin, font size/weight/color |
| Redlines | Figma with measurement lines | Key screen measurements |
| State Matrix | Figma table per component | All states (default, hover, focus, error, disabled) |
| Responsive Behavior | Figma with constraints | How each component responds at each breakpoint |
| Accessibility Notes | Figma annotations | Contrast ratios, focus order, aria labels |
| Developer Notes | Figma page (15) | API mappings, state expectations, edge cases |

---

## Appendix A: API Endpoint Mapping by Screen

| Screen | API Endpoints |
|--------|---------------|
| Dashboard | `GET /dashboard/admin` |
| Teachers List | `GET /teachers` |
| Teacher Create/Edit | `POST /teachers`, `PATCH /teachers/{id}` |
| Teacher Profile | `GET /teachers/{id}` |
| Teacher Deactivate | `DELETE /teachers/{id}` |
| Teacher Assignments | `GET /teacher-assignments`, `POST /teacher-assignments`, `DELETE /teacher-assignments/{id}` |
| Students List | `GET /students` |
| Student Create/Edit | `POST /students`, `PATCH /students/{id}` |
| Student Profile | `GET /students/{id}` |
| Student Import | `POST /students/import` |
| Student Enroll/Promote | `PATCH /students/{id}` (class_id change creates enrollment) |
| Parents List | `GET /parents` (P2 — currently partial) |
| Link Parent | `POST /student-parents` |
| Principals List | `GET /principals` |
| Principal Create/Edit | `POST /principals`, `PATCH /principals/{id}` |
| Classes List | `GET /classes` |
| Class Create/Edit | `POST /classes`, `PATCH /classes/{id}` |
| Class Detail | `GET /classes/{id}` |
| Subjects List | `GET /subjects` |
| Subject Create | `POST /subjects` |
| Academic Years List | `GET /academic-years` |
| Academic Year Create/Edit | `POST /academic-years`, `PATCH /academic-years/{id}` |
| Terms List | `GET /academic-terms` |
| Term Create/Edit | `POST /academic-terms`, `PATCH /academic-terms/{id}` |
| Periods List | `GET /periods` |
| Period Create/Edit | `POST /periods`, `PATCH /periods/{id}` |
| Timetable Grid | `GET /timetable/class/{id}`, `GET /timetable/teacher/{id}`, `GET /timetable/today` |
| Timetable Add Entry | `POST /timetable/entries` |
| Timetable Edit Entry | `PATCH /timetable/entries/{id}` |
| Timetable Delete Entry | `DELETE /timetable/entries/{id}` |
| School Settings | `GET /schools/{id}`, `PATCH /schools/{id}` |
| Reports | `GET /reports/attendance`, `GET /reports/homework`, `GET /reports/tests` |

## Appendix B: Permission Matrix

| Action | school_admin | super_admin |
|--------|:------------:|:-----------:|
| View Dashboard | ✅ | ✅ |
| CRUD Teachers | ✅ | ✅ |
| CRUD Students | ✅ | ✅ |
| Import Students | ✅ | ✅ |
| Link Parents | ✅ | ✅ |
| CRUD Principals | ✅ | ✅ |
| CRUD Classes | ✅ | ✅ |
| CRUD Subjects | ✅ | ✅ |
| CRUD Academic Years | ✅ | ✅ |
| CRUD Terms | ✅ | ✅ |
| CRUD Periods | ✅ | ✅ |
| CRUD Teacher Assignments | ✅ | ✅ |
| CRUD Timetable Entries | ✅ | ✅ |
| Edit School Settings | ✅ | ✅ |
| View Reports | ✅ | ✅ |
| Manage Announcements | ✅ | ✅ |
| Send Notifications | ✅ | ✅ |
| View Audit Logs | ✅ | ✅ |

*Note: super_admin has cross-school access. school_admin is scoped to their own school.*

## Appendix C: Estimated Design Effort

| Section | Screens | Complexity | Est. Figma Time |
|---------|:-------:|:----------:|:----------------:|
| Foundations | — | Medium | 2 days |
| Core Components | 50+ components | High | 5 days |
| Dashboard | 3 variants | Medium | 1.5 days |
| Teachers | 6 screens | High | 3 days |
| Students | 8 screens | Very High | 4 days |
| Parents | 3 screens | Low | 1 day |
| Principals | 3 screens | Low | 1 day |
| Classes | 4 screens | Medium | 2 days |
| Subjects | 2 screens | Low | 0.5 day |
| Academic Calendar | 6 screens | Medium | 2 days |
| Periods | 3 screens | Low | 1 day |
| Timetable Builder | 10+ states | Very High | 5 days |
| Settings | 3 tabs + states | Medium | 2 days |
| Reports | 3 report types | Medium | 2 days |
| Auth & Onboarding | 3 screens | Low | 1 day |
| Prototypes | 6 flows | High | 4 days |
| Specs & Handoff | — | Medium | 2 days |
| **Total** | **~55 screens** | | **~38 days** |

---

*End of School Admin Web Portal UX Architecture Blueprint — Ready for Figma Design*
