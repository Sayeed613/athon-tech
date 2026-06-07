"""Fix demo user passwords in Supabase Auth.

Resets passwords for all demo users to 'Athon2025!'
using the Supabase Admin API.
"""

import asyncio
import httpx
from app.core.config import settings

DEMO_USERS = [
    "admin@athondemo.edu",
    "principal@athondemo.edu",
    "teacher@athondemo.edu",
    "student@athondemo.edu",
    "student2@athondemo.edu",
    "parent@athondemo.edu",
]

DEMO_PASSWORD = "Athon2025!"


async def main():
    admin_url = f"{settings.supabase_url}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        # List existing users
        resp = await client.get(admin_url, headers=headers)
        if resp.status_code != 200:
            print(f"Failed to list users: {resp.status_code}")
            return

        existing = resp.json()
        email_to_id = {u["email"]: u["id"] for u in existing.get("users", [])}

        for email in DEMO_USERS:
            uid = email_to_id.get(email)
            if uid:
                # Update password for existing user
                update_resp = await client.put(
                    f"{admin_url}/{uid}",
                    headers=headers,
                    json={"password": DEMO_PASSWORD},
                )
                if update_resp.status_code in (200, 201):
                    print(f"  OK Updated password for {email}")
                else:
                    print(f"  FAILED to update {email}: {update_resp.status_code} {update_resp.text[:100]}")
            else:
                # Create user if not exists
                create_resp = await client.post(
                    admin_url,
                    headers=headers,
                    json={"email": email, "password": DEMO_PASSWORD, "email_confirm": True},
                )
                if create_resp.status_code in (200, 201):
                    new_id = create_resp.json()["id"]
                    print(f"  OK Created {email} -> {new_id}")
                else:
                    print(f"  FAILED to create {email}: {create_resp.status_code} {create_resp.text[:100]}")

    print("\nDone! Demo users can now log in with password: Athon2025!")


asyncio.run(main())
