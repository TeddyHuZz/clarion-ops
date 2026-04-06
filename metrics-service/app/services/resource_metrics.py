"""Service layer for Kubernetes pod resource metrics from Prometheus."""

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.services.prometheus_client import PrometheusClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MetricResult:
    """Parsed metric response with metadata."""
    value: float | None
    query: str
    timestamp: float | None = None


# PromQL query templates
_CPU_QUERY = 'rate(container_cpu_usage_seconds_total{{namespace="{namespace}", pod="{pod}"}}[5m])'
_MEMORY_QUERY = 'container_memory_working_set_bytes{{namespace="{namespace}", pod="{pod}"}}'
_DISK_READ_QUERY = 'rate(container_fs_reads_bytes_total{{namespace="{namespace}", pod="{pod}"}}[5m])'
_DISK_WRITE_QUERY = 'rate(container_fs_writes_bytes_total{{namespace="{namespace}", pod="{pod}"}}[5m])'
_NET_RX_QUERY = 'rate(container_network_receive_bytes_total{{namespace="{namespace}", pod="{pod}"}}[5m])'
_NET_TX_QUERY = 'rate(container_network_transmit_bytes_total{{namespace="{namespace}", pod="{pod}"}}[5m])'


def _parse_duration_to_seconds(duration: str) -> float:
    """Parse Prometheus-style duration string (e.g., '5m', '1h') to seconds."""
    multipliers = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800}
    unit = duration[-1]
    value = int(duration[:-1])
    return value * multipliers.get(unit, 1)


def _extract_value(response: dict[str, Any]) -> float | None:
    """Extract scalar value from Prometheus instant query response."""
    result = response.get("data", {}).get("result", [])
    if not result:
        return None
    
    value_str = result[0].get("value", [None, None])[1]
    if value_str is None or value_str == "NaN":
        return None
    
    try:
        return float(value_str)
    except (ValueError, TypeError) as exc:
        logger.warning("Failed to parse Prometheus value: %s | Error: %s", result[0], exc)
        return None


async def is_target_up(namespace: str) -> bool:
    """Check if the metrics target for a namespace is currently reachable."""
    client = PrometheusClient.get_instance()
    # Query 'up' metric for the namespace
    response = await client.query_prometheus(f'up{{namespace="{namespace}"}} == 1')
    result = response.get("data", {}).get("result", [])
    return len(result) > 0

async def get_cpu_usage(namespace: str, pod: str, range: str | None = None) -> MetricResult | list[dict]:
    """Fetch CPU usage in cores (5-minute average rate).
    
    If *range* is provided (e.g., "5m"), returns a list of historical data points
    suitable for charting. Otherwise returns a single instant metric.
    """
    if not await is_target_up(namespace):
        return [] if range else MetricResult(value=None, query="GATED: target down", timestamp=None)

    client = PrometheusClient.get_instance()
    query = _CPU_QUERY.format(namespace=namespace, pod=pod)

    if range:
        end = time.time()
        start = end - _parse_duration_to_seconds(range)
        step = max(10, int(_parse_duration_to_seconds(range) / 30))  # ~30 points

        response = await client.query_range_prometheus(query, start, end, step)
        result = response.get("data", {}).get("result", [])
        if not result:
            return []

        values = result[0].get("values", [])
        return [
            {"timestamp": datetime.fromtimestamp(ts).strftime("%H:%M:%S"), "value": float(val)}
            for ts, val in values
        ]

    response = await client.query_prometheus(query)
    value = _extract_value(response)
    timestamp = response.get("data", {}).get("result", [{}])[0].get("value", [None])[0]

    return MetricResult(value=value, query=query, timestamp=float(timestamp) if timestamp else None)


async def get_memory_usage(namespace: str, pod: str, range: str | None = None) -> MetricResult | list[dict]:
    """Fetch memory working set bytes.
    
    If *range* is provided (e.g., "5m"), returns a list of historical data points.
    """
    if not await is_target_up(namespace):
        return [] if range else MetricResult(value=None, query="GATED: target down", timestamp=None)

    client = PrometheusClient.get_instance()
    query = _MEMORY_QUERY.format(namespace=namespace, pod=pod)

    if range:
        end = time.time()
        start = end - _parse_duration_to_seconds(range)
        step = max(10, int(_parse_duration_to_seconds(range) / 30))

        response = await client.query_range_prometheus(query, start, end, step)
        result = response.get("data", {}).get("result", [])
        if not result:
            return []

        values = result[0].get("values", [])
        return [
            {"timestamp": datetime.fromtimestamp(ts).strftime("%H:%M:%S"), "value": float(val)}
            for ts, val in values
        ]

    response = await client.query_prometheus(query)
    value = _extract_value(response)
    timestamp = response.get("data", {}).get("result", [{}])[0].get("value", [None])[0]

    return MetricResult(value=value, query=query, timestamp=float(timestamp) if timestamp else None)


