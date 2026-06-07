"""Period Pydantic schemas for admin CRUD operations."""

from __future__ import annotations

from datetime import time

from pydantic import BaseModel, Field


class CreatePeriodRequest(BaseModel):
    """Request body for creating a new time slot / period."""

    name: str = Field(..., min_length=1, max_length=50, description="Period name (e.g. 'Period 1')")
    period_number: int = Field(..., ge=1, le=20, description="Chronological order number")
    start_time: time = Field(..., description="Start time (HH:MM)")
    end_time: time = Field(..., description="End time (HH:MM)")
    is_break: bool = Field(False, description="Is this a break period?")


class UpdatePeriodRequest(BaseModel):
    """Request body for updating a period."""

    name: str | None = Field(None, max_length=50, description="Updated name")
    period_number: int | None = Field(None, ge=1, le=20, description="Updated number")
    start_time: time | None = Field(None, description="Updated start time")
    end_time: time | None = Field(None, description="Updated end time")
    is_break: bool | None = Field(None, description="Break flag")


class PeriodResponse(BaseModel):
    """Standard period response."""

    id: str = Field(..., description="Period UUID")
    name: str = Field(..., description="Period name")
    period_number: int = Field(..., description="Order number")
    start_time: str = Field(..., description="Start time (HH:MM)")
    end_time: str = Field(..., description="End time (HH:MM)")
    is_break: bool = Field(False, description="Break flag")
    created_at: str = Field("", description="ISO 8601 timestamp")
    updated_at: str = Field("", description="ISO 8601 timestamp")


class PeriodListResponse(BaseModel):
    """Wrapper for a list of periods."""

    periods: list[PeriodResponse] = Field(..., description="List of periods")
    total: int = Field(0, description="Total number of periods")
