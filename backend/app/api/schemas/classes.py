"""Class Pydantic schemas for admin CRUD operations."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CreateClassRequest(BaseModel):
    """Request body for creating a new class."""

    name: str = Field(..., min_length=1, max_length=50, description="Class name (e.g. 'Grade 10')")
    section: str | None = Field(None, max_length=20, description="Section (e.g. 'A')")
    academic_year_id: str = Field(..., description="UUID of the academic year")
    class_teacher_id: str | None = Field(None, description="UUID of the form teacher")
    room_number: str | None = Field(None, max_length=20, description="Room number")
    capacity: int = Field(30, ge=1, le=100, description="Maximum student capacity")


class UpdateClassRequest(BaseModel):
    """Request body for updating a class. All fields optional."""

    name: str | None = Field(None, max_length=50, description="Updated class name")
    section: str | None = Field(None, max_length=20, description="Updated section")
    academic_year_id: str | None = Field(None, description="Updated academic year UUID")
    class_teacher_id: str | None = Field(None, description="Updated form teacher UUID")
    room_number: str | None = Field(None, max_length=20, description="Updated room number")
    capacity: int | None = Field(None, ge=1, le=100, description="Updated capacity")


class ClassResponse(BaseModel):
    """Standard class response."""

    id: str = Field(..., description="Class UUID")
    name: str = Field(..., description="Class name")
    section: str | None = None
    academic_year_id: str = Field(..., description="Academic year UUID")
    academic_year_name: str = Field("", description="Academic year name")
    class_teacher_id: str | None = Field(None, description="Form teacher UUID")
    class_teacher_name: str | None = Field(None, description="Form teacher name")
    room_number: str | None = None
    capacity: int = Field(30, description="Maximum capacity")
    student_count: int = Field(0, description="Current enrolled student count")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


class ClassListResponse(BaseModel):
    """Wrapper for a list of classes."""

    classes: list[ClassResponse] = Field(..., description="List of classes")
    total: int = Field(0, description="Total number of classes")
