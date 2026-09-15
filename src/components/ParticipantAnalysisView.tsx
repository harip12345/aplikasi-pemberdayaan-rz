"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";
import type { ParticipantAnalysisData } from "@/lib/participant-analysis";

const CACHE_KEY = "participant-analysis-v2";
const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(Math.round(value));
const formatPercent = (value: number) => `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

function StatCard({ label, value, note, accent = "slate" }: { label: string; value: string; note: string; accent?: "orange" | "green" | "slate" }) {
  const tones = accent === "orange" ? "border-orange-200 bg-orange-50 text-[#D84315]" : accent === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-[#172436]";
  return <div className={`rounded-[22px] border p-5 shadow-soft ${tones}`}><p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-65">{label}</p><p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p><p className="mt-2 text-xs opacity-70">{note}</p></div>;
}

export function ParticipantAnalysisView() {
  const cached = getCachedJsonSnapshot<ParticipantAnalysisData>(CACHE_KEY);
  const [data, setData] = useState<ParticipantAnalysisData | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  const load = async (forceRefresh = false) => {
    setIsLoading(true); setError(null);
    try { setData(await fetchCachedJson<ParticipantAnalysisData>(CACHE_KEY, "/api/participant-analysis", forceRefresh)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Data analisa tidak dapat dimuat."); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    fetchCachedJson<ParticipantAnalysisData>(CACHE_KEY, "/api/participant-analysis")
      .then((nextData) => { if (!cancelled) setData(nextData); })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Data analisa tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chartRows = useMemo(() => data?.rows.map((row) => ({ ...row, shortName: row.program.replace("Lingkungan dan sosial", "Lingkungan & sosial").replace("Siaga Bencana & Kemanusiaan", "Siaga Bencana") })) ?? [], [data]);
  const divisionRows = useMemo(() => data?.divisions ?? [], [data]);
  const periodLabel = data ? `${data.months[data.startMonthIndex]}–${data.months[data.endMonthIndex]} ${data.year}` : "";
  const strongest = data?.rows.reduce((best, row) => row.runningGrowthRate > best.runningGrowthRate ? row : best, data.rows[0]);
  const lowest = data?.rows.reduce((worst, row) => row.runningGrowthRate < worst.runningGrowthRate ? row : worst, data.rows[0]);
  const aboveTarget = data?.rows.filter((row) => row.runningAchievementRate >= 100) ?? [];
  const positiveGrowth = data?.rows.filter((row) => row.runningGrowthRate > 0) ?? [];

  return <section className="space-y-6">
    <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-6 text-white shadow-xl shadow-black/15 lg:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div><Link href="/ikhtisar-pp-plp" className="inline-flex items-center gap-2 text-xs font-semibold text-white/65 transition hover:text-white"><ArrowLeft size={14} /> Kembali ke Peserta Program</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Analisa Capaian Peserta Program</p><h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight lg:text-4xl">Kinerja capaian, target, dan pertumbuhan peserta</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Analisis membandingkan realisasi program dengan target serta capaian pada periode yang sama tahun sebelumnya.</p></div>
        <div className="flex flex-wrap items-center gap-2"><a href={data?.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 hover:bg-white/10"><ExternalLink size={14} /> Buka sumber</a><button type="button" onClick={() => void load(true)} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#F2662F] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-orange-950/25 disabled:opacity-50"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Muat ulang</button></div>
      </div>
    </div>

    {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Capaian periode berjalan" value={data ? formatNumber(data.totals.runningAchievement) : ""} note={periodLabel || "Memuat periode"} accent="orange" />
      <StatCard label="Target periode berjalan" value={data ? formatNumber(data.totals.runningTarget) : ""} note="Target kumulatif pada sheet analisa" />
      <StatCard label="Persentase capaian" value={data ? formatPercent(data.totals.runningAchievementRate) : ""} note="Capaian dibanding target berjalan" accent={data && data.totals.runningAchievementRate >= 100 ? "green" : "slate"} />
      <StatCard label="Growth periode sebanding" value={data ? `${data.totals.runningGrowthRate >= 0 ? "+" : ""}${formatPercent(data.totals.runningGrowthRate)}` : ""} note={`Dibanding ${periodLabel ? periodLabel.replace(String(data?.year), String((data?.year ?? 2026) - 1)) : "periode sama tahun lalu"}`} accent={data && data.totals.runningGrowthRate >= 0 ? "green" : "orange"} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Target dan capaian</p><h2 className="mt-1 text-lg font-bold text-[#172436]">Capaian periode berjalan per program</h2><div className="mt-5 h-[390px]"><ResponsiveContainer><BarChart data={chartRows} layout="vertical" margin={{ left: 24, right: 32 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 10 }} /><YAxis dataKey="shortName" type="category" width={138} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="runningTarget" name="Target" fill="#CBD5E1" radius={[0, 5, 5, 0]} /><Bar dataKey="runningAchievement" name="Capaian" fill="#F2662F" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Perubahan tahunan</p><h2 className="mt-1 text-lg font-bold text-[#172436]">Growth terhadap periode yang sama</h2><div className="mt-5 h-[390px]"><ResponsiveContainer><BarChart data={chartRows} layout="vertical" margin={{ left: 24, right: 55 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} /><YAxis dataKey="shortName" type="category" width={138} tick={{ fontSize: 10 }} /><ReferenceLine x={0} stroke="#64748B" /><Tooltip formatter={(value) => formatPercent(Number(value))} /><Bar dataKey="runningGrowthRate" name="Growth" radius={[0, 5, 5, 0]}>{chartRows.map((row) => <Cell key={row.program} fill={row.runningGrowthRate >= 0 ? "#16A34A" : "#DC2626"} />)}<LabelList dataKey="runningGrowthRate" position="right" formatter={(value: unknown) => formatPercent(Number(value))} fill="#475569" fontSize={10} fontWeight={700} /></Bar></BarChart></ResponsiveContainer></div></div>
    </div>

    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Analisa per divisi</p><h2 className="mt-1 text-lg font-bold text-[#172436]">Target dan capaian periode berjalan per divisi</h2></div><p className="text-xs text-slate-500">Snapshot {periodLabel}</p></div><div className="mt-5 h-[370px]"><ResponsiveContainer><BarChart data={divisionRows} layout="vertical" margin={{ left: 20, right: 36 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} tick={{ fontSize: 10 }} /><YAxis dataKey="division" type="category" width={105} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="runningTarget" name="Target" fill="#CBD5E1" radius={[0, 5, 5, 0]} /><Bar dataKey="runningAchievement" name="Capaian" fill="#172436" radius={[0, 5, 5, 0]}><LabelList dataKey="runningAchievementRate" position="right" formatter={(value: unknown) => formatPercent(Number(value))} fill="#475569" fontSize={10} fontWeight={700} /></Bar></BarChart></ResponsiveContainer></div></div>

    {data && <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Pembacaan utama</p><h2 className="mt-1 text-lg font-bold text-[#172436]">Ringkasan capaian {periodLabel}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Insight icon={TrendingUp} title={`${aboveTarget.length} program melampaui target berjalan`} text={aboveTarget.length ? aboveTarget.map((row) => row.program).join(", ") : "Belum ada program yang mencapai 100%."} tone="green" /><Insight icon={TrendingUp} title={`${positiveGrowth.length} program bertumbuh`} text={strongest ? `Growth tertinggi: ${strongest.program} (${formatPercent(strongest.runningGrowthRate)}).` : ""} tone="green" /><Insight icon={TrendingDown} title="Penurunan terbesar" text={lowest ? `${lowest.program} (${formatPercent(lowest.runningGrowthRate)}) dibanding periode sama tahun lalu.` : ""} tone="red" /><Insight icon={ArrowUpRight} title="Dasar perhitungan" text={`Growth total dihitung dari ${formatNumber(data.totals.runningAchievement)} capaian dibanding ${formatNumber(data.totals.comparableHistory)} peserta pada periode sebanding.`} tone="slate" /></div></div>
      <div className="rounded-[26px] border border-orange-100 bg-orange-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D84315]">Catatan pembacaan</p><h2 className="mt-2 text-xl font-bold text-[#172436]">Perbandingan menggunakan periode yang setara</h2><p className="mt-3 text-sm leading-6 text-slate-600">Growth tidak dihitung dari rata-rata persentase setiap program. Sistem menjumlahkan seluruh capaian periode berjalan, lalu membandingkannya dengan total capaian pada bulan yang sama tahun sebelumnya.</p>{!data.periodMatched && <p className="mt-3 rounded-xl bg-white/75 px-3 py-2 text-xs text-amber-800">Periode analisa belum dapat dicocokkan secara tepat dengan total data Peserta Program. Label memakai bulan terbaru pada sumber utama.</p>}</div>
    </div>}

    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-soft"><div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Rincian analisa</p><h2 className="mt-1 text-lg font-bold text-[#172436]">Kinerja per kelompok program</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="bg-[#172436] text-white"><tr><th className="px-4 py-3">Program</th><th className="px-3 py-3 text-right">Target berjalan</th><th className="px-3 py-3 text-right">Capaian</th><th className="px-3 py-3 text-right">% Capaian</th><th className="px-3 py-3 text-right">Periode sama 2025</th><th className="px-3 py-3 text-right">Growth</th><th className="px-4 py-3 text-right">Target 2026</th></tr></thead><tbody>{data?.rows.map((row, index) => <tr key={row.program} className={index % 2 ? "bg-slate-50" : "bg-white"}><td className="px-4 py-3 font-semibold text-slate-800">{row.program}</td><td className="px-3 py-3 text-right">{formatNumber(row.runningTarget)}</td><td className="px-3 py-3 text-right font-bold">{formatNumber(row.runningAchievement)}</td><td className="px-3 py-3 text-right font-bold">{formatPercent(row.runningAchievementRate)}</td><td className="px-3 py-3 text-right">{formatNumber(row.comparableHistory)}</td><td className={`px-3 py-3 text-right font-bold ${row.runningGrowthRate >= 0 ? "text-emerald-700" : "text-red-600"}`}>{row.runningGrowthRate >= 0 ? "+" : ""}{formatPercent(row.runningGrowthRate)}</td><td className="px-4 py-3 text-right">{formatNumber(row.annualTarget)}</td></tr>)}</tbody></table></div></div>
  </section>;
}

function Insight({ icon: Icon, title, text, tone }: { icon: typeof TrendingUp; title: string; text: string; tone: "green" | "red" | "slate" }) {
  const classes = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <div className={`rounded-2xl p-4 ${classes}`}><Icon size={18} /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 opacity-80">{text}</p></div>;
}
