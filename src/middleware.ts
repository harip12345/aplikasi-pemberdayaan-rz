import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth-config";
import { FIREBASE_SESSION_COOKIE, verifySessionValue } from "@/lib/firebase/auth-server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

const PUBLIC_PATHS = ["/auth/sign-in", "/auth/action", "/auth/forgot-password", "/auth/update-password", "/api/auth/register", "/api/auth/session", "/api/telegram/webhook"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function authRedirect(request: NextRequest, pathname: string, next?: string, clearSession = false) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  const response = NextResponse.redirect(url);
  if (clearSession) response.cookies.set(FIREBASE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function unauthorizedApi(message: string, status = 401) {
  return NextResponse.json({ message }, { status });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isFirebaseAdminConfigured()) {
    if (isPublicPath(pathname) || process.env.NODE_ENV !== "production") return NextResponse.next();
    if (pathname.startsWith("/api/")) return unauthorizedApi("Autentikasi Firebase belum dikonfigurasi.", 503);
    return authRedirect(request, "/auth/sign-in");
  }

  const sessionValue = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionValue) {
    if (isPublicPath(pathname)) return NextResponse.next();
    if (pathname.startsWith("/api/")) return unauthorizedApi("Silakan masuk untuk mengakses layanan ini.");
    return authRedirect(request, "/auth/sign-in", `${pathname}${request.nextUrl.search}`);
  }

  let session: Awaited<ReturnType<typeof verifySessionValue>>;
  try {
    session = await verifySessionValue(sessionValue, true);
  } catch {
    session = null;
  }
  if (!session) {
    if (isPublicPath(pathname)) {
      const response = NextResponse.next();
      response.cookies.set(FIREBASE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }
    if (pathname.startsWith("/api/")) return unauthorizedApi("Sesi tidak berlaku. Silakan masuk kembali.");
    return authRedirect(request, "/auth/sign-in", `${pathname}${request.nextUrl.search}`, true);
  }

  const { profile } = session;
  if (profile.status === "pending") {
    if (pathname === "/auth/pending" || pathname.startsWith("/api/auth/")) return NextResponse.next();
    if (pathname.startsWith("/api/")) return unauthorizedApi("Permohonan akses masih menunggu persetujuan admin.", 403);
    return authRedirect(request, "/auth/pending");
  }
  if (profile.status === "rejected" || profile.status === "suspended") {
    if (pathname === "/auth/access-denied" || pathname === "/api/auth/sign-out" || pathname === "/api/auth/me") return NextResponse.next();
    if (pathname.startsWith("/api/")) return unauthorizedApi("Akses akun tidak aktif.", 403);
    return authRedirect(request, "/auth/access-denied");
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (profile.role !== "admin" && !isAdminEmail(profile.email)) {
      if (pathname.startsWith("/api/")) return unauthorizedApi("Akses admin diperlukan.", 403);
      return authRedirect(request, "/");
    }
  }

  if (pathname.startsWith("/auth/")) return authRedirect(request, "/");
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo-rz.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
