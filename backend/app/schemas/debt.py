from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.debt import DebtStatus, DebtRisk
import uuid


class DebtCreate(BaseModel):
    bank_account_id: uuid.UUID
    creditor: str
    original_amount: Decimal
    current_balance: Decimal
    monthly_payment: Decimal
    interest_rate: Decimal = Decimal("0")
    next_due_date: date | None = None
    risk_level: DebtRisk = DebtRisk.MEDIUM
    notes: str | None = None

    @field_validator("monthly_payment", "current_balance", "original_amount")
    @classmethod
    def validate_positive(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("Valor não pode ser negativo")
        return v

    @field_validator("creditor")
    @classmethod
    def validate_creditor(cls, v: str) -> str:
        return v.strip()[:200]


class DebtUpdate(BaseModel):
    creditor: str | None = None
    current_balance: Decimal | None = None
    monthly_payment: Decimal | None = None
    interest_rate: Decimal | None = None
    next_due_date: date | None = None
    status: DebtStatus | None = None
    risk_level: DebtRisk | None = None
    notes: str | None = None


class DebtResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    creditor: str
    original_amount: Decimal
    current_balance: Decimal
    monthly_payment: Decimal
    interest_rate: Decimal
    next_due_date: date | None
    status: DebtStatus
    risk_level: DebtRisk
    notes: str | None
    is_active: bool

    class Config:
        from_attributes = True
