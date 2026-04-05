"""API routes for resource metrics."""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.services.resource_metrics import (
    get_cpu_usage,
    get_memory_usage,
    get_disk_io,
    get_network_io,
    get_pod_health,
    MetricResult,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _format_ts(epoch: float | None) -> str:
    if epoch is None:
        return ""
    return datetime.fromtimestamp(epoch).strftime("%H:%M")


def _format_single(metric: MetricResult) -> list[dict[str, float | str]]:
    """Format a single MetricResult into Recharts-style array."""
    if metric.value is None:
        return []
    return [{"timestamp": _format_ts(metric.timestamp), "value": round(metric.value, 4)}]


async def _handle_metric_error(name: str, error: Exception) -> None:
    logger.exception("Error fetching %s: %s", name, error)
    if isinstance(error, HTTPException):
        raise error
    raise HTTPException(status_code=500, detail=f"Failed to fetch {name} metrics: {error}")


@router.get("/cpu")
async def get_cpu(
    namespace: str = Query(..., description="Kubernetes namespace"),
    pod_name: str = Query(..., description="Pod name"),
):
    try:
        result = await get_cpu_usage(namespace, pod_name)
        return _format_single(result)
    except Exception as e:
        await _handle_metric_error("CPU", e)


@router.get("/memory")
async def get_memory(
    namespace: str = Query(..., description="Kubernetes namespace"),
    pod_name: str = Query(..., description="Pod name"),
):
    try:
        result = await get_memory_usage(namespace, pod_name)
        return _format_single(result)
    except Exception as e:
        await _handle_metric_error("Memory", e)


@router.get("/disk")
async def get_disk(
    namespace: str = Query(..., description="Kubernetes namespace"),
    pod_name: str = Query(..., description="Pod name"),
):
    try:
        results = await get_disk_io(namespace, pod_name)
        # Combine read/write into a Recharts-friendly format for potential dual-line charts
        read_res = results["read_bytes_sec"]
        write_res = results["write_bytes_sec"]
        
        # Return as a list with combined metrics per timestamp
        ts = _format_ts(read_res.timestamp or write_res.timestamp)
        if read_res.value is None and write_res.value is None:
            return []
            
        return [{
            "timestamp": ts,
            "read_bytes_sec": round(read_res.value, 4) if read_res.value is not None else 0.0,
            "write_bytes_sec": round(write_res.value, 4) if write_res.value is not None else 0.0,
        }]
    except Exception as e:
        await _handle_metric_error("Disk", e)


@router.get("/network")
async def get_network(
    namespace: str = Query(..., description="Kubernetes namespace"),
    pod_name: str = Query(..., description="Pod name"),
):
    try:
        results = await get_network_io(namespace, pod_name)
        rx = results["receive_bytes_sec"]
        tx = results["transmit_bytes_sec"]
        
        ts = _format_ts(rx.timestamp or tx.timestamp)
        if rx.value is None and tx.value is None:
            return []
            
        return [{
            "timestamp": ts,
            "receive_bytes_sec": round(rx.value, 4) if rx.value is not None else 0.0,
            "transmit_bytes_sec": round(tx.value, 4) if tx.value is not None else 0.0,
        }]
    except Exception as e:
        await _handle_metric_error("Network", e)


@router.get("/pod-health")
async def get_pod_health_route(
    namespace: str = Query(..., description="Kubernetes namespace"),
):
    """Get health and restart status for all pods in a namespace."""
    try:
        return await get_pod_health(namespace)
    except Exception as e:
        await _handle_metric_error("Pod Health", e)


@router.get("/pod-restarts")
async def get_pod_restarts(
    namespace: str = Query(..., description="Kubernetes namespace"),
):
    """Expose pod restart counts directly."""
    try:
        health_data = await get_pod_health(namespace)
        return [
            {
                "pod": item["pod"],
                "container": item["container"],
                "restarts": item["restarts"],
                "status": item["state"]
            }
            for item in health_data
        ]
    except Exception as e:
        await _handle_metric_error("Pod Restarts", e)
