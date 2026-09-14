"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BarChart3, Bot, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserPlus, Users } from "lucide-react";
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
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-1.99 3.02v2.54h3.23c1.89-1.74 2.98-4.3 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.36l-3.23-2.54c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.09 12c0-.67.12-1.32.31-1.94V7.44H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.56l3.33-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.44l3.33 2.62c.79-2.36 3-4.12 5.6-4.12Z" />
    </svg>
  );
}

function OnboardingBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden text-[#E85A24]">
      <div className="absolute -left-20 top-16 h-64 w-64 rounded-full bg-orange-200/25 blur-sm" />
      <div className="absolute -right-24 bottom-[-5rem] h-80 w-80 rounded-full bg-orange-100/60" />
      <div className="absolute left-[3%] top-[31%] hidden max-w-[180px] -rotate-6 font-serif text-lg italic leading-6 opacity-[0.16] xl:block">Kolaborasi untuk masyarakat yang lebih berdaya</div>
      <div className="absolute bottom-[10%] left-[3%] hidden max-w-[170px] -rotate-3 font-serif text-lg italic leading-6 opacity-[0.15] xl:block">Berdaya bersama untuk Indonesia</div>
      <div className="absolute right-[3%] top-[20%] hidden max-w-[155px] rotate-3 font-serif text-lg italic leading-6 opacity-[0.15] xl:block">Data mendorong perubahan nyata</div>
      <div className="absolute bottom-[8%] right-[3%] hidden max-w-[165px] -rotate-6 font-serif text-lg italic leading-6 opacity-[0.15] xl:block">Dari data untuk dampak yang lebih luas</div>

      <svg viewBox="0 0 1440 900" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-[0.13]">
        <path d="M1085 90c75 10 83 82 154 95 54 10 83-34 139-13" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 9" />
        <path d="M34 410c44 26 48 89 35 151" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 9" />
        <circle cx="1115" cy="113" r="11" fill="currentColor" />
        <path d="M1098 145c2-18 10-28 17-28s15 10 17 28Z" fill="currentColor" />
        <circle cx="1250" cy="180" r="9" fill="currentColor" />
        <path d="M1235 206c2-15 8-23 15-23s13 8 15 23Z" fill="currentColor" />
        <circle cx="1360" cy="133" r="10" fill="currentColor" />
        <path d="M1344 162c2-17 9-26 16-26s14 9 16 26Z" fill="currentColor" />

        <g transform="translate(15 720)">
          <path d="M0 100 58 45l58 55v76H0Zm126 20 40-38 40 38v56h-80Z" fill="currentColor" />
          <rect x="44" y="122" width="27" height="54" rx="3" fill="#FFF9F5" />
          <rect x="153" y="137" width="20" height="39" rx="2" fill="#FFF9F5" />
          <path d="M230 176v-69m0 8c-21-5-26-22-18-36 20 3 29 17 18 36Zm0 9c20-6 28-22 20-37-20 3-29 18-20 37Z" fill="currentColor" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        </g>
        <g transform="translate(1190 706)">
          <path d="M0 104 67 43l67 61v72H0Zm146 21 38-36 38 36v51h-76Z" fill="currentColor" />
          <rect x="52" y="124" width="30" height="52" rx="3" fill="#FFF9F5" />
          <path d="M251 176v-63m0 8c-18-5-24-20-16-33 17 3 25 16 16 33Zm0 8c18-5 25-20 18-33-18 3-26 16-18 33Z" fill="currentColor" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#fff0e4_0,#fffaf7_42%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <OnboardingBackdrop />

      <div className="relative z-10 my-auto mx-auto grid w-full max-w-[1120px] overflow-hidden rounded-[30px] border border-white/90 bg-white/95 shadow-[0_30px_80px_rgba(30,41,59,0.16)] backdrop-blur-sm lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#122033] via-[#1E3048] to-[#2D4057] p-7 text-white sm:p-10 lg:p-12">
          <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-[#F2662F]/25 blur-3xl" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-300"><span className="h-1.5 w-7 rounded-full bg-[#F2662F]" /> Portal Data Internal</p>
            <h1 className="mt-7 max-w-md text-4xl font-bold leading-tight sm:text-5xl">Pusat Data Pemberdayaan Rumah Zakat</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">Akses laporan pemberdayaan, peserta program, Desa Berdaya, dan dampak program dalam satu ruang kerja.</p>
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: BarChart3, title: "Data terpusat", text: "Informasi program tersedia dalam satu sistem." },
                { icon: ShieldCheck, title: "Akses terlindungi", text: "Kontrol akses internal dan persetujuan eksternal." },
                { icon: Users, title: "Rujukan terverifikasi", text: "Data dapat ditelusuri kembali ke sumbernya." },
                { icon: Bot, title: "AI Asisten Data Program", text: "Temukan data dan insight program lebih cepat." },
              ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F2662F] text-white shadow-lg shadow-orange-950/15"><Icon size={20} /></span><div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-300">{text}</p></div></div>)}
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            <h2 className="text-3xl font-bold leading-tight text-[#172436]">{mode === "sign-in" ? "Selamat Datang, Sobat Pejuang." : "Buat Akun"}</h2>
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
            <div className="mt-5 flex rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Pilih login atau daftar">
              <button type="button" onClick={() => switchMode("sign-in")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === "sign-in" ? "bg-white text-[#D84315] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Masuk</button>
              <button type="button" onClick={() => switchMode("sign-up")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === "sign-up" ? "bg-white text-[#D84315] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Daftar</button>
            </div>
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">Dengan melanjutkan, Anda menyetujui kebijakan akses dan keamanan data.</p>
          </div>
        </section>
      </div>
      <footer className="relative z-10 mx-auto mt-5 text-center text-[11px] leading-5 text-slate-500 sm:text-xs">Copyright © 2026 Rumah Zakat — Program Data Optimization Department. All rights reserved.</footer>
    </div>
  );
}
