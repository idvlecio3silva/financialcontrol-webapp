from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta
from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.dashboard import CashFlowDayOut
from app.services.financial_engine import FinancialEngine

router = APIRouter(prefix="/cashflow", tags=["Fluxo de Caixa"])


@router.get("/projection", response_model=list[CashFlowDayOut])
async def get_cashflow_projection(
    days: int = Query(default=30, ge=7, le=180),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Projecção de fluxo de caixa (Regra 4): identifica dias críticos e janelas seguras."""
    engine = FinancialEngine(db, current_user.id)
    start = date.today()
    end = start + timedelta(days=days)
    cashflow = await engine.project_cashflow(start, end)
    return [
        CashFlowDayOut(
            date=day.date,
            account_name=day.account_name,
            inflows=day.inflows,
            outflows=day.outflows,
            net=day.net,
            running_balance=day.running_balance,
            free_balance=day.free_balance,
            is_critical=day.is_critical,
            events=day.events,
        )
        for day in cashflow
    ]


@router.get("/simulate", response_model=list[CashFlowDayOut])
async def simulate_cashflow(
    days: int = Query(default=30, ge=7, le=90),
    extra_expense: float = Query(default=0.0, ge=0),
    extra_income: float = Query(default=0.0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Simulação 'e se?': impacto de despesa ou receita adicional no fluxo."""
    from decimal import Decimal
    engine = FinancialEngine(db, current_user.id)
    start = date.today()
    end = start + timedelta(days=days)
    cashflow = await engine.project_cashflow(start, end)

    extra_exp = Decimal(str(extra_expense))
    extra_inc = Decimal(str(extra_income))
    net_delta = extra_inc - extra_exp

    simulated = []
    running_adjustment = Decimal("0")
    for day in cashflow:
        if day.date == start:
            running_adjustment = net_delta
        adj_balance = day.running_balance + running_adjustment
        adj_free = day.free_balance + running_adjustment
        simulated.append(CashFlowDayOut(
            date=day.date,
            account_name=day.account_name,
            inflows=day.inflows + (extra_inc if day.date == start else Decimal("0")),
            outflows=day.outflows + (extra_exp if day.date == start else Decimal("0")),
            net=day.net + (net_delta if day.date == start else Decimal("0")),
            running_balance=adj_balance,
            free_balance=adj_free,
            is_critical=adj_free < Decimal("0"),
            events=day.events,
        ))
    return simulated
