import { NextResponse } from "next/server";
import { getCurrentSession, isSameOriginRequest } from "@/lib/firebase/auth-server";
import { firebaseAdminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const session = await getCurrentSession(false);
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const now = new Date().toISOString();
  await firebaseAdminDb().collection("profiles").doc(session.token.uid).update({ last_seen_at: now, updated_at: now });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
