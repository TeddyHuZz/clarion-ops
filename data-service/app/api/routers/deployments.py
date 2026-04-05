from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session
from app.models.deployments import DeploymentEvent

router = APIRouter()

# Dependency for database session
async def get_db():
    async with async_session() as session:
        yield session

class DeploymentCreate(BaseModel):
    """Schema for creating a new deployment event via internal ingestion."""
    time: datetime = Field(default_factory=datetime.utcnow)
    service_name: str
    commit_hash: str
    author: str
    branch: str
    status: str

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_deployment_event(
    event: DeploymentCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest a new deployment event into TimescaleDB.
    This endpoint is internal and currently skips Clerk authentication.
    """
    try:
        db_event = DeploymentEvent(
            time=event.time,
            service_name=event.service_name,
            commit_hash=event.commit_hash,
            author=event.author,
            branch=event.branch,
            status=event.status
        )
        db.add(db_event)
        await db.commit()
        return {"status": "success", "message": f"Deployment for {event.service_name} recorded."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record deployment: {str(e)}"
        )
