import { queryDetailData } from "@/lib/ai-data-query";
import { resolvedDataSource, type AiDataSourceId } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";
import { getServerCachedData } from "@/lib/server-data-cache";

export type ProgramImpactIndicator = {
  id: "terserap-kerja" | "wirausaha" | "hafiz" | "pp-terbina";
  achievement: number;
  sourceLabel: string;
  sourceUrl: string;
  dataThrough: string;
};

export type ProgramImpactData = {
  year: number;
  indicators: ProgramImpactIndicator[];
  quality: {
    vocation: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    hafidz: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    ppTerbina: { rowsRead: number; rowsAccepted: number; rowsRejected: number; isValid: boolean };
  };
  updatedAt: string;
};

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

function normalized(value: string) {
  return value.toLocaleLowerCase("id-ID").replace(/[\r\n]+/g, " ").replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function sourceCsvUrl(sourceId: AiDataSourceId) {
  const source = resolvedDataSource(sourceId);
  return { source, csvUrl: `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/export?format=csv&gid=${source.gid}` };
}

async function loadVocationImpact() {
  const { source, csvUrl } = sourceCsvUrl("vokasi-impact");
  const table = parseCsv((await fetchGoogleSheetCsv(csvUrl)).replace(/^\uFEFF/, ""));
  const header = table[0]?.map(normalized) ?? [];
  const nameColumn = header.findIndex((value) => value === "nama peserta program");
  const outcomeColumn = header.findIndex((value) => value.includes("terserap kerja") && value.includes("membuka usaha"));
  const yearColumn = header.findIndex((value) => value.includes("tahun terserap kerja") && value.includes("tahun membuka usaha"));
  if (nameColumn < 0 || outcomeColumn < 0) throw new Error("Kolom Nama Peserta Program atau Terserap Kerja/Membuka Usaha tidak ditemukan.");
  const rows = table.slice(1).filter((row) => row.some(Boolean));
  const validRows = rows.filter((row) => row[nameColumn]?.trim() && ["terserap kerja", "membuka usaha"].includes(normalized(row[outcomeColumn] ?? "")));
  const years = validRows.map((row) => Number(row[yearColumn] ?? 0)).filter((value) => Number.isInteger(value) && value > 2000);
  return {
    employed: validRows.filter((row) => normalized(row[outcomeColumn] ?? "") === "terserap kerja").length,
    entrepreneurs: validRows.filter((row) => normalized(row[outcomeColumn] ?? "") === "membuka usaha").length,
    year: years.length ? Math.max(...years) : new Date().getFullYear(),
    rowsRead: rows.length, rowsAccepted: validRows.length, rowsRejected: rows.length - validRows.length,
    source,
  };
}

async function loadHafidzImpact() {
  const { source, csvUrl } = sourceCsvUrl("hafidz-impact");
  const table = parseCsv((await fetchGoogleSheetCsv(csvUrl)).replace(/^\uFEFF/, ""));
  const header = table[0]?.map(normalized) ?? [];
  const nameColumn = header.findIndex((value) => value === "nama pp");
  const hafidzColumn = header.findIndex((value) => value === "hafidz");
  if (nameColumn < 0 || hafidzColumn < 0) throw new Error("Kolom Nama PP atau Hafidz tidak ditemukan.");
  const rows = table.slice(1).filter((row) => row.some(Boolean));
  const validRows = rows.filter((row) => row[nameColumn]?.trim() && /\b30\s*juz\b/i.test(row[hafidzColumn] ?? ""));
  return { total: validRows.length, rowsRead: rows.length, rowsAccepted: validRows.length, rowsRejected: rows.length - validRows.length, source };
}

export async function getProgramImpactData(forceRefresh = false): Promise<ProgramImpactData> {
  const [vocation, hafidz, ppTerbina] = await Promise.all([
    getServerCachedData("impact-vocation-v1", loadVocationImpact, forceRefresh),
    getServerCachedData("impact-hafidz-v1", loadHafidzImpact, forceRefresh),
    queryDetailData({ source: "details", metricId: "pp-terbina" }, forceRefresh),
  ]);
  const ppPeriod = ppTerbina.period ? `${ppTerbina.period.startMonth}–${ppTerbina.period.endMonth}` : "Data terbaru";
  return {
    year: vocation.year,
    indicators: [
      { id: "terserap-kerja", achievement: vocation.employed, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "wirausaha", achievement: vocation.entrepreneurs, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "hafiz", achievement: hafidz.total, sourceLabel: hafidz.source.label, sourceUrl: hafidz.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "pp-terbina", achievement: ppTerbina.total, sourceLabel: ppTerbina.provenance.sourceLabel, sourceUrl: ppTerbina.provenance.sheetUrl, dataThrough: ppPeriod },
    ],
    quality: {
      vocation: { rowsRead: vocation.rowsRead, rowsAccepted: vocation.rowsAccepted, rowsRejected: vocation.rowsRejected },
      hafidz: { rowsRead: hafidz.rowsRead, rowsAccepted: hafidz.rowsAccepted, rowsRejected: hafidz.rowsRejected },
      ppTerbina: { rowsRead: ppTerbina.quality.rowsRead, rowsAccepted: ppTerbina.quality.rowsAccepted, rowsRejected: ppTerbina.quality.rowsRejected, isValid: ppTerbina.quality.isValid },
    },
    updatedAt: new Date().toISOString(),
  };
}
