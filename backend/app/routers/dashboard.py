from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardOut, AccountLiquidityOut, InvestmentValidationOut
from app.services.financial_engine import FinancialEngine
import uuid

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardOut)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard executivo com todos os indicadores financeiros em tempo real."""
    engine = FinancialEngine(db, current_user.id)
    indicators = await engine.get_dashboard_indicators()

    accounts_out = [
        AccountLiquidityOut(
            account_id=a.account_id,
            account_name=a.account_name,
            bank_name=a.bank_name,
            current_balance=a.current_balance,
            committed_balance=a.committed_balance,
            available_balance=a.available_balance,
            minimum_balance=a.minimum_balance,
            has_sufficient_funds=a.has_sufficient_funds,
        )
        for a in indicators.accounts
    ]

    return DashboardOut(
        total_balance=indicators.total_balance,
        total_committed=indicators.total_committed,
        total_available=indicators.total_available,
        total_investable=indicators.investment_capacity,
        monthly_income_expected=indicators.monthly_income_expected,
        monthly_income_received=indicators.monthly_income_received,
        monthly_expenses_total=indicators.monthly_expenses_total,
        monthly_liabilities_total=indicators.monthly_liabilities_total,
        can_invest=indicators.can_invest,
        financial_risk=indicators.financial_risk,
        investment_capacity=indicators.investment_capacity,
        investment_block_reason=indicators.investment_block_reason,
        savings_rate=indicators.savings_rate,
        debt_ratio=indicators.debt_ratio,
        liability_coverage_pct=indicators.liability_coverage_pct,
        overdue_liabilities=indicators.overdue_liabilities,
        overdue_expenses=indicators.overdue_expenses,
        accounts_at_risk=indicators.accounts_at_risk,
        net_worth=indicators.net_worth,
        total_debt=indicators.total_debt,
        total_investments_value=indicators.total_investments_value,
        accounts=accounts_out,
    )


@router.get("/investment-check", response_model=InvestmentValidationOut)
async def check_investment_capacity(
    account_id: uuid.UUID | None = None,
    amount: float = Query(default=0.0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verifica em tempo real se o utilizador pode investir (Regras 5 e 6)."""
    engine = FinancialEngine(db, current_user.id)
    capacity = await engine.calculate_investment_capacity()

    if account_id and amount > 0:
        ok, reason = await engine.validate_investment(account_id, Decimal(str(amount)))
    else:
        has_risk, risks = await engine.assess_financial_risk()
        ok = not has_risk and capacity > Decimal("0")
        reason = "; ".join(risks) if risks else ("Pode investir" if ok else "Capacidade nula")

    return InvestmentValidationOut(allowed=ok, reason=reason, investment_capacity=capacity)
