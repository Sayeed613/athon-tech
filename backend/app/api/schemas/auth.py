"""Pydantic schemas for authentication endpoints."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    email: str
    password: str


class UserResponse(BaseModel):
    """Public user profile returned by /auth/me."""

    id: str
    name: str
    email: str
    role: str
    school_id: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """Response body for successful authentication."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
