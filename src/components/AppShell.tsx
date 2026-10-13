"use client";

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
  if (pathname.startsWith("/auth/")) return <>{children}</>;
  return <ReportingPeriodProvider><AssistantViewProvider><AssistantActionProvider>
    <AuthGate />
    <TopBar />
    <main id="app-main-content" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 xl:px-8 xl:py-8"><RouteTransition>{children}</RouteTransition></main>
    <footer className="border-t border-slate-200/80 bg-white/70 px-4 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">Copyright © 2026 Rumah Zakat — Program Data Optimization Department. All rights reserved.</footer>
    <SmartAssistant />
    <AuthPresence />
  </AssistantActionProvider></AssistantViewProvider></ReportingPeriodProvider>;
}
