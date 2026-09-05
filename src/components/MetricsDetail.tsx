"use client";

import Link from "next/link";
import { ArrowLeft, Target, TrendingUp, MapPin } from "lucide-react";
import { metrics, formatNumber, percentage } from "@/data/dashboard";
import { MonthlyChart } from "./Charts";
import { RegionalChart } from "./Charts";
import { LiveMetricsDetail } from "./LiveMetricsDetail";
import { achievementTone } from "@/lib/achievement-tone";

export function MetricsDetail({ metricId, liveData = false }: { metricId: string; liveData?: boolean }) {
  if (liveData) return <LiveMetricsDetail metricId={metricId} />;
  const metric = metrics.find((m) => m.id === metricId)!;
  const percent = percentage(metric);
  const percentTone = achievementTone(percent);

  return (
    <section className="space-y-6 rounded-[32px] bg-white/60 p-5 shadow-soft backdrop-blur-sm xl:p-8">
      <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-primary">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: metric.color }}>
            {metric.shortTitle}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-1 text-sm text-slate-600">Tahun 2026</div>
        </div>
        <h1 className="mt-4 text-3xl font-bold text-ink">{metric.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{metric.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-white/70 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2 text-slate-500"><Target size={18} /><span className="text-sm font-medium">Target</span></div>
          <p className="mt-2 text-3xl font-bold text-ink">{formatNumber(metric.target)}</p>
          <p className="text-sm text-slate-500">{metric.unit}</p>
        </div>
        <div className="rounded-[24px] border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-soft ring-1 ring-orange-100/70">
          <div className="flex items-center gap-2 text-[#D84315]"><TrendingUp size={18} /><span className="text-sm font-medium">Capaian</span></div>
          <p className="mt-2 text-3xl font-bold text-[#B9380D]">{formatNumber(metric.achievement)}</p>
          <p className="text-sm text-slate-500">{metric.unit}</p>
        </div>
        <div className="rounded-[24px] border bg-white p-5 shadow-soft" style={{ borderColor: percentTone.trackColor }}>
          <p className="text-sm font-medium text-slate-500">Persentase</p>
          <p className="mt-2 text-3xl font-bold" style={{ color: percentTone.color }}>{percent}%</p>
          <div className="mt-3 h-3 rounded-full" style={{ backgroundColor: percentTone.trackColor }}>
            <div className="h-3 rounded-full" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: percentTone.color }} />
          </div>
          <p className="mt-3 text-sm font-semibold" style={{ color: percentTone.color }}>{percentTone.label}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyChart metric={metric} />
        <RegionalChart metric={metric} />
      </div>

      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2 text-slate-500"><MapPin size={18} /><span className="text-sm font-medium">Rincian Wilayah</span></div>
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-16 px-5 py-4 text-right">No.</th>
                <th className="px-5 py-4">Wilayah</th>
                <th className="px-5 py-4 text-right">Pencapaian</th>
                <th className="px-5 py-4 text-right">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {metric.regions.map((region, index) => (
                <tr key={region.name} className="transition hover:bg-orange-50/40">
                  <td className="px-5 py-4 text-right font-medium text-slate-400">{index + 1}</td>
                  <td className="px-5 py-4 font-medium text-ink">{region.name}</td>
                  <td className="px-5 py-4 text-right font-semibold text-ink">{formatNumber(region.value)}</td>
                  <td className="px-5 py-4 text-right font-medium text-primary">{region.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
