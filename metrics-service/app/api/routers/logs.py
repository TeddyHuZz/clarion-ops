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

@router.get("/{namespace}/{pod_name}")
async def get_pod_logs(namespace: str, pod_name: str, tail_lines: int = 100):
    """
    Retrieve the last *N* lines of logs from a specific pod.
    Default: 100 lines.
    """
    try:
        v1 = K8sClient.get_instance()
        
        logs = v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=tail_lines
        )

        if not logs:
            return {"pod": pod_name, "logs": "", "message": "No logs available"}

        return {"pod": pod_name, "logs": logs}

    except ApiException as e:
        logger.error(f"K8s API Error fetching logs for {pod_name}: {e}")
        if e.status == 404:
            raise HTTPException(status_code=404, detail=f"Pod '{pod_name}' not found in namespace '{namespace}'")
        elif e.status == 403:
            raise HTTPException(status_code=403, detail="Permission denied. Check RBAC settings.")
        else:
            raise HTTPException(status_code=500, detail="Internal Kubernetes API error")

    except Exception as e:
        logger.exception(f"Unexpected error fetching logs for {pod_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve logs")
