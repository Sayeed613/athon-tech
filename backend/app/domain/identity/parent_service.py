"""Parent service — business logic for admin CRUD + Parent Portal.

Admin CRUD provides:
    - Creating parent profiles (with User account)
    - Listing/searching parents within a school
    - Getting single parent with linked students
    - Updating parent profiles + associated User fields
    - Soft-deleting parent profiles

Parent Portal provides read-only views of children's academic data.

All operations are school-scoped for tenant isolation.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.models.parent import Parent
from app.repository.parents import ParentRepository
from app.repository.users import UserRepository
from app.domain.identity.user_service import UserService
from app.repository import reports as report_queries

logger = logging.getLogger("athon")


class ParentService:
    """Service for parent management + Parent Portal operations.

    Handles the full lifecycle of parent profiles including
    User account creation, profile updates, and read-only
    academic data views for the Parent Portal.
    """

    def __init__(
        self,
        db: AsyncSession | None = None,
        parent_repo: ParentRepository | None = None,
        user_repo: UserRepository | None = None,
    ) -> None:
        # Support both patterns:
        #   old: ParentService(db)     — Parent Portal (read-only)
        #   new: ParentService(db=db)   — admin CRUD
        if parent_repo is not None and user_repo is not None:
            self._parent_repo = parent_repo
            self._user_repo = user_repo
            self._user_service = UserService(user_repo)
            self.db = user_repo.db
        elif db is not None:
            self.db = db
            self._parent_repo = ParentRepository(db)
            self._user_repo = UserRepository(db)
            self._user_service = UserService(self._user_repo)
        else:
            raise ValueError("ParentService requires either db= or parent_repo+user_repo=")

    # ══════════════════════════════════════════════════════════════
    # Admin CRUD Operations
    # ══════════════════════════════════════════════════════════════

    async def create_parent(
        self,
        school_id: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        phone: str | None = None,
        occupation: str | None = None,
    ) -> Parent:
        """Create a new parent with an associated User account.

        Business rules:
            1. Email must be unique across the entire platform.
            2. User is created first via Supabase Auth + local User record.
            3. Parent profile is created linked to the User.

        Args:
            school_id: UUID of the school (tenant scope).
            email: Parent's email address.
            password: Temporary password for Supabase Auth.
            first_name: Parent's first name.
            last_name: Parent's last name.
            phone: Optional phone number.
            occupation: Optional occupation.

        Returns:
            The newly created Parent record.

        Raises:
            ValueError: If email already exists.
        """
        # Create User account
        user = await self._user_service.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            school_id=school_id,
            role=UserRole.PARENT,
            phone=phone,
        )

        # Create Parent profile
        parent = await self._parent_repo.create(
            user_id=user.id,
            school_id=school_id,
            occupation=occupation,
            is_verified=False,
        )

        logger.info("Created parent %s (%s)", parent.id, email)
        return parent

    async def get_parent(self, parent_id: str, school_id: str) -> Parent | None:
        """Get a single parent by ID with school isolation.

        Args:
            parent_id: UUID of the parent.
            school_id: School UUID for tenant isolation.

        Returns:
            The Parent record with user relation eagerly loaded, or None.
        """
        parent = await self._parent_repo.get_with_user(parent_id)
        if parent is None or str(parent.school_id) != school_id:
            return None
        return parent

    async def list_parents(
        self,
        school_id: str,
        search: str | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Parent], int]:
        """List parents in a school with optional search and status filter.

        Args:
            school_id: School UUID for tenant isolation.
            search: Optional search string (matches name, email).
            is_active: Optional active status filter.
            skip: Pagination offset.
            limit: Page size.

        Returns:
            Tuple of (parents_list, total_count).
        """
        return await self._parent_repo.search_by_name(
            school_id=school_id,
            search=search,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )

    async def update_parent(
        self,
        parent_id: str,
        school_id: str,
        parent_updates: dict,
        user_updates: dict | None = None,
    ) -> Parent | None:
        """Update a parent's profile and optionally associated User fields.

        Args:
            parent_id: UUID of the parent to update.
            school_id: School UUID for tenant isolation.
            parent_updates: Dict of parent-specific fields to update.
            user_updates: Optional dict of User fields to update.

        Returns:
            The updated Parent record, or None if not found.
        """
        parent = await self._parent_repo.get(parent_id)
        if parent is None or str(parent.school_id) != school_id:
            return None

        # Update parent fields
        updated = await self._parent_repo.update(parent_id, **parent_updates)

        # Update User fields if provided
        if user_updates and updated:
            user = await self._user_repo.get(parent.user_id)
            if user:
                await self._user_service.update_user_fields(user, **user_updates)

        logger.info("Updated parent %s", parent_id)
        return updated

    async def delete_parent(self, parent_id: str, school_id: str) -> bool:
        """Soft-delete a parent.

        Args:
            parent_id: UUID of the parent to delete.
            school_id: School UUID for tenant isolation.

        Returns:
            True if deleted, False if not found.
        """
        parent = await self._parent_repo.get(parent_id)
        if parent is None or str(parent.school_id) != school_id:
            return False

        result = await self._parent_repo.soft_delete(parent_id)
        logger.info("Soft-deleted parent %s", parent_id)
        return result is not None

    async def get_linked_students(
        self, parent_id: str, school_id: str,
    ) -> list[dict]:
        """Get all students linked to a parent via student_parents.

        Returns a list of dicts with link info and student details.
        """
        from app.models.student import Student
        from app.models.user import User
        from app.models.academic_class import Class
        from app.models.student_parent import StudentParent

        result = await self.db.execute(
            select(
                StudentParent.id,
                StudentParent.student_id,
                StudentParent.relationship,
                StudentParent.is_primary_contact,
                StudentParent.receive_whatsapp,
                User.first_name,
                User.last_name,
                Student.admission_number,
                Class.name.label("class_name"),
            )
            .join(StudentParent, StudentParent.student_id == Student.id)
            .join(User, Student.user_id == User.id)
            .outerjoin(Class, Student.class_id == Class.id)
            .where(
                StudentParent.parent_id == parent_id,
                StudentParent.school_id == school_id,
                Student.deleted_at.is_(None),
            )
        )
        rows = result.all()
        return [
            {
                "id": str(r.id),
                "student_id": str(r.student_id),
                "student_name": f"{r.first_name} {r.last_name}".strip(),
                "admission_number": str(r.admission_number),
                "class_name": r.class_name or "",
                "relationship": r.relationship.value if hasattr(r.relationship, "value") else str(r.relationship),
                "is_primary_contact": r.is_primary_contact,
                "receive_whatsapp": r.receive_whatsapp,
            }
            for r in rows
        ]

    # ══════════════════════════════════════════════════════════════
    # Parent Portal Operations (existing — read-only)
    # ══════════════════════════════════════════════════════════════

    async def get_parent_profile_id(self, user_id: str, school_id: str) -> str | None:
        """Resolve a user_id to a Parent profile ID."""
        from app.models.parent import Parent

        result = await self.db.execute(
            select(Parent.id).where(
                Parent.user_id == user_id,
                Parent.school_id == school_id,
                Parent.deleted_at.is_(None),
            )
        )
        row = result.one_or_none()
        return str(row[0]) if row else None

    async def get_linked_children(
        self, parent_profile_id: str, school_id: str,
    ) -> list[dict]:
        """Get all children linked to a parent via student_parents."""
        from app.models.student import Student
        from app.models.user import User
        from app.models.academic_class import Class
        from app.models.student_parent import StudentParent

        result = await self.db.execute(
            select(
                Student.id,
                User.first_name,
                User.last_name,
                Student.admission_number,
                Student.class_id,
                Class.name.label("class_name"),
                Class.section.label("class_section"),
                Student.roll_number,
            )
            .join(StudentParent, StudentParent.student_id == Student.id)
            .join(User, Student.user_id == User.id)
            .outerjoin(Class, Student.class_id == Class.id)
            .where(
                StudentParent.parent_id == parent_profile_id,
                StudentParent.school_id == school_id,
                Student.is_active.is_(True),
                Student.deleted_at.is_(None),
                Class.deleted_at.is_(None),
            )
        )
        rows = result.all()
        return [
            {
                "id": str(r.id),
                "first_name": str(r.first_name),
                "last_name": str(r.last_name),
                "admission_number": str(r.admission_number),
                "class_id": str(r.class_id),
                "class_name": f"{r.class_name} {r.class_section or ''}".strip(),
                "roll_number": r.roll_number,
            }
            for r in rows
        ]

    async def verify_child_access(
        self, parent_profile_id: str, child_student_id: str, school_id: str,
    ) -> bool:
        """Verify that a parent has access to a specific child."""
        from app.models.student_parent import StudentParent

        result = await self.db.execute(
            select(func.count(StudentParent.id)).where(
                StudentParent.parent_id == parent_profile_id,
                StudentParent.student_id == child_student_id,
                StudentParent.school_id == school_id,
            )
        )
        return (result.scalar() or 0) > 0

    async def get_recent_announcements(
        self, school_id: str, limit: int = 5,
    ) -> list[dict]:
        """Get recent school announcements for parent view."""
        from app.models.announcement import Announcement

        result = await self.db.execute(
            select(Announcement)
            .where(
                Announcement.school_id == school_id,
                Announcement.is_published.is_(True),
                Announcement.deleted_at.is_(None),
            )
            .where(
                (Announcement.expires_at.is_(None))
                | (Announcement.expires_at > datetime.now(timezone.utc))
            )
            .order_by(Announcement.created_at.desc())
            .limit(limit)
        )
        announcements = result.scalars().all()
        return [
            {
                "id": str(a.id),
                "title": a.title,
                "body": a.body,
                "priority": a.priority,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in announcements
        ]

    async def count_unread(self, user_id: str, school_id: str) -> int:
        """Count unread notifications for the parent user."""
        from app.models.notification import Notification
        from app.models.notification_recipient import NotificationRecipient

        result = await self.db.execute(
            select(func.count(NotificationRecipient.id))
            .join(Notification, NotificationRecipient.notification_id == Notification.id)
            .where(
                NotificationRecipient.user_id == user_id,
                Notification.school_id == school_id,
                NotificationRecipient.is_read.is_(False),
            )
        )
        return result.scalar() or 0

    async def get_dashboard(
        self, user_id: str, school_id: str,
    ) -> dict:
        """Compose parent dashboard — per-child metrics + announcements."""
        parent_profile_id = await self.get_parent_profile_id(user_id, school_id)
        if parent_profile_id is None:
            return {"children": [], "recent_announcements": [], "unread_notifications": 0}

        children = await self.get_linked_children(parent_profile_id, school_id)

        child_items = []
        for child in children:
            child_id = child["id"]

            att = await report_queries.get_attendance_summary(
                self.db, school_id, student_id=child_id,
            )
            hw_assigned = await self._count_homework_assigned(child["class_id"], school_id)
            hw_submitted = await self._count_homework_submitted(child_id, school_id)
            hw_completion = round((hw_submitted / hw_assigned) * 100, 2) if hw_assigned > 0 else 0.0
            hw_avg = await report_queries.get_student_homework_average(self.db, child_id)
            test_summary = await report_queries.get_student_test_summary(
                self.db, child_id, school_id,
            )

            child_items.append({
                "child": child,
                "attendance_percentage": att["present_percentage"],
                "homework_completion_rate": hw_completion,
                "homework_average_score": hw_avg,
                "tests_average_score": test_summary["average_score"],
                "tests_pass_rate": test_summary["pass_rate"],
                "unread_notifications": 0,
            })

        announcements = await self.get_recent_announcements(school_id)
        unread = await self.count_unread(user_id, school_id)

        return {
            "children": child_items,
            "recent_announcements": announcements,
            "unread_notifications": unread,
        }

    async def _count_homework_assigned(self, class_id: str, school_id: str) -> int:
        from app.models.homework import Homework

        result = await self.db.execute(
            select(func.count(Homework.id)).where(
                Homework.class_id == class_id,
                Homework.school_id == school_id,
                Homework.is_published.is_(True),
                Homework.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def _count_homework_submitted(self, student_id: str, school_id: str) -> int:
        from app.models.homework_submission import HomeworkSubmission

        result = await self.db.execute(
            select(func.count(HomeworkSubmission.id)).where(
                HomeworkSubmission.student_id == student_id,
                HomeworkSubmission.school_id == school_id,
            )
        )
        return result.scalar() or 0

    async def get_attendance(
        self, parent_profile_id: str, school_id: str,
        child_id: str | None = None,
    ) -> list[dict]:
        """Get attendance for one or all linked children."""
        children = await self.get_linked_children(parent_profile_id, school_id)

        results = []
        for child in children:
            if child_id and child["id"] != child_id:
                continue
            att = await report_queries.get_attendance_summary(
                self.db, school_id, student_id=child["id"],
            )
            results.append({
                "child_id": child["id"],
                "child_name": f"{child['first_name']} {child['last_name']}".strip(),
                "present_percentage": att["present_percentage"],
                "absent_percentage": att["absent_percentage"],
                "total_records": att["total_records"],
            })
        return results

    async def get_homework(
        self, parent_profile_id: str, school_id: str,
        child_id: str | None = None,
    ) -> list[dict]:
        """Get homework summary for one or all linked children."""
        children = await self.get_linked_children(parent_profile_id, school_id)

        results = []
        for child in children:
            if child_id and child["id"] != child_id:
                continue
            assigned = await self._count_homework_assigned(child["class_id"], school_id)
            submitted = await self._count_homework_submitted(child["id"], school_id)
            avg_score = await report_queries.get_student_homework_average(self.db, child["id"])
            completion = round((submitted / assigned) * 100, 2) if assigned > 0 else 0.0

            results.append({
                "child_id": child["id"],
                "child_name": f"{child['first_name']} {child['last_name']}".strip(),
                "total_assigned": assigned,
                "submitted": submitted,
                "completion_rate": completion,
                "average_score": avg_score,
            })
        return results

    async def get_tests(
        self, parent_profile_id: str, school_id: str,
        child_id: str | None = None,
    ) -> list[dict]:
        """Get test summary for one or all linked children."""
        children = await self.get_linked_children(parent_profile_id, school_id)

        results = []
        for child in children:
            if child_id and child["id"] != child_id:
                continue

            from app.models.test import Test

            test_count = await self.db.execute(
                select(func.count(Test.id)).where(
                    Test.class_id == child["class_id"],
                    Test.school_id == school_id,
                    Test.is_published.is_(True),
                    Test.deleted_at.is_(None),
                )
            )
            total_tests = test_count.scalar() or 0

            test_summary = await report_queries.get_student_test_summary(
                self.db, child["id"], school_id,
            )

            results.append({
                "child_id": child["id"],
                "child_name": f"{child['first_name']} {child['last_name']}".strip(),
                "total_tests": total_tests,
                "attempted": test_summary["attempted"],
                "average_score": test_summary["average_score"],
                "highest_score": test_summary["highest_score"],
                "pass_rate": test_summary["pass_rate"],
            })
        return results
