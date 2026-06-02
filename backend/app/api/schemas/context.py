"""Pydantic schemas for school context (request state enriched from auth)."""

from pydantic import BaseModel


class SchoolContext(BaseModel):
    """Authenticated request context attached to request.state.

    Populated by the ``get_current_context`` dependency from the
    authenticated user's database record.
    """

    user_id: str
    school_id: str
    role: str
    email: str
