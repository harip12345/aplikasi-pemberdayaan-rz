import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth-config";
import { type AccessStatus, getCurrentSession, isSameOriginRequest, type UserProfile } from "@/lib/firebase/auth-server";
import { firebaseAdminAuth, firebaseAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["pending", "approved", "rejected", "suspended"]);

async function currentAdmin() {
  const session = await getCurrentSession();
  return session && (session.profile.role === "admin" || isAdminEmail(session.profile.email)) ? session : null;
}

export async function GET() {
  const adminUser = await currentAdmin();
  if (!adminUser) return NextResponse.json({ message: "Akses admin diperlukan." }, { status: 403 });
  const snapshot = await firebaseAdminDb().collection("profiles").orderBy("created_at", "desc").limit(1000).get();
  const users = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as UserProfile[];
  const onlineSince = Date.now() - 5 * 60 * 1000;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const counts = {
    total: users.length,
    online: users.filter((user) => user.last_seen_at && Date.parse(user.last_seen_at) >= onlineSince).length,
    approved: users.filter((user) => user.status === "approved").length,
    pending: users.filter((user) => user.status === "pending").length,
    inactive: users.filter((user) => user.status === "rejected" || user.status === "suspended").length,
    internal: users.filter((user) => user.account_type === "internal").length,
    external: users.filter((user) => user.account_type === "external").length,
    newThisMonth: users.filter((user) => Date.parse(user.created_at) >= monthStart.getTime()).length,
  };
  return NextResponse.json({ users, counts, onlineThresholdMinutes: 5 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const adminUser = await currentAdmin();
  if (!adminUser) return NextResponse.json({ message: "Akses admin diperlukan." }, { status: 403 });
  const body = await request.json() as { userId?: unknown; status?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!userId || !ALLOWED_STATUS.has(status)) return NextResponse.json({ message: "Permintaan perubahan akses tidak valid." }, { status: 400 });

  const reference = firebaseAdminDb().collection("profiles").doc(userId);
  const targetSnapshot = await reference.get();
  if (!targetSnapshot.exists) return NextResponse.json({ message: "Pengguna tidak ditemukan." }, { status: 404 });
  const target = targetSnapshot.data() ?? {};
  if (isAdminEmail(String(target.email ?? "")) && status !== "approved") return NextResponse.json({ message: "Akun admin utama tidak dapat dinonaktifkan dari panel ini." }, { status: 400 });

  const now = new Date().toISOString();
  await reference.update({
    status: status as AccessStatus,
    approved_at: status === "approved" ? now : null,
    approved_by: status === "approved" ? adminUser.token.uid : null,
    updated_at: now,
  });
  if (status === "rejected" || status === "suspended") await firebaseAdminAuth().revokeRefreshTokens(userId);
  return NextResponse.json({ ok: true });
}
