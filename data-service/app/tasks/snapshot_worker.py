import logging
from datetime import UTC, datetime

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import insert

from ..core.config import settings
from ..db.session import async_session
from ..models.metrics import MetricSnapshot

logger = logging.getLogger(__name__)

# 1. Initialize the Async Scheduler
scheduler = AsyncIOScheduler()


async def fetch_and_store_metrics():
    """
    Task: Pull live pod health metrics and persist them to TimescaleDB.
    Runs every 60 seconds.
    """
    logger.info(f"Starting metrics snapshot task for namespace: {settings.SNAPSHOT_NAMESPACE}...")

    # Correct internal metrics-service URL with required namespace parameter
    metrics_url = (
        f"http://metrics-service:8001/api/v1/metrics/pod-health"
        f"?namespace={settings.SNAPSHOT_NAMESPACE}"
    )

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # 1. Fetch live metrics
            # Note: We skip Auth for now as it's internal;
            # later we add X-Internal-Key if security is toggled.
            response = await client.get(metrics_url)
            response.raise_for_status()
            pod_data = response.json()

            if not pod_data:
                logger.warning(f"No pod metrics found for namespace: {settings.SNAPSHOT_NAMESPACE}")
                return

            # 2. Prepare records for bulk insert
            now = datetime.now(UTC)
            records = [
                {
                    "time": now,
                    "namespace": pod.get("namespace"),
                    "pod_name": pod.get("pod"),
                    "cpu_usage": 0.0,
                    "memory_bytes": 0,
                    "restart_count": pod.get("restarts", 0),
                }
                for pod in pod_data
            ]

            # 3. Bulk Insert into Hypertable
            async with async_session() as session:
                async with session.begin():
                    await session.execute(insert(MetricSnapshot), records)
                logger.info(f"V4: Successfully snapshotted {len(records)} pod records.")

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch metrics from gateway: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in snapshot worker: {str(e)}")


def setup_scheduler():
    """
    Registers the polling job with the global scheduler.
    """
    scheduler.add_job(
        fetch_and_store_metrics,
        "interval",
        seconds=60,
        id="metrics_snapshot_job",
        replace_existing=True,
    )
