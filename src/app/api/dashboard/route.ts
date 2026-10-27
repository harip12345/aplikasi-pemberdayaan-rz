import { NextResponse } from "next/server";
import { getDashboardSheetData } from "@/lib/dashboard-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";
import { approvedApiGuard, isLocalDataPreviewRequest } from "@/lib/firebase/auth-server";

export async function GET(request: Request) {
  if (!isLocalDataPreviewRequest(request)) { const denied = await approvedApiGuard(); if (denied) return denied; }
  try {
    const data = await getServerCachedData("dashboard", getDashboardSheetData, isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca target dan capaian dashboard dari Google Sheets:", error);
    return NextResponse.json(
      { message: "Data dashboard belum dapat dimuat. Pastikan sheet tetap dapat dilihat oleh siapa pun yang memiliki link." },
      { status: 502 },
    );
  }
}
