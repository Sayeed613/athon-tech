"""Announcement API endpoints — create, list, update, and delete announcements.

All endpoints require authentication. Role-based access control ensures:
    - Principals can send school-wide, teachers-only, or class-specific
    - Teachers can only send to classes they teach
    - Students/parents have read-only access

Announcements automatically create notifications via NotificationService.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_user, require_role
from app.api.schemas.announcements import (
    AnnouncementListResponse,
    AnnouncementResponse,
    CreateAnnouncementRequest,
    SenderInfo,
    UpdateAnnouncementRequest,
)
from app.core.database import get_db
from app.domain.announcements.announcement_service import AnnouncementService
from app.domain.notifications.notification_service import NotificationService
from app.models.announcement import Announcement as AnnouncementModel
from app.models.user import User
from app.repository.announcement_repo import AnnouncementRepository
from app.repository.notification_recipient_repo import NotificationRecipientRepository
from app.repository.notification_repo import NotificationRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["announcements"])


# ── Helper Functions ────────────────────────────────────────────


def _build_announcement_response(
    announcement: AnnouncementModel,
) -> AnnouncementResponse:
    """Convert an Announcement ORM instance to a response schema."""
    resp = AnnouncementResponse(
        id=str(announcement.id),
        school_id=str(announcement.school_id),
        sender_id=str(announcement.sender_id),
        title=announcement.title,
        body=announcement.body,
        audience_type=announcement.audience_type,
        class_ids=announcement.class_ids,
        priority=announcement.priority,
        publish_at=announcement.publish_at,
        expires_at=announcement.expires_at,
        is_published=announcement.is_published,
        published_at=announcement.published_at,
        created_at=announcement.created_at.isoformat() if announcement.created_at else "",
        updated_at=announcement.updated_at.isoformat() if announcement.updated_at else "",
    )

    # Attach nested sender info if loaded
    if hasattr(announcement, "sender") and announcement.sender is not None:
        resp.sender = SenderInfo(
            id=str(announcement.sender.id),
            first_name=announcement.sender.first_name,
            last_name=announcement.sender.last_name,
            role=(
                announcement.sender.role.value
                if hasattr(announcement.sender.role, "value")
                else str(announcement.sender.role)
            ),
        )

    return resp


async def _get_teacher_class_ids(
    db: AsyncSession, user_id: str,
) -> list[str]:
    """Resolve class IDs for a teacher user by querying TeacherClassSubject."""
    from app.models.teacher import Teacher
    from app.models.teacher_class_subject import TeacherClassSubject

    result = await db.execute(
        select(Teacher).where(Teacher.user_id == user_id)
    )
    teacher = result.scalar_one_or_none()
    if teacher is None:
        return []

    tcs_result = await db.execute(
        select(TeacherClassSubject.class_id).where(
            TeacherClassSubject.teacher_id == teacher.id,
            TeacherClassSubject.deleted_at.is_(None),
        ).distinct()
    )
    return [str(row[0]) for row in tcs_result.all()]


async def _get_student_class_ids(
    db: AsyncSession, user_id: str,
) -> list[str]:
    """Resolve class IDs for a student user."""
    from app.models.student import Student

    result = await db.execute(
        select(Student).where(Student.user_id == user_id)
    )
    student = result.scalar_one_or_none()
    if student is None:
        return []
    return [str(student.class_id)]


async def _resolve_recipient_ids(
    db: AsyncSession,
    school_id: str,
    audience_type: str,
    class_ids: list[str] | None = None,
) -> list[str]:
    """Resolve recipient user IDs based on audience type.

    Args:
        db: Database session.
        school_id: School UUID to scope the query.
        audience_type: One of school_wide, teachers_only, specific_classes.
        class_ids: Required for specific_classes audience.

    Returns:
        A list of resolved user UUIDs.
    """
    from app.models.user import User
    from app.models.enums import UserRole

    if audience_type == "school_wide":
        result = await db.execute(
            select(User.id).where(
                User.school_id == school_id,
                User.is_active == True,  # noqa: E712
                User.deleted_at.is_(None),
            )
        )
        return [str(row[0]) for row in result.all()]

    if audience_type == "teachers_only":
        result = await db.execute(
            select(User.id).where(
                User.school_id == school_id,
                User.role == UserRole.TEACHER,
                User.is_active == True,  # noqa: E712
                User.deleted_at.is_(None),
            )
        )
        return [str(row[0]) for row in result.all()]

    if audience_type == "specific_classes" and class_ids:
        # Students in the specified classes
        from app.models.student import Student

        student_result = await db.execute(
            select(Student.user_id).where(
                Student.class_id.in_(class_ids),
                Student.deleted_at.is_(None),
            )
        )
        student_ids = [str(row[0]) for row in student_result.all()]

        # Teachers assigned to the specified classes
        from app.models.teacher import Teacher
        from app.models.teacher_class_subject import TeacherClassSubject

        tcs_result = await db.execute(
            select(Teacher.user_id).distinct().where(
                TeacherClassSubject.class_id.in_(class_ids),
                TeacherClassSubject.deleted_at.is_(None),
                Teacher.id == TeacherClassSubject.teacher_id,
                Teacher.deleted_at.is_(None),
            )
        )
        teacher_ids = [str(row[0]) for row in tcs_result.all()]

        return list(set(student_ids + teacher_ids))

    return []


# ── Service Factory ─────────────────────────────────────────────


def _build_service(db: AsyncSession) -> AnnouncementService:
    """Build an AnnouncementService with its dependencies."""
    notif_service = NotificationService(
        notification_repo=NotificationRepository(db),
        recipient_repo=NotificationRecipientRepository(db),
    )
    return AnnouncementService(
        announcement_repo=AnnouncementRepository(db),
        notification_service=notif_service,
    )


# ── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    body: CreateAnnouncementRequest,
    current_user: User = Depends(require_role("principal", "school_admin", "super_admin", "teacher")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new announcement.

    Role-based rules:
        - **Principal/Admin**: Can create any announcement type.
        - **Teacher**: Can only send to classes they teach
          (``specific_classes`` audience). Cannot send school-wide.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    # Teachers cannot send school-wide announcements
    if role_str == "teacher" and body.audience_type.value in (
        "school_wide", "teachers_only",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers cannot send school-wide or teacher-only announcements",
        )

    # Teachers can only send to their own classes
    if role_str == "teacher" and body.audience_type.value == "specific_classes":
        if not body.class_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="class_ids required for specific_classes audience",
            )
        # Verify teacher actually teaches these classes
        teacher_class_ids = await _get_teacher_class_ids(db, user_id)
        invalid = [
            cid for cid in body.class_ids
            if cid not in teacher_class_ids
        ]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You can only send announcements to classes you teach. "
                    f"Invalid class_ids: {invalid}"
                ),
            )

    service = _build_service(db)

    # Resolve recipient user IDs for notification creation
    recipient_ids = await _resolve_recipient_ids(
        db=db,
        school_id=school_id,
        audience_type=body.audience_type.value,
        class_ids=body.class_ids,
    )

    announcement = await service.create_announcement(
        school_id=school_id,
        sender_id=user_id,
        title=body.title,
        body=body.body,
        audience_type=body.audience_type.value,
        class_ids=body.class_ids,
        priority=body.priority.value,
        publish_at=body.publish_at,
        expires_at=body.expires_at,
        is_published=body.is_published,
        recipient_user_ids=recipient_ids,
    )

    return _build_announcement_response(announcement)


@router.get(
    "/announcements",
    response_model=AnnouncementListResponse,
)
async def get_announcements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number to skip"),
    limit: int = Query(50, ge=1, le=200, description="Max to return"),
    include_unpublished: bool = Query(
        False, description="Include drafts (principals/admins only)"
    ),
):
    """Get announcements visible to the authenticated user.

    Role-aware visibility:
        - **Principal/Admin**: All announcements (optionally including drafts).
        - **Teacher**: School-wide, teacher-only, and class-specific.
        - **Student/Parent**: School-wide and own class announcements.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    service = _build_service(db)

    # Resolve class IDs for students and teachers
    class_ids: list[str] | None = None
    if role_str == "student":
        class_ids = await _get_student_class_ids(db, user_id)
    elif role_str == "teacher":
        class_ids = await _get_teacher_class_ids(db, user_id)

    announcements = await service.get_announcements(
        school_id=school_id,
        user_role=role_str,
        class_ids=class_ids,
        skip=skip,
        limit=limit,
        include_unpublished=(
            include_unpublished if role_str
            in ("principal", "school_admin", "super_admin")
            else False
        ),
    )

    return AnnouncementListResponse(
        announcements=[_build_announcement_response(a) for a in announcements],
        total=len(announcements),
    )


