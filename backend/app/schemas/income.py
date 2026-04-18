from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.income import IncomeType, IncomeStatus
import uuid


class IncomeCreate(BaseModel):
    bank_account_id: uuid.UUID
    date: date
    source: str
    income_type: IncomeType
    expected_amount: Decimal
    received_amount: Decimal = Decimal("0")
    status: IncomeStatus = IncomeStatus.EXPECTED
    notes: str | None = None

    @field_validator("expected_amount", "received_amount")
    @classmethod
    def validate_positive(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("Valor deve ser positivo")
        return v

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        return v.strip()[:200]


class IncomeUpdate(BaseModel):
    bank_account_id: uuid.UUID | None = None
    date: date | None = None
    source: str | None = None
    income_type: IncomeType | None = None
    expected_amount: Decimal | None = None
    received_amount: Decimal | None = None
    status: IncomeStatus | None = None
    notes: str | None = None


class IncomeResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    date: date
    source: str
    income_type: IncomeType
    expected_amount: Decimal
    received_amount: Decimal
    status: IncomeStatus
    notes: str | None
    is_active: bool

    class Config:
        from_attributes = True
