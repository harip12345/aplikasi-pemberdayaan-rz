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
  status?: string;
  villageType?: string;
  volunteer?: string;
  program?: string;
};

export type ProgramImpactParticipantDetail = {
  id: string;
  name: string;
  outcome: string;
  year?: string;
  gender?: string;
  age?: number;
  occupation?: string;
  workplace?: string;
  village?: string;
  facilitator?: string;
};

export type ProgramImpactBreakdown = { name: string; value: number };

export type ProgramImpactAnalysis = {
  reportingRows: number;
  byProvince: ProgramImpactBreakdown[];
  byBranch: ProgramImpactBreakdown[];
};

export type ProgramImpactIndicator = {
  id: "vokasi-keahlian" | "terserap-kerja" | "wirausaha" | "hafiz" | "posyandu" | "kader" | "bank-sampah" | "mangrove" | "masjid" | "pp-terbina";
  achievement: number;
  sourceLabel: string;
  sourceUrl: string;
  dataThrough: string;
  details?: ProgramImpactLocationDetail[];
  participantDetails?: ProgramImpactParticipantDetail[];
  analysis?: ProgramImpactAnalysis;
};

export type ProgramImpactData = {
  year: number;
  indicators: ProgramImpactIndicator[];
  quality: {
    vocation: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    hafidz: { rowsRead: number; rowsAccepted: number; rowsRejected: number };
    environment: { rowsRead: number; bankSampahMatched: number; mangroveMatched: number; isValid: boolean };
    health: { rowsRead: number; rowsAccepted: number; invalidCells: number; isValid: boolean };
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
  const genderColumn = header.findIndex((value) => value === "jenis kelamin");
  const ageColumn = header.findIndex((value) => value === "usia");
  const occupationColumn = header.findIndex((value) => value.includes("jenis pekerjaan") && value.includes("jenis usaha"));
  const workplaceColumn = header.findIndex((value) => value.includes("tempat kerja") && value.includes("tempat usaha"));
  const villageColumn = header.findIndex((value) => value === "desa");
  const facilitatorColumn = header.findIndex((value) => value === "ri pic" || value === "relawan inspirasi pic");
  if (nameColumn < 0 || outcomeColumn < 0) throw new Error("Kolom Nama Peserta Program atau Terserap Kerja/Membuka Usaha tidak ditemukan.");
  const rows = table.slice(1).filter((row) => row.some(Boolean));
  const validRows = rows.filter((row) => row[nameColumn]?.trim() && ["terserap kerja", "membuka usaha"].includes(normalized(row[outcomeColumn] ?? "")));
  const years = validRows.map((row) => Number(row[yearColumn] ?? 0)).filter((value) => Number.isInteger(value) && value > 2000);
  const details: ProgramImpactParticipantDetail[] = validRows.map((row, index) => {
    const ageText = ageColumn >= 0 ? row[ageColumn]?.trim() : "";
    const parsedAge = ageText && /^\d{1,3}$/.test(ageText) ? Number(ageText) : null;
    return {
      id: `vokasi-${index + 1}`,
      name: row[nameColumn].trim(),
      outcome: normalized(row[outcomeColumn] ?? "") === "terserap kerja" ? "Terserap kerja" : "Membuka usaha",
      year: yearColumn >= 0 ? row[yearColumn]?.trim() || undefined : undefined,
      gender: genderColumn >= 0 ? row[genderColumn]?.trim() || undefined : undefined,
      age: parsedAge !== null && parsedAge > 0 && parsedAge <= 110 ? parsedAge : undefined,
      occupation: occupationColumn >= 0 ? row[occupationColumn]?.trim() || undefined : undefined,
      workplace: workplaceColumn >= 0 ? row[workplaceColumn]?.trim() || undefined : undefined,
      village: villageColumn >= 0 ? row[villageColumn]?.trim() || undefined : undefined,
      facilitator: facilitatorColumn >= 0 ? row[facilitatorColumn]?.trim() || undefined : undefined,
    };
  });
  return {
    employed: validRows.filter((row) => normalized(row[outcomeColumn] ?? "") === "terserap kerja").length,
    entrepreneurs: validRows.filter((row) => normalized(row[outcomeColumn] ?? "") === "membuka usaha").length,
    year: years.length ? Math.max(...years) : new Date().getFullYear(),
    rowsRead: rows.length, rowsAccepted: validRows.length, rowsRejected: rows.length - validRows.length,
    details,
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
  const details: ProgramImpactParticipantDetail[] = validRows.map((row, index) => ({ id: `hafidz-${index + 1}`, name: row[nameColumn].trim(), outcome: "Hafidz 30 juz" }));
  return { total: validRows.length, details, rowsRead: rows.length, rowsAccepted: validRows.length, rowsRejected: rows.length - validRows.length, source };
}

function parseWholeCount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(trimmed)) return Number(trimmed.replace(/[.,]/g, ""));
  return null;
}

