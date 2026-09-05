import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SmartAssistant } from "@/components/SmartAssistant";
import { RouteTransition } from "@/components/RouteTransition";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laporan Pemberdayaan Rumah Zakat",
  description: "Dashboard Laporan Pemberdayaan Rumah Zakat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-cover bg-fixed" suppressHydrationWarning>
        <TopBar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 xl:px-8 xl:py-8">
          <RouteTransition>{children}</RouteTransition>
        </main>
        <footer className="border-t border-slate-200/80 bg-white/70 px-4 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
          Copyright © 2026 Rumah Zakat — Program Data Optimization Department. All rights reserved.
        </footer>
        <SmartAssistant />
      </body>
    </html>
  );
}
