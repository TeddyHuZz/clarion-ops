from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List, Optional


class Settings(BaseSettings):
    """
    Centralised configuration for alert-service.
    Values can be overridden via environment variables.
    """

    PROJECT_NAME: str = "Clarion Ops Alert Service"
    VERSION: str = "0.1.0"

    # Frontend origin(s) — Vite dev server default
    FRONTEND_URL: AnyHttpUrl = AnyHttpUrl("http://localhost:5173")

    # Clerk JWT configuration (used by auth dependency)
    CLERK_JWT_ISSUER: str = "https://clerkops.clerk.accounts.dev"
    CLERK_JWKS_URL: str = "https://clerkops.clerk.accounts.dev/.well-known/jwks.json"

    # Internal API key for service-to-service calls
    INTERNAL_API_KEY: str = "dev-internal-secret-key"

    # Data-service base URL (for fetching incidents, deployments, etc.)
    DATA_SERVICE_URL: str = "http://localhost:8002"

    # Slack Incoming Webhook URL for ChatOps notifications
    SLACK_WEBHOOK_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
