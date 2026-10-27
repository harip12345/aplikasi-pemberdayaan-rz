"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Building2, Database, ExternalLink, GraduationCap, HeartPulse, Landmark, Leaf, MapPin, MoonStar, RefreshCw, Search, Target, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/data/dashboard";
import { fetchCachedJson, getCachedJsonSnapshot, subscribeCachedJson } from "@/lib/client-data-cache";
import type { DashboardSheetData, DashboardSheetMetric } from "@/lib/dashboard-sheets";
import type { ProgramImpactAnalysis, ProgramImpactBreakdown, ProgramImpactData, ProgramImpactLocationDetail, ProgramImpactParticipantDetail } from "@/lib/program-impact-sheets";
import { achievementTone } from "@/lib/achievement-tone";
import { AssistantPageContext } from "@/components/AssistantViewContext";

const HEALTH_IMPACT_SOURCE = "https://docs.google.com/spreadsheets/d/1sc6zAqxX-ZogtAbwm7eLD1NHcAOQCiT2LHt1TdxqPAU/edit?gid=529116641#gid=529116641";

type ProgramId = "ekonomi" | "pendidikan" | "kesehatan" | "lingkungan" | "dakwah";
type ImpactIndicator = { id: string; label: string; target: number | null; unit: string; metricId?: string; href?: string; sourceLabel?: string; sourceUrl?: string };
type ProgramDefinition = { id: ProgramId; name: string; eyebrow: string; description: string; outcome: string; icon: LucideIcon; color: string; softColor: string; indicators: ImpactIndicator[] };

const EconomicImpactChart = dynamic(() => import("@/components/EconomicImpactChart").then((module) => module.EconomicImpactChart), { loading: () => <div className="h-[405px] animate-pulse rounded-[24px] bg-slate-100" /> });

const programs: ProgramDefinition[] = [
  { id: "ekonomi", name: "Program Ekonomi", eyebrow: "Kemandirian ekonomi mustahik", description: "Mengukur perubahan posisi ekonomi peserta setelah menerima intervensi dan pendampingan program.", outcome: "Dampak diarahkan pada peningkatan kemandirian: mustahik keluar dari garis kemiskinan, tumbuh menjadi muzaki, atau mulai berkontribusi sebagai munfik.", icon: BriefcaseBusiness, color: "#D94F1E", softColor: "#FFF1EB", indicators: [
    { id: "gk", label: "Mustahik keluar dari garis kemiskinan", target: null, unit: "orang", metricId: "garis-kemiskinan", href: "/garis-kemiskinan" },
    { id: "muzzaki", label: "Mustahik menjadi Muzaki", target: null, unit: "orang", metricId: "muzzaki", href: "/muzzaki" },
    { id: "munfik", label: "Mustahik menjadi Munfik", target: null, unit: "orang", metricId: "munfik", href: "/munfik" },
  ] },
  { id: "pendidikan", name: "Program Pendidikan", eyebrow: "Kompetensi dan keberlanjutan penghidupan", description: "Menilai hasil pembelajaran vokasi, transisi peserta ke dunia kerja, kewirausahaan, dan capaian tahfiz.", outcome: "Ruang dampak pendidikan disiapkan untuk membaca perubahan kompetensi peserta dan keberlanjutan hasil setelah program selesai.", icon: GraduationCap, color: "#CA8A04", softColor: "#FEFCE8", indicators: [
    { id: "vokasi-keahlian", label: "Peserta program vokasi dengan keahlian", target: 525, unit: "orang" },
    { id: "terserap-kerja", label: "Peserta program vokasi terserap kerja", target: 157, unit: "orang" },
    { id: "wirausaha", label: "Peserta program vokasi berwirausaha", target: 105, unit: "orang" },
    { id: "hafiz", label: "Peserta program Hafidz 30 juz", target: 10, unit: "orang" },
  ] },
  { id: "kesehatan", name: "Program Kesehatan", eyebrow: "Ketahanan kesehatan keluarga", description: "Memantau perbaikan status gizi anak serta penguatan layanan dan kader kesehatan berbasis masyarakat.", outcome: "Dampak kesehatan akan menampilkan perubahan status anak dan kapasitas ekosistem Posyandu ketika sumber capaian tersedia.", icon: HeartPulse, color: "#0EA5E9", softColor: "#F0F9FF", indicators: [
    { id: "stunting", label: "Anak keluar dari risiko stunting", target: 1500, unit: "anak" },
    { id: "posyandu", label: "Posyandu binaan", target: 100, unit: "unit", sourceLabel: "Resume · kolom W", sourceUrl: HEALTH_IMPACT_SOURCE },
    { id: "kader", label: "Kader Posyandu binaan", target: 500, unit: "orang", sourceLabel: "Resume · kolom X", sourceUrl: HEALTH_IMPACT_SOURCE },
  ] },
  { id: "lingkungan", name: "Program Lingkungan", eyebrow: "Ketahanan lingkungan berbasis komunitas", description: "Menggambarkan tumbuhnya titik pengelolaan sampah dan pemulihan lingkungan yang dikelola bersama warga.", outcome: "Capaian lingkungan memotret jangkauan Bank Sampah dan pelestarian mangrove berbasis desa. Detail lokasi membantu membaca sebaran implementasi dan peluang penguatan antarwilayah.", icon: Leaf, color: "#15803D", softColor: "#F0FDF4", indicators: [
    { id: "bank-sampah", label: "Bank Sampah", target: 60, unit: "titik" },
    { id: "mangrove", label: "Desa Lestari Mangrove", target: 5, unit: "titik" },
    { id: "tps3r", label: "TPS3R", target: null, unit: "titik" },
  ] },
  { id: "dakwah", name: "Program Dakwah", eyebrow: "Penguatan pembinaan dan kelembagaan umat", description: "Mengukur keberlanjutan pembinaan peserta dan tumbuhnya masjid sebagai pusat pemberdayaan masyarakat.", outcome: "Capaian dakwah memotret jangkauan pembinaan peserta dan sebaran Masjid Berdaya sebagai pusat aktivitas serta pemberdayaan masyarakat.", icon: MoonStar, color: "#22C55E", softColor: "#F0FDF4", indicators: [
    { id: "masjid", label: "Masjid Berdaya", target: 25, unit: "titik" },
    { id: "pp-terbina", label: "Peserta Program Terbina", target: 15000, unit: "orang", href: "/pp-terbina" },
  ] },
];

function achievementThrough(metric: DashboardSheetMetric, monthIndex: number) { return metric.monthly.slice(0, monthIndex + 1).reduce((total, value) => total + value, 0); }
function latestDataMonth(metric: DashboardSheetMetric) { return metric.monthly.reduce((latest, value, index) => value !== 0 ? index : latest, -1); }

