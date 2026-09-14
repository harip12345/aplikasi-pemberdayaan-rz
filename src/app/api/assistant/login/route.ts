import { NextResponse } from "next/server";
import { codexAppServer } from "@/lib/codex-app-server";
import { isCodexAuthPersistenceConfigured } from "@/lib/codex-auth-storage";
import { configuredAiProvider } from "@/lib/ai-providers";
import { getCurrentAdminSession, isSameOriginRequest } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  if (!await getCurrentAdminSession()) return NextResponse.json({ message: "Login ChatGPT hanya dapat dijalankan oleh admin aplikasi." }, { status: 403 });
  if (configuredAiProvider() !== "codex") return NextResponse.json({ message: "Provider AI aktif bukan Codex." }, { status: 409 });
  if (!isCodexAuthPersistenceConfigured()) {
    return NextResponse.json({ message: "Private Blob atau kunci enkripsi autentikasi belum dikonfigurasi." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (value: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      try {
        const login = await codexAppServer.startDeviceLogin();
        emit({ type: "code", verificationUrl: login.verificationUrl, userCode: login.userCode });
        const account = await codexAppServer.waitForDeviceLogin(login.loginId);
        emit({ type: "complete", connected: true, planType: account.planType, email: account.email });
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : "Login ChatGPT tidak berhasil." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
