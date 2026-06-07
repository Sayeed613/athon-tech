"""Pydantic schemas for timetable API endpoints."""

from datetime import time

from pydantic import BaseModel


class PeriodInfo(BaseModel):
    """Brief period info included in timetable responses."""

    id: str
    name: str
    period_number: int
    start_time: time
    end_time: time
    is_break: bool


class SubjectInfo(BaseModel):
    """Brief subject info included in timetable responses."""

    id: str
    name: str
    code: str
    is_core: bool


class TeacherInfo(BaseModel):
    """Brief teacher info included in timetable responses."""

    id: str
    name: str
    employee_code: str


class ClassInfo(BaseModel):
    """Brief class info included in timetable responses."""

    id: str
    name: str
    section: str | None = None


class TimetableEntryResponse(BaseModel):
    """A single timetable entry with resolved related entity info.

    All related objects are pre-loaded to prevent N+1 queries.
    """

    id: str
    day_of_week: int
    room_number: str | None = None
    is_active: bool

    # Resolved related entities
    period: PeriodInfo
    subject: SubjectInfo
    teacher: TeacherInfo
    class_: ClassInfo

    model_config = {"from_attributes": True}


class TimetableResponse(BaseModel):
    """Full timetable response — either a weekly or daily schedule."""

    entries: list[TimetableEntryResponse]
