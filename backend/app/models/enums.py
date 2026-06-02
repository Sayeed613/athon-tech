"""Python enums matching PostgreSQL ENUM types for Phase 1 models.

These enums are mapped to SQLAlchemy using
sa.Enum(EnumClass, name="pg_enum_name", create_type=False)
to match the existing database enum types without attempting to create them.
"""

import enum


class UserRole(str, enum.Enum):
    """Matches the user_role PostgreSQL ENUM type."""

    SUPER_ADMIN = "super_admin"
    SCHOOL_ADMIN = "school_admin"
    PRINCIPAL = "principal"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"


class Gender(str, enum.Enum):
    """Matches the gender PostgreSQL ENUM type."""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
