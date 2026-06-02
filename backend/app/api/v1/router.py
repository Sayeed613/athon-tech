"""API v1 router — aggregates all version 1 endpoint routers.

Add new routers here as they are created. The main application
includes this single router under the /api/v1 prefix.
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router

router = APIRouter()

router.include_router(health_router)
router.include_router(auth_router)
