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

@router.get("/", response_model=list[DeploymentCreate])
async def list_deployments(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve the most recent deployment events from TimescaleDB.
    """
    from sqlalchemy import select

    query = select(DeploymentEvent).order_by(DeploymentEvent.time.desc()).limit(limit)
    result = await db.execute(query)
    deployments = result.scalars().all()
    
    # Convert SQLAlchemy models to Pydantic models for serialization
    return [
        DeploymentCreate(
            time=d.time,
            service_name=d.service_name,
            commit_hash=d.commit_hash,
            author=d.author,
            branch=d.branch,
            status=d.status
        )
        for d in deployments
    ]

@router.patch("/{commit_hash}", response_model=dict)
async def update_deployment_risk(
    commit_hash: str,
    risk_score: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Update the risk score for a specific deployment event by commit hash.
    """
    from sqlalchemy import update
    
    stmt = (
        update(DeploymentEvent)
        .where(DeploymentEvent.commit_hash == commit_hash)
        .values(risk_score=risk_score)
    )
    await db.execute(stmt)
    await db.commit()
    
    return {"status": "success", "commit_hash": commit_hash, "risk_score": risk_score}
