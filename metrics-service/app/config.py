from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    prometheus_url: str = "http://localhost:9090"
    service_host: str = "0.0.0.0"
    service_port: int = 8001
    log_level: str = "info"
    query_timeout_sec: int = 30
    default_range_hours: int = 1
    default_range_step_sec: int = 15
    restart_delta_window_min: int = 30


settings = Settings()
