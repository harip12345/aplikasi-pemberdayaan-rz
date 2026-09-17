import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "rz_session";
const PUBLIC_PATHS = ["/auth/sign-in", "/auth/action", "/auth/forgot-password", "/auth/update-password", "/api/auth/register", "/api/auth/session", "/api/telegram/webhook", "/api/assistant/auth-refresh"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function authRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-in";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const localRequest = ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
  if (localRequest) return NextResponse.next();

  const configured = Boolean(process.env.FIREBASE_PROJECT_ID?.trim());
  if (!configured && process.env.NODE_ENV !== "production") return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ message: "Silakan masuk untuk mengakses layanan ini." }, { status: 401 });
    return authRedirect(request);
  }

  // Verifikasi kriptografis dan status approval dilakukan pada setiap API route
  // Node.js menggunakan Firebase Admin SDK. Middleware hanya menangani navigasi
  // awal agar tetap ringan dan kompatibel dengan Vercel Edge Runtime.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo-rz.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
