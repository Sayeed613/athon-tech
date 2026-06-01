"""Health check endpoints — service and database connectivity."""

from fastapi import APIRouter

from app.core.config import settings
from app.core.database import check_db_connection

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Return service health status.

    Response:
        {
            "status": "healthy",
            "service": "athon-backend",
            "version": "0.1.0"
        }
    """
    return {
        "status": "healthy",
        "service": "athon-backend",
        "version": settings.app_version,
    }


@router.get("/health/database")
async def database_health():
    """Return database connectivity status.

    Runs SELECT 1 against the connected PostgreSQL instance.

    Response (healthy):
        {
            "status": "healthy",
            "database": "connected"
        }

    Response (unhealthy):
        {
            "status": "unhealthy",
            "database": "disconnected",
            "error": "Connection refused ..."
        }
    """
    result = await check_db_connection()
    if result["status"] == "connected":
        return {
            "status": "healthy",
            "database": "connected",
        }
    return {
        "status": "unhealthy",
        "database": "disconnected",
        "error": result["error"],
    }
