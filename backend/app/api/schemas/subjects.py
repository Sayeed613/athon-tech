"""Subject Pydantic schemas for admin CRUD operations."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateSubjectRequest(BaseModel):
    """Request body for creating a new subject."""

    name: str = Field(..., min_length=1, max_length=100, description="Subject name (e.g. 'Mathematics')")
    code: str = Field(..., min_length=1, max_length=20, description="Subject code (e.g. 'MATH')")
    description: str | None = Field(None, max_length=1000, description="Subject description")
    is_core: bool = Field(True, description="Core/compulsory subject flag")


class UpdateSubjectRequest(BaseModel):
    """Request body for updating a subject. All fields optional."""

    name: str | None = Field(None, max_length=100, description="Updated name")
    code: str | None = Field(None, max_length=20, description="Updated code")
    description: str | None = Field(None, max_length=1000, description="Updated description")
    is_core: bool | None = Field(None, description="Core flag")


class SubjectResponse(BaseModel):
    """Standard subject response."""

    id: str = Field(..., description="Subject UUID")
    name: str = Field(..., description="Subject name")
    code: str = Field(..., description="Subject code")
    description: str | None = None
    is_core: bool = Field(True, description="Core subject flag")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


class SubjectListResponse(BaseModel):
    """Wrapper for a list of subjects."""

    subjects: list[SubjectResponse] = Field(..., description="List of subjects")
    total: int = Field(0, description="Total number of subjects")
