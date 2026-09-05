"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/data/dashboard";
import { achievementTone } from "@/lib/achievement-tone";
import type { MetricDetailDataset } from "@/lib/metric-detail-sheets";

const IMPACT_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function parseDetailNumber(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

type GkTrendPoint = { monthIndex: number; month: string; previous: number; current: number; target: number; remainingMonthly: number };

export function GkImpactVisualization({ dataset, year }: { dataset: MetricDetailDataset; year: number }) {
  const column = (name: string) => dataset.columns.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const monthColumn = column("Bulan 2");
  const previousColumn = column("Capaian GK 2025");
  const currentColumn = column("Capaian GK 2026");
  const targetColumn = column("Target Satu Tahun");
  const remainingMonthlyColumn = column("Sisa Target Bulan Berjalan");
  const rows = dataset.rows.map((row, fallbackIndex) => {
    const monthIndex = Math.max(0, Math.min(11, Math.round(parseDetailNumber(row[monthColumn] ?? "")) - 1 || fallbackIndex));
    return { monthIndex, month: IMPACT_MONTHS[monthIndex], previous: parseDetailNumber(row[previousColumn] ?? ""), current: parseDetailNumber(row[currentColumn] ?? ""), target: parseDetailNumber(row[targetColumn] ?? ""), remainingMonthly: parseDetailNumber(row[remainingMonthlyColumn] ?? "") };
  }).sort((a, b) => a.monthIndex - b.monthIndex);
  const latestMonthIndex = rows.reduce((latest, row) => row.current > 0 ? Math.max(latest, row.monthIndex) : latest, -1);
  const comparableRows = rows.filter((row) => row.monthIndex <= latestMonthIndex);
  const currentTotal = comparableRows.reduce((total, row) => total + row.current, 0);
  const previousTotal = comparableRows.reduce((total, row) => total + row.previous, 0);
  const target = rows.find((row) => row.target > 0)?.target ?? 0;
  const remaining = Math.max(0, target - currentTotal);
  const percentage = target > 0 ? (currentTotal / target) * 100 : 0;
  const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  const average = comparableRows.length > 0 ? Math.round(currentTotal / comparableRows.length) : 0;
  const latestRow = comparableRows.at(-1);
  const remainingPerMonth = latestRow?.remainingMonthly || (latestMonthIndex < 11 ? Math.ceil(remaining / (11 - latestMonthIndex)) : remaining);
  const bestMonth = comparableRows.reduce((best, row) => row.current > best.current ? row : best, comparableRows[0] ?? { month: "-", current: 0, monthIndex: 0, previous: 0, target: 0, remainingMonthly: 0 });
  const period = latestMonthIndex >= 0 ? `${IMPACT_MONTHS[0]}–${IMPACT_MONTHS[latestMonthIndex]} ${year}` : `Tahun ${year}`;
  const percentageLabel = percentage.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const performanceTone = achievementTone(percentage);
  const growthLabel = Math.abs(growth).toLocaleString("id-ID", { maximumFractionDigits: 1 });

  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white p-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D84315]">Analisis Dampak Multitahun</p><h2 className="mt-1 text-2xl font-bold text-ink">Perkembangan Peserta Keluar Garis Kemiskinan</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Perbandingan capaian bulanan {year - 1} dan {year}, disusun dari sheet rekap yang sebelumnya ditampilkan sebagai tabel.</p></div>
        <span className="w-fit rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-[#D84315]">Periode {period}</span>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
        <ImpactSummary label={`Capaian ${year}`} value={formatNumber(currentTotal)} note={`${percentageLabel}% dari target · ${performanceTone.label}`} accent performanceColor={performanceTone.color} />
        <ImpactSummary label="Target tahunan" value={formatNumber(target)} note="peserta program" />
        <ImpactSummary label="Sisa target" value={formatNumber(remaining)} note="hingga target terpenuhi" />
        <ImpactSummary label="Growth year-on-year" value={`${growth >= 0 ? "+" : ""}${growthLabel}%`} note={`dibanding periode sama ${year - 1}`} positive={growth >= 0} />
      </div>
      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[1.35fr_0.65fr]">
        <GkTrendChart data={comparableRows} year={year} />
        <GkNarrativeCard year={year} latestMonthIndex={latestMonthIndex} currentTotal={currentTotal} previousTotal={previousTotal} growth={growth} growthLabel={growthLabel} average={average} remainingPerMonth={remainingPerMonth} bestMonth={bestMonth} percentage={percentage} percentageLabel={percentageLabel} />
      </div>
    </div>
  );
}

function GkTrendChart({ data, year }: { data: GkTrendPoint[]; year: number }) {
  return <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-5"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tren bulanan</p><h3 className="mt-1 text-lg font-bold text-ink">Capaian {year - 1} vs {year}</h3></div><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} stroke="#94A3B8" /><YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="previous" name={`Capaian GK ${year - 1}`} stroke="#76A93B" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="current" name={`Capaian GK ${year}`} stroke="#F06422" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></div>;
}

function GkNarrativeCard({ year, latestMonthIndex, currentTotal, previousTotal, growth, growthLabel, average, remainingPerMonth, bestMonth, percentage, percentageLabel }: { year: number; latestMonthIndex: number; currentTotal: number; previousTotal: number; growth: number; growthLabel: string; average: number; remainingPerMonth: number; bestMonth: GkTrendPoint; percentage: number; percentageLabel: string }) {
  const tone = achievementTone(percentage);
  return <div className="flex flex-col rounded-[22px] bg-[#172334] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Ringkasan analitis</p><h3 className="mt-2 text-xl font-bold">Laju capaian GK</h3><p className="mt-4 text-sm leading-7 text-white/70">Hingga {IMPACT_MONTHS[latestMonthIndex] ?? "periode berjalan"}, capaian mencapai <strong className="text-white">{formatNumber(currentTotal)} peserta</strong>. Dibandingkan periode yang sama tahun {year - 1} sebanyak {formatNumber(previousTotal)} peserta, terjadi <strong className={growth >= 0 ? "text-emerald-300" : "text-red-300"}>{growth >= 0 ? "pertumbuhan" : "penurunan"} {growthLabel}%</strong>.</p><div className="mt-5 space-y-3 border-t border-white/10 pt-5"><InsightRow label="Rata-rata capaian bulanan" value={`${formatNumber(average)} peserta`} /><InsightRow label="Kebutuhan rata-rata per bulan" value={`${formatNumber(remainingPerMonth)} peserta`} /><InsightRow label="Capaian bulanan tertinggi" value={`${bestMonth.month} · ${formatNumber(bestMonth.current)}`} /></div><div className="mt-auto pt-6"><div className="flex items-center justify-between text-xs"><span className="text-white/50">Kemajuan target tahunan</span><strong style={{ color: tone.color }}>{percentageLabel}% · {tone.label}</strong></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: tone.color }} /></div></div></div>;
}

function ImpactSummary({ label, value, note, accent, positive, performanceColor }: { label: string; value: string; note: string; accent?: boolean; positive?: boolean; performanceColor?: string }) {
  return <div className={`rounded-[20px] border p-4 ${accent ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-2xl font-bold ${accent ? "text-[#D84315]" : positive ? "text-emerald-600" : "text-ink"}`}>{value}</p><p className="mt-1 text-xs font-semibold" style={performanceColor ? { color: performanceColor } : undefined}>{note}</p></div>;
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 text-xs"><span className="text-white/50">{label}</span><strong className="text-right text-white/85">{value}</strong></div>;
}
