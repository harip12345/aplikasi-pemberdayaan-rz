import { queryDetailData } from "@/lib/ai-data-query";
import { resolvedDataSource, type AiDataSourceId } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";
import { getServerCachedData } from "@/lib/server-data-cache";

export type ProgramImpactLocationDetail = {
  id: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  branch: string;
  status: string;
  villageType: string;
  volunteer: string;
};

export type ProgramImpactIndicator = {
  id: "terserap-kerja" | "wirausaha" | "hafiz" | "masjid" | "pp-terbina";
  achievement: number;
  sourceLabel: string;
  sourceUrl: string;
  dataThrough: string;
  details?: ProgramImpactLocationDetail[];
};

export type ProgramImpactData = {
  year: number;
  indicators: ProgramImpactIndicator[];
  quality: {
    vocation: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    hafidz: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    masjidBerdaya: { rowsRead: number; rowsMatched: number; isValid: boolean };
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

async function loadMasjidBerdayaImpact() {
  const { source, csvUrl } = sourceCsvUrl("distribution");
  const table = parseCsv((await fetchGoogleSheetCsv(csvUrl)).replace(/^\uFEFF/, ""));
  const header = table[0]?.map(normalized) ?? [];
  const column = (name: string) => header.findIndex((value) => value === normalized(name));
  const masjidColumn = column("Masjid Berdaya");
  const villageColumn = column("Desa");
  if (masjidColumn < 0 || villageColumn < 0) throw new Error("Kolom Desa atau Masjid Berdaya tidak ditemukan pada sumber Desa Berdaya.");

  const idColumn = Math.max(column("ID_Desa_"), column("ID_Desa"));
  const districtColumn = column("Kecamatan");
  const regencyColumn = column("Kota/Kab");
  const provinceColumn = column("Provinsi");
  const branchColumn = column("Cabang");
  const statusColumn = column("Ket Desber");
  const typeColumn = column("Status Desber");
  const volunteerColumn = column("Nama RI");
  const rows = table.slice(1).filter((row) => row.some(Boolean));
  const valueAt = (row: string[], index: number, fallback = "-") => index >= 0 && row[index]?.trim() ? row[index].trim() : fallback;
  const details = rows
    .filter((row) => normalized(row[masjidColumn] ?? "") === "masjid berdaya")
    .map((row, index): ProgramImpactLocationDetail => ({
      id: valueAt(row, idColumn, `masjid-berdaya-${index + 1}`),
      village: valueAt(row, villageColumn, "Desa belum terisi"),
      district: valueAt(row, districtColumn),
      regency: valueAt(row, regencyColumn),
      province: valueAt(row, provinceColumn),
      branch: valueAt(row, branchColumn),
      status: valueAt(row, statusColumn, "Tidak diketahui"),
      villageType: valueAt(row, typeColumn, "Tidak diketahui"),
      volunteer: valueAt(row, volunteerColumn, "Belum tersedia"),
    }))
    .sort((a, b) => a.province.localeCompare(b.province, "id") || a.regency.localeCompare(b.regency, "id") || a.village.localeCompare(b.village, "id"));

  return {
    total: details.length,
    details,
    rowsRead: rows.length,
    source,
    dataThrough: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date()),
  };
}

export async function getProgramImpactData(forceRefresh = false): Promise<ProgramImpactData> {
  const [vocation, hafidz, masjidBerdaya, ppTerbina] = await Promise.all([
    getServerCachedData("impact-vocation-v1", loadVocationImpact, forceRefresh),
    getServerCachedData("impact-hafidz-v1", loadHafidzImpact, forceRefresh),
    getServerCachedData("impact-masjid-berdaya-v1", loadMasjidBerdayaImpact, forceRefresh),
    queryDetailData({ source: "details", metricId: "pp-terbina" }, forceRefresh),
  ]);
  const ppPeriod = ppTerbina.period ? `${ppTerbina.period.startMonth}–${ppTerbina.period.endMonth}` : "Data terbaru";
  return {
    year: vocation.year,
    indicators: [
      { id: "terserap-kerja", achievement: vocation.employed, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "wirausaha", achievement: vocation.entrepreneurs, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "hafiz", achievement: hafidz.total, sourceLabel: hafidz.source.label, sourceUrl: hafidz.source.sheetUrl, dataThrough: String(vocation.year) },
      { id: "masjid", achievement: masjidBerdaya.total, sourceLabel: masjidBerdaya.source.label, sourceUrl: masjidBerdaya.source.sheetUrl, dataThrough: masjidBerdaya.dataThrough, details: masjidBerdaya.details },
      { id: "pp-terbina", achievement: ppTerbina.total, sourceLabel: ppTerbina.provenance.sourceLabel, sourceUrl: ppTerbina.provenance.sheetUrl, dataThrough: ppPeriod },
    ],
    quality: {
      vocation: { rowsRead: vocation.rowsRead, rowsAccepted: vocation.rowsAccepted, rowsRejected: vocation.rowsRejected },
      hafidz: { rowsRead: hafidz.rowsRead, rowsAccepted: hafidz.rowsAccepted, rowsRejected: hafidz.rowsRejected },
      masjidBerdaya: { rowsRead: masjidBerdaya.rowsRead, rowsMatched: masjidBerdaya.total, isValid: masjidBerdaya.total > 0 },
      ppTerbina: { rowsRead: ppTerbina.quality.rowsRead, rowsAccepted: ppTerbina.quality.rowsAccepted, rowsRejected: ppTerbina.quality.rowsRejected, isValid: ppTerbina.quality.isValid },
    },
    updatedAt: new Date().toISOString(),
  };
}
