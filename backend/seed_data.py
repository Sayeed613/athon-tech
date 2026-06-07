"""Seed script — comprehensive demo dataset for Admin Web freeze candidate.

Creates:
- 1 School, 1 Principal
- 10 Teachers, 50 Students, 50 Parents
- 8 Classes, 8 Subjects
- Teacher Assignments, Timetable Entries
- Attendance Records, Homework, Tests

Also creates real users in Supabase Auth so login works.
"""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx
from app.core.config import settings
from app.core.database import engine
from sqlalchemy import text

SCHOOL_ID = "00000000-0000-0000-0000-000000000001"
ACADEMIC_YEAR = "00000000-0000-0000-0000-000000000002"
ACADEMIC_TERM = "00000000-0000-0000-0000-000000000010"
now = datetime.now(timezone.utc)

# Shared password for all demo users
DEMO_PASSWORD = "Athon2025!"

# Supabase Auth admin API setup
SUPABASE_AUTH_URL = f"{settings.supabase_url}/auth/v1/admin/users"
SUPABASE_HEADERS = {
    "apikey": settings.supabase_service_key,
    "Authorization": f"Bearer {settings.supabase_service_key}",
    "Content-Type": "application/json",
}


def gen_id() -> str:
    return str(uuid.uuid4())


async def create_supabase_user(email: str) -> str:
    """Create a user in Supabase Auth and return the real supabase_user_id."""
    if not settings.supabase_url or not settings.supabase_service_key:
        return gen_id()  # dev mode fallback

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            SUPABASE_AUTH_URL,
            headers=SUPABASE_HEADERS,
            json={
                "email": email,
                "password": DEMO_PASSWORD,
                "email_confirm": True,
            },
        )

    if response.status_code in (200, 201):
        return response.json()["id"]
    elif response.status_code == 409:
        # User already exists — fetch their ID
        list_url = f"{settings.supabase_url}/auth/v1/admin/users?email={email}"
        async with httpx.AsyncClient(timeout=30) as client:
            list_resp = await client.get(list_url, headers=SUPABASE_HEADERS)
        if list_resp.status_code == 200 and list_resp.json().get("users"):
            return list_resp.json()["users"][0]["id"]
        return gen_id()
    else:
        print(f"  [WARN] Supabase user creation failed for {email}: status={response.status_code}")
        # Print response body for debugging
        body = response.text[:200] if response.text else 'empty'
        print(f"  [WARN] Response: {body}")
        return gen_id()


