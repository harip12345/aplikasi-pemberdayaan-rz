import { NextResponse } from "next/server";
import { getDistributionFromGoogleSheets } from "@/lib/google-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const data = await getServerCachedData("distribution", getDistributionFromGoogleSheets, isForcedDataRefresh(request));
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
