from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.debt import Debt
from app.schemas.debt import DebtCreate, DebtUpdate, DebtResponse
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
import uuid

router = APIRouter(prefix="/debts", tags=["Dívidas"])


@router.get("", response_model=list[DebtResponse])
async def list_debts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Debt).where(Debt.user_id == current_user.id, Debt.is_active == True)
        .order_by(Debt.risk_level, Debt.next_due_date)
    )
    return r.scalars().all()


@router.post("", response_model=DebtResponse, status_code=status.HTTP_201_CREATED)
async def create_debt(
    payload: DebtCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    debt = Debt(user_id=current_user.id, **payload.model_dump())
    db.add(debt)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE,
                     entity_type="debt", entity_id=str(debt.id),
                     new_values=payload.model_dump(mode="json"))
    return debt


@router.get("/{debt_id}", response_model=DebtResponse)
async def get_debt(debt_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Debt).where(Debt.id == debt_id, Debt.is_active == True))
    debt = r.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")
    require_owner(debt.user_id, current_user)
    return debt


@router.patch("/{debt_id}", response_model=DebtResponse)
async def update_debt(
    debt_id: uuid.UUID,
    payload: DebtUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Debt).where(Debt.id == debt_id, Debt.is_active == True))
    debt = r.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")
    require_owner(debt.user_id, current_user)

    old_vals = {k: str(getattr(debt, k)) for k in payload.model_fields_set}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(debt, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE,
                     entity_type="debt", entity_id=str(debt.id),
                     old_values=old_vals, new_values=payload.model_dump(exclude_unset=True, mode="json"))
    return debt


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_debt(debt_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Debt).where(Debt.id == debt_id, Debt.is_active == True))
    debt = r.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")
    require_owner(debt.user_id, current_user)
    debt.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.CANCEL,
                     entity_type="debt", entity_id=str(debt.id))
