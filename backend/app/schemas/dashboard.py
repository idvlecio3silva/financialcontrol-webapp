from pydantic import BaseModel
from decimal import Decimal
from datetime import date
import uuid


class AccountLiquidityOut(BaseModel):
    account_id: uuid.UUID
    account_name: str
    bank_name: str
    current_balance: Decimal
    committed_balance: Decimal
    available_balance: Decimal
    minimum_balance: Decimal
    has_sufficient_funds: bool


class DashboardOut(BaseModel):
    total_balance: Decimal
    total_committed: Decimal
    total_available: Decimal
    total_investable: Decimal
    monthly_income_expected: Decimal
    monthly_income_received: Decimal
    monthly_expenses_total: Decimal
    monthly_liabilities_total: Decimal
    can_invest: bool
    financial_risk: bool
    investment_capacity: Decimal
    investment_block_reason: str
    savings_rate: Decimal
    debt_ratio: Decimal
    liability_coverage_pct: Decimal
    overdue_liabilities: int
    overdue_expenses: int
    accounts_at_risk: int
    net_worth: Decimal
    total_debt: Decimal
    total_investments_value: Decimal
    accounts: list[AccountLiquidityOut]


class CashFlowDayOut(BaseModel):
    date: date
    account_name: str
    inflows: Decimal
    outflows: Decimal
    net: Decimal
    running_balance: Decimal
    free_balance: Decimal
    is_critical: bool
    events: list[str]


class InvestmentValidationOut(BaseModel):
    allowed: bool
    reason: str
    investment_capacity: Decimal