export function DampakProgramView({ indicatorId, initialProgram }: { indicatorId?: string; initialProgram?: string }) {
  const [activeProgramId, setActiveProgramId] = useState<ProgramId>(programs.some((program) => program.id === initialProgram) ? initialProgram as ProgramId : "ekonomi");
  const cachedDashboard = getCachedJsonSnapshot<DashboardSheetData>("dashboard-sheet-production-v2");
  const cachedProgramImpact = getCachedJsonSnapshot<ProgramImpactData>("program-impact-production-v6");
  const [sheetData, setSheetData] = useState<DashboardSheetData | null>(cachedDashboard);
  const [programImpact, setProgramImpact] = useState<ProgramImpactData | null>(cachedProgramImpact);
  const [isLoading, setIsLoading] = useState(!cachedDashboard || !cachedProgramImpact);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailQuery, setDetailQuery] = useState("");

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true); setLoadError(null);
    try {
      const [dashboard, impact] = await Promise.all([
        fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", forceRefresh),
        fetchCachedJson<ProgramImpactData>("program-impact-production-v6", "/api/program-impact", forceRefresh),
      ]);
      setSheetData(dashboard); setProgramImpact(impact);
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Data dampak belum dapat dimuat."); }
    finally { setIsLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    const stopDashboardUpdates = subscribeCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", setSheetData);
    const stopImpactUpdates = subscribeCachedJson<ProgramImpactData>("program-impact-production-v6", "/api/program-impact", setProgramImpact);
    Promise.all([
      fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard"),
      fetchCachedJson<ProgramImpactData>("program-impact-production-v6", "/api/program-impact"),
    ])
      .then(([dashboard, impact]) => { if (!cancelled) { setSheetData(dashboard); setProgramImpact(impact); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data dampak belum dapat dimuat."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; stopDashboardUpdates(); stopImpactUpdates(); };
  }, []);

  const routeProgram = indicatorId ? programs.find((program) => program.indicators.some((indicator) => indicator.id === indicatorId)) : undefined;
  const activeProgram = routeProgram ?? programs.find((program) => program.id === activeProgramId)!;
  const metricMap = useMemo(() => new Map(sheetData?.metrics.map((metric) => [metric.id, metric]) ?? []), [sheetData]);
  const impactMap = useMemo(() => new Map<string, ProgramImpactData["indicators"][number]>(programImpact?.indicators.map((indicator) => [indicator.id, indicator]) ?? []), [programImpact]);
  const year = sheetData?.year ?? 2026;
  const months = sheetData?.months ?? [];
  const activeIndicators = useMemo(() => activeProgram.indicators.map((indicator) => {
    const metric = indicator.metricId ? metricMap.get(indicator.metricId) : undefined;
    const linkedImpact = impactMap.get(indicator.id);
    const achievement = metric && sheetData ? achievementThrough(metric, sheetData.latestMonthIndex) : linkedImpact?.achievement ?? null;
    const target = metric?.target || indicator.target;
    const percentage = target && achievement !== null ? Math.round((achievement / target) * 100) : null;
    const monthIndex = metric ? latestDataMonth(metric) : -1;
    return { ...indicator, target, achievement, percentage, monthIndex, dataThrough: linkedImpact?.dataThrough, sourceLabel: linkedImpact?.sourceLabel ?? indicator.sourceLabel, sourceUrl: linkedImpact?.sourceUrl ?? indicator.sourceUrl, details: linkedImpact?.details, participantDetails: linkedImpact?.participantDetails, analysis: linkedImpact?.analysis };
  }), [activeProgram, impactMap, metricMap, sheetData]);
  const economicIndicators = activeProgramId === "ekonomi" ? activeIndicators.filter((indicator) => indicator.achievement !== null) : [];
  const chartData = economicIndicators.map((indicator) => ({ name: indicator.id === "gk" ? "Keluar GK" : indicator.id === "muzzaki" ? "Muzaki" : "Munfik", target: indicator.target ?? 0, capaian: indicator.achievement ?? 0 }));
  const economicTotals = economicIndicators.reduce((totals, indicator) => ({ target: totals.target + (indicator.target ?? 0), achievement: totals.achievement + (indicator.achievement ?? 0) }), { target: 0, achievement: 0 });
  const aggregatePercentage = economicTotals.target > 0 ? Math.round((economicTotals.achievement / economicTotals.target) * 100) : 0;
  const aggregateTone = achievementTone(aggregatePercentage);
  const strongestIndicator = [...economicIndicators].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
  const periodLabel = sheetData ? `${months[0]} - ${months[sheetData.latestMonthIndex]} ${year}` : `Tahun ${year}`;
  const connectedIndicators = activeIndicators.filter((indicator) => indicator.achievement !== null);
  const connectedChartData = connectedIndicators.map((indicator) => ({ name: indicator.id === "terserap-kerja" ? "Terserap Kerja" : indicator.id === "wirausaha" ? "Berwirausaha" : indicator.id === "hafiz" ? "Hafidz 30 Juz" : indicator.id === "pp-terbina" ? "PP Terbina" : indicator.label, target: indicator.target ?? 0, capaian: indicator.achievement ?? 0 }));

  const detailIndicator = indicatorId ? activeIndicators.find((indicator) => indicator.id === indicatorId) : undefined;
  if (detailIndicator) return <section className="space-y-6">
    <AssistantPageContext context={{ page: `Analisis Dampak ${detailIndicator.label}`, filters: { program: activeProgram.name }, selection: detailIndicator.label, summary: detailIndicator.achievement === null ? [] : [`Capaian: ${formatNumber(detailIndicator.achievement)} ${detailIndicator.unit}`, `Target: ${detailIndicator.target === null ? "belum tersedia" : formatNumber(detailIndicator.target)}`] }} />
    <Link href={`/dampak-program?program=${activeProgram.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:text-primary"><ArrowLeft size={16} /> Kembali ke Dampak {activeProgram.name.replace("Program ", "")}</Link>
    <ImpactInsightPage indicator={detailIndicator} program={activeProgram} query={detailQuery} onQueryChange={setDetailQuery} />
  </section>;

  return <section className="space-y-7">
    <AssistantPageContext context={{ page: "Dampak Program Pemberdayaan", filters: { periode: periodLabel, program: activeProgram.name }, summary: activeIndicators.filter((indicator) => indicator.achievement !== null).slice(0, 8).map((indicator) => `${indicator.label}: capaian ${formatNumber(indicator.achievement ?? 0)}, target ${indicator.target == null ? "belum tersedia" : formatNumber(indicator.target)}`) }} />
    <div data-agent-target="summary" className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-7 text-white shadow-xl shadow-slate-900/15 lg:p-9">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Kerangka Dampak 2026</div><h1 className="mt-4 text-3xl font-bold md:text-4xl">Dampak Program Pemberdayaan</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Visualisasi berfokus pada perubahan yang dihasilkan program, bukan hanya jumlah penyaluran. Pilih program untuk melihat indikator, target, capaian, dan kesiapan datanya.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md"><div className="flex items-center justify-between gap-6"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Periode data dampak</p><p className="mt-1 text-sm font-semibold">{periodLabel}</p></div><button type="button" onClick={() => void loadData(true)} disabled={isLoading} aria-label="Muat ulang data dampak" className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /></button></div><p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50"><Database size={12} /> Data dampak tersedia menurut sumber setiap indikator</p></div>
      </div>
    </div>

    {loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError} Capaian yang belum terverifikasi tidak ditampilkan agar tidak menggunakan angka perkiraan.</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="tablist" aria-label="Pilih kelompok program dampak">
      {programs.map((program) => { const Icon = program.icon; const active = activeProgramId === program.id; const hasData = program.id === "ekonomi" ? Boolean(sheetData) : program.indicators.some((indicator) => impactMap.has(indicator.id)); return <button key={program.id} type="button" role="tab" aria-selected={active} onClick={() => { setActiveProgramId(program.id); window.history.replaceState(null, "", `/dampak-program?program=${program.id}`); }} className={`rounded-[22px] border p-4 text-left transition ${active ? "border-transparent text-white shadow-lg" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-soft"}`} style={active ? { backgroundColor: program.color } : undefined}><div className="flex items-center justify-between gap-3"><span className={`rounded-xl p-2 ${active ? "bg-white/15" : "bg-slate-100"}`}><Icon size={18} /></span><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${active ? "bg-white/15 text-white/80" : hasData ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{hasData ? "Data aktif" : "Kerangka"}</span></div><p className="mt-3 text-sm font-bold">{program.name}</p><p className={`mt-1 text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{program.indicators.length} indikator dampak</p></button>; })}
    </div>

    <div data-agent-target="results" className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 p-6 lg:p-7" style={{ backgroundColor: activeProgram.softColor }}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: activeProgram.color }}>{activeProgram.eyebrow}</p><h2 className="mt-2 text-2xl font-bold text-ink">{activeProgram.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{activeProgram.description}</p></div><div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600"><Target size={15} style={{ color: activeProgram.color }} /> Target dampak {year}</div></div></div>
      <div className="p-6 lg:p-7">
        {activeProgramId === "ekonomi" ? <div className="space-y-7">
          <div className="grid gap-4 lg:grid-cols-3">{activeIndicators.map((indicator) => <ImpactMetricCard key={indicator.id} indicator={indicator} months={months} color={activeProgram.color} isLoading={isLoading} detailHref={`${indicator.href}?from=dampak-program&program=ekonomi`} />)}</div>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <EconomicImpactChart data={chartData} isLoading={isLoading} />
            <div className="flex flex-col justify-between rounded-[24px] bg-[#172334] p-6 text-white"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Narasi dampak</p><h3 className="mt-2 text-xl font-bold">Pergerakan menuju kemandirian</h3><p className="mt-4 text-sm leading-7 text-white/70">{activeProgram.outcome}</p>{strongestIndicator && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">Pada periode ini, progres relatif tertinggi terdapat pada <strong className="text-white">{strongestIndicator.label}</strong> dengan capaian <strong className="text-orange-300">{formatNumber(strongestIndicator.achievement ?? 0)} {strongestIndicator.unit}</strong> atau {strongestIndicator.percentage}% dari target.</p>}</div><div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-white/45">Agregat tiga indikator</p><p className="mt-1 text-3xl font-bold" style={{ color: aggregateTone.color }}>{isLoading ? "—" : `${aggregatePercentage}%`}</p></div><p className="text-right text-[11px] leading-5 text-white/50">Perbandingan total capaian<br />terhadap total target</p></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(aggregatePercentage, 100)}%`, backgroundColor: aggregateTone.color }} /></div></div></div>
          </div>
        </div> : connectedIndicators.length > 0 ? <div className="space-y-7">
          <div className={`grid gap-4 sm:grid-cols-2 ${activeProgramId === "dakwah" ? "xl:grid-cols-2" : activeProgramId === "lingkungan" || activeProgramId === "kesehatan" ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>{activeIndicators.map((indicator) => indicator.achievement !== null
            ? <ImpactMetricCard key={indicator.id} indicator={indicator} months={months} color={activeProgram.color} isLoading={isLoading} detailHref={indicator.href ? `${indicator.href}?from=dampak-program&program=${activeProgram.id}` : `/dampak-program/indikator/${indicator.id}`} />
            : <PendingIndicatorCard key={indicator.id} indicator={indicator} color={activeProgram.color} softColor={activeProgram.softColor} detailHref={`/dampak-program/indikator/${indicator.id}`} />)}</div>
          {activeProgramId === "pendidikan" ? <div className="space-y-5">
            <EducationProgressPanel indicators={connectedIndicators} isLoading={isLoading} color={activeProgram.color} />
            <ProgramInsightCard program={activeProgram} indicators={activeIndicators} layout="grid" />
          </div> : <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {activeProgramId === "dakwah" || activeProgramId === "kesehatan" ? <DakwahProgressPanel indicators={connectedIndicators} isLoading={isLoading} color={activeProgram.color} /> : <EconomicImpactChart data={connectedChartData} isLoading={isLoading} color={activeProgram.color} title={`Target dan capaian dampak ${activeProgram.name.replace("Program ", "").toLowerCase()}`} />}
            <ProgramInsightCard program={activeProgram} indicators={activeIndicators} />
          </div>}
        </div> : <div className="space-y-5">
          <div className={`grid gap-4 sm:grid-cols-2 ${activeProgramId === "kesehatan" ? "xl:grid-cols-3" : ""}`}>{activeIndicators.map((indicator) => <PendingIndicatorCard key={indicator.id} indicator={indicator} color={activeProgram.color} softColor={activeProgram.softColor} detailHref={`/dampak-program/indikator/${indicator.id}`} />)}</div>
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2 text-slate-400"><Database size={18} /></span><div><p className="text-sm font-semibold text-slate-700">Capaian belum tersedia pada pratinjau ini</p><p className="mt-1 text-xs leading-5 text-slate-500">{activeProgram.outcome} Grafik dan analisis akan mengikuti data yang dapat dibaca aplikasi.</p></div></div></div>
        </div>}
      </div>
    </div>

  </section>;
}

type ResolvedIndicator = ImpactIndicator & { achievement: number | null; percentage: number | null; monthIndex: number; dataThrough?: string; sourceLabel?: string; sourceUrl?: string; details?: ProgramImpactLocationDetail[]; participantDetails?: ProgramImpactParticipantDetail[]; analysis?: ProgramImpactAnalysis };

function ImpactMetricCard({ indicator, months, color, isLoading, detailHref }: { indicator: ResolvedIndicator; months: readonly string[]; color: string; isLoading: boolean; detailHref?: string }) {
  const tone = achievementTone(indicator.percentage ?? 0);
  const detailCount = indicator.participantDetails?.length ?? indicator.details?.length;
  const content = <div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>Indikator dampak</p><h3 className="mt-1.5 min-h-10 text-sm font-bold leading-5 text-ink">{indicator.label}</h3></div>
      {(detailHref || indicator.href) && <span className="rounded-xl p-2" style={{ color, backgroundColor: `${color}12` }}><ArrowUpRight size={17} /></span>}
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2.5">
      <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target</p><p className="mt-1 truncate text-xl font-bold text-ink" title={indicator.target === null ? undefined : formatNumber(indicator.target)}>{indicator.target === null ? "—" : formatNumber(indicator.target)}</p><p className="text-xs text-slate-400">{indicator.unit}</p></div>
      <div className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: `${color}35`, backgroundColor: `${color}0D` }}><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>Capaian</p><p className="mt-1 truncate text-xl font-bold" style={{ color }} title={indicator.achievement === null ? undefined : formatNumber(indicator.achievement)}>{isLoading || indicator.achievement === null ? "—" : formatNumber(indicator.achievement)}</p><p className="truncate text-xs text-slate-400">{indicator.unit}</p></div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">Dari target</span><strong style={{ color: tone.color }}>{indicator.percentage === null ? "—" : `${indicator.percentage}%`}</strong></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tone.trackColor }}><div className="h-full rounded-full" style={{ width: `${Math.min(indicator.percentage ?? 0, 100)}%`, backgroundColor: tone.color }} /></div>
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px]">
      <span className="min-w-0 truncate text-slate-500" title={indicator.sourceLabel}>{indicator.sourceLabel || (indicator.monthIndex >= 0 ? `Per ${months[indicator.monthIndex]}` : indicator.dataThrough ? `Per ${indicator.dataThrough}` : "Data indikator")}</span>
      {(detailHref || indicator.href) && <span className="shrink-0 font-semibold" style={{ color }}>{detailCount === undefined ? "Lihat analisis" : `Analisis · ${formatNumber(detailCount)} rincian`}</span>}
    </div>
  </div>;
  const cardClass = "min-h-[258px] rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg";
  if (detailHref || indicator.href) return <Link href={detailHref ?? indicator.href!} className={cardClass}>{content}</Link>;
  return <div className={cardClass}>{content}</div>;
}

function PendingIndicatorCard({ indicator, color, softColor, detailHref }: { indicator: ResolvedIndicator; color: string; softColor: string; detailHref?: string }) {
  const content = <div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>Indikator dampak</p><h3 className="mt-1.5 min-h-10 text-sm font-bold leading-5 text-ink">{indicator.label}</h3></div><span className="rounded-xl p-2" style={{ backgroundColor: softColor, color }}>{detailHref ? <ArrowUpRight size={17} /> : <Target size={17} />}</span></div>
    <div className="mt-5 grid grid-cols-2 gap-2.5"><div className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Target</p><p className="mt-1 text-xl font-bold text-ink">{indicator.target === null ? "—" : formatNumber(indicator.target)}</p><p className="text-xs text-slate-400">{indicator.unit}</p></div><div className="rounded-xl border border-dashed border-slate-200 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Capaian</p><p className="mt-1 text-xl font-bold text-slate-300">—</p><p className="text-xs text-slate-400">Menunggu data</p></div></div>
    <div className="mt-4 h-2 rounded-full border border-dashed border-slate-300 bg-slate-50" />
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px]"><span className="truncate text-slate-500">{indicator.sourceLabel || "Sumber capaian belum tersedia"}</span>{detailHref && <span className="shrink-0 font-semibold" style={{ color }}>Lihat status</span>}</div>
  </div>;
  const className = "min-h-[258px] rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg";
  return detailHref ? <Link href={detailHref} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function indicatorImpactStory(indicator: ResolvedIndicator) {
  const amount = formatNumber(indicator.achievement ?? 0);
  const stories: Record<string, { result: string; impact: string; caveat?: string }> = {
    "vokasi-keahlian": {
      result: `${amount} peserta program vokasi tercatat memiliki keahlian.`,
      impact: "Keahlian adalah bekal untuk memasuki dunia kerja atau membangun usaha; pembelajaran mulai menjadi modal yang dapat dipakai di luar kelas.",
      caveat: "Angka ini dicatat manual; pemanfaatan keahlian tiap peserta belum ditelusuri.",
    },
    "terserap-kerja": {
      result: `${amount} peserta vokasi tercatat terserap kerja.`,
      impact: "Ini menunjukkan jalur nyata dari pelatihan menuju kesempatan bekerja dan potensi penghasilan yang lebih mandiri.",
      caveat: "Status kerja sebelum program dan ketahanan pekerjaan belum tersedia, sehingga penurunan pengangguran belum dapat dihitung.",
    },
    wirausaha: {
      result: `${amount} peserta vokasi tercatat berwirausaha.`,
      impact: "Keterampilan juga menemukan jalan melalui usaha sendiri: peserta memiliki peluang menciptakan sumber penghidupan, bukan hanya mencari pekerjaan.",
      caveat: "Pendapatan dan keberlanjutan usaha belum diukur.",
    },
    hafiz: {
      result: `${amount} peserta tercatat mencapai hafiz 30 juz.`,
      impact: "Capaian ini mencerminkan proses belajar dan ketekunan yang kuat, sekaligus memperkaya kapasitas peserta untuk berkontribusi dalam pembinaan keagamaan.",
    },
    stunting: {
      result: `${amount} anak tercatat keluar dari risiko stunting.`,
      impact: "Perubahan status anak merupakan hasil yang langsung menyentuh kesehatan keluarga dan memberi dasar yang lebih baik bagi tumbuh kembangnya.",
    },
    posyandu: {
      result: `${amount} Posyandu tercatat dibina.`,
      impact: "Titik layanan yang lebih kuat memberi keluarga tempat yang lebih dekat untuk memantau kesehatan ibu dan anak serta mencari tindak lanjut sejak dini.",
      caveat: "Jumlah Posyandu tidak dengan sendirinya membuktikan perbaikan status gizi.",
    },
    kader: {
      result: `${amount} kader penggerak utama tercatat dibina.`,
      impact: "Kader adalah penghubung layanan dengan kehidupan sehari-hari warga; penguatan mereka dapat membantu informasi dan pendampingan kesehatan menjangkau keluarga.",
      caveat: "Frekuensi layanan dan perubahan kesehatan keluarga belum tercermin dalam jumlah kader.",
    },
    "bank-sampah": {
      result: `${amount} titik Bank Sampah tercatat dalam program.`,
      impact: "Setiap titik memberi warga ruang bersama untuk memilah dan mengelola sampah lebih dekat dari rumah, sekaligus menumbuhkan kebiasaan lingkungan yang lebih baik.",
      caveat: "Volume sampah yang berhasil dikelola belum tersedia.",
    },
    mangrove: {
      result: `${amount} titik Desa Lestari Mangrove tercatat.`,
      impact: "Inisiatif ini menghadirkan ruang bagi warga untuk merawat ekosistem pesisir dan membangun kepedulian terhadap ketahanan lingkungan setempat.",
      caveat: "Luas pemulihan dan tingkat hidup mangrove belum diukur.",
    },
    tps3r: {
      result: `${amount} titik TPS3R tercatat.`,
      impact: "Titik pengolahan berbasis kawasan dapat mendekatkan upaya pengurangan dan pemanfaatan kembali sampah kepada komunitas.",
      caveat: "Kapasitas dan volume pengolahan belum tersedia.",
    },
    masjid: {
      result: `${amount} titik Masjid Berdaya tercatat.`,
      impact: "Masjid berpotensi menjadi lebih dari tempat ibadah: ia dapat menjadi simpul pembinaan, perjumpaan, dan kegiatan yang menguatkan kehidupan komunitas.",
      caveat: "Jumlah titik belum mengukur intensitas kegiatan atau perubahan kondisi warga.",
    },
    "pp-terbina": {
      result: `${amount} peserta program tercatat terbina.`,
      impact: "Jangkauan pembinaan ini menunjukkan banyaknya orang yang telah disentuh proses pendampingan, sebuah pijakan untuk membangun kapasitas dan keterlibatan sosial.",
      caveat: "Angka peserta tidak berarti seluruhnya dibina di Masjid Berdaya; hasil lanjutan pembinaan perlu ditelusuri tersendiri.",
    },
  };
  return stories[indicator.id] ?? {
    result: `${amount} ${indicator.unit} tercatat pada indikator ${indicator.label}.`,
    impact: "Capaian ini menunjukkan jangkauan hasil program yang sudah tercatat; perubahan lanjutan perlu diperiksa pada sumber yang lebih rinci.",
  };
}

function ProgramInsightCard({ program, indicators, layout = "stack" }: { program: ProgramDefinition; indicators: ResolvedIndicator[]; layout?: "stack" | "grid" }) {
  const achieved = indicators.filter((indicator) => indicator.achievement !== null);
  return <article className="rounded-[24px] p-5 text-white shadow-lg sm:p-6" style={{ background: `linear-gradient(145deg, #172334, ${program.color})` }}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">Narasi dampak {program.name.replace("Program ", "")}</p><h3 className="mt-2 text-lg font-bold leading-6">Cerita di balik setiap capaian</h3></div><span className="rounded-2xl bg-white/10 p-2.5"><program.icon size={20} /></span></div>
    <div className={layout === "grid" ? "mt-4 grid gap-3 md:grid-cols-2" : "mt-4 space-y-2.5"}>{achieved.map((indicator, index) => {
      const story = indicatorImpactStory(indicator);
      return <section key={indicator.id} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">{String(index + 1).padStart(2, "0")} · {indicator.label}</p>
        <p className="mt-1.5 text-[13px] font-semibold leading-5 text-white">{story.result}</p>
        <p className="mt-1.5 text-xs leading-5 text-white/85">{(indicator.achievement ?? 0) > 0 ? story.impact : "Belum ada hasil positif yang tercatat pada indikator ini; narasi dampak akan mengikuti pembaruan sumber data."}</p>
        {story.caveat && (indicator.achievement ?? 0) > 0 && <p className="mt-1.5 text-[11px] leading-4 text-white/60">Batas data: {story.caveat}</p>}
      </section>;
    })}</div>
  </article>;
}

function EducationProgressPanel({ indicators, isLoading, color }: { indicators: ResolvedIndicator[]; isLoading: boolean; color: string }) {
  const maxPercent = Math.max(120, Math.ceil(Math.max(...indicators.map((indicator) => indicator.percentage ?? 0), 0) / 20) * 20);
  const targetPosition = 100 / maxPercent * 100;
  return <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>Perbandingan indikator</p><h3 className="mt-1 text-xl font-bold text-ink">Seberapa jauh setiap hasil dari target?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Panjang bar menunjukkan persentase capaian terhadap target masing-masing indikator.</p></div><span className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500"><span className="h-4 border-l-2 border-dashed border-slate-600" /> Garis target 100%</span></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{indicators.map((indicator) => {
      const percent = indicator.percentage ?? 0;
      const tone = achievementTone(percent);
      return <div key={indicator.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold leading-5 text-ink">{indicator.label}</p><p className="mt-1 text-xs text-slate-500">{isLoading ? "Memuat capaian" : `${formatNumber(indicator.achievement ?? 0)} dari ${formatNumber(indicator.target ?? 0)} ${indicator.unit}`}</p></div><span className="shrink-0 text-lg font-extrabold tabular-nums" style={{ color: tone.color }}>{isLoading || indicator.percentage === null ? "—" : `${indicator.percentage}%`}</span></div><div className="relative mt-4 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, percent / maxPercent * 100)}%`, backgroundColor: tone.color }} /><span className="absolute top-[-4px] h-5 border-l-2 border-dashed border-slate-600" style={{ left: `${targetPosition}%` }} aria-hidden="true" /></div></div>;
    })}</div><p className="mt-4 text-[11px] leading-5 text-slate-500">Indikator tidak dijumlahkan: peserta antarhasil vokasi bisa beririsan, sedangkan capaian hafiz mengukur hasil yang berbeda.</p>
  </section>;
}

function DakwahProgressPanel({ indicators, isLoading, color }: { indicators: ResolvedIndicator[]; isLoading: boolean; color: string }) {
  return <div className="rounded-[24px] border border-slate-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color }}>Kemajuan indikator</p><h3 className="mt-2 text-xl font-bold text-ink">Progres terhadap target dampak</h3><p className="mt-1 text-xs leading-5 text-slate-500">{indicators.some((indicator) => indicator.id === "posyandu") ? "Persentase menyamakan skala tampilan. Posyandu (unit) dan kader (orang) tidak dijumlahkan." : "Setiap indikator menggunakan skala persentase agar capaian dengan satuan berbeda tetap mudah dibandingkan."}</p><div className="mt-6 space-y-4">{indicators.map((indicator) => { const tone = achievementTone(indicator.percentage ?? 0); const Icon = indicator.id === "masjid" ? Landmark : indicator.id === "posyandu" ? HeartPulse : UserRound; return <div key={indicator.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2.5 shadow-sm" style={{ color }}><Icon size={18} /></span><div><p className="text-sm font-bold text-ink">{indicator.label}</p><p className="mt-1 text-xs text-slate-500">{isLoading ? "Memuat capaian" : `${formatNumber(indicator.achievement ?? 0)} dari ${formatNumber(indicator.target ?? 0)} ${indicator.unit}`}</p></div></div><p className="text-xl font-bold" style={{ color: tone.color }}>{isLoading || indicator.percentage === null ? "—" : `${indicator.percentage}%`}</p></div><div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: tone.trackColor }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(indicator.percentage ?? 0, 100)}%`, backgroundColor: tone.color }} /></div><p className="mt-2 text-right text-[10px] font-semibold" style={{ color: tone.color }}>{indicator.percentage === null ? "Menunggu data" : tone.label}</p></div>; })}</div></div>;
}

