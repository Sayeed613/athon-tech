"""Homework Pydantic schemas for request/response serialisation.

These schemas mirror the Homework and HomeworkSubmission ORM models
and provide structured representations for API consumers.
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
    """Nested teacher summary for homework responses."""

    id: str = Field(..., description="Teacher UUID")
    name: str = Field(..., description="Teacher's full name")
    employee_code: str = Field(..., description="Teacher's employee code")


class ClassInfo(BaseModel):
    """Nested class summary for homework responses."""

    id: str = Field(..., description="Class UUID")
    name: str = Field(..., description="Class name")
    section: str | None = None


class SubjectInfo(BaseModel):
    """Nested subject summary for homework responses."""

    id: str = Field(..., description="Subject UUID")
    name: str = Field(..., description="Subject name")
    code: str = Field(..., description="Subject code")


class StudentInfo(BaseModel):
    """Nested student summary for submission responses."""

    id: str = Field(..., description="Student UUID")
    admission_number: str = Field(..., description="Admission number")
    first_name: str = Field(..., description="Student's first name")
    last_name: str = Field(..., description="Student's last name")


# ── Request Schemas ─────────────────────────────────────────────


class CreateHomeworkRequest(BaseModel):
    """Request body for creating a new homework assignment."""

    class_id: str = Field(..., description="UUID of the target class")
    subject_id: str = Field(..., description="UUID of the subject")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    title: str = Field(..., min_length=1, max_length=200, description="Homework title")
    due_date: datetime.datetime = Field(
        ..., description="Submission deadline (ISO 8601)"
    )
    description: str | None = Field(
        None, max_length=5000, description="Homework description/instructions"
    )
    max_score: float = Field(
        100.00, gt=0, description="Maximum possible score"
    )
    is_published: bool = Field(
        False, description="Publish immediately (visible to students)"
    )


# ── Response Schemas ────────────────────────────────────────────


class HomeworkResponse(BaseModel):
    """Standard homework assignment response."""

    id: str = Field(..., description="Homework UUID")
    class_id: str = Field(..., description="Class UUID")
    subject_id: str = Field(..., description="Subject UUID")
    teacher_id: str = Field(..., description="Teacher UUID")
    academic_term_id: str = Field(..., description="Academic term UUID")
    title: str = Field(..., description="Homework title")
    description: str | None = None
    due_date: datetime.datetime = Field(..., description="Submission deadline")
    max_score: float = Field(..., description="Maximum possible score")
    is_published: bool = Field(..., description="Whether the homework is published")
    published_at: datetime.datetime | None = None
    version: int = Field(..., description="Revision counter")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")

    # Nested info (populated when loaded)
    teacher: TeacherInfo | None = None
    class_: ClassInfo | None = Field(None, alias="class")
    subject: SubjectInfo | None = None


class HomeworkListResponse(BaseModel):
    """Wrapper for a list of homework assignments."""

    homeworks: list[HomeworkResponse] = Field(
        ..., description="List of homework assignments"
    )
    total: int = Field(0, description="Total number of assignments")


class SubmissionResponse(BaseModel):
    """Standard homework submission response."""

    id: str = Field(..., description="Submission UUID")
    homework_id: str = Field(..., description="Homework UUID")
    student_id: str = Field(..., description="Student UUID")
    status: AttemptStatusEnum = Field(..., description="Submission status")
    submitted_at: datetime.datetime | None = Field(None, description="When submitted")
    total_score: float | None = Field(None, description="Total score if graded")
    is_graded: bool = Field(False, description="Whether grading is complete")
    graded_by: str | None = Field(None, description="User UUID who graded")
    graded_at: datetime.datetime | None = Field(None, description="When graded")
    teacher_remarks: str | None = Field(None, description="Teacher's feedback")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")

    # Nested info
    student: StudentInfo | None = None


class SubmissionListResponse(BaseModel):
    """Wrapper for a list of homework submissions."""

    submissions: list[SubmissionResponse] = Field(
        ..., description="List of submissions"
    )
    total: int = Field(0, description="Total number of submissions")
