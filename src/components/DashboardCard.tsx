"use client";

import Link from "next/link";
import { ClipboardList, HandCoins, HandHeart, HeartHandshake, MapPinned, Store, Target, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { Metric, formatNumber, percentage } from "@/data/dashboard";
import { achievementTone } from "@/lib/achievement-tone";

const OBJECTIVE_ICONS: Record<string, LucideIcon> = {
  "desa-berdaya": MapPinned,
  "garis-kemiskinan": TrendingUp,
  muzzaki: HandHeart,
  munfik: HandCoins,
  bummas: Store,
  "peserta-program": Users,
  "peserta-layanan-program": ClipboardList,
  mualaf: HeartHandshake,
};

export function DashboardCard({ metric, dataThroughLabel, isDataAvailable = true }: { metric: Metric; dataThroughLabel?: string; isDataAvailable?: boolean }) {
  const percent = isDataAvailable ? percentage(metric) : 0;
  const tone = achievementTone(percent);
  const href = metric.id === "peserta-program" ? "/ikhtisar-pp-plp" : metric.id === "desa-berdaya" ? "/peta-sebaran" : `/${metric.id}`;
  const ObjectiveIcon = OBJECTIVE_ICONS[metric.id] ?? Target;

  return (
    <Link
      href={href}
      className="dashboard-metric-card group relative min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-2xl"
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-10" style={{ backgroundColor: metric.color }} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{metric.shortTitle}</p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{metric.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{metric.description}</p>
        </div>
        <div className="rounded-2xl p-3 text-white shadow-lg transition-transform duration-300 group-hover:scale-105" style={{ backgroundColor: metric.color }} title={metric.title}>
          <ObjectiveIcon size={20} strokeWidth={2.1} />
        </div>
      </div>

      <div className="dashboard-value-grid mt-6 grid grid-cols-2 gap-3 rounded-3xl bg-slate-50 p-3">
        <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Target</p>
          <p className="mt-2 min-h-8 whitespace-nowrap text-xl font-semibold tabular-nums text-ink">{isDataAvailable ? formatNumber(metric.target) : ""}</p>
          <p className="min-h-5 text-sm text-slate-500">{isDataAvailable ? metric.unit : ""}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 px-3 py-3 shadow-sm ring-1 ring-orange-100/70">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D84315]">Capaian</p>
          <p className="mt-2 min-h-8 whitespace-nowrap text-xl font-bold tabular-nums text-[#B9380D]">{isDataAvailable ? formatNumber(metric.achievement) : ""}</p>
          <p className="min-h-5 text-sm text-slate-500">{isDataAvailable ? metric.unit : ""}</p>
          {isDataAvailable && dataThroughLabel && <p className="mt-1 text-[11px] font-semibold text-[#D84315]">*per {dataThroughLabel}</p>}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-500"><Target size={15} /> Persentase</span>
          <span className="min-w-8 text-right font-semibold" style={{ color: tone.color }}>{isDataAvailable ? `${percent}% · ${tone.label}` : ""}</span>
        </div>
        <div className="h-3 rounded-full" style={{ backgroundColor: tone.trackColor }}>
          <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: tone.color }} />
        </div>
      </div>
    </Link>
  );
}
