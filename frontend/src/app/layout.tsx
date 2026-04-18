import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FinancialControl — Controlo Financeiro Pessoal",
  description: "Sistema pessoal de gestão financeira com controlo de liquidez, planeamento e investimento disciplinado.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head>
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
