import { NextResponse } from "next/server";
import { ensureProfile, isSameOriginRequest } from "@/lib/firebase/auth-server";
import { firebaseAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ message: "Firebase belum dikonfigurasi." }, { status: 503 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const body = await request.json() as { idToken?: unknown; fullName?: unknown; organization?: unknown; purpose?: unknown };
  if (typeof body.idToken !== "string") return NextResponse.json({ message: "Token pendaftaran tidak valid." }, { status: 400 });
  try {
    const token = await firebaseAdminAuth().verifyIdToken(body.idToken, true);
    const profile = await ensureProfile(token, {
      fullName: typeof body.fullName === "string" ? body.fullName.slice(0, 120) : undefined,
      organization: typeof body.organization === "string" ? body.organization.slice(0, 160) : undefined,
      purpose: typeof body.purpose === "string" ? body.purpose.slice(0, 1000) : undefined,
    });
    return NextResponse.json({ ok: true, status: profile.status });
  } catch {
    return NextResponse.json({ message: "Pendaftaran tidak dapat diverifikasi." }, { status: 401 });
  }
}
