"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Download, Eye, EyeOff, FileDown, FileSpreadsheet, Filter, RefreshCw, RotateCcw, Search, TrendingDown, TrendingUp } from "lucide-react";
import type { SheetData } from "write-excel-file/browser";
import { fetchCachedJson, getCachedJsonSnapshot } from "@/lib/client-data-cache";
import { ASNAF_FIELDS, type AsnafField, type ParticipantRow, type ParticipantSheetData } from "@/lib/participant-sheets";
import type { ParticipantAnalysisData } from "@/lib/participant-analysis";
import { useReportingPeriod } from "@/components/ReportingPeriodContext";
import { AssistantPageContext } from "@/components/AssistantViewContext";
import { MultiFilterSelect } from "@/components/MultiFilterSelect";
import { finishAssistantAction, useAssistantActions } from "@/components/AssistantActionContext";
import { resolveActionValues } from "@/lib/assistant-view-action";

const ParticipantCharts = dynamic(() => import("@/components/ParticipantCharts").then((module) => module.ParticipantCharts), { loading: () => <div className="h-[330px] animate-pulse rounded-[26px] bg-slate-100 xl:col-span-2" /> });
const DEFAULT_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli"];
const ANALYSIS_CACHE_KEY = "participant-analysis-v7";
type Filters = { startMonthIndex: number; endMonthIndex: number; province: string[]; city: string[]; branch: string[]; program: string[]; subProgram: string[]; query: string };
type ReportRow = Record<AsnafField, number> & { program: string; subProgram: string; total: number; kind: "detail" | "subtotal" | "grand" };
type BranchReportRow = Record<AsnafField, number> & { branch: string; program: string; total: number; kind: "detail" | "subtotal" | "grand" };
type MonthlyReportRow = { program: string; subProgram: string; values: number[]; total: number; kind: "detail" | "subtotal" | "grand" };
type ReportMode = "program" | "branch" | "monthly";

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
const matchesSelection = (selected: string[], value: string) => selected.length === 0 || selected.includes(value);

function summarize(rows: ParticipantRow[], field: "program" | "subProgram" | "branch") {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row[field], (totals.get(row[field]) ?? 0) + row.total));
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function emptyRow(program: string, subProgram: string, kind: ReportRow["kind"]): ReportRow {
  return { program, subProgram, kind, total: 0, fakir: 0, miskin: 0, amil: 0, ibnuSabil: 0, fiiSabilillah: 0, gharimin: 0, muallaf: 0, hambaSahaya: 0, nonAsnaf: 0 };
}

function addRow(target: Record<AsnafField, number> & { total: number }, source: Record<AsnafField, number> & { total: number }) {
  ASNAF_FIELDS.forEach(([field]) => { target[field] += source[field]; });
  target.total += source.total;
}

function createReport(rows: ParticipantRow[]) {
  const groups = new Map<string, ReportRow>();
  rows.forEach((row) => {
    const key = `${row.program}\u0000${row.subProgram}`;
    const item = groups.get(key) ?? emptyRow(row.program, row.subProgram, "detail");
    addRow(item, row);
    groups.set(key, item);
  });
  const details = [...groups.values()].sort((a, b) => a.program.localeCompare(b.program, "id") || a.subProgram.localeCompare(b.subProgram, "id"));
  const result: ReportRow[] = [];
  const grand = emptyRow("Grand Total", "", "grand");
  let current = "";
  let subtotal: ReportRow | null = null;
  details.forEach((detail) => {
    if (current && detail.program !== current && subtotal) result.push(subtotal);
    if (detail.program !== current) { current = detail.program; subtotal = emptyRow(`${current} Total`, "", "subtotal"); }
    result.push(detail);
    addRow(subtotal!, detail);
    addRow(grand, detail);
  });
  if (subtotal) result.push(subtotal);
  result.push(grand);
  return result;
}

function createBranchReport(rows: ParticipantRow[]) {
  const groups = new Map<string, BranchReportRow>();
  rows.forEach((row) => {
    const key = `${row.branch}\u0000${row.program}`;
    const item = groups.get(key) ?? { ...emptyRow(row.program, "", "detail"), branch: row.branch };
    addRow(item, row);
    groups.set(key, item);
  });
  const details = [...groups.values()].sort((a, b) => a.branch.localeCompare(b.branch, "id") || a.program.localeCompare(b.program, "id", { numeric: true }));
  const result: BranchReportRow[] = [];
  const grand = { ...emptyRow("", "", "grand"), branch: "Grand Total" };
  let current = "";
  let subtotal: BranchReportRow | null = null;
  details.forEach((detail) => {
    if (current && detail.branch !== current && subtotal) result.push(subtotal);
    if (detail.branch !== current) {
      current = detail.branch;
      subtotal = { ...emptyRow("", "", "subtotal"), branch: `${current} Total` };
    }
    result.push(detail);
    addRow(subtotal!, detail);
    addRow(grand, detail);
  });
  if (subtotal) result.push(subtotal);
  result.push(grand);
  return result;
}

