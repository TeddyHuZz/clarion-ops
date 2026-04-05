from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session
from app.models.cves import CVEScan

router = APIRouter()

# Dependency for database session
async def get_db():
    async with async_session() as session:
        yield session

class CVECreate(BaseModel):
    """Schema for individual CVE scan result entry."""
    time: datetime = Field(default_factory=datetime.utcnow)
    commit_hash: str
    cve_id: str
    severity: str
    package_name: str
    fixed_version: Optional[str] = None

@router.post("/scans", response_model=dict, status_code=status.HTTP_201_CREATED)
async def bulk_ingest_cves(
    cves: List[CVECreate],
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk ingest CVE scan results for a specific commit.
    This internal endpoint currently skips Clerk authentication.
    """
    try:
        db_entries = [
            CVEScan(
                time=entry.time,
                commit_hash=entry.commit_hash,
                cve_id=entry.cve_id,
                severity=entry.severity,
                package_name=entry.package_name,
                fixed_version=entry.fixed_version
            ) for entry in cves
        ]
        
        db.add_all(db_entries)
        await db.commit()
        
        return {
            "status": "success", 
            "records_ingested": len(db_entries),
            "commit_hash": cves[0].commit_hash if cves else "N/A"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk ingestion failed: {str(e)}"
        )

@router.get("/scans/{commit_hash}", response_model=List[dict])
async def get_cves_by_commit(
    commit_hash: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve all security vulnerability scan results for a specific commit.
    """
    from sqlalchemy import select
    
    query = select(CVEScan).where(CVEScan.commit_hash == commit_hash).order_by(CVEScan.severity.desc())
    result = await db.execute(query)
    return result.scalars().all()
