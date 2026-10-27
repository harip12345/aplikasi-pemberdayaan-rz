"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Database, RefreshCw, Search, Target, TrendingUp } from "lucide-react";
import { formatNumber, metrics, percentage, type Metric } from "@/data/dashboard";
import { fetchCachedJson, getCachedJsonSnapshot, subscribeCachedJson } from "@/lib/client-data-cache";
import type { DashboardSheetData } from "@/lib/dashboard-sheets";
import type { MetricDetailData, MetricDetailDataset } from "@/lib/metric-detail-sheets";
import { achievementTone } from "@/lib/achievement-tone";
import { AssistantPageContext } from "@/components/AssistantViewContext";

const visualizationFallback = () => <div className="h-80 animate-pulse rounded-[28px] border border-slate-200 bg-slate-100" />;
const MetricDataInsights = dynamic(() => import("@/components/MetricDataInsights").then((module) => module.MetricDataInsights), { loading: visualizationFallback });
const GkImpactVisualization = dynamic(() => import("@/components/GkImpactVisualization").then((module) => module.GkImpactVisualization), { loading: visualizationFallback });

function mergeSummary(metric: Metric, sheetData: DashboardSheetData | null) {
  const sheetMetric = sheetData?.metrics.find((item) => item.id === metric.id);
  if (!sheetMetric) return { ...metric, target: 0, achievement: 0, trend: 0, monthly: [], regions: [] };
  const achievement = sheetMetric.monthly.slice(0, sheetData!.latestMonthIndex + 1).reduce((sum, value) => sum + value, 0);
  return { ...metric, target: sheetMetric.target, achievement };
}

function fetchMetricData(metricId: string, forceRefresh = false) {
  const detailCacheVersion = metricId === "garis-kemiskinan" ? "production-v5" : "production-v3";
  return Promise.all([
    fetchCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", forceRefresh),
    fetchCachedJson<MetricDetailData>(`metric-detail-${metricId}-${detailCacheVersion}`, `/api/metric-details/${metricId}`, forceRefresh),
  ]);
}

export function LiveMetricsDetail({ metricId }: { metricId: string }) {
  return <Suspense fallback={<div className="h-80 animate-pulse rounded-[28px] bg-slate-100" />}><LiveMetricsDetailContent metricId={metricId} /></Suspense>;
}

