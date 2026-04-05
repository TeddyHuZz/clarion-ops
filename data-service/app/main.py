from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from .core.config import settings
from .tasks.snapshot_worker import scheduler, setup_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup LOGIC
    setup_scheduler()
    scheduler.start()
    print(f"Starting {settings.PROJECT_NAME} and background workers...")
    yield
    # Shutdown LOGIC
    scheduler.shutdown()
    print(f"Shutting down {settings.PROJECT_NAME} and workers...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/api/v1/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .api.routers import deployments

app.include_router(
    deployments.router,
    prefix="/api/v1/deployments",
    tags=["Deployments"]
)

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Standard service health endpoint for Kubernetes/Monitoring.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "0.1.0"
    }

# Entry point for easier local execution
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
