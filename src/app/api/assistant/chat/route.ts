import { NextResponse } from "next/server";
import { runDataAssistant, type AssistantInputMessage } from "@/lib/ai-assistant";
import { approvedApiGuard } from "@/lib/firebase/auth-server";
import { validReportingPeriod, type ReportingPeriod } from "@/lib/reporting-period";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const requestBuckets = new Map<string, { count: number; resetsAt: number }>();

function withinRateLimit(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = requestBuckets.get(client);
  if (!current || current.resetsAt <= now) {
    requestBuckets.set(client, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const denied = await approvedApiGuard(); if (denied) return denied;
  try {
    if (!withinRateLimit(request)) return NextResponse.json({ message: "Terlalu banyak permintaan. Coba lagi dalam satu menit." }, { status: 429 });
    const body = await request.json() as { messages?: AssistantInputMessage[]; periodContext?: ReportingPeriod };
    if (!Array.isArray(body.messages) || body.messages.length === 0) return NextResponse.json({ message: "Pesan wajib diisi." }, { status: 400 });
    if (body.messages.length > 20 || body.messages.some((message) => typeof message.content === "string" && message.content.length > 6000)) return NextResponse.json({ message: "Percakapan terlalu panjang. Hapus chat lalu coba kembali." }, { status: 400 });
    if (body.messages.some((message) => !["user", "assistant"].includes(message.role) || typeof message.content !== "string")) return NextResponse.json({ message: "Format pesan tidak valid." }, { status: 400 });
    if (body.periodContext !== undefined && !validReportingPeriod(body.periodContext)) return NextResponse.json({ message: "Konteks periode tidak valid." }, { status: 400 });
    const result = await runDataAssistant(body.messages, body.periodContext);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Asisten AI gagal menjawab:", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Asisten AI belum dapat menjawab." }, { status: 502 });
  }
}
