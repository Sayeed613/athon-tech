"""Academic Year and Term Pydantic schemas for admin CRUD operations."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


# ── Academic Year ────────────────────────────────────────────────


class CreateAcademicYearRequest(BaseModel):
    """Request body for creating a new academic year."""

    name: str = Field(..., min_length=1, max_length=50, description="Year name (e.g. '2025-2026')")
    start_date: date = Field(..., description="Year start date")
    end_date: date = Field(..., description="Year end date")
    is_current: bool = Field(False, description="Flag as current/active year")


class UpdateAcademicYearRequest(BaseModel):
    """Request body for updating an academic year."""

    name: str | None = Field(None, max_length=50, description="Updated name")
    start_date: date | None = Field(None, description="Updated start date")
    end_date: date | None = Field(None, description="Updated end date")
    is_current: bool | None = Field(None, description="Current flag")


class AcademicYearResponse(BaseModel):
    """Standard academic year response."""

    id: str = Field(..., description="Year UUID")
    name: str = Field(..., description="Year name")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    is_current: bool = Field(False, description="Current flag")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


class AcademicYearListResponse(BaseModel):
    """Wrapper for a list of academic years."""

    academic_years: list[AcademicYearResponse] = Field(..., description="List of years")
    total: int = Field(0, description="Total number of years")


# ── Academic Term ────────────────────────────────────────────────


class CreateAcademicTermRequest(BaseModel):
    """Request body for creating a new academic term."""

    academic_year_id: str = Field(..., description="UUID of the parent academic year")
    name: str = Field(..., min_length=1, max_length=50, description="Term name (e.g. 'Term 1')")
    start_date: date = Field(..., description="Term start date")
    end_date: date = Field(..., description="Term end date")
    is_current: bool = Field(False, description="Flag as current term")


class UpdateAcademicTermRequest(BaseModel):
    """Request body for updating an academic term."""

    name: str | None = Field(None, max_length=50, description="Updated name")
    start_date: date | None = Field(None, description="Updated start date")
    end_date: date | None = Field(None, description="Updated end date")
    is_current: bool | None = Field(None, description="Current flag")


class AcademicTermResponse(BaseModel):
    """Standard academic term response."""

    id: str = Field(..., description="Term UUID")
    academic_year_id: str = Field(..., description="Parent year UUID")
    academic_year_name: str = Field("", description="Parent year name")
    name: str = Field(..., description="Term name")
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")
    is_current: bool = Field(False, description="Current flag")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


class AcademicTermListResponse(BaseModel):
    """Wrapper for a list of academic terms."""

    academic_terms: list[AcademicTermResponse] = Field(..., description="List of terms")
    total: int = Field(0, description="Total number of terms")
