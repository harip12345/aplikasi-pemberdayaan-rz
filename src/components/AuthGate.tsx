"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type AuthPayload = { user?: { role?: string; status?: string } };

export function AuthGate() {
  const pathname = usePathname();
  useEffect(() => {
    const localRequest = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (localRequest) return;
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!active) return;
      if (response.status === 401) {
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const payload = await response.json() as AuthPayload;
      if (!active) return;
      if (payload.user?.status === "pending") window.location.assign("/auth/pending");
      else if (payload.user?.status === "rejected" || payload.user?.status === "suspended") window.location.assign("/auth/access-denied");
      else if (pathname.startsWith("/admin") && payload.user?.role !== "admin") window.location.assign("/");
    }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);
  return null;
}
