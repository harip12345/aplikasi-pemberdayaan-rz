import { NextResponse } from "next/server";
import {
  ensureProfile,
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_SECONDS,
  isSameOriginRequest,
} from "@/lib/firebase/auth-server";
import { firebaseAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/auth-config";

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ message: "Firebase belum dikonfigurasi." }, { status: 503 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const body = await request.json() as { idToken?: unknown };
  if (typeof body.idToken !== "string") return NextResponse.json({ message: "Token login tidak valid." }, { status: 400 });
  try {
    const token = await firebaseAdminAuth().verifyIdToken(body.idToken, true);
    const authAgeSeconds = Math.floor(Date.now() / 1000) - token.auth_time;
    if (authAgeSeconds > 5 * 60) return NextResponse.json({ message: "Silakan login kembali untuk membuat sesi baru." }, { status: 401 });
    if (!token.email_verified) return NextResponse.json({ message: "Verifikasi email Anda sebelum masuk." }, { status: 403 });
    const profile = await ensureProfile(token);
    const sessionCookie = await firebaseAdminAuth().createSessionCookie(body.idToken, { expiresIn: FIREBASE_SESSION_MAX_AGE_SECONDS * 1000 });
    const response = NextResponse.json({ ok: true, status: profile.status, user: {
      email: profile.email,
      fullName: profile.full_name || token.name || profile.email.split("@")[0],
      avatarUrl: profile.avatar_url || token.picture || null,
      role: isAdminEmail(profile.email) ? "admin" : profile.role,
    } });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIREBASE_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Login tidak dapat diverifikasi." }, { status: 401 });
  }
}
