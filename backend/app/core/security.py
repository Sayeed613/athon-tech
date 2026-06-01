"""Security utilities — JWT verification, password helpers, session context.

Designed to work with Supabase Auth JWTs (RS256).
Session context values are set by middleware for RLS enforcement.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class SessionContext:
    """PostgreSQL session context set by middleware for RLS.

    These values are read by the app.* helper functions in rls.sql.
    """

    user_id: Optional[str] = None
    school_id: Optional[str] = None
    user_role: Optional[str] = None
    ip_address: Optional[str] = None


async def verify_jwt(token: str) -> Optional[dict]:
    """Verify a Supabase JWT and return its payload.

    Uses the JWKS endpoint to fetch the public key and verify
    the token signature. Falls back to local decode for testing.

    Args:
        token: The raw JWT string (Bearer token).

    Returns:
        Decoded payload dict, or None if verification fails.
    """
    # TODO: Implement JWK client + RS256 verification
    raise NotImplementedError


def build_session_context(payload: dict) -> SessionContext:
    """Extract session context from a verified JWT payload."""
    # TODO: Map JWT claims → SessionContext
    raise NotImplementedError
