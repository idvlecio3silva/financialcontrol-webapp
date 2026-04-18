"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatPct, cn } from "@/lib/utils";
import { BalancePieChart } from "@/components/charts/BalancePieChart";
import { IncomeExpensesBar } from "@/components/charts/IncomeExpensesBar";
import type { DashboardData } from "@/types";
import {
  TrendingUp, TrendingDown, Wallet, Lock, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Building2, ShieldAlert
} from "lucide-react";

function MetricCard({ title, value, subtitle, variant = "default", icon: Icon }: {
  title: string; value: string; subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger" | "neutral"; icon: React.ElementType;
}) {
  const colors = {
    default: "text-primary-700 bg-primary-50 border-primary-100",
    success: "text-success-700 bg-success-50 border-success-100",
    warning: "text-warning-700 bg-warning-50 border-warning-100",
    danger:  "text-danger-700 bg-danger-50 border-danger-100",
    neutral: "text-neutral-600 bg-neutral-50 border-neutral-100",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("p-2 rounded-lg border", colors[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function DecisionBadge({ label, yes, reason }: { label: string; yes: boolean; reason?: string }) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-xl border",
      yes ? "bg-success-50 border-success-200" : "bg-danger-50 border-danger-200"
    )}>
      {yes
        ? <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 shrink-0" />
        : <XCircle className="w-5 h-5 text-danger-600 mt-0.5 shrink-0" />
      }
      <div>
        <p className={cn("text-sm font-semibold", yes ? "text-success-800" : "text-danger-800")}>{label}</p>
        {reason && <p className="text-xs mt-0.5 text-neutral-600">{reason}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard").then((r) => r.data),
    refetchInterval: 60_000,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Dashboard Executivo</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Visão financeira em tempo real</p>
          </div>
          <button onClick={() => refetch()} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : !data ? null : (
          <>
            {/* Risk banner */}
            {data.financial_risk && (
              <div className="flex items-center gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-danger-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-danger-800">Risco financeiro detectado</p>
                  <p className="text-xs text-danger-600 mt-0.5">
                    {data.overdue_liabilities > 0 && `${data.overdue_liabilities} obrigação(ões) em atraso. `}
                    {data.accounts_at_risk > 0 && `${data.accounts_at_risk} conta(s) sem liquidez. `}
                  </p>
                </div>
              </div>
            )}

            {/* Main metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Saldo Total" value={formatCurrency(data.total_balance)} icon={Wallet} variant="default" />
              <MetricCard title="Comprometido" value={formatCurrency(data.total_committed)}
                subtitle="Obrigações e despesas pendentes" icon={Lock} variant="warning" />
              <MetricCard title="Disponível Real" value={formatCurrency(data.total_available)}
                subtitle="Livre de compromissos" icon={TrendingUp} variant="success" />
              <MetricCard title="Investível" value={formatCurrency(data.investment_capacity)}
                subtitle="Após reserva de segurança" icon={TrendingUp}
                variant={data.investment_capacity > 0 ? "success" : "danger"} />
            </div>

            {/* Monthly metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Receita Prevista" value={formatCurrency(data.monthly_income_expected)} icon={TrendingUp} />
              <MetricCard title="Receita Recebida" value={formatCurrency(data.monthly_income_received)}
                icon={TrendingUp} variant="success" />
              <MetricCard title="Despesas Mês" value={formatCurrency(data.monthly_expenses_total)} icon={TrendingDown} variant="warning" />
              <MetricCard title="Obrigações Mês" value={formatCurrency(data.monthly_liabilities_total)} icon={AlertTriangle}
                variant={data.overdue_liabilities > 0 ? "danger" : "neutral"} />
            </div>

            {/* Decision indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DecisionBadge label={`Pode Investir? ${data.can_invest ? "SIM" : "NÃO"}`}
                yes={data.can_invest} reason={!data.can_invest ? data.investment_block_reason : undefined} />
              <DecisionBadge label={`Risco Financeiro? ${data.financial_risk ? "SIM" : "NÃO"}`}
                yes={!data.financial_risk} reason={undefined} />
              <div className="card p-4">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Quanto Posso Investir?</p>
                <p className={cn("text-2xl font-bold mt-1",
                  data.investment_capacity > 0 ? "text-success-700" : "text-danger-700")}>
                  {formatCurrency(data.investment_capacity)}
                </p>
              </div>
            </div>

            {/* Rates */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Taxa de Poupança", value: formatPct(data.savings_rate), ok: data.savings_rate >= 20 },
                { label: "Taxa de Endividamento", value: formatPct(data.debt_ratio), ok: data.debt_ratio <= 35 },
                { label: "Cobertura Obrigações", value: formatPct(data.liability_coverage_pct), ok: data.liability_coverage_pct >= 100 },
                { label: "Património Líquido", value: formatCurrency(data.net_worth), ok: data.net_worth > 0 },
              ].map(({ label, value, ok }) => (
                <div key={label} className="card p-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
                  <p className={cn("text-xl font-bold mt-1", ok ? "text-success-700" : "text-danger-700")}>{value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-neutral-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary-500" /> Distribuição por Conta
                  </h3>
                </div>
                <div className="card-body">
                  <BalancePieChart accounts={data.accounts} />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-neutral-800">Receitas vs Despesas (Mês Actual)</h3>
                </div>
                <div className="card-body">
                  <IncomeExpensesBar
                    incomeExpected={data.monthly_income_expected}
                    incomeReceived={data.monthly_income_received}
                    expenses={data.monthly_expenses_total}
                    liabilities={data.monthly_liabilities_total}
                  />
                </div>
              </div>
            </div>

            {/* Account liquidity table */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-neutral-800">Liquidez por Conta</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {["Conta", "Banco", "Saldo Actual", "Comprometido", "Disponível", "Estado"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {data.accounts.map((acc) => (
                      <tr key={acc.account_id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-800">{acc.account_name}</td>
                        <td className="px-4 py-3 text-neutral-500">{acc.bank_name}</td>
                        <td className="px-4 py-3 font-mono text-neutral-800">{formatCurrency(acc.current_balance)}</td>
                        <td className="px-4 py-3 font-mono text-warning-700">{formatCurrency(acc.committed_balance)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-success-700">{formatCurrency(acc.available_balance)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("badge", acc.has_sufficient_funds
                            ? "text-success-700 bg-success-50 border-success-200"
                            : "text-danger-700 bg-danger-50 border-danger-200")}>
                            {acc.has_sufficient_funds ? "OK" : "Sem liquidez"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
