"""Parent API endpoints — admin CRUD + Parent Portal (read-only).

Admin CRUD (school_admin/super_admin only):
    - POST   /parents                — Create parent + user account
    - GET    /parents                — List/search parents
    - GET    /parents/{parent_id}    — Get parent detail with linked students
    - PATCH  /parents/{parent_id}    — Update parent profile
    - DELETE /parents/{parent_id}    — Soft-delete parent

Parent Portal (parent role, read-only):
    - GET /parent/dashboard     — Aggregated per-child dashboard
    - GET /parent/children      — List linked children
    - GET /parent/attendance    — Attendance per child
    - GET /parent/homework      — Homework per child
    - GET /parent/tests         — Tests per child
    - GET /parent/announcements — School announcements
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import require_role
from app.api.schemas.parents import (
    ChildrenListResponse,
    CreateParentRequest,
    ParentAnnouncementsResponse,
    ParentAttendanceListResponse,
    ParentDashboardResponse,
    ParentHomeworkResponse,
    ParentListResponse,
    ParentLinkedStudentInfo,
    ParentResponse,
    ParentTestsResponse,
    AnnouncementWidget,
    UpdateParentRequest,
)
from app.core.database import get_db
from app.domain.identity.parent_service import ParentService
from app.models.user import User
from app.repository.parents import ParentRepository
from app.repository.users import UserRepository

logger = logging.getLogger("athon")

router = APIRouter(tags=["parents"])


# ── Helper Functions ────────────────────────────────────────────


def _build_parent_response(parent, linked_students: list | None = None) -> ParentResponse:
    """Convert a Parent ORM instance to a ParentResponse schema."""
    user = getattr(parent, "user", None)
    resp = ParentResponse(
        id=str(parent.id),
        user_id=str(parent.user_id),
        email=user.email if user else "",
        first_name=user.first_name if user else "",
        last_name=user.last_name if user else "",
        phone=user.phone if user else None,
        occupation=parent.occupation,
        is_verified=parent.is_verified if hasattr(parent, "is_verified") else False,
        is_active=user.is_active if user else True,
        created_at=parent.created_at.isoformat() if parent.created_at else "",
        updated_at=parent.updated_at.isoformat() if parent.updated_at else "",
    )

    if linked_students:
        resp.linked_students = [
            ParentLinkedStudentInfo(**s) for s in linked_students
        ]

    return resp


def _build_service(db: AsyncSession) -> ParentService:
    """Build a ParentService with repository dependencies."""
    return ParentService(
        parent_repo=ParentRepository(db),
        user_repo=UserRepository(db),
    )


# ═════════════════════════════════════════════════════════════════
# Admin CRUD Endpoints
# ═════════════════════════════════════════════════════════════════


@router.post(
    "/parents",
    response_model=ParentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_parent(
    body: CreateParentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new parent with a User account.

    School admin only. The parent is created in the admin's school.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    try:
        parent = await service.create_parent(
            school_id=school_id,
            email=body.email,
            password=body.password,
            first_name=body.first_name,
            last_name=body.last_name,
            phone=body.phone,
            occupation=body.occupation,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    logger.info("Parent created: %s (%s)", parent.id, body.email)
    return _build_parent_response(parent)


@router.get(
    "/parents",
    response_model=ParentListResponse,
)
async def list_parents(
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None, description="Search by name or email"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
):
    """List parents in the school with optional search and status filter.

    School admin only. Returns paginated results.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    parents, total = await service.list_parents(
        school_id=school_id,
        search=search,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )

    return ParentListResponse(
        parents=[_build_parent_response(p) for p in parents],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/parents/{parent_id}",
    response_model=ParentResponse,
)
async def get_parent(
    parent_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin", "principal")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single parent's profile with linked students.

    Accessible by school admins and principals.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    parent = await service.get_parent(parent_id, school_id)
    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found",
        )

    linked_students = await service.get_linked_students(parent_id, school_id)
    return _build_parent_response(parent, linked_students=linked_students)


