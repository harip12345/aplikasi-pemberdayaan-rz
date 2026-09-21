"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageLoadingState } from "@/components/PageLoadingState";
import { fetchCachedJson } from "@/lib/client-data-cache";

const routeData = new Map<string, [string, string]>([
  ["/", ["dashboard-sheet-production-v2", "/api/dashboard"]],
  ["/dampak-program", ["dashboard-sheet-production-v2", "/api/dashboard"]],
  ["/ikhtisar-pp-plp", ["participants-sheet-v1", "/api/participants"]],
  ["/peta-sebaran", ["distribution-sheet-production-v4", "/api/distribution"]],
  ["/bummas", ["metric-detail-bummas-production-v3", "/api/metric-details/bummas"]],
  ["/garis-kemiskinan", ["metric-detail-garis-kemiskinan-production-v3", "/api/metric-details/garis-kemiskinan"]],
  ["/mualaf", ["metric-detail-mualaf-production-v3", "/api/metric-details/mualaf"]],
  ["/munfik", ["metric-detail-munfik-production-v3", "/api/metric-details/munfik"]],
  ["/muzzaki", ["metric-detail-muzzaki-production-v3", "/api/metric-details/muzzaki"]],
  ["/pp-terbina", ["metric-detail-pp-terbina-production-v3", "/api/metric-details/pp-terbina"]],
]);

function linkedUrl(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest("a") : null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin ? url : null;
}

function warmRoute(pathname: string) {
  const source = routeData.get(pathname);
  if (source) void fetchCachedJson<unknown>(source[0], source[1]).catch(() => undefined);
}

function internalDestination(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return null;
  const target = event.target instanceof Element ? event.target.closest("a") : null;
  const url = linkedUrl(event.target);
  if (!target || !url || (url.pathname === window.location.pathname && url.search === window.location.search)) return null;
  return target.getAttribute("data-page-label") || target.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || "halaman";
}

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ destination: string; fromPath: string } | null>(null);
  const destination = pending?.fromPath === pathname ? pending.destination : null;

  useEffect(() => {
    const handleNavigation = (event: MouseEvent) => {
      const label = internalDestination(event);
      if (label) {
        const url = linkedUrl(event.target);
        if (url) warmRoute(url.pathname);
        setPending({ destination: label, fromPath: window.location.pathname });
      }
    };
    const handleIntent = (event: Event) => {
      const url = linkedUrl(event.target);
      if (url && url.pathname !== window.location.pathname) warmRoute(url.pathname);
    };
    document.addEventListener("click", handleNavigation, true);
    document.addEventListener("pointerover", handleIntent, true);
    document.addEventListener("focusin", handleIntent, true);
    return () => {
      document.removeEventListener("click", handleNavigation, true);
      document.removeEventListener("pointerover", handleIntent, true);
      document.removeEventListener("focusin", handleIntent, true);
    };
  }, []);

  useEffect(() => {
    if (!destination) return;
    const timeout = window.setTimeout(() => setPending(null), 15_000);
    return () => window.clearTimeout(timeout);
  }, [destination]);

  return (
    <>
      {children}
      {destination && <div className="fixed inset-x-0 bottom-0 top-[72px] z-[45] overflow-y-auto bg-[#f7f3ef] px-4 py-6 xl:px-8 xl:py-8"><div className="mx-auto w-full max-w-[1376px]"><PageLoadingState destination={destination} /></div></div>}
    </>
  );
}
