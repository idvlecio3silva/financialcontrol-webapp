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
import type { BankAccount } from "@/types";
import { Plus, Pencil, Landmark, X } from "lucide-react";

const accountSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  bank_name: z.string().min(1, "Banco obrigatório"),
  account_type: z.enum(["checking", "savings", "investment", "salary"]),
  current_balance: z.coerce.number(),
  minimum_balance: z.coerce.number().min(0),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta Corrente", savings: "Poupança", investment: "Investimento", salary: "Ordenado",
};

const DEFAULT_BANKS = ["BPC", "BFA", "BNI", "BCI", "BAI"];

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get("/bank-accounts").then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: AccountForm) => api.post("/bank-accounts", data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta criada"); closeModal(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountForm> }) =>
      api.patch(`/bank-accounts/${id}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-accounts"] }); toast.success("Conta actualizada"); closeModal(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erro"),
  });

  const openCreate = () => { setEditing(null); reset({ account_type: "checking", minimum_balance: 0, current_balance: 0 }); setShowModal(true); };
const openEdit = (acc: BankAccount) => {
  setEditing(acc);
  reset({
    ...acc,
    notes: acc.notes ?? "",
  });
  setShowModal(true);
};
  const closeModal = () => { setShowModal(false); setEditing(null); reset(); };

  const onSubmit = (data: AccountForm) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const total = accounts.reduce((s, a) => s + a.current_balance, 0);
  const available = accounts.reduce((s, a) => s + a.available_balance, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Contas Bancárias</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Gestão de todas as suas contas</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Saldo Total", value: formatCurrency(total), color: "text-neutral-900" },
            { label: "Comprometido", value: formatCurrency(accounts.reduce((s, a) => s + a.committed_balance, 0)), color: "text-warning-700" },
            { label: "Disponível Real", value: formatCurrency(available), color: "text-success-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-5">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
              <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Accounts list */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : !accounts.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Landmark className="w-12 h-12 text-neutral-300 mb-3" />
              <p className="text-neutral-500">Nenhuma conta registada</p>
              <button onClick={openCreate} className="btn-primary mt-4 text-sm">Adicionar primeira conta</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  {["Conta", "Banco", "Tipo", "Saldo Actual", "Comprometido", "Disponível", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{acc.name}</td>
                    <td className="px-4 py-3 text-neutral-600">{acc.bank_name}</td>
                    <td className="px-4 py-3 text-neutral-500">{ACCOUNT_TYPE_LABELS[acc.account_type]}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(acc.current_balance)}</td>
                    <td className="px-4 py-3 font-mono text-warning-700">{formatCurrency(acc.committed_balance)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-success-700">{formatCurrency(acc.available_balance)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(acc)} className="text-neutral-400 hover:text-primary-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-neutral-800">{editing ? "Editar Conta" : "Nova Conta"}</h2>
              <button onClick={closeModal}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome da conta</label>
                  <input className={`input ${errors.name ? "border-danger-500" : ""}`} {...register("name")} />
                  {errors.name && <p className="text-xs text-danger-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">Banco</label>
                  <select className="input" {...register("bank_name")}>
                    {DEFAULT_BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Tipo de conta</label>
                <select className="input" {...register("account_type")}>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Saldo actual (AOA)</label>
                  <input type="number" step="0.01" className="input" {...register("current_balance")} />
                </div>
                <div>
                  <label className="label">Saldo mínimo (AOA)</label>
                  <input type="number" step="0.01" className="input" {...register("minimum_balance")} />
                </div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input resize-none" rows={2} {...register("notes")} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "A guardar..." : (editing ? "Actualizar" : "Criar")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
