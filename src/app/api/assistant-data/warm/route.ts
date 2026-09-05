import { NextResponse } from "next/server";
import { queryDashboardData, queryDistributionData, queryMunfikData, queryParticipantData } from "@/lib/ai-data-query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const startedAt = Date.now();
  const sources = ["dashboard", "participants", "munfik", "distribution"];
  const entries = await Promise.allSettled([
    queryDashboardData({ source: "dashboard" }),
    queryParticipantData({ source: "participants" }),
    queryMunfikData({ source: "munfik" }),
    queryDistributionData({ source: "distribution" }),
  ]);
  const warmed = sources.filter((_, index) => entries[index].status === "fulfilled");
  return NextResponse.json({ warmed, elapsedMs: Date.now() - startedAt }, { headers: { "Cache-Control": "no-store" } });
}
