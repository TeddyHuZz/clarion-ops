from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user_or_service, require_admin
from app.db.session import get_session
from app.models.escalations import EscalationPolicy

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class EscalationPolicyCreate(BaseModel):
    service_name: str
    level_1_user: Optional[str] = None
    level_2_user: Optional[str] = None
    level_3_user: Optional[str] = None


class EscalationPolicyUpdate(BaseModel):
    level_1_user: Optional[str] = None
    level_2_user: Optional[str] = None
    level_3_user: Optional[str] = None


class EscalationPolicyResponse(BaseModel):
    id: int
    service_name: str
    level_1_user: Optional[str]
    level_2_user: Optional[str]
    level_3_user: Optional[str]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[EscalationPolicyResponse])
async def list_policies(
    db: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_or_service),
):
    """Return all escalation policies. Requires authentication."""
    query = select(EscalationPolicy).order_by(EscalationPolicy.service_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{service_name}", response_model=EscalationPolicyResponse)
async def get_policy(
    service_name: str,
    db: AsyncSession = Depends(get_session),
    user=Depends(get_current_user_or_service),
):
    """Return a single escalation policy by service name."""
    query = select(EscalationPolicy).where(EscalationPolicy.service_name == service_name)
    result = await db.execute(query)
    policy = result.scalar_one_or_none()

    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")

    return policy


@router.post("/", response_model=EscalationPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: EscalationPolicyCreate,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
):
    """Create a new escalation policy. Admin role required."""
    # Check for duplicate service_name
    existing = await db.execute(
        select(EscalationPolicy).where(EscalationPolicy.service_name == payload.service_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Policy already exists for this service")

    policy = EscalationPolicy(
        service_name=payload.service_name,
        level_1_user=payload.level_1_user,
        level_2_user=payload.level_2_user,
        level_3_user=payload.level_3_user,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)

    return policy


@router.put("/{service_name}", response_model=EscalationPolicyResponse)
async def update_policy(
    service_name: str,
    payload: EscalationPolicyUpdate,
    db: AsyncSession = Depends(get_session),
    _admin=Depends(require_admin),
):
    """Update an escalation policy. Admin role required."""
    # Build update dict with only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    update_data["updated_at"] = datetime.now()

    stmt = (
        update(EscalationPolicy)
        .where(EscalationPolicy.service_name == service_name)
        .values(**update_data)
        .returning(EscalationPolicy)
    )
    result = await db.execute(stmt)
    policy = result.scalar_one_or_none()

    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")

    await db.commit()
    await db.refresh(policy)

    return policy