async function loadHealthImpact() {
  const { source, csvUrl } = sourceCsvUrl("health-impact");
  const table = parseCsv((await fetchGoogleSheetCsv(csvUrl, 1)).replace(/^\uFEFF/, ""));
  const posyanduColumn = 22; // W
  const cadreColumn = 23; // X
  const headers = table[1] ?? [];
  if (normalized(headers[posyanduColumn] ?? "") !== "jumlah posyandu yang dibina" || normalized(headers[cadreColumn] ?? "") !== "jumlah kader penggerak utama") {
    throw new Error("Kolom W/X pada Resume dampak kesehatan tidak sesuai dengan format yang diharapkan.");
  }

  // Kolom A bernomor hanya untuk baris desa; baris judul, kontrol, dan total tidak dijumlahkan.
  const rows = table.filter((row) => /^\d+$/.test((row[0] ?? "").trim()));
  let posyandu = 0;
  let kader = 0;
  let invalidCells = 0;
  let rowsAccepted = 0;
  const distributions = {
    posyandu: { reportingRows: 0, province: new Map<string, number>(), branch: new Map<string, number>() },
    kader: { reportingRows: 0, province: new Map<string, number>(), branch: new Map<string, number>() },
  };
  const addToDistribution = (kind: keyof typeof distributions, row: string[], value: number) => {
    if (value <= 0) return;
    const distribution = distributions[kind];
    distribution.reportingRows += 1;
    const province = row[6]?.trim() || "Provinsi belum terisi";
    const branch = row[7]?.trim() || "Cabang belum terisi";
    distribution.province.set(province, (distribution.province.get(province) ?? 0) + value);
    distribution.branch.set(branch, (distribution.branch.get(branch) ?? 0) + value);
  };
  for (const row of rows) {
    const posyanduValue = parseWholeCount(row[posyanduColumn] ?? "");
    const cadreValue = parseWholeCount(row[cadreColumn] ?? "");
    if (posyanduValue === null) invalidCells += 1;
    else { posyandu += posyanduValue; addToDistribution("posyandu", row, posyanduValue); }
    if (cadreValue === null) invalidCells += 1;
    else { kader += cadreValue; addToDistribution("kader", row, cadreValue); }
    if (posyanduValue !== null || cadreValue !== null) rowsAccepted += 1;
  }
  if (rows.length === 0 || rowsAccepted === 0) throw new Error("Tidak ada baris data bernomor yang dapat dibaca pada Resume dampak kesehatan.");
  const toAnalysis = (kind: keyof typeof distributions): ProgramImpactAnalysis => {
    const distribution = distributions[kind];
    const sorted = (values: Map<string, number>) => [...values].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "id"));
    return { reportingRows: distribution.reportingRows, byProvince: sorted(distribution.province), byBranch: sorted(distribution.branch) };
  };
  return { posyandu, kader, posyanduAnalysis: toAnalysis("posyandu"), kaderAnalysis: toAnalysis("kader"), rowsRead: rows.length, rowsAccepted, invalidCells, source };
}

