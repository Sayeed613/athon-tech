"""Apply database schema and seed data to Supabase PostgreSQL database.

Run from the backend directory:
    .venv/Scripts/python scripts/setup_database.py
"""

"""
NOTE: The database connection string is read from the .env file
via pydantic-settings (DATABASE_URL). Before running this script,
ensure your .env file has:
    DATABASE_URL=postgresql+asyncpg://user:password@host:port/db

The script strips the '+asyncpg' driver suffix for asyncpg.connect().
"""

import asyncio
import os
import re

import asyncpg

# Load settings to get DATABASE_URL (reads from .env)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings

SQL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "database")

# Build asyncpg DSN from settings (strip SQLAlchemy driver suffix)
raw_url = settings.database_url
DSN = re.sub(r"\+asyncpg", "", raw_url)

# Order matters — dependencies cascade
SQL_FILES = [
    "enums.sql",       # CREATE TYPE statements (must come first)
    "tables.sql",      # CREATE TABLE + FK constraints
    "indexes.sql",     # Performance indexes
    "triggers.sql",    # updated_at triggers
    "rls.sql",         # RLS policies (after all tables exist)
    "seed.sql",        # Seed data
]

# Real Supabase Auth user IDs from Supabase Auth admin API
SUPABASE_USER_IDS = {
    "admin@athondemo.edu":       "490ebed2-7450-415d-859b-a999b823d814",
    "principal@athondemo.edu":   "89a2a317-3c01-423c-b4e4-3663472f93aa",
    "teacher@athondemo.edu":     "d829a4c6-b598-4ce8-ae4b-4e71af1a0fc4",
    "student@athondemo.edu":     "16dad9d3-a386-46d4-a313-4892455f2c53",
    "parent@athondemo.edu":      "0e16568c-49d0-4fa1-95ab-dd5b4de51b37",
    "student2@athondemo.edu":    "ff2a17f1-b302-4260-b5ea-e3e861b689ee",
    "super@athonsystem.io":      "00000000-0000-0000-0000-0000000000ab",
}


async def run_sql_file(conn, filename: str) -> int:
    """Execute a complete SQL file as a single unit."""
    filepath = os.path.join(SQL_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  SKIP {filename} - file not found")
        return 0

    with open(filepath, "r", encoding="utf-8") as f:
        sql = f.read()

    try:
        result = await conn.execute(sql)
        print(f"  OK {filename}")
        return 1
    except (asyncpg.exceptions.DuplicateObjectError,
            asyncpg.exceptions.DuplicateTableError,
            asyncpg.exceptions.DuplicateDatabaseError) as e:
        print(f"  OK {filename} (already exists)")
        return 1
    except Exception as e:
        msg = str(e)[:200]
        print(f"  FAIL {filename}: {type(e).__name__}")
        print(f"    {msg}")
        raise


async def update_supabase_ids(conn):
    """Update placeholder supabase_user_id values with real Supabase Auth IDs."""
    print("  Updating supabase_user_id values...")
    updated = 0
    for email, supabase_id in SUPABASE_USER_IDS.items():
        result = await conn.execute(
            "UPDATE users SET supabase_user_id = $1 WHERE email = $2",
            supabase_id, email,
        )
        if result and result.startswith("UPDATE"):
            updated += int(result.split()[-1])
    print(f"  Updated {updated} users")
    return updated


async def verify_state(conn):
    """Print current database state for verification."""
    tables = await conn.fetch(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' ORDER BY table_name"
    )
    print(f"\nTables in public: {len(tables)}")
    for t in tables:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {t['table_name']}")
        print(f"  {t['table_name']}: {count} rows")

    users = await conn.fetch(
        "SELECT email, role::text, supabase_user_id, is_active "
        "FROM users ORDER BY email"
    )
    print(f"\nUsers: {len(users)}")
    for u in users:
        print(f"  {u['email']}: role={u['role']}, active={u['is_active']}")


async def test_auth_flow():
    """Test the full auth flow against the running server."""
    import httpx

    print("\n--- Testing Auth Flow ---")
    base_url = "http://127.0.0.1:8000"
    
    test_users = [
        ("admin@athondemo.edu", "Athon2025!", "school_admin"),
        ("principal@athondemo.edu", "Athon2025!", "principal"),
        ("teacher@athondemo.edu", "Athon2025!", "teacher"),
        ("student@athondemo.edu", "Athon2025!", "student"),
    ]

    async with httpx.AsyncClient(base_url=base_url) as client:
        for email, password, expected_role in test_users:
            # Login
            r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
            if r.status_code == 200:
                data = r.json()
                token = data["access_token"]
                user = data["user"]
                print(f"  LOGIN {email}: OK (role={user['role']})")
                
                # /auth/me
                r2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
                if r2.status_code == 200:
                    me = r2.json()
                    print(f"  /me   {email}: OK (id={me['id'][:8]}...)")
                else:
                    print(f"  /me   {email}: FAIL ({r2.status_code})")
            else:
                print(f"  LOGIN {email}: FAIL ({r.status_code})")
        
        # Test error cases
        r = await client.post("/api/v1/auth/login", json={"email": "admin@athondemo.edu", "password": "wrong"})
        print(f"  Wrong password: {r.status_code} (expected 401)")
        
        r = await client.get("/api/v1/auth/me")
        print(f"  No token: {r.status_code} (expected 401)")
        
        r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        print(f"  Invalid token: {r.status_code} (expected 401)")


async def main():
    print("=" * 60)
    print("ATHON - Database Setup & Auth Validation")
    print("=" * 60)
    
    conn = await asyncpg.connect(dsn=DSN)
    version = await conn.fetchval("SELECT version()")
    print(f"Connected: PostgreSQL {str(version)[:50]}...\n")

    # Step 1: Reset schema (drop and recreate for clean slate)
    print("--- Resetting Schema ---")
    await conn.execute("DROP SCHEMA public CASCADE")
    await conn.execute("CREATE SCHEMA public")
    await conn.execute("GRANT ALL ON SCHEMA public TO postgres")
    await conn.execute("GRANT ALL ON SCHEMA public TO public")
    print("  OK public schema reset")

    # Step 2: Apply SQL files in order
    print("\n--- Applying Schema ---")
    for sql_file in SQL_FILES:
        if sql_file == "seed.sql":
            # Disable audit triggers before seed (only tables that HAVE audit triggers)
            print("  Disabling audit triggers for seed...")
            AUDIT_TABLES = ["schools", "users", "teachers", "principals", "students",
                            "classes", "homeworks", "tests", "attendance", "timetable_entries"]
            for tbl in AUDIT_TABLES:
                await conn.execute(f"ALTER TABLE {tbl} DISABLE TRIGGER trg_{tbl}_audit")
            await run_sql_file(conn, sql_file)
            # Re-enable audit triggers after seed
            print("  Re-enabling audit triggers...")
            for tbl in AUDIT_TABLES:
                await conn.execute(f"ALTER TABLE {tbl} ENABLE TRIGGER trg_{tbl}_audit")
        else:
            await run_sql_file(conn, sql_file)

    # Step 2: Update supabase_user_id values
    print("\n--- Syncing Supabase Auth IDs ---")
    await update_supabase_ids(conn)

    # Step 3: Verify state
    print("\n--- Database Verification ---")
    await verify_state(conn)

    await conn.close()
    print("\nDatabase setup complete!")


if __name__ == "__main__":
    asyncio.run(main())
