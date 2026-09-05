import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Peserta Layanan Program | Laporan Pemberdayaan Rumah Zakat",
};

export default function PesertaLayananProgramPage() {
  return <section className="space-y-6 rounded-[32px] bg-white/60 p-5 shadow-soft backdrop-blur-sm xl:p-8">
    <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-primary"><ArrowLeft size={16} /> Kembali ke Dashboard</Link>
    <div><div className="inline-flex rounded-2xl bg-[#F4511E] px-3 py-1 text-sm font-medium text-white">PLP</div><h1 className="mt-4 text-3xl font-bold text-ink">Peserta Layanan Program</h1><p className="mt-2 max-w-2xl text-slate-600">Halaman detail disiapkan untuk menampilkan data Peserta Layanan Program setelah sumber resmi tersedia.</p></div>
    <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-8 text-center"><div className="max-w-lg"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#D84315]"><Database size={24} /></div><h2 className="mt-5 text-xl font-bold text-ink">Data detail belum tersedia</h2><p className="mt-2 text-sm leading-6 text-slate-500">Data dummy telah dikosongkan. Target, capaian, grafik, dan rincian wilayah akan ditampilkan setelah halaman ini terhubung dengan sumber data yang telah diverifikasi.</p></div></div>
  </section>;
}
