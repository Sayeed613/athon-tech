"""Parent Pydantic schemas — admin CRUD + parent portal views.

Parent Portal schemas are read-only views for parents/guardians.
Admin CRUD schemas support creating, listing, viewing, updating,
and soft-deleting parent profiles.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ═════════════════════════════════════════════════════════════════
# Admin CRUD Schemas
# ═════════════════════════════════════════════════════════════════


# ── Nested Info ──────────────────────────────────────────────


class ParentLinkedStudentInfo(BaseModel):
    """Nested linked-student summary for parent responses."""

    id: str = Field(..., description="StudentParent link UUID")
    student_id: str = Field(..., description="Student UUID")
    student_name: str = Field("", description="Student's full name")
    admission_number: str = Field("", description="Student admission number")
    class_name: str = Field("", description="Student's class name")
    relationship: str = Field("", description="Relationship (father, mother, etc.)")
    is_primary_contact: bool = Field(False, description="Primary contact flag")


# ── Request Schemas ─────────────────────────────────────────


class CreateParentRequest(BaseModel):
    """Request body for creating a new parent.

    Includes both user-level fields (email, password, name) and
    parent-specific fields (occupation).
    """

    email: str = Field(..., description="Parent's email address (used for login)")
    password: str = Field(..., min_length=6, description="Temporary password for Supabase Auth")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    occupation: str | None = Field(None, max_length=100, description="Parent's occupation")


class UpdateParentRequest(BaseModel):
    """Request body for updating a parent. All fields optional."""

    first_name: str | None = Field(None, max_length=100, description="Updated first name")
    last_name: str | None = Field(None, max_length=100, description="Updated last name")
    phone: str | None = Field(None, max_length=20, description="Updated phone number")
    occupation: str | None = Field(None, max_length=100, description="Updated occupation")
    is_active: bool | None = Field(None, description="Account active status")


# ── Response Schemas ─────────────────────────────────────────


class ParentResponse(BaseModel):
    """Standard parent profile response for admin views."""

    id: str = Field(..., description="Parent UUID")
    user_id: str = Field(..., description="User UUID")
    email: str = Field(..., description="Email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    phone: str | None = None
    occupation: str | None = None
    is_verified: bool = Field(False, description="Whether parent identity is verified")
    is_active: bool = Field(True, description="Account active status")
    created_at: str = Field("", description="ISO 8601 creation timestamp")
    updated_at: str = Field("", description="ISO 8601 last update timestamp")

    # Nested info (populated for detail view)
    linked_students: list[ParentLinkedStudentInfo] = Field(
        default_factory=list, description="Linked students"
    )


class ParentListResponse(BaseModel):
    """Wrapper for a paginated list of parents."""

    parents: list[ParentResponse] = Field(..., description="List of parents")
    total: int = Field(0, description="Total number of parents matching the query")
    skip: int = Field(0, description="Offset used for pagination")
    limit: int = Field(50, description="Page size used")


# ═════════════════════════════════════════════════════════════════
# Parent Portal Schemas (unchanged — read-only views)
# ═════════════════════════════════════════════════════════════════


# ── Child Info ──────────────────────────────────────────────────


class ChildInfo(BaseModel):
    """Basic info about a linked child."""

    id: str = Field(..., description="Student UUID")
    first_name: str = Field("", description="Student's first name")
    last_name: str = Field("", description="Student's last name")
    admission_number: str = Field("", description="Admission number")
    class_id: str = Field("", description="Class UUID")
    class_name: str = Field("", description="Class name")
    roll_number: str | None = None

    model_config = {"from_attributes": True}


# ── Dashboard ───────────────────────────────────────────────────


class ChildDashboardItem(BaseModel):
    """Per-child dashboard metrics for parent view."""

    child: ChildInfo = Field(..., description="Child information")
    attendance_percentage: float = Field(0.0, description="Attendance %")
    homework_completion_rate: float = Field(0.0, description="Homework completion %")
    homework_average_score: float = Field(0.0, description="Avg homework score")
    tests_average_score: float = Field(0.0, description="Avg test score")
    tests_pass_rate: float = Field(0.0, description="Test pass rate")
    unread_notifications: int = Field(0, description="Unread count")


class ParentDashboardResponse(BaseModel):
    """Parent's overview of all linked children."""

    children: list[ChildDashboardItem] = Field(
        default_factory=list, description="Per-child metrics"
    )
    recent_announcements: list = Field(
        default_factory=list, description="School announcements"
    )
    unread_notifications: int = Field(0, description="Total unread notifications")


# ── Children ─────────────────────────────────────────────────────


class ChildrenListResponse(BaseModel):
    """List of children linked to the parent."""

    children: list[ChildInfo] = Field(
        default_factory=list, description="Linked children"
    )
    total: int = Field(0, description="Number of children")


# ── Attendance ──────────────────────────────────────────────────


class ParentAttendanceResponse(BaseModel):
    """Attendance data for a parent's children."""

    child_id: str = Field(..., description="Student UUID")
    child_name: str = Field("", description="Student name")
    present_percentage: float = Field(0.0, description="Attendance %")
    absent_percentage: float = Field(0.0, description="Absent %")
    total_records: int = Field(0, description="Total attendance days")


class ParentAttendanceListResponse(BaseModel):
    """Attendance for one or more children."""

    records: list[ParentAttendanceResponse] = Field(
        default_factory=list, description="Per-child attendance"
    )


# ── Homework ────────────────────────────────────────────────────


class ParentHomeworkPerChild(BaseModel):
    """Homework summary for a single child."""

    child_id: str = Field(..., description="Student UUID")
    child_name: str = Field("", description="Student name")
    total_assigned: int = Field(0, description="Homeworks assigned")
    submitted: int = Field(0, description="Homeworks submitted")
    completion_rate: float = Field(0.0, description="Completion %")
    average_score: float = Field(0.0, description="Avg score on graded")


class ParentHomeworkResponse(BaseModel):
    """Homework data for a parent's children."""

    children: list[ParentHomeworkPerChild] = Field(
        default_factory=list, description="Per-child homework"
    )


# ── Tests ────────────────────────────────────────────────────────


class ParentTestPerChild(BaseModel):
    """Test summary for a single child."""

    child_id: str = Field(..., description="Student UUID")
    child_name: str = Field("", description="Student name")
    total_tests: int = Field(0, description="Tests assigned")
    attempted: int = Field(0, description="Tests attempted")
    average_score: float = Field(0.0, description="Average score")
    highest_score: float = Field(0.0, description="Highest score")
    pass_rate: float = Field(0.0, description="Pass rate")


class ParentTestsResponse(BaseModel):
    """Test data for a parent's children."""

    children: list[ParentTestPerChild] = Field(
        default_factory=list, description="Per-child tests"
    )


# ── Announcements ────────────────────────────────────────────────


class AnnouncementWidget(BaseModel):
    """Brief announcement for parent view."""

    id: str = Field(..., description="Announcement UUID")
    title: str = Field(..., description="Title")
    body: str | None = None
    priority: str = Field("normal", description="Priority")
    created_at: str = Field("", description="ISO 8601")


class ParentAnnouncementsResponse(BaseModel):
    """School announcements for parent."""

    announcements: list[AnnouncementWidget] = Field(
        default_factory=list, description="Recent announcements"
    )
    unread_notifications: int = Field(0, description="Unread count")
