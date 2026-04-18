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
import type { Income, BankAccount } from "@/types";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";

const schema = z.object({
  bank_account_id: z.string().uuid(),
  date: z.string().min(1),
  source: z.string().min(1, "Fonte obrigatória"),
  income_type: z.enum(["fixed", "variable", "passive"]),
  expected_amount: z.coerce.number().positive(),
  received_amount: z.coerce.number().min(0),
  status: z.enum(["expected", "received", "partial", "cancelled"]),
  notes: z.string().optional(),
});
type IncomeForm = z.infer<typeof schema>;

const today = format(new Date(), "yyyy-MM-dd");

export default function IncomePage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const { data: incomes = [], isLoading } = useQuery<Income[]>({
    queryKey: ["incomes", month, year],
    queryFn: () => api.get(`/incomes?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<IncomeForm>({
    resolver: zodResolver(schema),
    defaultValues: { date: today, income_type: "fixed", status: "expected", received_amount: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (d: IncomeForm) => api.post("/incomes", d).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incomes"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Receita registada"); setShowModal(false); reset(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const totalExpected = incomes.reduce((s, i) => s + i.expected_amount, 0);
  const totalReceived = incomes.reduce((s, i) => s + i.received_amount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Receitas</h1>
            <p className="text-sm text-neutral-500">{month}/{year}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Receita
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Previsto</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{formatCurrency(totalExpected)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Recebido</p>
            <p className="text-2xl font-bold text-success-700 mt-1">{formatCurrency(totalReceived)}</p></div>
          <div className="card p-5"><p className="text-xs text-neutral-500 uppercase">Desvio</p>
            <p className={cn("text-2xl font-bold mt-1", totalReceived >= totalExpected ? "text-success-700" : "text-danger-700")}>
              {formatCurrency(totalReceived - totalExpected)}
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div> : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr>{["Data", "Fonte", "Tipo", "Previsto", "Recebido", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {incomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-neutral-500">{inc.date}</td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{inc.source}</td>
                    <td className="px-4 py-3 text-neutral-500">{inc.income_type === "fixed" ? "Fixa" : inc.income_type === "variable" ? "Variável" : "Passiva"}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(inc.expected_amount)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-success-700">{formatCurrency(inc.received_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("badge", STATUS_COLORS[inc.status])}>
                        {inc.status === "received" ? "Recebida" : inc.status === "expected" ? "Prevista" : inc.status === "partial" ? "Parcial" : "Cancelada"}
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
              <h2 className="font-semibold">Nova Receita</h2>
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
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Data</label><input type="date" className="input" {...register("date")} /></div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" {...register("income_type")}>
                    <option value="fixed">Fixa</option><option value="variable">Variável</option><option value="passive">Passiva</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Fonte</label>
                <input className={`input ${errors.source ? "border-danger-500" : ""}`} {...register("source")} />
                {errors.source && <p className="text-xs text-danger-600 mt-1">{errors.source.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Valor previsto (AOA)</label>
                  <input type="number" step="0.01" className="input" {...register("expected_amount")} /></div>
                <div><label className="label">Valor recebido (AOA)</label>
                  <input type="number" step="0.01" className="input" {...register("received_amount")} /></div>
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="input" {...register("status")}>
                  <option value="expected">Previsto</option><option value="received">Recebido</option>
                  <option value="partial">Parcial</option><option value="cancelled">Cancelado</option>
                </select>
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
