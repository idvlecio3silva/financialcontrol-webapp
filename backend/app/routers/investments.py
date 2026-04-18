from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.investment import Investment, InvestmentStatus
from app.schemas.investment import InvestmentCreate, InvestmentUpdate, InvestmentResponse
from app.schemas.dashboard import InvestmentValidationOut
from app.services.financial_engine import FinancialEngine
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from decimal import Decimal
import uuid

router = APIRouter(prefix="/investments", tags=["Investimentos"])


@router.get("", response_model=list[InvestmentResponse])
async def list_investments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Investment).where(
            Investment.user_id == current_user.id,
            Investment.is_active == True,
        ).order_by(Investment.date.desc())
    )
    investments = r.scalars().all()
    results = []
    for inv in investments:
        resp = InvestmentResponse.model_validate(inv)
        if inv.invested_amount > Decimal("0"):
            resp.return_pct = ((inv.current_value - inv.invested_amount) / inv.invested_amount * 100).quantize(Decimal("0.01"))
        results.append(resp)
    return results


@router.post("/validate", response_model=InvestmentValidationOut)
async def validate_investment(
    account_id: uuid.UUID,
    amount: Decimal,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pré-validação antes de criar investimento (Regra 6)."""
    engine = FinancialEngine(db, current_user.id)
    ok, reason = await engine.validate_investment(account_id, amount)
    capacity = await engine.calculate_investment_capacity()
    return InvestmentValidationOut(allowed=ok, reason=reason, investment_capacity=capacity)


@router.post("", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_investment(
    payload: InvestmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Regra 6: validação obrigatória de capacidade financeira antes de criar investimento
    engine = FinancialEngine(db, current_user.id)
    ok, reason = await engine.validate_investment(payload.bank_account_id, payload.invested_amount)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Investimento bloqueado: {reason}",
        )

    current_value = payload.current_value if payload.current_value is not None else payload.invested_amount
    investment = Investment(
        user_id=current_user.id,
        current_value=current_value,
        **{k: v for k, v in payload.model_dump().items() if k != "current_value"},
    )
    db.add(investment)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE,
                     entity_type="investment", entity_id=str(investment.id),
                     new_values=payload.model_dump(mode="json"))

    resp = InvestmentResponse.model_validate(investment)
    resp.return_pct = Decimal("0")
    return resp


@router.get("/{investment_id}", response_model=InvestmentResponse)
async def get_investment(
    investment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Investment).where(Investment.id == investment_id, Investment.is_active == True))
    inv = r.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    require_owner(inv.user_id, current_user)
    resp = InvestmentResponse.model_validate(inv)
    if inv.invested_amount > Decimal("0"):
        resp.return_pct = ((inv.current_value - inv.invested_amount) / inv.invested_amount * 100).quantize(Decimal("0.01"))
    return resp


@router.patch("/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: uuid.UUID,
    payload: InvestmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Investment).where(Investment.id == investment_id, Investment.is_active == True))
    inv = r.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    require_owner(inv.user_id, current_user)

    old_vals = {k: str(getattr(inv, k)) for k in payload.model_fields_set}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE,
                     entity_type="investment", entity_id=str(inv.id),
                     old_values=old_vals, new_values=payload.model_dump(exclude_unset=True, mode="json"))

    resp = InvestmentResponse.model_validate(inv)
    if inv.invested_amount > Decimal("0"):
        resp.return_pct = ((inv.current_value - inv.invested_amount) / inv.invested_amount * 100).quantize(Decimal("0.01"))
    return resp


@router.delete("/{investment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_investment(
    investment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Investment).where(Investment.id == investment_id, Investment.is_active == True))
    inv = r.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investimento não encontrado")
    require_owner(inv.user_id, current_user)
    inv.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.CANCEL,
                     entity_type="investment", entity_id=str(inv.id))
