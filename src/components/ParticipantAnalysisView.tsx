"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, ExternalLink, Grid3X3, RefreshCw, TrendingUp } from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, LineChart, ReferenceArea,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { fetchCachedJson, getCachedJsonSnapshot, subscribeCachedJson } from "@/lib/client-data-cache";
import type { AchievementAnalysis, ParticipantAnalysisData, ParticipantMonthlyGroup } from "@/lib/participant-analysis";
import { AssistantPageContext } from "@/components/AssistantViewContext";
import { finishAssistantAction, useAssistantActions } from "@/components/AssistantActionContext";

const CACHE_KEY = "participant-analysis-v7";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ORANGE = "#F2662F";
const NAVY = "#172436";

type Scope = "program" | "division";
type ViewMode = "summary" | "monthly" | "comparison";
type SummaryRow = { key: string; label: string; pp: AchievementAnalysis; plp: AchievementAnalysis };

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(Math.round(value));
const formatPercent = (value: number) => `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
const metricTone = (value: number) => value >= 100 ? "text-emerald-700" : value >= 70 ? "text-amber-700" : "text-red-600";

function sumMetric(group: ParticipantMonthlyGroup | undefined, start: number, end: number): AchievementAnalysis {
  const points = group?.points.filter((point) => point.monthIndex >= start && point.monthIndex <= end) ?? [];
  const target = points.reduce((sum, point) => sum + point.target, 0);
  const achievement = points.reduce((sum, point) => sum + point.achievement, 0);
  const history = points.reduce((sum, point) => sum + point.history, 0);
  return { target, achievement, history, achievementRate: target > 0 ? achievement / target * 100 : 0, growthRate: history > 0 ? (achievement - history) / history * 100 : 0 };
}

function SummaryMetricCard({ label, metric, kind, onSelect }: { label: string; metric: AchievementAnalysis; kind: "PP" | "PLP"; onSelect?: () => void }) {
  const isPp = kind === "PP";
  const content = <><p className="min-h-8 text-left text-xs font-extrabold leading-4 text-[#172436]">{label}</p>
    <p className="mt-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">Capaian</p>
    <p className={`mt-0.5 text-left text-xl font-extrabold ${isPp ? "text-amber-700" : "text-pink-700"}`}>{formatNumber(metric.achievement)}</p>
    <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-[10px]"><span className="text-left text-slate-400">Target</span><strong className="text-right text-slate-700">{formatNumber(metric.target)}</strong><span className="text-left text-slate-400">History</span><strong className="text-right text-slate-700">{formatNumber(metric.history)}</strong><span className="text-left text-slate-400">% Target</span><strong className={`text-right ${metricTone(metric.achievementRate)}`}>{formatPercent(metric.achievementRate)}</strong><span className="text-left text-slate-400">Growth</span><strong className={`text-right ${metric.growthRate >= 0 ? "text-emerald-700" : "text-red-600"}`}>{metric.growthRate >= 0 ? "+" : ""}{formatPercent(metric.growthRate)}</strong></div>
    {onSelect && <span className="mt-3 flex items-center justify-between border-t border-amber-100 pt-2 text-[9px] font-bold text-amber-700"><span>Analisa bulanan</span><ArrowRight size={12} /></span>}</>;
  const className = `rounded-2xl border bg-white p-3.5 shadow-sm ${isPp ? "border-amber-200" : "border-pink-200"}`;
  if (onSelect) return <button type="button" onClick={onSelect} aria-label={`Buka analisa bulanan ${label}`} className={`${className} cursor-pointer text-left transition duration-200 hover:-translate-y-1 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2`}>{content}</button>;
  return <article className={className}>
    {content}
  </article>;
}

function PortfolioSection({ kind, rows, year, onSelect }: { kind: "PP" | "PLP"; rows: SummaryRow[]; year: number; onSelect?: (row: SummaryRow) => void }) {
  const isPp = kind === "PP";
  return <section>
    <div className="mb-4 flex items-center gap-3"><span className={`rounded-xl px-3 py-2 text-sm font-extrabold text-white ${isPp ? "bg-amber-500" : "bg-pink-600"}`}>{kind}</span><div><h2 className="text-lg font-extrabold text-[#172436]">{isPp ? "Kinerja Peserta Program" : "Kinerja Peserta Layanan Program"}</h2><p className="text-xs text-slate-500">Target, capaian, history, dan growth {year}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">{rows.map((row) => <SummaryMetricCard key={`${kind}-${row.key}`} label={row.label} metric={isPp ? row.pp : row.plp} kind={kind} onSelect={onSelect ? () => onSelect(row) : undefined} />)}</div>
  </section>;
}

function OverallPerformanceSummary({ kind, metric, year, rateReference }: { kind: "PP" | "PLP"; metric: AchievementAnalysis; year: number; rateReference?: Pick<AchievementAnalysis, "achievementRate" | "growthRate"> }) {
  const isPp = kind === "PP";
  const periodAchievementRate = rateReference?.achievementRate ?? metric.achievementRate;
  const periodGrowthRate = rateReference?.growthRate ?? metric.growthRate;
  const accent = isPp ? "text-amber-700" : "text-pink-700";
  const label = isPp ? "Peserta Program" : "Peserta Layanan Program";
  return <section>
    <div className="mb-3"><p className={`text-xs font-bold uppercase tracking-[0.16em] ${isPp ? "text-amber-600" : "text-pink-600"}`}>Ringkasan keseluruhan {kind}</p><h2 className="mt-1 text-2xl font-extrabold text-[#172436]">Kinerja keseluruhan {label} {year}</h2></div>
    <div className={`grid gap-3 md:grid-cols-2 ${rateReference ? "xl:grid-cols-[repeat(4,minmax(0,1fr))_1.45fr]" : "xl:grid-cols-4"}`}>
      <OverallMetricCard label="Capaian keseluruhan" value={formatNumber(metric.achievement)} note={`Total capaian seluruh program ${year}`} valueClass={accent} />
      <OverallMetricCard label="Target keseluruhan" value={formatNumber(metric.target)} note={`Total target seluruh program ${year}`} />
      <OverallMetricCard label="% target keseluruhan" value={formatPercent(metric.achievementRate)} note={`Akumulasi keseluruhan ${year}`} valueClass={metricTone(metric.achievementRate)} />
      <OverallMetricCard label="% growth keseluruhan" value={`${metric.growthRate >= 0 ? "+" : ""}${formatPercent(metric.growthRate)}`} note={`Dibanding history ${formatNumber(metric.history)}`} valueClass={metric.growthRate >= 0 ? "text-emerald-700" : "text-red-600"} />
      {rateReference && <DarkRateCard title={`Kinerja per bulan ${year}`} subtitle="Grand Total data bulanan" targetLabel="% Target per bulan" targetValue={periodAchievementRate} growthLabel="% Growth per bulan" growthValue={periodGrowthRate} />}
    </div>
  </section>;
}

function OverallMetricCard({ label, value, note, valueClass = "text-[#172436]" }: { label: string; value: string; note: string; valueClass?: string }) {
  return <article className="flex min-h-[160px] flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-3 text-2xl font-extrabold ${valueClass}`}>{value}</p><p className="mt-2 text-[10px] leading-4 text-slate-500">{note}</p></article>;
}