function createMonthlyReport(rows: ParticipantRow[], startMonthIndex: number, endMonthIndex: number) {
  const monthCount = endMonthIndex - startMonthIndex + 1;
  const groups = new Map<string, MonthlyReportRow>();
  rows.forEach((row) => {
    const key = `${row.program}\u0000${row.subProgram}`;
    const item = groups.get(key) ?? { program: row.program, subProgram: row.subProgram, values: Array(monthCount).fill(0), total: 0, kind: "detail" as const };
    const selectedMonthIndex = row.monthIndex - startMonthIndex;
    if (selectedMonthIndex >= 0 && selectedMonthIndex < monthCount) item.values[selectedMonthIndex] += row.total;
    item.total += row.total;
    groups.set(key, item);
  });
  const details = [...groups.values()].sort((a, b) => a.program.localeCompare(b.program, "id", { numeric: true }) || a.subProgram.localeCompare(b.subProgram, "id"));
  const result: MonthlyReportRow[] = [];
  const grand: MonthlyReportRow = { program: "Grand Total", subProgram: "", values: Array(monthCount).fill(0), total: 0, kind: "grand" };
  let current = "";
  let subtotal: MonthlyReportRow | null = null;
  const addMonthly = (target: MonthlyReportRow, source: MonthlyReportRow) => {
    source.values.forEach((value, index) => { target.values[index] += value; });
    target.total += source.total;
  };
  details.forEach((detail) => {
    if (current && detail.program !== current && subtotal) result.push(subtotal);
    if (detail.program !== current) {
      current = detail.program;
      subtotal = { program: `${current} Total`, subProgram: "", values: Array(monthCount).fill(0), total: 0, kind: "subtotal" };
    }
    result.push(detail);
    addMonthly(subtotal!, detail);
    addMonthly(grand, detail);
  });
  if (subtotal) result.push(subtotal);
  result.push(grand);
  return result;
}

