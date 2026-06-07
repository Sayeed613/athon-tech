"""Attendance Pydantic schemas for request/response serialisation.

These schemas mirror the Attendance ORM model and provide structured
representations for API consumers.
"""

from __future__ import annotations

import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AttendanceStatusEnum(str, Enum):
    """Matches the attendance_status PostgreSQL ENUM type."""

    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"


# ── Student Info (nested in attendance response) ────────────────


class StudentInfo(BaseModel):
    """Nested student summary for attendance responses."""

    id: str = Field(..., description="Student UUID")
    admission_number: str = Field(..., description="Unique admission number")
    first_name: str = Field(..., description="Student's first name")
    last_name: str = Field(..., description="Student's last name")


class MarkerInfo(BaseModel):
    """Nested teacher (marker) summary for attendance responses."""

    id: str = Field(..., description="Teacher UUID")
    employee_code: str = Field(..., description="Teacher's employee code")
    name: str = Field(..., description="Teacher's full name")


# ── Request Schemas ─────────────────────────────────────────────


class BatchAttendanceItem(BaseModel):
    """A single student's attendance within a batch request."""

    student_id: str = Field(..., description="UUID of the student")
    status: AttendanceStatusEnum = Field(..., description="Attendance status")
    remarks: str | None = Field(None, max_length=500, description="Optional teacher notes")


class MarkAttendanceRequest(BaseModel):
    """Request body for marking a single attendance record."""

    student_id: str = Field(..., description="UUID of the student")
    class_id: str = Field(..., description="UUID of the class")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    date: datetime.date = Field(..., description="Date of the attendance record")
    status: AttendanceStatusEnum = Field(..., description="Attendance status")
    remarks: str | None = Field(None, max_length=500, description="Optional teacher notes")


class BatchMarkAttendanceRequest(BaseModel):
    """Request body for batch-marking attendance for a class."""

    class_id: str = Field(..., description="UUID of the class")
    academic_term_id: str = Field(..., description="UUID of the academic term")
    date: datetime.date = Field(..., description="Date of the attendance records")
    records: list[BatchAttendanceItem] = Field(
        ..., min_length=1, max_length=100,
        description="List of attendance records for students in the class",
    )


# ── Response Schemas ────────────────────────────────────────────


class AttendanceResponse(BaseModel):
    """Standard attendance record response."""

    id: str = Field(..., description="Attendance record UUID")
    student_id: str = Field(..., description="Student UUID")
    class_id: str = Field(..., description="Class UUID")
    academic_term_id: str = Field(..., description="Academic term UUID")
    attendance_date: datetime.date = Field(..., alias="date", description="Date of attendance")
    status: AttendanceStatusEnum = Field(..., description="Attendance status")
    marked_by: str = Field(..., description="Teacher UUID who marked this record")
    remarks: str | None = Field(None, description="Teacher notes")
    created_at: str = Field(..., description="ISO 8601 timestamp of creation")
    updated_at: str = Field(..., description="ISO 8601 timestamp of last update")

    # Nested info (only populated when explicitly loaded)
    student: StudentInfo | None = None
    marker: MarkerInfo | None = None


class AttendanceListResponse(BaseModel):
    """Wrapper for a list of attendance records."""

    records: list[AttendanceResponse] = Field(..., description="List of attendance records")
    total: int = Field(0, description="Total number of records in this response")
