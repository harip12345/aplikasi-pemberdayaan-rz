"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { readUserMenuProfile, writeUserMenuProfile, type UserMenuProfile } from "@/lib/user-menu-cache";

export function UserMenu() {
  const [user, setUser] = useState<UserMenuProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setUser(readUserMenuProfile()); });
    void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401 && active) { writeUserMenuProfile(null); setUser(null); }
        return;
      }
      const payload = await response.json() as { user?: UserMenuProfile };
      if (active && payload.user) { writeUserMenuProfile(payload.user); setUser(payload.user); }
    }).catch(() => undefined);
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => { active = false; document.removeEventListener("mousedown", close); };
  }, []);

  if (!user) return <span className="ml-auto h-10 w-10 shrink-0 rounded-full bg-white/15 lg:ml-1" aria-hidden="true" />;
  const initial = (user.fullName.trim()[0] || user.email.trim()[0] || "").toLocaleUpperCase("id-ID");

  return <div ref={rootRef} className="relative ml-auto shrink-0 lg:ml-1"><button type="button" onClick={() => setOpen((current) => !current)} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-[#C83A0A] text-base font-bold text-white ring-2 ring-white/70 transition hover:ring-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label={`Akun ${user.fullName}`} aria-expanded={open}>{user.avatarUrl && user.avatarUrl !== failedAvatarUrl ? <Image src={user.avatarUrl} alt="" width={40} height={40} unoptimized className="h-full w-full rounded-full object-cover" onError={() => setFailedAvatarUrl(user.avatarUrl)} /> : initial || <UserRound size={18} />}</button>{open && <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl"><div className="px-3 py-2"><p className="truncate text-sm font-bold text-[#172436]">{user.fullName}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div>{user.role === "admin" && <Link href="/admin/pengguna" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-orange-50 hover:text-[#D84315]"><ShieldCheck size={16} /> Kelola akses pengguna</Link>}<form action="/api/auth/sign-out" method="post" onSubmit={() => writeUserMenuProfile(null)}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-red-50 hover:text-red-600"><LogOut size={16} /> Keluar</button></form></div>}</div>;
}
