import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { configuredAiProvider } from "@/lib/ai-providers";
import { codexAppServer } from "@/lib/codex-app-server";
import { inspectCodexAuthPersistence, isCodexAuthPersistenceConfigured } from "@/lib/codex-auth-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim() ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ message: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ message: "Akses refresh tidak valid." }, { status: 401 });
  if (configuredAiProvider() !== "codex") return NextResponse.json({ skipped: true, reason: "Provider aktif bukan Codex." });
  if (!isCodexAuthPersistenceConfigured()) {
    return NextResponse.json({ message: "Private Blob atau kunci enkripsi autentikasi belum dikonfigurasi." }, { status: 503 });
  }

  const before = await inspectCodexAuthPersistence();
  if (before.storageError) return NextResponse.json({ message: "Private Blob autentikasi Codex tidak dapat dibaca." }, { status: 503 });
  if (!before.stored) return NextResponse.json({ message: "Sesi Codex belum tersedia di Private Blob." }, { status: 409 });

  const account = await codexAppServer.refreshAuthenticationIfNeeded(false);
  const after = await inspectCodexAuthPersistence();
  return NextResponse.json({
    connected: account.connected,
    refreshed: account.refreshed,
    planType: account.planType,
    lastRefreshAt: after.lastRefreshAt,
    accessTokenExpiresAt: after.accessTokenExpiresAt,
  }, {
    status: account.connected ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
