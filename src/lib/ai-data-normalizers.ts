import { ASNAF_FIELDS, PARTICIPANT_MONTHS, type ParticipantSheetData } from "@/lib/participant-sheets";
import { DASHBOARD_MONTHS, type DashboardSheetData } from "@/lib/dashboard-sheets";
import type { MetricDetailData } from "@/lib/metric-detail-sheets";
import { createQualityReport, limitedIssueCollector } from "@/lib/data-quality";
import { normalizeDataTerm } from "@/lib/metric-dictionary";
import { resolvedDataSource, type AiDataSourceId } from "@/lib/data-catalog";
import type { DataProvenance, NormalizedDashboardRecord, NormalizedDataset, NormalizedDetailRecord, NormalizedMunfikRecord, NormalizedParticipantRecord } from "@/lib/normalized-data";

function provenance(sourceId: AiDataSourceId, updatedAt: string): DataProvenance {
  const source = resolvedDataSource(sourceId);
  return { sourceId, sourceLabel: source.label, spreadsheetId: source.spreadsheetId, gid: source.gid, sheetUrl: source.sheetUrl, updatedAt };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDashboardData(data: DashboardSheetData): NormalizedDataset<NormalizedDashboardRecord> {
  const collector = limitedIssueCollector();
  const seen = new Set<string>();
  const records: NormalizedDashboardRecord[] = [];

  data.metrics.forEach((metric, index) => {
    if (seen.has(metric.id)) collector.add({ severity: "error", code: "DUPLICATE_INDICATOR", message: `Indikator ${metric.id} muncul lebih dari satu kali.`, sourceRow: index + 2 });
    seen.add(metric.id);
    const monthlyTotal = metric.monthly.reduce((sum, value) => sum + value, 0);
    if (monthlyTotal !== metric.achievement) collector.add({ severity: "warning", code: "ACHIEVEMENT_MONTHLY_MISMATCH", message: `Capaian ${metric.id} (${metric.achievement}) berbeda dari jumlah bulanan (${monthlyTotal}).`, sourceRow: index + 2 });
    metric.monthly.forEach((value, monthIndex) => records.push({ indicatorId: metric.id, year: data.year, monthIndex, value, annualTarget: metric.target }));
  });

  return {
    records,
    quality: createQualityReport({ rowsRead: data.metrics.length, rowsAccepted: data.metrics.length, rowsRejected: 0, issues: collector.issues }),
    provenance: provenance("dashboard", data.updatedAt),
  };
}

export function normalizeParticipantData(data: ParticipantSheetData): NormalizedDataset<NormalizedParticipantRecord> {
  const collector = limitedIssueCollector();
  const records = data.rows.map((row) => {
    const asnaf = Object.fromEntries(ASNAF_FIELDS.map(([field, label]) => [label, row[field]]));
    const asnafTotal = Object.values(asnaf).reduce((sum, value) => sum + value, 0);
    if (asnafTotal !== row.total) collector.add({ severity: "warning", code: "ASNAF_TOTAL_MISMATCH", message: `Jumlah asnaf (${asnafTotal}) berbeda dari JUMLAH (${row.total}).`, sourceRow: row.sourceRow });
    if (row.monthIndex < 0 || row.monthIndex >= PARTICIPANT_MONTHS.length) collector.add({ severity: "error", code: "INVALID_MONTH", message: `Indeks bulan ${row.monthIndex} tidak valid.`, sourceRow: row.sourceRow });
    return {
      sourceRow: row.sourceRow,
      year: row.year,
      monthIndex: row.monthIndex,
      province: normalizeDataTerm(row.province),
      city: normalizeDataTerm(row.city),
      branch: normalizeDataTerm(row.branch),
      program: normalizeDataTerm(row.program),
      subProgram: normalizeDataTerm(row.subProgram),
      asnaf,
      value: row.total,
    };
  });

  return {
    records,
    quality: createQualityReport({ rowsRead: data.rows.length, rowsAccepted: records.length, rowsRejected: data.rows.length - records.length, issues: collector.issues }),
    provenance: provenance("participants", data.updatedAt),
  };
}

function normalizedMonth(value: string) {
  const normalized = value.trim().toLocaleLowerCase("id-ID");
  const byName = DASHBOARD_MONTHS.findIndex((month) => normalized.includes(month.toLocaleLowerCase("id-ID")));
  if (byName >= 0) return byName;
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric - 1;
  const parts = normalized.split(/[/-]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const month = parts[0] > 1900 ? parts[1] : parts[2] > 1900 ? parts[1] : parts[0];
    return month >= 1 && month <= 12 ? month - 1 : -1;
  }
  return -1;
}

const DETAIL_NORMALIZATION = {
  muzzaki: { sourceId: "muzzaki", datasetIndex: 0, monthColumn: "Bulan", requiredColumn: "Nama PP Sesuai KTP" },
  mualaf: { sourceId: "mualaf", datasetIndex: 0, monthColumn: "Bulan Informasi", requiredColumn: "Nama PM" },
  "pp-terbina": { sourceId: "pp-terbina", datasetIndex: 0, monthColumn: "Bulan Awal Program", requiredColumn: "Nama PP" },
  bummas: { sourceId: "bummas", datasetIndex: 0, monthColumn: null, requiredColumn: "Bidang Usaha/Program" },
  "garis-kemiskinan": { sourceId: "garis-kemiskinan", datasetIndex: 0, monthColumn: "Bulan", requiredColumn: "Nama PP Sesuai KTP" },
  "garis-kemiskinan-recap": { sourceId: "garis-kemiskinan-recap", datasetIndex: 1, monthColumn: "Bulan", requiredColumn: "Bulan" },
} as const;

export type DetailMetricId = keyof typeof DETAIL_NORMALIZATION;

export function normalizeMetricDetailData(metricId: DetailMetricId, data: MetricDetailData): NormalizedDataset<NormalizedDetailRecord> {
  const collector = limitedIssueCollector();
  const definition = DETAIL_NORMALIZATION[metricId];
  const dataset = data.datasets[definition.datasetIndex];
  if (!dataset) {
    collector.add({ severity: "error", code: "DETAIL_DATASET_MISSING", message: `Dataset ${metricId} tidak ditemukan.` });
    return { records: [], quality: createQualityReport({ rowsRead: 0, rowsAccepted: 0, rowsRejected: 0, issues: collector.issues }), provenance: provenance(definition.sourceId, data.updatedAt) };
  }
  const columnIndex = (name: string) => dataset.columns.findIndex((candidate) => candidate.toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"));
  const requiredIndex = columnIndex(definition.requiredColumn);
  const monthIndex = definition.monthColumn ? columnIndex(definition.monthColumn) : -1;
  if (requiredIndex < 0) collector.add({ severity: "error", code: "REQUIRED_COLUMN_MISSING", message: `Kolom ${definition.requiredColumn} tidak ditemukan.` });

  const records = dataset.rows.flatMap((row, index): NormalizedDetailRecord[] => {
    const requiredValue = (row[requiredIndex] ?? "").trim();
    const normalizedRequired = requiredValue.toLocaleLowerCase("id-ID");
    if (!requiredValue || requiredValue === "-" || normalizedRequired === "tidak tercantum") return [];
    const parsedMonth = monthIndex >= 0 ? normalizedMonth(row[monthIndex] ?? "") : null;
    if (monthIndex >= 0 && parsedMonth !== null && parsedMonth < 0) collector.add({ severity: "warning", code: "DETAIL_MONTH_UNRECOGNIZED", message: `Periode ${metricId} tidak dikenali.`, sourceRow: index + 2 });
    const values = Object.fromEntries(dataset.columns.map((column, columnPosition) => [column, (row[columnPosition] ?? "").trim()]));
    return [{ sourceRow: index + 2, monthIndex: parsedMonth !== null && parsedMonth >= 0 ? parsedMonth : null, values }];
  });

  return {
    records,
    quality: createQualityReport({ rowsRead: dataset.rows.length, rowsAccepted: records.length, rowsRejected: dataset.rows.length - records.length, issues: collector.issues }),
    provenance: provenance(definition.sourceId, data.updatedAt),
  };
}

export function normalizeMunfikData(data: MetricDetailData): NormalizedDataset<NormalizedMunfikRecord> {
  const collector = limitedIssueCollector();
  const dataset = data.datasets.find((item) => item.title === "Data Munfik Ternormalisasi");
  if (!dataset) {
    collector.add({ severity: "error", code: "NORMALIZED_DATASET_MISSING", message: "Dataset Munfik ternormalisasi tidak ditemukan." });
    return { records: [], quality: createQualityReport({ rowsRead: 0, rowsAccepted: 0, rowsRejected: 0, issues: collector.issues }), provenance: provenance("munfik", data.updatedAt) };
  }

  const column = (name: string) => dataset.columns.findIndex((candidate) => candidate.toLocaleLowerCase("id-ID") === name.toLocaleLowerCase("id-ID"));
  const indexes = {
    sourceRow: column("Baris Sumber"), month: column("Bulan"), source: column("Sumber"), name: column("Nama"), office: column("Cabang/Kantor"), city: column("Kab/Kota"), province: column("Provinsi"), program: column("Program"), nominal: column("Nominal"),
  };
  const required = [indexes.month, indexes.source, indexes.name];
  if (required.some((index) => index < 0)) collector.add({ severity: "error", code: "REQUIRED_COLUMNS_MISSING", message: "Kolom Bulan, Sumber, atau Nama pada data Munfik tidak ditemukan." });

  const records = dataset.rows.flatMap((row, index): NormalizedMunfikRecord[] => {
    const sourceRow = Number(row[indexes.sourceRow] ?? "") || index + 1;
    const monthIndex = normalizedMonth(row[indexes.month] ?? "");
    const sourceType = row[indexes.source] as NormalizedMunfikRecord["sourceType"];
    if (monthIndex < 0 || !["Empowerment", "Progdis", "Dakwah"].includes(sourceType)) {
      collector.add({ severity: "error", code: "INVALID_MUNFIK_ROW", message: "Bulan atau sumber Munfik tidak valid.", sourceRow });
      return [];
    }
    return [{
      sourceRow,
      monthIndex,
      sourceType,
      name: (row[indexes.name] ?? "").trim(),
      office: normalizeDataTerm(row[indexes.office] ?? ""),
      city: normalizeDataTerm(row[indexes.city] ?? ""),
      province: normalizeDataTerm(row[indexes.province] ?? ""),
      program: normalizeDataTerm(row[indexes.program] ?? ""),
      nominal: parseOptionalNumber(row[indexes.nominal] ?? ""),
    }];
  });

  return {
    records,
    quality: createQualityReport({ rowsRead: dataset.rows.length, rowsAccepted: records.length, rowsRejected: dataset.rows.length - records.length, issues: collector.issues }),
    provenance: provenance("munfik", data.updatedAt),
  };
}
