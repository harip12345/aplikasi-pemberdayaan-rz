import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laporan Pemberdayaan Rumah Zakat",
  description: "Dashboard Laporan Pemberdayaan Rumah Zakat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-cover bg-fixed" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
