import { NextResponse } from "next/server";
import { getParticipantSheetData } from "@/lib/participant-sheets";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";

export async function GET(request: Request) {
  try {
    const data = await getServerCachedData("participants", getParticipantSheetData, isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca data Peserta Program dari Google Sheets:", error);
    return NextResponse.json(
      { message: "Data Peserta Program belum dapat dimuat. Pastikan sheet dapat dilihat oleh siapa pun yang memiliki link." },
      { status: 502 },
    );
  }
}
