import { NextResponse } from "next/server";
import { approvedApiGuard } from "@/lib/firebase/auth-server";
import { getParticipantAnalysisData } from "@/lib/participant-analysis";
import { getServerCachedData, isForcedDataRefresh } from "@/lib/server-data-cache";

export async function GET(request: Request) {
  const denied = await approvedApiGuard(); if (denied) return denied;
  try {
    const data = await getServerCachedData("participant-analysis-v3", getParticipantAnalysisData, isForcedDataRefresh(request));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Gagal membaca Analisa Capaian Peserta Program:", error);
    return NextResponse.json({ message: "Data analisa capaian belum dapat dimuat. Pastikan sheet dapat dilihat oleh siapa pun yang memiliki link." }, { status: 502 });
  }
}
