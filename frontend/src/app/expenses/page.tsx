"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn, PRIORITY_COLORS, STATUS_COLORS } from "@/lib/utils";
import type { Expense, BankAccount } from "@/types";
import { Plus, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const schema = z.object({
  bank_account_id: z.string().uuid("Conta obrigatória"),
  date: z.string().min(1),
  description: z.string().min(1, "Descrição obrigatória"),
  expense_type: z.enum(["fixed", "variable", "debt", "investment"]),
  priority: z.enum(["critical", "important", "optional"]),
  amount: z.coerce.number().positive("Valor deve ser positivo"),
  due_date: z.string().optional(),
  notes: z.string().optional(),
});
type ExpenseForm = z.infer<typeof schema>;

const today = format(new Date(), "yyyy-MM-dd");

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [month] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", month, year],
    queryFn: () => api.get(`/expenses?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(schema),
    defaultValues: { date: today, priority: "important", expense_type: "variable" },
  });

  const createMutation = useMutation({
    mutationFn: (data: ExpenseForm) => api.post("/expenses", data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Despesa registada"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro ao criar despesa"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Despesa cancelada"); },
  });

  const totalPending = expenses.filter((e) => e.status === "pending" || e.status === "overdue")
    .reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const overdue = expenses.filter((e) => e.status === "overdue");

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Despesas</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Mês actual — {month}/{year}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Despesa
          </button>
        </div>

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-danger-600 shrink-0" />
            <p className="text-sm text-danger-800 font-medium">
              {overdue.length} despesa(s) em atraso totalizando {formatCurrency(overdue.reduce((s, e) => s + e.amount, 0))}
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Por pagar</p>
            <p className="text-2xl font-bold text-warning-700 mt-1">{formatCurrency(totalPending)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Pago</p>
            <p className="text-2xl font-bold text-success-700 mt-1">{formatCurrency(totalPaid)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Total Mês</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(totalPending + totalPaid)}</p></div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  {["Data", "Descrição", "Prioridade", "Valor", "Vencimento", "Estado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {expenses.map((exp) => (
                  <tr key={exp.id} className={cn("hover:bg-neutral-50", exp.status === "overdue" && "bg-danger-50/30")}>
                    <td className="px-4 py-3 text-neutral-500">{exp.date}</td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{exp.description}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", PRIORITY_COLORS[exp.priority])}>
                        {exp.priority === "critical" ? "Crítica" : exp.priority === "important" ? "Importante" : "Opcional"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-neutral-500">{exp.due_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", STATUS_COLORS[exp.status])}>
                        {exp.status === "paid" ? "Pago" : exp.status === "pending" ? "Pendente" : exp.status === "overdue" ? "Em atraso" : "Cancelado"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {exp.status !== "paid" && exp.status !== "cancelled" && (
                        <button onClick={() => cancelMutation.mutate(exp.id)}
                          className="text-neutral-300 hover:text-danger-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
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
              <h2 className="font-semibold text-neutral-800">Nova Despesa</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Conta bancária</label>
                <select className={`input ${errors.bank_account_id ? "border-danger-500" : ""}`} {...register("bank_account_id")}>
                  <option value="">Seleccionar conta...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank_name}) — {formatCurrency(a.available_balance)} disp.</option>)}
                </select>
                {errors.bank_account_id && <p className="text-xs text-danger-600 mt-1">{errors.bank_account_id.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Data</label>
                  <input type="date" className="input" {...register("date")} />
                </div>
                <div>
                  <label className="label">Vencimento</label>
                  <input type="date" className="input" {...register("due_date")} />
                </div>
              </div>
              <div>
                <label className="label">Descrição</label>
                <input className={`input ${errors.description ? "border-danger-500" : ""}`} {...register("description")} />
                {errors.description && <p className="text-xs text-danger-600 mt-1">{errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" {...register("expense_type")}>
                    <option value="fixed">Fixa</option>
                    <option value="variable">Variável</option>
                    <option value="debt">Dívida</option>
                    <option value="investment">Investimento</option>
                  </select>
                </div>
                <div>
                  <label className="label">Prioridade</label>
                  <select className="input" {...register("priority")}>
                    <option value="critical">Crítica</option>
                    <option value="important">Importante</option>
                    <option value="optional">Opcional</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Valor (AOA)</label>
                <input type="number" step="0.01" className={`input ${errors.amount ? "border-danger-500" : ""}`} {...register("amount")} />
                {errors.amount && <p className="text-xs text-danger-600 mt-1">{errors.amount.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "A guardar..." : "Registar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
