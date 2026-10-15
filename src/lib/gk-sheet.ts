import type { MetricDetailDataset } from "@/lib/metric-detail-sheets";

type Division = "Empowerment" | "Distribution" | "Dakwah" | "Project";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;
const DIVISIONS: readonly Division[] = ["Empowerment", "Distribution", "Dakwah", "Project"];
const DETAIL_COLUMNS = ["Bulan", "Divisi", "Cabang", "Nama PP Sesuai KTP", "Nama Desa", "Kecamatan", "Kab/Kota", "Provinsi", "Sebelum", "Standar GK", "After", "Nama Program", "Jenis Usaha", "Produk Usaha"];

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

function findColumn(row: string[], label: string, start: number, end: number) {
  for (let index = start; index < end; index += 1) {
    if ((row[index] ?? "").trim().toLowerCase() === label.toLowerCase()) return index;
  }
  return -1;
}

function monthIndex(value: string) {
  return MONTHS.findIndex((month) => month.toLowerCase() === value.trim().toLowerCase());
}

export function parseGkDivisionSheet(csv: string): { detail: MetricDetailDataset; recap: MetricDetailDataset } {
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  const sectionRow = table[1] ?? [];
  const starts = [
    0,
    findColumn(sectionRow, "GK Profdis Div", 0, sectionRow.length),
    findColumn(sectionRow, "GK Dakwah Div", 0, sectionRow.length),
    findColumn(sectionRow, "GK Project", 0, sectionRow.length),
  ];
  if (starts.slice(1).some((start) => start < 0) || starts.some((start, index) => index > 0 && start <= starts[index - 1])) {
    throw new Error("Empat blok divisi pada sheet PM GK tidak dikenali.");
  }

  const counts = MONTHS.map(() => Object.fromEntries(DIVISIONS.map((division) => [division, 0])) as Record<Division, number>);
  const rows: string[][] = [];
  const fieldNames: Record<Division, Record<string, string>> = {
    Empowerment: { month: "Bulan", branch: "Cabang", name: "Nama PP Sesuai KTP", village: "Nama Desa", district: "Kecamatan", city: "Kab/Kota", province: "Provinsi", before: "Sebelum", standard: "Standar GK", after: "After", program: "Nama Program", business: "Jenis Usaha", product: "Produk Usaha" },
    Distribution: { month: "Bulan", branch: "Cabang", name: "Nama PM", before: "Pendapatan Before Intervensi", standard: "Pendapatan Standar GK", after: "Pendapatan Terakhir Pasca Intervensi", program: "Departement" },
    Dakwah: { month: "Bulan", branch: "Cabang", name: "Nama PP Sesuai KTP", village: "Nama Desa", district: "Kecamatan", city: "Kab/Kota", province: "Provinsi", before: "Sebelum", standard: "Standar GK", after: "After", program: "Nama Program", product: "Produk Usaha" },
    Project: { month: "Bulan", name: "Nama PP Sesuai KTP", village: "Nama Desa", district: "Kecamatan", city: "Kab/Kota", province: "Provinsi", program: "Program Rumah Zakat" },
  };

  DIVISIONS.forEach((division, sectionIndex) => {
    const start = starts[sectionIndex];
    const end = starts[sectionIndex + 1] ?? Math.max(...table.map((row) => row.length));
    const headerRowIndex = division === "Empowerment" ? 1 : 2;
    const header = table[headerRowIndex] ?? [];
    const columns = Object.fromEntries(Object.entries(fieldNames[division]).map(([key, label]) => [key, findColumn(header, label, start, end)])) as Record<string, number>;
    if (columns.month < 0 || columns.name < 0) throw new Error(`Kolom bulan atau peserta divisi ${division} tidak ditemukan pada sheet PM GK.`);
    const value = (source: string[], key: string) => columns[key] >= 0 ? source[columns[key]] ?? "" : "";

    table.slice(headerRowIndex + 1).forEach((source) => {
      const index = monthIndex(value(source, "month"));
      if (index < 0) return;
      const hasDetail = source.slice(start + 1, end).some((cell) => cell.trim() !== "");
      if (!hasDetail) return;
      counts[index][division] += 1;
      rows.push([
        MONTHS[index], division, value(source, "branch"), value(source, "name"), value(source, "village"),
        value(source, "district"), value(source, "city"), value(source, "province"), value(source, "before"),
        value(source, "standard"), value(source, "after"), value(source, "program"), value(source, "business"),
        value(source, "product"),
      ]);
    });
  });

  rows.sort((left, right) => monthIndex(left[0]) - monthIndex(right[0]) || DIVISIONS.indexOf(left[1] as Division) - DIVISIONS.indexOf(right[1] as Division));
  const recapRows = counts.flatMap((byDivision, index) => {
    const values = DIVISIONS.map((division) => byDivision[division]);
    const total = values.reduce((sum, count) => sum + count, 0);
    return total > 0 ? [[MONTHS[index], ...values.map(String), String(total)]] : [];
  });
  return {
    detail: { title: "Data Peserta Keluar Garis Kemiskinan", columns: DETAIL_COLUMNS, rows, totalRows: rows.length },
    recap: { title: "Rekap Capaian Keluar Garis Kemiskinan", columns: ["Bulan", ...DIVISIONS, "Capaian GK 2026"], rows: recapRows, totalRows: recapRows.length },
  };
}