function ImpactInsightPage({ indicator, program, query, onQueryChange }: { indicator: ResolvedIndicator; program: ProgramDefinition; query: string; onQueryChange: (value: string) => void }) {
  if (indicator.id === "posyandu" || indicator.id === "kader") return <HealthDetailPage indicator={indicator} color={program.color} />;
  if (indicator.participantDetails || indicator.id === "vokasi-keahlian") return <EducationDetailPage indicator={indicator} color={program.color} query={query} onQueryChange={onQueryChange} />;
  if (indicator.details) return <LocationDetailPage indicator={indicator} color={program.color} query={query} onQueryChange={onQueryChange} />;
  return <PendingDetailPage indicator={indicator} color={program.color} />;
}

function groupImpactDetails(details: ProgramImpactLocationDetail[], field: "province" | "branch"): ProgramImpactBreakdown[] {
  const counts = new Map<string, number>();
  details.forEach((detail) => {
    const name = detail[field]?.trim();
    if (name && name !== "-") counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "id"));
}

function participantYears(details: ProgramImpactParticipantDetail[]): ProgramImpactBreakdown[] {
  const counts = new Map<string, number>();
  details.forEach((detail) => { if (detail.year) counts.set(detail.year, (counts.get(detail.year) ?? 0) + 1); });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function InsightBarChart({ title, items, total, unit, color }: { title: string; items: ProgramImpactBreakdown[]; total: number; unit: string; color: string }) {
  const visible = items.slice(0, 6);
  const maximum = Math.max(...visible.map((item) => item.value), 1);
  if (visible.length === 0) return null;
  return <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Komposisi capaian</p><h4 className="mt-1 text-base font-bold text-ink">{title}</h4></div><span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-500">Teratas {visible.length}</span></div><div className="mt-5 space-y-3.5">{visible.map((item) => <div key={item.name}><div className="mb-1.5 flex items-start justify-between gap-3 text-xs"><span className="min-w-0 truncate font-medium text-slate-700" title={item.name}>{item.name}</span><span className="shrink-0 font-bold text-ink">{formatNumber(item.value)} <span className="font-normal text-slate-400">{unit} · {total > 0 ? Math.round(item.value / total * 100) : 0}%</span></span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.value / maximum * 100}%`, backgroundColor: color }} /></div></div>)}</div>{items.length > visible.length && <p className="mt-4 text-[11px] text-slate-400">Menampilkan {visible.length} dari {items.length} kelompok; persentase dihitung dari total capaian.</p>}</div>;
}

function ImpactAnalyticsPanel({ indicator, color }: { indicator: ResolvedIndicator; color: string }) {
  const achievement = indicator.achievement;
  const target = indicator.target;
  const percentage = achievement !== null && target !== null && target > 0 ? achievement / target * 100 : null;
  const gap = achievement !== null && target !== null ? achievement - target : null;
  const locations = indicator.details ?? [];
  const byProvince = indicator.analysis?.byProvince ?? groupImpactDetails(locations, "province");
  const byBranch = indicator.analysis?.byBranch ?? groupImpactDetails(locations, "branch");
  const byYear = participantYears(indicator.participantDetails ?? []);
  const leadingProvince = byProvince[0];
  const leadingBranch = byBranch[0];
  const leadingYear = [...byYear].sort((a, b) => b.value - a.value)[0];
  const activeLocations = locations.filter((detail) => detail.status?.toLocaleLowerCase("id-ID") === "aktif").length;
  const hasStatus = locations.some((detail) => detail.status && detail.status !== "-");
  const isManual = indicator.id === "vokasi-keahlian";
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <InsightStat label="Capaian" value={achievement === null ? "—" : formatNumber(achievement)} suffix={indicator.unit} color={color} />
      <InsightStat label="Target" value={target === null ? "—" : formatNumber(target)} suffix={indicator.unit} />
      <InsightStat label="Dari target" value={percentage === null ? "—" : `${Math.round(percentage)}%`} suffix="realisasi" color={percentage !== null ? achievementTone(percentage).color : undefined} />
      <InsightStat label={gap !== null && gap >= 0 ? "Di atas target" : "Sisa ke target"} value={gap === null ? "—" : formatNumber(Math.abs(gap))} suffix={indicator.unit} />
    </div>
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kemajuan target</p><div className="mt-4 flex items-center gap-5"><div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-3" style={{ background: `conic-gradient(${color} ${Math.min(Math.max(percentage ?? 0, 0), 100)}%, #E2E8F0 0)` }}><div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xl font-extrabold text-ink">{percentage === null ? "—" : `${Math.round(percentage)}%`}</div></div><div className="text-sm leading-6 text-slate-600">{achievement === null ? "Capaian belum tersedia; persentase dan selisih belum dapat dihitung." : target === null ? "Target belum tersedia untuk membandingkan capaian." : gap !== null && gap >= 0 ? `Capaian melampaui target sebesar ${formatNumber(gap)} ${indicator.unit}.` : `Masih diperlukan ${formatNumber(Math.abs(gap ?? 0))} ${indicator.unit} untuk mencapai target.`}</div></div>{percentage !== null && percentage > 100 && <p className="mt-4 rounded-xl px-3 py-2 text-xs font-medium" style={{ backgroundColor: `${color}12`, color }}>Progres melampaui 100%; lingkaran dibatasi pada 100%, angka tetap menunjukkan capaian sebenarnya.</p>}</div>
      <div className="rounded-[22px] bg-[#172334] p-5 text-white"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Temuan dari data</p><h4 className="mt-2 text-lg font-bold">{achievement === null ? "Menunggu sumber capaian" : leadingProvince ? "Wilayah dengan capaian tertinggi" : "Posisi capaian saat ini"}</h4><div className="mt-4 space-y-3 text-sm leading-6 text-white/75">{achievement !== null && target !== null && <p>{formatNumber(achievement)} {indicator.unit} setara {Math.round(percentage ?? 0)}% dari target {formatNumber(target)} {indicator.unit}.</p>}{leadingProvince && achievement !== null && achievement > 0 && <p><strong className="text-white">{leadingProvince.name}</strong> mencatat {formatNumber(leadingProvince.value)} {indicator.unit} ({Math.round(leadingProvince.value / achievement * 100)}% dari total). Persentase ini menunjukkan komposisi data, bukan perbandingan kebutuhan antarwilayah.</p>}{leadingBranch && achievement !== null && achievement > 0 && <p>Di tingkat cabang, <strong className="text-white">{leadingBranch.name}</strong> tercatat tertinggi: {formatNumber(leadingBranch.value)} {indicator.unit} ({Math.round(leadingBranch.value / achievement * 100)}% dari total).</p>}{leadingYear && <p>Rincian peserta paling banyak tercatat untuk hasil tahun <strong className="text-white">{leadingYear.name}</strong>: {formatNumber(leadingYear.value)} peserta. Ini bukan tren tahunan jika sumber tidak mencakup semua tahun.</p>}{hasStatus && <p>{formatNumber(activeLocations)} dari {formatNumber(locations.length)} lokasi ({locations.length ? Math.round(activeLocations / locations.length * 100) : 0}%) berstatus aktif pada sumber.</p>}{indicator.analysis && <p>Nilai positif tercatat pada {formatNumber(indicator.analysis.reportingRows)} baris pelaporan. Baris kosong atau nol tidak dihitung sebagai titik aktif.</p>}{isManual && <p className="text-amber-200">Angka ini diinput manual. Rincian peserta dan sumber verifikasi belum tersedia.</p>}{!isManual && !leadingProvince && !indicator.analysis && !leadingYear && <p>Belum ada dimensi waktu atau wilayah yang cukup untuk menyimpulkan tren atau sebaran indikator ini.</p>}</div></div>
    </div>
    {(byProvince.length > 0 || byBranch.length > 0 || byYear.length > 0) && <div className="grid gap-4 lg:grid-cols-2">{byProvince.length > 0 && <InsightBarChart title="Menurut provinsi" items={byProvince} total={achievement ?? 0} unit={indicator.unit} color={color} />}{byYear.length > 0 && <InsightBarChart title="Menurut tahun hasil" items={byYear} total={achievement ?? 0} unit={indicator.unit} color={color} />}{byYear.length === 0 && byBranch.length > 0 && <InsightBarChart title="Menurut cabang" items={byBranch} total={achievement ?? 0} unit={indicator.unit} color={color} />}</div>}
    {(locations.length > 0 || indicator.analysis) && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><InsightStat label={indicator.analysis ? "Baris bernilai positif" : "Lokasi tercatat"} value={formatNumber(indicator.analysis?.reportingRows ?? locations.length)} suffix={indicator.analysis ? "baris" : "lokasi"} /><InsightStat label="Provinsi tercatat" value={byProvince.length ? formatNumber(byProvince.length) : "—"} suffix={byProvince.length ? "provinsi" : "tidak tersedia"} /><InsightStat label={hasStatus ? "Lokasi berstatus aktif" : "Cabang tercatat"} value={hasStatus ? formatNumber(activeLocations) : byBranch.length ? formatNumber(byBranch.length) : "—"} suffix={hasStatus ? `${locations.length ? Math.round(activeLocations / locations.length * 100) : 0}% dari lokasi` : byBranch.length ? "cabang" : "tidak tersedia"} /></div>}
    {indicator.participantDetails && <div className="grid gap-3 sm:grid-cols-2"><InsightStat label="Rincian peserta" value={formatNumber(indicator.participantDetails.length)} suffix="peserta terverifikasi dalam sumber" /><InsightStat label="Tahun hasil tercatat" value={byYear.length ? formatNumber(byYear.length) : "—"} suffix={byYear.length ? "tahun" : "tidak tersedia"} /></div>}
  </div>;
}

function InsightStat({ label, value, suffix, color }: { label: string; value: string; suffix: string; color?: string }) {
  return <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 truncate text-2xl font-extrabold" style={{ color: color || "#172334" }} title={value}>{value}</p><p className="mt-1 truncate text-xs text-slate-500" title={suffix}>{suffix}</p></div>;
}

function DetailHeader({ indicator, color, category, description }: { indicator: ResolvedIndicator; color: string; category: string; description: string }) {
  return <header className="rounded-[30px] px-6 py-7 text-white shadow-lg sm:px-8" style={{ background: `linear-gradient(125deg, #172334, ${color})` }}><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{category}</p><h1 className="mt-3 text-3xl font-bold">{indicator.label}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">{description}</p></header>;
}

function DetailSource({ indicator, color }: { indicator: ResolvedIndicator; color: string }) {
  if (!indicator.sourceUrl) return null;
  return <a href={indicator.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold hover:shadow-sm" style={{ color }}><ExternalLink size={14} /> Buka sumber: {indicator.sourceLabel}</a>;
}

function HealthDetailPage({ indicator, color }: { indicator: ResolvedIndicator; color: string }) {
  return <div className="space-y-6"><DetailHeader indicator={indicator} color={color} category="Analisis dampak kesehatan" description="Target, capaian, dan komposisi wilayah berdasarkan sheet Resume." /><ImpactAnalyticsPanel indicator={indicator} color={color} /><p className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">Grafik menjumlahkan kolom {indicator.id === "posyandu" ? "W (jumlah Posyandu)" : "X (jumlah Kader)"} per provinsi dan cabang. Data per orang tidak ditampilkan.</p><DetailSource indicator={indicator} color={color} /></div>;
}

function PendingDetailPage({ indicator, color }: { indicator: ResolvedIndicator; color: string }) {
  return <div className="space-y-6"><DetailHeader indicator={indicator} color={color} category="Analisis indikator" description="Ringkasan capaian dan status ketersediaan data rinci." /><ImpactAnalyticsPanel indicator={indicator} color={color} /><p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-600">{indicator.achievement === null ? "Belum ada capaian terverifikasi untuk indikator ini. Grafik rinci akan tampil setelah sumber data tersedia." : "Sumber saat ini menyediakan total capaian, tetapi belum menyediakan rincian waktu atau wilayah untuk grafik tambahan."}</p><DetailSource indicator={indicator} color={color} /></div>;
}

function VocationOutcomeAnalytics({ indicator, color }: { indicator: ResolvedIndicator; color: string }) {
  const achievement = indicator.achievement ?? 0;
  const target = indicator.target ?? 0;
  const percentage = target > 0 ? achievement / target * 100 : 0;
  const scale = Math.max(120, Math.ceil(percentage / 20) * 20);
  const difference = achievement - target;
  const isEmployed = indicator.id === "terserap-kerja";
  const story = indicatorImpactStory(indicator);

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <InsightStat label="Peserta dengan hasil tercatat" value={formatNumber(achievement)} suffix={isEmployed ? "terserap kerja" : "berwirausaha"} color={color} />
      <InsightStat label="Target indikator" value={formatNumber(target)} suffix="peserta" />
      <InsightStat label={difference >= 0 ? "Melampaui target" : "Menuju target"} value={difference >= 0 ? `+${formatNumber(difference)}` : formatNumber(Math.abs(difference))} suffix={difference >= 0 ? "peserta di atas target" : "peserta lagi diperlukan"} color={difference >= 0 ? "#059669" : color} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Visual capaian</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Hasil terhadap target</h2>
        <p className="mt-1 text-sm text-slate-500">{formatNumber(achievement)} dari {formatNumber(target)} peserta · {Math.round(percentage)}% target tercapai</p>
        <div className="mt-7 rounded-2xl bg-slate-50 px-4 py-6 sm:px-6">
          <div className="flex items-end justify-between gap-4"><span className="text-xs font-semibold text-slate-500">Capaian tercatat</span><strong className="text-2xl tabular-nums" style={{ color }}>{Math.round(percentage)}%</strong></div>
          <div className="relative mt-4 h-5 rounded-full bg-slate-200" role="img" aria-label={`Capaian ${formatNumber(achievement)} dari target ${formatNumber(target)} peserta, ${Math.round(percentage)} persen`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, percentage / scale * 100)}%`, backgroundColor: color }} />
            <span className="absolute -top-2 h-9 border-l-2 border-dashed border-slate-600" style={{ left: `${100 / scale * 100}%` }} aria-hidden="true" />
          </div>
          <div className="mt-4 flex items-start justify-between gap-3 text-[11px] text-slate-500"><span>0%</span><span className="font-semibold text-slate-700">Garis putus-putus = target 100%</span><span>{scale}%</span></div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">{difference >= 0 ? `Capaian sudah melampaui target sebanyak ${formatNumber(difference)} peserta.` : `Masih diperlukan ${formatNumber(Math.abs(difference))} peserta untuk mencapai target.`} Persentase dihitung dari jumlah peserta dengan hasil tercatat dibanding target indikator.</p>
      </section>
      <section className="rounded-[24px] bg-[#172334] p-5 text-white shadow-sm sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">Makna dampak</p>
        <h2 className="mt-2 text-xl font-bold">{isEmployed ? "Keahlian membuka jalan menuju kerja" : "Keahlian menjadi jalan membangun usaha"}</h2>
        <p className="mt-4 text-sm font-semibold leading-6 text-white">{story.result}</p>
        <p className="mt-2 text-sm leading-6 text-white/75">{story.impact}</p>
        {story.caveat && <p className="mt-5 border-t border-white/15 pt-4 text-xs leading-5 text-white/55">Batas data: {story.caveat}</p>}
      </section>
    </div>
  </div>;
}

function EducationDetailPage({ indicator, color, query, onQueryChange }: { indicator: ResolvedIndicator; color: string; query: string; onQueryChange: (value: string) => void }) {
  const participants = indicator.participantDetails ?? [];
  const isVocationOutcome = indicator.id === "terserap-kerja" || indicator.id === "wirausaha";
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filtered = participants.filter((participant) => !normalizedQuery || [participant.name, participant.outcome].some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedQuery)));

  return <div className="space-y-6">
    <DetailHeader indicator={indicator} color={color} category="Analisis dampak pendidikan" description={indicator.participantDetails ? `${formatNumber(participants.length)} rincian peserta tersedia untuk ditelusuri.` : "Capaian dicatat manual; daftar peserta dan sumber rinci belum tersedia."} />
    {isVocationOutcome ? <VocationOutcomeAnalytics indicator={indicator} color={color} /> : <ImpactAnalyticsPanel indicator={indicator} color={color} />}
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>Data rinci</p><h2 className="mt-1 text-xl font-bold text-ink">Daftar peserta dalam satu tampilan</h2><p className="mt-1 text-xs text-slate-500">Menampilkan {formatNumber(filtered.length)} dari {formatNumber(participants.length)} peserta; tidak dikelompokkan menurut tahun.</p></div>{participants.length > 0 && <label className="relative block w-full sm:w-80"><span className="sr-only">Cari peserta pendidikan</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari nama peserta" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-amber-500" /></label>}</div>
      <div className="mt-5 max-h-[520px] overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[460px] border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="w-20 px-4 py-3">No.</th><th scope="col" className="px-4 py-3">Nama peserta</th><th scope="col" className="px-4 py-3">Hasil tercatat</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((participant, index) => <tr key={participant.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-amber-50/60"><td className="px-4 py-3 tabular-nums text-slate-400">{index + 1}</td><td className="px-4 py-3 font-semibold text-ink">{participant.name}</td><td className="px-4 py-3 text-slate-600">{participant.outcome}</td></tr>)}</tbody></table>
        {filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">{!indicator.participantDetails ? "Capaian tersedia sebagai input manual, tetapi belum ada daftar peserta atau sumber rinci untuk ditelusuri." : "Peserta tidak ditemukan untuk pencarian ini."}</p>}
      </div>
    </div>
    <DetailSource indicator={indicator} color={color} />
  </div>;
}
function LocationDetailPage({ indicator, color, query, onQueryChange }: { indicator: ResolvedIndicator; color: string; query: string; onQueryChange: (value: string) => void }) {
  const details = indicator.details ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredDetails = details.filter((detail) => !normalizedQuery || [detail.village, detail.district, detail.regency, detail.province, detail.branch, detail.status, detail.villageType, detail.volunteer, detail.program].filter((value): value is string => Boolean(value)).some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedQuery)));
  const provinces = new Set(details.map((detail) => detail.province).filter((value) => value !== "-")).size;
  const regencies = new Set(details.map((detail) => `${detail.province}::${detail.regency}`).filter((value) => !value.endsWith("::-"))).size;
  const isDakwah = indicator.id === "masjid";

  if (indicator.id === "bank-sampah" || isDakwah) return <UnifiedLocationImpactPage indicator={indicator} color={color} query={query} onQueryChange={onQueryChange} details={details} filteredDetails={filteredDetails} provinces={provinces} regencies={regencies} />;

  return <div className="space-y-6">
    <DetailHeader indicator={indicator} color={color} category={`Analisis dampak ${isDakwah ? "dakwah" : "lingkungan"}`} description={`${formatNumber(details.length)} titik di ${provinces} provinsi dan ${regencies} kota/kabupaten.`} />
    <ImpactAnalyticsPanel indicator={indicator} color={color} />
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>Data rinci</p><h2 className="mt-1 text-xl font-bold text-ink">Rincian lokasi</h2><p className="mt-1 text-xs text-slate-500">Menampilkan {formatNumber(filteredDetails.length)} dari {formatNumber(details.length)} lokasi</p></div><label className="relative block w-full sm:w-96"><span className="sr-only">Cari detail {indicator.label}</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={isDakwah ? "Cari desa, wilayah, cabang, atau RI" : "Cari desa, wilayah, atau cabang"} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-emerald-500" /></label></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">{filteredDetails.map((detail, index) => <div key={`${detail.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>Lokasi {String(index + 1).padStart(2, "0")}</p><h3 className="mt-1 text-base font-bold text-ink">{detail.village}</h3><p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0" /> {detail.district}, {detail.regency}, {detail.province}</p></div><div className="flex flex-wrap justify-end gap-1.5">{detail.status && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{detail.status}</span>}{detail.villageType && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{detail.villageType}</span>}</div></div><div className={`mt-3 grid gap-2 border-t border-slate-200 pt-3 ${detail.volunteer ? "sm:grid-cols-2" : ""}`}><p className="flex items-center gap-2 text-xs text-slate-500"><Building2 size={14} className="text-slate-400" /> {detail.branch}</p>{detail.volunteer && <p className="flex items-center gap-2 text-xs text-slate-500"><UserRound size={14} className="text-slate-400" /> {detail.volunteer} (Relawan Inspirasi)</p>}</div></div>)}{filteredDetails.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500">Lokasi tidak ditemukan. Coba kata kunci desa, wilayah, cabang, status, atau program lainnya.</p>}</div>
    </div>
    <DetailSource indicator={indicator} color={color} />
  </div>;
}

function UnifiedLocationImpactPage({ indicator, color, query, onQueryChange, details, filteredDetails, provinces, regencies }: {
  indicator: ResolvedIndicator;
  color: string;
  query: string;
  onQueryChange: (value: string) => void;
  details: ProgramImpactLocationDetail[];
  filteredDetails: ProgramImpactLocationDetail[];
  provinces: number;
  regencies: number;
}) {
  const isMasjid = indicator.id === "masjid";
  const achievement = indicator.achievement ?? details.length;
  const target = indicator.target ?? 0;
  const percentage = target > 0 ? achievement / target * 100 : null;
  const story = indicatorImpactStory(indicator);
  const distribution = (indicator.analysis?.byProvince ?? groupImpactDetails(details, "province")).slice(0, 6);
  const maximum = Math.max(...distribution.map((item) => item.value), 1);

  return <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-soft">
    <header className="px-6 py-7 text-white sm:px-8" style={{ background: `linear-gradient(125deg, #172334, ${color})` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Analisis dampak {isMasjid ? "dakwah" : "lingkungan"}</p>
      <h1 className="mt-3 text-3xl font-bold">{indicator.label}</h1>
      <p className="mt-3 text-sm leading-6 text-white/80">{formatNumber(details.length)} titik tercatat di {provinces} provinsi dan {regencies} kota/kabupaten. Ringkasan capaian, sebaran, dan daftar lokasi ada dalam satu tampilan.</p>
    </header>

    <div className="divide-y divide-slate-200 px-5 sm:px-7">
      <section className="grid gap-5 py-6 sm:grid-cols-3" aria-label="Ringkasan capaian">
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Capaian</p><p className="mt-1 text-3xl font-extrabold tabular-nums" style={{ color }}>{formatNumber(achievement)}</p><p className="text-xs text-slate-500">titik program</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Target</p><p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">{target > 0 ? formatNumber(target) : "—"}</p><p className="text-xs text-slate-500">titik program</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Realisasi target</p><p className="mt-1 text-3xl font-extrabold tabular-nums" style={{ color }}>{percentage === null ? "—" : `${Math.round(percentage)}%`}</p><p className="text-xs text-slate-500">{percentage === null ? "Target belum tersedia" : achievement >= target ? `${formatNumber(achievement - target)} titik di atas target` : `${formatNumber(target - achievement)} titik menuju target`}</p></div>
      </section>

      <section className="grid gap-8 py-7 lg:grid-cols-[1fr_0.9fr]" aria-label="Sebaran dan makna dampak">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Sebaran titik program</p>
          <h2 className="mt-1 text-lg font-bold text-ink">Provinsi dengan titik terbanyak</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Menampilkan hingga enam provinsi. Ini komposisi lokasi tercatat, bukan peringkat kualitas dampak.</p>
          <div className="mt-5 space-y-3.5">{distribution.map((item) => <div key={item.name}>
            <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate font-semibold text-slate-700" title={item.name}>{item.name}</span><span className="shrink-0 tabular-nums text-slate-500">{formatNumber(item.value)} titik</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.value / maximum * 100}%`, backgroundColor: color }} /></div>
          </div>)}{distribution.length === 0 && <p className="text-sm text-slate-500">Sebaran provinsi belum tersedia.</p>}</div>
        </div>
        <div className="lg:border-l lg:border-slate-200 lg:pl-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Cerita dampak</p>
          <h2 className="mt-1 text-lg font-bold text-ink">{isMasjid ? "Masjid sebagai simpul komunitas" : "Pengelolaan sampah makin dekat dengan warga"}</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-ink">{story.result}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{story.impact}</p>
          {story.caveat && <p className="mt-4 text-xs leading-5 text-slate-500">Batas data: {story.caveat}</p>}
        </div>
      </section>

      <section className="py-7" aria-label="Daftar lokasi">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color }}>Telusuri lokasi</p><h2 className="mt-1 text-lg font-bold text-ink">Daftar titik program</h2><p className="mt-1 text-xs text-slate-500">Menampilkan {formatNumber(filteredDetails.length)} dari {formatNumber(details.length)} lokasi</p></div><label className="relative block w-full sm:w-80"><span className="sr-only">Cari lokasi {indicator.label}</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari desa, wilayah, atau cabang" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-slate-400" /></label></div>
        <div className="mt-5 max-h-[500px] overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[740px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 font-bold uppercase tracking-wide text-slate-500"><tr><th scope="col" className="w-14 px-4 py-3">No.</th><th scope="col" className="px-4 py-3">Desa</th><th scope="col" className="px-4 py-3">Wilayah</th><th scope="col" className="px-4 py-3">Cabang</th>{isMasjid && <th scope="col" className="px-4 py-3">Relawan Inspirasi</th>}<th scope="col" className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredDetails.map((detail, index) => <tr key={`${detail.id}-${index}`} className="odd:bg-white even:bg-slate-50/70 hover:bg-slate-100"><td className="px-4 py-3 tabular-nums text-slate-400">{index + 1}</td><td className="px-4 py-3 font-semibold text-ink">{detail.village}</td><td className="px-4 py-3 text-slate-600">{[detail.district, detail.regency, detail.province].filter((value) => value && value !== "-").join(", ") || "—"}</td><td className="px-4 py-3 text-slate-600">{detail.branch || "—"}</td>{isMasjid && <td className="px-4 py-3 text-slate-600">{detail.volunteer || "—"}</td>}<td className="px-4 py-3 text-slate-600">{detail.status || "—"}</td></tr>)}</tbody></table>{filteredDetails.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Lokasi tidak ditemukan. Coba kata kunci lain.</p>}</div>
        {indicator.sourceUrl && <a href={indicator.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold hover:underline" style={{ color }}><ExternalLink size={14} /> Buka sumber: {indicator.sourceLabel}</a>}
      </section>
    </div>
  </article>;
}
