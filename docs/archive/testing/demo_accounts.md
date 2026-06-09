# ATHON — DEMO ACCOUNTS
**Date:** June 10, 2026
**Note:** These accounts must be created via the seed script. They are NOT hardcoded login credentials.

---

## ACCOUNT SETUP

Demo accounts are created by running the backend seed scripts:
```
cd backend
python scripts/create_demo_user.py
```

Or via the admin onboarding UI:
1. Login as `school_admin`
2. Navigate to `/users/teachers` → Add Teacher
3. Navigate to `/users/students` → Add Student
4. Navigate to `/users/parents` → Add Parent

---

## ROLE ACCOUNTS

### Admin Account (school_admin)
| Field | Value |
|-------|-------|
| **Role** | School Admin |
| **Email** | Set during seed |
| **Password** | Set during seed |
| **Permissions** | Full access to all admin pages |
| **Can Create** | Teachers, students, parents, classes, subjects, assignments, timetable |
| **Note** | Admin must be linked to a school |

### Principal Account
| Field | Value |
|-------|-------|
| **Role** | Principal |
| **Email** | Set during seed |
| **Password** | Set during seed |
| **Permissions** | Dashboard, academic views, reports, announcements |
| **Can Create** | Announcements |
| **Restricted** | Cannot manage users, settings, assignments |

### Teacher Account
| Field | Value |
|-------|-------|
| **Role** | Teacher |
| **Email** | Set during seed |
| **Password** | Set during seed |
| **Permissions** | Attendance, homework (create + grade), tests (create), timetable view |
| **Can Create** | Homework, tests, announcements (class-specific) |
| **Restricted** | Cannot manage users, settings, academic terms |

### Student Account
| Field | Value |
|-------|-------|
| **Role** | Student |
| **Email** | Set during seed |
| **Password** | Set during seed |
| **Permissions** | View/submit homework, attempt tests, view announcements |
| **Can Create** | Nothing (read-only + submissions) |
| **Restricted** | Cannot create anything, no admin access |

### Parent Account
| Field | Value |
|-------|-------|
| **Role** | Parent |
| **Email** | Set during seed |
| **Password** | Set during seed |
| **Permissions** | View homework, tests, attendance, announcements |
| **Can Create** | Nothing (read-only) |
| **Restricted** | Cannot create anything. **Dashboard 403** (known P0 bug) |

---

## TESTING LOGIN

### Login URL
`http://localhost:3000/login`

### Authentication Flow
1. Enter email + password
2. Frontend calls `POST /auth/login`
3. Backend authenticates via Supabase Auth
4. Returns JWT + user profile
5. Frontend stores in Zustand (persisted to localStorage)
6. Redirects to `/dashboard`

### Important Notes
- **Supabase Auth** must be running. Users must exist in `auth.users` table.
- The backend `scripts/sync_auth_users.py` script syncs local auth users with Supabase.
- The backend `scripts/setup_database.py` script creates initial database structure.
- The backend `scripts/create_demo_user.py` script creates a single demo user.

### Known Login Issues
| Issue | Description | Workaround |
|-------|-------------|------------|
| Supabase not configured | Login returns 401 | Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in .env |
| User not synced | Auth succeeds but user not in `users` table → 401 "Account not found" | Run `sync_auth_users.py` |

### Quick Test Checklist
- [ ] Admin login succeeds → sees admin dashboard
- [ ] Principal login succeeds → sees principal dashboard
- [ ] Teacher login succeeds → sees teacher dashboard
- [ ] Student login succeeds → sees student dashboard
- [ ] Parent login succeeds → sees 403 (known bug)
- [ ] Invalid credentials → error message shown
- [ ] Already logged in → auto-redirect to /dashboard

---

*End of Demo Accounts Document*
