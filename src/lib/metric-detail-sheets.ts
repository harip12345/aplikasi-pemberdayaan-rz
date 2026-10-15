import { resolvedDataSource, type AiDataSourceId } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";
import { parseGkDivisionSheet } from "@/lib/gk-sheet";

const DETAIL_SOURCES = {
  muzzaki: [{
    sourceId: "muzzaki",
    title: "Data Detail Muzaki",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "181388063",
    columns: ["Bulan", "Cabang", "Nama PP Sesuai KTP", "Nama Desa", "Kecamatan", "Kab/Kota", "Provinsi", "Sebelum", "Standar Muzakki", "After", "Peningkatan", "Nama Program", "Jenis Usaha", "Produk Usaha", "Sumber"],
  }],
  mualaf: [{
    sourceId: "mualaf",
    title: "Data Detail Mualaf",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "527605744",
    columns: ["Bulan Informasi", "Nama PM", "Kab/Kota", "Provinsi", "Jenis Kelamin", "Asnaf", "Cabang", "Base Program", "Tanggal Pengislaman", "Islamisasi", "Nama RI / Mitra", "Mitra / RI"],
  }],
  "pp-terbina": [{
    sourceId: "pp-terbina",
    title: "Data Detail Peserta Program Terbina",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "1244942460",
    columns: ["Nama PP", "Nama Desa", "Kecamatan", "Kab/Kota", "Provinsi", "Cabang", "Base Program", "Bulan Awal Program"],
  }],
  bummas: [{
    sourceId: "bummas",
    title: "Data Detail BUMMas",
    spreadsheetId: "16D9SXhKszL-32AGafenp2VNfkMiex830QNGeL00Bpjs",
    gid: "1421837017",
    columns: ["Nama BUMMas/Unit Bisnis", "Nama Desa", "Kecamatan", "Kota/Kab", "Propinsi", "Cabang", "Bidang Usaha/Program", "Rincian Jenis Usaha", "Jumlah Anggota", "BUMMas", "Status BUMMas"],
  }],
} as const;

export type MetricDetailDataset = { title: string; columns: string[]; rows: string[][]; totalRows: number };
export type MetricDetailData = { metricId: string; datasets: MetricDetailDataset[]; updatedAt: string; source: "Google Sheets" };

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function parseCsv(csv: string): string[][] {
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

type DetailSource = (typeof DETAIL_SOURCES)[keyof typeof DETAIL_SOURCES][number] & { sourceId?: AiDataSourceId };

async function readSource(source: DetailSource): Promise<MetricDetailDataset> {
  const resolved = source.sourceId ? resolvedDataSource(source.sourceId) : source;
  const url = `https://docs.google.com/spreadsheets/d/${resolved.spreadsheetId}/export?format=csv&gid=${resolved.gid}`;
  const csv = await fetchGoogleSheetCsv(url);
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  const header = table[0]?.map((cell) => cell.trim()) ?? [];
  const selected = source.columns.flatMap((column) => {
    const index = header.findIndex((candidate) => candidate.toLowerCase() === column.toLowerCase());
    return index >= 0 ? [{ column, index }] : [];
  });
  if (selected.length === 0) throw new Error(`Kolom detail untuk ${source.title} tidak dikenali.`);
  const rows = table.slice(1).filter((row) => row.some(Boolean)).map((row) => selected.map(({ index }) => row[index] ?? ""));
  return { title: source.title, columns: selected.map(({ column }) => column), rows, totalRows: rows.length };
}

function normalizeMonth(value: string) {
  const normalized = value.trim().toLowerCase();
  const monthByName = MONTHS.findIndex((month) => month.toLowerCase() === normalized);
  if (monthByName >= 0) return monthByName;
  const monthNumber = Number(normalized);
  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) return monthNumber - 1;
  const dateParts = normalized.split(/[/-]/).map(Number);
  if (dateParts.length >= 2) {
    const candidate = dateParts.length === 3 && dateParts[0] > 12 ? dateParts[1] : dateParts[0];
    if (candidate >= 1 && candidate <= 12) return candidate - 1;
  }
  return -1;
}

function headerColumn(header: string[], name: string, start: number, end: number, useLast = false) {
  const matches = header.flatMap((cell, index) => index >= start && index <= end && cell.trim().toLowerCase() === name.toLowerCase() ? [index] : []);
  return useLast ? matches.at(-1) ?? -1 : matches[0] ?? -1;
}