function LiveMetricsDetailContent({ metricId }: { metricId: string }) {
  const searchParams = useSearchParams();
  const program = searchParams.get("program");
  const allowedPrograms = ["ekonomi", "pendidikan", "kesehatan", "lingkungan", "dakwah"];
  const returnPage = searchParams.get("from") === "dampak-program"
    ? { href: `/dampak-program?program=${allowedPrograms.includes(program ?? "") ? program : "ekonomi"}`, label: "Dampak Program" }
    : { href: "/", label: "Dashboard" };
  const fallback = metrics.find((metric) => metric.id === metricId)!;
  const cachedSheetData = getCachedJsonSnapshot<DashboardSheetData>("dashboard-sheet-production-v2");
  const cachedDetail = getCachedJsonSnapshot<MetricDetailData>(`metric-detail-${metricId}-${metricId === "garis-kemiskinan" ? "production-v5" : "production-v3"}`);
  const [sheetData, setSheetData] = useState<DashboardSheetData | null>(cachedSheetData);
  const [detail, setDetail] = useState<MetricDetailData | null>(cachedDetail);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(!cachedSheetData || !cachedDetail);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    setIsLoading(true); setLoadError(null);
    try {
      const [summary, detailData] = await fetchMetricData(metricId, forceRefresh);
      setSheetData(summary); setDetail(detailData);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data detail belum dapat dimuat.");
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const detailCacheVersion = metricId === "garis-kemiskinan" ? "production-v5" : "production-v3";
    const stopSummaryUpdates = subscribeCachedJson<DashboardSheetData>("dashboard-sheet-production-v2", "/api/dashboard", setSheetData);
    const stopDetailUpdates = subscribeCachedJson<MetricDetailData>(`metric-detail-${metricId}-${detailCacheVersion}`, `/api/metric-details/${metricId}`, setDetail);
    fetchMetricData(metricId).then(([summary, detailData]) => { if (!cancelled) { setSheetData(summary); setDetail(detailData); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data detail belum dapat dimuat."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; stopSummaryUpdates(); stopDetailUpdates(); };
  }, [metricId]);

  const metric = useMemo(() => mergeSummary(fallback, sheetData), [fallback, sheetData]);
  const isSummaryAvailable = Boolean(sheetData?.metrics.some((item) => item.id === metricId));
  const percent = isSummaryAvailable ? percentage(metric) : 0;
  const percentTone = achievementTone(percent);
  const year = sheetData?.year ?? 2026;
  const gkImpactDataset = detail?.datasets.find((dataset) => dataset.title === "Rekap Capaian Keluar Garis Kemiskinan");
  const detailDatasets = detail?.datasets.filter((dataset) => {
    if (dataset.title === "Rekap Capaian Keluar Garis Kemiskinan") return false;
    if (metricId === "munfik" && dataset.columns.includes("Empowerment") && dataset.columns.includes("Progdis")) return false;
    return true;
  }) ?? [];

  return <section className="space-y-6 rounded-[32px] bg-white/60 p-5 shadow-soft backdrop-blur-sm xl:p-8">
    <AssistantPageContext context={{ page: metric.title, filters: { tahun: String(year), pencarianDetail: query }, summary: isSummaryAvailable ? [`Capaian: ${formatNumber(metric.achievement)} ${metric.unit}`, `Target: ${formatNumber(metric.target)} ${metric.unit}`, `Persentase: ${percent}%`] : [] }} />
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={returnPage.href} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-primary"><ArrowLeft size={16} /> Kembali ke {returnPage.label}</Link><button onClick={() => void loadData(true)} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-[#D84315] disabled:opacity-50"><RefreshCw size={15} className={isLoading ? "animate-spin" : ""} /> Muat ulang</button></div>

    <div><div className="flex flex-wrap items-center gap-3"><div className="rounded-2xl px-3 py-1 text-sm font-medium text-white" style={{ backgroundColor: metric.color }}>{metric.shortTitle}</div><div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-1 text-sm text-slate-600">Tahun {year}</div></div><h1 className="mt-4 text-3xl font-bold text-ink">{metric.title}</h1><p className="mt-2 max-w-3xl text-slate-600">{metric.description}</p></div>

    {metricId !== "garis-kemiskinan" && <div className="grid gap-4 sm:grid-cols-3"><SummaryBox icon={Target} label="Target" value={metric.target} unit={metric.unit} isDataAvailable={isSummaryAvailable} /><SummaryBox icon={TrendingUp} label="Capaian" value={metric.achievement} unit={metric.unit} isDataAvailable={isSummaryAvailable} highlight /><div className="rounded-[24px] border bg-white p-5 shadow-soft" style={{ borderColor: percentTone.trackColor }}><p className="text-sm font-medium text-slate-500">Persentase</p><p className="mt-2 min-h-9 text-3xl font-bold" style={{ color: percentTone.color }}>{isSummaryAvailable ? `${percent}%` : ""}</p><div className="mt-3 h-3 rounded-full" style={{ backgroundColor: percentTone.trackColor }}><div className="h-3 rounded-full" style={{ width: `${isSummaryAvailable ? Math.min(percent, 100) : 0}%`, backgroundColor: percentTone.color }} /></div><p className="mt-2 text-xs font-semibold" style={{ color: percentTone.color }}>{isSummaryAvailable ? percentTone.label : ""}</p></div></div>}

    {metricId === "garis-kemiskinan" && gkImpactDataset && <GkImpactVisualization dataset={gkImpactDataset} year={year} target={metric.target} />}
    {detail && ["muzzaki", "munfik", "mualaf", "pp-terbina", "bummas"].includes(metricId) && <MetricDataInsights metricId={metricId} detail={detail} />}

    <div className="sticky top-20 z-40 rounded-[26px] border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-[#D84315]"><Database size={17} /><p className="text-xs font-semibold uppercase tracking-wider">Data Detail Google Sheets</p></div><p className="mt-1 text-xs text-slate-500">Kolom identitas sensitif tidak ditampilkan.</p></div><label className="relative block sm:w-80"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari data detail" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-300" /></label></div></div>

    {loadError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}
    {isLoading && !detail && <div className="h-52 animate-pulse rounded-3xl bg-slate-100" />}
    {detailDatasets.map((dataset) => <DetailDatasetTable key={`${dataset.title}-${query}`} dataset={dataset} query={query} />)}
  </section>;
}

function SummaryBox({ icon: Icon, label, value, unit, isDataAvailable, highlight = false }: { icon: typeof Target; label: string; value: number; unit: string; isDataAvailable: boolean; highlight?: boolean }) {
  return <div className={`rounded-[24px] border p-5 shadow-soft ${highlight ? "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 ring-1 ring-orange-100/70" : "border-white/70 bg-white"}`}><div className={`flex items-center gap-2 ${highlight ? "text-[#D84315]" : "text-slate-500"}`}><Icon size={18} /><span className="text-sm font-medium">{label}</span></div><p className={`mt-2 min-h-9 text-3xl font-bold ${highlight ? "text-[#B9380D]" : "text-ink"}`}>{isDataAvailable ? formatNumber(value) : ""}</p><p className="min-h-5 text-sm text-slate-500">{isDataAvailable ? unit : ""}</p></div>;
}

function DetailDatasetTable({ dataset, query }: { dataset: MetricDetailDataset; query: string }) {
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => { const normalized = query.trim().toLowerCase(); return normalized ? dataset.rows.filter((row) => row.some((value) => value.toLowerCase().includes(normalized))) : dataset.rows; }, [dataset.rows, query]);
  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);
  return <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#D84315]">Laporan Detail</p><h2 className="mt-1 text-xl font-bold text-ink">{dataset.title}</h2></div><p className="text-xs text-slate-500">{formatNumber(filteredRows.length)} dari {formatNumber(dataset.totalRows)} data</p></div><div className="max-h-[680px] overflow-auto rounded-xl border border-slate-200"><table className="min-w-full whitespace-nowrap text-left text-xs text-slate-600"><thead className="sticky top-0 z-10 bg-[#263548] text-[10px] uppercase tracking-wide text-white"><tr><th className="w-14 px-3 py-3 text-right font-semibold">No.</th>{dataset.columns.map((column) => <th key={column} className="px-3 py-3 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.map((row, rowIndex) => <tr key={`${activePage}-${rowIndex}`} className="even:bg-slate-50 hover:bg-orange-50/50"><td className="px-3 py-2.5 text-right font-medium text-slate-400">{formatNumber((activePage - 1) * pageSize + rowIndex + 1)}</td>{row.map((value, columnIndex) => <td key={columnIndex} className="max-w-[280px] overflow-hidden text-ellipsis px-3 py-2.5">{value || "-"}</td>)}</tr>)}</tbody></table>{filteredRows.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Tidak ada data yang cocok dengan pencarian.</p>}</div>{filteredRows.length > pageSize && <div className="mt-4 flex items-center justify-end gap-3"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={activePage === 1} aria-label={`Halaman sebelumnya ${dataset.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-40"><ChevronLeft size={15} /></button><span className="text-xs font-medium text-slate-500">Halaman {activePage} dari {totalPages}</span><button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={activePage === totalPages} aria-label={`Halaman berikutnya ${dataset.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-40"><ChevronRight size={15} /></button></div>}</div>;
}