function MetricCard({ label, value, note, tone = "navy" }: { label: string; value: string; note: string; tone?: "navy" | "green" | "red" | "orange" }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-600" : tone === "orange" ? "text-[#E64A19]" : "text-[#172436]";
  return <div className="flex min-h-[160px] flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-3 text-2xl font-extrabold ${color}`}>{value}</p><p className="mt-2 text-[10px] leading-4 text-slate-500">{note}</p></div>;
}

function DarkRateCard({ title, subtitle, targetLabel, targetValue, growthLabel, growthValue }: { title: string; subtitle: string; targetLabel: string; targetValue: number; growthLabel: string; growthValue: number }) {
  return <article className="flex min-h-[160px] flex-col justify-center rounded-2xl bg-[#172436] p-4 text-left text-white shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-white/60">{title}</p><p className="mt-1 text-[9px] text-white/45">{subtitle}</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><p className="text-[9px] text-white/55">{targetLabel}</p><p className={`mt-1 text-xl font-extrabold ${targetValue >= 100 ? "text-emerald-300" : targetValue >= 70 ? "text-amber-300" : "text-red-300"}`}>{formatPercent(targetValue)}</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-[9px] text-white/55">{growthLabel}</p><p className={`mt-1 text-xl font-extrabold ${growthValue >= 0 ? "text-emerald-300" : "text-red-300"}`}>{growthValue >= 0 ? "+" : ""}{formatPercent(growthValue)}</p></div></div></article>;
}

function PpTrendAnalysis({ groups, annualTarget, year, latestMonthIndex }: { groups: ParticipantMonthlyGroup[]; annualTarget: number; year: number; latestMonthIndex: number }) {
  const sourceGroups = groups.filter((group) => !/^(grand\s*)?total$/i.test(group.key.trim()));
  const data = MONTHS.slice(0, latestMonthIndex + 1).map((month, monthIndex) => sourceGroups.reduce((result, group) => {
    const point = group.points.find((item) => item.monthIndex === monthIndex);
    return { month, target2026: result.target2026 + (point?.target ?? 0), achievement2026: result.achievement2026 + (point?.achievement ?? 0), achievement2025: result.achievement2025 + (point?.history ?? 0) };
  }, { month, target2026: 0, achievement2026: 0, achievement2025: 0 }));
  const totalTarget = data.reduce((sum, item) => sum + item.target2026, 0);
  const totalAchievement = data.reduce((sum, item) => sum + item.achievement2026, 0);
  const totalHistory = data.reduce((sum, item) => sum + item.achievement2025, 0);
  const periodRate = totalTarget > 0 ? totalAchievement / totalTarget * 100 : 0;
  const growthRate = totalHistory > 0 ? (totalAchievement - totalHistory) / totalHistory * 100 : 0;
  const annualRate = annualTarget > 0 ? totalAchievement / annualTarget * 100 : 0;
  const annualGap = Math.max(annualTarget - totalAchievement, 0);
  const remainingMonths = Math.max(12 - data.length, 0);
  const requiredMonthly = remainingMonths > 0 ? annualGap / remainingMonths : annualGap;
  const highest = data.reduce((best, item) => item.achievement2026 > best.achievement2026 ? item : best, data[0] ?? { month: "-", target2026: 0, achievement2026: 0, achievement2025: 0 });
  const recent = data.slice(-3);
  const previous = data.slice(Math.max(0, data.length - 6), Math.max(0, data.length - 3));
  const recentAverage = recent.length ? recent.reduce((sum, item) => sum + item.achievement2026, 0) / recent.length : 0;
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.achievement2026, 0) / previous.length : 0;
  const momentum = previousAverage > 0 ? (recentAverage - previousAverage) / previousAverage * 100 : 0;
  return <section className="grid gap-4 xl:grid-cols-[1.65fr_0.85fr]">
    <div className="rounded-[22px] border border-amber-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">Tren bulanan PP</p><h3 className="mt-1 text-lg font-extrabold text-[#172436]">Target 2026, capaian 2026, dan capaian 2025</h3><p className="mt-1 text-[10px] text-slate-500">Setiap bulan dijumlahkan dari seluruh program; kolom akumulasi tidak digunakan.</p><div className="mt-4 h-[340px]"><ResponsiveContainer><ComposedChart data={data} margin={{ top: 12, right: 18, left: 2, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(value) => String(value).slice(0, 3)} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => formatNumber(Number(value))} /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="achievement2025" name="Capaian 2025" stroke="#65A30D" strokeWidth={2.5} dot={{ r: 3 }} /><Line type="monotone" dataKey="target2026" name="Target 2026" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} /><Line type="monotone" dataKey="achievement2026" name="Capaian 2026" stroke={ORANGE} strokeWidth={3} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer></div></div>
    <aside className="flex flex-col rounded-[22px] bg-[#172436] p-5 text-white shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-300">Ringkasan analitis</p><h3 className="mt-2 text-xl font-extrabold">Laju capaian Peserta Program</h3><div className="mt-5 space-y-4 text-xs leading-5 text-white/70"><p>Hingga <strong className="text-white">{MONTHS[latestMonthIndex]} {year}</strong>, capaian mencapai <strong className="text-white">{formatNumber(totalAchievement)} peserta</strong> atau <strong className={periodRate >= 100 ? "text-emerald-300" : "text-amber-300"}>{formatPercent(periodRate)}</strong> dari target periode.</p><p>Dibanding periode yang sama {year - 1} sebanyak <strong className="text-white">{formatNumber(totalHistory)}</strong>, kinerja {growthRate >= 0 ? "bertumbuh" : "menurun"} <strong className={growthRate >= 0 ? "text-emerald-300" : "text-red-300"}>{growthRate >= 0 ? "+" : ""}{formatPercent(growthRate)}</strong>.</p><p>Realisasi target tahunan berada di <strong className="text-white">{formatPercent(annualRate)}</strong>. Masih diperlukan <strong className="text-white">{formatNumber(annualGap)} peserta</strong>{remainingMonths > 0 ? <> atau rata-rata <strong className="text-white">{formatNumber(requiredMonthly)} peserta per bulan</strong> selama {remainingMonths} bulan tersisa.</> : "."}</p></div><div className="my-5 border-t border-white/10" /><dl className="space-y-3 text-[10px]"><div className="flex items-center justify-between gap-4"><dt className="text-white/50">Rata-rata capaian bulanan</dt><dd className="font-bold">{formatNumber(totalAchievement / Math.max(data.length, 1))}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-white/50">Capaian bulanan tertinggi</dt><dd className="text-right font-bold">{highest.month} · {formatNumber(highest.achievement2026)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-white/50">Momentum 3 bulan terakhir</dt><dd className={`font-bold ${momentum >= 0 ? "text-emerald-300" : "text-red-300"}`}>{momentum >= 0 ? "+" : ""}{formatPercent(momentum)}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-white/50">Kebutuhan rata-rata berikutnya</dt><dd className="font-bold">{formatNumber(requiredMonthly)}/bulan</dd></div></dl><div className="mt-auto pt-6"><div className="mb-2 flex justify-between text-[9px] text-white/55"><span>Kemajuan target tahunan</span><strong className="text-white">{formatPercent(annualRate)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${annualRate >= 100 ? "bg-emerald-400" : annualRate >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.min(annualRate, 100)}%` }} /></div></div></aside>
  </section>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string | number; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-orange-400">{children}</select></label>;
}

