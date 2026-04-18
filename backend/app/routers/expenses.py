from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.expense import Expense, ExpenseStatus
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.services.financial_engine import FinancialEngine
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
import uuid

router = APIRouter(prefix="/expenses", tags=["Despesas"])


@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    account_id: uuid.UUID | None = None,
    status_filter: ExpenseStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Expense).where(Expense.user_id == current_user.id, Expense.is_active == True)
    if month and year:
        import calendar
        from datetime import date
        last_day = calendar.monthrange(year, month)[1]
        q = q.where(Expense.date >= date(year, month, 1), Expense.date <= date(year, month, last_day))
    if account_id:
        q = q.where(Expense.bank_account_id == account_id)
    if status_filter:
        q = q.where(Expense.status == status_filter)
    q = q.order_by(Expense.date.desc())
    r = await db.execute(q)
    return r.scalars().all()


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Regra 3: Validar liquidez da conta antes de registar
    engine = FinancialEngine(db, current_user.id)
    ok, msg = await engine.validate_expense_liquidity(payload.bank_account_id, payload.amount)
    if not ok:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Liquidez insuficiente: {msg}")

    expense = Expense(user_id=current_user.id, **payload.model_dump())
    db.add(expense)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE, entity_type="expense",
                     entity_id=str(expense.id), new_values=payload.model_dump(mode="json"))
    return expense


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(expense_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.is_active == True))
    expense = r.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    require_owner(expense.user_id, current_user)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.is_active == True))
    expense = r.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    require_owner(expense.user_id, current_user)

    old_vals = {k: str(getattr(expense, k)) for k in payload.model_fields_set}

    # If changing amount or account, re-validate liquidity
    new_amount = payload.amount or expense.amount
    new_account = payload.bank_account_id or expense.bank_account_id
    if payload.amount or payload.bank_account_id:
        engine = FinancialEngine(db, current_user.id)
        ok, msg = await engine.validate_expense_liquidity(new_account, new_amount)
        if not ok:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Liquidez insuficiente: {msg}")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE, entity_type="expense",
                     entity_id=str(expense.id), old_values=old_vals,
                     new_values=payload.model_dump(exclude_unset=True, mode="json"))
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_expense(expense_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Expense).where(Expense.id == expense_id, Expense.is_active == True))
    expense = r.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    require_owner(expense.user_id, current_user)
    expense.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.CANCEL, entity_type="expense",
                     entity_id=str(expense.id))
