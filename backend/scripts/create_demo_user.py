"""Create a demo user in Supabase Auth + local users table."""

import asyncio
import httpx
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine


async def main():
    email = "demo@system.edu"
    password = "test123!"

    # Step 1: Create user in Supabase Auth
    print("Creating user in Supabase Auth...")
    signup_url = f"{settings.supabase_url}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            signup_url, headers=headers,
            json={"email": email, "password": password, "email_confirm": True},
        )

    if response.status_code not in (200, 201):
        print(f"Failed: {response.status_code} — {response.text}")
        return

    supabase_id = response.json()["id"]
    print(f"Supabase user created: {supabase_id}")

    # Step 2: Insert into local users table
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id FROM schools LIMIT 1"))
        school = result.first()
        if not school:
            print("No schools found!")
            return
        school_id = school[0]

        await conn.execute(
            text("""
                INSERT INTO users (id, school_id, email, supabase_user_id, first_name, last_name, role, is_active)
                VALUES (gen_random_uuid(), :sid, :email, :suid, 'Demo', 'Admin', 'super_admin', true)
            """),
            {"sid": str(school_id), "email": email, "suid": supabase_id},
        )
        await conn.commit()

    print(f"\nLogin with: {email} / {password}\n")


asyncio.run(main())
