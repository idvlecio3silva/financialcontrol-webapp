import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, ForeignKey, func, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class AccountType(str, enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    SALARY = "salary"


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(SAEnum(AccountType), nullable=False, default=AccountType.CHECKING)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    minimum_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=Decimal("0.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_reconciliation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="bank_accounts")
    incomes: Mapped[list["Income"]] = relationship(back_populates="bank_account", lazy="select")
    expenses: Mapped[list["Expense"]] = relationship(back_populates="bank_account", lazy="select")
    liabilities: Mapped[list["Liability"]] = relationship(back_populates="bank_account", lazy="select")
    investments: Mapped[list["Investment"]] = relationship(back_populates="bank_account", lazy="select")
    debts: Mapped[list["Debt"]] = relationship(back_populates="bank_account", lazy="select")
    savings_goals: Mapped[list["SavingsGoal"]] = relationship(back_populates="bank_account", lazy="select")
