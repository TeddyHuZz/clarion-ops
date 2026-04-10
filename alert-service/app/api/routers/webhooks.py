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
import hashlib
import hmac
import json
import logging
import urllib.parse
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.services.health_validator import verify_rollback_health
from app.services.llm_engine import run_groq_rca
from app.services.slack_notifier import send_slack_alert

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global alert queue (alert-storm protection)
# ---------------------------------------------------------------------------
alert_queue: asyncio.Queue[tuple[int, dict[str, Any]]] = asyncio.Queue()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

METRICS_SERVICE_URL = "http://metrics-service:8001"
DATA_BASE = f"{settings.DATA_SERVICE_URL}/api/v1"

# HTTP headers for internal service-to-service calls
INTERNAL_HEADERS = {
    "X-Internal-Key": settings.INTERNAL_API_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# Headers for deployment-service rollback calls
DEPLOYMENT_HEADERS = {
    "x-internal-token": settings.INTERNAL_SERVICE_TOKEN,
    "Accept": "application/json",
    "Content-Type": "application/json",
}

DEPLOYMENT_SERVICE_URL = "http://deployment-service:8003"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_escalation_policy(
    client: httpx.AsyncClient,
    service_name: str,
) -> dict[str, Any] | None:
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
            logger.info("[ai-orchestrator] Incident %d → %s", incident_id, new_status)
            return True
        logger.error(
            "[ai-orchestrator] PATCH %d returned %s: %s",
            incident_id,
            resp.status_code,
            resp.text[:200],
        )
    except Exception as exc:
        logger.error("[ai-orchestrator] PATCH failed for %d: %s", incident_id, exc)
    return False


async def _post_incident_log(
    client: httpx.AsyncClient,
    incident_id: int,
    message: str,
) -> None:
    """Append an audit log entry to an incident in data-service."""
    try:
        await client.post(
            f"{DATA_BASE}/incidents/{incident_id}/logs",
            json={"message": message},
            headers=INTERNAL_HEADERS,
            timeout=10,
        )
    except Exception:
        logger.warning("[audit-log] Failed to append log for incident %d", incident_id)


async def _post_ai_analysis(
    client: httpx.AsyncClient,
    incident_id: int,
    rca_result: dict[str, Any],
    pod_logs: str | None = None,
) -> None:
    """Persist AI RCA results for an incident in data-service."""
    try:
        await client.post(
            f"{DATA_BASE}/incidents/{incident_id}/ai-analysis",
            json={
                "root_cause_summary": rca_result["root_cause_summary"],
                "confidence_score": rca_result["confidence_score"],
                "recommended_action": rca_result["recommended_action"],
                "pod_logs": pod_logs,
            },
            headers=INTERNAL_HEADERS,
            timeout=10,
        )
        logger.info("[ai-analysis] Persisted RCA results for incident %d", incident_id)
    except Exception:
        logger.warning("[ai-analysis] Failed to persist RCA results for incident %d", incident_id)


# ---------------------------------------------------------------------------
# Context Aggregation
# ---------------------------------------------------------------------------


async def _fetch_context(
    client: httpx.AsyncClient,
    service_name: str,
    pod_name: str,
) -> dict[str, Any]:
    """
    Concurrently fetch pod logs and latest deployment info.
    Returns a context dictionary for the AI analysis engine.
    """
    logs_task = client.get(
        f"{METRICS_SERVICE_URL}/api/v1/logs/default/{pod_name}",
        headers=INTERNAL_HEADERS,
        timeout=10,
    )

    deployment_task = client.get(
        f"{DATA_BASE}/deployments/latest",
        params={"service_name": service_name},
        headers=INTERNAL_HEADERS,
        timeout=10,
    )

    logs_resp, deploy_resp = await asyncio.gather(
        logs_task,
        deployment_task,
        return_exceptions=True,
    )

    # Parse logs
    pod_logs = ""
    if isinstance(logs_resp, httpx.Response) and logs_resp.status_code == 200:
        data = logs_resp.json()
        pod_logs = data.get("logs", "")
    elif isinstance(logs_resp, Exception):
        logger.warning("[context] Failed to fetch logs for %s: %s", pod_name, logs_resp)

    # Parse deployment info
    last_deployment: dict[str, Any] | None = None
    if isinstance(deploy_resp, httpx.Response) and deploy_resp.status_code == 200:
        last_deployment = deploy_resp.json()
    elif isinstance(deploy_resp, Exception):
        logger.warning("[context] Failed to fetch deployment for %s: %s", service_name, deploy_resp)

    return {
        "pod_logs": pod_logs,
        "last_deployment": last_deployment,
    }


# ---------------------------------------------------------------------------
# AI Orchestration Pipeline
# ---------------------------------------------------------------------------


async def _process_incident(
    client: httpx.AsyncClient,
    incident_id: int,
    incident_data: dict[str, Any],
) -> None:
    """
    Self-healing state machine with Context Aggregation and automated remediation:

        Open → AI Investigating → [Resolved | Manual Intervention]

    Before AI analysis, we enrich the incident with:
    - Last 100 lines of pod logs (from metrics-service)
    - Most recent deployment info (from data-service)
    """
    service_name = incident_data["service_name"]
    pod_name = incident_data.get("raw_payload", {}).get("labels", {}).get("pod") or service_name

    # Step 2: Immediately transition to AI Investigating
    await _patch_status(client, incident_id, "AI Investigating")

    # Step 3: Context Aggregation — fetch logs + deployment concurrently
    logger.info(
        "[ai-orchestrator] Fetching context for incident %d (service=%s, pod=%s)",
        incident_id,
        service_name,
        pod_name,
    )
    context = await _fetch_context(client, service_name, pod_name)
    logs_len = len(context.get("pod_logs", ""))
    has_deploy = bool(context.get("last_deployment"))
    logger.info(
        "[ai-orchestrator] Context fetched — logs: %d chars, deployment: %s",
        logs_len,
        has_deploy,
    )

    # Build the enriched payload for the LLM
    ai_context_payload = {
        "incident_id": incident_id,
        "service_name": service_name,
        "pod_name": pod_name,
        "severity": incident_data.get("severity"),
        "alert_name": incident_data.get("raw_payload", {}).get("alertname"),
        "alert_summary": incident_data.get("title"),
        **context,  # pod_logs, last_deployment
    }

    # Step 4a: Audit log — RCA started
    await _post_incident_log(client, incident_id, "AI Root Cause Analysis started.")

    # Step 4b: Run AI analysis with enriched context
    rca_result = await run_groq_rca(ai_context_payload)
    confidence = rca_result["confidence_score"]
    recommended_action = rca_result["recommended_action"]
    root_cause = rca_result["root_cause_summary"]

    logger.info(
        "[ai-orchestrator] Incident %d — confidence=%d%%, action=%s, summary=%s",
        incident_id,
        confidence,
        recommended_action,
        root_cause,
    )

    # Step 4c: Persist AI analysis results to data-service
    await _post_ai_analysis(
        client,
        incident_id,
        rca_result,
        pod_logs=context.get("pod_logs"),
    )

    # Step 5: Route based on AI recommendation
    if recommended_action == "rollback" and confidence >= 80:
        # --- Automated Rollback ---
        logger.info(
            "[ai-orchestrator] Confidence threshold met. Initiating automated rollback "
            "for incident %d (service=%s)",
            incident_id,
            service_name,
        )

        await _post_incident_log(
            client,
            incident_id,
            "AI confidence threshold met. Initiating automated rollback "
            "to last known stable commit.",
        )

        # Extract target commit from deployment context
        last_deployment = context.get("last_deployment") or {}
        target_commit = last_deployment.get("commit_hash", "")

        rollback_payload = {
            "service_name": service_name,
            "target_commit_hash": target_commit,
        }

        try:
            resp = await client.post(
                f"{DEPLOYMENT_SERVICE_URL}/deployments/rollback",
                json=rollback_payload,
                headers=DEPLOYMENT_HEADERS,
                timeout=30,
            )

            if resp.status_code == 200:
                await _patch_status(client, incident_id, "Verifying")
                await _post_incident_log(
                    client,
                    incident_id,
                    "Rollback executed. Starting post-remediation health verification.",
                )
                logger.info(
                    "[ai-orchestrator] Rollback succeeded for incident %d — "
                    "status Verifying, health check spawned in background",
                    incident_id,
                )
                # Spawn background health validator (non-blocking)
                asyncio.create_task(
                    verify_rollback_health(
                        incident_id=incident_id,
                        pod_name=pod_name,
                        service_name=service_name,
                    )
                )
            else:
                logger.error(
                    "[ai-orchestrator] Rollback returned %d for incident %d: %s",
                    resp.status_code,
                    incident_id,
                    resp.text[:200],
                )
                await _patch_status(client, incident_id, "Manual Intervention")
                await _post_incident_log(
                    client,
                    incident_id,
                    f"Rollback failed (HTTP {resp.status_code}). Escalating to human operator.",
                )

        except Exception:
            logger.exception(
                "[ai-orchestrator] Rollback request failed for incident %d",
                incident_id,
            )
            await _patch_status(client, incident_id, "Manual Intervention")
            await _post_incident_log(
                client,
                incident_id,
                "Rollback service unreachable. Escalating to human operator.",
            )

    else:
        # --- Manual Escalation ---
        logger.info(
            "[ai-orchestrator] Incident %d → Manual Intervention (score=%d%%, action=%s)",
            incident_id,
            confidence,
            recommended_action,
        )
        await _patch_status(client, incident_id, "Manual Intervention")

        await _post_incident_log(
            client,
            incident_id,
            f"AI confidence too low ({confidence}%). Escalating to human operator.",
        )

        # Lookup L1 on-call and trigger Slack alert
        policy = await _get_escalation_policy(client, service_name)
        on_call_user = policy.get("level_1_user") if policy else None
        if on_call_user:
            # Extract commit hash from deployment context for rollback approval
            last_deployment = context.get("last_deployment") or {}
            commit_hash = last_deployment.get("commit_hash", "")

            slack_data = {
                "incident_id": incident_id,
                "service_name": service_name,
                "severity": incident_data.get("severity", "critical"),
                "title": incident_data.get("title", "Manual intervention required"),
                "status": "Manual Intervention",
                "description": (
                    f"@{on_call_user} — AI analysis scored {confidence}%. "
                    f"Root cause: {root_cause}. "
                    f"Recommended action: {recommended_action}."
                ),
                "commit_hash": commit_hash,
            }
            await send_slack_alert(slack_data, needs_approval=True)


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
            except Exception:
                logger.exception(
                    "[ai-orchestrator] Unhandled error processing incident %d",
                    incident_id,
                )
            finally:
                alert_queue.task_done()
                # Rate-limit: pause between items to avoid LLM API overload
                await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# Slack Interactive Payload Verification
# ---------------------------------------------------------------------------


def _verify_slack_signature(
    signing_secret: str,
    timestamp: str,
    signature: str,
    raw_body: bytes,
) -> bool:
    """
    Verify that the request genuinely originated from Slack.

    Slack signs requests with HMAC-SHA256 using the app's signing secret.
    Format: v0=hex_digest of "v0:timestamp:body"
    """
    base = f"v0:{timestamp}:{raw_body.decode('utf-8')}"
    expected = hmac.new(
        signing_secret.encode("utf-8"),
        base.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(f"v0={expected}", signature)


# ---------------------------------------------------------------------------
# Slack Interactive Callback
# ---------------------------------------------------------------------------


async def _update_slack_message(response_url: str, text: str) -> bool:
    """Replace a Slack message's content (and remove buttons) via response_url."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                response_url,
                json={"text": text, "replace_original": True},
            )
            resp.raise_for_status()
        return True
    except Exception:
        logger.exception("[slack-interaction] Failed to update Slack message")
        return False


@router.post("/slack-interaction")
async def handle_slack_interaction(request: Request) -> dict[str, Any]:
    """
    Handle interactive Block Kit callbacks from Slack (button clicks).

    Slack sends application/x-www-form-urlencoded data with a 'payload'
    field containing the full interaction JSON.
    """
    # --- 0. Read raw body before any parsing (needed for signature check) ---
    raw_body = await request.body()

    # --- 1. Security: verify the request came from Slack ---
    signing_secret = settings.SLACK_SIGNING_SECRET
    if signing_secret:
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")

        if not _verify_slack_signature(signing_secret, timestamp, signature, raw_body):
            logger.warning("[slack-interaction] Signature verification failed")
            raise HTTPException(status_code=401, detail="Invalid Slack signature")

    # --- 2. Parse the form data ---
    try:
        form_data = raw_body.decode("utf-8")
        payload_str = urllib.parse.parse_qs(form_data)["payload"][0]
        interaction = json.loads(payload_str)
    except (json.JSONDecodeError, KeyError, UnicodeDecodeError, IndexError) as err:
        raise HTTPException(status_code=400, detail="Invalid Slack payload") from err

    action_id = interaction["actions"][0]["action_id"]
    value_str = interaction["actions"][0]["value"]
    response_url = interaction.get("response_url", "")
    value = json.loads(value_str)

    incident_id = value.get("incident_id", 0)
    logger.info(
        "[slack-interaction] action=%s incident=%d user=%s",
        action_id,
        incident_id,
        interaction.get("user", {}).get("name", "unknown"),
    )

    # --- 3. Execute based on action_id ---
    async with httpx.AsyncClient() as client:
        if action_id == "approve_rollback":
            commit_hash = value.get("commit", "")
            service_name = value.get("service", "unknown")

            # 3a. Trigger rollback on deployment-service
            rollback_payload = {
                "service_name": service_name,
                "target_commit_hash": commit_hash,
            }
            try:
                resp = await client.post(
                    f"{DEPLOYMENT_SERVICE_URL}/deployments/rollback",
                    json=rollback_payload,
                    headers=DEPLOYMENT_HEADERS,
                    timeout=30,
                )

                if resp.status_code == 200:
                    await _patch_status(client, incident_id, "Resolved")
                    await _post_incident_log(
                        client,
                        incident_id,
                        "Human-approved rollback executed successfully.",
                    )
                    await _update_slack_message(
                        response_url,
                        "✅ Automated rollback approved and executing.",
                    )
                else:
                    logger.error(
                        "[slack-interaction] Rollback failed: %d — %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                    await _patch_status(client, incident_id, "Manual Intervention")
                    await _update_slack_message(
                        response_url,
                        "❌ Rollback request failed. See logs for details.",
                    )

            except Exception:
                logger.exception("[slack-interaction] Rollback request error")
                await _update_slack_message(
                    response_url,
                    "⚠️ Rollback service unreachable. Escalating.",
                )

        elif action_id == "escalate_human":
            # 3b. Acknowledge — mark for manual investigation
            await _patch_status(client, incident_id, "Acknowledged")
            await _post_incident_log(
                client,
                incident_id,
                "On-call acknowledged. Manual investigation in progress.",
            )
            await _update_slack_message(
                response_url,
                "⚠️ Escalated to human operator for manual investigation.",
            )

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/alertmanager", status_code=202)
async def handle_alertmanager_webhook(
    payload: dict[str, Any],
) -> dict[str, Any]:
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
    alerts: list[dict[str, Any]] = payload.get("alerts", [])
    if not alerts:
        raise HTTPException(status_code=400, detail="No alerts in payload")

    queued = 0
    async with httpx.AsyncClient() as client:
        for alert in alerts:
            labels = alert.get("labels", {})
            annotations = alert.get("annotations", {})

            service_name = labels.get("service") or labels.get("instance") or "unknown-service"
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
                        resp.status_code,
                        resp.text[:200],
                    )
            except Exception as exc:
                logger.error("[webhook] Failed to persist incident: %s", exc)

    return {"status": "accepted", "alerts_queued": queued}
