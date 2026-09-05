"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Database, ExternalLink, GraduationCap, HeartPulse, Leaf, MoonStar, RefreshCw, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/data/dashboard";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";
import type { DashboardSheetData, DashboardSheetMetric } from "@/lib/dashboard-sheets";
import type { ProgramImpactData } from "@/lib/program-impact-sheets";
import { achievementTone } from "@/lib/achievement-tone";

type ProgramId = "ekonomi" | "pendidikan" | "kesehatan" | "lingkungan" | "dakwah";
type ImpactIndicator = { id: string; label: string; target: number | null; unit: string; metricId?: string; href?: string };
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
    { id: "posyandu", label: "Posyandu binaan", target: 100, unit: "unit" },
    { id: "kader", label: "Kader Posyandu binaan", target: 500, unit: "orang" },
  ] },
  { id: "lingkungan", name: "Program Lingkungan", eyebrow: "Ketahanan lingkungan berbasis komunitas", description: "Menggambarkan tumbuhnya titik pengelolaan sampah dan pemulihan lingkungan yang dikelola bersama warga.", outcome: "Ruang dampak lingkungan disiapkan untuk melihat jumlah titik aktif, keberlanjutan pengelolaan, dan manfaatnya bagi komunitas.", icon: Leaf, color: "#15803D", softColor: "#F0FDF4", indicators: [
    { id: "bank-sampah", label: "Bank Sampah", target: 60, unit: "titik" },
    { id: "mangrove", label: "Desa Lestari Mangrove", target: 5, unit: "titik" },
    { id: "tps3r", label: "TPS3R", target: null, unit: "titik" },
  ] },
  { id: "dakwah", name: "Program Dakwah", eyebrow: "Penguatan pembinaan dan kelembagaan umat", description: "Mengukur keberlanjutan pembinaan peserta dan tumbuhnya masjid sebagai pusat pemberdayaan masyarakat.", outcome: "Dampak dakwah akan memotret jangkauan pembinaan sekaligus keberfungsian titik Masjid Berdaya setelah data capaian dihubungkan.", icon: MoonStar, color: "#22C55E", softColor: "#F0FDF4", indicators: [
    { id: "masjid", label: "Masjid Berdaya", target: 25, unit: "titik" },
    { id: "pp-terbina", label: "Peserta Program Terbina", target: 15000, unit: "orang", href: "/pp-terbina" },
  ] },
];

function achievementThrough(metric: DashboardSheetMetric, monthIndex: number) { return metric.monthly.slice(0, monthIndex + 1).reduce((total, value) => total + value, 0); }
function latestDataMonth(metric: DashboardSheetMetric) { return metric.monthly.reduce((latest, value, index) => value !== 0 ? index : latest, -1); }

