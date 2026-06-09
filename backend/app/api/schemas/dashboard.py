"""Dashboard Pydantic schemas — aggregated views for each user role.

Each dashboard type consolidates data from existing services
(ReportService, NotificationService, etc.) into a single response.
No new aggregation logic — all metrics reuse existing report queries.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Shared Widgets ──────────────────────────────────────────────


class AnnouncementWidget(BaseModel):
    """Brief announcement for dashboard display."""

    id: str = Field(..., description="Announcement UUID")
    title: str = Field(..., description="Announcement title")
    body: str | None = None
    priority: str = Field("normal", description="Priority level")
    created_at: str = Field("", description="ISO 8601 timestamp")


class UnreadCountWidget(BaseModel):
    """Unread notification count."""

    count: int = Field(0, description="Number of unread notifications")


# ── Principal Dashboard ─────────────────────────────────────────


class PrincipalDashboardResponse(BaseModel):
    """Aggregated principal dashboard view."""

    total_students: int = Field(0, description="Active student count")
    total_teachers: int = Field(0, description="Active teacher count")
    attendance_percentage: float = Field(0.0, description="School-wide attendance %")
    homework_completion_rate: float = Field(0.0, description="Overall homework completion %")
    test_pass_rate: float = Field(0.0, description="Overall test pass rate")
    recent_announcements: list[AnnouncementWidget] = Field(
        default_factory=list, description="Latest announcements"
    )
    unread_notifications: UnreadCountWidget = Field(
        default_factory=lambda: UnreadCountWidget(count=0),
        description="Unread notification count",
    )


# ── Teacher Dashboard ────────────────────────────────────────────


class TimetableWidget(BaseModel):
    """Single timetable entry for dashboard display."""

    subject_name: str = Field("", description="Subject name")
    class_name: str = Field("", description="Class name")
    start_time: str = Field("", description="HH:MM start")
    end_time: str = Field("", description="HH:MM end")
    room_number: str | None = None


class TeacherDashboardResponse(BaseModel):
    """Aggregated teacher dashboard view."""

    classes_assigned: list[str] = Field(
        default_factory=list, description="Class names teacher teaches"
    )
    today_schedule: list[TimetableWidget] = Field(
        default_factory=list, description="Today's timetable"
    )
    attendance_pending_count: int = Field(0, description="Students without today's attendance")
    homework_pending_review: int = Field(
        0, description="Submissions awaiting grading"
    )
    upcoming_tests: int = Field(0, description="Tests scheduled for future")
    unread_notifications: UnreadCountWidget = Field(
        default_factory=lambda: UnreadCountWidget(count=0),
        description="Unread notification count",
    )


# ── Student Dashboard ────────────────────────────────────────────


class HomeworkDueWidget(BaseModel):
    """Homework due summary for student dashboard."""

    id: str = Field(..., description="Homework UUID")
    title: str = Field(..., description="Homework title")
    subject_name: str = Field("", description="Subject name")
    due_date: str = Field("", description="ISO 8601 due date")
    days_remaining: int = Field(0, description="Days until due")

    model_config = {"from_attributes": True}


class UpcomingTestWidget(BaseModel):
    """Upcoming test summary for student dashboard."""

    id: str = Field(..., description="Test UUID")
    title: str = Field(..., description="Test title")
    subject_name: str = Field("", description="Subject name")
    scheduled_at: str | None = None
    total_marks: float = Field(0.0)


class StudentDashboardResponse(BaseModel):
    """Aggregated student dashboard view."""

    today_timetable: list[TimetableWidget] = Field(
        default_factory=list, description="Today's class schedule"
    )
    homework_due: list[HomeworkDueWidget] = Field(
        default_factory=list, description="Upcoming homework deadlines"
    )
    upcoming_tests: list[UpcomingTestWidget] = Field(
        default_factory=list, description="Scheduled tests"
    )
    attendance_percentage: float = Field(0.0, description="Student's attendance %")
    recent_announcements: list[AnnouncementWidget] = Field(
        default_factory=list, description="Latest announcements"
    )
    unread_notifications: UnreadCountWidget = Field(
        default_factory=lambda: UnreadCountWidget(count=0),
        description="Unread notification count",
    )


# ── Parent Dashboard ────────────────────────────────────────────


class ParentDashboardResponse(BaseModel):
    """Aggregated parent dashboard view.

    Shows school-wide attendance percentage, recent announcements,
    and unread notification count. More child-specific data can
    be added when parent-child linking is implemented.
    """

    attendance_percentage: float = Field(0.0, description="School-wide attendance %")
    recent_announcements: list[AnnouncementWidget] = Field(
        default_factory=list, description="Latest announcements"
    )
    unread_notifications: UnreadCountWidget = Field(
        default_factory=lambda: UnreadCountWidget(count=0),
        description="Unread notification count",
    )


# ── Admin Dashboard ──────────────────────────────────────────────


class AdminDashboardResponse(BaseModel):
    """Aggregated school admin dashboard view."""

    total_students: int = Field(0, description="Active student count")
    total_teachers: int = Field(0, description="Active teacher count")
    total_parents: int = Field(0, description="Active parent count")
    active_classes: int = Field(0, description="Active class count")
    attendance_percentage: float = Field(0.0, description="School-wide attendance %")
    recent_announcements: list[AnnouncementWidget] = Field(
        default_factory=list, description="Latest announcements"
    )
    unread_notifications: UnreadCountWidget = Field(
        default_factory=lambda: UnreadCountWidget(count=0),
        description="Unread notification count",
    )
