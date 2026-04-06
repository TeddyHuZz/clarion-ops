from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_session
from app.models.incidents import Incident

router = APIRouter()

@router.get("/count", response_model=int)
async def get_incident_count(
    status: str = "OPEN",
    db: AsyncSession = Depends(get_session)
):
    """
    Get the count of active incidents filtered by status (defaults to OPEN).
    Used by the RiskScoringEngine to assess live system stability.
    """
    query = select(func.count(Incident.id)).where(Incident.status == status)
    result = await db.execute(query)
    count = result.scalar_one()
    return count

@router.post("/", response_model=dict)
async def create_incident(
    title: str,
    status: str = "OPEN",
    db: AsyncSession = Depends(get_session)
):
    """
    Create a new incident record in the audit log.
    """
    new_incident = Incident(title=title, status=status)
    db.add(new_incident)
    await db.commit()
    return {"status": "created", "id": new_incident.id}
