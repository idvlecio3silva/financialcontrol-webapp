"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
        mutations: { retry: 0 },
      },
    })
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: "14px", maxWidth: "400px" },
          success: { style: { background: "#f0fdf4", border: "1px solid #86efac", color: "#166534" } },
          error: { style: { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b" } },
        }}
      />
    </QueryClientProvider>
  );
}
