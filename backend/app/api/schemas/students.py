"""Student Pydantic schemas for admin CRUD operations.

Supports creating, listing, viewing, updating, soft-deleting, and
bulk-importing student profiles. The create request includes
user-identity fields because creating a student atomically creates
the User record, Student profile, and ClassEnrollment.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Nested Info ──────────────────────────────────────────────


class StudentParentInfo(BaseModel):
    """Nested linked-parent summary for student responses."""

    id: str = Field(..., description="StudentParent link UUID")
    parent_id: str = Field(..., description="Parent UUID")
    parent_name: str = Field("", description="Parent's full name")
    relationship: str = Field("", description="Relationship type (father, mother, etc.)")
    is_primary_contact: bool = Field(False, description="Primary contact flag")


class StudentEnrollmentInfo(BaseModel):
    """Nested class enrollment history for student responses."""

    id: str = Field(..., description="Enrollment UUID")
    class_id: str = Field(..., description="Class UUID")
    class_name: str = Field("", description="Class name")
    academic_year_id: str = Field(..., description="Academic year UUID")
    academic_year_name: str = Field("", description="Year name")
    status: str = Field("active", description="Enrollment status")
    enrolled_at: str = Field("", description="Enrollment timestamp")


# ── Request Schemas ─────────────────────────────────────────


class CreateStudentRequest(BaseModel):
    """Request body for creating a new student.

    Creates the User record, Student profile, and optionally a
    ClassEnrollment in one atomic operation.
    """

    email: str = Field(..., description="Student's email address (used for login)")
    password: str = Field(..., min_length=6, description="Temporary password for Supabase Auth")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    admission_number: str = Field(
        ..., min_length=1, max_length=30, description="Unique admission number"
    )
    class_id: str = Field(..., description="UUID of the class to enroll in")
    roll_number: str | None = Field(None, max_length=10, description="Roll number within class")
    date_of_birth: date | None = Field(None, description="Date of birth")
    gender: str | None = Field(None, pattern="^(male|female|other)$", description="Gender")
    enrollment_date: date | None = Field(None, description="Enrollment date (defaults to today)")


class UpdateStudentRequest(BaseModel):
    """Request body for updating a student. All fields optional."""

    first_name: str | None = Field(None, max_length=100, description="Updated first name")
    last_name: str | None = Field(None, max_length=100, description="Updated last name")
    phone: str | None = Field(None, max_length=20, description="Updated phone number")
    admission_number: str | None = Field(None, max_length=30, description="Updated admission number")
    class_id: str | None = Field(None, description="UUID of new class (creates enrollment)")
    roll_number: str | None = Field(None, max_length=10, description="Updated roll number")
    date_of_birth: date | None = Field(None, description="Updated date of birth")
    gender: str | None = Field(None, pattern="^(male|female|other)$", description="Updated gender")
    is_active: bool | None = Field(None, description="Account active status")


class BulkStudentItem(BaseModel):
    """A single student record within a bulk import request."""

    email: str = Field(..., description="Student's email address")
    password: str = Field(..., min_length=6, description="Temporary password")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    admission_number: str = Field(..., min_length=1, max_length=30, description="Admission number")
    roll_number: str | None = Field(None, max_length=10, description="Roll number")
    class_id: str = Field(..., description="Class UUID")
    date_of_birth: date | None = Field(None, description="Date of birth")
    gender: str | None = Field(None, pattern="^(male|female|other)$", description="Gender")


class BulkImportRequest(BaseModel):
    """Request body for bulk importing students."""

    students: list[BulkStudentItem] = Field(
        ..., min_length=1, max_length=500, description="List of students to import"
    )


# ── Response Schemas ─────────────────────────────────────────


class StudentResponse(BaseModel):
    """Standard student profile response."""

    id: str = Field(..., description="Student UUID")
    user_id: str = Field(..., description="User UUID")
    email: str = Field(..., description="Email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    phone: str | None = None
    admission_number: str = Field(..., description="Admission number")
    class_id: str = Field(..., description="Current class UUID")
    class_name: str = Field("", description="Current class name")
    roll_number: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    enrollment_date: date | None = None
    is_active: bool = Field(True, description="Account active status")
    created_at: str = Field("", description="ISO 8601 creation timestamp")
    updated_at: str = Field("", description="ISO 8601 last update timestamp")

    # Nested info (populated for detail view)
    parents: list[StudentParentInfo] = Field(
        default_factory=list, description="Linked parents"
    )
    enrollments: list[StudentEnrollmentInfo] = Field(
        default_factory=list, description="Enrollment history"
    )


class StudentListResponse(BaseModel):
    """Wrapper for a paginated list of students."""

    students: list[StudentResponse] = Field(..., description="List of students")
    total: int = Field(0, description="Total number of students matching the query")
    skip: int = Field(0, description="Offset used for pagination")
    limit: int = Field(50, description="Page size used")


class BulkImportResponse(BaseModel):
    """Response for bulk student import."""

    imported: int = Field(0, description="Number of students successfully imported")
    failed: int = Field(0, description="Number of students that failed to import")
    errors: list[dict] = Field(
        default_factory=list, description="Error details per failed row"
    )
