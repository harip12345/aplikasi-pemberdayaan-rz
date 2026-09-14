import { NextResponse } from "next/server";
import { queryDashboardData, queryDistributionData, queryMunfikData, queryParticipantData } from "@/lib/ai-data-query";
import { approvedApiGuard } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const denied = await approvedApiGuard(); if (denied) return denied;
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
