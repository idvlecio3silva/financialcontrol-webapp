from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.investment import InvestmentType, InvestmentStatus
import uuid


class InvestmentCreate(BaseModel):
    bank_account_id: uuid.UUID
    date: date
    asset_name: str
    investment_type: InvestmentType
    invested_amount: Decimal
    current_value: Decimal | None = None
    notes: str | None = None

    @field_validator("invested_amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("Valor investido deve ser positivo")
        return v

    @field_validator("asset_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome do activo obrigatório")
        return v[:200]


class InvestmentUpdate(BaseModel):
    asset_name: str | None = None
    investment_type: InvestmentType | None = None
    current_value: Decimal | None = None
    status: InvestmentStatus | None = None
    notes: str | None = None


class InvestmentResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    date: date
    asset_name: str
    investment_type: InvestmentType
    invested_amount: Decimal
    current_value: Decimal
    return_pct: Decimal = Decimal("0")
    status: InvestmentStatus
    notes: str | None
    is_active: bool

    class Config:
        from_attributes = True
