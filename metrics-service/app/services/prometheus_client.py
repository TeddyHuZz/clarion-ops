"""Async Prometheus API client using httpx."""

import logging
from typing import Any

import httpx
from prometheus_client.parser import text_string_to_metric_families

from app.config import settings

logger = logging.getLogger(__name__)


class PrometheusClient:
    """Singleton async client for Prometheus HTTP API.
    
    Time Complexity: __init__ O(1), query_prometheus O(n) where n = HTTP response size
    Space Complexity: O(1) connection pool reused across calls
    """

    _instance: "PrometheusClient | None" = None

    def __init__(self) -> None:
        if PrometheusClient._instance is not None:
            raise RuntimeError("Use PrometheusClient.instance() for singleton access")

        self._base_url = settings.prometheus_url.rstrip("/")
        self._timeout = httpx.Timeout(
            connect=5.0,
            read=settings.query_timeout_sec,
            write=5.0,
            pool=5.0,
        )
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
        )

    @classmethod
    def get_instance(cls) -> "PrometheusClient":
        """Retrieve or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def query_prometheus(self, promql_query: str) -> dict[str, Any]:
        """Execute an instant PromQL query against /api/v1/query endpoint.
        
        Args:
            promql_query: Valid PromQL expression string.
        
        Returns:
            Raw JSON response dict with 'status' and 'data' keys.
        
        Raises:
            HTTPStatusError: On non-2xx Prometheus API responses.
            ConnectError: When Prometheus server is unreachable.
            TimeoutException: When query exceeds configured timeout.
        """
        try:
            response = await self._client.get(
                "/api/v1/query",
                params={"query": promql_query},
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()

            if payload.get("status") != "success":
                error_msg = payload.get("error", "Unknown Prometheus error")
                logger.error("Prometheus query failed: query=%s error=%s", promql_query, error_msg)
                raise httpx.HTTPStatusError(
                    message=f"Prometheus query failed: {error_msg}",
                    request=response.request,
                    response=response,
                )

            return payload

        except httpx.ConnectError as exc:
            logger.error("Failed to connect to Prometheus at %s: %s", self._base_url, exc)
            raise
        except httpx.TimeoutException as exc:
            logger.error("Prometheus query timed out: query=%s timeout=%ds", promql_query, self._timeout.read)
            raise
        except httpx.HTTPStatusError:
            raise

    async def query_range_prometheus(
        self,
        promql_query: str,
        start_ts: float,
        end_ts: float,
        step_sec: int,
    ) -> dict[str, Any]:
        """Execute a range PromQL query against /api/v1/query_range endpoint.
        
        Args:
            promql_query: Valid PromQL expression string.
            start_ts: Start timestamp (Unix epoch).
            end_ts: End timestamp (Unix epoch).
            step_sec: Query resolution step width in seconds.
        
        Returns:
            Raw JSON response dict with matrix vector data.
        """
        try:
            response = await self._client.get(
                "/api/v1/query_range",
                params={
                    "query": promql_query,
                    "start": start_ts,
                    "end": end_ts,
                    "step": step_sec,
                },
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()

            if payload.get("status") != "success":
                error_msg = payload.get("error", "Unknown Prometheus error")
                logger.error("Prometheus range query failed: query=%s error=%s", promql_query, error_msg)
                raise httpx.HTTPStatusError(
                    message=f"Prometheus range query failed: {error_msg}",
                    request=response.request,
                    response=response,
                )

            return payload

        except httpx.ConnectError as exc:
            logger.error("Failed to connect to Prometheus at %s: %s", self._base_url, exc)
            raise
        except httpx.TimeoutException as exc:
            logger.error("Prometheus range query timed out: query=%s timeout=%ds", promql_query, self._timeout.read)
            raise
        except httpx.HTTPStatusError:
            raise

    async def close(self) -> None:
        """Gracefully close the underlying HTTP connection pool."""
        await self._client.aclose()
