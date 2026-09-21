import { NextResponse } from "next/server";
import { getDistributionFromGoogleSheets } from "@/lib/google-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";
import { approvedApiGuard } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hostname = new URL(request.url).hostname;
  const localRequest = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!localRequest) { const denied = await approvedApiGuard(); if (denied) return denied; }
  try {
    const data = await getServerCachedData("distribution-v3", getDistributionFromGoogleSheets, isForcedDataRefresh(request));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Gagal membaca data sebaran dari Google Sheets:", error);
    return NextResponse.json(
      { message: "Data Google Sheets belum dapat dimuat. Pastikan sheet tetap dapat dilihat oleh siapa pun yang memiliki link." },
      { status: 502 },
    );
  }
}
