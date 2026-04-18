import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Integer, ForeignKey, func, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class LiabilityFrequency(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    ONE_TIME = "one_time"


class LiabilityPriority(str, enum.Enum):
    CRITICAL = "critical"
    IMPORTANT = "important"
    OPTIONAL = "optional"


class LiabilityStatus(str, enum.Enum):
    ACTIVE = "active"
    PAID = "paid"
    OVERDUE = "overdue"
    SUSPENDED = "suspended"


class Liability(Base):
    __tablename__ = "liabilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    bank_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    frequency: Mapped[LiabilityFrequency] = mapped_column(SAEnum(LiabilityFrequency), nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    priority: Mapped[LiabilityPriority] = mapped_column(SAEnum(LiabilityPriority), nullable=False)
    status: Mapped[LiabilityStatus] = mapped_column(SAEnum(LiabilityStatus), nullable=False, default=LiabilityStatus.ACTIVE)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bank_account: Mapped["BankAccount"] = relationship(back_populates="liabilities")
