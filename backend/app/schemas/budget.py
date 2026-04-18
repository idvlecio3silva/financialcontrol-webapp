from pydantic import BaseModel, field_validator
from decimal import Decimal
import uuid


class BudgetCreate(BaseModel):
    month: int
    year: int
    expected_income: Decimal = Decimal("0")
    expected_expenses: Decimal = Decimal("0")
    planned_savings: Decimal = Decimal("0")
    planned_investment: Decimal = Decimal("0")
    notes: str | None = None

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("Mês deve estar entre 1 e 12")
        return v

    @field_validator("year")
    @classmethod
    def validate_year(cls, v: int) -> int:
        if not 2000 <= v <= 2100:
            raise ValueError("Ano inválido")
        return v


class BudgetUpdate(BaseModel):
    expected_income: Decimal | None = None
    actual_income: Decimal | None = None
    expected_expenses: Decimal | None = None
    actual_expenses: Decimal | None = None
    planned_savings: Decimal | None = None
    actual_savings: Decimal | None = None
    planned_investment: Decimal | None = None
    actual_investment: Decimal | None = None
    notes: str | None = None


class BudgetResponse(BaseModel):
    id: uuid.UUID
    month: int
    year: int
    expected_income: Decimal
    actual_income: Decimal
    expected_expenses: Decimal
    actual_expenses: Decimal
    planned_savings: Decimal
    actual_savings: Decimal
    planned_investment: Decimal
    actual_investment: Decimal
    income_deviation: Decimal = Decimal("0")
    expense_deviation: Decimal = Decimal("0")
    notes: str | None

    class Config:
        from_attributes = True
