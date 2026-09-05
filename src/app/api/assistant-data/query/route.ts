import { NextResponse } from "next/server";
import { AI_DATA_SOURCE_CATALOG } from "@/lib/data-catalog";
import { METRIC_DICTIONARY } from "@/lib/metric-dictionary";
import { queryAiData, type AiDataQuery } from "@/lib/ai-data-query";
import { isForcedDataRefresh } from "@/lib/server-data-cache";

export const dynamic = "force-dynamic";

const SOURCES = new Set(["dashboard", "participants", "munfik", "distribution", "details"]);

export async function GET() {
  return NextResponse.json({ sources: AI_DATA_SOURCE_CATALOG, dictionary: METRIC_DICTIONARY }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as AiDataQuery;
    if (!input || !SOURCES.has(input.source)) return NextResponse.json({ message: "Sumber harus dashboard, participants, munfik, distribution, atau details." }, { status: 400 });
    const result = await queryAiData(input, isForcedDataRefresh(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal menjalankan query data untuk asisten:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Query data tidak dapat dijalankan." }, { status: 502 });
  }
}