async function loadEnvironmentImpact() {
  const { source, csvUrl } = sourceCsvUrl("environment-impact");
  const table = parseCsv((await fetchGoogleSheetCsv(csvUrl)).replace(/^\uFEFF/, ""));
  const header = table[0] ?? [];
  const programColumn = 20; // U
  const impactColumn = 21; // V
  if (normalized(header[programColumn] ?? "") !== "program lingkungan") {
    throw new Error("Kolom U pada sumber dampak lingkungan tidak sesuai dengan format Program_Lingkungan.");
  }

  const rows = table.slice(1).filter((row) => row.slice(13, 22).some(Boolean));
  const valueAt = (row: string[], index: number, fallback = "-") => row[index]?.trim() || fallback;
  const toDetail = (row: string[], index: number, program: string): ProgramImpactLocationDetail => ({
    id: valueAt(row, 14, `${program.toLocaleLowerCase("id-ID").replace(/\s+/g, "-")}-${index + 1}`),
    village: valueAt(row, 15, valueAt(row, 16, "Lokasi belum terisi")),
    district: valueAt(row, 16),
    regency: valueAt(row, 17),
    province: valueAt(row, 18),
    branch: valueAt(row, 19),
    program,
  });
  const bankSampahRows = rows.filter((row) => normalized(row[programColumn] ?? "") === "bank sampah");
  const mangroveRows = rows.filter((row) => normalized(row[impactColumn] ?? "") === "mangrove");
  const sortDetails = (details: ProgramImpactLocationDetail[]) => details.sort((a, b) => a.province.localeCompare(b.province, "id") || a.regency.localeCompare(b.regency, "id") || a.village.localeCompare(b.village, "id"));

  return {
    bankSampah: sortDetails(bankSampahRows.map((row, index) => toDetail(row, index, "Bank Sampah"))),
    mangrove: sortDetails(mangroveRows.map((row, index) => toDetail(row, index, "Mangrove"))),
    rowsRead: rows.length,
    source,
    dataThrough: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date()),
  };
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
  const [vocation, hafidz, health, environment, masjidBerdaya, ppTerbina] = await Promise.all([
    getServerCachedData("impact-vocation-v3", loadVocationImpact, forceRefresh),
    getServerCachedData("impact-hafidz-v2", loadHafidzImpact, forceRefresh),
    getServerCachedData("impact-health-resume-v1", loadHealthImpact, forceRefresh).catch(() => null),
    getServerCachedData("impact-environment-v1", loadEnvironmentImpact, forceRefresh),
    getServerCachedData("impact-masjid-berdaya-v1", loadMasjidBerdayaImpact, forceRefresh),
    queryDetailData({ source: "details", metricId: "pp-terbina" }, forceRefresh),
  ]);
  const ppPeriod = ppTerbina.period ? `${ppTerbina.period.startMonth}–${ppTerbina.period.endMonth}` : "Data terbaru";
  return {
    year: vocation.year,
    indicators: [
      { id: "vokasi-keahlian", achievement: 434, sourceLabel: "Input manual — sumber rincian belum tersedia", sourceUrl: "", dataThrough: "2026" },
      { id: "terserap-kerja", achievement: vocation.employed, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year), participantDetails: vocation.details.filter((detail) => detail.outcome === "Terserap kerja") },
      { id: "wirausaha", achievement: vocation.entrepreneurs, sourceLabel: vocation.source.label, sourceUrl: vocation.source.sheetUrl, dataThrough: String(vocation.year), participantDetails: vocation.details.filter((detail) => detail.outcome === "Membuka usaha") },
      { id: "hafiz", achievement: hafidz.total, sourceLabel: hafidz.source.label, sourceUrl: hafidz.source.sheetUrl, dataThrough: "", participantDetails: hafidz.details },
      ...(health ? [
        { id: "posyandu" as const, achievement: health.posyandu, sourceLabel: `${health.source.label} · kolom W`, sourceUrl: health.source.sheetUrl, dataThrough: "", analysis: health.posyanduAnalysis },
        { id: "kader" as const, achievement: health.kader, sourceLabel: `${health.source.label} · kolom X`, sourceUrl: health.source.sheetUrl, dataThrough: "", analysis: health.kaderAnalysis },
      ] : []),
      { id: "bank-sampah", achievement: environment.bankSampah.length, sourceLabel: environment.source.label, sourceUrl: environment.source.sheetUrl, dataThrough: environment.dataThrough, details: environment.bankSampah },
      { id: "mangrove", achievement: environment.mangrove.length, sourceLabel: environment.source.label, sourceUrl: environment.source.sheetUrl, dataThrough: environment.dataThrough, details: environment.mangrove },
      { id: "masjid", achievement: masjidBerdaya.total, sourceLabel: masjidBerdaya.source.label, sourceUrl: masjidBerdaya.source.sheetUrl, dataThrough: masjidBerdaya.dataThrough, details: masjidBerdaya.details },
      { id: "pp-terbina", achievement: ppTerbina.total, sourceLabel: ppTerbina.provenance.sourceLabel, sourceUrl: ppTerbina.provenance.sheetUrl, dataThrough: ppPeriod },
    ],
    quality: {
      vocation: { rowsRead: vocation.rowsRead, rowsAccepted: vocation.rowsAccepted, rowsRejected: vocation.rowsRejected },
      hafidz: { rowsRead: hafidz.rowsRead, rowsAccepted: hafidz.rowsAccepted, rowsRejected: hafidz.rowsRejected },
      health: health ? { rowsRead: health.rowsRead, rowsAccepted: health.rowsAccepted, invalidCells: health.invalidCells, isValid: true } : { rowsRead: 0, rowsAccepted: 0, invalidCells: 0, isValid: false },
      environment: { rowsRead: environment.rowsRead, bankSampahMatched: environment.bankSampah.length, mangroveMatched: environment.mangrove.length, isValid: environment.bankSampah.length > 0 || environment.mangrove.length > 0 },
      masjidBerdaya: { rowsRead: masjidBerdaya.rowsRead, rowsMatched: masjidBerdaya.total, isValid: masjidBerdaya.total > 0 },
      ppTerbina: { rowsRead: ppTerbina.quality.rowsRead, rowsAccepted: ppTerbina.quality.rowsAccepted, rowsRejected: ppTerbina.quality.rowsRejected, isValid: ppTerbina.quality.isValid },
    },
    updatedAt: new Date().toISOString(),
  };
}
