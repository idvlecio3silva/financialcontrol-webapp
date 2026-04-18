"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Landmark, TrendingUp, TrendingDown, AlertCircle,
  PiggyBank, LineChart, CreditCard, BarChart3, Calendar, BookOpen, LogOut
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/accounts",     label: "Contas",           icon: Landmark },
  { href: "/income",       label: "Receitas",         icon: TrendingUp },
  { href: "/expenses",     label: "Despesas",         icon: TrendingDown },
  { href: "/liabilities",  label: "Responsabilidades",icon: AlertCircle },
  { href: "/budget",       label: "Orçamento",        icon: BookOpen },
  { href: "/cashflow",     label: "Fluxo de Caixa",   icon: Calendar },
  { href: "/savings",      label: "Poupança",         icon: PiggyBank },
  { href: "/investments",  label: "Investimentos",    icon: LineChart },
  { href: "/debts",        label: "Dívidas",          icon: CreditCard },
  { href: "/reports",      label: "Relatórios",       icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    toast.success("Sessão terminada");
    router.push("/auth/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-neutral-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-neutral-700">
        <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-sm">FinancialControl</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary-600 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-neutral-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-neutral-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.full_name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.full_name ?? "Utilizador"}</p>
            <p className="text-neutral-400 text-xs truncate">{user?.email ?? ""}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-neutral-400 hover:text-danger-400 hover:bg-neutral-800 rounded-lg text-sm transition-colors">
          <LogOut className="w-4 h-4" />
          Terminar sessão
        </button>
      </div>
    </aside>
  );
}
