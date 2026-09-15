"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink, RefreshCw, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";
import type { AchievementAnalysis, ParticipantAnalysisData } from "@/lib/participant-analysis";

const CACHE_KEY = "participant-analysis-v3";
const PP_COLOR = "#E9A400";
const PLP_COLOR = "#D94A83";
const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(Math.round(value));
const formatPercent = (value: number) => `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;

type Scope = "program" | "division";
type CardRow = { key: string; title: string; shortTitle: string; abbreviation?: string; pp: AchievementAnalysis; plp: AchievementAnalysis };

function MiniMetric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return <div className="rounded-xl border border-white/80 bg-white/75 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-sm font-extrabold ${tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-600" : "text-slate-700"}`}>{value}</p></div>;
}

function SummaryCard({ kind, metric, year }: { kind: "PP" | "PLP"; metric: AchievementAnalysis; year: number }) {
  const isPp = kind === "PP";
  return <article className={`relative overflow-hidden rounded-[26px] border p-5 shadow-soft ${isPp ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-pink-200 bg-gradient-to-br from-pink-50 to-white"}`}>
    <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full ${isPp ? "bg-amber-300/20" : "bg-pink-300/20"}`} />
    <div className="relative flex items-start justify-between gap-4"><div><p className={`text-[11px] font-extrabold uppercase tracking-[0.16em] ${isPp ? "text-amber-700" : "text-pink-700"}`}>{isPp ? "Peserta Program (PP)" : "Peserta Layanan Program (PLP)"}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-[#172436]">{formatNumber(metric.achievement)}</p><p className="mt-1 text-xs text-slate-500">Capaian {year}</p></div><span className={`grid h-11 w-11 place-items-center rounded-2xl ${isPp ? "bg-amber-100 text-amber-700" : "bg-pink-100 text-pink-700"}`}>{isPp ? <Users size={21} /> : <Target size={21} />}</span></div>
    <div className="relative mt-5 grid grid-cols-3 gap-2"><MiniMetric label="Target" value={formatNumber(metric.target)} /><MiniMetric label="History" value={formatNumber(metric.history)} /><MiniMetric label="Growth" value={`${metric.growthRate >= 0 ? "+" : ""}${formatPercent(metric.growthRate)}`} tone={metric.growthRate >= 0 ? "positive" : "negative"} /></div>
    <div className="relative mt-4"><div className="flex items-end justify-between"><span className="text-[11px] font-semibold text-slate-500">Realisasi target</span><strong className={metric.achievementRate >= 100 ? "text-emerald-700" : metric.achievementRate >= 70 ? "text-amber-700" : "text-red-600"}>{formatPercent(metric.achievementRate)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${metric.achievementRate >= 100 ? "bg-emerald-500" : metric.achievementRate >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(metric.achievementRate, 100)}%` }} /></div></div>
  </article>;
}

function MetricPanel({ kind, metric }: { kind: "PP" | "PLP"; metric: AchievementAnalysis }) {
  const isPp = kind === "PP";
  return <div className={`p-5 ${isPp ? "bg-amber-50/65" : "border-t border-pink-100 bg-pink-50/60 md:border-l md:border-t-0"}`}>
    <div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isPp ? "bg-amber-200/70 text-amber-800" : "bg-pink-200/70 text-pink-800"}`}>{kind}</span><span className={`inline-flex items-center gap-1 text-xs font-extrabold ${metric.growthRate >= 0 ? "text-emerald-700" : "text-red-600"}`}>{metric.growthRate >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{metric.growthRate >= 0 ? "+" : ""}{formatPercent(metric.growthRate)}</span></div>
    <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Capaian</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-[#172436]">{formatNumber(metric.achievement)}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><MiniMetric label="Target" value={formatNumber(metric.target)} /><MiniMetric label="History" value={formatNumber(metric.history)} /></div>
    <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${isPp ? "bg-amber-500" : "bg-pink-500"}`} style={{ width: `${Math.min(metric.achievementRate, 100)}%` }} /></div><strong className="min-w-[52px] text-right text-xs text-slate-700">{formatPercent(metric.achievementRate)}</strong></div>
  </div>;
}

function PerformanceCard({ row }: { row: CardRow }) {
  return <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
    <header className="flex min-h-[74px] items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-extrabold leading-5 text-[#172436]">{row.title}</h3>{row.abbreviation && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{row.abbreviation}</p>}</div><ArrowUpRight size={17} className="shrink-0 text-slate-300" /></header>
    <div className="grid md:grid-cols-2"><MetricPanel kind="PP" metric={row.pp} /><MetricPanel kind="PLP" metric={row.plp} /></div>
  </article>;
}

