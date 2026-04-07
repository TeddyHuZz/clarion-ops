from datetime import datetime

from pydantic import BaseModel, Field

from .enums import Environment, MetricType


class MetricDataPoint(BaseModel):
    timestamp: datetime
    value: float


class MetricSnapshot(BaseModel):
    metric: MetricType
    environment: Environment
    instance: str | None = None
    data_points: list[MetricDataPoint] = Field(default_factory=list)


class RangeRequestQuery(BaseModel):
    hours: int = Field(default=1, ge=1, le=168)
    step_sec: int = Field(default=15, ge=1)
    environment: Environment = Environment.DEV
    instance: str | None = None


class PodRestartInfo(BaseModel):
    namespace: str
    pod: str
    container: str
    total_restarts: int
    recent_restarts_window_min: int = 30
    recent_restarts: int = 0


class RestartsResponse(BaseModel):
    environment: Environment
    pods: list[PodRestartInfo] = Field(default_factory=list)
