from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.expense import ExpenseType, ExpensePriority, ExpenseStatus
import uuid


class ExpenseCreate(BaseModel):
    bank_account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    date: date
    description: str
    subcategory: str | None = None
    expense_type: ExpenseType
    priority: ExpensePriority
    amount: Decimal
    due_date: date | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("Valor deve ser positivo")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Descrição obrigatória")
        return v[:300]


class ExpenseUpdate(BaseModel):
    bank_account_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    date: date | None = None
    description: str | None = None
    subcategory: str | None = None
    expense_type: ExpenseType | None = None
    priority: ExpensePriority | None = None
    amount: Decimal | None = None
    due_date: date | None = None
    payment_date: date | None = None
    status: ExpenseStatus | None = None
    notes: str | None = None


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    category_id: uuid.UUID | None
    date: date
    description: str
    subcategory: str | None
    expense_type: ExpenseType
    priority: ExpensePriority
    amount: Decimal
    due_date: date | None
    payment_date: date | None
    status: ExpenseStatus
    notes: str | None
    is_active: bool

    class Config:
        from_attributes = True