export function ParticipantAnalysisView() {
  const cached = getCachedJsonSnapshot<ParticipantAnalysisData>(CACHE_KEY);
  const [data, setData] = useState<ParticipantAnalysisData | null>(cached);
  const [scope, setScope] = useState<Scope>("program");
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

  const rows = useMemo<CardRow[]>(() => scope === "program"
    ? data?.rows.map((row) => ({ key: row.program, title: row.program, shortTitle: row.program.replace("Lingkungan dan sosial", "Lingkungan & sosial").replace("Siaga Bencana & Kemanusiaan", "Siaga Bencana"), pp: row.pp, plp: row.plp })) ?? []
    : data?.divisions.map((row) => ({ key: row.division, title: row.divisionLabel, shortTitle: row.division.replace("Project Div", "Project").replace("Dakwah Div", "Dakwah"), abbreviation: row.divisionLabel !== row.division ? row.division : undefined, pp: row.pp, plp: row.plp })) ?? [], [data, scope]);
  const chartRows = useMemo(() => rows.map((row) => ({ name: row.shortTitle, ppRate: row.pp.achievementRate, plpRate: row.plp.achievementRate, ppGrowth: row.pp.growthRate, plpGrowth: row.plp.growthRate })), [rows]);
  const reachedPp = rows.filter((row) => row.pp.achievementRate >= 100).length;
  const reachedPlp = rows.filter((row) => row.plp.achievementRate >= 100).length;
  const bestPp = rows.reduce<CardRow | null>((best, row) => !best || row.pp.achievementRate > best.pp.achievementRate ? row : best, null);
  const bestPlp = rows.reduce<CardRow | null>((best, row) => !best || row.plp.achievementRate > best.plp.achievementRate ? row : best, null);

  return <section className="space-y-6">
    <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-6 text-white shadow-xl shadow-black/15 lg:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/ikhtisar-pp-plp" className="inline-flex items-center gap-2 text-xs font-semibold text-white/65 transition hover:text-white"><ArrowLeft size={14} /> Kembali ke Peserta Program</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Analisa Capaian {data?.year ?? ""}</p><h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight lg:text-4xl">Kinerja Peserta Program dan Peserta Layanan Program</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Capaian, target, history, realisasi target, dan growth disajikan per program serta per divisi. Kolom periode berwarna biru pada sumber tidak digunakan.</p></div><div className="flex flex-wrap gap-2"><a href={data?.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 hover:bg-white/10"><ExternalLink size={14} /> Buka sumber</a><button type="button" onClick={() => void load(true)} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#F2662F] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Muat ulang</button></div></div>
    </div>

    {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-2">{data ? <><SummaryCard kind="PP" metric={data.totals.pp} year={data.year} /><SummaryCard kind="PLP" metric={data.totals.plp} year={data.year} /></> : <><div className="h-64 animate-pulse rounded-[26px] bg-slate-100" /><div className="h-64 animate-pulse rounded-[26px] bg-slate-100" /></>}</div>

    <div className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-soft"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setScope("program")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${scope === "program" ? "bg-[#172436] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}>Analisa per Program</button><button type="button" onClick={() => setScope("division")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${scope === "division" ? "bg-[#172436] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}>Analisa per Divisi</button></div></div>

    <div><div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Portofolio {scope === "program" ? "program" : "divisi"}</p><h2 className="mt-1 text-xl font-extrabold text-[#172436]">Kartu kinerja PP dan PLP</h2></div><p className="text-xs text-slate-500">Kuning: PP · Pink: PLP</p></div><div className="grid gap-4 xl:grid-cols-2">{rows.map((row) => <PerformanceCard key={row.key} row={row} />)}</div></div>

    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard eyebrow="Realisasi target" title={`Persentase capaian per ${scope === "program" ? "program" : "divisi"}`}><ResponsiveContainer><BarChart data={chartRows} layout="vertical" margin={{ left: 22, right: 46 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" width={128} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => formatPercent(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine x={100} stroke="#16A34A" strokeDasharray="4 4" /><Bar dataKey="ppRate" name="PP" fill={PP_COLOR} radius={[0, 5, 5, 0]}><LabelList dataKey="ppRate" position="right" formatter={(value: unknown) => formatPercent(Number(value))} fill="#475569" fontSize={9} fontWeight={700} /></Bar><Bar dataKey="plpRate" name="PLP" fill={PLP_COLOR} radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard eyebrow="Perubahan terhadap history" title={`Growth per ${scope === "program" ? "program" : "divisi"}`}><ResponsiveContainer><BarChart data={chartRows} layout="vertical" margin={{ left: 22, right: 46 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" /><XAxis type="number" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" width={128} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => formatPercent(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine x={0} stroke="#64748B" /><Bar dataKey="ppGrowth" name="PP" fill={PP_COLOR} radius={[0, 5, 5, 0]}><LabelList dataKey="ppGrowth" position="right" formatter={(value: unknown) => formatPercent(Number(value))} fill="#475569" fontSize={9} fontWeight={700} /></Bar><Bar dataKey="plpGrowth" name="PLP" fill={PLP_COLOR} radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></ChartCard>
    </div>

    {rows.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Insight label="PP mencapai target" value={`${reachedPp} dari ${rows.length}`} note={bestPp ? `Tertinggi: ${bestPp.title} (${formatPercent(bestPp.pp.achievementRate)})` : ""} tone="amber" /><Insight label="PLP mencapai target" value={`${reachedPlp} dari ${rows.length}`} note={bestPlp ? `Tertinggi: ${bestPlp.title} (${formatPercent(bestPlp.plp.achievementRate)})` : ""} tone="pink" /><Insight label="Basis perbandingan" value="History sumber" note="Growth dihitung dari capaian terhadap history masing-masing kelompok." tone="slate" /><Insight label="Cakupan analisa" value={`${rows.length} ${scope === "program" ? "program" : "divisi"}`} note="Data periode biru dikecualikan sesuai struktur sumber." tone="slate" /></div>}
  </section>;
}

function ChartCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">{eyebrow}</p><h2 className="mt-1 text-lg font-bold text-[#172436]">{title}</h2><div className="mt-5 h-[390px]">{children}</div></div>;
}

function Insight({ label, value, note, tone }: { label: string; value: string; note: string; tone: "amber" | "pink" | "slate" }) {
  const classes = tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "pink" ? "border-pink-200 bg-pink-50" : "border-slate-200 bg-white";
  return <div className={`rounded-[20px] border p-4 ${classes}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold text-[#172436]">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p></div>;
}
