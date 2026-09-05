"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Home, MapPinned, Menu, Users, X } from "lucide-react";

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

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    navItems.forEach(({ href }) => router.prefetch(href));
  }, [router]);

  return (
    <header className="sticky top-0 z-50 border-b border-orange-500/25 bg-gradient-to-r from-[#D84315] via-[#E65100] to-[#EF6C00] shadow-lg shadow-orange-700/15">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-6 px-4 xl:px-8">
        <Link href="/" prefetch data-page-label="Dashboard" className="flex min-w-fit items-center gap-3">
          <RumahZakatMark />
          <div className="leading-tight">
            <span className="block text-base font-bold text-white xl:text-lg">Laporan Pemberdayaan</span>
            <span className="block text-xs font-medium text-white/75 xl:text-sm">Rumah Zakat</span>
          </div>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
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

        <button onClick={() => setOpenMobile(!openMobile)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white lg:hidden">
          {openMobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {openMobile && (
        <div className="border-t border-white/20 bg-[#D84315] px-4 pb-4 pt-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
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
