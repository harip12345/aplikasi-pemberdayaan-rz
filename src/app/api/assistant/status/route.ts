import { NextResponse } from "next/server";
import { codexAppServer } from "@/lib/codex-app-server";
import { aiProviderLabel, configuredAiProvider, resolveHttpAiProvider } from "@/lib/ai-providers";
import { inspectCodexAuthPersistence, isCodexAuthPersistenceConfigured } from "@/lib/codex-auth-storage";
import { isAdminEmail } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Silakan masuk untuk mengakses layanan ini." }, { status: 401 });
  if (session.profile.status !== "approved") return NextResponse.json({ message: "Akses akun belum aktif." }, { status: 403 });
  try {
    const provider = configuredAiProvider();
    if (provider === "codex") {
      const account = await codexAppServer.accountStatus();
      const persistence = await inspectCodexAuthPersistence();
      const admin = session.profile.role === "admin" || isAdminEmail(session.profile.email);
      const loginAvailable = admin && !process.env.CODEX_ACCESS_TOKEN?.trim() && isCodexAuthPersistenceConfigured();
      const disconnectedMessage = persistence.storageError
        ? "Private Blob autentikasi Codex tidak dapat dibaca. Periksa koneksi Blob dan environment production."
        : !persistence.stored
          ? "Sesi Codex belum tersimpan di Private Blob. Admin perlu menghubungkan ChatGPT Business satu kali."
          : "Sesi Codex tersimpan, tetapi token tidak lagi valid. Admin perlu menghubungkan ulang ChatGPT Business.";
      return NextResponse.json({
        provider,
        label: aiProviderLabel(provider),
        connected: account.connected,
        loginAvailable,
        canManageLogin: admin,
        planType: account.planType,
        message: account.connected
          ? "Terhubung melalui workspace ChatGPT. Sesi login tersimpan terenkripsi."
          : isCodexAuthPersistenceConfigured()
            ? disconnectedMessage
            : process.env.NODE_ENV === "production"
              ? "Penyimpanan login Codex belum dikonfigurasi."
              : "Jalankan codex login atau isi CODEX_ACCESS_TOKEN pada server.",
        ...(admin ? { authPersistence: persistence } : {}),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const resolved = resolveHttpAiProvider();
    return NextResponse.json({ provider, label: resolved.label, connected: true, planType: null, message: "Provider dikonfigurasi melalui environment server." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ connected: false, message: error instanceof Error ? error.message : "Status provider AI tidak dapat dibaca." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
