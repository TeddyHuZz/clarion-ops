"""
Health Validator — Post-Remediation Verification
===================================================
Polls the metrics-service after a rollback to verify that the target
pod has stabilized (Running + steady restart count) before declaring
the incident truly resolved.

On completion, automatically resolves the incident in data-service
and posts a Slack notification (success or failure).
"""

import asyncio
import logging
from typing import Any

import httpx

from app.services.slack_notifier import send_slack_alert

logger = logging.getLogger(__name__)

METRICS_SERVICE_URL = "http://metrics-service:8001"
DATA_BASE = "http://data-service:8002/api/v1"
INTERNAL_HEADERS = {
    "X-Internal-Key": "dev-internal-secret-key",
    "Accept": "application/json",
    "Content-Type": "application/json",
}

# Polling configuration
MAX_ITERATIONS = 30  # 5 minutes total
POLL_INTERVAL = 10  # seconds between checks
CONSECUTIVE_STABLE = 3  # consecutive checks required for success


async def _fetch_pod_health(namespace: str) -> list[dict[str, Any]]:
    """Query metrics-service for pod health in the given namespace."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{METRICS_SERVICE_URL}/api/v1/metrics/pod-health",
                params={"namespace": namespace},
                headers=INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(
                "[health-validator] metrics-service returned %d",
                resp.status_code,
            )
    except Exception:
        logger.exception("[health-validator] Failed to reach metrics-service")
    return []


async def _patch_status(incident_id: int, new_status: str) -> bool:
    """PATCH an incident's status in data-service."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.patch(
                f"{DATA_BASE}/incidents/{incident_id}/status",
                json={"status": new_status},
                headers=INTERNAL_HEADERS,
            )
            if resp.status_code == 200:
                logger.info("[health-validator] Incident %d → %s", incident_id, new_status)
                return True
            logger.error(
                "[health-validator] PATCH %d returned %d: %s",
                incident_id,
                resp.status_code,
                resp.text[:200],
            )
    except Exception:
        logger.exception("[health-validator] PATCH failed for incident %d", incident_id)
    return False


async def _post_incident_log(incident_id: int, message: str) -> None:
    """Append an audit log entry to an incident in data-service."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{DATA_BASE}/incidents/{incident_id}/logs",
                json={"message": message},
                headers=INTERNAL_HEADERS,
            )
    except Exception:
        logger.warning("[health-validator] Failed to append log for incident %d", incident_id)


async def verify_rollback_health(
    incident_id: int,
    pod_name: str,
    service_name: str,
    namespace: str = "default",
) -> bool:
    """
    Post-remediation verification worker.

    Polls the metrics-service for up to **5 minutes** (30 × 10 s),
    checking that the target pod reaches a ``Running`` state and
    maintains a **stable restart count** for 3 consecutive checks.

    On completion, automatically:
    - Patches the incident status to ``Resolved`` or ``Manual Intervention``
    - Posts a Slack notification (success or failure)
    - Writes a granular audit log entry

    Args:
        incident_id: The incident being resolved.
        pod_name: The Kubernetes pod name to monitor.
        service_name: Logical service name (informational).
        namespace: Kubernetes namespace (default: ``"default"``).

    Returns:
        ``True`` if the pod stabilises; ``False`` on timeout.
    """
    logger.info(
        "[health-validator] Starting post-rollback verification "
        "for incident %d, pod=%s, service=%s",
        incident_id,
        pod_name,
        service_name,
    )

    await _post_incident_log(
        incident_id,
        f"Post-rollback verification started. Monitoring pod {pod_name}.",
    )

    stable_count = 0
    last_restart_count: int | None = None

    for iteration in range(1, MAX_ITERATIONS + 1):
        await asyncio.sleep(POLL_INTERVAL)

        pods = await _fetch_pod_health(namespace)

        # Find our target pod
        pod_info = None
        for p in pods:
            if p.get("pod") == pod_name:
                pod_info = p
                break

        if pod_info is None:
            logger.warning(
                "[health-validator] [%d/%d] Pod %s not found in namespace %s",
                iteration,
                MAX_ITERATIONS,
                pod_name,
                namespace,
            )
            stable_count = 0
            last_restart_count = None
            continue

        pod_state = pod_info.get("state", "")
        restart_count = pod_info.get("restarts", 0)

        logger.info(
            "[health-validator] [%d/%d] Pod %s — state=%s, restarts=%d",
            iteration,
            MAX_ITERATIONS,
            pod_name,
            pod_state,
            restart_count,
        )

        # --- Stability check ---
        if pod_state == "Running" and restart_count == last_restart_count:
            stable_count += 1
            logger.info(
                "[health-validator] Stability streak: %d/%d consecutive checks",
                stable_count,
                CONSECUTIVE_STABLE,
            )
            if stable_count >= CONSECUTIVE_STABLE:
                logger.info(
                    "[health-validator] ✅ Pod %s stabilised after rollback "
                    "(incident %d) — %d consecutive stable checks",
                    pod_name,
                    incident_id,
                    stable_count,
                )
                await _resolve_success(incident_id, service_name, pod_name, stable_count)
                return True
        else:
            stable_count = 0

        last_restart_count = restart_count

    # --- Timeout: pod did not stabilise ---
    logger.warning(
        "[health-validator] ⏱  Timeout after %d iterations — pod %s "
        "did not stabilise (incident %d)",
        MAX_ITERATIONS,
        pod_name,
        incident_id,
    )
    await _resolve_failure(incident_id, service_name, pod_name)
    return False


# ---------------------------------------------------------------------------
# Resolution Callbacks
# ---------------------------------------------------------------------------


async def _resolve_success(
    incident_id: int,
    service_name: str,
    pod_name: str,
    stable_checks: int,
) -> None:
    """Mark incident as Resolved and notify Slack."""
    await _patch_status(incident_id, "Resolved")
    await _post_incident_log(
        incident_id,
        f"System stable. Pod {pod_name} confirmed healthy after "
        f"{stable_checks} consecutive stable checks. Incident resolved.",
    )

    slack_data = {
        "incident_id": incident_id,
        "service_name": service_name,
        "severity": "info",
        "title": "Rollback Verified",
        "status": "Resolved",
        "description": (
            f"✅ System stable. Automated rollback successfully resolved "
            f"the incident. Pod {pod_name} confirmed healthy after "
            f"{stable_checks} consecutive stable checks."
        ),
    }
    await send_slack_alert(slack_data)
    logger.info("[health-validator] Incident %d resolved — Slack notification sent", incident_id)


async def _resolve_failure(
    incident_id: int,
    service_name: str,
    pod_name: str,
) -> None:
    """Mark incident as Manual Intervention and notify Slack."""
    await _patch_status(incident_id, "Manual Intervention")
    await _post_incident_log(
        incident_id,
        f"Rollback completed but pod {pod_name} remains unstable. "
        "Immediate human intervention required.",
    )

    slack_data = {
        "incident_id": incident_id,
        "service_name": service_name,
        "severity": "critical",
        "title": "Rollback Verification Failed",
        "status": "Manual Intervention",
        "description": (
            f"🚨 Rollback completed, but service remains unstable. "
            f"Immediate human intervention required. Pod {pod_name} "
            f"did not stabilise within 5 minutes."
        ),
    }
    await send_slack_alert(slack_data)
    logger.warning(
        "[health-validator] Incident %d escalated — Slack notification sent", incident_id
    )
