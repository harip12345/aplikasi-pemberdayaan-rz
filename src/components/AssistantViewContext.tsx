"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { AssistantViewContextData } from "@/lib/assistant-view-context";

type RegisteredView = AssistantViewContextData & { pathname: string };
const AssistantViewContext = createContext<{
  view: RegisteredView | null;
  setView: React.Dispatch<React.SetStateAction<RegisteredView | null>>;
} | null>(null);

export function AssistantViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<RegisteredView | null>(null);
  const value = useMemo(() => ({ view, setView }), [view]);
  return <AssistantViewContext.Provider value={value}>{children}</AssistantViewContext.Provider>;
}

export function AssistantPageContext({ context }: { context: AssistantViewContextData }) {
  const pathname = usePathname();
  const registry = useContext(AssistantViewContext);
  const setView = registry?.setView;
  const serialized = JSON.stringify(context);
  useEffect(() => {
    if (!setView) return;
    const next = JSON.parse(serialized) as AssistantViewContextData;
    setView({ ...next, pathname });
    return () => setView((current) => current?.pathname === pathname ? null : current);
  }, [pathname, setView, serialized]);
  return null;
}

export function useAssistantView() {
  const pathname = usePathname();
  const registry = useContext(AssistantViewContext);
  return registry?.view?.pathname === pathname ? registry.view : null;
}
