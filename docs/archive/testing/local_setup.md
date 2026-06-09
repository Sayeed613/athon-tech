# Athon — Local Setup & Startup Guide

**Verified**: June 9, 2026
**Status**: ✅ Verified Working

---

## Prerequisites

| Dependency | Version | Check Command |
|-----------|---------|---------------|
| Python | >= 3.12 | `python --version` |
| Node.js | >= 18 | `node --version` |
| PostgreSQL | 16+ | Remote (Supabase) |
| Redis (optional) | 7+ | For Celery jobs |

---

## Backend Setup

### 1. Environment Configuration

Create `backend/.env`:

```env
SUPABASE_URL=https://uekuowqjuciqogwasmtm.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.uekuowqjuciqogwasmtm.supabase.co:5432/postgres
```

> Keys are available from the Supabase project dashboard under Settings → API.

### 2. Install Dependencies

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows (Command Prompt):
.venv\Scripts\activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Or install from pyproject.toml
pip install -e .
```

### 3. Database Setup

```bash
# Option A: Run SQL files directly against Supabase PostgreSQL
cd backend
python scripts/setup_database.py

# Option B: Use Alembic migrations
cd backend
alembic upgrade head
```

### 4. Seed Data

```bash
cd backend
python seed_data.py
```

This creates:
- 1 School
- 1 School Admin (admin@athondemo.edu)
- 1 Principal (jane.doe@athondemo.edu)
- 10 Teachers
- 50 Students
- 50 Parents
- 8 Classes
- 8 Subjects
- Timetable entries, attendance records, homework, tests

### 5. Sync Auth Users to Supabase

```bash
cd backend
python scripts/sync_auth_users.py
```

This creates/updates users in Supabase Auth so they can log in with password: **Athon2025!**

### 6. Start Backend Server

```bash
cd backend
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**URL**: http://localhost:8000
**Swagger Docs**: http://localhost:8000/docs
**Health Check**: http://localhost:8000/api/v1/health

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Environment Configuration

Create `web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 3. Start Dev Server

```bash
cd web
npm run dev
```

**URL**: http://localhost:3000

### 4. Production Build

```bash
cd web
npm run build
npm start
```

---

## Verified URLs

| Service | URL | Status |
|---------|-----|--------|
| Frontend (Dev) | http://localhost:3000 | ✅ Verified |
| Backend API | http://localhost:8000 | ✅ Verified |
| Swagger Docs | http://localhost:8000/docs | ✅ (auto-generated) |
| Health Check | http://localhost:8000/api/v1/health | ✅ Returns `{"status":"healthy"}` |

---

## Demo Credentials

All accounts use password: **`Athon2025!`**

| Role | Email | Status |
|------|-------|--------|
| **School Admin** | `admin@athondemo.edu` | ✅ Tested |
| **Principal** | `jane.doe@athondemo.edu` | ✅ Tested |
| **Teacher** | `tina.teacher@athondemo.edu` | ✅ Tested |
| **Student** | `olivia.smith@athondemo.edu` | ✅ Tested |
| **Parent** | `robert.smith@athondemo.edu` | ✅ Tested |

---

## Common Failure Fixes

### Backend won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: No module named 'app'` | Not in backend directory | `cd backend` before running uvicorn |
| `Connection refused on database` | Wrong DATABASE_URL | Check Supabase credentials in .env |
| `Cannot import name 'xxx'` | Missing dependency | `pip install -r requirements.txt` |
| Port 8000 in use | Another server running | `netstat -ano \| findstr :8000`, then `taskkill /F /PID <PID>` |

### Login fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Invalid email or password` | Wrong password or user not in Supabase Auth | Run `python scripts/sync_auth_users.py` |
| `401 Account not found` | User in Supabase but not in local users table | Run `python seed_data.py` to seed local users |
| `User not found` | supabase_user_id mismatch | Login endpoint now syncs by email, but re-seeding may help |

### Frontend won't build

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Another next build process is running` | Stale build lock | Delete `.next/trace` and `.next/cache` |
| TypeScript errors | Type mismatches | Check `web/src/types/` for type definitions |
| Module not found | Missing dependency | `npm install` |

### Database issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Missing `announcements` table | Alembic migration not run | Create table manually or run `alembic upgrade head` |
| `ON CONFLICT` errors | Data already exists | Run `seed_data.py` (it truncates first) |
| Wrong data | Stale seed | Run `python seed_data.py` to re-seed |

---

## Server Commands Reference

```bash
# Start backend with auto-reload (development)
cd backend && .venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start backend without reload (production)
cd backend && .venv/Scripts/uvicorn app.main:app --host 0.0.0.0 --port 8000

# Start frontend dev server
cd web && npm run dev

# Build frontend for production
cd web && npm run build

# Re-seed database
cd backend && python seed_data.py

# Sync auth users
cd backend && python scripts/sync_auth_users.py

# Create a single demo user
cd backend && python scripts/create_demo_user.py

# Run SQL setup from scratch
cd backend && python scripts/setup_database.py
```
