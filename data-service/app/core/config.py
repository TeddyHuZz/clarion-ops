from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    PROJECT_NAME: str = "data-service"
    API_V1_STR: str = "/api/v1"

    # Internal Communication Security
    INTERNAL_API_KEY: str = "dev-internal-secret-key"

    # Clerk Authentication
    CLERK_JWT_PUBLIC_KEY: str = ""  # To be filled from .env
    CLERK_SECRET_KEY: str = ""  # Backend API key for Clerk Management API
    CLERK_API_URL: str = "https://api.clerk.com/v1"

    # Snapshot Configuration
    SNAPSHOT_NAMESPACE: str = "test-ns"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Database
    DATABASE_URL: str = "sqlite:///./sql_app.db"  # Default to sqlite for local dev


settings = Settings()