export function ParticipantAnalysisView() {
  const { pending, complete } = useAssistantActions();
  const cached = getCachedJsonSnapshot<ParticipantAnalysisData>(CACHE_KEY);
  const [data, setData] = useState<ParticipantAnalysisData | null>(cached);
  const [view, setView] = useState<ViewMode>("summary");
  const [scope, setScope] = useState<Scope>("program");
  const [startMonthIndex, setStartMonthIndex] = useState(0);
  const [endMonthIndex, setEndMonthIndex] = useState(cached?.monthly?.latestMonthIndex ?? 7);
  const [selectedKey, setSelectedKey] = useState("");
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const load = async (forceRefresh = false) => {
    setIsLoading(true); setError(null);
    try {
      const nextData = await fetchCachedJson<ParticipantAnalysisData>(CACHE_KEY, "/api/participant-analysis", forceRefresh);
      setData(nextData);
      setEndMonthIndex(nextData.monthly.latestMonthIndex);
    }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Data analisa tidak dapat dimuat."); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const stopUpdates = subscribeCachedJson<ParticipantAnalysisData>(CACHE_KEY, "/api/participant-analysis", setData);
    fetchCachedJson<ParticipantAnalysisData>(CACHE_KEY, "/api/participant-analysis")
      .then((nextData) => { if (!cancelled) { setData(nextData); setEndMonthIndex(nextData.monthly.latestMonthIndex); } })
      .catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Data analisa tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) { setIsLoading(false); setInitialLoadDone(true); } });
    return () => { cancelled = true; stopUpdates(); };
  }, []);

  useEffect(() => {
    if (!pending || pending.action.target !== "/analisa-capaian-pp" || !initialLoadDone) return;
    if (!data) { complete(pending.id, error || "Data analisa belum tersedia."); return; }
    const timer = window.setTimeout(() => {
      if (pending.action.highlight === "ranking") setView("comparison");
      else if (pending.action.highlight === "trend" || pending.action.highlight === "summary") setView("summary");
      finishAssistantAction(pending.id, pending.action.highlight, complete);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, initialLoadDone, data, error, complete]);

  const summaryRows = useMemo<SummaryRow[]>(() => scope === "program"
    ? data?.rows.map((row) => ({ key: row.program, label: row.program, pp: row.pp, plp: row.plp })) ?? []
    : data?.divisions.map((row) => ({ key: row.division, label: row.divisionLabel, pp: row.pp, plp: row.plp })) ?? [], [data, scope]);
  const monthlyGroups = useMemo(() => scope === "program" ? data?.monthly?.programs ?? [] : data?.monthly?.divisions ?? [], [data, scope]);
  const selectedGroup = monthlyGroups.find((group) => group.key === selectedKey) ?? monthlyGroups[0];
  const selectedAnnualMetric = summaryRows.find((row) => row.label === selectedGroup?.label)?.pp;
  const periodMetric = useMemo(() => sumMetric(selectedGroup, startMonthIndex, endMonthIndex), [selectedGroup, startMonthIndex, endMonthIndex]);
  const selectedPoints = selectedGroup?.points.filter((point) => point.monthIndex >= startMonthIndex && point.monthIndex <= endMonthIndex) ?? [];
  const snapshot = selectedGroup?.points.find((point) => point.monthIndex === endMonthIndex) ?? selectedGroup?.points.filter((point) => point.monthIndex <= endMonthIndex).at(-1);
  const comparisonRows = useMemo(() => monthlyGroups.map((group) => {
    const point = group.points.find((item) => item.monthIndex === endMonthIndex) ?? group.points.filter((item) => item.monthIndex <= endMonthIndex).at(-1);
    return { key: group.key, label: group.label, targetRate: point?.accumulatedTargetRate ?? 0, growthRate: point?.accumulatedGrowthRate ?? 0, points: group.points };
  }).sort((a, b) => b.targetRate - a.targetRate), [monthlyGroups, endMonthIndex]);
  const periodLabel = `${MONTHS[startMonthIndex]}–${MONTHS[endMonthIndex]} ${data?.year ?? ""}`;

  return <section data-agent-target="summary" className="space-y-5">
    <AssistantPageContext context={{ page: "Analisa Capaian PP dan PLP", filters: { tampilan: view === "summary" ? "Ringkasan PP & PLP" : view === "monthly" ? "Analisa Bulanan" : "Perbandingan Kinerja", cakupan: scope === "program" ? "Per Program" : "Per Divisi", periode: view === "summary" ? `Keseluruhan ${data?.year ?? ""}` : periodLabel }, selection: view === "monthly" ? selectedGroup?.label : undefined, summary: view === "monthly" && selectedGroup ? [`Capaian periode ${formatNumber(periodMetric.achievement)}`, `Target periode ${formatNumber(periodMetric.target)}`, `History periode ${formatNumber(periodMetric.history)}`] : data ? [`Capaian PP keseluruhan ${formatNumber(data.totals.pp.achievement)}`, `Target PP keseluruhan ${formatNumber(data.totals.pp.target)}`, `Capaian PLP keseluruhan ${formatNumber(data.totals.plp.achievement)}`] : [] }} />
    <header className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0D1B2A] via-[#172436] to-[#30405A] p-6 text-white shadow-xl shadow-black/10 lg:p-8"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" /><div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/ikhtisar-pp-plp" className="inline-flex items-center gap-2 text-xs font-semibold text-white/65 hover:text-white"><ArrowLeft size={14} /> Kembali ke Peserta Program</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Analisa Capaian {data?.year ?? ""}</p><h1 className="mt-2 max-w-4xl text-3xl font-extrabold tracking-tight lg:text-4xl">Kinerja Peserta Program dan Peserta Layanan Program</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Ringkasan kinerja, perkembangan bulanan, dan posisi capaian program serta divisi.</p></div><div className="flex flex-wrap gap-2"><a href={view === "monthly" || view === "comparison" ? (scope === "program" ? data?.monthly?.programSourceUrl : data?.monthly?.divisionSourceUrl) : data?.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80 hover:bg-white/10"><ExternalLink size={14} /> Buka sumber</a><button type="button" onClick={() => void load(true)} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#F2662F] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Muat ulang</button></div></div></header>

    {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

    <nav className="grid gap-2 rounded-[20px] border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3"><ViewButton active={view === "summary"} onClick={() => setView("summary")} icon={<Grid3X3 size={15} />} label="Ringkasan PP & PLP" /><ViewButton active={view === "monthly"} onClick={() => setView("monthly")} icon={<BarChart3 size={15} />} label="Analisa Bulanan" /><ViewButton active={view === "comparison"} onClick={() => setView("comparison")} icon={<TrendingUp size={15} />} label="Perbandingan Kinerja" /></nav>

    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">Tampilan data</p><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setScope("program")} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === "program" ? "bg-[#172436] text-white shadow" : "text-slate-500"}`}>Per Program</button><button onClick={() => setScope("division")} className={`rounded-lg px-3 py-2 text-xs font-bold ${scope === "division" ? "bg-[#172436] text-white shadow" : "text-slate-500"}`}>Per Divisi</button></div></div>{view !== "summary" && <div className="grid gap-3 sm:grid-cols-3"><SelectField label="Bulan awal" value={startMonthIndex} onChange={(value) => { const next = Number(value); setStartMonthIndex(next); setEndMonthIndex((current) => Math.max(current, next)); }}>{MONTHS.slice(0, (data?.monthly?.latestMonthIndex ?? 7) + 1).map((month, index) => <option value={index} key={month}>{month}</option>)}</SelectField><SelectField label="Bulan akhir" value={endMonthIndex} onChange={(value) => setEndMonthIndex(Number(value))}>{MONTHS.slice(0, (data?.monthly?.latestMonthIndex ?? 7) + 1).map((month, index) => <option value={index} key={month} disabled={index < startMonthIndex}>{month}</option>)}</SelectField>{view === "monthly" && <SelectField label={scope === "program" ? "Program" : "Divisi"} value={selectedGroup?.key ?? ""} onChange={setSelectedKey}>{monthlyGroups.map((group) => <option value={group.key} key={group.key}>{group.label}</option>)}</SelectField>}</div>}</div>{view !== "summary" && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-500">Angka periode dihitung dari data bulanan. Persentase akumulasi mengambil snapshot {MONTHS[endMonthIndex]}.</p>}</div>

    {!data && <div className="h-96 animate-pulse rounded-[24px] bg-slate-100" />}
    {data && view === "summary" && <div className="space-y-5">
      <section data-agent-target="results" className="space-y-6 rounded-[26px] border border-amber-200 bg-amber-50/70 p-4 sm:p-5"><OverallPerformanceSummary kind="PP" metric={data.totals.pp} year={data.year} rateReference={data.monthlyReference.pp} /><div data-agent-target="trend"><PpTrendAnalysis groups={data.monthly.programs} annualTarget={data.totals.pp.target} year={data.year} latestMonthIndex={data.monthly.latestMonthIndex} /></div><PortfolioSection kind="PP" rows={summaryRows} year={data.year} onSelect={(row) => { const monthlyGroup = monthlyGroups.find((group) => group.label === row.label); if (!monthlyGroup) return; setSelectedKey(monthlyGroup.key); setView("monthly"); }} /></section>
      <section className="space-y-6 rounded-[26px] border border-pink-200 bg-pink-50/65 p-4 sm:p-5"><OverallPerformanceSummary kind="PLP" metric={data.totals.plp} year={data.year} /><PortfolioSection kind="PLP" rows={summaryRows} year={data.year} /></section>
    </div>}
    {data && view === "monthly" && selectedGroup && <MonthlyView group={selectedGroup} points={selectedPoints} metric={periodMetric} annualTarget={selectedAnnualMetric?.target ?? 0} snapshot={snapshot} periodLabel={periodLabel} endMonth={MONTHS[endMonthIndex]} year={data.year} />}
    {data && view === "comparison" && <div data-agent-target="ranking"><ComparisonView rows={comparisonRows} endMonthIndex={endMonthIndex} scope={scope} /></div>}
  </section>;
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition ${active ? "bg-[#F2662F] text-white shadow-md shadow-orange-200" : "text-slate-500 hover:bg-slate-50"}`}>{icon}{label}</button>;
}

function MonthlyView({ group, points, metric, annualTarget, snapshot, periodLabel, endMonth, year }: { group: ParticipantMonthlyGroup; points: ParticipantMonthlyGroup["points"]; metric: AchievementAnalysis; annualTarget: number; snapshot: ParticipantMonthlyGroup["points"][number] | undefined; periodLabel: string; endMonth: string; year: number }) {
  return <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Analisa bulanan {group.label}</p><h2 className="mt-1 text-2xl font-extrabold text-[#172436]">Kinerja periode {periodLabel}</h2></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.45fr]"><MetricCard label="Capaian periode" value={formatNumber(metric.achievement)} note={`Total capaian ${periodLabel}`} tone="orange" /><MetricCard label="Target keseluruhan" value={formatNumber(annualTarget)} note={`Target tahunan ${year}`} /><MetricCard label="% target keseluruhan" value={formatPercent(snapshot?.yearlyTargetRate ?? 0)} note={`Snapshot sampai ${endMonth}`} tone={(snapshot?.yearlyTargetRate ?? 0) >= 100 ? "green" : (snapshot?.yearlyTargetRate ?? 0) >= 70 ? "orange" : "red"} /><MetricCard label="% growth keseluruhan" value={`${(snapshot?.yearlyGrowthRate ?? 0) >= 0 ? "+" : ""}${formatPercent(snapshot?.yearlyGrowthRate ?? 0)}`} note={`Snapshot sampai ${endMonth}`} tone={(snapshot?.yearlyGrowthRate ?? 0) >= 0 ? "green" : "red"} /><DarkRateCard title={`Kinerja periode ${periodLabel}`} subtitle="Dihitung dari data bulanan terpilih" targetLabel="% Target periode" targetValue={metric.achievementRate} growthLabel="% Growth periode" growthValue={metric.growthRate} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]"><ChartPanel title="Target, capaian, dan history per bulan"><ResponsiveContainer><ComposedChart data={points} margin={{ top: 15, right: 15, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(value) => String(value).slice(0, 3)} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => formatNumber(Number(value))} /><Tooltip formatter={(value) => formatNumber(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="target" name="Target" fill="#F59E0B" radius={[5, 5, 0, 0]} /><Bar dataKey="achievement" name="Capaian" fill={NAVY} radius={[5, 5, 0, 0]} /><Line dataKey="history" name="History" stroke="#94A3B8" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer></ChartPanel><ChartPanel title="Persentase kinerja bulanan"><ResponsiveContainer><LineChart data={points} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(value) => String(value).slice(0, 3)} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => formatPercent(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={100} stroke="#16A34A" strokeDasharray="5 4" /><Line dataKey="achievementRate" name="% Target per Bulan" stroke={ORANGE} strokeWidth={2.5} dot={{ r: 4 }} /><Line dataKey="growthRate" name="% Growth per Bulan" stroke={NAVY} strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></ChartPanel></div>
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold text-[#172436]">Rincian bulanan</h3><p className="mt-1 text-[10px] text-slate-500">Persentase periode dihitung dari nilai masing-masing bulan, bukan dari kolom akumulasi.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 text-left">Bulan</th><th className="px-4 py-3 text-right">Target</th><th className="px-4 py-3 text-right">Capaian</th><th className="px-4 py-3 text-right">History</th><th className="px-4 py-3 text-right">% Target</th><th className="px-4 py-3 text-right">Growth</th></tr></thead><tbody>{points.map((point) => <tr key={point.monthIndex} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{point.month}</td><td className="px-4 py-3 text-right">{formatNumber(point.target)}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(point.achievement)}</td><td className="px-4 py-3 text-right">{formatNumber(point.history)}</td><td className={`px-4 py-3 text-right font-bold ${metricTone(point.achievementRate)}`}>{formatPercent(point.achievementRate)}</td><td className={`px-4 py-3 text-right font-bold ${point.growthRate >= 0 ? "text-emerald-700" : "text-red-600"}`}>{point.growthRate >= 0 ? "+" : ""}{formatPercent(point.growthRate)}</td></tr>)}</tbody></table></div></div>
  </div>;
}

type ComparisonRow = { key: string; label: string; targetRate: number; growthRate: number; points: ParticipantMonthlyGroup["points"] };
function comparisonStatus(row: ComparisonRow) {
  return row.targetRate >= 100 ? row.growthRate >= 0 ? "Kinerja kuat" : "Jaga tren" : row.growthRate >= 0 ? "Bertumbuh" : "Prioritas";
}

function statusAction(status: string) {
  if (status === "Kinerja kuat") return "Pertahankan ritme";
  if (status === "Bertumbuh") return "Percepat capaian target";
  if (status === "Jaga tren") return "Evaluasi penurunan";
  return "Fokus pemulihan capaian";
}

function statusClasses(status: string) {
  if (status === "Kinerja kuat") return "bg-emerald-100 text-emerald-800";
  if (status === "Bertumbuh") return "bg-amber-100 text-amber-800";
  if (status === "Jaga tren") return "bg-blue-100 text-blue-800";
  return "bg-red-100 text-red-700";
}

function ComparisonView({ rows, endMonthIndex, scope }: { rows: ComparisonRow[]; endMonthIndex: number; scope: Scope }) {
  const targetScale = Math.max(120, Math.ceil(Math.max(...rows.map((row) => row.targetRate), 100) * 1.12 / 20) * 20);
  const growthMin = Math.min(-20, Math.floor((Math.min(...rows.map((row) => row.growthRate), 0) - 5) / 10) * 10);
  const growthMax = Math.max(20, Math.ceil((Math.max(...rows.map((row) => row.growthRate), 0) + 5) / 10) * 10);

  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#F2662F]">Perbandingan {scope === "program" ? "program" : "divisi"}</p><h2 className="mt-1 text-2xl font-extrabold text-[#172436]">Kinerja sampai {MONTHS[endMonthIndex]} 2026</h2></div>

    <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-extrabold text-[#172436]">Kinerja bulanan terhadap target</h3><p className="mt-1 text-[10px] text-slate-500">Merah &lt;70% · Kuning 70–99,9% · Hijau ≥100%</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-[10px]"><thead><tr><th className="px-2 py-2 text-left text-slate-400">{scope === "program" ? "Program" : "Divisi"}</th>{MONTHS.slice(0, endMonthIndex + 1).map((month) => <th key={month} className="px-2 py-2 text-center text-slate-400">{month.slice(0, 3)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t border-slate-100"><td className="max-w-[160px] px-2 py-2 font-bold text-slate-700">{row.label}</td>{MONTHS.slice(0, endMonthIndex + 1).map((_, monthIndex) => { const value = row.points.find((point) => point.monthIndex === monthIndex)?.achievementRate; return <td key={monthIndex} className="p-1"><div className={`rounded-lg px-1.5 py-2 text-center font-extrabold ${value === undefined ? "bg-slate-100 text-slate-400" : value >= 100 ? "bg-emerald-500 text-white" : value >= 70 ? "bg-amber-300 text-amber-950" : "bg-red-500 text-white"}`}>{value === undefined ? "—" : formatPercent(value)}</div></td>; })}</tr>)}</tbody></table></div></div>

      <PerformanceMap rows={rows} targetScale={targetScale} growthMin={growthMin} growthMax={growthMax} endMonth={MONTHS[endMonthIndex]} scope={scope} />
    </div>

    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h3 className="font-extrabold text-[#172436]">Peringkat kinerja sampai {MONTHS[endMonthIndex]}</h3><p className="mt-1 text-[10px] text-slate-500">Urutan berdasarkan persentase target akumulasi. Posisi dan tindak lanjut membaca capaian target bersama arah pertumbuhannya.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">{scope === "program" ? "Program" : "Divisi"}</th><th className="px-4 py-3 text-right">% Target Akumulasi</th><th className="px-4 py-3 text-right">% Growth Akumulasi</th><th className="px-4 py-3 text-left">Posisi</th><th className="px-4 py-3 text-left">Arah tindak lanjut</th></tr></thead><tbody>{rows.map((row, index) => { const status = comparisonStatus(row); return <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-4 py-3 text-slate-400">{index + 1}</td><td className="px-4 py-3 font-bold text-slate-700">{row.label}</td><td className={`px-4 py-3 text-right font-bold ${metricTone(row.targetRate)}`}>{formatPercent(row.targetRate)}</td><td className={`px-4 py-3 text-right font-bold ${row.growthRate >= 0 ? "text-emerald-700" : "text-red-600"}`}>{row.growthRate >= 0 ? "+" : ""}{formatPercent(row.growthRate)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${statusClasses(status)}`}>{status}</span></td><td className="px-4 py-3 text-[10px] text-slate-500">{statusAction(status)}</td></tr>; })}</tbody></table></div></div>
  </div>;
}

