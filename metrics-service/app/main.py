import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import logs, metrics
from app.config import settings
from app.services.prometheus_client import PrometheusClient

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Wait for the application to start and stop."""
    # Ensure PrometheusClient is initialized
    PrometheusClient.get_instance()
    logger.info("Metrics service starting up, Prometheus client initialized.")
    yield
    # Gracefully close connections
    await PrometheusClient.get_instance().close()
    logger.info("Metrics service shutting down, Prometheus client closed.")


app = FastAPI(
    title="Clarion Ops Metrics Service",
    description=(
        "Microservice for fetching Kubernetes resource metrics and pod health via Prometheus."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware (Allow frontend dashboard access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(metrics.router, prefix="/api/v1/metrics", tags=["metrics"])
app.include_router(logs.router, prefix="/api/v1/logs", tags=["logs"])


@app.get("/health")
async def health_check():
    """Service health check."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=True,
    )
