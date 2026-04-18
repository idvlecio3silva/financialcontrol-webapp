from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from typing import Optional
from app.models.expense import ExpenseType, ExpensePriority, ExpenseStatus
import uuid


class ExpenseCreate(BaseModel):
    bank_account_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    date: date
    description: str
    subcategory: Optional[str] = None
    expense_type: ExpenseType
    priority: ExpensePriority
    amount: Decimal
    due_date: Optional[date] = None
    notes: Optional[str] = None

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
    bank_account_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    date: Optional[date] = None
    description: Optional[str] = None
    subcategory: Optional[str] = None
    expense_type: Optional[ExpenseType] = None
    priority: Optional[ExpensePriority] = None
    amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    payment_date: Optional[date] = None
    status: Optional[ExpenseStatus] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    date: date
    description: str
    subcategory: Optional[str]
    expense_type: ExpenseType
    priority: ExpensePriority
    amount: Decimal
    due_date: Optional[date]
    payment_date: Optional[date]
    status: ExpenseStatus
    notes: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True
