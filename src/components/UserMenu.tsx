"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";

type CurrentUser = { email: string; fullName: string; avatarUrl: string | null; role: "admin" | "member" };

export function UserMenu() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((payload) => setUser(payload?.user ?? null)).catch(() => undefined);
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!user) return <span className="hidden h-10 w-10 rounded-2xl bg-white/10 lg:block" />;
  const initials = user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div ref={rootRef} className="relative ml-auto lg:ml-1"><button type="button" onClick={() => setOpen((current) => !current)} className="flex items-center gap-2 rounded-2xl bg-white/10 p-1.5 pr-2.5 text-white transition hover:bg-white/15" aria-expanded={open}><span className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-white font-bold text-[#D84315]">{initials || <UserRound size={16} />}</span><ChevronDown size={14} className="hidden text-white/70 sm:block" /></button>{open && <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl"><div className="px-3 py-2"><p className="truncate text-sm font-bold text-[#172436]">{user.fullName}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>{user.role === "admin" && <Link href="/admin/pengguna" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-orange-50 hover:text-[#D84315]"><ShieldCheck size={16} /> Kelola akses pengguna</Link>}<form action="/api/auth/sign-out" method="post"><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-red-50 hover:text-red-600"><LogOut size={16} /> Keluar</button></form></div>}</div>;
}
