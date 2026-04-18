from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.bank_account import BankAccount
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate, BankAccountResponse
from app.services.financial_engine import FinancialEngine
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from decimal import Decimal
import uuid

router = APIRouter(prefix="/bank-accounts", tags=["Contas Bancárias"])


@router.get("", response_model=list[BankAccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    engine = FinancialEngine(db, current_user.id)
    r = await db.execute(
        select(BankAccount).where(
            BankAccount.user_id == current_user.id,
            BankAccount.is_active == True,
        ).order_by(BankAccount.bank_name, BankAccount.name)
    )
    accounts = r.scalars().all()

    results = []
    for acc in accounts:
        liq = await engine.get_account_liquidity(acc)
        resp = BankAccountResponse.model_validate(acc)
        resp.committed_balance = liq.committed_balance
        resp.available_balance = liq.available_balance
        results.append(resp)
    return results


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = BankAccount(user_id=current_user.id, **payload.model_dump())
    db.add(account)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE, entity_type="bank_account",
                     entity_id=str(account.id), new_values=payload.model_dump(mode="json"))
    resp = BankAccountResponse.model_validate(account)
    resp.committed_balance = Decimal("0")
    resp.available_balance = account.current_balance - account.minimum_balance
    return resp


@router.get("/{account_id}", response_model=BankAccountResponse)
async def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = r.scalar_one_or_none()
    if not account or not account.is_active:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    require_owner(account.user_id, current_user)

    engine = FinancialEngine(db, current_user.id)
    liq = await engine.get_account_liquidity(account)
    resp = BankAccountResponse.model_validate(account)
    resp.committed_balance = liq.committed_balance
    resp.available_balance = liq.available_balance
    return resp


@router.patch("/{account_id}", response_model=BankAccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: BankAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = r.scalar_one_or_none()
    if not account or not account.is_active:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    require_owner(account.user_id, current_user)

    old = {k: str(getattr(account, k)) for k in payload.model_fields if getattr(account, k, None) is not None}
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)

    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE, entity_type="bank_account",
                     entity_id=str(account.id), old_values=old, new_values=update_data)

    engine = FinancialEngine(db, current_user.id)
    liq = await engine.get_account_liquidity(account)
    resp = BankAccountResponse.model_validate(account)
    resp.committed_balance = liq.committed_balance
    resp.available_balance = liq.available_balance
    return resp


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Desactivação lógica — Regra 7: registos críticos nunca apagados fisicamente."""
    r = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    account = r.scalar_one_or_none()
    if not account or not account.is_active:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    require_owner(account.user_id, current_user)

    account.is_active = False
    await log_action(db, user_id=current_user.id, action=AuditAction.DELETE, entity_type="bank_account",
                     entity_id=str(account.id))
