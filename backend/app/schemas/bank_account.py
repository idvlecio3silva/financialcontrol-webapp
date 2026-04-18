from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.bank_account import AccountType
import uuid


class BankAccountCreate(BaseModel):
    name: str
    bank_name: str
    account_type: AccountType
    current_balance: Decimal
    minimum_balance: Decimal = Decimal("0")
    notes: str | None = None

    @field_validator("current_balance", "minimum_balance")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < Decimal("-999999999"):
            raise ValueError("Valor fora do intervalo permitido")
        return v


class BankAccountUpdate(BaseModel):
    name: str | None = None
    bank_name: str | None = None
    account_type: AccountType | None = None
    current_balance: Decimal | None = None
    minimum_balance: Decimal | None = None
    notes: str | None = None
    last_reconciliation_date: date | None = None


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    bank_name: str
    account_type: AccountType
    current_balance: Decimal
    minimum_balance: Decimal
    committed_balance: Decimal = Decimal("0")
    available_balance: Decimal = Decimal("0")
    is_active: bool
    last_reconciliation_date: date | None
    notes: str | None

    class Config:
        from_attributes = True
