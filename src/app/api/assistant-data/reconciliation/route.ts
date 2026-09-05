import { NextResponse } from "next/server";
import { reconcileAiDataSources } from "@/lib/ai-data-query";
import { isForcedDataRefresh } from "@/lib/server-data-cache";

export const dynamic = "force-dynamic";

function optionalMonth(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 11 ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await reconcileAiDataSources({
      startMonthIndex: optionalMonth(url.searchParams.get("startMonthIndex")),
      endMonthIndex: optionalMonth(url.searchParams.get("endMonthIndex")),
    }, isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal merekonsiliasi sumber data asisten:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Rekonsiliasi data tidak dapat dijalankan." }, { status: 502 });
  }
}

