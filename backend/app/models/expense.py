import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, ForeignKey, func, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class ExpenseType(str, enum.Enum):
    FIXED = "fixed"
    VARIABLE = "variable"
    DEBT = "debt"
    INVESTMENT = "investment"


class ExpensePriority(str, enum.Enum):
    CRITICAL = "critical"
    IMPORTANT = "important"
    OPTIONAL = "optional"


class ExpenseStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    bank_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expense_type: Mapped[ExpenseType] = mapped_column(SAEnum(ExpenseType), nullable=False)
    priority: Mapped[ExpensePriority] = mapped_column(SAEnum(ExpensePriority), nullable=False, default=ExpensePriority.IMPORTANT)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ExpenseStatus] = mapped_column(SAEnum(ExpenseStatus), nullable=False, default=ExpenseStatus.PENDING)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bank_account: Mapped["BankAccount"] = relationship(back_populates="expenses")
    category: Mapped["Category | None"] = relationship(back_populates="expenses")
