import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Masuk | Laporan Pemberdayaan Rumah Zakat" };

export default function SignInPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#FFF8F2]" />}><AuthForm /></Suspense>;
}

