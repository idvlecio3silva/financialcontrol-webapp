"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, cn, STATUS_COLORS } from "@/lib/utils";
import type { Investment, BankAccount, InvestmentValidation } from "@/types";
import { Plus, X, CheckCircle, XCircle, LineChart } from "lucide-react";
import { format } from "date-fns";

const schema = z.object({
  bank_account_id: z.string().uuid(),
  date: z.string().min(1),
  asset_name: z.string().min(1),
  investment_type: z.enum(["stock", "bond", "fund", "real_estate", "crypto", "fixed_income", "other"]),
  invested_amount: z.coerce.number().positive("Valor deve ser positivo"),
  notes: z.string().optional(),
});
type InvestmentForm = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  stock: "Acção", bond: "Obrigação", fund: "Fundo", real_estate: "Imóvel",
  crypto: "Criptomoeda", fixed_income: "Rend. Fixo", other: "Outro",
};

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: investments = [], isLoading } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: () => api.get("/investments").then((r) => r.data),
  });

  const { data: capacityCheck } = useQuery<InvestmentValidation>({
    queryKey: ["investment-check"],
    queryFn: () => api.get("/dashboard/investment-check").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InvestmentForm>({
    resolver: zodResolver(schema),
    defaultValues: { date: format(new Date(), "yyyy-MM-dd"), investment_type: "fixed_income" },
  });

  const createMutation = useMutation({
    mutationFn: (d: InvestmentForm) => api.post("/investments", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Investimento registado"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Investimento bloqueado"),
  });

  const totalInvested = investments.reduce((s, i) => s + i.invested_amount, 0);
  const totalCurrent = investments.reduce((s, i) => s + i.current_value, 0);
  const totalReturn = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Investimentos</h1>
            <p className="text-sm text-neutral-500">Portfólio de investimentos activos</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Investimento
          </button>
        </div>

        {/* Investment capacity indicator */}
        {capacityCheck && (
          <div className={cn("flex items-start gap-3 p-4 rounded-xl border",
            capacityCheck.allowed ? "bg-success-50 border-success-200" : "bg-danger-50 border-danger-200")}>
            {capacityCheck.allowed
              ? <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 shrink-0" />
              : <XCircle className="w-5 h-5 text-danger-600 mt-0.5 shrink-0" />}
            <div>
              <p className={cn("text-sm font-semibold", capacityCheck.allowed ? "text-success-800" : "text-danger-800")}>
                {capacityCheck.allowed ? `Pode investir até ${formatCurrency(capacityCheck.investment_capacity)}` : "Investimento bloqueado"}
              </p>
              {!capacityCheck.allowed && <p className="text-xs text-danger-600 mt-0.5">{capacityCheck.reason}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Total Investido</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(totalInvested)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Valor Actual</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{formatCurrency(totalCurrent)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Rentabilidade</p>
            <p className={cn("text-2xl font-bold mt-1", totalReturn >= 0 ? "text-success-700" : "text-danger-700")}>
              {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> :
            !investments.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <LineChart className="w-12 h-12 text-neutral-300 mb-3" />
                <p className="text-neutral-500">Nenhum investimento registado</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b">
                  <tr>{["Data", "Activo", "Tipo", "Investido", "Valor Actual", "Rentab.", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {investments.map((inv) => (
                    <tr key={inv.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-neutral-500">{inv.date}</td>
                      <td className="px-4 py-3 font-medium text-neutral-800">{inv.asset_name}</td>
                      <td className="px-4 py-3 text-neutral-500">{TYPE_LABELS[inv.investment_type]}</td>
                      <td className="px-4 py-3 font-mono">{formatCurrency(inv.invested_amount)}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(inv.current_value)}</td>
                      <td className={cn("px-4 py-3 font-mono font-semibold", inv.return_pct >= 0 ? "text-success-700" : "text-danger-700")}>
                        {inv.return_pct >= 0 ? "+" : ""}{inv.return_pct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("badge", STATUS_COLORS[inv.status])}>
                          {inv.status === "active" ? "Activo" : inv.status === "sold" ? "Vendido" : "Cancelado"}
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
              <h2 className="font-semibold">Novo Investimento</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            {capacityCheck && !capacityCheck.allowed && (
              <div className="mx-6 mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">⚠ {capacityCheck.reason}</p>
              </div>
            )}
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Conta origem</label>
                <select className="input" {...register("bank_account_id")}>
                  <option value="">Seleccionar...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank_name}) — {formatCurrency(a.available_balance)} disp.</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Data</label><input type="date" className="input" {...register("date")} /></div>
                <div><label className="label">Tipo</label>
                  <select className="input" {...register("investment_type")}>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Nome do activo</label>
                <input className={`input ${errors.asset_name ? "border-danger-500" : ""}`} {...register("asset_name")} placeholder="Ex: TLTL, Fundo A, BPC Bonds..." />
                {errors.asset_name && <p className="text-xs text-danger-600 mt-1">{errors.asset_name.message}</p>}</div>
              <div><label className="label">Valor a investir (AOA)</label>
                <input type="number" step="0.01" className={`input ${errors.invested_amount ? "border-danger-500" : ""}`} {...register("invested_amount")} />
                {errors.invested_amount && <p className="text-xs text-danger-600 mt-1">{errors.invested_amount.message}</p>}</div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || (capacityCheck ? !capacityCheck.allowed : false)}>
                  {isSubmitting ? "A validar..." : "Investir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
