from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.incidents import IncidentEvent

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class IncidentCreate(BaseModel):
    """Schema for ingesting a new incident event from internal pipelines."""
    time: datetime = Field(default_factory=datetime.utcnow)
    service_name: str
    severity: str
    status: str = Field(default="Open")
    raw_payload: Optional[dict] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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
