"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPinned, RefreshCw } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { formatNumber, metrics as fallbackMetrics, type Metric } from "@/data/dashboard";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";
import type { DashboardSheetData, DashboardSheetMetric } from "@/lib/dashboard-sheets";
import { achievementTone } from "@/lib/achievement-tone";
import { useReportingPeriod } from "@/components/ReportingPeriodContext";
import { AssistantPageContext } from "@/components/AssistantViewContext";
import { finishAssistantAction, useAssistantActions } from "@/components/AssistantActionContext";

function achievementBetween(metric: DashboardSheetMetric, startMonthIndex: number, endMonthIndex: number) {
  return metric.monthly.slice(startMonthIndex, endMonthIndex + 1).reduce((total, value) => total + value, 0);
}

function trendBetween(metric: DashboardSheetMetric, startMonthIndex: number, endMonthIndex: number) {
  if (startMonthIndex === 0) return 0;
  const duration = endMonthIndex - startMonthIndex + 1;
  const previousStart = Math.max(0, startMonthIndex - duration);
  const current = achievementBetween(metric, startMonthIndex, endMonthIndex);
  const previous = achievementBetween(metric, previousStart, startMonthIndex - 1);
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function mergeSheetMetric(metric: Metric, sheetMetric: DashboardSheetMetric | undefined, startMonthIndex: number, endMonthIndex: number): Metric {
  if (!sheetMetric) return { ...metric, target: 0, achievement: 0, trend: 0, monthly: [], regions: [] };
  const lastDataMonthIndex = sheetMetric.monthly.reduce((latest, value, index) => value !== 0 ? index : latest, -1);

  return {
    ...metric,
    target: sheetMetric.target,
    achievement: achievementBetween(sheetMetric, startMonthIndex, endMonthIndex),
    trend: trendBetween(sheetMetric, startMonthIndex, endMonthIndex),
    dataThroughMonthIndex: lastDataMonthIndex >= 0 && lastDataMonthIndex < endMonthIndex ? lastDataMonthIndex : undefined,
  };
}

export function DashboardView() {
  const { setPeriod: setAssistantPeriod } = useReportingPeriod();
  const { pending, complete } = useAssistantActions();
  const cachedDashboard = getCachedJsonSnapshot<DashboardSheetData>("dashboard-sheet-production-v2");
  const [sheetData, setSheetData] = useState<DashboardSheetData | null>(cachedDashboard);
  const [startMonthIndex, setStartMonthIndex] = useState(0);
  const [endMonthIndex, setEndMonthIndex] = useState(cachedDashboard?.latestMonthIndex ?? 6);
  const [isLoading, setIsLoading] = useState(!cachedDashboard);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadDashboard = async (forceRefresh = true) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", forceRefresh);
      setSheetData(data);
      setStartMonthIndex(0);
      setEndMonthIndex(data.latestMonthIndex);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data dashboard tidak dapat dimuat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard")
      .then((data) => {
        if (cancelled) return;
        setSheetData(data);
        setStartMonthIndex(0);
        setEndMonthIndex(data.latestMonthIndex);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data dashboard tidak dapat dimuat.");
      })
      .finally(() => {
        if (!cancelled) { setIsLoading(false); setInitialLoadDone(true); }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pending || pending.action.target !== "/" || !initialLoadDone) return;
    if (!sheetData) { complete(pending.id, loadError || "Data dashboard belum tersedia."); return; }
    const start = pending.action.filters?.startMonthIndex ?? 0;
    const end = pending.action.filters?.endMonthIndex ?? sheetData.latestMonthIndex;
    if (end > sheetData.latestMonthIndex || start > end) { complete(pending.id, "Periode yang diminta belum tersedia pada dashboard."); return; }
    const timer = window.setTimeout(() => {
      setStartMonthIndex(start);
      setEndMonthIndex(end);
      finishAssistantAction(pending.id, pending.action.highlight, complete);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, initialLoadDone, sheetData, loadError, complete]);

  useEffect(() => {
    if (!sheetData) return;
    setAssistantPeriod({ startMonthIndex, endMonthIndex, year: sheetData.year });
  }, [endMonthIndex, setAssistantPeriod, sheetData, startMonthIndex]);

  const dashboardMetrics = useMemo(() => {
    const sheetMetrics = new Map(sheetData?.metrics.map((metric) => [metric.id, metric]) ?? []);
    const displayOrder = ["desa-berdaya", "garis-kemiskinan", "muzzaki", "munfik", "bummas", "peserta-program", "peserta-layanan-program", "mualaf"];
    return fallbackMetrics
      .filter((metric) => metric.id !== "pp-terbina")
      .sort((first, second) => displayOrder.indexOf(first.id) - displayOrder.indexOf(second.id))
      .map((metric) => mergeSheetMetric(metric, sheetMetrics.get(metric.id), startMonthIndex, endMonthIndex));
  }, [endMonthIndex, sheetData, startMonthIndex]);

  const year = sheetData?.year ?? new Date().getFullYear();
  const months = sheetData?.months ?? ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli"];
  const selectedPeriod = startMonthIndex === endMonthIndex ? `${months[startMonthIndex]} ${year}` : `${months[startMonthIndex]} - ${months[endMonthIndex]} ${year}`;
  const displayedPeriod = sheetData ? selectedPeriod : "";
  const pp = dashboardMetrics.find((metric) => metric.id === "peserta-program")!;
  const plp = dashboardMetrics.find((metric) => metric.id === "peserta-layanan-program")!;
  const povertyExit = dashboardMetrics.find((metric) => metric.id === "garis-kemiskinan")!;
  const ppTerbinaFallback = fallbackMetrics.find((metric) => metric.id === "pp-terbina")!;
  const ppTerbina = mergeSheetMetric(ppTerbinaFallback, sheetData?.metrics.find((metric) => metric.id === "pp-terbina"), startMonthIndex, endMonthIndex);
  const isPpTerbinaAvailable = Boolean(sheetData?.metrics.some((metric) => metric.id === "pp-terbina"));
  const ppTerbinaPercentage = ppTerbina.target > 0 ? Math.round((ppTerbina.achievement / ppTerbina.target) * 100) : 0;
  const ppTerbinaTone = achievementTone(ppTerbinaPercentage);

  return (
    <section className="space-y-8">
      <AssistantPageContext context={{ page: "Dashboard utama", filters: { periode: displayedPeriod || "Data sedang dimuat" }, summary: sheetData ? dashboardMetrics.map((metric) => `${metric.title}: capaian ${formatNumber(metric.achievement)}, target ${formatNumber(metric.target)}`).slice(0, 8) : [] }} />
      <div data-agent-target="summary" className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-8 text-white shadow-xl shadow-black/20">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-[#D84315]/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-[#D84315]" /> Dashboard Utama Rumah Zakat
              </div>
              <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">Laporan Pemberdayaan Rumah Zakat</h1>
              <p className="mt-4 text-sm text-white/70 md:text-base">Pantau target, capaian, dan dampak program pemberdayaan dalam tampilan eksekutif yang ringkas, profesional, dan mudah ditelusuri hingga data detail.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/ikhtisar-pp-plp" className="inline-flex items-center gap-2 rounded-xl bg-[#D84315] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D84315]/30 transition hover:bg-[#BF360C] hover:shadow-xl">Lihat Ikhtisar PP <ArrowUpRight size={16} /></Link>
                <Link href="/peta-sebaran" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"><MapPinned size={16} /> Desa Berdaya</Link>
              </div>
            </div>

            <div data-agent-target="filters" className="w-full max-w-xs flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md md:w-72">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Status Periode</p>
                <CalendarDays size={16} className="text-white/50" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <PeriodMonthSelect label="Bulan awal" value={startMonthIndex} months={months} latestMonthIndex={sheetData?.latestMonthIndex ?? 6} onChange={(value) => { setStartMonthIndex(value); setEndMonthIndex((current) => Math.max(current, value)); }} disabled={!sheetData} />
                <PeriodMonthSelect label="Bulan akhir" value={endMonthIndex} months={months} latestMonthIndex={sheetData?.latestMonthIndex ?? 6} minimum={startMonthIndex} onChange={setEndMonthIndex} disabled={!sheetData} />
              </div>
              <p className="mt-2 min-h-4 text-center text-[11px] font-medium text-white/60">{displayedPeriod}</p>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/50">
                <span>{isLoading ? "Mengambil Google Sheets…" : sheetData ? "Sumber: Google Sheets" : "Data belum tersedia"}</span>
                <button onClick={() => void loadDashboard()} disabled={isLoading} aria-label="Muat ulang data dashboard" className="rounded-lg p-1.5 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError} Angka dikosongkan sampai data berhasil dimuat.</div>}

      <div data-agent-target="results" className="rounded-3xl bg-white/80 p-6 shadow-soft backdrop-blur-sm">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#D84315]">Objectif and Key Result (OKR) Program{displayedPeriod ? ` · ${displayedPeriod}` : ""}</p><h2 className="mt-1 text-2xl font-bold text-ink">Target, Capaian, dan Persentase</h2></div><p className="max-w-xl text-sm text-slate-500 sm:text-right">Target merupakan target tahunan. Capaian menampilkan hasil pada rentang bulan yang dipilih.</p></div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {dashboardMetrics.map((metric) => <Suspense key={metric.id} fallback={<div className="h-[340px] animate-pulse rounded-2xl bg-slate-100" />}><DashboardCard metric={metric} isDataAvailable={Boolean(sheetData?.metrics.some((item) => item.id === metric.id))} dataThroughLabel={metric.dataThroughMonthIndex !== undefined ? months[metric.dataThroughMonthIndex] : undefined} /></Suspense>)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-3xl bg-gradient-to-br from-[#FFF8E1] to-[#FFF3E0] p-7 shadow-soft">
          <div className="mb-4 flex items-center gap-3"><div className="h-10 w-1 rounded-full bg-[#D84315]" /><p className="text-sm font-semibold uppercase tracking-wider text-[#D84315]">Ringkasan Eksekutif</p></div>
          <h3 className="text-xl font-bold text-ink">Capaian Program{displayedPeriod ? ` periode ${displayedPeriod}` : ""}</h3>
          {sheetData ? <p className="mt-4 text-sm leading-7 text-slate-600">Peserta Program mencapai <span className="font-semibold text-[#D84315]">{formatNumber(pp.achievement)} orang</span> dari target {formatNumber(pp.target)}, sementara Peserta Layanan Program mencapai <span className="font-semibold text-[#D84315]">{formatNumber(plp.achievement)} layanan</span>. Peserta yang keluar dari garis kemiskinan tercatat <span className="font-semibold text-[#D84315]">{formatNumber(povertyExit.achievement)} orang</span>.</p> : <div className="mt-4 min-h-7" />}
        </div>
        <Link href="/pp-terbina" className="group col-span-1 rounded-3xl border border-orange-100 bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#D84315]">Peserta Program Terbina</p><p className="mt-1 min-h-4 text-xs text-slate-500">{displayedPeriod ? `Capaian periode ${displayedPeriod}` : ""}</p></div><ArrowUpRight size={18} className="text-[#D84315] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
          <div className="mt-6 grid grid-cols-2 gap-4"><div><p className="text-xs uppercase tracking-wider text-slate-400">Target</p><p className="mt-1 min-h-8 text-2xl font-bold text-ink">{isPpTerbinaAvailable ? formatNumber(ppTerbina.target) : ""}</p></div><div><p className="text-xs uppercase tracking-wider text-slate-400">Capaian</p><p className="mt-1 min-h-8 text-2xl font-bold text-[#D84315]">{isPpTerbinaAvailable ? formatNumber(ppTerbina.achievement) : ""}</p>{isPpTerbinaAvailable && ppTerbina.dataThroughMonthIndex !== undefined && <p className="mt-1 text-[11px] font-semibold text-[#D84315]">*per {months[ppTerbina.dataThroughMonthIndex]}</p>}</div></div>
          <div className="mt-5 h-2.5 rounded-full" style={{ backgroundColor: ppTerbinaTone.trackColor }}><div className="h-2.5 rounded-full" style={{ width: `${isPpTerbinaAvailable ? Math.min(ppTerbinaPercentage, 100) : 0}%`, backgroundColor: ppTerbinaTone.color }} /></div><p className="mt-2 min-h-4 text-right text-xs font-semibold" style={{ color: ppTerbinaTone.color }}>{isPpTerbinaAvailable ? `${ppTerbinaPercentage}% · ${ppTerbinaTone.label}` : ""}</p>
        </Link>
      </div>
    </section>
  );
}

function PeriodMonthSelect({ label, value, months, latestMonthIndex, minimum = 0, disabled, onChange }: { label: string; value: number; months: readonly string[]; latestMonthIndex: number; minimum?: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="relative block"><span className="pointer-events-none absolute left-2.5 top-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/45">{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} className="h-12 w-full rounded-xl border border-white/15 bg-white/10 px-2.5 pb-1 pt-4 text-sm font-bold text-white outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/20 disabled:opacity-60">{months.slice(0, latestMonthIndex + 1).map((month, index) => <option key={month} value={index} disabled={index < minimum} className="text-slate-900">{month}</option>)}</select></label>;
}
