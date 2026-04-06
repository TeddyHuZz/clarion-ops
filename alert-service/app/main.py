from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routers import alerts, auth, webhooks

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    openapi_url="/api/v1/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS — allow the Vite frontend to call this service directly
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