@router.get(
    "/announcements/{announcement_id}",
    response_model=AnnouncementResponse,
)
async def get_announcement(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single announcement by ID."""
    service = _build_service(db)

    announcement = await service.get_announcement(announcement_id)
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return _build_announcement_response(announcement)


@router.patch(
    "/announcements/{announcement_id}",
    response_model=AnnouncementResponse,
)
async def update_announcement(
    announcement_id: str,
    body: UpdateAnnouncementRequest,
    current_user: User = Depends(require_role("principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update an announcement.

    Only principals and school admins can update announcements.
    """
    service = _build_service(db)

    # Build update kwargs, excluding None values
    update_kwargs = {}
    for field, value in body.model_dump(exclude_none=True).items():
        update_kwargs[field] = value

    if not update_kwargs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # If publishing, set published_at
    if update_kwargs.get("is_published"):
        from datetime import datetime, timezone

        update_kwargs["published_at"] = datetime.now(timezone.utc)

    announcement = await service.update_announcement(
        announcement_id=announcement_id,
        **update_kwargs,
    )
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return _build_announcement_response(announcement)


@router.delete(
    "/announcements/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_announcement(
    announcement_id: str,
    current_user: User = Depends(require_role("principal", "school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an announcement.

    Only principals and school admins can delete announcements.
    """
    service = _build_service(db)

    deleted = await service.delete_announcement(announcement_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