async def seed():
    async with engine.begin() as conn:
        print("=" * 60)
        print("ATHON — Comprehensive Seed Data")
        print("=" * 60)

        # Truncate all seeded tables to allow clean re-runs
        tables_to_truncate = [
            'test_attempts', 'tests', 'homework_submissions', 'homeworks',
            'attendance', 'timetable_entries', 'teacher_class_subjects',
            'student_parents', 'class_enrollments', 'parents', 'students',
            'teachers', 'principals', 'users', 'periods', 'classes', 'subjects',
            'academic_terms', 'academic_years'
        ]
        for tbl in tables_to_truncate:
            await conn.execute(text(f"TRUNCATE TABLE {tbl} CASCADE"))
        await conn.execute(text("ALTER SEQUENCE IF EXISTS periods_id_seq RESTART WITH 1"))
        print("  + All tables truncated for clean seed")

        # Re-create academic year and term (wiped by TRUNCATE)
        await conn.execute(text(f"""
            INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current, created_at, updated_at)
            VALUES ('{ACADEMIC_YEAR}', '{SCHOOL_ID}', '2025-2026', '2025-09-01', '2026-06-30', true, '{now}', '{now}')
        """))
        await conn.execute(text(f"""
            INSERT INTO academic_terms (id, school_id, academic_year_id, name, start_date, end_date, is_current, created_at, updated_at)
            VALUES ('{ACADEMIC_TERM}', '{SCHOOL_ID}', '{ACADEMIC_YEAR}', 'Term 1', '2025-09-01', '2026-01-31', true, '{now}', '{now}')
        """))
        print("  + Academic Year + Term created")

        # ── 0. ACADEMIC STRUCTURE ──────────────────────────────────
        class_names = [
            ("Grade 9", "A"), ("Grade 9", "B"), ("Grade 9", "C"), ("Grade 9", "D"),
            ("Grade 10", "A"), ("Grade 10", "B"), ("Grade 10", "C"), ("Grade 10", "D"),
        ]
        class_ids = []
        for name, section in class_names:
            cid = gen_id()
            class_ids.append(cid)
            await conn.execute(text(f"""
                INSERT INTO classes (id, school_id, name, section, academic_year_id, capacity, created_at, updated_at)
                VALUES ('{cid}', '{SCHOOL_ID}', '{name}', '{section}', '{ACADEMIC_YEAR}', 40, '{now}', '{now}')
            """))
        print(f"  + Classes: {len(class_ids)} created")

        # 8 Subjects
        subject_data = [
            ("Mathematics", "MATH", True),
            ("English Language", "ENG", True),
            ("Science", "SCI", True),
            ("History", "HIS", True),
            ("Art", "ART", False),
            ("Physics", "PHY", True),
            ("Chemistry", "CHE", True),
            ("Geography", "GEO", True),
        ]
        subject_ids = {}
        for name, code, core in subject_data:
            sid = gen_id()
            subject_ids[code] = sid
            await conn.execute(text(f"""
                INSERT INTO subjects (id, school_id, name, code, is_core, created_at, updated_at)
                VALUES ('{sid}', '{SCHOOL_ID}', '{name}', '{code}', {str(core).lower()}, '{now}', '{now}')
            """))
        print(f"  + Subjects: {len(subject_data)} created")

        # ── 1. PRINCIPAL ───────────────────────────────────────────
        principal_email = "jane.doe@athondemo.edu"
        print(f"  Creating Supabase Auth user: {principal_email} ...")
        puid = gen_id()
        ppid = gen_id()
        supabase_principal_id = await create_supabase_user(principal_email)

        await conn.execute(text(f"""
            INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
            VALUES ('{puid}', '{SCHOOL_ID}', '{principal_email}', '{supabase_principal_id}', 'Jane', 'Doe', 'principal', true, 'en', '{now}', '{now}')
        """))
        await conn.execute(text(f"""
            INSERT INTO principals (id, user_id, school_id, employee_code, qualification, appointment_type, tenure_start_date, created_at, updated_at)
            VALUES ('{ppid}', '{puid}', '{SCHOOL_ID}', 'P001', 'Ph.D. Education', 'permanent', '2024-09-01', '{now}', '{now}')
        """))
        print(f"  + Principal: Jane Doe ({principal_email})")

        # Also create admin@athondemo.edu for the main admin account
        admin_email = "admin@athondemo.edu"
        print(f"  Creating Supabase Auth user: {admin_email} ...")
        admin_uid = gen_id()
        supabase_admin_id = await create_supabase_user(admin_email)
        await conn.execute(text(f"""
            INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
            VALUES ('{admin_uid}', '{SCHOOL_ID}', '{admin_email}', '{supabase_admin_id}', 'Admin', 'User', 'school_admin', true, 'en', '{now}', '{now}')
        """))
        print(f"  + Admin: Admin User ({admin_email})")

        # ── 2. TEACHERS (10) ───────────────────────────────────────
        teacher_data = [
            ("Tina", "Teacher", "T001", "B.Ed.", "General"),
            ("Sarah", "Johnson", "T002", "M.Sc. Mathematics", "Mathematics"),
            ("Michael", "Chen", "T003", "M.A. English Literature", "English Language"),
            ("Emma", "Rodriguez", "T004", "Ph.D. Biology", "Science"),
            ("James", "Williams", "T005", "M.A. History", "History"),
            ("Lisa", "Anderson", "T006", "B.F.A.", "Art"),
            ("Robert", "Martinez", "T007", "M.Sc. Physics", "Physics"),
            ("Jennifer", "Taylor", "T008", "M.Sc. Chemistry", "Chemistry"),
            ("David", "Thomas", "T009", "M.A. Geography", "Geography"),
            ("Maria", "Garcia", "T010", "M.Ed.", "Special Education"),
        ]

        teacher_ids = []
        teacher_user_ids = []
        for fn, ln, code, qual, spec in teacher_data:
            uid = gen_id()
            tid = gen_id()
            email = f"{fn.lower()}.{ln.lower()}@athondemo.edu"
            print(f"  Creating Supabase Auth user: {email} ...")
            supabase_id = await create_supabase_user(email)

            await conn.execute(text(f"""
                INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
                VALUES ('{uid}', '{SCHOOL_ID}', '{email}', '{supabase_id}', '{fn}', '{ln}', 'teacher', true, 'en', '{now}', '{now}')
            """))
            await conn.execute(text(f"""
                INSERT INTO teachers (id, user_id, school_id, employee_code, qualification, specialization, hire_date, is_class_teacher, created_at, updated_at)
                VALUES ('{tid}', '{uid}', '{SCHOOL_ID}', '{code}', '{qual}', '{spec}', '2024-09-01', false, '{now}', '{now}')
            """))
            teacher_ids.append(tid)
            teacher_user_ids.append(uid)
        print(f"  + Teachers: {len(teacher_data)} created")

        # Class teachers (first 8 teachers)
        for i in range(8):
            await conn.execute(text(f"""
                UPDATE teachers SET is_class_teacher = true WHERE id = '{teacher_ids[i]}' AND school_id = '{SCHOOL_ID}'
            """))
            await conn.execute(text(f"""
                UPDATE classes SET class_teacher_id = '{teacher_ids[i]}' WHERE id = '{class_ids[i]}' AND school_id = '{SCHOOL_ID}'
            """))

        # ── 3. TEACHER ASSIGNMENTS ─────────────────────────────────
        assignments = [
            (teacher_ids[0], class_ids[0], subject_ids["MATH"]),
            (teacher_ids[1], class_ids[0], subject_ids["MATH"]),
            (teacher_ids[1], class_ids[4], subject_ids["MATH"]),
            (teacher_ids[2], class_ids[0], subject_ids["ENG"]),
            (teacher_ids[2], class_ids[4], subject_ids["ENG"]),
            (teacher_ids[3], class_ids[0], subject_ids["SCI"]),
            (teacher_ids[3], class_ids[4], subject_ids["SCI"]),
            (teacher_ids[4], class_ids[0], subject_ids["HIS"]),
            (teacher_ids[5], class_ids[0], subject_ids["ART"]),
            (teacher_ids[6], class_ids[4], subject_ids["PHY"]),
            (teacher_ids[7], class_ids[4], subject_ids["CHE"]),
            (teacher_ids[8], class_ids[4], subject_ids["GEO"]),
            (teacher_ids[1], class_ids[1], subject_ids["MATH"]),
            (teacher_ids[2], class_ids[1], subject_ids["ENG"]),
            (teacher_ids[3], class_ids[2], subject_ids["SCI"]),
            (teacher_ids[4], class_ids[3], subject_ids["HIS"]),
            (teacher_ids[6], class_ids[5], subject_ids["PHY"]),
            (teacher_ids[7], class_ids[6], subject_ids["CHE"]),
            (teacher_ids[8], class_ids[7], subject_ids["GEO"]),
            (teacher_ids[0], class_ids[5], subject_ids["MATH"]),
        ]
        for tid, cid, suid in assignments:
            await conn.execute(text(f"""
                INSERT INTO teacher_class_subjects (id, school_id, teacher_id, class_id, subject_id, academic_term_id, created_at, updated_at)
                VALUES ('{gen_id()}', '{SCHOOL_ID}', '{tid}', '{cid}', '{suid}', '{ACADEMIC_TERM}', '{now}', '{now}')
            """))
        print(f"  + Assignments: {len(assignments)} created")

        # ── 4. STUDENTS (50) ───────────────────────────────────────
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                      "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
                      "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
                      "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
                      "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"]

        first_names_f = ["Olivia", "Emma", "Charlotte", "Amelia", "Sophia", "Mia", "Isabella", "Ava", "Evelyn", "Luna",
                         "Harper", "Camila", "Gianna", "Elena", "Stella", "Maya", "Aria", "Layla", "Nora", "Lily"]
        first_names_m = ["Liam", "Noah", "Oliver", "James", "Elijah", "William", "Henry", "Lucas", "Mason", "Ethan",
                         "Alexander", "Daniel", "Jacob", "Michael", "Benjamin", "Jack", "Owen", "Theo", "Leo", "Landon"]

        student_ids = []
        roll_counters = {cid: 1 for cid in class_ids}
        for i in range(50):
            gender = "female" if i < 25 else "male"
            fn_pool = first_names_f if i < 25 else first_names_m
            fn = fn_pool[i % 20]
            ln = last_names[i]
            adm = f"ADM{2025000 + i + 1}"
            cid = class_ids[i % len(class_ids)]
            roll = f"{roll_counters[cid]:02d}"
            roll_counters[cid] += 1

            uid = gen_id()
            sid = gen_id()
            email = f"{fn.lower()}.{ln.lower()}@athondemo.edu"

            if i % 10 == 0:
                print(f"  Creating Supabase Auth users: students {i+1}-{min(i+10, 50)} ...")
            supabase_id = await create_supabase_user(email)

            await conn.execute(text(f"""
                INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
                VALUES ('{uid}', '{SCHOOL_ID}', '{email}', '{supabase_id}', '{fn}', '{ln}', 'student', true, 'en', '{now}', '{now}')
            """))
            await conn.execute(text(f"""
                INSERT INTO students (id, user_id, school_id, class_id, admission_number, roll_number, date_of_birth, gender, enrollment_date, is_active, created_at, updated_at)
                VALUES ('{sid}', '{uid}', '{SCHOOL_ID}', '{cid}', '{adm}', '{roll}', '2008-06-15', '{gender}', '2024-09-01', true, '{now}', '{now}')
            """))
            await conn.execute(text(f"""
                INSERT INTO class_enrollments (id, school_id, student_id, class_id, academic_year_id, enrolled_at, status, created_at, updated_at)
                VALUES ('{gen_id()}', '{SCHOOL_ID}', '{sid}', '{cid}', '{ACADEMIC_YEAR}', '{now}', 'active', '{now}', '{now}')
            """))
            student_ids.append(sid)
        print(f"  + Students: {len(student_ids)} created")

        # ── 5. PARENTS (50) ────────────────────────────────────────
        parent_map = {
            "Smith": "Robert", "Johnson": "Jennifer", "Williams": "David", "Brown": "Maria",
            "Jones": "Kevin", "Garcia": "Carmen", "Miller": "Thomas", "Davis": "Lisa",
            "Rodriguez": "Carlos", "Martinez": "Ana", "Hernandez": "Jose", "Lopez": "Sofia",
            "Gonzalez": "Miguel", "Wilson": "Sarah", "Anderson": "Peter", "Thomas": "Rachel",
            "Taylor": "Jason", "Moore": "Laura", "Jackson": "Michael", "Martin": "Emily",
            "Lee": "Steven", "Perez": "Isabel", "Thompson": "Daniel", "White": "Karen",
            "Harris": "Brian", "Sanchez": "Elena", "Clark": "George", "Ramirez": "Luisa",
            "Lewis": "Edward", "Robinson": "Patricia", "Walker": "Andrew", "Young": "Jessica",
            "Allen": "Chris", "King": "Megan", "Wright": "Ryan", "Scott": "Amanda",
            "Torres": "Juan", "Nguyen": "Linh", "Hill": "Brandon", "Flores": "Rosa",
            "Green": "Timothy", "Adams": "Nicole", "Nelson": "Eric", "Baker": "Heather",
            "Hall": "Scott", "Rivera": "Pedro", "Campbell": "Donna", "Mitchell": "Adam",
            "Carter": "Julie", "Roberts": "Kyle"
        }
        occupations = ["Engineer", "Doctor", "Teacher", "Business Owner", "Architect", "Nurse",
                       "Lawyer", "Accountant", "Consultant", "Manager", "Dentist", "Software Developer"]

        parent_ids = []
        for i in range(50):
            ln = last_names[i]
            fn = parent_map[ln]
            email = f"{fn.lower()}.{ln.lower()}@athondemo.edu"
            occ = occupations[i % len(occupations)]

            if i % 10 == 0:
                print(f"  Creating Supabase Auth users: parents {i+1}-{min(i+10, 50)} ...")
            supabase_id = await create_supabase_user(email)

            uid = gen_id()
            pid = gen_id()
            await conn.execute(text(f"""
                INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
                VALUES ('{uid}', '{SCHOOL_ID}', '{email}', '{supabase_id}', '{fn}', '{ln}', 'parent', true, 'en', '{now}', '{now}')
            """))
            await conn.execute(text(f"""
                INSERT INTO parents (id, user_id, school_id, occupation, is_verified, created_at, updated_at)
                VALUES ('{pid}', '{uid}', '{SCHOOL_ID}', '{occ}', true, '{now}', '{now}')
            """))
            parent_ids.append(pid)
        print(f"  + Parents: {len(parent_ids)} created")

        # Link parents to students (1:1 matching)
        linked = 0
        for i in range(50):
            rel = "father" if i < 25 else "mother"
            await conn.execute(text(f"""
                INSERT INTO student_parents (id, student_id, parent_id, school_id, relationship, is_primary_contact, receive_whatsapp, created_at, updated_at)
                VALUES ('{gen_id()}', '{student_ids[i]}', '{parent_ids[i]}', '{SCHOOL_ID}', '{rel}', true, true, '{now}', '{now}')
            """))
            linked += 1
        print(f"  + Parent-Student Links: {linked}")

        # ── 6. TIMETABLE ENTRIES ───────────────────────────────────
        period_ids_list = []
        for pn in range(1, 9):
            pid_period = gen_id()
            period_ids_list.append(pid_period)
            await conn.execute(text(f"""
                INSERT INTO periods (id, school_id, name, period_number, start_time, end_time, is_break, created_at, updated_at)
                VALUES ('{pid_period}', '{SCHOOL_ID}', 'Period {pn}', {pn},
                        '{(7 + (pn - 1) // 2):02d}:{((pn - 1) * 10) % 60:02d}:00',
                        '{(7 + (pn - 1) // 2 + 1):02d}:{((pn - 1) * 10 + 40) % 60:02d}:00',
                        false, '{now}', '{now}')
            """))

        period_by_num = {pn: period_ids_list[pn - 1] for pn in range(1, 9)}

        days = list(range(1, 6))
        timetable_entries = 0
        sample_classes = [class_ids[0], class_ids[4]]
        for cid in sample_classes:
            for day in days:
                for pn in range(1, 5):
                    tid = teacher_ids[(pn + day + sample_classes.index(cid) * 4) % 10]
                    sid_key = list(subject_ids.keys())[(pn + day) % 8]
                    suid = subject_ids[sid_key]
                    period_id = period_by_num[pn]
                    await conn.execute(text(f"""
                        INSERT INTO timetable_entries (id, school_id, academic_term_id, class_id, teacher_id, subject_id, day_of_week, period_id, room_number, is_active, created_at, updated_at)
                        VALUES ('{gen_id()}', '{SCHOOL_ID}', '{ACADEMIC_TERM}', '{cid}', '{tid}', '{suid}', {day}, '{period_id}', '{101 + pn}', true, '{now}', '{now}')
                    """))
                    timetable_entries += 1
        print(f"  + Timetable Entries: {timetable_entries}")

        # ── 7. ATTENDANCE RECORDS ──────────────────────────────────
        attendance_dates = []
        for d in range(1, 21):
            day = date(2026, 5, d + 1)
            if day.weekday() < 5:
                attendance_dates.append(day)

        attendance_count = 0
        statuses = ["present", "present", "present", "present", "absent", "present", "late", "present", "present", "half_day"]
        for i in range(min(25, len(student_ids))):
            sid = student_ids[i]
            cid = class_ids[i // 6]
            for att_date in attendance_dates[:10]:
                status = statuses[attendance_count % len(statuses)]
                await conn.execute(text(f"""
                    INSERT INTO attendance (id, school_id, student_id, class_id, academic_term_id, date, status, marked_by, created_at, updated_at)
                    VALUES ('{gen_id()}', '{SCHOOL_ID}', '{sid}', '{cid}', '{ACADEMIC_TERM}', '{att_date}', '{status}', '{teacher_ids[i % 10]}', '{now}', '{now}')
                """))
                attendance_count += 1
        print(f"  + Attendance Records: {attendance_count}")

        # ── 8. HOMEWORK ────────────────────────────────────────────
        hw_titles = ["Algebra", "Essay Writing", "Photosynthesis", "World War II",
                     "Color Theory", "Newton Laws", "Periodic Table", "Plate Tectonics"]
        homework_count = 0
        for i in range(8):
            cid = class_ids[i]
            suid = subject_ids[list(subject_ids.keys())[i % 4]]
            tid = teacher_ids[i % 10]
            due_date = now + timedelta(days=7 + i)
            hw_id = gen_id()
            await conn.execute(text(f"""
                INSERT INTO homeworks (id, school_id, class_id, subject_id, teacher_id, academic_term_id, title, description, due_date, max_score, is_published, version, created_at, updated_at)
                VALUES ('{hw_id}', '{SCHOOL_ID}', '{cid}', '{suid}', '{tid}', '{ACADEMIC_TERM}',
                        'Homework {i+1}: {hw_titles[i]}',
                        'Complete the assignment and submit by the due date.',
                        '{due_date.strftime("%Y-%m-%d %H:%M:%S")}', {50 + i * 10}, true, 1, '{now}', '{now}')
            """))

            for j in range(min(25, len(student_ids))):
                sid = student_ids[j]
                sub_id = gen_id()
                status_sub = "submitted" if j % 3 != 0 else "graded"
                score = None
                if status_sub == "graded":
                    score = round(30 + (j * 2) % 70 + (i * 3) % 20, 1)
                await conn.execute(text(f"""
                    INSERT INTO homework_submissions (id, homework_id, student_id, school_id, status, total_score, is_graded, graded_by, submitted_at, created_at, updated_at)
                    VALUES ('{sub_id}', '{hw_id}', '{sid}', '{SCHOOL_ID}', '{status_sub}',
                            {score if score is not None else 'NULL'},
                            {str(status_sub == 'graded').lower()},
                            {f"'{teacher_user_ids[i % 10]}'" if status_sub == 'graded' else 'NULL'},
                            '{now}', '{now}', '{now}')
                """))
            homework_count += 1
        print(f"  + Homeworks: {homework_count} (with submissions)")

        # ── 9. TESTS ────────────────────────────────────────────────
        test_titles = ["Mid-Term Exam", "Weekly Quiz", "Chapter Test", "Practice Test",
                       "Final Assessment", "Quick Quiz"]
        test_count = 0
        for i in range(6):
            cid = class_ids[i % 8]
            suid = subject_ids[list(subject_ids.keys())[i % 3]]
            tid = teacher_ids[i % 10]
            test_id = gen_id()
            test_type = "exam" if i % 2 == 0 else "quiz"
            await conn.execute(text(f"""
                INSERT INTO tests (id, school_id, class_id, subject_id, teacher_id, academic_term_id, title, description, total_marks, duration_minutes, test_type, is_published, is_results_published, scheduled_at, version, created_at, updated_at)
                VALUES ('{test_id}', '{SCHOOL_ID}', '{cid}', '{suid}', '{tid}', '{ACADEMIC_TERM}',
                        '{test_titles[i]}', 'Test your knowledge of the recent topics covered in class.',
                        {50 + i * 10}, {30 + i * 15}, '{test_type}', true,
                        {str(i < 4).lower()}, '{now.strftime("%Y-%m-%d %H:%M:%S")}', 1, '{now}', '{now}')
            """))

            for j in range(min(20, len(student_ids))):
                sid = student_ids[j]
                attempt_id = gen_id()
                score = round(20 + (j * 2) % 60 + (i * 2) % 20, 1)
                await conn.execute(text(f"""
                    INSERT INTO test_attempts (id, test_id, student_id, school_id, total_score, is_graded, graded_by, started_at, submitted_at, created_at, updated_at)
                    VALUES ('{attempt_id}', '{test_id}', '{sid}', '{SCHOOL_ID}', {score}, true, '{teacher_user_ids[i % 10]}', '{now}', '{now}', '{now}', '{now}')
                """))
            test_count += 1
        print(f"  + Tests: {test_count} (with attempts)")

        # ── 10. SUMMARY ────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("SEED SUMMARY")
        print("=" * 60)
        for table in ['users', 'teachers', 'students', 'parents', 'student_parents', 'class_enrollments',
                       'classes', 'subjects', 'teacher_class_subjects', 'timetable_entries',
                       'attendance', 'homeworks', 'homework_submissions', 'tests', 'test_attempts',
                       'periods', 'principals']:
            result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            print(f"  {table}: {count}")

    print("\nSeeding complete!")
    print(f"Login with: admin@athondemo.edu / {DEMO_PASSWORD}")


asyncio.run(seed())
