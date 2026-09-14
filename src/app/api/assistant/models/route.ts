import { NextResponse } from "next/server";
import { configuredAiProvider, providerEndpoint, providerHeaders, resolveHttpAiProvider } from "@/lib/ai-providers";
import { approvedApiGuard } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await approvedApiGuard(); if (denied) return denied;
  try {
    if (configuredAiProvider() === "codex") return NextResponse.json({ provider: "Codex · ChatGPT Subscription", models: [] }, { headers: { "Cache-Control": "no-store" } });
    const provider = resolveHttpAiProvider();
    const response = await fetch(providerEndpoint(provider, "models"), { headers: providerHeaders(provider), cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { data?: Array<{ id?: string }>; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `${provider.label} merespons dengan status ${response.status}.`);
    const models = (payload.data ?? []).flatMap((item) => typeof item.id === "string" ? [item.id] : []).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ provider: provider.label, models }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Daftar model tidak dapat dimuat." }, { status: 502 });
  }
}
