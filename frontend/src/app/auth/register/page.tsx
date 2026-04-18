"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuthStore } from "@/hooks/useAuth";
import { TrendingUp, UserPlus } from "lucide-react";

const registerSchema = z.object({
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string()
    .min(10, "Mínimo 10 caracteres")
    .regex(/[A-Z]/, "Deve conter uma maiúscula")
    .regex(/[a-z]/, "Deve conter uma minúscula")
    .regex(/\d/, "Deve conter um número")
    .regex(/[^A-Za-z0-9]/, "Deve conter um caractere especial"),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords não coincidem",
  path: ["confirm_password"],
});
type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await api.post("/auth/register", {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      await login(data.email, data.password);
      toast.success("Conta criada com sucesso!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Erro ao criar conta");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">FinancialControl</h1>
          <p className="text-neutral-500 text-sm mt-1">Crie a sua conta</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-neutral-800 mb-6">Registar</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="full_name">Nome completo</label>
              <input id="full_name" type="text" className={`input ${errors.full_name ? "border-danger-500" : ""}`}
                placeholder="João Silva" {...register("full_name")} />
              {errors.full_name && <p className="mt-1 text-xs text-danger-600">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email"
                className={`input ${errors.email ? "border-danger-500" : ""}`}
                placeholder="email@exemplo.com" {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="new-password"
                className={`input ${errors.password ? "border-danger-500" : ""}`}
                {...register("password")} />
              {errors.password && <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>}
              <p className="mt-1 text-xs text-neutral-400">Mínimo 10 chars, maiúscula, minúscula, número e símbolo</p>
            </div>

            <div>
              <label className="label" htmlFor="confirm_password">Confirmar password</label>
              <input id="confirm_password" type="password" autoComplete="new-password"
                className={`input ${errors.confirm_password ? "border-danger-500" : ""}`}
                {...register("confirm_password")} />
              {errors.confirm_password && <p className="mt-1 text-xs text-danger-600">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={isSubmitting}>
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? "A registar..." : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-500 mt-6">
            Já tem conta?{" "}
            <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
