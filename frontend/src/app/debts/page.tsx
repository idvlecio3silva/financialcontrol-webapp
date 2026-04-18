"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn } from "@/lib/utils";
import type { Debt, BankAccount } from "@/types";
import { Plus, X, CreditCard } from "lucide-react";

const schema = z.object({
  bank_account_id: z.string().uuid(),
  creditor: z.string().min(1, "Credor obrigatório"),
  original_amount: z.coerce.number().min(0),
  current_balance: z.coerce.number().min(0),
  monthly_payment: z.coerce.number().min(0),
  interest_rate: z.coerce.number().min(0),
  next_due_date: z.string().optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  notes: z.string().optional(),
});
type DebtForm = z.infer<typeof schema>;

const RISK_COLORS: Record<string, string> = {
  low: "text-success-700 bg-success-50 border-success-200",
  medium: "text-warning-700 bg-warning-50 border-warning-200",
  high: "text-danger-700 bg-danger-50 border-danger-200",
  critical: "text-red-900 bg-red-100 border-red-300",
};

export default function DebtsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: debts = [], isLoading } = useQuery<Debt[]>({
    queryKey: ["debts"],
    queryFn: () => api.get("/debts").then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DebtForm>({
    resolver: zodResolver(schema),
    defaultValues: { interest_rate: 0, risk_level: "medium" },
  });

  const createMutation = useMutation({
    mutationFn: (d: DebtForm) => api.post("/debts", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debts"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Dívida registada"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const totalDebt = debts.filter((d) => d.status === "active").reduce((s, d) => s + d.current_balance, 0);
  const totalMonthly = debts.filter((d) => d.status === "active").reduce((s, d) => s + d.monthly_payment, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Dívidas</h1>
            <p className="text-sm text-neutral-500">Gestão de passivos financeiros</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Registar Dívida
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Total em Dívida</p>
            <p className="text-2xl font-bold text-danger-700 mt-1">{formatCurrency(totalDebt)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Prestações Mensais</p>
            <p className="text-2xl font-bold text-warning-700 mt-1">{formatCurrency(totalMonthly)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Nº de Dívidas Activas</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{debts.filter((d) => d.status === "active").length}</p></div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> :
            !debts.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <CreditCard className="w-12 h-12 text-neutral-300 mb-3" />
                <p className="text-neutral-500">Sem dívidas registadas</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b">
                  <tr>{["Credor", "Saldo Actual", "Prestação Mensal", "Taxa (%)", "Próx. Vencimento", "Risco"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {debts.map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-800">{d.creditor}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-danger-700">{formatCurrency(d.current_balance)}</td>
                      <td className="px-4 py-3 font-mono">{formatCurrency(d.monthly_payment)}</td>
                      <td className="px-4 py-3 text-neutral-600">{d.interest_rate.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-neutral-500">{d.next_due_date ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("badge", RISK_COLORS[d.risk_level])}>
                          {d.risk_level === "low" ? "Baixo" : d.risk_level === "medium" ? "Médio" : d.risk_level === "high" ? "Alto" : "Crítico"}
                        </span>
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
              <h2 className="font-semibold">Registar Dívida</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Conta de pagamento</label>
                <select className="input" {...register("bank_account_id")}>
                  <option value="">Seleccionar...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank_name})</option>)}
                </select>
              </div>
              <div><label className="label">Credor</label>
                <input className={`input ${errors.creditor ? "border-danger-500" : ""}`} {...register("creditor")} />
                {errors.creditor && <p className="text-xs text-danger-600 mt-1">{errors.creditor.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Valor original</label><input type="number" step="0.01" className="input" {...register("original_amount")} /></div>
                <div><label className="label">Saldo actual</label><input type="number" step="0.01" className="input" {...register("current_balance")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Prestação mensal</label><input type="number" step="0.01" className="input" {...register("monthly_payment")} /></div>
                <div><label className="label">Taxa de juro (%)</label><input type="number" step="0.01" className="input" {...register("interest_rate")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Próx. vencimento</label><input type="date" className="input" {...register("next_due_date")} /></div>
                <div><label className="label">Nível de risco</label>
                  <select className="input" {...register("risk_level")}>
                    <option value="low">Baixo</option><option value="medium">Médio</option>
                    <option value="high">Alto</option><option value="critical">Crítico</option>
                  </select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? "A guardar..." : "Registar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
