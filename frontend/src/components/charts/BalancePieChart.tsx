"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { AccountLiquidity } from "@/types";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

interface Props {
  accounts: AccountLiquidity[];
}

export function BalancePieChart({ accounts }: Props) {
  const data = accounts
    .filter((a) => a.current_balance > 0)
    .map((a, i) => ({
      name: `${a.account_name} (${a.bank_name})`,
      value: a.current_balance,
      color: COLORS[i % COLORS.length],
    }));

  if (!data.length) return <p className="text-sm text-neutral-400 text-center py-8">Sem dados</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
          {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
