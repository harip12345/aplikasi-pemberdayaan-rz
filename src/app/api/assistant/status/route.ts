import { NextResponse } from "next/server";
import { codexAppServer } from "@/lib/codex-app-server";
import { aiProviderLabel, configuredAiProvider, configuredCodexModel, resolveHttpAiProvider } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  try {
    const provider = configuredAiProvider();
    if (provider === "codex") {
      const account = await codexAppServer.accountStatus();
      return NextResponse.json({
        provider,
        label: aiProviderLabel(provider),
        model: configuredCodexModel(),
        connected: account.connected,
        planType: account.planType,
        message: account.connected
          ? "Terhubung melalui workspace ChatGPT."
          : process.env.NODE_ENV === "production"
            ? "CODEX_ACCESS_TOKEN belum valid atau Codex CLI tidak dapat dijalankan."
            : "Jalankan codex login atau isi CODEX_ACCESS_TOKEN pada server.",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const resolved = resolveHttpAiProvider();
    return NextResponse.json({ provider, label: resolved.label, model: resolved.model, connected: true, planType: null, message: "Provider dikonfigurasi melalui environment server." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ connected: false, message: error instanceof Error ? error.message : "Status provider AI tidak dapat dibaca." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