function downloadBlob(content: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function HeaderMonthSelect({ label, value, months, minimum = 0, onChange }: { label: string; value: number; months: readonly string[]; minimum?: number; onChange: (value: number) => void }) {
  return <label className="relative block"><span className="pointer-events-none absolute left-2.5 top-1 text-[8px] font-bold uppercase tracking-wider text-white/45">{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-full rounded-xl border border-white/15 bg-white/10 px-2.5 pb-0.5 pt-3 text-[11px] font-semibold text-white outline-none focus:border-orange-300"><option className="text-slate-900" disabled value={-1}>Pilih bulan</option>{months.map((month, index) => <option className="text-slate-900" key={month} value={index} disabled={index < minimum}>{month}</option>)}</select></label>;
}

export function ParticipantOverview() {
  const { setPeriod: setAssistantPeriod } = useReportingPeriod();
  const { pending, complete } = useAssistantActions();
  const cachedParticipants = getCachedJsonSnapshot<ParticipantSheetData>("participants-sheet-v1");
  const [data, setData] = useState<ParticipantSheetData | null>(cachedParticipants);
  const [analysis, setAnalysis] = useState<ParticipantAnalysisData | null>(() => getCachedJsonSnapshot<ParticipantAnalysisData>(ANALYSIS_CACHE_KEY));
  const [isLoading, setIsLoading] = useState(!cachedParticipants);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ startMonthIndex: 0, endMonthIndex: cachedParticipants?.latestMonthIndex ?? 6, province: [], city: [], branch: [], program: [], subProgram: [], query: "" });
  const [reportMode, setReportMode] = useState<ReportMode>("program");
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const acceptData = (nextData: ParticipantSheetData) => { setData(nextData); setFilters((current) => ({ ...current, startMonthIndex: 0, endMonthIndex: nextData.latestMonthIndex })); };
  const loadData = async (forceRefresh = true) => {
    setIsLoading(true); setLoadError(null);
    try {
      const [participants, analysisResult] = await Promise.all([
        fetchCachedJson<ParticipantSheetData>("participants-sheet-v1", "/api/participants", forceRefresh),
        fetchCachedJson<ParticipantAnalysisData>(ANALYSIS_CACHE_KEY, "/api/participant-analysis", forceRefresh).catch(() => analysis),
      ]);
      acceptData(participants);
      if (analysisResult) setAnalysis(analysisResult);
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : "Data Peserta Program tidak dapat dimuat."); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    fetchCachedJson<ParticipantSheetData>("participants-sheet-v1", "/api/participants")
      .then((nextData) => { if (!cancelled) { setData(nextData); setFilters((current) => ({ ...current, startMonthIndex: 0, endMonthIndex: nextData.latestMonthIndex })); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Data Peserta Program tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) { setIsLoading(false); setInitialLoadDone(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pending || pending.action.target !== "/ikhtisar-pp-plp" || !initialLoadDone) return;
    if (!data) { complete(pending.id, loadError || "Data Peserta Program belum tersedia."); return; }
    try {
      const requested = pending.action.filters;
      const startMonthIndex = requested?.startMonthIndex ?? 0;
      const endMonthIndex = requested?.endMonthIndex ?? data.latestMonthIndex;
      if (endMonthIndex > data.latestMonthIndex || startMonthIndex > endMonthIndex) throw new Error("Periode yang diminta belum tersedia pada data Peserta Program.");
      const period = data.rows.filter((row) => row.year === data.year && row.monthIndex >= startMonthIndex && row.monthIndex <= endMonthIndex);
      const branch = resolveActionValues(requested?.branch, unique(period.map((row) => row.branch)), "Cabang");
      const province = resolveActionValues(requested?.province, unique(period.filter((row) => matchesSelection(branch, row.branch)).map((row) => row.province)), "Provinsi");
      const city = resolveActionValues(requested?.city, unique(period.filter((row) => matchesSelection(branch, row.branch) && matchesSelection(province, row.province)).map((row) => row.city)), "Kota/Kab");
      const program = resolveActionValues(requested?.program, unique(period.map((row) => row.program)), "Program");
      const subProgram = resolveActionValues(requested?.subProgram, unique(period.filter((row) => matchesSelection(program, row.program)).map((row) => row.subProgram)), "Sub Program");
      if (!period.some((row) => matchesSelection(branch, row.branch) && matchesSelection(province, row.province) && matchesSelection(city, row.city) && matchesSelection(program, row.program) && matchesSelection(subProgram, row.subProgram))) throw new Error("Kombinasi filter tidak menghasilkan data Peserta Program.");
      const timer = window.setTimeout(() => {
        setFilters({ startMonthIndex, endMonthIndex, branch, province, city, program, subProgram, query: "" });
        if (pending.action.highlight === "filters") setIsFilterExpanded(true);
        finishAssistantAction(pending.id, pending.action.highlight, complete);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch (error) { complete(pending.id, error instanceof Error ? error.message : "Filter tidak dapat diterapkan."); }
  }, [pending, initialLoadDone, data, loadError, complete]);

  useEffect(() => {
    let cancelled = false;
    fetchCachedJson<ParticipantAnalysisData>(ANALYSIS_CACHE_KEY, "/api/participant-analysis")
      .then((nextData) => { if (!cancelled) setAnalysis(nextData); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data) return;
    setAssistantPeriod({ startMonthIndex: filters.startMonthIndex, endMonthIndex: filters.endMonthIndex, year: data.year });
  }, [data, filters.endMonthIndex, filters.startMonthIndex, setAssistantPeriod]);

  const periodRows = useMemo(() => data?.rows.filter((row) => row.year === data.year && row.monthIndex >= filters.startMonthIndex && row.monthIndex <= filters.endMonthIndex) ?? [], [data, filters.endMonthIndex, filters.startMonthIndex]);
  const provinces = useMemo(() => unique(periodRows.filter((row) => matchesSelection(filters.branch, row.branch)).map((row) => row.province)), [filters.branch, periodRows]);
  const cities = useMemo(() => unique(periodRows.filter((row) => matchesSelection(filters.branch, row.branch) && matchesSelection(filters.province, row.province)).map((row) => row.city)), [filters.branch, filters.province, periodRows]);
  const branches = useMemo(() => unique(periodRows.filter((row) => matchesSelection(filters.province, row.province) && matchesSelection(filters.city, row.city)).map((row) => row.branch)), [filters.city, filters.province, periodRows]);
  const programs = useMemo(() => unique(periodRows.map((row) => row.program)), [periodRows]);
  const subPrograms = useMemo(() => unique(periodRows.filter((row) => matchesSelection(filters.program, row.program)).map((row) => row.subProgram)), [filters.program, periodRows]);
  const rows = useMemo(() => { const query = filters.query.trim().toLowerCase(); return periodRows.filter((row) => matchesSelection(filters.province, row.province) && matchesSelection(filters.city, row.city) && matchesSelection(filters.branch, row.branch) && matchesSelection(filters.program, row.program) && matchesSelection(filters.subProgram, row.subProgram) && (!query || [row.province, row.city, row.branch, row.program, row.subProgram].some((value) => value.toLowerCase().includes(query)))); }, [filters, periodRows]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
  const isDataAvailable = Boolean(data);
  const asnaf = useMemo(() => Object.fromEntries(ASNAF_FIELDS.map(([field]) => [field, rows.reduce((sum, row) => sum + row[field], 0)])) as Record<AsnafField, number>, [rows]);
  const programSummary = useMemo(() => summarize(rows, "program").sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true })), [rows]);
  const asnafChartData = useMemo(() => ASNAF_FIELDS.map(([field, label]) => ({ name: label, value: asnaf[field] })), [asnaf]);
  const report = useMemo(() => createReport(rows), [rows]);
  const branchReport = useMemo(() => createBranchReport(rows), [rows]);
  const months = useMemo(() => data?.months ?? DEFAULT_MONTHS, [data?.months]);
  const year = data?.year ?? 2026;
  const selectedMonths = useMemo(() => months.slice(filters.startMonthIndex, filters.endMonthIndex + 1), [filters.endMonthIndex, filters.startMonthIndex, months]);
  const monthlyReport = useMemo(() => createMonthlyReport(rows, filters.startMonthIndex, filters.endMonthIndex), [filters.endMonthIndex, filters.startMonthIndex, rows]);
  const coverage = useMemo(() => ({
    provinces: new Set(rows.map((row) => row.province).filter(Boolean)).size,
    cities: new Set(rows.map((row) => row.city).filter(Boolean)).size,
    branches: new Set(rows.map((row) => row.branch).filter(Boolean)).size,
  }), [rows]);
  const lastDay = new Date(year, filters.endMonthIndex + 1, 0).getDate();
  const periodLabel = data ? `1 ${months[filters.startMonthIndex]} ${year} - ${lastDay} ${months[filters.endMonthIndex]} ${year}` : "";
  const annualTargetRate = analysis?.totals.pp.achievementRate ?? null;
  const annualGrowthRate = analysis?.totals.pp.growthRate ?? null;
  const hasScopedFilter = Boolean(filters.province.length || filters.city.length || filters.branch.length || filters.program.length || filters.subProgram.length || filters.query.trim());
  const activeExportFilters = useMemo(() => [
    { label: "Provinsi", value: filters.province.join(", ") },
    { label: "Kota/Kab", value: filters.city.join(", ") },
    { label: "Cabang", value: filters.branch.join(", ") },
    { label: "Program", value: filters.program.join(", ") },
    { label: "Sub Program", value: filters.subProgram.join(", ") },
    { label: "Pencarian", value: filters.query.trim() },
  ].filter((item) => item.value), [filters]);
  const reset = () => setFilters({ startMonthIndex: 0, endMonthIndex: data?.latestMonthIndex ?? 6, province: [], city: [], branch: [], program: [], subProgram: [], query: "" });
  const exportData = useMemo(() => {
    if (reportMode === "branch") return {
      title: "Laporan Peserta Program per Cabang",
      suffix: "per-cabang",
      headers: ["Cabang", "Program", ...ASNAF_FIELDS.map(([, label]) => label), "Jumlah"],
      rows: branchReport.map((row) => [row.branch, row.program, ...ASNAF_FIELDS.map(([field]) => row[field]), row.total]),
    };
    if (reportMode === "monthly") return {
      title: "Laporan Capaian Peserta Program per Bulan",
      suffix: "per-bulan",
      headers: ["Program", "Sub Program", ...selectedMonths, "Grand Total"],
      rows: monthlyReport.map((row) => [row.program, row.subProgram, ...row.values, row.total]),
    };
    return {
      title: "Laporan Data Peserta Program",
      suffix: "program-subprogram",
      headers: ["Program", "Sub Program", ...ASNAF_FIELDS.map(([, label]) => label), "Jumlah"],
      rows: report.map((row) => [row.program, row.subProgram, ...ASNAF_FIELDS.map(([field]) => row[field]), row.total]),
    };
  }, [branchReport, monthlyReport, report, reportMode, selectedMonths]);
  const headers = exportData.headers;
  const exportRows = exportData.rows;
  const fileName = `laporan-peserta-program-${exportData.suffix}-${months[filters.endMonthIndex].toLowerCase()}-${year}`;
  const exportMetadata = [
    { label: "Periode", value: periodLabel },
    ...activeExportFilters,
    { label: "Total Peserta", value: formatNumber(total) },
  ];

  const exportCsv = () => {
    const metadataRows: Array<Array<string | number>> = [[exportData.title], ...exportMetadata.map((item) => [item.label, item.value]), [], headers, ...exportRows];
    downloadBlob(`\uFEFF${metadataRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`, "text/csv;charset=utf-8", `${fileName}.csv`);
  };
  const exportExcel = async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const head = headers.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#F2662F", color: "#FFFFFF" }));
    const metadataRows: SheetData = [
      [{ value: exportData.title, fontWeight: "bold", fontSize: 15 }],
      ...exportMetadata.map((item) => [{ value: item.label, fontWeight: "bold" as const }, { value: item.value }]),
      [{ value: "" }],
    ];
    const sheet: SheetData = [...metadataRows, head, ...exportRows.map((row) => row.map((value) => ({ value })))];
    const output = writeXlsxFile(sheet, { columns: headers.map((_, index) => ({ width: index < 2 ? 30 : 14 })) });
    await output.toFile(`${fileName}.xlsx`);
  };
  const exportPdf = async () => {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.setFontSize(15);
    pdf.text(exportData.title, 14, 14);
    pdf.setFontSize(9);
    exportMetadata.forEach((item, index) => pdf.text(`${item.label}: ${item.value}`, 14, 20 + (index * 5)));
    const tableStartY = 25 + (exportMetadata.length * 5);
    autoTable(pdf, { startY: tableStartY, head: [headers], body: exportRows.map((row) => row.map((value) => typeof value === "number" ? formatNumber(value) : value)), styles: { fontSize: 6, cellPadding: 1.5 }, headStyles: { fillColor: [242, 102, 47] } });
    pdf.save(`${fileName}.pdf`);
  };

  return <section className="space-y-6">
    <AssistantPageContext context={{ page: "Ikhtisar Peserta Program", filters: { periode: periodLabel || "Data sedang dimuat", provinsi: filters.province, kotaKab: filters.city, cabang: filters.branch, program: filters.program, subProgram: filters.subProgram, pencarian: filters.query, tampilanLaporan: reportMode }, summary: data ? [`Capaian Peserta Program pada filter aktif: ${formatNumber(total)}`, `Jumlah baris sumber: ${formatNumber(rows.length)}`, `Sebaran: ${coverage.provinces} provinsi, ${coverage.cities} kota/kab, ${coverage.branches} cabang`] : [] }} />
    <div data-agent-target="summary" className="overflow-hidden rounded-[30px] bg-white shadow-soft">
      <div className="flex flex-col gap-5 bg-gradient-to-br from-[#0D1B2A] via-[#1B263B] to-[#32415B] p-6 text-white lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-white/65">Ikhtisar Peserta Program</p><h1 className="mt-1 text-3xl font-bold">Dashboard Peserta Program{data ? ` ${year}` : ""}</h1><p className="mt-2 text-sm text-white/70">Data langsung dari Google Sheets dan mengikuti filter aktif.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-stretch"><Link href="/analisa-capaian-pp" className="analysis-cta group relative flex min-w-[230px] items-center gap-3 overflow-hidden rounded-2xl border border-orange-300/70 bg-[#0A1322] px-4 py-3 text-white shadow-[0_12px_32px_rgba(0,0,0,0.32)] ring-1 ring-orange-400/50 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-[0_16px_38px_rgba(0,0,0,0.42)]"><span className="analysis-cta-icon relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2662F] shadow-lg shadow-orange-950/30"><BarChart3 size={20} /></span><span className="relative min-w-0 flex-1"><span className="block text-sm font-extrabold">Analisa Capaian PP</span><span className="mt-0.5 block text-[10px] font-medium text-white/65">Target, growth, dan program</span></span><ArrowUpRight size={17} className="relative text-orange-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link><div className="min-w-[290px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-white/55">Periode laporan</p><p className="text-[10px] font-medium text-orange-200">{periodLabel}</p></div><div className="mt-2 grid grid-cols-2 gap-2"><HeaderMonthSelect label="Bulan awal" value={filters.startMonthIndex} months={months.slice(0, (data?.latestMonthIndex ?? 6) + 1)} onChange={(startMonthIndex) => setFilters((current) => ({ ...current, startMonthIndex, endMonthIndex: Math.max(current.endMonthIndex, startMonthIndex) }))} /><HeaderMonthSelect label="Bulan akhir" value={filters.endMonthIndex} months={months.slice(0, (data?.latestMonthIndex ?? 6) + 1)} minimum={filters.startMonthIndex} onChange={(endMonthIndex) => setFilters((current) => ({ ...current, endMonthIndex }))} /></div></div></div></div>
    </div>

    <div data-agent-target="filters" className={`sticky top-20 z-40 border border-slate-200/80 bg-white/95 shadow-soft backdrop-blur-xl transition-all ${isFilterExpanded ? "w-full rounded-[24px] p-5" : "ml-auto w-fit rounded-[18px] p-2"}`}><div className={`flex flex-wrap items-center gap-3 ${isFilterExpanded ? "mb-4 justify-between" : "justify-end"}`}>{isFilterExpanded && <span className="flex items-center gap-2 text-sm font-semibold"><Filter size={17} className="text-[#F2662F]" /> Filter laporan</span>}<div className="flex flex-wrap items-center gap-2">{isFilterExpanded && <button onClick={reset} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600"><RotateCcw size={15} /> Reset filter</button>}<button type="button" aria-expanded={isFilterExpanded} onClick={() => setIsFilterExpanded((current) => !current)} className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-[#D94F1E] hover:bg-orange-100">{isFilterExpanded ? <EyeOff size={15} /> : <Eye size={15} />} {isFilterExpanded ? "Sembunyikan filter" : "Tampilkan filter"}</button></div></div>
      {isFilterExpanded && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><MultiFilterSelect label="Provinsi" values={filters.province} options={provinces} onChange={(province) => setFilters((current) => ({ ...current, province, city: [] }))} /><MultiFilterSelect label="Kota/Kab" values={filters.city} options={cities} onChange={(city) => setFilters((current) => ({ ...current, city }))} /><MultiFilterSelect label="Cabang" values={filters.branch} options={branches} onChange={(branch) => setFilters((current) => ({ ...current, branch, province: [], city: [] }))} /><MultiFilterSelect label="Program" values={filters.program} options={programs} onChange={(program) => setFilters((current) => ({ ...current, program, subProgram: [] }))} /><MultiFilterSelect label="Sub Program" values={filters.subProgram} options={subPrograms} onChange={(subProgram) => setFilters((current) => ({ ...current, subProgram }))} /><label className="relative"><Search size={16} className="absolute left-3 top-4 text-slate-400" /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Cari data" className="h-12 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm" /></label></div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{isLoading ? "Mengambil Google Sheets…" : `${formatNumber(rows.length)} baris sumber sesuai filter`}</span><button onClick={() => void loadData()} disabled={isLoading} className="flex items-center gap-1 text-[#F2662F]"><RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Muat ulang</button></div>{loadError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}
      </>}
    </div>

    <div className="grid gap-5 xl:grid-cols-[280px_1fr_1fr]">
      <div className="flex min-h-[350px] flex-col overflow-hidden rounded-[26px] bg-gradient-to-br from-[#E64A19] to-[#FF7A00] p-5 text-white shadow-soft"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Capaian Peserta Program</p><p className="mt-3 min-h-[42px] text-[42px] font-bold leading-none tracking-tight">{isDataAvailable ? formatNumber(total) : ""}</p><p className="mt-2 min-h-4 text-[11px] font-medium text-white/80">{periodLabel ? `Periode ${periodLabel}` : ""}</p></div>{annualTargetRate !== null && annualGrowthRate !== null && analysis && <div className="mt-4 w-full rounded-2xl border border-white/10 bg-white/12 p-3 text-left"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-wider text-white/65">Capaian terhadap target</p><p className="mt-0.5 text-[10px] text-white/70">Target {formatNumber(analysis.totals.pp.target)}</p></div><strong className={`text-lg ${annualTargetRate >= 100 ? "text-emerald-200" : annualTargetRate >= 70 ? "text-amber-200" : "text-red-200"}`}>{new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(annualTargetRate)}%</strong></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20"><div className={`h-full rounded-full ${annualTargetRate >= 100 ? "bg-emerald-300" : annualTargetRate >= 70 ? "bg-amber-300" : "bg-red-300"}`} style={{ width: `${Math.min(Math.max(annualTargetRate, 0), 100)}%` }} /></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5"><div><p className="text-[9px] font-semibold uppercase tracking-wider text-white/65">Growth terhadap 2025</p><p className="mt-0.5 text-[9px] text-white/60">History {formatNumber(analysis.totals.pp.history)}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${annualGrowthRate >= 0 ? "bg-emerald-950/25 text-emerald-200" : annualGrowthRate >= -10 ? "bg-amber-950/25 text-amber-200" : "bg-red-950/25 text-red-200"}`}>{annualGrowthRate >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{annualGrowthRate >= 0 ? "+" : ""}{new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(annualGrowthRate)}%</span></div></div>}{hasScopedFilter && analysis && <p className="mt-1.5 text-center text-[9px] text-white/60">Persentase target dan growth memakai acuan nasional.</p>}<div className="mt-auto pt-4"><p className="text-center text-xs font-semibold text-white/90">Penyaluran tersebar di</p><div className="mt-2 grid w-full grid-cols-3 gap-2"><CoverageMetric value={coverage.cities} label="Kota/Kab" isDataAvailable={isDataAvailable} /><CoverageMetric value={coverage.provinces} label="Provinsi" isDataAvailable={isDataAvailable} /><CoverageMetric value={coverage.branches} label="Kantor/Cabang" isDataAvailable={isDataAvailable} /></div></div></div>
      <ParticipantCharts programData={programSummary} asnafData={asnafChartData} />
    </div>
    <div data-agent-target="results" className="rounded-[24px] border border-slate-300 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F2662F]">Laporan Resmi Peserta Program</p>
          <h2 className="mt-1 text-2xl font-extrabold text-ink">{exportData.title}</h2>
          <p className="mt-1 min-h-4 text-xs text-slate-500">{periodLabel ? `Periode ${periodLabel} · mengikuti filter aktif` : ""}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="mb-2 text-[11px] text-slate-500">Ekspor hanya mencakup laporan yang sedang ditampilkan</p>
          <div className="flex flex-wrap gap-2 lg:justify-end"><ExportButton label="CSV" icon={Download} onClick={exportCsv} disabled={!isDataAvailable || isLoading} /><ExportButton label="Excel" icon={FileSpreadsheet} onClick={() => void exportExcel()} disabled={!isDataAvailable || isLoading} /><ExportButton label="PDF" icon={FileDown} onClick={() => void exportPdf()} disabled={!isDataAvailable || isLoading} /></div>
        </div>
      </div>
      <div className="mb-4 inline-flex flex-wrap rounded-xl bg-slate-100 p-1" role="group" aria-label="Mode laporan">
        <ReportModeButton active={reportMode === "program"} onClick={() => setReportMode("program")}>Program &amp; Subprogram</ReportModeButton>
        <ReportModeButton active={reportMode === "branch"} onClick={() => setReportMode("branch")}>PP per Cabang</ReportModeButton>
        <ReportModeButton active={reportMode === "monthly"} onClick={() => setReportMode("monthly")}>Capaian Bulanan</ReportModeButton>
      </div>
      {!isDataAvailable ? <div className="min-h-40 rounded-xl border border-slate-200 bg-slate-50/50" aria-label="Laporan menunggu data" /> : <>
        {reportMode === "program" && <ProgramReportTable rows={report} />}
        {reportMode === "branch" && <BranchReportTable rows={branchReport} />}
        {reportMode === "monthly" && <MonthlyReportTable rows={monthlyReport} months={selectedMonths} year={year} />}
      </>}
    </div>
  </section>;
}

function ExportButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof Download; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-orange-300 hover:text-[#F2662F] disabled:cursor-not-allowed disabled:opacity-40"><Icon size={15} /> {label}</button>; }

function CoverageMetric({ value, label, isDataAvailable }: { value: number; label: string; isDataAvailable: boolean }) {
  return <div className="min-w-0 rounded-xl bg-white/15 px-2 py-3 text-center"><p className="min-h-5 text-xl font-bold leading-none">{isDataAvailable ? formatNumber(value) : ""}</p><p className="mt-1.5 break-words text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/75">{label}</p></div>;
}

function ReportModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-[#F2662F] text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{children}</button>;
}

function reportRowClass(kind: "detail" | "subtotal" | "grand") {
  return `border-b border-slate-200 ${kind === "grand" ? "bg-orange-100 font-bold" : kind === "subtotal" ? "bg-slate-200 font-bold" : "even:bg-slate-50"}`;
}

function ProgramReportTable({ rows }: { rows: ReportRow[] }) {
  return <div className="rounded-xl border border-slate-300"><table className="w-full table-fixed text-[8px] leading-tight lg:text-[9px] xl:text-[10px]"><colgroup><col className="w-[16%]" /><col className="w-[17%]" />{ASNAF_FIELDS.map(([field]) => <col key={field} className="w-[6.1%]" />)}<col className="w-[6.1%]" /></colgroup><thead className="bg-[#263548] text-[7px] uppercase tracking-wide text-white lg:text-[8px]"><tr><th className="px-1.5 py-2 text-left">Program</th><th className="px-1.5 py-2 text-left">Sub Program</th>{ASNAF_FIELDS.map(([, label]) => <th key={label} className="break-words px-1 py-2 text-right">{label}</th>)}<th className="px-1 py-2 text-right font-bold">Jumlah</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.program}-${index}`} className={reportRowClass(row.kind)}><td className="break-words px-1.5 py-1.5 text-ink">{row.program}</td><td className="break-words px-1.5 py-1.5 text-slate-600">{row.subProgram}</td>{ASNAF_FIELDS.map(([field]) => <td key={field} className="px-1 py-1.5 text-right tabular-nums">{formatNumber(row[field])}</td>)}<td className="px-1 py-1.5 text-right font-bold tabular-nums">{formatNumber(row.total)}</td></tr>)}</tbody></table></div>;
}

function BranchReportTable({ rows }: { rows: BranchReportRow[] }) {
  return <div className="max-h-[720px] overflow-y-auto rounded-xl border border-slate-300"><table className="w-full table-fixed text-[8px] leading-tight lg:text-[9px] xl:text-[10px]"><colgroup><col className="w-[15%]" /><col className="w-[18%]" />{ASNAF_FIELDS.map(([field]) => <col key={field} className="w-[6.1%]" />)}<col className="w-[6.1%]" /></colgroup><thead className="sticky top-0 z-10 bg-[#263548] text-[7px] uppercase tracking-wide text-white lg:text-[8px]"><tr><th className="px-1.5 py-2 text-left">Cabang</th><th className="px-1.5 py-2 text-left">Program</th>{ASNAF_FIELDS.map(([, label]) => <th key={label} className="break-words px-1 py-2 text-right">{label}</th>)}<th className="px-1 py-2 text-right font-bold">Jumlah</th></tr></thead><tbody>{rows.map((row, index) => { const previous = rows[index - 1]; const showBranch = row.kind !== "detail" || !previous || previous.branch !== row.branch; return <tr key={`${row.branch}-${row.program}-${index}`} className={reportRowClass(row.kind)}><td className="break-words px-1.5 py-1.5 text-ink">{showBranch ? row.branch : ""}</td><td className="break-words px-1.5 py-1.5 text-slate-600">{row.program}</td>{ASNAF_FIELDS.map(([field]) => <td key={field} className="px-1 py-1.5 text-right tabular-nums">{formatNumber(row[field])}</td>)}<td className="px-1 py-1.5 text-right font-bold tabular-nums">{formatNumber(row.total)}</td></tr>; })}</tbody></table></div>;
}

function MonthlyReportTable({ rows, months, year }: { rows: MonthlyReportRow[]; months: string[]; year: number }) {
  return <div className="rounded-xl border border-slate-300"><table className="w-full table-fixed text-[8px] leading-tight lg:text-[9px] xl:text-[10px]"><colgroup><col className="w-[16%]" /><col className="w-[18%]" />{months.map((month) => <col key={month} />)}<col /></colgroup><thead className="bg-[#263548] text-[7px] uppercase tracking-wide text-white lg:text-[8px]"><tr><th className="px-1.5 py-2 text-left">Program</th><th className="px-1.5 py-2 text-left">Sub Program</th>{months.map((month) => <th key={month} className="break-words px-1 py-2 text-right"><span className="block">{month}</span><span className="font-normal text-white/60">{year}</span></th>)}<th className="px-1 py-2 text-right font-bold">Grand Total</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.program}-${row.subProgram}-${index}`} className={reportRowClass(row.kind)}><td className="break-words px-1.5 py-1.5 text-ink">{row.program}</td><td className="break-words px-1.5 py-1.5 text-slate-600">{row.subProgram}</td>{row.values.map((value, monthIndex) => <td key={monthIndex} className="px-1 py-1.5 text-right tabular-nums">{formatNumber(value)}</td>)}<td className="px-1 py-1.5 text-right font-bold tabular-nums">{formatNumber(row.total)}</td></tr>)}</tbody></table></div>;
}
