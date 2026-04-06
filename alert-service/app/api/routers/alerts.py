from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional

from app.services.slack_notifier import send_slack_alert

router = APIRouter()


class AlertIngest(BaseModel):
    """Payload accepted from external monitors (PagerDuty, Datadog, etc.)."""
    service_name: str = Field(..., description="Affected service identifier")
    severity: str = Field(..., description="critical | warning | info")
    title: Optional[str] = None
    description: Optional[str] = None
    status: str = Field(default="Open")


@router.get("/")
async def list_alerts():
    """Return paginated alert history."""
    return {"alerts": []}


@router.post("/", status_code=202)
async def create_alert(
    alert: AlertIngest,
    background_tasks: BackgroundTasks,
):
    """
    Ingest a new alert and dispatch a Slack ChatOps notification.

    The Slack POST is handed off to a background task so the HTTP 202
    response is never delayed by external API latency.
    """
    # Fire-and-forget Slack notification — failures are logged silently
    background_tasks.add_task(send_slack_alert, alert.model_dump())

    return {"status": "accepted", "service_name": alert.service_name}
