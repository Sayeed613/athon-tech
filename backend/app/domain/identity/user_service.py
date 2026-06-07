"""User service — business logic for unified User account creation.

Provides:
    - Creating User records (with optional Supabase Auth registration)
    - Email uniqueness validation
    - Profile existence checks

When Supabase Auth is configured, the service registers the user
via the Supabase Auth admin API with the service role key. In
development (no Supabase configured), it generates a placeholder
supabase_user_id UUID.
"""

import logging
import uuid
from typing import Any

import httpx

from app.core.config import settings
from app.models.enums import UserRole
from app.repository.users import UserRepository

logger = logging.getLogger("athon")


class UserService:
    """Service for User account management.

    Handles creation of User records across all roles with
    proper Supabase Auth integration and uniqueness guarantees.
    """

    def __init__(self, user_repo: UserRepository) -> None:
        self._user_repo = user_repo

    async def _validate_email_unique(self, email: str) -> None:
        """Check that the email is not already in use.

        Raises:
            ValueError: If the email is already registered.
        """
        exists = await self._user_repo.email_exists(email)
        if exists:
            raise ValueError(f"Email already exists: {email}")

    async def _create_supabase_user(
        self, email: str, password: str
    ) -> str:
        """Register a user with Supabase Auth and return the supabase_user_id.

        In development (no Supabase configured), generates a random UUID
        as a placeholder, since Supabase Auth is not available.

        Args:
            email: User's email address.
            password: User's password.

        Returns:
            The Supabase Auth user UUID.
        """
        if not settings.supabase_url or not settings.supabase_service_key:
            # Development mode — generate placeholder UUID
            supabase_id = str(uuid.uuid4())
            logger.info(
                "Dev mode: generated placeholder supabase_user_id=%s for email=%s",
                supabase_id, email,
            )
            return supabase_id

        # Production: call Supabase Auth admin API
        signup_url = f"{settings.supabase_url}/auth/v1/admin/users"
        headers = {
            "apikey": settings.supabase_service_key,
            "Authorization": f"Bearer {settings.supabase_service_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {},
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(signup_url, headers=headers, json=payload)

        if response.status_code not in (200, 201):
            logger.error(
                "Supabase admin create user failed: %s %s",
                response.status_code, response.text,
            )
            raise ValueError(f"Failed to create user in Supabase Auth: {response.text}")

        supabase_user_id = response.json()["id"]
        logger.info("Created Supabase Auth user: %s", supabase_user_id)
        return supabase_user_id

    async def create_user(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        school_id: str,
        role: UserRole,
        phone: str | None = None,
    ) -> Any:
        """Create a new User record with Supabase Auth integration.

        Args:
            email: Email address (unique).
            password: Password for Supabase Auth.
            first_name: User's first name.
            last_name: User's last name.
            school_id: School UUID (tenant scope).
            role: User role (teacher, student, principal, etc.).
            phone: Optional phone number.

        Returns:
            The newly created User ORM instance.

        Raises:
            ValueError: If the email is already in use or Supabase
                user creation fails.
        """
        await self._validate_email_unique(email)

        supabase_user_id = await self._create_supabase_user(email, password)

        return await self._user_repo.create(
            email=email,
            phone=phone,
            supabase_user_id=supabase_user_id,
            first_name=first_name,
            last_name=last_name,
            school_id=school_id,
            role=role.value,
            is_active=True,
        )

    async def update_user_fields(
        self, user: Any, **kwargs: Any
    ) -> Any:
        """Update specific fields on an existing User record.

        Args:
            user: The User ORM instance to update.
            **kwargs: Fields to update (first_name, last_name, phone, etc.).

        Returns:
            The updated User ORM instance.
        """
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)

        return user
