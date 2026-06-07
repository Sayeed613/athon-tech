"""Teacher service — business logic for teacher profile management.

Provides:
    - Creating teacher profiles (with User account)
    - Listing/searching teachers within a school
    - Getting single teacher with assignments
    - Updating teacher profiles + associated User fields
    - Soft-deleting teacher profiles

All operations are school-scoped for tenant isolation.
"""

import logging
from datetime import datetime, timezone

from app.models.enums import UserRole
from app.models.teacher import Teacher
from app.repository.teachers import TeacherRepository
from app.repository.users import UserRepository
from app.domain.identity.user_service import UserService

logger = logging.getLogger("athon")


class TeacherService:
    """Service for teacher management.

    Handles the full lifecycle of teacher profiles including
    User account creation and profile field updates.
    """

    def __init__(
        self,
        teacher_repo: TeacherRepository,
        user_repo: UserRepository,
    ) -> None:
        self._teacher_repo = teacher_repo
        self._user_repo = user_repo
        self._user_service = UserService(user_repo)

    async def create_teacher(
        self,
        school_id: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        employee_code: str,
        hire_date: datetime,
        phone: str | None = None,
        qualification: str | None = None,
        specialization: str | None = None,
    ) -> Teacher:
        """Create a new teacher with an associated User account.

        Business rules:
            1. Email must be unique across the entire platform.
            2. Employee code must be unique per school.
            3. User is created first via Supabase Auth + local User record.
            4. Teacher profile is created linked to the User.

        Args:
            school_id: UUID of the school (tenant scope).
            email: Teacher's email address.
            password: Temporary password for Supabase Auth.
            first_name: Teacher's first name.
            last_name: Teacher's last name.
            employee_code: Unique employee code (per school).
            hire_date: Date of hiring.
            phone: Optional phone number.
            qualification: Optional educational qualification.
            specialization: Optional subject specialization.

        Returns:
            The newly created Teacher record.

        Raises:
            ValueError: If email already exists or employee_code is
                already taken within this school.
        """
        # Check employee_code uniqueness per school
        existing_teachers = await self._teacher_repo.get_multi(school_id=school_id)
        for t in existing_teachers:
            if t.employee_code == employee_code:
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
            role=UserRole.TEACHER,
            phone=phone,
        )

        # Create Teacher profile
        teacher = await self._teacher_repo.create(
            user_id=user.id,
            school_id=school_id,
            employee_code=employee_code,
            qualification=qualification,
            specialization=specialization,
            hire_date=hire_date,
            is_class_teacher=False,
        )

        logger.info("Created teacher %s (%s)", teacher.id, email)
        return teacher

    async def get_teacher(self, teacher_id: str, school_id: str) -> Teacher | None:
        """Get a single teacher by ID with school isolation.

        Args:
            teacher_id: UUID of the teacher.
            school_id: School UUID for tenant isolation.

        Returns:
            The Teacher record with assignments eagerly loaded, or None.
        """
        teacher = await self._teacher_repo.get_with_assignments(teacher_id)
        if teacher is None or str(teacher.school_id) != school_id:
            return None
        return teacher

    async def list_teachers(
        self,
        school_id: str,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Teacher], int]:
        """List teachers in a school with optional search.

        Args:
            school_id: School UUID for tenant isolation.
            search: Optional search string (matches name, employee_code).
            skip: Pagination offset.
            limit: Page size.

        Returns:
            Tuple of (teachers_list, total_count).
        """
        return await self._teacher_repo.search_by_name(
            school_id=school_id,
            search=search,
            skip=skip,
            limit=limit,
        )

    async def update_teacher(
        self,
        teacher_id: str,
        school_id: str,
        teacher_updates: dict,
        user_updates: dict | None = None,
    ) -> Teacher | None:
        """Update a teacher's profile and optionally associated User fields.

        Args:
            teacher_id: UUID of the teacher to update.
            school_id: School UUID for tenant isolation.
            teacher_updates: Dict of teacher-specific fields to update.
            user_updates: Optional dict of User fields to update (first_name,
                last_name, phone).

        Returns:
            The updated Teacher record, or None if not found.

        Raises:
            ValueError: If employee_code is already taken by another teacher
                in this school.
        """
        teacher = await self._teacher_repo.get(teacher_id)
        if teacher is None or str(teacher.school_id) != school_id:
            return None

        # Check employee_code uniqueness if changing
        if "employee_code" in teacher_updates:
            existing_teachers = await self._teacher_repo.get_multi(school_id=school_id)
            for t in existing_teachers:
                if (
                    str(t.id) != teacher_id
                    and t.employee_code == teacher_updates["employee_code"]
                ):
                    raise ValueError(
                        f"Employee code already exists: {teacher_updates['employee_code']}"
                    )

        # Update teacher fields
        updated = await self._teacher_repo.update(teacher_id, **teacher_updates)

        # Update User fields if provided
        if user_updates and updated:
            user = await self._user_repo.get(teacher.user_id)
            if user:
                await self._user_service.update_user_fields(user, **user_updates)

        logger.info("Updated teacher %s", teacher_id)
        return updated

    async def delete_teacher(self, teacher_id: str, school_id: str) -> bool:
        """Soft-delete a teacher.

        Args:
            teacher_id: UUID of the teacher to delete.
            school_id: School UUID for tenant isolation.

        Returns:
            True if deleted, False if not found.
        """
        teacher = await self._teacher_repo.get(teacher_id)
        if teacher is None or str(teacher.school_id) != school_id:
            return False

        result = await self._teacher_repo.soft_delete(teacher_id)
        logger.info("Soft-deleted teacher %s", teacher_id)
        return result is not None
