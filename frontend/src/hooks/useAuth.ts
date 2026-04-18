"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (email, password, mfaCode) => {
        const { data } = await api.post("/auth/login", {
          email,
          password,
          mfa_code: mfaCode ?? null,
        });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        set({
          user: { id: data.user_id, email: data.email, full_name: data.full_name, is_active: true, mfa_enabled: false },
          isAuthenticated: true,
        });
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {
          // ignore errors on logout
        } finally {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          set({ user: null, isAuthenticated: false });
        }
      },

      loadUser: async () => {
        try {
          const { data } = await api.get<User>("/auth/me");
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    { name: "auth-storage", partialize: (s) => ({ isAuthenticated: s.isAuthenticated, user: s.user }) }
  )
);
