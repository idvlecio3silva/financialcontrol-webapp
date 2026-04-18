from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.income import Income
from app.schemas.income import IncomeCreate, IncomeUpdate, IncomeResponse
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from datetime import date
import uuid

router = APIRouter(prefix="/incomes", tags=["Receitas"])


@router.get("", response_model=list[IncomeResponse])
async def list_incomes(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    account_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Income).where(Income.user_id == current_user.id, Income.is_active == True)
    if month and year:
        from datetime import date as d
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        q = q.where(Income.date >= d(year, month, 1), Income.date <= d(year, month, last_day))
    if account_id:
        q = q.where(Income.bank_account_id == account_id)
    q = q.order_by(Income.date.desc())
    r = await db.execute(q)
    return r.scalars().all()


@router.post("", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    payload: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    income = Income(user_id=current_user.id, **payload.model_dump())
    db.add(income)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE, entity_type="income",
                     entity_id=str(income.id), new_values=payload.model_dump(mode="json"))
    return income


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(income_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Income).where(Income.id == income_id, Income.is_active == True))
    income = r.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    require_owner(income.user_id, current_user)
    return income


@router.patch("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: uuid.UUID,
    payload: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Income).where(Income.id == income_id, Income.is_active == True))
    income = r.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    require_owner(income.user_id, current_user)

    old_vals = {k: str(getattr(income, k)) for k in payload.model_fields_set}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(income, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE, entity_type="income",
                     entity_id=str(income.id), old_values=old_vals,
                     new_values=payload.model_dump(exclude_unset=True, mode="json"))
    return income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_income(income_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Income).where(Income.id == income_id, Income.is_active == True))
    income = r.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    require_owner(income.user_id, current_user)
    income.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.CANCEL, entity_type="income",
                     entity_id=str(income.id))
