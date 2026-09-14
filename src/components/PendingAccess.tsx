"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Clock3, LogOut, Send } from "lucide-react";

type Profile = { full_name: string | null; email: string; organization: string | null; access_purpose: string | null; status: string; account_type: string };

export function PendingAccess() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/auth/access-request", { cache: "no-store" }).then((response) => response.json()).then(({ profile: value }) => { if (!value) return; setProfile(value); setFullName(value.full_name ?? ""); setOrganization(value.organization ?? ""); setPurpose(value.access_purpose ?? ""); }); }, 0); return () => window.clearTimeout(timer); }, []);
  const complete = Boolean(profile?.organization && profile?.access_purpose);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/access-request", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, organization, purpose }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Permohonan tidak dapat disimpan.");
      setProfile((current) => current ? { ...current, full_name: fullName, organization, access_purpose: purpose } : current); setMessage("Informasi permohonan berhasil disimpan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Permohonan tidak dapat disimpan."); }
    finally { setBusy(false); }
  }

  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#fff1e6,#f8fafc_58%)] px-4 py-8"><div className="w-full max-w-xl rounded-[28px] border border-white bg-white p-7 shadow-[0_24px_70px_rgba(30,41,59,0.14)] sm:p-9"><Image src="/logo-rz.png" alt="Rumah Zakat" width={112} height={38} className="mx-auto h-auto w-28 object-contain" /><span className="mx-auto mt-7 grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-600"><Clock3 size={30} /></span><h1 className="mt-5 text-center text-2xl font-bold text-[#172436]">Permohonan sedang ditinjau</h1><p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-500">Admin akan meninjau identitas, instansi, dan tujuan penggunaan data sebelum memberikan akses.</p>{profile && !complete && <form onSubmit={save} className="mt-7 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-800">Lengkapi permohonan akses eksternal</p><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama lengkap" className="h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-orange-400" /><input required value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Instansi/organisasi" className="h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-orange-400" /><textarea required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Tujuan akses (minimal 10 karakter)" rows={3} className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400" /><button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#D84315] text-sm font-bold text-white disabled:opacity-60"><Send size={15} /> {busy ? "Menyimpan…" : "Kirim permohonan"}</button></form>}{complete && <div className="mt-7 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center"><p className="text-xs font-bold text-emerald-800">Permohonan sudah lengkap</p><p className="mt-1 text-xs leading-5 text-emerald-700">Anda tidak perlu mengirim ulang. Silakan menunggu keputusan admin.</p></div>}{message && <p className="mt-3 text-center text-xs text-slate-500">{message}</p>}<form action="/api/auth/sign-out" method="post" className="mt-6 text-center"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50"><LogOut size={16} /> Keluar</button></form></div></div>;
}

