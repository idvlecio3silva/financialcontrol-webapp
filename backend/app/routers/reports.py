from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
import calendar
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.income import Income, IncomeStatus
from app.models.investment import Investment, InvestmentStatus
from app.models.debt import Debt, DebtStatus
from app.models.category import Category
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/reports", tags=["Relatórios"])


class CategorySummary(BaseModel):
    category_name: str
    total: Decimal
    pct: Decimal = Decimal("0")


class IncomeSummary(BaseModel):
    source: str
    income_type: str
    total: Decimal


class NetWorthPoint(BaseModel):
    month: int
    year: int
    balance: Decimal
    investments: Decimal
    debts: Decimal
    net_worth: Decimal


class AuditLogOut(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str | None
    ip_address: str | None
    created_at: str

    class Config:
        from_attributes = True


@router.get("/expenses-by-category", response_model=list[CategorySummary])
async def expenses_by_category(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    last_day = calendar.monthrange(year, month)[1]
    start, end = date(year, month, 1), date(year, month, last_day)

    r = await db.execute(
        select(
            Category.name,
            sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0).label("total"),
        )
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(
            Expense.user_id == current_user.id,
            Expense.is_active == True,
            Expense.date >= start,
            Expense.date <= end,
        )
        .group_by(Category.name)
        .order_by(sqlfunc.sum(Expense.amount).desc())
    )
    rows = r.all()

    total = sum(Decimal(str(row[1])) for row in rows)
    return [
        CategorySummary(
            category_name=row[0] or "Sem categoria",
            total=Decimal(str(row[1])),
            pct=(Decimal(str(row[1])) / total * 100).quantize(Decimal("0.01")) if total > 0 else Decimal("0"),
        )
        for row in rows
    ]


@router.get("/incomes-by-source", response_model=list[IncomeSummary])
async def incomes_by_source(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    last_day = calendar.monthrange(year, month)[1]
    start, end = date(year, month, 1), date(year, month, last_day)
    r = await db.execute(
        select(Income.source, Income.income_type, sqlfunc.sum(Income.received_amount).label("total"))
        .where(
            Income.user_id == current_user.id,
            Income.is_active == True,
            Income.date >= start,
            Income.date <= end,
            Income.status == IncomeStatus.RECEIVED,
        )
        .group_by(Income.source, Income.income_type)
        .order_by(sqlfunc.sum(Income.received_amount).desc())
    )
    return [
        IncomeSummary(source=row[0], income_type=row[1], total=Decimal(str(row[2] or 0)))
        for row in r.all()
    ]


@router.get("/net-worth-evolution", response_model=list[NetWorthPoint])
async def net_worth_evolution(
    months: int = Query(default=12, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Evolução do património líquido nos últimos N meses."""
    from app.models.bank_account import BankAccount
    today = date.today()
    points: list[NetWorthPoint] = []

    for i in range(months - 1, -1, -1):
        month = (today.month - i - 1) % 12 + 1
        year = today.year - ((i - today.month + 1) // 12 + (1 if (today.month - i - 1) < 0 else 0))

        inv_r = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Investment.current_value), 0)).where(
                Investment.user_id == current_user.id,
                Investment.is_active == True,
                Investment.status == InvestmentStatus.ACTIVE,
            )
        )
        inv_total = Decimal(str(inv_r.scalar() or 0))

        debt_r = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Debt.current_balance), 0)).where(
                Debt.user_id == current_user.id,
                Debt.is_active == True,
                Debt.status == DebtStatus.ACTIVE,
            )
        )
        debt_total = Decimal(str(debt_r.scalar() or 0))

        bal_r = await db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(BankAccount.current_balance), 0)).where(
                BankAccount.user_id == current_user.id,
                BankAccount.is_active == True,
            )
        )
        bal_total = Decimal(str(bal_r.scalar() or 0))

        points.append(NetWorthPoint(
            month=month, year=year,
            balance=bal_total,
            investments=inv_total,
            debts=debt_total,
            net_worth=bal_total + inv_total - debt_total,
        ))

    return points


@router.get("/audit-log", response_model=list[AuditLogOut])
async def get_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = r.scalars().all()
    return [
        AuditLogOut(
            id=str(log.id),
            action=log.action.value,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            ip_address=log.ip_address,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]
