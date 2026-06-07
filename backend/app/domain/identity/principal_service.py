"""Principal service — business logic for principal profile management.

Provides:
    - Creating principal profiles (with User account)
    - Listing/searching principals within a school
    - Getting single principal details
    - Updating principal profiles
    - Soft-deleting principal profiles

All operations are school-scoped for tenant isolation.
"""

import logging
from datetime import datetime
from typing import Any

from app.models.enums import UserRole
from app.models.principal import Principal
from app.repository.principals import PrincipalRepository
from app.repository.users import UserRepository
from app.domain.identity.user_service import UserService

logger = logging.getLogger("athon")


class PrincipalService:
    """Service for principal management.

    Handles the full lifecycle of principal profiles including
    User account creation and tenure tracking.
    """

    def __init__(
        self,
        principal_repo: PrincipalRepository,
        user_repo: UserRepository,
    ) -> None:
        self._principal_repo = principal_repo
        self._user_repo = user_repo
        self._user_service = UserService(user_repo)

    async def create_principal(
        self,
        school_id: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        employee_code: str,
        tenure_start_date: datetime,
        phone: str | None = None,
        qualification: str | None = None,
        appointment_type: str = "permanent",
        tenure_end_date: datetime | None = None,
    ) -> Principal:
        """Create a new principal with an associated User account.

        Business rules:
            1. Email must be unique across the entire platform.
            2. Employee code must be unique per school.
            3. User is created first via Supabase Auth + local User record.
            4. Principal profile is created linked to the User.

        Args:
            school_id: UUID of the school (tenant scope).
            email: Principal's email address.
            password: Temporary password for Supabase Auth.
            first_name: Principal's first name.
            last_name: Principal's last name.
            employee_code: Unique employee code (per school).
            tenure_start_date: Date tenure started.
            phone: Optional phone number.
            qualification: Optional educational qualification.
            appointment_type: Type of appointment (permanent, acting, interim).
            tenure_end_date: Optional tenure end date.

        Returns:
            The newly created Principal record.

        Raises:
            ValueError: If email or employee_code already exists.
        """
        # Check employee_code uniqueness per school
        existing = await self._principal_repo.get_multi(school_id=school_id)
        for p in existing:
            if p.employee_code == employee_code:
                raise ValueError(
                    f"Employee code already exists: {employee_code}"
                )

        # Create User account
        user = await self._user_service.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            school_id=school_id,
            role=UserRole.PRINCIPAL,
            phone=phone,
        )

        # Create Principal profile
        principal = await self._principal_repo.create(
            user_id=user.id,
            school_id=school_id,
            employee_code=employee_code,
            qualification=qualification,
            appointment_type=appointment_type,
            tenure_start_date=tenure_start_date,
            tenure_end_date=tenure_end_date,
        )

        logger.info("Created principal %s (%s)", principal.id, email)
        return principal

    async def get_principal(self, principal_id: str, school_id: str) -> Principal | None:
        """Get a single principal by ID with school isolation.

        Args:
            principal_id: UUID of the principal.
            school_id: School UUID for tenant isolation.

        Returns:
            The Principal record with user eagerly loaded, or None.
        """
        principal = await self._principal_repo.get_with_user(principal_id)
        if principal is None or str(principal.school_id) != school_id:
            return None
        return principal

    async def list_principals(
        self,
        school_id: str,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Principal], int]:
        """List principals in a school with optional search.

        Args:
            school_id: School UUID for tenant isolation.
            search: Optional search string (matches name, employee_code).
            skip: Pagination offset.
            limit: Page size.

        Returns:
            Tuple of (principals_list, total_count).
        """
        return await self._principal_repo.search_by_name(
            school_id=school_id,
            search=search,
            skip=skip,
            limit=limit,
        )

    async def update_principal(
        self,
        principal_id: str,
        school_id: str,
        principal_updates: dict,
        user_updates: dict | None = None,
    ) -> Principal | None:
        """Update a principal's profile and optionally associated User fields.

        Args:
            principal_id: UUID of the principal to update.
            school_id: School UUID for tenant isolation.
            principal_updates: Dict of principal-specific fields to update.
            user_updates: Optional dict of User fields to update.

        Returns:
            The updated Principal record, or None if not found.

        Raises:
            ValueError: If employee_code is already taken.
        """
        principal = await self._principal_repo.get(principal_id)
        if principal is None or str(principal.school_id) != school_id:
            return None

        # Check employee_code uniqueness if changing
        if "employee_code" in principal_updates:
            existing = await self._principal_repo.get_multi(school_id=school_id)
            for p in existing:
                if (
                    str(p.id) != principal_id
                    and p.employee_code == principal_updates["employee_code"]
                ):
                    raise ValueError(
                        f"Employee code already exists: {principal_updates['employee_code']}"
                    )

        # Update principal fields
        updated = await self._principal_repo.update(principal_id, **principal_updates)

        # Update User fields if provided
        if user_updates and updated:
            user = await self._user_repo.get(principal.user_id)
            if user:
                await self._user_service.update_user_fields(user, **user_updates)

        logger.info("Updated principal %s", principal_id)
        return updated

    async def delete_principal(self, principal_id: str, school_id: str) -> bool:
        """Soft-delete a principal.

        Args:
            principal_id: UUID of the principal to delete.
            school_id: School UUID for tenant isolation.

        Returns:
            True if deleted, False if not found.
        """
        principal = await self._principal_repo.get(principal_id)
        if principal is None or str(principal.school_id) != school_id:
            return False

        result = await self._principal_repo.soft_delete(principal_id)
        logger.info("Soft-deleted principal %s", principal_id)
        return result is not None