async function getMunfikDetailData(): Promise<MetricDetailData> {
  const { spreadsheetId, gid } = resolvedDataSource("munfik");
  const csv = await fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  const greenHeader = table[0] ?? [];
  const sideHeader = table[1] ?? [];

  const green = {
    start: 0, end: 30, dataStart: 1, source: "Empowerment",
    month: headerColumn(greenHeader, "Bulan", 0, 30),
    name: headerColumn(greenHeader, "Nama PP Sesuai KTP", 0, 30),
    office: headerColumn(greenHeader, "Cabang", 0, 30),
    city: headerColumn(greenHeader, "Kab/Kota", 0, 30),
    province: headerColumn(greenHeader, "Provinsi", 0, 30),
    program: headerColumn(greenHeader, "Program Rumah Zakat", 0, 30),
    nominal: headerColumn(greenHeader, "Total", 0, 30),
  };
  const progdis = {
    start: 32, end: 49, dataStart: 2, source: "Progdis",
    month: headerColumn(sideHeader, "Bulan", 32, 49, true),
    name: headerColumn(sideHeader, "Nama Donatur", 32, 49),
    office: headerColumn(sideHeader, "Kantor Transaksi", 32, 49),
    city: -1,
    province: -1,
    program: headerColumn(sideHeader, "Program", 32, 49),
    nominal: headerColumn(sideHeader, "Nominal", 32, 49),
  };
  const dakwahEnd = Math.max(...table.map((row) => row.length - 1));
  const dakwah = {
    start: 51, end: dakwahEnd, dataStart: 2, source: "Dakwah",
    month: headerColumn(sideHeader, "Bulan", 51, dakwahEnd, true),
    name: headerColumn(sideHeader, "Nama PP Sesuai KTP", 51, dakwahEnd),
    office: headerColumn(sideHeader, "Nama RI", 51, dakwahEnd),
    city: headerColumn(sideHeader, "Kab/Kota", 51, dakwahEnd),
    province: headerColumn(sideHeader, "Provinsi", 51, dakwahEnd),
    program: headerColumn(sideHeader, "Program Rumah Zakat", 51, dakwahEnd),
    nominal: -1,
  };
  const blocks = [green, progdis, dakwah];
  if (blocks.some((block) => block.month < 0)) throw new Error("Kolom bulan pada salah satu format Munfik tidak ditemukan.");

  const normalized: Array<{ monthIndex: number; values: string[] }> = [];
  const counts = MONTHS.map(() => ({ Empowerment: 0, Progdis: 0, Dakwah: 0 }));
  blocks.forEach((block) => {
    table.slice(block.dataStart).forEach((row, rowIndex) => {
      const monthIndex = normalizeMonth(row[block.month] ?? "");
      if (monthIndex < 0) return;
      const name = block.name >= 0 ? row[block.name] ?? "" : "";
      const program = block.program >= 0 ? row[block.program] ?? "" : "";
      if (!name && !program) return;
      counts[monthIndex][block.source as keyof typeof counts[number]] += 1;
      normalized.push({ monthIndex, values: [String(block.dataStart + rowIndex + 1), MONTHS[monthIndex], block.source, name, block.office >= 0 ? row[block.office] ?? "" : "", block.city >= 0 ? row[block.city] ?? "" : "", block.province >= 0 ? row[block.province] ?? "" : "", program, block.nominal >= 0 ? row[block.nominal] ?? "" : ""] });
    });
  });
  normalized.sort((a, b) => a.monthIndex - b.monthIndex || a.values[1].localeCompare(b.values[1], "id") || a.values[2].localeCompare(b.values[2], "id"));

  const summaryRows = counts.map((count, index) => [MONTHS[index], String(count.Empowerment), String(count.Progdis), String(count.Dakwah), String(count.Empowerment + count.Progdis + count.Dakwah)]);
  const total = counts.reduce((sum, count) => sum + count.Empowerment + count.Progdis + count.Dakwah, 0);
  summaryRows.push(["Grand Total", String(counts.reduce((sum, item) => sum + item.Empowerment, 0)), String(counts.reduce((sum, item) => sum + item.Progdis, 0)), String(counts.reduce((sum, item) => sum + item.Dakwah, 0)), String(total)]);

  return {
    metricId: "munfik",
    datasets: [
      { title: "Rekap Munfik per Bulan dan Sumber", columns: ["Bulan", "Empowerment", "Progdis", "Dakwah", "Total"], rows: summaryRows, totalRows: summaryRows.length },
      { title: "Data Munfik Ternormalisasi", columns: ["Baris Sumber", "Bulan", "Sumber", "Nama", "Cabang/Kantor", "Kab/Kota", "Provinsi", "Program", "Nominal"], rows: normalized.map((item) => item.values), totalRows: normalized.length },
    ],
    updatedAt: new Date().toISOString(), source: "Google Sheets",
  };
}

export async function getMetricDetailData(metricId: string): Promise<MetricDetailData> {
  if (metricId === "munfik") return getMunfikDetailData();
  if (metricId === "garis-kemiskinan") {
    const { spreadsheetId, gid } = resolvedDataSource("garis-kemiskinan");
    const csv = await fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
    const { detail, recap } = parseGkDivisionSheet(csv);
    return { metricId, datasets: [detail, recap], updatedAt: new Date().toISOString(), source: "Google Sheets" };
  }
  const sources = DETAIL_SOURCES[metricId as keyof typeof DETAIL_SOURCES];
  if (!sources) throw new Error("Sumber detail untuk indikator ini belum dikonfigurasi.");
  return { metricId, datasets: await Promise.all(sources.map((source) => readSource(source))), updatedAt: new Date().toISOString(), source: "Google Sheets" };
}
