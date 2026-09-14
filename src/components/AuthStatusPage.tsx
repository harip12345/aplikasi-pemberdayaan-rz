"use client";

import Image from "next/image";
import { Clock3, LogOut, ShieldX } from "lucide-react";

export function AuthStatusPage({ type }: { type: "pending" | "denied" }) {
  const pending = type === "pending";
  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#fff1e6,#f8fafc_58%)] px-4"><div className="w-full max-w-lg rounded-[28px] border border-white bg-white p-8 text-center shadow-[0_24px_70px_rgba(30,41,59,0.14)]"><Image src="/logo-rz.png" alt="Rumah Zakat" width={112} height={38} className="mx-auto h-auto w-28 object-contain" /><span className={`mx-auto mt-8 grid h-16 w-16 place-items-center rounded-3xl ${pending ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>{pending ? <Clock3 size={30} /> : <ShieldX size={30} />}</span><h1 className="mt-5 text-2xl font-bold text-[#172436]">{pending ? "Permohonan sedang ditinjau" : "Akses belum tersedia"}</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{pending ? "Akun eksternal Anda sudah terdaftar. Admin akan meninjau instansi dan tujuan akses sebelum memberikan persetujuan." : "Permohonan ditolak atau akses akun sedang dinonaktifkan. Hubungi admin internal bila Anda memerlukan peninjauan ulang."}</p><form action="/api/auth/sign-out" method="post" className="mt-7"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50"><LogOut size={16} /> Keluar</button></form></div></div>;
}

