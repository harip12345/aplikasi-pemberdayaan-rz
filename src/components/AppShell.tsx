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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [assistantOpen, setAssistantOpen] = useState(false);
  if (pathname.startsWith("/auth/")) return <>{children}</>;
  return <ReportingPeriodProvider><AssistantViewProvider><AssistantActionProvider>
    <AuthGate />
    <TopBar onAssistantOpen={() => setAssistantOpen(true)} onAssistantClose={() => setAssistantOpen(false)} assistantOpen={assistantOpen} />
    <div className="flex min-w-0 flex-1 items-start">
      <main id="app-main-content" className={`min-w-0 flex-1 overflow-x-auto ${assistantOpen ? "hidden lg:block" : "block"}`}>
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 xl:px-8 xl:py-8"><RouteTransition>{children}</RouteTransition></div>
      </main>
      <aside className={`${assistantOpen ? "block" : "hidden"} sticky top-[72px] h-[calc(100dvh-72px)] w-full shrink-0 border-l border-slate-200 bg-white lg:w-[370px] xl:w-[400px]`} aria-label="Panel Asisten Data Program RZ"><SmartAssistant isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} /></aside>
    </div>
    <footer className={`border-t border-slate-200/80 bg-white/70 px-4 py-5 text-center text-xs text-slate-500 backdrop-blur-sm ${assistantOpen ? "hidden lg:block" : ""}`}>Copyright © 2026 Rumah Zakat — Program Data Optimization Department. All rights reserved.</footer>
    <AuthPresence />
  </AssistantActionProvider></AssistantViewProvider></ReportingPeriodProvider>;
}
