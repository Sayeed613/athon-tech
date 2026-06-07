"""Seed script — adds more parents, students, and links for Parent Management testing.

Run from the backend directory:
    .venv/Scripts/python seed_parents.py

This script is safe to run multiple times — it uses ON CONFLICT DO NOTHING
and checks for existing records before inserting.
"""

import asyncio
import uuid

from app.core.database import engine
from sqlalchemy import text

SCHOOL_ID = "00000000-0000-0000-0000-000000000001"
CLASS_10A = "00000000-0000-0000-0000-000000000040"
CLASS_10B = "00000000-0000-0000-0000-000000000041"
ACADEMIC_YEAR_ID = "00000000-0000-0000-0000-000000000002"


def gen_id() -> str:
    return str(uuid.uuid4())


async def seed() -> None:
    async with engine.begin() as conn:
        print("Seeding additional parents, students, and links...\n")

        # ── 1. ADD MORE STUDENTS ──────────────────────────────────────────
        # Skip if students with these admission numbers already exist
        existing_adms = set()
        result = await conn.execute(
            text("SELECT admission_number FROM students WHERE school_id = :sid"),
            {"sid": SCHOOL_ID},
        )
        for row in result:
            existing_adms.add(row[0])

        new_students = [
            ("Oliver", "Brown", "ADM-2025-003", CLASS_10A, "03", "male"),
            ("Sophia", "Taylor", "ADM-2025-004", CLASS_10A, "04", "female"),
            ("Liam", "Miller", "ADM-2025-005", CLASS_10B, "01", "male"),
            ("Amelia", "Davis", "ADM-2025-006", CLASS_10B, "02", "female"),
        ]

        student_ids = {}
        for first, last, adm, class_id, roll, gender in new_students:
            if adm in existing_adms:
                print(f"  SKIP student {first} {last} (already exists)")
                # Fetch existing ID
                result = await conn.execute(
                    text("SELECT id FROM students WHERE admission_number = :adm AND school_id = :sid"),
                    {"adm": adm, "sid": SCHOOL_ID},
                )
                row = result.first()
                if row:
                    student_ids[first.lower()] = row[0]
                continue

            uid = gen_id()
            sid = gen_id()
            email = f"{first.lower()}.{last.lower()}@athondemo.edu"

            # Create user
            await conn.execute(
                text("""
                    INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
                    VALUES (:id, :sid, :email, :suid, :fn, :ln, 'student', true, 'en', now(), now())
                    ON CONFLICT ON CONSTRAINT users_school_email_uk DO NOTHING
                """),
                {"id": uid, "sid": SCHOOL_ID, "email": email, "suid": gen_id(), "fn": first, "ln": last},
            )

            # Create student - use the uid from above
            await conn.execute(
                text("""
                    INSERT INTO students (id, user_id, school_id, class_id, admission_number, roll_number, date_of_birth, gender, enrollment_date, is_active, created_at, updated_at)
                    VALUES (:id, :uid, :sid, :cid, :adm, :roll, '2008-06-15', :gender, '2024-09-01', true, now(), now())
                    ON CONFLICT DO NOTHING
                """),
                {"id": sid, "uid": uid, "sid": SCHOOL_ID, "cid": class_id, "adm": adm, "roll": roll, "gender": gender},
            )

            # Check if student was actually inserted (ON CONFLICT may have skipped it)
            check = await conn.execute(
                text("SELECT id FROM students WHERE id = :id"),
                {"id": sid},
            )
            if check.first():
                student_ids[first.lower()] = sid
                print(f"  + Student: {first} {last} ({adm})")

                # Enroll in class
                await conn.execute(
                    text("""
                        INSERT INTO class_enrollments (id, school_id, student_id, class_id, academic_year_id, enrolled_at, status, created_at, updated_at)
                        VALUES (:id, :sid, :stid, :cid, :ayid, now(), 'active', now(), now())
                        ON CONFLICT DO NOTHING
                    """),
                    {"id": gen_id(), "sid": SCHOOL_ID, "stid": sid, "cid": class_id, "ayid": ACADEMIC_YEAR_ID},
                )
            else:
                # Student already existed, get existing ID
                result = await conn.execute(
                    text("SELECT id FROM students WHERE admission_number = :adm AND school_id = :sid"),
                    {"adm": adm, "sid": SCHOOL_ID},
                )
                row = result.first()
                if row:
                    student_ids[first.lower()] = row[0]

        # ── 2. ADD MORE PARENTS ───────────────────────────────────────────
        existing_parent_emails = set()
        result = await conn.execute(
            text("""
                SELECT u.email FROM parents p
                JOIN users u ON u.id = p.user_id
                WHERE p.school_id = :sid
            """),
            {"sid": SCHOOL_ID},
        )
        for row in result:
            existing_parent_emails.add(row[0])

        new_parents = [
            ("Robert", "Brown", "robert.brown@athondemo.edu", "Engineer"),
            ("Jennifer", "Taylor", "jennifer.taylor@athondemo.edu", "Doctor"),
            ("David", "Miller", "david.miller@athondemo.edu", "Business Owner"),
            ("Maria", "Davis", "maria.davis@athondemo.edu", "Teacher"),
            ("Kevin", "Wilson", "kevin.wilson@athondemo.edu", "Architect"),
        ]

        parent_ids = {}
        # Keep the existing Patricia Parent
        result = await conn.execute(
            text("SELECT p.id, u.first_name FROM parents p JOIN users u ON u.id = p.user_id WHERE p.school_id = :sid"),
            {"sid": SCHOOL_ID},
        )
        for row in result:
            parent_ids[row[1].lower()] = row[0]

        for first, last, email, occupation in new_parents:
            if email in existing_parent_emails:
                print(f"  SKIP parent {first} {last} (already exists)")
                result = await conn.execute(
                    text("SELECT p.id FROM parents p JOIN users u ON u.id = p.user_id WHERE u.email = :email"),
                    {"email": email},
                )
                row = result.first()
                if row:
                    parent_ids[first.lower()] = row[0]
                continue

            uid = gen_id()
            pid = gen_id()

            await conn.execute(
                text("""
                    INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active, locale, created_at, updated_at)
                    VALUES (:id, :sid, :email, :suid, :fn, :ln, 'parent', true, 'en', now(), now())
                    ON CONFLICT ON CONSTRAINT users_school_email_uk DO NOTHING
                """),
                {"id": uid, "sid": SCHOOL_ID, "email": email, "suid": gen_id(), "fn": first, "ln": last},
            )

            await conn.execute(
                text("""
                    INSERT INTO parents (id, user_id, school_id, occupation, is_verified, created_at, updated_at)
                    VALUES (:id, :uid, :sid, :occ, true, now(), now())
                    ON CONFLICT DO NOTHING
                """),
                {"id": pid, "uid": uid, "sid": SCHOOL_ID, "occ": occupation},
            )

            # Verify insert succeeded
            check = await conn.execute(
                text("SELECT id FROM parents WHERE id = :id"),
                {"id": pid},
            )
            if check.first():
                parent_ids[first.lower()] = pid
                print(f"  + Parent: {first} {last} ({email}) — {occupation}")

        # ── 3. LINK PARENTS TO STUDENTS ───────────────────────────────────
        # Get existing links to avoid duplicates
        existing_links = set()
        result = await conn.execute(
            text("SELECT student_id, parent_id FROM student_parents WHERE school_id = :sid"),
            {"sid": SCHOOL_ID},
        )
        for row in result:
            existing_links.add((row[0], row[1]))

        links_to_create = []

        # Map student names to IDs
        if "oliver" in student_ids and "robert" in parent_ids:
            links_to_create.append((student_ids["oliver"], parent_ids["robert"], "father", True))
        if "sophia" in student_ids and "jennifer" in parent_ids:
            links_to_create.append((student_ids["sophia"], parent_ids["jennifer"], "mother", True))
        if "liam" in student_ids and "david" in parent_ids:
            links_to_create.append((student_ids["liam"], parent_ids["david"], "father", True))
        if "amelia" in student_ids and "maria" in parent_ids:
            links_to_create.append((student_ids["amelia"], parent_ids["maria"], "mother", True))

        created_links = 0
        for stid, pid, rel, primary in links_to_create:
            if (stid, pid) not in existing_links:
                link_id = gen_id()
                await conn.execute(
                    text("""
                        INSERT INTO student_parents (id, student_id, parent_id, school_id, relationship, is_primary_contact, receive_whatsapp, created_at, updated_at)
                        VALUES (:id, :stid, :pid, :sid, :rel, :primary, true, now(), now())
                        ON CONFLICT DO NOTHING
                    """),
                    {"id": link_id, "stid": stid, "pid": pid, "sid": SCHOOL_ID, "rel": rel, "primary": primary},
                )
                created_links += 1

        if created_links > 0:
            print(f"\n  + Created {created_links} parent-student links")

        # ── 4. SUMMARY ────────────────────────────────────────────────────
        print("\n=== SEED SUMMARY ===")
        for table in ["parents", "students", "student_parents", "users"]:
            result = await conn.execute(
                text(f"SELECT COUNT(*) FROM {table}")
            )
            count = result.scalar()
            print(f"  {table}: {count}")

    print("\nSeeding complete! You can now test the Parent Management pages.")


asyncio.run(seed())
