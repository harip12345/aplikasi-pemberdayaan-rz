"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/data/dashboard";
import { achievementTone } from "@/lib/achievement-tone";
import type { MetricDetailDataset } from "@/lib/metric-detail-sheets";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DIVISIONS = [
  { key: "Empowerment", color: "#F06422" },
  { key: "Distribution", color: "#EAB308" },
  { key: "Dakwah", color: "#43A047" },
  { key: "Project", color: "#38BDF8" },
] as const;

function number(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function GkImpactVisualization({ dataset, year, target }: { dataset: MetricDetailDataset; year: number; target: number }) {
  const column = (name: string) => dataset.columns.findIndex((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const monthColumn = column("Bulan");
  const totalColumn = column("Capaian GK 2026");
  const rows = dataset.rows.map((row) => {
    const month = row[monthColumn] ?? "";
    const byDivision = Object.fromEntries(DIVISIONS.map(({ key }) => [key, number(row[column(key)] ?? "")])) as Record<typeof DIVISIONS[number]["key"], number>;
    return { month, monthIndex: MONTHS.indexOf(month), ...byDivision, total: number(row[totalColumn] ?? "") };
  }).filter((row) => row.monthIndex >= 0).sort((left, right) => left.monthIndex - right.monthIndex);
  const currentTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const percentage = target > 0 ? (currentTotal / target) * 100 : 0;
  const remaining = Math.max(0, target - currentTotal);
  const divisionTotals = DIVISIONS.map(({ key, color }) => ({ key, color, total: rows.reduce((sum, row) => sum + row[key], 0) }));
  const largest = divisionTotals.reduce((best, division) => division.total > best.total ? division : best, divisionTotals[0]);
  const bestMonth = rows.reduce((best, row) => row.total > best.total ? row : best, rows[0] ?? { month: "-", total: 0 });
  const latestMonthIndex = rows.at(-1)?.monthIndex ?? -1;
  const period = latestMonthIndex >= 0 ? `Januari–${MONTHS[latestMonthIndex]} ${year}` : `Tahun ${year}`;
  const tone = achievementTone(percentage);

  return <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-soft">
    <div className="flex flex-col gap-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white p-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D84315]">Analisis GK per divisi</p><h2 className="mt-1 text-2xl font-bold text-ink">Peserta Keluar Garis Kemiskinan</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Empat tabel divisi pada sheet PM GK digabung berdasarkan bulan. Setiap baris data dihitung sekali pada divisinya, mengikuti rekap sumber.</p></div>
      <span className="w-fit rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-[#D84315]">Periode {period}</span>
    </div>
    <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label={`Capaian ${year}`} value={formatNumber(currentTotal)} note={`${percentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari target · ${tone.label}`} accent />
      <Summary label="Target tahunan" value={formatNumber(target)} note="peserta program" />
      <Summary label="Sisa target" value={formatNumber(remaining)} note="hingga target terpenuhi" />
      <Summary label="Divisi terbesar" value={largest.key} note={`${formatNumber(largest.total)} peserta · ${currentTotal ? ((largest.total / currentTotal) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "0"}% dari total`} />
    </div>
    <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-5"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tren bulanan</p><h3 className="mt-1 text-lg font-bold text-ink">Kontribusi empat divisi · {year}</h3></div><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} stroke="#94A3B8" /><YAxis tick={{ fontSize: 10 }} stroke="#94A3B8" /><Tooltip formatter={(value) => `${formatNumber(Number(value))} peserta`} /><Legend wrapperStyle={{ fontSize: 11 }} />{DIVISIONS.map(({ key, color }) => <Bar key={key} dataKey={key} stackId="gk" name={key} fill={color} />)}</BarChart></ResponsiveContainer></div></div>
      <div className="flex flex-col rounded-[22px] bg-[#172334] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Ringkasan analitis</p><h3 className="mt-2 text-xl font-bold">Capaian lintas divisi</h3><p className="mt-4 text-sm leading-7 text-white/70">Hingga {MONTHS[latestMonthIndex] ?? "periode berjalan"}, tercatat <strong className="text-white">{formatNumber(currentTotal)} peserta</strong> dari empat divisi. Kontribusi terbesar berasal dari <strong className="text-white">{largest.key}</strong> sebanyak {formatNumber(largest.total)} peserta.</p><div className="mt-5 space-y-3 border-t border-white/10 pt-5">{divisionTotals.map(({ key, color, total }) => <InsightRow key={key} label={key} value={`${formatNumber(total)} peserta`} color={color} />)}<div className="border-t border-white/10 pt-3"><InsightRow label="Bulan tertinggi" value={`${bestMonth.month} · ${formatNumber(bestMonth.total)}`} /></div></div><div className="mt-auto pt-6"><div className="flex items-center justify-between text-xs"><span className="text-white/50">Kemajuan target tahunan</span><strong style={{ color: tone.color }}>{percentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% · {tone.label}</strong></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: tone.color }} /></div></div></div>
    </div>
  </div>;
}

function Summary({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <div className={`rounded-[20px] border p-4 ${accent ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 break-words text-2xl font-bold ${accent ? "text-[#D84315]" : "text-ink"}`}>{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{note}</p></div>;
}

function InsightRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="flex items-start justify-between gap-4 text-xs"><span className="flex items-center gap-2 text-white/60">{color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}{label}</span><strong className="text-right text-white/85">{value}</strong></div>;
}
