"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn } from "@/lib/utils";
import type { CashFlowDay } from "@/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Calendar, AlertTriangle } from "lucide-react";

export default function CashflowPage() {
  const [days, setDays] = useState(30);

  const { data: cashflow = [], isLoading } = useQuery<CashFlowDay[]>({
    queryKey: ["cashflow", days],
    queryFn: () => api.get(`/cashflow/projection?days=${days}`).then((r) => r.data),
  });

  const criticalDays = cashflow.filter((d) => d.is_critical);
  const minBalance = Math.min(...cashflow.map((d) => d.free_balance));
  const chartData = cashflow.map((d) => ({
    date: d.date.slice(5),
    saldo: parseFloat(d.running_balance.toString()),
    livre: parseFloat(d.free_balance.toString()),
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Fluxo de Caixa Projectado</h1>
            <p className="text-sm text-neutral-500">Projecção e identificação de riscos futuros</p>
          </div>
          <div className="flex items-center gap-2">
            {[30, 60, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={cn("px-3 py-1.5 text-sm rounded-lg border transition-colors",
                  days === d ? "bg-primary-600 text-white border-primary-600" : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50")}>
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {criticalDays.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-danger-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-danger-800">
                {criticalDays.length} dia(s) crítico(s) nos próximos {days} dias
              </p>
              <p className="text-xs text-danger-600 mt-0.5">
                Primeiro dia crítico: {criticalDays[0]?.date} — Saldo livre mínimo: {formatCurrency(minBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Dias Críticos</p>
            <p className={cn("text-2xl font-bold mt-1", criticalDays.length > 0 ? "text-danger-700" : "text-success-700")}>{criticalDays.length}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Saldo Livre Mínimo</p>
            <p className={cn("text-2xl font-bold mt-1", minBalance < 0 ? "text-danger-700" : "text-success-700")}>{formatCurrency(minBalance)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Saldo Final Projectado</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">
              {cashflow.length ? formatCurrency(cashflow[cashflow.length - 1].running_balance) : "—"}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-neutral-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-500" /> Evolução do Saldo Projectado
          </h3></div>
          <div className="card-body">
            {isLoading ? <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2} dot={false} name="Saldo Total" />
                  <Line type="monotone" dataKey="livre" stroke="#22c55e" strokeWidth={2} dot={false} name="Saldo Livre" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily table */}
        <div className="card overflow-hidden">
          <div className="card-header"><h3 className="font-semibold text-neutral-800">Detalhe Diário</h3></div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b sticky top-0">
                <tr>{["Data", "Entradas", "Saídas", "Saldo Acum.", "Saldo Livre", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {cashflow.map((day) => (
                  <tr key={day.date} className={cn("hover:bg-neutral-50", day.is_critical && "bg-danger-50/30")}>
                    <td className="px-4 py-2 font-medium text-neutral-800">{day.date}</td>
                    <td className="px-4 py-2 font-mono text-success-700">{day.inflows > 0 ? formatCurrency(day.inflows) : "—"}</td>
                    <td className="px-4 py-2 font-mono text-danger-700">{day.outflows > 0 ? formatCurrency(day.outflows) : "—"}</td>
                    <td className="px-4 py-2 font-mono">{formatCurrency(day.running_balance)}</td>
                    <td className={cn("px-4 py-2 font-mono font-semibold", day.free_balance < 0 ? "text-danger-700" : "text-success-700")}>
                      {formatCurrency(day.free_balance)}
                    </td>
                    <td className="px-4 py-2">
                      {day.is_critical && <span className="badge text-danger-700 bg-danger-50 border-danger-200">Crítico</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
