from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.liability import Liability, LiabilityStatus
from app.schemas.liability import LiabilityCreate, LiabilityUpdate, LiabilityResponse
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
import uuid

router = APIRouter(prefix="/liabilities", tags=["Responsabilidades"])


@router.get("", response_model=list[LiabilityResponse])
async def list_liabilities(
    status_filter: LiabilityStatus | None = Query(None, alias="status"),
    account_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Liability).where(Liability.user_id == current_user.id, Liability.is_active == True)
    if status_filter:
        q = q.where(Liability.status == status_filter)
    if account_id:
        q = q.where(Liability.bank_account_id == account_id)
    q = q.order_by(Liability.priority, Liability.next_due_date)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("", response_model=LiabilityResponse, status_code=status.HTTP_201_CREATED)
async def create_liability(
    payload: LiabilityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    liability = Liability(user_id=current_user.id, **payload.model_dump())
    db.add(liability)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE,
                     entity_type="liability", entity_id=str(liability.id),
                     new_values=payload.model_dump(mode="json"))
    return liability


@router.get("/{liability_id}", response_model=LiabilityResponse)
async def get_liability(
    liability_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Liability).where(Liability.id == liability_id, Liability.is_active == True))
    liability = r.scalar_one_or_none()
    if not liability:
        raise HTTPException(status_code=404, detail="Responsabilidade não encontrada")
    require_owner(liability.user_id, current_user)
    return liability


@router.patch("/{liability_id}", response_model=LiabilityResponse)
async def update_liability(
    liability_id: uuid.UUID,
    payload: LiabilityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Liability).where(Liability.id == liability_id, Liability.is_active == True))
    liability = r.scalar_one_or_none()
    if not liability:
        raise HTTPException(status_code=404, detail="Responsabilidade não encontrada")
    require_owner(liability.user_id, current_user)

    old_vals = {k: str(getattr(liability, k)) for k in payload.model_fields_set}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(liability, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE,
                     entity_type="liability", entity_id=str(liability.id),
                     old_values=old_vals, new_values=payload.model_dump(exclude_unset=True, mode="json"))
    return liability


@router.delete("/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_liability(
    liability_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Liability).where(Liability.id == liability_id, Liability.is_active == True))
    liability = r.scalar_one_or_none()
    if not liability:
        raise HTTPException(status_code=404, detail="Responsabilidade não encontrada")
    require_owner(liability.user_id, current_user)
    liability.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.CANCEL,
                     entity_type="liability", entity_id=str(liability.id))
