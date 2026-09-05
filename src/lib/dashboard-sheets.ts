import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";

export const DASHBOARD_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const PROGRAM_IDS: Record<string, string> = {
  "desa berdaya": "desa-berdaya",
  bummas: "bummas",
  pp: "peserta-program",
  "pp terbina": "pp-terbina",
  plp: "peserta-layanan-program",
  muallaf: "mualaf",
  "keluar dari gk": "garis-kemiskinan",
  munfik: "munfik",
  muzzaki: "muzzaki",
};

export type DashboardSheetMetric = {
  id: string;
  target: number;
  achievement: number;
  monthly: number[];
};

export type DashboardSheetData = {
  metrics: DashboardSheetMetric[];
  months: readonly string[];
  latestMonthIndex: number;
  year: number;
  updatedAt: string;
  source: "Google Sheets";
};

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  return rows;
}

function parseIndonesianNumber(value: string) {
  if (!value.trim()) return 0;
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDashboardSheetData(): Promise<DashboardSheetData> {
  const { spreadsheetId, gid } = resolvedDataSource("dashboard");
  const year = Number(process.env.GOOGLE_SHEETS_DASHBOARD_YEAR) || new Date().getFullYear();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const csv = await fetchGoogleSheetCsv(url);
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  const headerIndex = table.findIndex((row) => {
    const normalized = row.map((cell) => cell.trim().toLowerCase());
    return normalized.includes("program") && normalized.includes("target") && normalized.includes("capaian");
  });
  if (headerIndex < 0) throw new Error("Header PROGRAM, TARGET, dan CAPAIAN tidak ditemukan.");

  const header = table[headerIndex].map((cell) => cell.trim().toLowerCase());
  const programColumn = header.indexOf("program");
  const targetColumn = header.indexOf("target");
  const achievementColumn = header.indexOf("capaian");
  const monthColumns = DASHBOARD_MONTHS.map((month) => header.indexOf(month.toLowerCase()));
  const rows = table.slice(headerIndex + 1);
  const metrics = rows.flatMap((row): DashboardSheetMetric[] => {
    const id = PROGRAM_IDS[(row[programColumn] ?? "").trim().toLowerCase()];
    if (!id) return [];

    return [{
      id,
      target: parseIndonesianNumber(row[targetColumn] ?? ""),
      achievement: parseIndonesianNumber(row[achievementColumn] ?? ""),
      monthly: monthColumns.map((column) => column >= 0 ? parseIndonesianNumber(row[column] ?? "") : 0),
    }];
  });

  if (metrics.length === 0) throw new Error("Struktur sheet Target dan Capaian tidak dikenali.");

  let latestMonthIndex = 0;
  metrics.forEach((metric) => metric.monthly.forEach((value, index) => {
    if (value !== 0) latestMonthIndex = Math.max(latestMonthIndex, index);
  }));

  return {
    metrics,
    months: DASHBOARD_MONTHS,
    latestMonthIndex,
    year,
    updatedAt: new Date().toISOString(),
    source: "Google Sheets",
  };
}