function PerformanceMap({ rows, targetScale, growthMin, growthMax, endMonth, scope }: { rows: ComparisonRow[]; targetScale: number; growthMin: number; growthMax: number; endMonth: string; scope: Scope }) {
  return <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-extrabold text-[#172436]">Peta Kinerja Akumulasi</h3>
    <p className="mt-1 text-[10px] text-slate-500">Posisi {scope === "program" ? "program" : "divisi"} berdasarkan capaian target dan pertumbuhan sampai {endMonth}</p>
    <div className="mt-4 grid grid-cols-2 gap-5 px-2 text-[9px] leading-3.5">
        <QuadrantLabel title="Bertumbuh — belum mencapai target" description="Growth positif, namun target belum tercapai." tone="amber" />
        <QuadrantLabel title="Kinerja kuat — target tercapai dan bertumbuh" description="Target tercapai dan growth positif." tone="green" align="right" />
    </div>
    <div className="mt-1 h-[305px] min-w-0">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 80, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
          <ReferenceArea x1={0} x2={100} y1={0} y2={growthMax} fill="#FEF3C7" fillOpacity={0.5} />
          <ReferenceArea x1={100} x2={targetScale} y1={0} y2={growthMax} fill="#D1FAE5" fillOpacity={0.5} />
          <ReferenceArea x1={0} x2={100} y1={growthMin} y2={0} fill="#FEE2E2" fillOpacity={0.5} />
          <ReferenceArea x1={100} x2={targetScale} y1={growthMin} y2={0} fill="#DBEAFE" fillOpacity={0.5} />
          <XAxis type="number" dataKey="targetRate" domain={[0, targetScale]} tick={{ fontSize: 9 }} tickFormatter={(value) => `${value}%`} />
          <YAxis type="number" dataKey="growthRate" domain={[growthMin, growthMax]} tick={{ fontSize: 9 }} tickFormatter={(value) => `${value}%`} label={{ value: "% Growth Akumulasi", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748B" }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [formatPercent(Number(value)), name === "targetRate" ? "% Target Akumulasi" : "% Growth Akumulasi"]} labelFormatter={(_, payload) => payload[0]?.payload?.label ?? ""} />
          <ReferenceLine x={100} stroke="#64748B" strokeDasharray="5 4" />
          <ReferenceLine y={0} stroke="#64748B" strokeDasharray="5 4" />
          <Scatter data={rows} fill={ORANGE}>
            <LabelList dataKey="label" position="right" style={{ fill: "#334155", fontSize: 8, fontWeight: 700 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
    <div className="-mt-0.5 grid grid-cols-[1fr_auto_1fr] items-start gap-4 px-2 text-[9px] leading-3.5">
      <QuadrantLabel title="Prioritas — target dan growth rendah" description="Belum mencapai target dan growth negatif." tone="red" />
      <p className="pt-1 text-center text-[10px] font-medium text-slate-500">% Target Akumulasi</p>
      <QuadrantLabel title="Jaga tren — target tercapai, growth menurun" description="Target tercapai, namun growth negatif." tone="blue" align="right" />
    </div>
  </div>;
}

function QuadrantLabel({ title, description, tone, align = "left" }: { title: string; description: string; tone: "green" | "amber" | "red" | "blue"; align?: "left" | "right" }) {
  const color = tone === "green" ? "text-emerald-800" : tone === "amber" ? "text-amber-800" : tone === "red" ? "text-red-700" : "text-blue-800";
  return <div className={`${align === "right" ? "text-right" : "text-left"} ${color}`}><p className="font-extrabold">{title}</p><p className="mt-0.5 font-medium opacity-75">{description}</p></div>;
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-extrabold text-[#172436]">{title}</h3><div className="mt-4 h-[340px]">{children}</div></div>;
}
