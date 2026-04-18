"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Props {
  incomeExpected: number;
  incomeReceived: number;
  expenses: number;
  liabilities: number;
}

export function IncomeExpensesBar({ incomeExpected, incomeReceived, expenses, liabilities }: Props) {
  const data = [
    { name: "Receita Prev.", value: incomeExpected, color: "#86efac" },
    { name: "Receita Real", value: incomeReceived, color: "#22c55e" },
    { name: "Despesas", value: expenses, color: "#fca5a5" },
    { name: "Obrigações", value: liabilities, color: "#ef4444" },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <rect key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
