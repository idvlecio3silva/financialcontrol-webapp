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
import type { Liability, BankAccount } from "@/types";
import { Plus, X, AlertCircle } from "lucide-react";

const schema = z.object({
  bank_account_id: z.string().uuid(),
  name: z.string().min(1, "Nome obrigatório"),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["monthly", "quarterly", "annual", "one_time"]),
  due_day: z.coerce.number().min(1).max(31),
  priority: z.enum(["critical", "important", "optional"]),
  is_mandatory: z.boolean(),
  notes: z.string().optional(),
});
type LiabilityForm = z.infer<typeof schema>;

export default function LiabilitiesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: liabilities = [], isLoading } = useQuery<Liability[]>({
    queryKey: ["liabilities"],
    queryFn: () => api.get("/liabilities").then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<LiabilityForm>({
    resolver: zodResolver(schema),
    defaultValues: { frequency: "monthly", due_day: 1, priority: "critical", is_mandatory: true },
  });

  const createMutation = useMutation({
    mutationFn: (d: LiabilityForm) => api.post("/liabilities", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["liabilities"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Responsabilidade criada"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/liabilities/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["liabilities"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Responsabilidade cancelada"); },
  });

  const critical = liabilities.filter((l) => l.priority === "critical");
  const overdueCount = liabilities.filter((l) => l.status === "overdue").length;
  const totalMonthly = liabilities.filter((l) => l.frequency === "monthly" && l.status === "active")
    .reduce((s, l) => s + l.amount, 0);

  const FREQ_LABELS: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual", one_time: "Única" };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Responsabilidades</h1>
            <p className="text-sm text-neutral-500">Obrigações financeiras activas</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Responsabilidade
          </button>
        </div>

        {overdueCount > 0 && (
          <div className="flex items-center gap-3 p-4 bg-danger-50 border border-danger-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-danger-600 shrink-0" />
            <p className="text-sm font-medium text-danger-800">{overdueCount} responsabilidade(s) em atraso — regularize imediatamente</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Total Mensal</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCurrency(totalMonthly)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Críticas</p>
            <p className={cn("text-2xl font-bold mt-1", critical.length > 0 ? "text-danger-700" : "text-neutral-400")}>{critical.length}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Em Atraso</p>
            <p className={cn("text-2xl font-bold mt-1", overdueCount > 0 ? "text-danger-700" : "text-success-700")}>{overdueCount}</p></div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr>{["Responsabilidade", "Conta", "Valor", "Frequência", "Dia Venc.", "Prioridade", "Estado", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {liabilities.map((l) => (
                  <tr key={l.id} className={cn("hover:bg-neutral-50", l.status === "overdue" && "bg-danger-50/20")}>
                    <td className="px-4 py-3 font-medium text-neutral-800">
                      {l.name}{l.is_mandatory && <span className="ml-1 text-xs text-danger-500">*</span>}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{accounts.find((a) => a.id === l.bank_account_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(l.amount)}</td>
                    <td className="px-4 py-3 text-neutral-500">{FREQ_LABELS[l.frequency]}</td>
                    <td className="px-4 py-3 text-neutral-500">{l.due_day}</td>
                    <td className="px-4 py-3"><span className={cn("badge", PRIORITY_COLORS[l.priority])}>
                      {l.priority === "critical" ? "Crítica" : l.priority === "important" ? "Importante" : "Opcional"}
                    </span></td>
                    <td className="px-4 py-3"><span className={cn("badge", STATUS_COLORS[l.status])}>
                      {l.status === "active" ? "Activa" : l.status === "overdue" ? "Atraso" : l.status === "paid" ? "Paga" : "Suspensa"}
                    </span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => cancelMutation.mutate(l.id)} className="text-neutral-300 hover:text-danger-500 transition-colors"><X className="w-4 h-4" /></button>
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
              <h2 className="font-semibold">Nova Responsabilidade</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Conta bancária</label>
                <select className="input" {...register("bank_account_id")}>
                  <option value="">Seleccionar...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank_name})</option>)}
                </select>
              </div>
              <div><label className="label">Nome</label>
                <input className={`input ${errors.name ? "border-danger-500" : ""}`} {...register("name")} />
                {errors.name && <p className="text-xs text-danger-600 mt-1">{errors.name.message}</p>}</div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Valor (AOA)</label>
                  <input type="number" step="0.01" className="input" {...register("amount")} /></div>
                <div><label className="label">Dia de vencimento</label>
                  <input type="number" min="1" max="31" className="input" {...register("due_day")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Frequência</label>
                  <select className="input" {...register("frequency")}>
                    <option value="monthly">Mensal</option><option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option><option value="one_time">Única</option>
                  </select></div>
                <div><label className="label">Prioridade</label>
                  <select className="input" {...register("priority")}>
                    <option value="critical">Crítica</option><option value="important">Importante</option><option value="optional">Opcional</option>
                  </select></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="mandatory" {...register("is_mandatory")} className="rounded" />
                <label htmlFor="mandatory" className="text-sm text-neutral-700">Obrigatória (não pode ser adiada)</label>
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
