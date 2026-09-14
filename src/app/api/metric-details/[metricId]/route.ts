import { NextResponse } from "next/server";
import { getMetricDetailData } from "@/lib/metric-detail-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";
import { approvedApiGuard } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ metricId: string }> }) {
  const denied = await approvedApiGuard(); if (denied) return denied;
  try {
    const { metricId } = await context.params;
    const data = await getServerCachedData(`metric-detail-${metricId}`, () => getMetricDetailData(metricId), isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca sheet detail indikator:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Data detail belum dapat dimuat." }, { status: 502 });
  }
}
