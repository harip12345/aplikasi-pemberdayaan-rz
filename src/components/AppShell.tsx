"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AuthPresence } from "@/components/AuthPresence";
import { AuthGate } from "@/components/AuthGate";
import { RouteTransition } from "@/components/RouteTransition";
import { SmartAssistant } from "@/components/SmartAssistant";
import { TopBar } from "@/components/TopBar";
import { ReportingPeriodProvider } from "@/components/ReportingPeriodContext";
import { AssistantViewProvider } from "@/components/AssistantViewContext";
import { AssistantActionProvider } from "@/components/AssistantActionContext";
import { Bot } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [assistantOpen, setAssistantOpen] = useState(false);
  if (pathname.startsWith("/auth/")) return <>{children}</>;
  return <ReportingPeriodProvider><AssistantViewProvider><AssistantActionProvider>
    <AuthGate />
    <TopBar onAssistantClose={() => setAssistantOpen(false)} assistantOpen={assistantOpen} />
    <div className="flex min-w-0 flex-1 items-start">
      <main id="app-main-content" className={`min-w-0 flex-1 overflow-x-auto ${assistantOpen ? "hidden lg:block" : "block"}`}>
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 xl:px-8 xl:py-8"><RouteTransition>{children}</RouteTransition></div>
      </main>
      <aside className={`${assistantOpen ? "block" : "hidden"} sticky top-[72px] h-[calc(100dvh-72px)] w-full shrink-0 border-l border-slate-200 bg-white lg:w-[370px] xl:w-[400px]`} aria-label="Panel Asisten Data Program RZ"><SmartAssistant isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} /></aside>
    </div>
    <footer className={`border-t border-slate-200/80 bg-white/70 px-4 py-5 text-center text-xs text-slate-500 backdrop-blur-sm ${assistantOpen ? "hidden lg:block" : ""}`}>Copyright © 2026 Rumah Zakat — Program Data Optimization Department. All rights reserved.</footer>
    {!assistantOpen && <button type="button" onClick={() => setAssistantOpen(true)} aria-label="Buka Asisten Data Program RZ" title="Buka Asisten AI" className="fixed bottom-6 right-6 z-[60] inline-flex items-center gap-2 rounded-2xl bg-[#E65100] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_32px_rgba(190,54,12,0.35)] ring-1 ring-white/30 transition hover:-translate-y-1 hover:bg-[#D84315] hover:shadow-[0_16px_36px_rgba(190,54,12,0.42)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200" style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))", right: "max(1.5rem, env(safe-area-inset-right))" }}><Bot size={20} aria-hidden="true" /><span>Asisten AI</span></button>}
    <AuthPresence />
  </AssistantActionProvider></AssistantViewProvider></ReportingPeriodProvider>;
}
