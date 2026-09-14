"use client";

import { useEffect } from "react";

export function AuthPresence() {
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") void fetch("/api/auth/presence", { method: "POST", cache: "no-store", keepalive: true });
    };
    update();
    const interval = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, []);
  return null;
}

