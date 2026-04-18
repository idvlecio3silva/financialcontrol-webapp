"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuthStore } from "@/hooks/useAuth";
import { TrendingUp, Eye, EyeOff, LogIn } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Password obrigatória"),
  mfa_code: z.string().optional(),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password, data.mfa_code);
      toast.success("Bem-vindo!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (msg?.includes("MFA")) {
        setRequiresMfa(true);
        toast.error("Introduza o código MFA");
      } else {
        toast.error(msg ?? "Credenciais inválidas");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">FinancialControl</h1>
          <p className="text-neutral-500 text-sm mt-1">Controlo financeiro pessoal</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">Iniciar sessão</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? "border-danger-500 focus:ring-danger-500" : ""}`}
                placeholder="email@exemplo.com"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? "border-danger-500 focus:ring-danger-500" : ""}`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>}
            </div>

            {requiresMfa && (
              <div>
                <label className="label" htmlFor="mfa_code">Código MFA (6 dígitos)</label>
                <input
                  id="mfa_code"
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  className="input"
                  placeholder="000000"
                  {...register("mfa_code")}
                />
              </div>
            )}

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={isSubmitting}>
              <LogIn className="w-4 h-4" />
              {isSubmitting ? "A entrar..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Não tem conta?{" "}
            <Link href="/auth/register" className="text-primary-600 font-medium hover:underline">
              Registar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
