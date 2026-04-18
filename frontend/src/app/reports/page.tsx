"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn, MONTH_NAMES } from "@/lib/utils";
import type { CategorySummary, NetWorthPoint } from "@/types";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts";
import { BarChart3 } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export default function ReportsPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year] = useState(today.getFullYear());

  const { data: categoryData = [] } = useQuery<CategorySummary[]>({
    queryKey: ["report-categories", month, year],
    queryFn: () => api.get(`/reports/expenses-by-category?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: netWorthData = [] } = useQuery<NetWorthPoint[]>({
    queryKey: ["report-networth"],
    queryFn: () => api.get("/reports/net-worth-evolution?months=12").then((r) => r.data),
  });

  const pieData = categoryData.filter((c) => c.total > 0).map((c, i) => ({
    name: c.category_name,
    value: c.total,
    pct: c.pct,
    color: COLORS[i % COLORS.length],
  }));

  const netWorthChart = netWorthData.map((p) => ({
    label: `${MONTH_NAMES[p.month - 1].slice(0, 3)} ${p.year}`,
    patrimonio: p.net_worth,
    saldo: p.balance,
    investimentos: p.investments,
    dividas: p.debts,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Relatórios e Análises</h1>
            <p className="text-sm text-neutral-500">Visão analítica do desempenho financeiro</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input w-40 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-neutral-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-500" /> Despesas por Categoria — {MONTH_NAMES[month - 1]}
            </h3></div>
            <div className="card-body">
              {!pieData.length ? <p className="text-neutral-400 text-sm text-center py-8">Sem dados para este período</p> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="font-semibold text-neutral-800">Detalhe por Categoria</h3></div>
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr><th className="px-4 py-2 text-left text-xs text-neutral-500">Categoria</th>
                    <th className="px-4 py-2 text-right text-xs text-neutral-500">Total</th>
                    <th className="px-4 py-2 text-right text-xs text-neutral-500">%</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {categoryData.map((c) => (
                    <tr key={c.category_name} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 text-neutral-700">{c.category_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrency(c.total)}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-500">{c.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Net worth evolution */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-neutral-800">Evolução do Património Líquido (12 meses)</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={netWorthChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="patrimonio" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Património Líq." />
                <Line type="monotone" dataKey="saldo" stroke="#10b981" strokeWidth={1.5} dot={false} name="Saldo Bancário" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="investimentos" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Investimentos" />
                <Line type="monotone" dataKey="dividas" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Dívidas" strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
