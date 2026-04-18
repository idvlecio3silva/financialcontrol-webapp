from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.budget import Budget
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from decimal import Decimal
import uuid

router = APIRouter(prefix="/budgets", tags=["Orçamento"])


@router.get("", response_model=list[BudgetResponse])
async def list_budgets(
    year: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Budget).where(Budget.user_id == current_user.id)
    if year:
        q = q.where(Budget.year == year)
    q = q.order_by(Budget.year.desc(), Budget.month.desc())
    r = await db.execute(q)
    budgets = r.scalars().all()
    results = []
    for b in budgets:
        resp = BudgetResponse.model_validate(b)
        resp.income_deviation = b.actual_income - b.expected_income
        resp.expense_deviation = b.actual_expenses - b.expected_expenses
        results.append(resp)
    return results


@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Budget).where(
            Budget.user_id == current_user.id,
            Budget.month == payload.month,
            Budget.year == payload.year,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Orçamento para este mês/ano já existe")

    budget = Budget(user_id=current_user.id, **payload.model_dump())
    db.add(budget)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE,
                     entity_type="budget", entity_id=str(budget.id),
                     new_values=payload.model_dump(mode="json"))
    resp = BudgetResponse.model_validate(budget)
    resp.income_deviation = Decimal("0")
    resp.expense_deviation = Decimal("0")
    return resp


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(budget_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = r.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    require_owner(budget.user_id, current_user)
    resp = BudgetResponse.model_validate(budget)
    resp.income_deviation = budget.actual_income - budget.expected_income
    resp.expense_deviation = budget.actual_expenses - budget.expected_expenses
    return resp


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = r.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    require_owner(budget.user_id, current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE,
                     entity_type="budget", entity_id=str(budget.id),
                     new_values=payload.model_dump(exclude_unset=True, mode="json"))
    resp = BudgetResponse.model_validate(budget)
    resp.income_deviation = budget.actual_income - budget.expected_income
    resp.expense_deviation = budget.actual_expenses - budget.expected_expenses
    return resp
