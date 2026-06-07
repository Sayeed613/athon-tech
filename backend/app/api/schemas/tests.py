"""Test Pydantic schemas for request/response serialisation.

These schemas mirror the Test and TestAttempt ORM models and provide
structured representations for API consumers.
"""

from __future__ import annotations

import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AttemptStatusEnum(str, Enum):
    """Matches the attempt_status PostgreSQL ENUM type."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    RESULTS_PUBLISHED = "results_published"


# ── Nested Info Schemas ────────────────────────────────────────


class TeacherInfo(BaseModel):
    """Nested teacher summary for test responses."""

    id: str = Field(..., description="Teacher UUID")
    name: str = Field(..., description="Teacher's full name")
    employee_code: str = Field(..., description="Teacher's employee code")


class ClassInfo(BaseModel):
    """Nested class summary for test responses."""

    id: str = Field(..., description="Class UUID")
    name: str = Field(..., description="Class name")
    section: str | None = None


class SubjectInfo(BaseModel):
    """Nested subject summary for test responses."""

    id: str = Field(..., description="Subject UUID")
    name: str = Field(..., description="Subject name")
    code: str = Field(..., description="Subject code")


class StudentInfo(BaseModel):
    """Nested student summary for attempt responses."""

    id: str = Field(..., description="Student UUID")
    admission_number: str = Field(..., description="Admission number")
    first_name: str = Field(..., description="Student's first name")
    last_name: str = Field(..., description="Student's last name")


# ── Request Schemas ─────────────────────────────────────────────


class CreateTestRequest(BaseModel):
    """Request body for creating a new test/exam."""

    class_id: str = Field(..., description="UUID of the target class")
    subject_id: str = Field(..., description="UUID of the subject")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    title: str = Field(..., min_length=1, max_length=200, description="Test title")
    total_marks: float = Field(..., gt=0, description="Total marks for the test")
    duration_minutes: int = Field(
        ..., gt=0, le=480, description="Duration in minutes (max 480)"
    )
    description: str | None = Field(
        None, max_length=5000, description="Test description/instructions"
    )
    test_type: str = Field(
        "unit_test", description="Type: quiz, unit_test, midterm, final"
    )
    scheduled_at: datetime.datetime | None = Field(
        None, description="Optional scheduled date/time (ISO 8601)"
    )
    passing_percentage: float = Field(
        40.00, ge=0, le=100, description="Minimum percentage to pass"
    )
    is_published: bool = Field(
        False, description="Publish immediately (visible to students)"
    )


# ── Response Schemas ────────────────────────────────────────────


class TestResponse(BaseModel):
    """Standard test/exam response."""

    id: str = Field(..., description="Test UUID")
    class_id: str = Field(..., description="Class UUID")
    subject_id: str = Field(..., description="Subject UUID")
    teacher_id: str = Field(..., description="Teacher UUID")
    academic_term_id: str = Field(..., description="Academic term UUID")
    title: str = Field(..., description="Test title")
    description: str | None = None
    test_type: str = Field(..., description="Test type")
    total_marks: float = Field(..., description="Total marks")
    duration_minutes: int = Field(..., description="Duration in minutes")
    scheduled_at: datetime.datetime | None = None
    passing_percentage: float = Field(..., description="Passing percentage")
    is_published: bool = Field(..., description="Whether the test is published")
    published_at: datetime.datetime | None = None
    is_results_published: bool = Field(
        ..., description="Whether results are published"
    )
    version: int = Field(..., description="Revision counter")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")

    # Nested info (populated when loaded)
    teacher: TeacherInfo | None = None
    class_: ClassInfo | None = Field(None, alias="class")
    subject: SubjectInfo | None = None


class TestListResponse(BaseModel):
    """Wrapper for a list of tests."""

    tests: list[TestResponse] = Field(..., description="List of tests")
    total: int = Field(0, description="Total number of tests")


class AttemptResponse(BaseModel):
    """Standard test attempt response."""

    id: str = Field(..., description="Attempt UUID")
    test_id: str = Field(..., description="Test UUID")
    student_id: str = Field(..., description="Student UUID")
    status: AttemptStatusEnum = Field(..., description="Attempt status")
    started_at: datetime.datetime | None = Field(None, description="When started")
    submitted_at: datetime.datetime | None = Field(None, description="When submitted")
    total_score_auto: float | None = Field(None, description="Auto-graded score")
    total_score_manual: float | None = Field(None, description="Manual score")
    total_score: float | None = Field(None, description="Total score if graded")
    is_graded: bool = Field(False, description="Whether grading is complete")
    graded_by: str | None = Field(None, description="User UUID who graded")
    graded_at: datetime.datetime | None = Field(None, description="When graded")
    teacher_remarks: str | None = Field(None, description="Teacher's feedback")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")

    # Nested info
    student: StudentInfo | None = None


class AttemptListResponse(BaseModel):
    """Wrapper for a list of test attempts."""

    attempts: list[AttemptResponse] = Field(..., description="List of attempts")
    total: int = Field(0, description="Total number of attempts")
