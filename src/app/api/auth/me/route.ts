import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const { token, profile } = session;
  return NextResponse.json({
    user: {
      id: token.uid,
      email: profile.email,
      fullName: profile.full_name || token.name || profile.email.split("@")[0],
      avatarUrl: profile.avatar_url || token.picture || null,
      role: isAdminEmail(profile.email) ? "admin" : profile.role,
      status: profile.status,
      accountType: profile.account_type,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
