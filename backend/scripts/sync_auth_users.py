"""Sync demo users to Supabase Auth.

Creates or updates demo users in Supabase Auth with the known password
"Athon2025!" and confirms their emails so they can log in.

Run from backend directory:
    .venv/Scripts/python scripts/sync_auth_users.py
"""

import asyncio
import httpx
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings


DEMO_USERS = [
    {"email": "admin@athondemo.edu", "password": "Athon2025!", "role": "school_admin"},
    {"email": "principal@athondemo.edu", "password": "Athon2025!", "role": "principal"},
    {"email": "teacher@athondemo.edu", "password": "Athon2025!", "role": "teacher"},
    {"email": "student@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "parent@athondemo.edu", "password": "Athon2025!", "role": "parent"},
    {"email": "student2@athondemo.edu", "password": "Athon2025!", "role": "student"},
    # Extra seed data users
    {"email": "james.wilson@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "sophia.taylor@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "oliver.brown@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "amelia.davis@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "liam.miller@athondemo.edu", "password": "Athon2025!", "role": "student"},
    {"email": "robert.brown@athondemo.edu", "password": "Athon2025!", "role": "parent"},
    {"email": "jennifer.taylor@athondemo.edu", "password": "Athon2025!", "role": "parent"},
    {"email": "david.miller@athondemo.edu", "password": "Athon2025!", "role": "parent"},
    {"email": "maria.davis@athondemo.edu", "password": "Athon2025!", "role": "parent"},
    {"email": "kevin.wilson@athondemo.edu", "password": "Athon2025!", "role": "parent"},
]

# Extra seed teachers
EXTRA_TEACHERS = [
    {"email": "sarah.johnson@athondemo.edu", "password": "Athon2025!", "role": "teacher"},
    {"email": "michael.chen@athondemo.edu", "password": "Athon2025!", "role": "teacher"},
    {"email": "emma.rodriguez@athondemo.edu", "password": "Athon2025!", "role": "teacher"},
]

ALL_USERS = DEMO_USERS + EXTRA_TEACHERS


async def main():
    admin_url = f"{settings.supabase_url}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        for user in ALL_USERS:
            email = user["email"]
            password = user["password"]

            # Try to create the user
            print(f"Processing {email}...", end=" ")
            response = await client.post(
                admin_url,
                headers=headers,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                },
            )

            if response.status_code in (200, 201):
                data = response.json()
                uid = data["id"]
                print(f"✅ Created (ID: {uid})")
            elif response.status_code == 422:
                # User already exists — update password and confirm
                err = response.json()
                msg = err.get("msg", "")
                if "already exists" in msg or "User already" in msg:
                    # Find user by email to get their ID
                    list_resp = await client.get(
                        f"{admin_url}?filter%5Bemail%5D={email}",
                        headers=headers,
                    )
                    if list_resp.status_code == 200:
                        users_data = list_resp.json()
                        # Response might be a list or have a 'users' key
                        if isinstance(users_data, list):
                            users_list = users_data
                        else:
                            users_list = users_data.get("users", [])
                        
                        if users_list:
                            uid = users_list[0]["id"]
                            # Update password
                            update_resp = await client.put(
                                f"{admin_url}/{uid}",
                                headers=headers,
                                json={"password": password, "email_confirm": True},
                            )
                            if update_resp.status_code in (200, 201, 204):
                                print(f"✅ Updated password (ID: {uid})")
                            else:
                                print(f"⚠️  Update returned {update_resp.status_code}: {update_resp.text[:100]}")
                        else:
                            print(f"⚠️  User exists but could not find ID")
                    else:
                        print(f"⚠️  List failed: {list_resp.status_code}")
                else:
                    print(f"⚠️  422: {msg[:100]}")
            elif response.status_code == 409:
                # Already exists — update password
                list_resp = await client.get(
                    f"{admin_url}?filter%5Bemail%5D={email}",
                    headers=headers,
                )
                if list_resp.status_code == 200:
                    users_data = list_resp.json()
                    if isinstance(users_data, list):
                        users_list = users_data
                    else:
                        users_list = users_data.get("users", [])
                    if users_list:
                        uid = users_list[0]["id"]
                        update_resp = await client.put(
                            f"{admin_url}/{uid}",
                            headers=headers,
                            json={"password": password, "email_confirm": True},
                        )
                        if update_resp.status_code in (200, 201, 204):
                            print(f"✅ Updated password (ID: {uid})")
                        else:
                            print(f"⚠️  Update: {update_resp.status_code}")
                else:
                    print(f"⚠️  409, list: {list_resp.status_code}")
            else:
                print(f"⚠️  {response.status_code}: {response.text[:100]}")

    print("\nDone! Demo users should now be able to log in with password 'Athon2025!'")


asyncio.run(main())
