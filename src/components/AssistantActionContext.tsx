"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { validAssistantViewAction, type AssistantViewAction } from "@/lib/assistant-view-action";

type PendingAction = { id: number; action: AssistantViewAction };
type ActionResult = { id: number; ok: boolean; message: string };
type ActionContextValue = {
  pending: PendingAction | null;
  result: ActionResult | null;
  run: (action: AssistantViewAction) => number | null;
  complete: (id: number, error?: string) => void;
};

const ActionContext = createContext<ActionContextValue | null>(null);
let nextActionId = 0;

function highlightTarget(name: string) {
  let attempts = 0;
  const find = () => {
    const element = document.querySelector<HTMLElement>(`[data-agent-target="${name}"]`);
    if (!element && attempts++ < 25) { window.setTimeout(find, 200); return; }
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("assistant-action-highlight");
    window.setTimeout(() => element.classList.remove("assistant-action-highlight"), 4500);
  };
  window.setTimeout(find, 250);
}

export function AssistantActionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = useCallback((action: AssistantViewAction) => {
    if (!validAssistantViewAction(action)) return null;
    const id = ++nextActionId;
    setResult(null);
    setPending({ id, action });
    if (pathname !== action.target) router.push(action.target);
    return id;
  }, [pathname, router]);

  const complete = useCallback((id: number, error?: string) => {
    setPending((current) => current?.id === id ? null : current);
    setResult({ id, ok: !error, message: error || "Tampilan berhasil dibuka sesuai permintaan." });
  }, []);

  useEffect(() => {
    if (!pending || pathname !== "/dampak-program" || pathname !== pending.action.target || Object.keys(pending.action.filters ?? {}).length) return;
    const id = pending.id;
    const highlight = pending.action.highlight;
    const timer = window.setTimeout(() => {
      if (highlight) highlightTarget(highlight);
      complete(id);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [complete, pathname, pending]);

  const value = useMemo(() => ({ pending, result, run, complete }), [pending, result, run, complete]);
  return <ActionContext.Provider value={value}>{children}</ActionContext.Provider>;
}

export function useAssistantActions() {
  const context = useContext(ActionContext);
  if (!context) throw new Error("Asisten aksi harus berada di dalam AssistantActionProvider.");
  return context;
}

export function finishAssistantAction(id: number, highlight: string | undefined, complete: (id: number, error?: string) => void, error?: string) {
  if (!error && highlight) highlightTarget(highlight);
  complete(id, error);
}