export default function DampakProgramPage() {
  const [activeProgramId, setActiveProgramId] = useState<ProgramId>("ekonomi");
  const cachedDashboard = getCachedJsonSnapshot<DashboardSheetData>("dashboard-sheet-production-v2");
  const cachedProgramImpact = getCachedJsonSnapshot<ProgramImpactData>("program-impact-production-v1");
  const [sheetData, setSheetData] = useState<DashboardSheetData | null>(cachedDashboard);
  const [programImpact, setProgramImpact] = useState<ProgramImpactData | null>(cachedProgramImpact);
  const [isLoading, setIsLoading] = useState(!cachedDashboard || !cachedProgramImpact);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true); setLoadError(null);
    try {
      const [dashboard, impact] = await Promise.all([
        fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", forceRefresh),
        fetchCachedJson<ProgramImpactData>("program-impact-production-v1", "/api/program-impact", forceRefresh),
      ]);
      setSheetData(dashboard); setProgramImpact(impact);
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Data dampak belum dapat dimuat."); }
    finally { setIsLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard"),
      fetchCachedJson<ProgramImpactData>("program-impact-production-v1", "/api/program-impact"),
    ])
      .then(([dashboard, impact]) => { if (!cancelled) { setSheetData(dashboard); setProgramImpact(impact); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data dampak belum dapat dimuat."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activeProgram = programs.find((program) => program.id === activeProgramId)!;
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
    return { ...indicator, target, achievement, percentage, monthIndex, dataThrough: linkedImpact?.dataThrough, sourceLabel: linkedImpact?.sourceLabel, sourceUrl: linkedImpact?.sourceUrl };
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

  return <section className="space-y-7">
    <div className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-7 text-white shadow-xl shadow-slate-900/15 lg:p-9">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Kerangka Dampak 2026</div><h1 className="mt-4 text-3xl font-bold md:text-4xl">Dampak Program Pemberdayaan</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">Visualisasi berfokus pada perubahan yang dihasilkan program, bukan hanya jumlah penyaluran. Pilih program untuk melihat indikator, target, capaian, dan kesiapan datanya.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md"><div className="flex items-center justify-between gap-6"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Periode data dampak</p><p className="mt-1 text-sm font-semibold">{periodLabel}</p></div><button type="button" onClick={() => void loadData(true)} disabled={isLoading} aria-label="Muat ulang data dampak" className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white/80 transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /></button></div><p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/50"><Database size={12} /> Ekonomi, pendidikan, dan dakwah terhubung ke database</p></div>
      </div>
    </div>

    {loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError} Capaian yang belum terverifikasi tidak ditampilkan agar tidak menggunakan angka perkiraan.</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="tablist" aria-label="Pilih kelompok program dampak">
      {programs.map((program) => { const Icon = program.icon; const active = activeProgramId === program.id; const hasData = ["ekonomi", "pendidikan", "dakwah"].includes(program.id); return <button key={program.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveProgramId(program.id)} className={`rounded-[22px] border p-4 text-left transition ${active ? "border-transparent text-white shadow-lg" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-soft"}`} style={active ? { backgroundColor: program.color } : undefined}><div className="flex items-center justify-between gap-3"><span className={`rounded-xl p-2 ${active ? "bg-white/15" : "bg-slate-100"}`}><Icon size={18} /></span><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${active ? "bg-white/15 text-white/80" : hasData ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{hasData ? "Data aktif" : "Kerangka"}</span></div><p className="mt-3 text-sm font-bold">{program.name}</p><p className={`mt-1 text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{program.indicators.length} indikator dampak</p></button>; })}
    </div>

    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 p-6 lg:p-7" style={{ backgroundColor: activeProgram.softColor }}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: activeProgram.color }}>{activeProgram.eyebrow}</p><h2 className="mt-2 text-2xl font-bold text-ink">{activeProgram.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{activeProgram.description}</p></div><div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600"><Target size={15} style={{ color: activeProgram.color }} /> Target dampak {year}</div></div></div>
      <div className="p-6 lg:p-7">
        {activeProgramId === "ekonomi" ? <div className="space-y-7">
          <div className="grid gap-4 lg:grid-cols-3">{activeIndicators.map((indicator) => <ImpactMetricCard key={indicator.id} indicator={indicator} months={months} color={activeProgram.color} isLoading={isLoading} />)}</div>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <EconomicImpactChart data={chartData} isLoading={isLoading} />
            <div className="flex flex-col justify-between rounded-[24px] bg-[#172334] p-6 text-white"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Narasi dampak</p><h3 className="mt-2 text-xl font-bold">Pergerakan menuju kemandirian</h3><p className="mt-4 text-sm leading-7 text-white/70">{activeProgram.outcome}</p>{strongestIndicator && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">Pada periode ini, progres relatif tertinggi terdapat pada <strong className="text-white">{strongestIndicator.label}</strong> dengan capaian <strong className="text-orange-300">{formatNumber(strongestIndicator.achievement ?? 0)} {strongestIndicator.unit}</strong> atau {strongestIndicator.percentage}% dari target.</p>}</div><div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-white/45">Agregat tiga indikator</p><p className="mt-1 text-3xl font-bold" style={{ color: aggregateTone.color }}>{isLoading ? "—" : `${aggregatePercentage}%`}</p></div><p className="text-right text-[11px] leading-5 text-white/50">Perbandingan total capaian<br />terhadap total target</p></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(aggregatePercentage, 100)}%`, backgroundColor: aggregateTone.color }} /></div></div></div>
          </div>
        </div> : connectedIndicators.length > 0 ? <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{activeIndicators.map((indicator) => indicator.achievement !== null
            ? <ImpactMetricCard key={indicator.id} indicator={indicator} months={months} color={activeProgram.color} isLoading={isLoading} />
            : <PendingIndicatorCard key={indicator.id} indicator={indicator} color={activeProgram.color} softColor={activeProgram.softColor} />)}</div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <EconomicImpactChart data={connectedChartData} isLoading={isLoading} color={activeProgram.color} title={`Target dan capaian dampak ${activeProgram.name.replace("Program ", "").toLowerCase()}`} />
            <div className="flex flex-col justify-between rounded-[24px] border border-slate-200 p-6">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: activeProgram.color }}>Capaian terverifikasi</p><h3 className="mt-2 text-xl font-bold text-ink">Hasil program yang tercatat</h3><p className="mt-4 text-sm leading-7 text-slate-600">{activeProgram.outcome}</p></div>
              <div className="mt-6 rounded-2xl p-4" style={{ backgroundColor: activeProgram.softColor }}><p className="text-xs font-semibold text-slate-700">Status data</p><p className="mt-1 text-xs leading-5 text-slate-500">{connectedIndicators.length} dari {activeIndicators.length} indikator telah terhubung ke sumber data terverifikasi. Indikator lainnya tetap kosong hingga sumber resminya tersedia.</p></div>
            </div>
          </div>
        </div> : <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
          <div><div className="grid gap-4 sm:grid-cols-2">{activeIndicators.map((indicator) => <PendingIndicatorCard key={indicator.id} indicator={indicator} color={activeProgram.color} softColor={activeProgram.softColor} />)}</div><div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm"><Database size={19} /></div><p className="mt-3 text-sm font-semibold text-slate-700">Visual capaian belum tersedia</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Area ini akan otomatis menampilkan grafik target versus capaian setelah sumber data {activeProgram.name.toLowerCase()} dihubungkan.</p></div></div>
          <div className="rounded-[24px] border border-slate-200 p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: activeProgram.color }}>Arah pengukuran</p><h3 className="mt-2 text-xl font-bold text-ink">Narasi dampak yang disiapkan</h3><p className="mt-4 text-sm leading-7 text-slate-600">{activeProgram.outcome}</p><div className="mt-6 rounded-2xl p-4" style={{ backgroundColor: activeProgram.softColor }}><p className="text-xs font-semibold text-slate-700">Status data</p><p className="mt-1 text-xs leading-5 text-slate-500">Target indikator sudah disusun dari acuan 2026. Capaian sengaja dibiarkan kosong sampai tersedia sumber data yang dapat diverifikasi.</p></div></div>
        </div>}
      </div>
    </div>
  </section>;
}

type ResolvedIndicator = ImpactIndicator & { achievement: number | null; percentage: number | null; monthIndex: number; dataThrough?: string; sourceLabel?: string; sourceUrl?: string };

function ImpactMetricCard({ indicator, months, color, isLoading }: { indicator: ResolvedIndicator; months: readonly string[]; color: string; isLoading: boolean }) {
  const tone = achievementTone(indicator.percentage ?? 0);
  const sourceNote = indicator.sourceLabel && <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400"><Database size={11} /> {indicator.sourceLabel}</p>;
  const content = <><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Indikator dampak</p><h3 className="mt-2 min-h-10 text-sm font-bold leading-5 text-ink">{indicator.label}</h3></div>{indicator.href && <ArrowUpRight size={17} className="shrink-0 text-slate-400" />}</div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Target</p><p className="mt-1 text-xl font-bold text-ink">{indicator.target ? formatNumber(indicator.target) : "—"}</p><p className="text-[10px] text-slate-400">{indicator.unit}</p></div><div className="rounded-xl border border-orange-200 bg-orange-50/70 p-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#D84315]">Capaian</p><p className="mt-1 text-xl font-bold" style={{ color }}>{isLoading ? "—" : indicator.achievement === null ? "—" : formatNumber(indicator.achievement)}</p><p className="text-[10px] text-slate-400">{indicator.monthIndex >= 0 ? `*per ${months[indicator.monthIndex]}` : indicator.dataThrough ? `*per ${indicator.dataThrough}` : indicator.unit}</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: tone.trackColor }}><div className="h-full rounded-full" style={{ width: `${Math.min(indicator.percentage ?? 0, 100)}%`, backgroundColor: tone.color }} /></div><p className="mt-2 text-right text-[11px] font-semibold" style={{ color: tone.color }}>{indicator.percentage === null ? "Menunggu data" : `${indicator.percentage}% · ${tone.label}`}</p>{indicator.sourceUrl && !indicator.href ? <a href={indicator.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] text-slate-400 transition hover:text-slate-600"><ExternalLink size={11} /> {indicator.sourceLabel}</a> : sourceNote}</>;
  return indicator.href ? <Link href={indicator.href} className="rounded-[22px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg">{content}</Link> : <div className="rounded-[22px] border border-slate-200 bg-white p-5">{content}</div>;
}

function PendingIndicatorCard({ indicator, color, softColor }: { indicator: ResolvedIndicator; color: string; softColor: string }) {
  return <div className="rounded-[22px] border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target {indicator.unit}</p><h3 className="mt-2 text-sm font-bold leading-5 text-ink">{indicator.label}</h3></div><span className="rounded-xl p-2" style={{ backgroundColor: softColor, color }}><Target size={16} /></span></div><div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-2xl font-bold text-ink">{indicator.target === null ? "Belum ditetapkan" : formatNumber(indicator.target)}</p><p className="text-xs text-slate-400">{indicator.target === null ? "Target belum tersedia" : indicator.unit}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Capaian belum tersedia</span></div><div className="mt-4 h-2 rounded-full border border-dashed border-slate-300 bg-slate-50" /></div>;
}
