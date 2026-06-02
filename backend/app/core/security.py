"""Security utilities — Supabase JWT verification via JWKS and session context.

Athon never generates its own JWTs. All authentication is delegated to
Supabase Auth. JWTs issued by Supabase are verified using the project's
JWKS endpoint (ES256 ECDSA signatures).

Session context is used by middleware to set PostgreSQL session
parameters for RLS enforcement.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from jwt import PyJWKClient
from jwt import decode as jwt_decode
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

logger = logging.getLogger("athon")

# Cached JWKS client — lazily initialized on first verification request.
# Supabase key rotation is rare, so caching for the app lifetime is safe.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Get or create the cached JWKS client.

    The client fetches keys from Supabase's JWKS endpoint and caches
    them. On encountering an unknown ``kid`` it automatically fetches
    fresh keys, so key rotation is handled transparently.
    """
    global _jwks_client
    if _jwks_client is None:
        logger.info("Initialising JWKS client: %s", settings.jwt_jwks_url)
        _jwks_client = PyJWKClient(
            settings.jwt_jwks_url,
            cache_keys=True,
        )
    return _jwks_client


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
    """Verify a Supabase-issued JWT using the project's JWKS endpoint.

    Args:
        token: The raw JWT string (Bearer token value).

    Returns:
        Decoded payload dict, or None if verification fails for any reason
        (expired, tampered, wrong issuer, etc.).
    """
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt_decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            options={"verify_aud": False},
            leeway=30,  # Allow 30s clock skew between servers
        )
        return payload
    except InvalidTokenError:
        logger.warning("JWT verification failed: invalid or expired token")
        return None
    except Exception as exc:  # noqa: BLE001 — broad catch to never crash on bad tokens
        logger.error("JWT verification error: %s", exc)
        return None


def build_session_context(payload: dict) -> SessionContext:
    """Build a SessionContext from a verified JWT payload.

    With Supabase Auth the JWT's ``sub`` claim is the Supabase user UUID
    (matching ``users.supabase_user_id``). Athon-specific claims such as
    ``school_id`` and ``role`` are **not** embedded in the JWT — they
    require a database lookup that is performed in the ``get_current_user``
    dependency.
    """
    return SessionContext(
        user_id=str(payload.get("sub")) if payload.get("sub") else None,
    )
