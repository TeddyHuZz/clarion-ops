import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routers import alerts, auth, webhooks

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Background worker handle — stored at module level for graceful shutdown
# ---------------------------------------------------------------------------
_worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _worker_task

    # Startup: launch the alert-storm drain worker
    _worker_task = asyncio.create_task(webhooks._alert_worker())
    logger.info("[lifespan] AI orchestration worker started")

    yield

    # Shutdown: cancel the worker and wait for in-flight tasks
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        logger.info("[lifespan] AI orchestration worker stopped")

    # Drain any remaining items in the queue (best-effort)
    remaining = webhooks.alert_queue.qsize()
    if remaining > 0:
        logger.warning("[lifespan] %d alerts left unprocessed in queue", remaining)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.FRONTEND_URL)],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["Webhooks"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }
