"""
Alertmanager Webhook Router — AI Orchestration Engine
======================================================
Receives Prometheus Alertmanager payloads, persists incidents,
and routes them through an AI self-healing state machine:

    Open → AI Investigating → [Resolved | Manual Intervention]

Alert-storm protection is provided by an asyncio.Queue with a
dedicated background worker that drains alerts sequentially.
"""

import asyncio
import logging
import random
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.services.slack_notifier import send_slack_alert

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global alert queue (alert-storm protection)
# ---------------------------------------------------------------------------
alert_queue: asyncio.Queue[tuple[int, Dict[str, Any]]] = asyncio.Queue()
DATA_BASE = f"{settings.DATA_SERVICE_URL}/api/v1"

# HTTP headers for internal service-to-service calls
INTERNAL_HEADERS = {
    "X-Internal-Key": settings.INTERNAL_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# ---------------------------------------------------------------------------
# AI Simulation
# ---------------------------------------------------------------------------

async def run_groq_rca(incident_data: Dict[str, Any]) -> int:
    """
    Placeholder for Groq-powered Root Cause Analysis.
    Simulates LLM latency and returns a confidence score (50–100).
    """
    await asyncio.sleep(3)
    return random.randint(50, 100)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_escalation_policy(
    client: httpx.AsyncClient,
    service_name: str,
) -> Dict[str, Any] | None:
    """Fetch the escalation policy for a service from data-service."""
    try:
        resp = await client.get(
            f"{DATA_BASE}/escalations/{service_name}",
            headers=INTERNAL_HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.error("[escalation] Lookup failed for %s: %s", service_name, exc)
    return None


async def _patch_status(
    client: httpx.AsyncClient,
    incident_id: int,
    new_status: str,
) -> bool:
    """PATCH an incident's status. Returns True on success."""
    try:
        resp = await client.patch(
            f"{DATA_BASE}/incidents/{incident_id}/status",
            json={"status": new_status},
            headers=INTERNAL_HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            logger.info(
                "[ai-orchestrator] Incident %d → %s", incident_id, new_status
            )
            return True
        logger.error(
            "[ai-orchestrator] PATCH %d returned %s: %s",
            incident_id, resp.status_code, resp.text[:200],
        )
    except Exception as exc:
        logger.error("[ai-orchestrator] PATCH failed for %d: %s", incident_id, exc)
    return False

# ---------------------------------------------------------------------------
# AI Orchestration Pipeline
# ---------------------------------------------------------------------------

async def _process_incident(
    client: httpx.AsyncClient,
    incident_id: int,
    incident_data: Dict[str, Any],
) -> None:
    """
    Self-healing state machine:

        Open → AI Investigating → [Resolved | Manual Intervention]
    """
    service_name = incident_data["service_name"]

    # Step 2: Immediately transition to AI Investigating
    await _patch_status(client, incident_id, "AI Investigating")

    # Step 3: Run AI analysis
    confidence = await run_groq_rca(incident_data)
    logger.info(
        "[ai-orchestrator] Incident %d confidence_score=%d%%",
        incident_id, confidence,
    )

    # Step 4: Route based on confidence threshold
    if confidence > 85:
        logger.info(
            "[ai-orchestrator] Auto-remediation triggered for incident %d",
            incident_id,
        )
        await _patch_status(client, incident_id, "Resolved")
    else:
        logger.info(
            "[ai-orchestrator] Incident %d → Manual Intervention (score=%d%%)",
            incident_id, confidence,
        )
        await _patch_status(client, incident_id, "Manual Intervention")

        # Lookup L1 on-call and trigger Slack alert
        policy = await _get_escalation_policy(client, service_name)
        on_call_user = policy.get("level_1_user") if policy else None
        if on_call_user:
            slack_data = {
                "service_name": service_name,
                "severity": incident_data.get("severity", "critical"),
                "title": incident_data.get("title", "Manual intervention required"),
                "status": "Manual Intervention",
                "description": (
                    f"@{on_call_user} — AI analysis scored {confidence}%. "
                    "Human review required."
                ),
            }
            await send_slack_alert(slack_data)

# ---------------------------------------------------------------------------
# Background Worker (alert-storm drain)
# ---------------------------------------------------------------------------

async def _alert_worker() -> None:
    """
    Continuously drains the alert queue, processing one incident at a time.
    Runs for the lifetime of the application.
    """
    async with httpx.AsyncClient() as client:
        while True:
            incident_id, incident_data = await alert_queue.get()
            try:
                await _process_incident(client, incident_id, incident_data)
            except Exception as exc:
                logger.exception(
                    "[ai-orchestrator] Unhandled error processing incident %d",
                    incident_id,
                )
            finally:
                alert_queue.task_done()
                # Rate-limit: pause between items to avoid LLM API overload
                await asyncio.sleep(1)

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/alertmanager", status_code=202)
async def handle_alertmanager_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accept Prometheus Alertmanager JSON, persist each alert, enqueue for
    AI processing, and return 202 immediately.

    Payload shape:
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
                    }
                }
            ]
        }
    """
    alerts: List[Dict[str, Any]] = payload.get("alerts", [])
    if not alerts:
        raise HTTPException(status_code=400, detail="No alerts in payload")

    queued = 0
    async with httpx.AsyncClient() as client:
        for alert in alerts:
            labels = alert.get("labels", {})
            annotations = alert.get("annotations", {})

            service_name = (
                labels.get("service") or labels.get("instance") or "unknown-service"
            )
            severity = (labels.get("severity") or "info").lower()
            alertname = labels.get("alertname", "Unknown Alert")
            title = annotations.get("summary") or alertname

            incident_data = {
                "service_name": service_name,
                "severity": severity,
                "status": "Open",
                "title": title,
                "raw_payload": {
                    "alertname": alertname,
                    "labels": labels,
                    "annotations": annotations,
                },
            }

            # Step 1: Persist to data-service
            try:
                resp = await client.post(
                    f"{DATA_BASE}/incidents/",
                    json=incident_data,
                    headers=INTERNAL_HEADERS,
                    timeout=10,
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    incident_id = data.get("id")
                    if incident_id:
                        # Enqueue for AI pipeline
                        await alert_queue.put((incident_id, incident_data))
                        queued += 1
                else:
                    logger.error(
                        "[webhook] data-service returned %s: %s",
                        resp.status_code, resp.text[:200],
                    )
            except Exception as exc:
                logger.error("[webhook] Failed to persist incident: %s", exc)

    return {"status": "accepted", "alerts_queued": queued}
