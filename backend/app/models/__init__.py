"""SQLAlchemy ORM models for the Athon platform.

Phase 1 models:
    - School   — Tenant root entity
    - User     — Unified authentication principal (all roles)
    - Teacher  — Teacher-specific profile (1:1 with User)
    - Principal — Principal-specific profile (1:1 with User)
    - Parent   — Parent/guardian profile (1:1 with User)
    - Student  — Student-specific profile (1:1 with User)
"""

from app.models.base import Base
from app.models.school import School
from app.models.user import User
from app.models.teacher import Teacher
from app.models.principal import Principal
from app.models.parent import Parent
from app.models.student import Student

__all__ = [
    "Base",
    "School",
    "User",
    "Teacher",
    "Principal",
    "Parent",
    "Student",
]
