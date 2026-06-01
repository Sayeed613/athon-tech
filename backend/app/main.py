"""FastAPI application factory for the Athon backend.

Creates and configures the ASGI application with:
- Metadata (title, version, docs URL)
- CORS middleware
- Exception handling middleware
- Request logging middleware
- API router registration
- Lifespan event handlers (startup / shutdown with fail-fast validation)
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import router as api_v1_router
from app.core.config import settings

logger = logging.getLogger("athon")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown hooks.

    Startup:
        - Validate database connectivity (fail fast if unreachable)
    Shutdown:
        - Dispose of database engine connections
    """
    # ─── Startup ───────────────────────────────
    print(f"Starting {settings.app_name} v{settings.app_version}")

    from app.core.database import check_db_connection, engine

    db_status = await check_db_connection()
    if db_status["status"] == "disconnected":
        msg = (
            f"Database connection failed: {db_status['error']}"
        )
        print(f"FATAL: {msg}")
        raise RuntimeError(msg)

    print(f"Database connection verified ({settings.database_url})")

    yield

    # ─── Shutdown ──────────────────────────────
    print("Disposing database engine connections...")
    await engine.dispose()
    print(f"Shutdown complete — {settings.app_name} stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered teacher productivity and parent communication platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Athon Team",
        "url": "https://athonschool.com",
    },
)


# ─── Exception Middleware ───────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler returning standard error format."""
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            },
        },
    )


# ─── Request Logging Middleware ─────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = int((time.monotonic() - start) * 1000)
    logger.info(
        "%s %s → %s (%dms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ─── CORS ──────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://app.athonschool.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ────────────────────────────────
app.include_router(api_v1_router, prefix="/api/v1")
