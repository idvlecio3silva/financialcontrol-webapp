from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.liability import LiabilityFrequency, LiabilityPriority, LiabilityStatus
import uuid


class LiabilityCreate(BaseModel):
    bank_account_id: uuid.UUID
    name: str
    amount: Decimal
    frequency: LiabilityFrequency
    due_day: int
    next_due_date: date | None = None
    priority: LiabilityPriority
    is_mandatory: bool = True
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("Valor deve ser positivo")
        return v

    @field_validator("due_day")
    @classmethod
    def validate_due_day(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("Dia de vencimento deve estar entre 1 e 31")
        return v


class LiabilityUpdate(BaseModel):
    bank_account_id: uuid.UUID | None = None
    name: str | None = None
    amount: Decimal | None = None
    frequency: LiabilityFrequency | None = None
    due_day: int | None = None
    next_due_date: date | None = None
    priority: LiabilityPriority | None = None
    status: LiabilityStatus | None = None
    is_mandatory: bool | None = None
    notes: str | None = None


class LiabilityResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    name: str
    amount: Decimal
    frequency: LiabilityFrequency
    due_day: int
    next_due_date: date | None
    priority: LiabilityPriority
    status: LiabilityStatus
    is_mandatory: bool
    notes: str | None
    is_active: bool

    class Config:
        from_attributes = True
