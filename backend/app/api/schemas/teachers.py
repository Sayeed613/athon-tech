"""Teacher Pydantic schemas for admin CRUD operations.

These schemas support creating, listing, viewing, updating, and
soft-deleting teacher profiles. The create request also accepts
user-identity fields (email, password, first_name, last_name)
because creating a teacher atomically creates the User record too.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Nested Info ──────────────────────────────────────────────


class TeacherAssignmentInfo(BaseModel):
    """Nested teacher-class-subject assignment summary."""

    id: str = Field(..., description="Assignment UUID")
    class_id: str = Field(..., description="Class UUID")
    class_name: str = Field("", description="Class name")
    subject_id: str = Field(..., description="Subject UUID")
    subject_name: str = Field("", description="Subject name")
    academic_term_id: str = Field(..., description="Academic term UUID")
    is_class_teacher: bool = Field(False, description="Whether teacher is class teacher")


# ── Request Schemas ─────────────────────────────────────────


class CreateTeacherRequest(BaseModel):
    """Request body for creating a new teacher.

    Includes both user-level fields (email, password, name) and
    teacher-specific fields (employee_code, qualification, etc.).
    """

    email: str = Field(..., description="Teacher's email address (used for login)")
    password: str = Field(..., min_length=6, description="Temporary password for Supabase Auth")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    employee_code: str = Field(..., min_length=1, max_length=30, description="Unique employee code")
    qualification: str | None = Field(None, max_length=200, description="Educational qualification")
    specialization: str | None = Field(None, max_length=200, description="Subject specialization")
    hire_date: date = Field(..., description="Date of hiring")


class UpdateTeacherRequest(BaseModel):
    """Request body for updating a teacher. All fields optional."""

    first_name: str | None = Field(None, max_length=100, description="Updated first name")
    last_name: str | None = Field(None, max_length=100, description="Updated last name")
    phone: str | None = Field(None, max_length=20, description="Updated phone number")
    employee_code: str | None = Field(None, max_length=30, description="Updated employee code")
    qualification: str | None = Field(None, max_length=200, description="Updated qualification")
    specialization: str | None = Field(None, max_length=200, description="Updated specialization")
    hire_date: date | None = Field(None, description="Updated hire date")
    is_active: bool | None = Field(None, description="Account active status")


# ── Response Schemas ─────────────────────────────────────────


class TeacherResponse(BaseModel):
    """Standard teacher profile response."""

    id: str = Field(..., description="Teacher UUID")
    user_id: str = Field(..., description="User UUID")
    email: str = Field(..., description="Email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    phone: str | None = None
    employee_code: str = Field(..., description="Employee code")
    qualification: str | None = None
    specialization: str | None = None
    hire_date: date = Field(..., description="Date of hiring")
    is_class_teacher: bool = Field(False, description="Whether this teacher is a class teacher")
    is_active: bool = Field(True, description="Account active status")
    created_at: str = Field("", description="ISO 8601 creation timestamp")
    updated_at: str = Field("", description="ISO 8601 last update timestamp")

    # Nested info (populated for detail view)
    assignments: list[TeacherAssignmentInfo] = Field(
        default_factory=list, description="Teacher's class/subject assignments"
    )


class TeacherListResponse(BaseModel):
    """Wrapper for a paginated list of teachers."""

    teachers: list[TeacherResponse] = Field(..., description="List of teachers")
    total: int = Field(0, description="Total number of teachers matching the query")
    skip: int = Field(0, description="Offset used for pagination")
    limit: int = Field(50, description="Page size used")
