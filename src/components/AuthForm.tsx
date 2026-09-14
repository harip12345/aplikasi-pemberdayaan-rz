"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, Bot, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { createFirebaseBrowserAuth } from "@/lib/firebase/client";

type Mode = "sign-in" | "sign-up";
const INTERNAL_EMAIL_DOMAIN = "rumahzakat.org";

function authError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const code = "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk.",
    "auth/invalid-credential": "Email atau password tidak sesuai.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/popup-closed-by-user": "Jendela Login Google ditutup sebelum proses selesai.",
    "auth/popup-blocked": "Browser memblokir jendela Login Google. Izinkan pop-up lalu coba kembali.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Silakan tunggu dan coba kembali.",
    "auth/weak-password": "Password belum memenuhi ketentuan keamanan.",
  };
  return messages[code] ?? error.message ?? fallback;
}

function GoogleMark() {
  return <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-black shadow-sm"><span className="bg-gradient-to-br from-blue-600 via-red-500 to-green-500 bg-clip-text text-transparent">G</span></span>;
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [purpose, setPurpose] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(searchParams.get("error") ?? "");
  const [success, setSuccess] = useState(false);
  const internal = useMemo(() => email.trim().toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`), [email]);
  const requestedNext = searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  async function establishSession(idToken: string) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) throw new Error("Layanan login server belum tersedia. Silakan coba kembali setelah deployment selesai.");
    const payload = await response.json() as { message?: string; status?: string };
    if (!response.ok) throw new Error(payload.message || "Sesi login tidak dapat dibuat.");
    return payload.status;
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const auth = await createFirebaseBrowserAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user, { url: `${window.location.origin}/auth/sign-in?verified=1` });
        await signOut(auth);
        throw new Error("Email belum diverifikasi. Tautan konfirmasi baru telah dikirim.");
      }
      const status = await establishSession(await credential.user.getIdToken(true));
      await signOut(auth);
      window.location.assign(status === "pending" ? "/auth/pending" : status === "approved" ? safeNext : "/auth/access-denied");
    } catch (error) {
      setMessage(authError(error, "Login tidak berhasil."));
      setBusy(false);
    }
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    setMessage(""); setSuccess(false);
    if (password.length < 8) return setMessage("Password minimal 8 karakter."), undefined;
    if (password !== confirmPassword) return setMessage("Konfirmasi password belum sama."), undefined;
    if (!internal && (!organization.trim() || !purpose.trim())) return setMessage("Instansi dan tujuan akses wajib diisi untuk akun eksternal."), undefined;
    setBusy(true);
    try {
      const auth = await createFirebaseBrowserAuth();
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      const idToken = await credential.user.getIdToken(true);
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, fullName: fullName.trim(), organization: organization.trim(), purpose: purpose.trim() }),
      });
      if (!(registerResponse.headers.get("content-type") ?? "").includes("application/json")) throw new Error("Layanan pendaftaran server belum tersedia.");
      const registerPayload = await registerResponse.json() as { message?: string };
      if (!registerResponse.ok) throw new Error(registerPayload.message || "Profil pengguna tidak dapat dibuat.");
      await sendEmailVerification(credential.user, { url: `${window.location.origin}/auth/sign-in?verified=1` });
      await signOut(auth);
      setSuccess(true);
      setMessage("Akun berhasil dibuat. Periksa email untuk menyelesaikan verifikasi.");
      setBusy(false);
    } catch (error) {
      setMessage(authError(error, "Pendaftaran tidak berhasil."));
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const auth = await createFirebaseBrowserAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const status = await establishSession(await credential.user.getIdToken(true));
      await signOut(auth);
      window.location.assign(status === "pending" ? "/auth/pending" : status === "approved" ? safeNext : "/auth/access-denied");
    } catch (error) {
      setMessage(authError(error, "Login Google tidak berhasil."));
      setBusy(false);
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode); setMessage(""); setSuccess(false); setPassword(""); setConfirmPassword("");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff1e6_0,#fffaf6_38%,#f8fafc_100%)] px-4 py-5 sm:px-6 lg:py-10">
      <header className="mx-auto mb-6 flex max-w-[1220px] items-center gap-3">
        <span className="flex h-14 w-32 items-center justify-center rounded-2xl bg-white px-4 shadow-sm ring-1 ring-orange-100"><Image src="/logo-rz.png" alt="Rumah Zakat" width={100} height={34} className="h-auto w-full object-contain" priority /></span>
        <div><p className="text-lg font-bold text-[#172436]">Laporan Pemberdayaan</p><p className="text-sm font-medium text-slate-500">Rumah Zakat</p></div>
      </header>

      <div className="mx-auto grid max-w-[1220px] overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_30px_80px_rgba(30,41,59,0.14)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#122033] via-[#1E3048] to-[#2D4057] p-7 text-white sm:p-10 lg:p-12">
          <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[#F2662F]/25 blur-3xl" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-300"><span className="h-1.5 w-7 rounded-full bg-[#F2662F]" /> Portal Data Internal</p>
            <h1 className="mt-7 max-w-md text-4xl font-bold leading-tight sm:text-5xl">Data program, lebih mudah ditelusuri.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">Akses laporan pemberdayaan, peserta program, Desa Berdaya, dan dampak program dalam satu ruang kerja.</p>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: BarChart3, title: "Data terpusat", text: "Informasi program tersedia dalam satu sistem." },
                { icon: ShieldCheck, title: "Akses terlindungi", text: "Kontrol akses internal dan persetujuan eksternal." },
                { icon: Users, title: "Rujukan terverifikasi", text: "Data dapat ditelusuri kembali ke sumbernya." },
                { icon: Bot, title: "AI Asisten Data Program", text: "Temukan data dan insight program lebih cepat." },
              ].map(({ icon: Icon, title, text }, index) => <div key={title} className="flex gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${index === 1 ? "bg-white/12 text-white" : "bg-[#F2662F] text-white"}`}><Icon size={20} /></span><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-300">{text}</p></div></div>)}
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            <div className="flex rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Pilih login atau daftar">
              <button type="button" onClick={() => switchMode("sign-in")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === "sign-in" ? "bg-white text-[#D84315] shadow-sm" : "text-slate-500"}`}>Masuk</button>
              <button type="button" onClick={() => switchMode("sign-up")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === "sign-up" ? "bg-white text-[#D84315] shadow-sm" : "text-slate-500"}`}>Daftar</button>
            </div>
            <h2 className="mt-7 text-3xl font-bold text-[#172436]">{mode === "sign-in" ? "Selamat datang" : "Buat akun"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{mode === "sign-in" ? "Masuk untuk mengakses Dashboard Pemberdayaan Rumah Zakat." : "Akun internal aktif otomatis. Akun eksternal akan ditinjau oleh admin."}</p>

            <form onSubmit={mode === "sign-in" ? signIn : signUp} className="mt-6 space-y-3.5">
              {mode === "sign-up" && <label className="block"><span className="sr-only">Nama lengkap</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nama lengkap" autoComplete="name" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>}
              <label className="relative block"><Mail size={17} className="absolute left-4 top-4 text-slate-400" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" className="h-12 w-full rounded-xl border border-slate-200 pl-11 pr-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
              <label className="relative block"><LockKeyhole size={17} className="absolute left-4 top-4 text-slate-400" /><input required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className="h-12 w-full rounded-xl border border-slate-200 pl-11 pr-11 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></label>
              {mode === "sign-in" && <div className="text-right"><a href="/auth/forgot-password" className="text-xs font-semibold text-[#D84315] hover:underline">Lupa password?</a></div>}
              {mode === "sign-up" && <label className="block"><span className="sr-only">Konfirmasi password</span><input required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Konfirmasi password" autoComplete="new-password" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>}
              {mode === "sign-up" && email && !internal && <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><UserPlus size={15} /> Permohonan akses eksternal</p><input required value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Instansi/organisasi" className="h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-orange-400" /><textarea required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Tujuan akses" rows={2} className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400" /></div>}
              {message && <div className={`rounded-xl border px-3 py-2.5 text-xs leading-5 ${success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message}</div>}
              <button disabled={busy} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#D84315] to-[#F2662F] text-sm font-bold text-white shadow-lg shadow-orange-900/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy ? "Memproses…" : mode === "sign-in" ? "Masuk" : internal ? "Daftar akun internal" : "Kirim permohonan"}</button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /> atau <span className="h-px flex-1 bg-slate-200" /></div>
            <button type="button" disabled={busy} onClick={() => void signInWithGoogle()} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-[#172436] transition hover:border-orange-200 hover:bg-orange-50/40 disabled:opacity-60"><GoogleMark /> Lanjutkan dengan Google</button>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"><div className="flex gap-3"><Sparkles size={18} className="mt-0.5 shrink-0 text-emerald-600" /><div><p className="text-xs font-bold text-emerald-800">Akun internal</p><p className="mt-0.5 text-xs leading-5 text-emerald-700">Email @{INTERNAL_EMAIL_DOMAIN} dapat langsung masuk.</p></div></div></div>
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Dengan melanjutkan, Anda menyetujui kebijakan akses dan keamanan data.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
