"""
Analytics Router — Incident Timeline Replay
============================================
Exposes endpoints for historical analysis and timeline visualization.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user_or_service
from app.db.session import get_session

router = APIRouter()


@router.get("/timeline", response_model=list[dict])
async def get_incident_timeline(
    service_name: str = Query(..., description="Target service identifier"),  # noqa: B008
    start_time: datetime = Query(..., description="Start of time window (ISO 8601)"),  # noqa: B008
    end_time: datetime = Query(..., description="End of time window (ISO 8601)"),  # noqa: B008
    db: AsyncSession = Depends(get_session),  # noqa: B008
    user=Depends(get_current_user_or_service),  # noqa: B008
) -> list[dict]:
    """
    Retrieve a unified, chronologically sorted timeline of events for a specific service.

    Aggregates data from three sources:
    1. Incident State Changes (incident_events)
    2. AI Analysis Logs (incident_logs)
    3. Deployment Events (deployment_events)
    """
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    # ---------------------------------------------------------------------------
    # Raw Parameterized SQL with UNION ALL
    # ---------------------------------------------------------------------------
    query = text(
        """
        SELECT * FROM (
            -- 1. Incident State Changes
            SELECT
                time AS timestamp,
                'ALERT_STATE_CHANGE' AS event_type,
                json_build_object(
                    'severity', severity,
                    'status', status
                ) AS payload
            FROM incident_events
            WHERE service_name = :service_name
              AND time >= :start_time
              AND time <= :end_time

            UNION ALL

            -- 2. AI Analysis Logs
            SELECT
                l.time AS timestamp,
                'AI_RCA_LOG' AS event_type,
                json_build_object(
                    'message', l.message,
                    'incident_id', l.incident_id
                ) AS payload
            FROM incident_logs l
            JOIN incident_events e ON l.incident_id = e.id
            WHERE e.service_name = :service_name
              AND l.time >= :start_time
              AND l.time <= :end_time

            UNION ALL

            -- 3. Deployment Events
            SELECT
                time AS timestamp,
                'DEPLOYMENT' AS event_type,
                json_build_object(
                    'commit_hash', commit_hash,
                    'branch', branch
                ) AS payload
            FROM deployment_events
            WHERE service_name = :service_name
              AND time >= :start_time
              AND time <= :end_time
        ) AS combined_streams
        ORDER BY timestamp ASC;
        """
    )

    # ---------------------------------------------------------------------------
    # Execution
    # ---------------------------------------------------------------------------
    params = {
        "service_name": service_name,
        "start_time": start_time,
        "end_time": end_time,
    }

    try:
        result = await db.execute(query, params)
        rows = result.mappings().all()

        # Convert RowMapping objects to standard dicts for JSON serialization
        return [dict(row) for row in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Timeline query failed: {str(e)}") from e
