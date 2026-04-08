"""
Pod Logs Router
================
Exposes endpoints to retrieve raw container logs for AI analysis and debugging.
"""

import logging

from fastapi import APIRouter, HTTPException
from kubernetes.client.rest import ApiException

from app.services.kubernetes_client import K8sClient

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mock logs for environments without a live Kubernetes cluster
# ---------------------------------------------------------------------------
_MOCK_LOGS = (
    "2026-04-08T06:00:01Z INFO  [api-gateway] Starting api-gateway v2.4.0 "
    "(commit a1b2c3d4e5f6)\n"
    "2026-04-08T06:00:02Z INFO  [api-gateway] Connected to postgres:5432\n"
    "2026-04-08T06:00:05Z WARN  [api-gateway] Connection pool size reduced "
    "from 20 to 5 in this release\n"
    "2026-04-08T06:00:10Z ERROR [api-gateway] Connection pool exhausted — "
    "all 5 connections in use, 47 requests queued\n"
    "2026-04-08T06:00:15Z ERROR [api-gateway] Request timeout after 30s: "
    "POST /api/v1/users — 200 requests failed in last 60s\n"
    "2026-04-08T06:00:20Z WARN  [api-gateway] Database unavailable — "
    "connection refused to postgres:5432 (ECONNREFUSED)\n"
    "2026-04-08T06:00:25Z ERROR [api-gateway] OOM killed: memory limit "
    "256Mi exceeded, RSS=512Mi — kernel killed process\n"
    "2026-04-08T06:00:30Z ERROR [api-gateway] CrashLoopBackOff — pod "
    "restarting for 7th time since deploy a1b2c3d4e5f6\n"
    "2026-04-08T06:00:35Z FATAL [api-gateway] Service unable to accept "
    "traffic — all health checks failing\n"
)


@router.get("/{namespace}/{pod_name}")
async def get_pod_logs(namespace: str, pod_name: str, tail_lines: int = 100):
    """
    Retrieve the last *N* lines of logs from a specific pod.
    Default: 100 lines.
    """
    try:
        v1 = K8sClient.get_instance()

        logs = v1.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=tail_lines)

        if not logs:
            return {"pod": pod_name, "logs": "", "message": "No logs available"}

        return {"pod": pod_name, "logs": logs}

    except ApiException as e:
        logger.error("K8s API Error fetching logs for %s: %s", pod_name, e)
        if e.status == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Pod '{pod_name}' not found in namespace '{namespace}'",
            ) from e
        if e.status == 403:
            raise HTTPException(
                status_code=403,
                detail="Permission denied. Check RBAC settings.",
            ) from e
        raise HTTPException(
            status_code=500,
            detail="Internal Kubernetes API error",
        ) from e

    except Exception as e:
        logger.exception("Unexpected error fetching logs for %s: %s", pod_name, e)
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve logs",
        ) from e


@router.get("/default/{pod_name}")
async def get_pod_logs_default(pod_name: str, tail_lines: int = 100):
    """
    Fallback endpoint that returns mock logs when K8s is unavailable.
    Used for local development and demo environments.
    """
    return {"pod": pod_name, "logs": _MOCK_LOGS}
