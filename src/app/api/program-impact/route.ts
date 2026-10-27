import { NextResponse } from "next/server";
import { getProgramImpactData } from "@/lib/program-impact-sheets";
import { isForcedDataRefresh } from "@/lib/server-data-cache";
import { approvedApiGuard, isLocalDataPreviewRequest } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalDataPreviewRequest(request)) { const denied = await approvedApiGuard(); if (denied) return denied; }
  try {
    const data = await getProgramImpactData(isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca data dampak program:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Data dampak belum dapat dimuat." }, { status: 502 });
  }
}
