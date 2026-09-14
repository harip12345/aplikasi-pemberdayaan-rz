"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { createFirebaseBrowserAuth } from "@/lib/firebase/client";

export function PasswordFlow() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    try {
      const auth = await createFirebaseBrowserAuth();
      await sendPasswordResetEmail(auth, email.trim(), { url: `${window.location.origin}/auth/sign-in?reset=1` });
      setMessage("Tautan pemulihan telah dikirim. Silakan periksa email Anda."); setSuccess(true); setBusy(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Permintaan tidak dapat diproses."); setBusy(false);
    }
  }

  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#fff1e6,#f8fafc_60%)] px-4"><div className="w-full max-w-md rounded-[28px] border border-white bg-white p-7 shadow-[0_24px_70px_rgba(30,41,59,0.14)] sm:p-9"><Image src="/logo-rz.png" alt="Rumah Zakat" width={112} height={38} className="h-auto w-28 object-contain" /><h1 className="mt-8 text-2xl font-bold text-[#172436]">Lupa password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Masukkan email akun. Kami akan mengirimkan tautan pemulihan password.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="relative block"><Mail size={17} className="absolute left-4 top-4 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" className="h-12 w-full rounded-xl border border-slate-200 pl-11 pr-4 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>{message && <div className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message}</div>}<button disabled={busy} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#D84315] to-[#F2662F] text-sm font-bold text-white disabled:opacity-60">{busy ? "Memproses…" : "Kirim tautan pemulihan"}</button></form><a href="/auth/sign-in" className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-[#D84315]"><ArrowLeft size={14} /> Kembali ke halaman masuk</a></div></div>;
}
