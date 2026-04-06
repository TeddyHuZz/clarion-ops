"""
Alertmanager Webhook Router
============================
Receives standard Prometheus Alertmanager payloads, persists each alert
to the data-service, and dispatches Slack ChatOps notifications.
"""

import logging
import asyncio
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core.config import settings
from app.services.slack_notifier import send_slack_alert

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _persist_incident(
    client: httpx.AsyncClient,
    service_name: str,
    severity: str,
    title: str,
    raw_payload: Dict[str, Any],
) -> bool:
    """POST an incident to the data-service. Returns True on success."""
    url = f"{settings.DATA_SERVICE_URL}/api/v1/incidents/"
    try:
        resp = await client.post(
            url,
            json={
                "service_name": service_name,
                "severity": severity,
                "status": "Open",
                "title": title,
                "raw_payload": raw_payload,
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info(
                "[webhook] Incident persisted for service=%s severity=%s",
                service_name,
                severity,
            )
            return True
        else:
            logger.error(
                "[webhook] data-service returned %s for service=%s: %s",
                resp.status_code,
                service_name,
                resp.text[:200],
            )
            return False
    except httpx.RequestError as exc:
        logger.error("[webhook] Failed to reach data-service: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/alertmanager", status_code=202)
async def handle_alertmanager_webhook(
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
):
    """
    Accept Prometheus Alertmanager JSON, save each alert as an incident,
    then push Slack notifications asynchronously.

    Expected payload shape:
        {
            "alerts": [
                {
                    "labels": {
                        "alertname": "HighCPU",
                        "severity": "critical",
                        "service": "api-gateway"
                    },
                    "annotations": {
                        "summary": "CPU > 90%",
                        "description": "..."
                    },
                    "status": "firing"
                }
            ],
            "commonLabels": { ... },
            "groupKey": "..."
        }
    """
    alerts: List[Dict[str, Any]] = payload.get("alerts", [])

    if not alerts:
        raise HTTPException(status_code=400, detail="No alerts in payload")

    async with httpx.AsyncClient() as client:
        # 1. Persist every alert to data-service
        for alert in alerts:
            labels = alert.get("labels", {})
            annotations = alert.get("annotations", {})

            service_name = labels.get("service") or labels.get("instance") or "unknown-service"
            severity = (labels.get("severity") or "info").lower()
            alertname = labels.get("alertname", "Unknown Alert")
            title = annotations.get("summary") or alertname
            description = annotations.get("description", "")

            success = await _persist_incident(
                client=client,
                service_name=service_name,
                severity=severity,
                title=title,
                raw_payload={
                    "alertname": alertname,
                    "labels": labels,
                    "annotations": annotations,
                    "status": alert.get("status"),
                    "startsAt": alert.get("startsAt"),
                    "endsAt": alert.get("endsAt"),
                    "generatorURL": alert.get("generatorURL"),
                },
            )

            # 2. If save succeeded → queue Slack notification (fire-and-forget)
            if success:
                slack_data = {
                    "service_name": service_name,
                    "severity": severity,
                    "title": title,
                    "description": description,
                    "status": "Open",
                }
                # Use asyncio.create_task so we don't block the HTTP response
                asyncio.create_task(send_slack_alert(slack_data))

    return {
        "status": "accepted",
        "alerts_received": len(alerts),
    }
