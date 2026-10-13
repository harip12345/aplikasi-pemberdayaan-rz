"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bot, Home, MapPinned, Menu, Users, X } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

function RumahZakatMark() {
  return (
    <span className="flex h-11 w-24 shrink-0 items-center justify-center rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-white/60">
      <Image src="/logo-rz.png" alt="Rumah Zakat" width={88} height={28} className="max-h-7 w-auto object-contain" priority />
    </span>
  );
}

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/ikhtisar-pp-plp", label: "Peserta Program", icon: Users },
  { href: "/peta-sebaran", label: "Desa Berdaya", icon: MapPinned },
  { href: "/dampak-program", label: "Dampak Program", icon: BarChart3 },
];

export function TopBar({ onAssistantOpen, onAssistantClose, assistantOpen }: { onAssistantOpen: () => void; onAssistantClose: () => void; assistantOpen: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    navItems.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  return (
    <header className="sticky top-0 z-50 border-b border-orange-900/20 bg-[#E65100] shadow-lg shadow-orange-900/15">
      <div className={`flex h-[72px] items-center ${assistantOpen ? "w-full" : "mx-auto max-w-[1440px]"}`}>
      <div className={`${assistantOpen ? "hidden lg:flex" : "flex"} min-w-0 flex-1 items-center gap-4 px-4 xl:gap-6 xl:px-8`}>
        <Link href="/" prefetch data-page-label="Dashboard" className="flex min-w-fit items-center gap-3">
          <RumahZakatMark />
          <div className="leading-tight">
            <span className="block text-base font-bold text-white xl:text-lg">Laporan Pemberdayaan</span>
            <span className="block text-xs font-medium text-white/75 xl:text-sm">Rumah Zakat</span>
          </div>
        </Link>

        <nav className={`ml-auto hidden items-center gap-1 ${assistantOpen ? "2xl:flex" : "lg:flex"}`}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/ikhtisar-pp-plp" && pathname === "/analisa-capaian-pp");
            return (
              <Link
                key={href}
                href={href}
                prefetch
                data-page-label={label}
                className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-white text-[#D84315] shadow-md" : "text-white/85 hover:bg-white/12 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {!assistantOpen && <button type="button" onClick={onAssistantOpen} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/25" aria-label="Buka Asisten Data Program RZ" title="Buka Asisten AI"><Bot size={19} /><span className="hidden 2xl:inline">Asisten AI</span></button>}
        <UserMenu />

        <button onClick={() => setOpenMobile(!openMobile)} className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white ${assistantOpen ? "2xl:hidden" : "lg:hidden"}`}>
          {openMobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {assistantOpen && <div className="flex h-full w-full shrink-0 items-center gap-2 border-l border-white/20 px-4 text-white lg:w-[370px] xl:w-[400px]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Bot size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Asisten AI</p><p className="truncate text-[11px] text-white/75">Asisten Data Program RZ</p></div><button type="button" onClick={onAssistantClose} className="rounded-xl p-2 transition hover:bg-white/15" aria-label="Tutup Asisten AI"><X size={19} /></button></div>}
      </div>

      {openMobile && (
        <div className={`border-t border-white/20 bg-[#E65100] px-4 pb-4 pt-3 ${assistantOpen ? "2xl:hidden" : "lg:hidden"}`}>
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href === "/ikhtisar-pp-plp" && pathname === "/analisa-capaian-pp");
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  data-page-label={label}
                  onClick={() => setOpenMobile(false)}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-white text-[#D84315]" : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
