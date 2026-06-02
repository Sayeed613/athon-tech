"""Authentication endpoints — login via Supabase Auth, user info, token management.

All password verification is delegated to Supabase Auth. Athon never
stores or verifies passwords directly.
"""

import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps.auth import get_current_context, get_current_user
from app.api.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.api.schemas.context import SchoolContext
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger("athon")

router = APIRouter(tags=["auth"])


def _build_user_response(user: User) -> UserResponse:
    """Build a UserResponse from a User ORM instance."""
    return UserResponse(
        id=str(user.id),
        name=f"{user.first_name} {user.last_name}",
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        school_id=str(user.school_id),
    )


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate via Supabase Auth and return a JWT access token.

    Athon never verifies passwords directly. Credentials are sent to
    Supabase Auth's ``/auth/v1/token?grant_type=password`` endpoint.
    On success the Supabase-issued JWT is returned to the client together
    with the Athon user profile.

    Returns:
        LoginResponse with access_token, token_type, and user profile.
    """
    # ── 1. Verify credentials with Supabase Auth ──────────────────
    auth_url = f"{settings.supabase_url}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        supabase_resp = await client.post(
            auth_url,
            headers=headers,
            json={"email": body.email, "password": body.password},
        )

    if supabase_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    supabase_data = supabase_resp.json()
    supabase_user_id = supabase_data["user"]["id"]

    # ── 2. Look up user in our database by supabase_user_id ───────
    result = await db.execute(
        select(User).where(User.supabase_user_id == supabase_user_id),
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(
            "Supabase user %s authenticated but not found in Athon users table",
            supabase_user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
        )

    # ── 3. Update last_login_at ───────────────────────────────────
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)

    logger.info(
        "User logged in: %s (%s)",
        user.email,
        user.role.value if hasattr(user.role, "value") else user.role,
    )

    return LoginResponse(
        access_token=supabase_data["access_token"],
        token_type="bearer",
        user=_build_user_response(user),
    )


@router.get("/auth/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's profile.

    Requires a valid Supabase-issued JWT in the Authorization header.
    """
    return _build_user_response(current_user)


@router.get("/auth/context", response_model=SchoolContext)
async def get_context(
    ctx: SchoolContext = Depends(get_current_context),
):
    """Return the authenticated user's school context.

    Validates the JWT and returns the school-scoped context
    derived from the user's database record.

    ``request.state`` is also populated with ``user_id``,
    ``school_id``, ``role``, and ``email`` for downstream use.
    """
    return ctx
