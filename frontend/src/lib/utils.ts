import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "AOA"): string {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  important: "Importante",
  optional: "Opcional",
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-danger-700 bg-danger-50 border-danger-200",
  important: "text-warning-700 bg-warning-50 border-warning-200",
  optional: "text-neutral-600 bg-neutral-100 border-neutral-200",
};

export const STATUS_COLORS: Record<string, string> = {
  paid: "text-success-700 bg-success-50",
  received: "text-success-700 bg-success-50",
  pending: "text-warning-700 bg-warning-50",
  overdue: "text-danger-700 bg-danger-50",
  active: "text-primary-700 bg-primary-50",
  expected: "text-primary-700 bg-primary-50",
  cancelled: "text-neutral-500 bg-neutral-100",
};
