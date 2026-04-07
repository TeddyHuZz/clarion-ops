from datetime import datetime
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user_or_service
from app.db.session import get_session
from app.models.incidents import IncidentEvent

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

VALID_STATUSES = Literal["Open", "AI Investigating", "Acknowledged", "Manual Intervention", "Resolved"]


class IncidentCreate(BaseModel):
    """Schema for ingesting a new incident event from internal pipelines."""
    time: datetime = Field(default_factory=datetime.utcnow)
    service_name: str
    severity: str
    status: str = Field(default="Open")
    raw_payload: Optional[dict] = None


class StatusUpdate(BaseModel):
    """Schema for updating an incident's status."""
    status: VALID_STATUSES


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[dict])
async def list_incidents(
    db: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_or_service),
):
    """Return all incidents, ordered by most recent first."""
    query = select(IncidentEvent).order_by(IncidentEvent.time.desc())
    result = await db.execute(query)
    incidents = result.scalars().all()

    return [
        {
            "id": i.id,
            "time": i.time.isoformat(),
            "service_name": i.service_name,
            "severity": i.severity,
            "status": i.status,
            "raw_payload": i.raw_payload,
        }
        for i in incidents
    ]


@router.patch("/{incident_id}/status", response_model=dict)
async def update_incident_status(
    incident_id: int,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_or_service),
):
    """Update the status of an incident. Requires Clerk JWT authentication."""
    query = select(IncidentEvent).where(IncidentEvent.id == incident_id)
    result = await db.execute(query)
    incident = result.scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    incident.status = payload.status
    await db.commit()
    await db.refresh(incident)

    return {
        "id": incident.id,
        "service_name": incident.service_name,
        "status": incident.status,
        "time": incident.time.isoformat(),
    }


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_incident_event(
    incident: IncidentCreate,
    db: AsyncSession = Depends(get_session),
):
    """
    Internal endpoint to ingest a new incident event.
    Skips Clerk authentication — only callable from trusted internal services.
    """
    db_incident = IncidentEvent(
        time=incident.time,
        service_name=incident.service_name,
        severity=incident.severity,
        status=incident.status,
        raw_payload=incident.raw_payload,
    )
    db.add(db_incident)
    await db.commit()

    return {
        "id": db_incident.id,
        "status": "created",
        "service_name": db_incident.service_name,
        "severity": db_incident.severity,
        "time": db_incident.time.isoformat(),
    }


@router.get("/count", response_model=int)
async def get_incident_count(
    incident_status: str = "Open",
    db: AsyncSession = Depends(get_session),
):
    """
    Get the count of incidents filtered by status.
    Used by the RiskScoringEngine to assess live system stability.
    """
    query = select(func.count(IncidentEvent.id)).where(
        IncidentEvent.status == incident_status
    )
    result = await db.execute(query)
    return result.scalar_one() or 0
