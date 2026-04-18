from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.user import User
from app.models.savings_goal import SavingsGoal
from app.schemas.savings_goal import SavingsGoalCreate, SavingsGoalUpdate, SavingsGoalResponse
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from decimal import Decimal
import uuid

router = APIRouter(prefix="/savings", tags=["Poupança"])


@router.get("", response_model=list[SavingsGoalResponse])
async def list_savings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(SavingsGoal).where(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.target_date)
    )
    goals = r.scalars().all()
    results = []
    for g in goals:
        resp = SavingsGoalResponse.model_validate(g)
        if g.target_amount > Decimal("0"):
            resp.progress_pct = (g.current_amount / g.target_amount * 100).quantize(Decimal("0.01"))
        results.append(resp)
    return results


@router.post("", response_model=SavingsGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_savings_goal(
    payload: SavingsGoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = SavingsGoal(user_id=current_user.id, **payload.model_dump())
    db.add(goal)
    await db.flush()
    await log_action(db, user_id=current_user.id, action=AuditAction.CREATE,
                     entity_type="savings_goal", entity_id=str(goal.id),
                     new_values=payload.model_dump(mode="json"))
    resp = SavingsGoalResponse.model_validate(goal)
    resp.progress_pct = Decimal("0")
    return resp


@router.get("/{goal_id}", response_model=SavingsGoalResponse)
async def get_savings_goal(goal_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id))
    goal = r.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Objectivo de poupança não encontrado")
    require_owner(goal.user_id, current_user)
    resp = SavingsGoalResponse.model_validate(goal)
    if goal.target_amount > Decimal("0"):
        resp.progress_pct = (goal.current_amount / goal.target_amount * 100).quantize(Decimal("0.01"))
    return resp


@router.patch("/{goal_id}", response_model=SavingsGoalResponse)
async def update_savings_goal(
    goal_id: uuid.UUID,
    payload: SavingsGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id))
    goal = r.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Objectivo de poupança não encontrado")
    require_owner(goal.user_id, current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await log_action(db, user_id=current_user.id, action=AuditAction.UPDATE,
                     entity_type="savings_goal", entity_id=str(goal.id),
                     new_values=payload.model_dump(exclude_unset=True, mode="json"))
    resp = SavingsGoalResponse.model_validate(goal)
    if goal.target_amount > Decimal("0"):
        resp.progress_pct = (goal.current_amount / goal.target_amount * 100).quantize(Decimal("0.01"))
    return resp


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_savings_goal(goal_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id))
    goal = r.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Objectivo de poupança não encontrado")
    require_owner(goal.user_id, current_user)
    await db.delete(goal)
    await log_action(db, user_id=current_user.id, action=AuditAction.DELETE,
                     entity_type="savings_goal", entity_id=str(goal.id))
