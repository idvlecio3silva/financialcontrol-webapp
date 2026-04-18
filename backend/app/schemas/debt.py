from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from typing import Optional
from app.models.debt import DebtStatus, DebtRisk
import uuid


class DebtCreate(BaseModel):
    bank_account_id: uuid.UUID
    creditor: str
    original_amount: Decimal
    current_balance: Decimal
    monthly_payment: Decimal
    interest_rate: Decimal = Decimal("0")
    next_due_date: Optional[date] = None
    risk_level: DebtRisk = DebtRisk.MEDIUM
    notes: Optional[str] = None

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
    creditor: Optional[str] = None
    current_balance: Optional[Decimal] = None
    monthly_payment: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    next_due_date: Optional[date] = None
    status: Optional[DebtStatus] = None
    risk_level: Optional[DebtRisk] = None
    notes: Optional[str] = None


class DebtResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    creditor: str
    original_amount: Decimal
    current_balance: Decimal
    monthly_payment: Decimal
    interest_rate: Decimal
    next_due_date: Optional[date]
    status: DebtStatus
    risk_level: DebtRisk
    notes: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True
