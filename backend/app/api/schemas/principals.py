"""Principal Pydantic schemas for admin CRUD operations.

Supports creating, listing, viewing, updating, and soft-deleting
principal profiles. The create request includes user-identity fields
because creating a principal atomically creates the User record too.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Request Schemas ─────────────────────────────────────────


class CreatePrincipalRequest(BaseModel):
    """Request body for creating a new principal.

    Includes both user-level fields (email, password, name) and
    principal-specific fields (employee_code, appointment_type, tenure).
    """

    email: str = Field(..., description="Principal's email address (used for login)")
    password: str = Field(..., min_length=6, description="Temporary password for Supabase Auth")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(..., min_length=1, max_length=100, description="Last name")
    phone: str | None = Field(None, max_length=20, description="Phone number")
    employee_code: str = Field(
        ..., min_length=1, max_length=30, description="Unique employee code"
    )
    qualification: str | None = Field(None, max_length=200, description="Educational qualification")
    appointment_type: str = Field(
        "permanent", description="Appointment type (permanent, acting, interim)"
    )
    tenure_start_date: date = Field(..., description="Date tenure started")
    tenure_end_date: date | None = Field(None, description="Date tenure ended (null if current)")


class UpdatePrincipalRequest(BaseModel):
    """Request body for updating a principal. All fields optional."""

    first_name: str | None = Field(None, max_length=100, description="Updated first name")
    last_name: str | None = Field(None, max_length=100, description="Updated last name")
    phone: str | None = Field(None, max_length=20, description="Updated phone number")
    employee_code: str | None = Field(None, max_length=30, description="Updated employee code")
    qualification: str | None = Field(None, max_length=200, description="Updated qualification")
    appointment_type: str | None = Field(None, description="Updated appointment type")
    tenure_start_date: date | None = Field(None, description="Updated tenure start date")
    tenure_end_date: date | None = Field(None, description="Updated tenure end date")
    is_active: bool | None = Field(None, description="Account active status")


# ── Response Schemas ─────────────────────────────────────────


class PrincipalResponse(BaseModel):
    """Standard principal profile response."""

    id: str = Field(..., description="Principal UUID")
    user_id: str = Field(..., description="User UUID")
    email: str = Field(..., description="Email address")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    phone: str | None = None
    employee_code: str = Field(..., description="Employee code")
    qualification: str | None = None
    appointment_type: str = Field("permanent", description="Appointment type")
    tenure_start_date: date = Field(..., description="Tenure start date")
    tenure_end_date: date | None = None
    is_active: bool = Field(True, description="Account active status")
    created_at: str = Field("", description="ISO 8601 creation timestamp")
    updated_at: str = Field("", description="ISO 8601 last update timestamp")


class PrincipalListResponse(BaseModel):
    """Wrapper for a paginated list of principals."""

    principals: list[PrincipalResponse] = Field(..., description="List of principals")
    total: int = Field(0, description="Total number of principals matching the query")
    skip: int = Field(0, description="Offset used for pagination")
    limit: int = Field(50, description="Page size used")
