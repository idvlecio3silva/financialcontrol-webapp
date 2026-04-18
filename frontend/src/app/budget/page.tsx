"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn, MONTH_NAMES } from "@/lib/utils";
import type { Budget } from "@/types";
import { Plus, X, BookOpen } from "lucide-react";

const schema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  expected_income: z.coerce.number().min(0),
  expected_expenses: z.coerce.number().min(0),
  planned_savings: z.coerce.number().min(0),
  planned_investment: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type BudgetForm = z.infer<typeof schema>;

function ProgressBar({ actual, planned, label }: { actual: number; planned: number; label: string }) {
  const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
  const over = actual > planned;
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500 mb-1">
        <span>{label}</span>
        <span className={cn(over ? "text-danger-600 font-medium" : "")}>{formatCurrency(actual)} / {formatCurrency(planned)}</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", over ? "bg-danger-500" : "bg-primary-500")}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const year = new Date().getFullYear();

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ["budgets", year],
    queryFn: () => api.get(`/budgets?year=${year}`).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BudgetForm>({
    resolver: zodResolver(schema),
    defaultValues: { month: new Date().getMonth() + 1, year, expected_income: 0, expected_expenses: 0, planned_savings: 0, planned_investment: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (d: BudgetForm) => api.post("/budgets", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["budgets"] }); toast.success("Orçamento criado"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const currentBudget = budgets.find((b) => b.month === new Date().getMonth() + 1 && b.year === year);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Orçamento Mensal</h1>
            <p className="text-sm text-neutral-500">{year}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Orçamento
          </button>
        </div>

        {/* Current month summary */}
        {currentBudget && (
          <div className="card p-6">
            <h3 className="font-semibold text-neutral-800 mb-4">
              Mês Actual — {MONTH_NAMES[currentBudget.month - 1]} {currentBudget.year}
            </h3>
            <div className="space-y-3">
              <ProgressBar actual={currentBudget.actual_income} planned={currentBudget.expected_income} label="Receitas" />
              <ProgressBar actual={currentBudget.actual_expenses} planned={currentBudget.expected_expenses} label="Despesas" />
              <ProgressBar actual={currentBudget.actual_savings} planned={currentBudget.planned_savings} label="Poupança" />
              <ProgressBar actual={currentBudget.actual_investment} planned={currentBudget.planned_investment} label="Investimento" />
            </div>
          </div>
        )}

        {/* Budget table */}
        <div className="card overflow-hidden">
          {isLoading ? <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> :
            !budgets.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <BookOpen className="w-12 h-12 text-neutral-300 mb-3" />
                <p className="text-neutral-500">Nenhum orçamento definido</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b">
                  <tr>{["Mês", "Rec. Prev.", "Rec. Real", "Desp. Prev.", "Desp. Real", "Desvio Receita", "Desvio Despesa"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {budgets.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">{MONTH_NAMES[b.month - 1]} {b.year}</td>
                      <td className="px-4 py-3 font-mono">{formatCurrency(b.expected_income)}</td>
                      <td className="px-4 py-3 font-mono text-success-700">{formatCurrency(b.actual_income)}</td>
                      <td className="px-4 py-3 font-mono">{formatCurrency(b.expected_expenses)}</td>
                      <td className="px-4 py-3 font-mono text-warning-700">{formatCurrency(b.actual_expenses)}</td>
                      <td className={cn("px-4 py-3 font-mono font-semibold", b.income_deviation >= 0 ? "text-success-700" : "text-danger-700")}>
                        {b.income_deviation >= 0 ? "+" : ""}{formatCurrency(b.income_deviation)}
                      </td>
                      <td className={cn("px-4 py-3 font-mono font-semibold", b.expense_deviation <= 0 ? "text-success-700" : "text-danger-700")}>
                        {b.expense_deviation >= 0 ? "+" : ""}{formatCurrency(b.expense_deviation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Novo Orçamento</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Mês</label>
                  <select className="input" {...register("month")}>
                    {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Ano</label><input type="number" className="input" {...register("year")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Receita prevista</label><input type="number" step="0.01" className="input" {...register("expected_income")} /></div>
                <div><label className="label">Despesas previstas</label><input type="number" step="0.01" className="input" {...register("expected_expenses")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Poupança planeada</label><input type="number" step="0.01" className="input" {...register("planned_savings")} /></div>
                <div><label className="label">Investimento planeado</label><input type="number" step="0.01" className="input" {...register("planned_investment")} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? "A guardar..." : "Criar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
