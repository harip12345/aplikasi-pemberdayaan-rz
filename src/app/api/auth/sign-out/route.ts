import { NextResponse } from "next/server";
import { FIREBASE_SESSION_COOKIE, isSameOriginRequest } from "@/lib/firebase/auth-server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  const response = NextResponse.redirect(new URL("/auth/sign-in", request.url), { status: 303 });
  response.cookies.set(FIREBASE_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
