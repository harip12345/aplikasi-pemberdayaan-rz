import { NextResponse } from "next/server";
import { getCurrentSession, isSameOriginRequest } from "@/lib/firebase/auth-server";
import { firebaseAdminDb } from "@/lib/firebase/admin";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const { profile } = session;
  return NextResponse.json({ profile: {
    full_name: profile.full_name,
    email: profile.email,
    organization: profile.organization,
    access_purpose: profile.access_purpose,
    status: profile.status,
    account_type: profile.account_type,
  } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Tidak terautentikasi." }, { status: 401 });
  const body = await request.json() as { fullName?: unknown; organization?: unknown; purpose?: unknown };
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 160) : "";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim().slice(0, 1000) : "";
  if (!fullName || !organization || purpose.length < 10) return NextResponse.json({ message: "Nama, instansi, dan tujuan akses minimal 10 karakter wajib diisi." }, { status: 400 });
  if (session.profile.account_type !== "external" || session.profile.status !== "pending") return NextResponse.json({ message: "Profil ini tidak memerlukan permohonan eksternal." }, { status: 400 });
  await firebaseAdminDb().collection("profiles").doc(session.token.uid).update({ full_name: fullName, organization, access_purpose: purpose, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
