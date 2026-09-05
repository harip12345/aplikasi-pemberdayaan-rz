import { NextResponse } from "next/server";
import { getMetricDetailData } from "@/lib/metric-detail-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ metricId: string }> }) {
  try {
    const { metricId } = await context.params;
    const data = await getServerCachedData(`metric-detail-${metricId}`, () => getMetricDetailData(metricId), isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca sheet detail indikator:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Data detail belum dapat dimuat." }, { status: 502 });
  }
}
