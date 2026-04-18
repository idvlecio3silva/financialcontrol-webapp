from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.savings_goal import SavingsStatus
import uuid


class SavingsGoalCreate(BaseModel):
    bank_account_id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    target_date: date | None = None
    notes: str | None = None

    @field_validator("target_amount")
    @classmethod
    def validate_target(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("Meta deve ser positiva")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()[:200]


class SavingsGoalUpdate(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    target_date: date | None = None
    status: SavingsStatus | None = None
    notes: str | None = None


class SavingsGoalResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    progress_pct: Decimal = Decimal("0")
    target_date: date | None
    status: SavingsStatus
    notes: str | None

    class Config:
        from_attributes = True