async def get_disk_io(namespace: str, pod: str) -> dict[str, MetricResult]:
    """Fetch disk read/write throughput in bytes/sec."""
    if not await is_target_up(namespace):
        empty = MetricResult(value=None, query="GATED: target down", timestamp=None)
        return {"read_bytes_sec": empty, "write_bytes_sec": empty}
        
    client = PrometheusClient.get_instance()
    
    read_query = _DISK_READ_QUERY.format(namespace=namespace, pod=pod)
    write_query = _DISK_WRITE_QUERY.format(namespace=namespace, pod=pod)
    
    read_resp = await client.query_prometheus(read_query)
    write_resp = await client.query_prometheus(write_query)
    
    return {
        "read_bytes_sec": MetricResult(
            value=_extract_value(read_resp),
            query=read_query,
            timestamp=float(read_resp.get("data", {}).get("result", [{}])[0].get("value", [None])[0] or 0),
        ),
        "write_bytes_sec": MetricResult(
            value=_extract_value(write_resp),
            query=write_query,
            timestamp=float(write_resp.get("data", {}).get("result", [{}])[0].get("value", [None])[0] or 0),
        ),
    }


async def get_network_io(namespace: str, pod: str) -> dict[str, MetricResult]:
    """Fetch network receive/transmit throughput in bytes/sec."""
    if not await is_target_up(namespace):
        empty = MetricResult(value=None, query="GATED: target down", timestamp=None)
        return {"receive_bytes_sec": empty, "transmit_bytes_sec": empty}
        
    client = PrometheusClient.get_instance()
    
    rx_query = _NET_RX_QUERY.format(namespace=namespace, pod=pod)
    tx_query = _NET_TX_QUERY.format(namespace=namespace, pod=pod)
    
    rx_resp = await client.query_prometheus(rx_query)
    tx_resp = await client.query_prometheus(tx_query)
    
    return {
        "receive_bytes_sec": MetricResult(
            value=_extract_value(rx_resp),
            query=rx_query,
            timestamp=float(rx_resp.get("data", {}).get("result", [{}])[0].get("value", [None])[0] or 0),
        ),
        "transmit_bytes_sec": MetricResult(
            value=_extract_value(tx_resp),
            query=tx_query,
            timestamp=float(tx_resp.get("data", {}).get("result", [{}])[0].get("value", [None])[0] or 0),
        ),
    }


async def get_pod_health(namespace: str) -> list[dict[str, Any]]:
    """Query kube-state-metrics for pod restarts, running state, and waiting reasons."""
    client = PrometheusClient.get_instance()
    
    restart_query = f'kube_pod_container_status_restarts_total{{namespace="{namespace}"}}'
    waiting_query = f'kube_pod_container_status_waiting_reason{{namespace="{namespace}"}}'
    running_query = f'kube_pod_container_status_running{{namespace="{namespace}"}} == 1'
    
    restart_data = (await client.query_prometheus(restart_query)).get("data", {}).get("result", [])
    waiting_data = (await client.query_prometheus(waiting_query)).get("data", {}).get("result", [])
    running_data = (await client.query_prometheus(running_query)).get("data", {}).get("result", [])
    
    pod_health: dict[str, dict[str, Any]] = {}
    
    def _get_key(m: dict) -> str:
        return f"{m.get('pod', 'unknown')}/{m.get('container', 'unknown')}"
    
    def _build_entry(m: dict, default_state: str = "Unknown") -> dict:
        return {
            "namespace": m.get("namespace", namespace),
            "pod": m.get("pod", "unknown"),
            "container": m.get("container", "unknown"),
            "state": default_state,
            "restarts": 0
        }
    
    for item in running_data:
        meta = item.get("metric", {})
        key = _get_key(meta)
        pod_health.setdefault(key, _build_entry(meta, "Running"))
        
    for item in waiting_data:
        meta = item.get("metric", {})
        key = _get_key(meta)
        reason = meta.get("reason", "Waiting")
        if key in pod_health:
            pod_health[key]["state"] = reason
        else:
            pod_health[key] = _build_entry(meta, reason)
            
    for item in restart_data:
        meta = item.get("metric", {})
        key = _get_key(meta)
        entry = pod_health.setdefault(key, _build_entry(meta, "Terminated"))
        val = item.get("value", [None, "0"])
        entry["restarts"] = int(float(val[1])) if len(val) >= 2 else 0
        
    return list(pod_health.values())
    
async def get_namespace_sla(namespace: str, window: str = "5m") -> MetricResult:
    """Calculate the uptime SLA for all services in a namespace over a given window."""
    client = PrometheusClient.get_instance()
    # Using the standard Prometheus 'up' metric which is guaranteed to be 0 when unreachable
    query = f'avg_over_time(up{{namespace="{namespace}"}}[{window}]) * 100'
    
    response = await client.query_prometheus(query)
    results = response.get("data", {}).get("result", [])
    
    if not results:
        return MetricResult(value=0.0, query=query, timestamp=None)
        
    value = _extract_value(response)
    timestamp = results[0].get("value", [None])[0]
    
    return MetricResult(value=value, query=query, timestamp=float(timestamp) if timestamp else None)
