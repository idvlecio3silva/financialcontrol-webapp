// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  full_name: string;
  email: string;
}

// ─── Bank Accounts ───────────────────────────────────────────────────────────
export type AccountType = "checking" | "savings" | "investment" | "salary";

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_type: AccountType;
  current_balance: number;
  minimum_balance: number;
  committed_balance: number;
  available_balance: number;
  is_active: boolean;
  last_reconciliation_date: string | null;
  notes: string | null;
}

// ─── Income ──────────────────────────────────────────────────────────────────
export type IncomeType = "fixed" | "variable" | "passive";
export type IncomeStatus = "expected" | "received" | "partial" | "cancelled";

export interface Income {
  id: string;
  bank_account_id: string;
  date: string;
  source: string;
  income_type: IncomeType;
  expected_amount: number;
  received_amount: number;
  status: IncomeStatus;
  notes: string | null;
  is_active: boolean;
}

// ─── Expense ─────────────────────────────────────────────────────────────────
export type ExpenseType = "fixed" | "variable" | "debt" | "investment";
export type ExpensePriority = "critical" | "important" | "optional";
export type ExpenseStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface Expense {
  id: string;
  bank_account_id: string;
  category_id: string | null;
  date: string;
  description: string;
  subcategory: string | null;
  expense_type: ExpenseType;
  priority: ExpensePriority;
  amount: number;
  due_date: string | null;
  payment_date: string | null;
  status: ExpenseStatus;
  notes: string | null;
  is_active: boolean;
}

// ─── Liability ───────────────────────────────────────────────────────────────
export type LiabilityFrequency = "monthly" | "quarterly" | "annual" | "one_time";
export type LiabilityPriority = "critical" | "important" | "optional";
export type LiabilityStatus = "active" | "paid" | "overdue" | "suspended";

export interface Liability {
  id: string;
  bank_account_id: string;
  name: string;
  amount: number;
  frequency: LiabilityFrequency;
  due_day: number;
  next_due_date: string | null;
  priority: LiabilityPriority;
  status: LiabilityStatus;
  is_mandatory: boolean;
  notes: string | null;
  is_active: boolean;
}

// ─── Budget ──────────────────────────────────────────────────────────────────
export interface Budget {
  id: string;
  month: number;
  year: number;
  expected_income: number;
  actual_income: number;
  expected_expenses: number;
  actual_expenses: number;
  planned_savings: number;
  actual_savings: number;
  planned_investment: number;
  actual_investment: number;
  income_deviation: number;
  expense_deviation: number;
  notes: string | null;
}

// ─── Investment ──────────────────────────────────────────────────────────────
export type InvestmentType = "stock" | "bond" | "fund" | "real_estate" | "crypto" | "fixed_income" | "other";
export type InvestmentStatus = "active" | "sold" | "cancelled";

export interface Investment {
  id: string;
  bank_account_id: string;
  date: string;
  asset_name: string;
  investment_type: InvestmentType;
  invested_amount: number;
  current_value: number;
  return_pct: number;
  status: InvestmentStatus;
  notes: string | null;
  is_active: boolean;
}

// ─── Debt ────────────────────────────────────────────────────────────────────
export type DebtStatus = "active" | "paid_off" | "defaulted" | "restructured";
export type DebtRisk = "low" | "medium" | "high" | "critical";

export interface Debt {
  id: string;
  bank_account_id: string;
  creditor: string;
  original_amount: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
  next_due_date: string | null;
  status: DebtStatus;
  risk_level: DebtRisk;
  notes: string | null;
  is_active: boolean;
}

// ─── Savings Goal ─────────────────────────────────────────────────────────────
export type SavingsStatus = "active" | "completed" | "paused" | "cancelled";

export interface SavingsGoal {
  id: string;
  bank_account_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  progress_pct: number;
  target_date: string | null;
  status: SavingsStatus;
  notes: string | null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface AccountLiquidity {
  account_id: string;
  account_name: string;
  bank_name: string;
  current_balance: number;
  committed_balance: number;
  available_balance: number;
  minimum_balance: number;
  has_sufficient_funds: boolean;
}

export interface DashboardData {
  total_balance: number;
  total_committed: number;
  total_available: number;
  total_investable: number;
  monthly_income_expected: number;
  monthly_income_received: number;
  monthly_expenses_total: number;
  monthly_liabilities_total: number;
  can_invest: boolean;
  financial_risk: boolean;
  investment_capacity: number;
  investment_block_reason: string;
  savings_rate: number;
  debt_ratio: number;
  liability_coverage_pct: number;
  overdue_liabilities: number;
  overdue_expenses: number;
  accounts_at_risk: number;
  net_worth: number;
  total_debt: number;
  total_investments_value: number;
  accounts: AccountLiquidity[];
}

// ─── Cashflow ─────────────────────────────────────────────────────────────────
export interface CashFlowDay {
  date: string;
  account_name: string;
  inflows: number;
  outflows: number;
  net: number;
  running_balance: number;
  free_balance: number;
  is_critical: boolean;
  events: string[];
}

// ─── Investment Validation ────────────────────────────────────────────────────
export interface InvestmentValidation {
  allowed: boolean;
  reason: string;
  investment_capacity: number;
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface CategorySummary {
  category_name: string;
  total: number;
  pct: number;
}

export interface NetWorthPoint {
  month: number;
  year: number;
  balance: number;
  investments: number;
  debts: number;
  net_worth: number;
}
