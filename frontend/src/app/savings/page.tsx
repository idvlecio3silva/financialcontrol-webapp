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
import type { SavingsGoal, BankAccount } from "@/types";
import { Plus, X, PiggyBank } from "lucide-react";

const schema = z.object({
  bank_account_id: z.string().uuid(),
  name: z.string().min(1),
  target_amount: z.coerce.number().positive(),
  current_amount: z.coerce.number().min(0),
  target_date: z.string().optional(),
  notes: z.string().optional(),
});
type GoalForm = z.infer<typeof schema>;

export default function SavingsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: goals = [], isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["savings"],
    queryFn: () => api.get("/savings").then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GoalForm>({
    resolver: zodResolver(schema),
    defaultValues: { current_amount: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (d: GoalForm) => api.post("/savings", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["savings"] }); toast.success("Objectivo criado"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Poupança</h1>
            <p className="text-sm text-neutral-500">Objectivos de poupança e progresso</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Novo Objectivo
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
        ) : !goals.length ? (
          <div className="flex flex-col items-center justify-center py-20">
            <PiggyBank className="w-16 h-16 text-neutral-300 mb-4" />
            <p className="text-neutral-500 text-lg font-medium">Nenhum objectivo definido</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Criar primeiro objectivo</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((g) => (
              <div key={g.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-neutral-800">{g.name}</h3>
                  <span className={cn("badge text-xs",
                    g.status === "completed" ? "text-success-700 bg-success-50 border-success-200" :
                    g.status === "active" ? "text-primary-700 bg-primary-50 border-primary-200" :
                    "text-neutral-500 bg-neutral-100 border-neutral-200")}>
                    {g.status === "completed" ? "Concluído" : g.status === "active" ? "Activo" : g.status === "paused" ? "Pausado" : "Cancelado"}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Progresso</span>
                    <span className="font-semibold text-primary-700">{g.progress_pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      g.progress_pct >= 100 ? "bg-success-500" : "bg-primary-500")}
                      style={{ width: `${Math.min(100, g.progress_pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>{formatCurrency(g.current_amount)}</span>
                    <span>{formatCurrency(g.target_amount)}</span>
                  </div>
                </div>
                {g.target_date && <p className="text-xs text-neutral-400 mt-3">Prazo: {g.target_date}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Novo Objectivo de Poupança</h2>
              <button onClick={() => { setShowModal(false); reset(); }}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Conta associada</label>
                <select className="input" {...register("bank_account_id")}>
                  <option value="">Seleccionar...</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.bank_name})</option>)}
                </select>
              </div>
              <div><label className="label">Nome do objectivo</label>
                <input className={`input ${errors.name ? "border-danger-500" : ""}`} placeholder="Ex: Fundo de emergência, Férias..." {...register("name")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Meta (AOA)</label><input type="number" step="0.01" className="input" {...register("target_amount")} /></div>
                <div><label className="label">Acumulado (AOA)</label><input type="number" step="0.01" className="input" {...register("current_amount")} /></div>
              </div>
              <div><label className="label">Data limite (opcional)</label><input type="date" className="input" {...register("target_date")} /></div>
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
