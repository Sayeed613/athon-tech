"""Authentication dependencies for FastAPI routes.

Provides:
- ``get_current_user`` — verifies a Supabase JWT and loads the matching User
- ``get_current_context`` — builds a ``SchoolContext`` from the authenticated user
  and populates ``request.state`` for downstream handlers and middleware
- ``require_role`` — role-based access control factory

The user is resolved by matching the JWT's ``sub`` claim (Supabase user
UUID) against the ``users.supabase_user_id`` column.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas.context import SchoolContext
from app.core.database import get_db
from app.core.security import verify_jwt
from app.models.user import User

logger = logging.getLogger("athon")

# Bearer token scheme for Swagger UI / OpenAPI
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency that verifies a Supabase JWT and loads the matching user.

    The user is resolved by matching the JWT's ``sub`` claim (the Supabase
    Auth user UUID) against the ``users.supabase_user_id`` column.

    Usage::

        @router.get("/protected")
        async def protected_route(current_user: User = Depends(get_current_user)):
            ...

    Returns:
        The authenticated User model instance.

    Raises:
        HTTPException 401: If token is missing, invalid, expired, tampered,
            or the user is not found / inactive.
    """
    # ── Check token exists ──────────────────────────────────────────
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Verify JWT against Supabase JWKS ────────────────────────────
    payload = await verify_jwt(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Extract Supabase user ID from 'sub' claim ───────────────────
    supabase_user_id: str | None = payload.get("sub")
    if supabase_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Load user by supabase_user_id ───────────────────────────────
    result = await db.execute(
        select(User).where(User.supabase_user_id == supabase_user_id),
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_context(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SchoolContext:
    """Build and attach a ``SchoolContext`` to ``request.state``.

    Call this dependency on any endpoint that needs the authenticated
    user's school context. It populates ``request.state`` so that
    downstream handlers, middleware, and services can access the context
    without performing another database lookup.

    Usage::

        @router.get("/context")
        async def context_endpoint(ctx: SchoolContext = Depends(get_current_context)):
            return ctx

    ``request.state`` keys populated:
        - ``user_id``
        - ``school_id``
        - ``role``
        - ``email``
    """
    role_str = (
        current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role)
    )

    ctx = SchoolContext(
        user_id=str(current_user.id),
        school_id=str(current_user.school_id),
        role=role_str,
        email=current_user.email,
    )

    # Attach to request.state for downstream consumption
    request.state.user_id = ctx.user_id
    request.state.school_id = ctx.school_id
    request.state.role = ctx.role
    request.state.email = ctx.email

    return ctx


def require_role(*roles: str):
    """Dependency factory: requires the current user to have one of the specified roles.

    Usage::

        @router.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(require_role("school_admin", "principal")),
        ):
            ...

    Args:
        *roles: One or more role names allowed to access the endpoint.

    Returns:
        A dependency callable that returns the authenticated User.
    """
    async def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        )
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied — requires one of: {', '.join(roles)}",
            )
        return current_user

    return _role_checker