@router.patch(
    "/parents/{parent_id}",
    response_model=ParentResponse,
)
async def update_parent(
    parent_id: str,
    body: UpdateParentRequest,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a parent's profile fields.

    School admin only. Supports partial updates.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    parent_updates = {}
    user_updates = {}

    if body.occupation is not None:
        parent_updates["occupation"] = body.occupation
    if body.is_active is not None:
        user_updates["is_active"] = body.is_active
    if body.first_name is not None:
        user_updates["first_name"] = body.first_name
    if body.last_name is not None:
        user_updates["last_name"] = body.last_name
    if body.phone is not None:
        user_updates["phone"] = body.phone

    try:
        parent = await service.update_parent(
            parent_id=parent_id,
            school_id=school_id,
            parent_updates=parent_updates,
            user_updates=user_updates if user_updates else None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found",
        )

    return _build_parent_response(parent)


@router.delete(
    "/parents/{parent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_parent(
    parent_id: str,
    current_user: User = Depends(require_role("school_admin", "super_admin")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a parent (deactivate account).

    School admin only.
    """
    service = _build_service(db)
    school_id = str(current_user.school_id)

    deleted = await service.delete_parent(parent_id, school_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent not found",
        )


# ═════════════════════════════════════════════════════════════════
# Parent Portal Endpoints (existing — read-only)
# ═════════════════════════════════════════════════════════════════


# ── Dashboard ────────────────────────────────────────────────────


@router.get(
    "/parent/dashboard",
    response_model=ParentDashboardResponse,
)
async def parent_dashboard(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get parent dashboard — per-child metrics + announcements.

    Returns attendance %, homework completion, test averages for
    each linked child, along with recent school announcements and
    unread notification count.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    result = await service.get_dashboard(
        user_id=user_id,
        school_id=school_id,
    )

    return result


# ── Children ─────────────────────────────────────────────────────


@router.get(
    "/parent/children",
    response_model=ChildrenListResponse,
)
async def parent_children(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get list of children linked to the authenticated parent.

    Returns basic info (name, class, admission number) for each
    active student linked via student_parents.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    parent_profile_id = await service.get_parent_profile_id(user_id, school_id)

    if parent_profile_id is None:
        return ChildrenListResponse(children=[], total=0)

    children = await service.get_linked_children(parent_profile_id, school_id)

    return ChildrenListResponse(children=children, total=len(children))


# ── Attendance ────────────────────────────────────────────────────


@router.get(
    "/parent/attendance",
    response_model=ParentAttendanceListResponse,
)
async def parent_attendance(
    child_id: str | None = Query(None, description="Filter by child UUID"),
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get attendance summary for one or all linked children.

    Optionally filter by ``child_id`` to view a specific child.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    parent_profile_id = await service.get_parent_profile_id(user_id, school_id)
    if parent_profile_id is None:
        return ParentAttendanceListResponse(records=[])

    # If filtering by child, verify access
    if child_id and not await service.verify_child_access(
        parent_profile_id, child_id, school_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this child's data",
        )

    records = await service.get_attendance(
        parent_profile_id, school_id, child_id=child_id,
    )

    return ParentAttendanceListResponse(records=records)


# ── Homework ──────────────────────────────────────────────────────


@router.get(
    "/parent/homework",
    response_model=ParentHomeworkResponse,
)
async def parent_homework(
    child_id: str | None = Query(None, description="Filter by child UUID"),
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get homework summary for one or all linked children.

    Shows total assigned, submitted, completion rate, and average score.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    parent_profile_id = await service.get_parent_profile_id(user_id, school_id)
    if parent_profile_id is None:
        return ParentHomeworkResponse(children=[])

    if child_id and not await service.verify_child_access(
        parent_profile_id, child_id, school_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this child's data",
        )

    children = await service.get_homework(
        parent_profile_id, school_id, child_id=child_id,
    )

    return ParentHomeworkResponse(children=children)


# ── Tests ────────────────────────────────────────────────────────


@router.get(
    "/parent/tests",
    response_model=ParentTestsResponse,
)
async def parent_tests(
    child_id: str | None = Query(None, description="Filter by child UUID"),
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get test summary for one or all linked children.

    Shows total tests, attempted, average/highest scores, and pass rate.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    parent_profile_id = await service.get_parent_profile_id(user_id, school_id)
    if parent_profile_id is None:
        return ParentTestsResponse(children=[])

    if child_id and not await service.verify_child_access(
        parent_profile_id, child_id, school_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this child's data",
        )

    children = await service.get_tests(
        parent_profile_id, school_id, child_id=child_id,
    )

    return ParentTestsResponse(children=children)


# ── Announcements ────────────────────────────────────────────────


@router.get(
    "/parent/announcements",
    response_model=ParentAnnouncementsResponse,
)
async def parent_announcements(
    current_user: User = Depends(require_role("parent")),
    db: AsyncSession = Depends(get_db),
):
    """Get recent school announcements and unread notification count.

    Parents see school-wide announcements relevant to them.
    """
    user_id = str(current_user.id)
    school_id = str(current_user.school_id)

    service = ParentService(db)
    announcements = await service.get_recent_announcements(school_id)
    unread = await service.count_unread(user_id, school_id)

    return ParentAnnouncementsResponse(
        announcements=announcements,
        unread_notifications=unread,
    )
