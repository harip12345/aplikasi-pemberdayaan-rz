"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { CheckCircle2, LoaderCircle, LockKeyhole, ShieldX } from "lucide-react";
import { createFirebaseBrowserAuth } from "@/lib/firebase/client";

type ActionState = "loading" | "reset" | "success" | "error";

export function FirebaseEmailAction() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode") ?? "";
  const [state, setState] = useState<ActionState>("loading");
  const [message, setMessage] = useState("Memverifikasi tautan keamanan…");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function processAction() {
      if (!oobCode || (mode !== "verifyEmail" && mode !== "resetPassword")) {
        if (active) { setState("error"); setMessage("Tautan tidak lengkap atau tidak dikenali."); }
        return;
      }
      try {
        const auth = await createFirebaseBrowserAuth();
        if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          if (active) { setState("success"); setMessage("Email berhasil diverifikasi. Anda sekarang dapat masuk."); }
        } else {
          await verifyPasswordResetCode(auth, oobCode);
          if (active) { setState("reset"); setMessage(""); }
        }
      } catch {
        if (active) { setState("error"); setMessage("Tautan sudah kedaluwarsa atau telah digunakan."); }
      }
    }
    void processAction();
    return () => { active = false; };
  }, [mode, oobCode]);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (password.length < 8) return setMessage("Password minimal 8 karakter."), undefined;
    if (password !== confirmation) return setMessage("Konfirmasi password belum sama."), undefined;
    setBusy(true);
    try {
      const auth = await createFirebaseBrowserAuth();
      await confirmPasswordReset(auth, oobCode, password);
      setState("success"); setMessage("Password berhasil diperbarui. Silakan masuk dengan password baru.");
    } catch {
      setMessage("Password tidak dapat diperbarui. Minta tautan pemulihan baru.");
    } finally { setBusy(false); }
  }

  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#fff1e6,#f8fafc_60%)] px-4"><div className="w-full max-w-md rounded-[28px] border border-white bg-white p-8 text-center shadow-[0_24px_70px_rgba(30,41,59,0.14)]"><Image src="/logo-rz.png" alt="Rumah Zakat" width={112} height={38} className="mx-auto h-auto w-28 object-contain" />{state === "loading" && <><LoaderCircle size={38} className="mx-auto mt-8 animate-spin text-[#F2662F]" /><h1 className="mt-5 text-xl font-bold text-[#172436]">Memproses tautan</h1></>}{state === "error" && <><ShieldX size={42} className="mx-auto mt-8 text-red-500" /><h1 className="mt-5 text-xl font-bold text-[#172436]">Tautan tidak berlaku</h1></>}{state === "success" && <><CheckCircle2 size={42} className="mx-auto mt-8 text-emerald-500" /><h1 className="mt-5 text-xl font-bold text-[#172436]">Proses berhasil</h1></>}{state === "reset" && <><LockKeyhole size={42} className="mx-auto mt-8 text-[#F2662F]" /><h1 className="mt-5 text-xl font-bold text-[#172436]">Buat password baru</h1><p className="mt-2 text-sm text-slate-500">Gunakan minimal delapan karakter.</p><form onSubmit={savePassword} className="mt-6 space-y-3 text-left"><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /><input required type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Konfirmasi password baru" className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />{message && <p className="text-xs text-red-600">{message}</p>}<button disabled={busy} className="h-12 w-full rounded-xl bg-gradient-to-r from-[#D84315] to-[#F2662F] text-sm font-bold text-white disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan password baru"}</button></form></>}{state !== "reset" && <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{message}</p>}{state !== "loading" && <Link href="/auth/sign-in" className="mt-7 inline-flex rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:border-orange-200 hover:bg-orange-50">Kembali ke halaman masuk</Link>}</div></div>;
}
