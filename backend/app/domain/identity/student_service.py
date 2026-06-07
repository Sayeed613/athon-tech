"""Student service — business logic for student profile management.

Provides:
    - Creating student profiles (with User account + ClassEnrollment)
    - Listing/searching students within a school
    - Getting single student with details (parents, enrollments)
    - Updating student profiles (with optional class change)
    - Soft-deleting student profiles
    - Bulk importing students

All operations are school-scoped for tenant isolation.
"""

import logging
from datetime import date, datetime, timezone
from typing import Any

from app.models.enums import UserRole
from app.models.student import Student
from app.repository.class_repo import ClassRepository
from app.repository.class_enrollments import ClassEnrollmentRepository
from app.repository.students import StudentRepository
from app.repository.users import UserRepository
from app.domain.identity.user_service import UserService

logger = logging.getLogger("athon")


class StudentService:
    """Service for student management.

    Handles the full lifecycle of student profiles including
    User account creation, ClassEnrollment tracking, and
    parent linking.
    """

    def __init__(
        self,
        student_repo: StudentRepository,
        user_repo: UserRepository,
        class_repo: ClassRepository,
        enrollment_repo: ClassEnrollmentRepository,
    ) -> None:
        self._student_repo = student_repo
        self._user_repo = user_repo
        self._class_repo = class_repo
        self._enrollment_repo = enrollment_repo
        self._user_service = UserService(user_repo)

    async def _validate_admission_unique(
        self, admission_number: str, school_id: str, exclude_id: str | None = None
    ) -> None:
        """Check that admission_number is unique per school."""
        existing = await self._student_repo.get_multi(school_id=school_id)
        for s in existing:
            if s.admission_number == admission_number:
                if exclude_id is None or str(s.id) != exclude_id:
                    raise ValueError(
                        f"Admission number already exists: {admission_number}"
                    )

    async def create_student(
        self,
        school_id: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        admission_number: str,
        class_id: str,
        phone: str | None = None,
        roll_number: str | None = None,
        date_of_birth: date | None = None,
        gender: str | None = None,
        enrollment_date: date | None = None,
    ) -> Student:
        """Create a new student with User account and ClassEnrollment.

        Business rules:
            1. Email must be unique across the entire platform.
            2. Admission number must be unique per school.
            3. Class must exist and belong to the same school.
            4. User account is created first.
            5. Student profile is created linked to the User and Class.
            6. ClassEnrollment record is created for enrollment history.

        Args:
            school_id: UUID of the school (tenant scope).
            email: Student's email address.
            password: Temporary password for Supabase Auth.
            first_name: Student's first name.
            last_name: Student's last name.
            admission_number: Unique admission number (per school).
            class_id: UUID of the class to enroll in.
            phone: Optional phone number.
            roll_number: Optional roll number within the class.
            date_of_birth: Optional date of birth.
            gender: Optional gender (male, female, other).
            enrollment_date: Optional enrollment date (defaults to today).

        Returns:
            The newly created Student record.

        Raises:
            ValueError: If email exists, admission number is taken,
                or class is not found.
        """
        # Validate admission number uniqueness
        await self._validate_admission_unique(admission_number, school_id)

        # Verify class exists in this school
        class_ = await self._class_repo.get(class_id)
        if class_ is None or str(class_.school_id) != school_id:
            raise ValueError(f"Class {class_id} not found in this school")

        # Create User account
        user = await self._user_service.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            school_id=school_id,
            role=UserRole.STUDENT,
            phone=phone,
        )

        # Create Student profile
        enroll_date = enrollment_date or date.today()
        student = await self._student_repo.create(
            user_id=user.id,
            school_id=school_id,
            class_id=class_id,
            admission_number=admission_number,
            roll_number=roll_number,
            date_of_birth=date_of_birth,
            gender=gender,
            enrollment_date=enroll_date,
            is_active=True,
        )

        # Create ClassEnrollment record
        await self._enrollment_repo.create(
            student_id=student.id,
            class_id=class_id,
            academic_year_id=class_.academic_year_id,
            school_id=school_id,
            status="active",
            enrolled_at=datetime.combine(enroll_date, datetime.min.time()),
            created_by=user.id,
        )

        logger.info("Created student %s (%s)", student.id, email)
        return student

    async def get_student(self, student_id: str, school_id: str) -> Student | None:
        """Get a single student by ID with all details.

        Args:
            student_id: UUID of the student.
            school_id: School UUID for tenant isolation.

        Returns:
            The Student record with user, class, parents, and enrollments, or None.
        """
        student = await self._student_repo.get_with_details(student_id)
        if student is None or str(student.school_id) != school_id:
            return None
        return student

    async def list_students(
        self,
        school_id: str,
        search: str | None = None,
        class_id: str | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Student], int]:
        """List students in a school with optional filters.

        Args:
            school_id: School UUID for tenant isolation.
            search: Optional search string (matches name, admission_number).
            class_id: Optional class filter.
            is_active: Optional active status filter.
            skip: Pagination offset.
            limit: Page size.

        Returns:
            Tuple of (students_list, total_count).
        """
        return await self._student_repo.search_by_name(
            school_id=school_id,
            search=search,
            class_id=class_id,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )

    async def update_student(
        self,
        student_id: str,
        school_id: str,
        student_updates: dict,
        user_updates: dict | None = None,
    ) -> Student | None:
        """Update a student's profile and optionally associated User fields.

        If class_id is changed, a new ClassEnrollment record is created.

        Args:
            student_id: UUID of the student to update.
            school_id: School UUID for tenant isolation.
            student_updates: Dict of student-specific fields to update.
            user_updates: Optional dict of User fields to update.

        Returns:
            The updated Student record, or None if not found.

        Raises:
            ValueError: If admission_number is already taken or class not found.
        """
        student = await self._student_repo.get(student_id)
        if student is None or str(student.school_id) != school_id:
            return None

        # Check admission_number uniqueness if changing
        if "admission_number" in student_updates:
            await self._validate_admission_unique(
                student_updates["admission_number"],
                school_id,
                exclude_id=student_id,
            )

        # Handle class change — create new enrollment
        if "class_id" in student_updates and (
            str(student_updates["class_id"]) != str(student.class_id)
        ):
            new_class_id = student_updates["class_id"]
            class_ = await self._class_repo.get(new_class_id)
            if class_ is None or str(class_.school_id) != school_id:
                raise ValueError(f"Class {new_class_id} not found in this school")

            await self._enrollment_repo.create(
                student_id=student.id,
                class_id=new_class_id,
                academic_year_id=class_.academic_year_id,
                school_id=school_id,
                status="active",
                enrolled_at=datetime.now(timezone.utc),
                created_by=student.user_id,
            )

        # Update student fields
        updated = await self._student_repo.update(student_id, **student_updates)

        # Update User fields if provided
        if user_updates and updated:
            user = await self._user_repo.get(student.user_id)
            if user:
                await self._user_service.update_user_fields(user, **user_updates)

        logger.info("Updated student %s", student_id)
        return updated

    async def delete_student(self, student_id: str, school_id: str) -> bool:
        """Soft-delete a student.

        Args:
            student_id: UUID of the student to delete.
            school_id: School UUID for tenant isolation.

        Returns:
            True if deleted, False if not found.
        """
        student = await self._student_repo.get(student_id)
        if student is None or str(student.school_id) != school_id:
            return False

        result = await self._student_repo.soft_delete(student_id)
        logger.info("Soft-deleted student %s", student_id)
        return result is not None

    async def bulk_import(
        self,
        school_id: str,
        students_data: list[dict[str, Any]],
    ) -> dict:
        """Bulk import students in a single transaction-safe batch.

        Args:
            school_id: School UUID for tenant isolation.
            students_data: List of student data dicts.

        Returns:
            Dict with 'imported', 'failed' counts and 'errors' list.
        """
        imported = 0
        failed = 0
        errors: list[dict] = []

        for i, data in enumerate(students_data):
            try:
                await self.create_student(
                    school_id=school_id,
                    email=data["email"],
                    password=data.get("password", "changeme123"),
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    admission_number=data["admission_number"],
                    class_id=data["class_id"],
                    phone=data.get("phone"),
                    roll_number=data.get("roll_number"),
                    date_of_birth=data.get("date_of_birth"),
                    gender=data.get("gender"),
                    enrollment_date=data.get("enrollment_date"),
                )
                imported += 1
            except (ValueError, Exception) as exc:
                failed += 1
                errors.append({
                    "row": i + 1,
                    "email": data.get("email", "unknown"),
                    "error": str(exc),
                })
                logger.warning(
                    "Bulk import row %d failed: %s", i + 1, exc
                )

        return {
            "imported": imported,
            "failed": failed,
            "errors": errors,
        }
