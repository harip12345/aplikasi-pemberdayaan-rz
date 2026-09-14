import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdminEmail, isInternalEmail, normalizeEmail } from "@/lib/auth-config";
import { firebaseAdminAuth, firebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const FIREBASE_SESSION_COOKIE = "rz_session";
export const FIREBASE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AccessStatus = "pending" | "approved" | "rejected" | "suspended";
export type UserRole = "member" | "admin";
export type AccountType = "internal" | "external";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  organization: string | null;
  access_purpose: string | null;
  account_type: AccountType;
  role: UserRole;
  status: AccessStatus;
  approved_at: string | null;
  approved_by: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function profileFromData(id: string, data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    id,
    email: String(data.email ?? ""),
    full_name: stringValue(data.full_name),
    avatar_url: stringValue(data.avatar_url),
    organization: stringValue(data.organization),
    access_purpose: stringValue(data.access_purpose),
    account_type: data.account_type === "internal" ? "internal" : "external",
    role: data.role === "admin" ? "admin" : "member",
    status: ["approved", "rejected", "suspended"].includes(data.status) ? data.status : "pending",
    approved_at: stringValue(data.approved_at),
    approved_by: stringValue(data.approved_by),
    last_seen_at: stringValue(data.last_seen_at),
    created_at: String(data.created_at ?? new Date(0).toISOString()),
    updated_at: String(data.updated_at ?? new Date(0).toISOString()),
  };
}

export async function getProfile(uid: string) {
  const snapshot = await firebaseAdminDb().collection("profiles").doc(uid).get();
  return snapshot.exists ? profileFromData(snapshot.id, snapshot.data() ?? {}) : null;
}

export async function ensureProfile(token: DecodedIdToken, input?: { fullName?: string; organization?: string; purpose?: string }) {
  const email = normalizeEmail(token.email);
  if (!email) throw new Error("Akun Firebase tidak memiliki alamat email.");
  const reference = firebaseAdminDb().collection("profiles").doc(token.uid);
  const now = new Date().toISOString();
  return firebaseAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists ? profileFromData(snapshot.id, snapshot.data() ?? {}) : null;
    const internal = isInternalEmail(email);
    const admin = isAdminEmail(email);
    const incomingName = stringValue(input?.fullName) ?? stringValue(token.name);
    const incomingAvatar = stringValue(token.picture);
    const profile: UserProfile = existing ? {
      ...existing,
      email,
      full_name: incomingName ?? existing.full_name,
      avatar_url: incomingAvatar ?? existing.avatar_url,
      organization: stringValue(input?.organization) ?? existing.organization,
      access_purpose: stringValue(input?.purpose) ?? existing.access_purpose,
      account_type: internal ? "internal" : "external",
      role: admin ? "admin" : existing.role,
      status: admin || internal ? "approved" : existing.status,
      approved_at: (admin || internal) && !existing.approved_at ? now : existing.approved_at,
      updated_at: now,
    } : {
      id: token.uid,
      email,
      full_name: incomingName,
      avatar_url: incomingAvatar,
      organization: stringValue(input?.organization),
      access_purpose: stringValue(input?.purpose),
      account_type: internal ? "internal" : "external",
      role: admin ? "admin" : "member",
      status: admin || internal ? "approved" : "pending",
      approved_at: admin || internal ? now : null,
      approved_by: null,
      last_seen_at: null,
      created_at: now,
      updated_at: now,
    };
    const { id: _id, ...stored } = profile;
    transaction.set(reference, stored, { merge: true });
    return profile;
  });
}

export async function verifySessionValue(value: string, checkRevoked = true) {
  const token = await firebaseAdminAuth().verifySessionCookie(value, checkRevoked);
  const profile = await getProfile(token.uid);
  return profile ? { token, profile } : null;
}

export async function getCurrentSession(checkRevoked = true) {
  if (!isFirebaseAdminConfigured()) return null;
  const store = await cookies();
  const value = store.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    return await verifySessionValue(value, checkRevoked);
  } catch {
    return null;
  }
}

export async function approvedApiGuard() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ message: "Silakan masuk untuk mengakses layanan ini." }, { status: 401 });
  if (session.profile.status !== "approved") return NextResponse.json({ message: "Akses akun belum aktif." }, { status: 403 });
  return null;
}

export async function getCurrentAdminSession() {
  const session = await getCurrentSession();
  if (!session || session.profile.status !== "approved") return null;
  return session.profile.role === "admin" || isAdminEmail(session.profile.email) ? session : null;
}

export async function adminApiGuard() {
  return await getCurrentAdminSession()
    ? null
    : NextResponse.json({ message: "Akses admin diperlukan." }, { status: 403 });
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
