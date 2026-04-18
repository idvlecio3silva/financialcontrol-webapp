"""
Motor financeiro central.
Implementa todas as Regras 1-8 definidas nos requisitos.
Toda a lógica crítica reside aqui, no backend.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal
from datetime import date, timedelta
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func as sqlfunc
from app.models.bank_account import BankAccount
from app.models.expense import Expense, ExpenseStatus, ExpensePriority
from app.models.income import Income, IncomeStatus
from app.models.liability import Liability, LiabilityStatus, LiabilityPriority
from app.models.investment import Investment, InvestmentStatus
from app.models.debt import Debt, DebtStatus
from app.models.financial_settings import FinancialSettings
from app.models.savings_goal import SavingsGoal


@dataclass
class AccountLiquidity:
    account_id: uuid.UUID
    account_name: str
    bank_name: str
    current_balance: Decimal
    committed_balance: Decimal
    available_balance: Decimal
    minimum_balance: Decimal
    has_sufficient_funds: bool


@dataclass
class DashboardIndicators:
    # Balances
    total_balance: Decimal = Decimal("0")
    total_committed: Decimal = Decimal("0")
    total_available: Decimal = Decimal("0")
    total_investable: Decimal = Decimal("0")

    # Monthly
    monthly_income_expected: Decimal = Decimal("0")
    monthly_income_received: Decimal = Decimal("0")
    monthly_expenses_total: Decimal = Decimal("0")
    monthly_expenses_paid: Decimal = Decimal("0")
    monthly_liabilities_total: Decimal = Decimal("0")
    monthly_liabilities_covered: Decimal = Decimal("0")

    # Decision indicators (Regras 5 e 6)
    can_invest: bool = False
    financial_risk: bool = False
    investment_capacity: Decimal = Decimal("0")
    investment_block_reason: str = ""

    # Rates
    savings_rate: Decimal = Decimal("0")
    investment_rate: Decimal = Decimal("0")
    debt_ratio: Decimal = Decimal("0")
    liability_coverage_pct: Decimal = Decimal("0")
    budget_execution_pct: Decimal = Decimal("0")

    # Risk flags
    overdue_liabilities: int = 0
    overdue_expenses: int = 0
    accounts_at_risk: int = 0

    # Net worth
    net_worth: Decimal = Decimal("0")
    total_debt: Decimal = Decimal("0")
    total_investments_value: Decimal = Decimal("0")

    # Per-account liquidity
    accounts: list[AccountLiquidity] = field(default_factory=list)


@dataclass
class CashFlowDay:
    date: date
    account_id: uuid.UUID | None
    account_name: str
    inflows: Decimal
    outflows: Decimal
    net: Decimal
    running_balance: Decimal
    free_balance: Decimal
    is_critical: bool
    events: list[str] = field(default_factory=list)


class FinancialEngine:
    """
    Motor central de regras financeiras.
    NUNCA confiar em cálculos do frontend — toda validação ocorre aqui.
    """

    def __init__(self, db: AsyncSession, user_id: uuid.UUID):
        self.db = db
        self.user_id = user_id

    async def _get_settings(self) -> FinancialSettings | None:
        r = await self.db.execute(
            select(FinancialSettings).where(FinancialSettings.user_id == self.user_id)
        )
        return r.scalar_one_or_none()

    async def _get_accounts(self) -> list[BankAccount]:
        r = await self.db.execute(
            select(BankAccount).where(
                BankAccount.user_id == self.user_id,
                BankAccount.is_active == True
            )
        )
        return list(r.scalars().all())

    async def get_committed_balance(self, account_id: uuid.UUID, reference_date: date | None = None) -> Decimal:
        """
        Regra 1 & 2: Saldo comprometido = soma de responsabilidades activas +
        despesas pendentes não pagas da conta.
        """
        ref = reference_date or date.today()

        # Pending expenses (unpaid, not cancelled)
        exp_q = select(sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0)).where(
            Expense.user_id == self.user_id,
            Expense.bank_account_id == account_id,
            Expense.is_active == True,
            Expense.status.in_([ExpenseStatus.PENDING, ExpenseStatus.OVERDUE]),
        )
        exp_result = await self.db.execute(exp_q)
        exp_total = Decimal(str(exp_result.scalar() or 0))

        # Active liabilities (monthly obligations)
        liab_q = select(sqlfunc.coalesce(sqlfunc.sum(Liability.amount), 0)).where(
            Liability.user_id == self.user_id,
            Liability.bank_account_id == account_id,
            Liability.is_active == True,
            Liability.status.in_([LiabilityStatus.ACTIVE, LiabilityStatus.OVERDUE]),
        )
        liab_result = await self.db.execute(liab_q)
        liab_total = Decimal(str(liab_result.scalar() or 0))

        return exp_total + liab_total

    async def get_account_liquidity(self, account: BankAccount) -> AccountLiquidity:
        """Regra 3: Liquidez por conta — base de toda validação de pagamento."""
        committed = await self.get_committed_balance(account.id)
        available = max(Decimal("0"), account.current_balance - committed - account.minimum_balance)
        return AccountLiquidity(
            account_id=account.id,
            account_name=account.name,
            bank_name=account.bank_name,
            current_balance=account.current_balance,
            committed_balance=committed,
            available_balance=available,
            minimum_balance=account.minimum_balance,
            has_sufficient_funds=available > Decimal("0"),
        )

    async def validate_expense_liquidity(self, account_id: uuid.UUID, amount: Decimal) -> tuple[bool, str]:
        """Regra 3: Valida se conta tem saldo disponível para a despesa."""
        r = await self.db.execute(select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.user_id == self.user_id,
        ))
        account = r.scalar_one_or_none()
        if not account:
            return False, "Conta bancária não encontrada"

        liquidity = await self.get_account_liquidity(account)
        if amount > liquidity.available_balance:
            return False, (
                f"Saldo disponível insuficiente na conta {account.name}. "
                f"Disponível: {liquidity.available_balance:.2f}, Necessário: {amount:.2f}"
            )
        return True, ""

    async def validate_investment(self, account_id: uuid.UUID, amount: Decimal) -> tuple[bool, str]:
        """Regra 6: Validação completa antes de criar investimento."""
        today = date.today()
        settings = await self._get_settings()
        safety_months = settings.investment_safety_months if settings else 3

        # Check critical overdue liabilities (Regra 1)
        overdue_q = await self.db.execute(
            select(sqlfunc.count(Liability.id)).where(
                Liability.user_id == self.user_id,
                Liability.priority == LiabilityPriority.CRITICAL,
                Liability.status == LiabilityStatus.OVERDUE,
                Liability.is_active == True,
            )
        )
        overdue_critical = overdue_q.scalar() or 0
        if overdue_critical > 0:
            return False, f"Existem {overdue_critical} responsabilidade(s) crítica(s) em atraso. Regularize antes de investir."

        # Check account liquidity (Regra 3)
        ok, msg = await self.validate_expense_liquidity(account_id, amount)
        if not ok:
            return False, msg

        # Check investment capacity (Regra 6)
        capacity = await self.calculate_investment_capacity()
        if amount > capacity:
            return False, f"Valor de investimento ({amount:.2f}) excede a capacidade real ({capacity:.2f})."

        # Check cashflow projection for rupture (Regra 4 & 6)
        end_date = today + timedelta(days=safety_months * 30)
        cashflow = await self.project_cashflow(today, end_date)
        for day in cashflow:
            if day.free_balance < Decimal("0"):
                return False, f"Projecção de fluxo de caixa indica ruptura de liquidez em {day.date}. Investimento bloqueado."

        return True, ""

    async def calculate_investment_capacity(self) -> Decimal:
        """Regra 8.3: Capacidade de investimento real."""
        settings = await self._get_settings()
        min_liquidity_ratio = (settings.minimum_liquidity_ratio / 100) if settings else Decimal("0.20")
        safety_months = settings.investment_safety_months if settings else 3

        accounts = await self._get_accounts()
        total_available = Decimal("0")
        for acc in accounts:
            liq = await self.get_account_liquidity(acc)
            total_available += liq.available_balance

        # Reserve: monthly obligations × safety months
        monthly_obligations = await self._get_monthly_obligations()
        safety_reserve = monthly_obligations * safety_months

        # Minimum liquidity reserve
        total_balance = sum(a.current_balance for a in accounts)
        liquidity_reserve = total_balance * min_liquidity_ratio

        capacity = total_available - safety_reserve - liquidity_reserve
        return max(Decimal("0"), capacity)

    async def _get_monthly_obligations(self) -> Decimal:
        r = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Liability.amount), 0)).where(
                Liability.user_id == self.user_id,
                Liability.is_active == True,
                Liability.status.in_([LiabilityStatus.ACTIVE, LiabilityStatus.OVERDUE]),
            )
        )
        liabilities = Decimal(str(r.scalar() or 0))

        r2 = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Debt.monthly_payment), 0)).where(
                Debt.user_id == self.user_id,
                Debt.is_active == True,
                Debt.status == DebtStatus.ACTIVE,
            )
        )
        debt_payments = Decimal(str(r2.scalar() or 0))
        return liabilities + debt_payments

    async def assess_financial_risk(self) -> tuple[bool, list[str]]:
        """Regra 5 & 8.5: Avaliação de risco financeiro."""
        risks: list[str] = []
        settings = await self._get_settings()
        max_debt_ratio = (settings.max_debt_ratio / 100) if settings else Decimal("0.35")

        accounts = await self._get_accounts()

        # Negative or at-risk accounts
        for acc in accounts:
            if acc.current_balance < Decimal("0"):
                risks.append(f"Conta {acc.name} ({acc.bank_name}) com saldo negativo: {acc.current_balance:.2f}")
            liq = await self.get_account_liquidity(acc)
            if not liq.has_sufficient_funds and acc.current_balance > Decimal("0"):
                risks.append(f"Conta {acc.name} sem liquidez disponível após compromissos")

        # Critical overdue liabilities
        r = await self.db.execute(
            select(sqlfunc.count(Liability.id)).where(
                Liability.user_id == self.user_id,
                Liability.priority == LiabilityPriority.CRITICAL,
                Liability.status == LiabilityStatus.OVERDUE,
                Liability.is_active == True,
            )
        )
        overdue_critical = r.scalar() or 0
        if overdue_critical > 0:
            risks.append(f"{overdue_critical} responsabilidade(s) crítica(s) em atraso")

        # Debt ratio check
        monthly_income = await self._get_monthly_income_expected()
        monthly_obligations = await self._get_monthly_obligations()
        if monthly_income > Decimal("0"):
            debt_ratio = monthly_obligations / monthly_income
            if debt_ratio > max_debt_ratio:
                risks.append(f"Taxa de endividamento {debt_ratio*100:.1f}% acima do limite {max_debt_ratio*100:.1f}%")

        return len(risks) > 0, risks

    async def _get_monthly_income_expected(self) -> Decimal:
        today = date.today()
        r = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Income.expected_amount), 0)).where(
                Income.user_id == self.user_id,
                Income.is_active == True,
                Income.date >= date(today.year, today.month, 1),
                Income.date <= date(today.year, today.month, 28) + timedelta(days=4),
            )
        )
        return Decimal(str(r.scalar() or 0))

    async def project_cashflow(self, start: date, end: date) -> list[CashFlowDay]:
        """Regra 4 & 7: Projecção de fluxo de caixa."""
        accounts = await self._get_accounts()
        if not accounts:
            return []

        # Get initial balances per account
        account_balances = {acc.id: acc.current_balance for acc in accounts}
        account_names = {acc.id: f"{acc.name} ({acc.bank_name})" for acc in accounts}
        account_minimums = {acc.id: acc.minimum_balance for acc in accounts}

        # Load upcoming incomes
        income_r = await self.db.execute(
            select(Income).where(
                Income.user_id == self.user_id,
                Income.is_active == True,
                Income.date.between(start, end),
                Income.status.in_([IncomeStatus.EXPECTED]),
            )
        )
        upcoming_incomes = income_r.scalars().all()

        # Load upcoming expenses
        expense_r = await self.db.execute(
            select(Expense).where(
                Expense.user_id == self.user_id,
                Expense.is_active == True,
                or_(
                    and_(Expense.due_date.between(start, end)),
                    and_(Expense.date.between(start, end), Expense.due_date == None),
                ),
                Expense.status.in_([ExpenseStatus.PENDING, ExpenseStatus.OVERDUE]),
            )
        )
        upcoming_expenses = expense_r.scalars().all()

        # Load upcoming liabilities
        liab_r = await self.db.execute(
            select(Liability).where(
                Liability.user_id == self.user_id,
                Liability.is_active == True,
                Liability.next_due_date.between(start, end),
                Liability.status.in_([LiabilityStatus.ACTIVE, LiabilityStatus.OVERDUE]),
            )
        )
        upcoming_liabilities = liab_r.scalars().all()

        # Build daily cashflow — consolidated across all accounts
        days: list[CashFlowDay] = []
        current_date = start
        running_balance = sum(account_balances.values())
        min_balance_sum = sum(account_minimums.values())

        while current_date <= end:
            inflows = Decimal("0")
            outflows = Decimal("0")
            events: list[str] = []

            for inc in upcoming_incomes:
                if inc.date == current_date:
                    inflows += inc.expected_amount
                    events.append(f"Receita: {inc.source} (+{inc.expected_amount:.2f})")

            for exp in upcoming_expenses:
                exp_date = exp.due_date or exp.date
                if exp_date == current_date:
                    outflows += exp.amount
                    events.append(f"Despesa: {exp.description} (-{exp.amount:.2f})")

            for liab in upcoming_liabilities:
                if liab.next_due_date == current_date:
                    outflows += liab.amount
                    priority_label = " [CRÍTICO]" if liab.priority == LiabilityPriority.CRITICAL else ""
                    events.append(f"Obrigação{priority_label}: {liab.name} (-{liab.amount:.2f})")

            net = inflows - outflows
            running_balance += net
            free_balance = running_balance - min_balance_sum
            is_critical = free_balance < Decimal("0") or outflows > inflows + running_balance

            days.append(CashFlowDay(
                date=current_date,
                account_id=None,
                account_name="Consolidado",
                inflows=inflows,
                outflows=outflows,
                net=net,
                running_balance=running_balance,
                free_balance=free_balance,
                is_critical=is_critical,
                events=events,
            ))
            current_date += timedelta(days=1)

        return days

    async def get_dashboard_indicators(self) -> DashboardIndicators:
        """Agrega todos os indicadores para o dashboard executivo."""
        today = date.today()
        indicators = DashboardIndicators()

        # Account liquidities
        accounts = await self._get_accounts()
        for acc in accounts:
            liq = await self.get_account_liquidity(acc)
            indicators.accounts.append(liq)
            indicators.total_balance += liq.current_balance
            indicators.total_committed += liq.committed_balance
            indicators.total_available += liq.available_balance
            if not liq.has_sufficient_funds:
                indicators.accounts_at_risk += 1

        # Monthly income
        month_start = date(today.year, today.month, 1)
        month_end = date(today.year, today.month, 28) + timedelta(days=4)

        r = await self.db.execute(
            select(
                sqlfunc.coalesce(sqlfunc.sum(Income.expected_amount), 0),
                sqlfunc.coalesce(sqlfunc.sum(Income.received_amount), 0),
            ).where(
                Income.user_id == self.user_id,
                Income.is_active == True,
                Income.date >= month_start,
                Income.date <= month_end,
            )
        )
        row = r.one()
        indicators.monthly_income_expected = Decimal(str(row[0]))
        indicators.monthly_income_received = Decimal(str(row[1]))

        # Monthly expenses
        r2 = await self.db.execute(
            select(
                sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0),
            ).where(
                Expense.user_id == self.user_id,
                Expense.is_active == True,
                Expense.date >= month_start,
                Expense.date <= month_end,
            )
        )
        indicators.monthly_expenses_total = Decimal(str(r2.scalar() or 0))

        # Liabilities
        r3 = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Liability.amount), 0)).where(
                Liability.user_id == self.user_id,
                Liability.is_active == True,
                Liability.status.in_([LiabilityStatus.ACTIVE, LiabilityStatus.OVERDUE]),
            )
        )
        indicators.monthly_liabilities_total = Decimal(str(r3.scalar() or 0))

        # Overdue liabilities
        r4 = await self.db.execute(
            select(sqlfunc.count(Liability.id)).where(
                Liability.user_id == self.user_id,
                Liability.is_active == True,
                Liability.status == LiabilityStatus.OVERDUE,
            )
        )
        indicators.overdue_liabilities = r4.scalar() or 0

        # Overdue expenses
        r5 = await self.db.execute(
            select(sqlfunc.count(Expense.id)).where(
                Expense.user_id == self.user_id,
                Expense.is_active == True,
                Expense.status == ExpenseStatus.OVERDUE,
            )
        )
        indicators.overdue_expenses = r5.scalar() or 0

        # Total investments value
        r6 = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Investment.current_value), 0)).where(
                Investment.user_id == self.user_id,
                Investment.is_active == True,
                Investment.status == InvestmentStatus.ACTIVE,
            )
        )
        indicators.total_investments_value = Decimal(str(r6.scalar() or 0))

        # Total debts
        r7 = await self.db.execute(
            select(sqlfunc.coalesce(sqlfunc.sum(Debt.current_balance), 0)).where(
                Debt.user_id == self.user_id,
                Debt.is_active == True,
                Debt.status == DebtStatus.ACTIVE,
            )
        )
        indicators.total_debt = Decimal(str(r7.scalar() or 0))

        # Net worth
        indicators.net_worth = indicators.total_balance + indicators.total_investments_value - indicators.total_debt

        # Rates
        if indicators.monthly_income_received > 0:
            indicators.savings_rate = (
                (indicators.monthly_income_received - indicators.monthly_expenses_total)
                / indicators.monthly_income_received * 100
            )

        if indicators.monthly_income_expected > 0:
            monthly_obligations = await self._get_monthly_obligations()
            indicators.debt_ratio = monthly_obligations / indicators.monthly_income_expected * 100
            indicators.liability_coverage_pct = min(
                Decimal("100"),
                (indicators.monthly_income_expected / indicators.monthly_liabilities_total * 100)
                if indicators.monthly_liabilities_total > 0 else Decimal("100")
            )

        # Investment capacity and decision indicators
        indicators.investment_capacity = await self.calculate_investment_capacity()
        has_risk, risk_reasons = await self.assess_financial_risk()
        indicators.financial_risk = has_risk

        # Can invest (Regra 5 & 6)
        if (
            indicators.overdue_liabilities == 0
            and indicators.total_available > Decimal("0")
            and indicators.investment_capacity > Decimal("0")
            and not has_risk
        ):
            indicators.can_invest = True
        else:
            reasons = []
            if indicators.overdue_liabilities > 0:
                reasons.append(f"{indicators.overdue_liabilities} obrigação(ões) em atraso")
            if indicators.total_available <= Decimal("0"):
                reasons.append("Sem saldo disponível")
            if indicators.investment_capacity <= Decimal("0"):
                reasons.append("Capacidade de investimento nula")
            if has_risk:
                reasons.extend(risk_reasons)
            indicators.investment_block_reason = "; ".join(reasons)

        return indicators
