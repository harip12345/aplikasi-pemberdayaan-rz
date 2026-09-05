import type { ProvinceDistribution, VillageProfile, VillageStatus, VillageType } from "@/data/distribution";
import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";

const provinceCenters: Record<string, [number, number]> = {
  Aceh: [4.6951, 96.7494],
  "Sumatera Utara": [2.1154, 99.5451],
  "Sumatera Barat": [-0.7399, 100.8],
  Riau: [0.2933, 101.7068],
  "Kepulauan Riau": [3.9457, 108.1429],
  Jambi: [-1.4852, 102.4381],
  "Sumatera Selatan": [-3.3194, 103.9144],
  "Kepulauan Bangka Belitung": [-2.7411, 106.4406],
  Bengkulu: [-3.5778, 102.3464],
  Lampung: [-4.5586, 105.4068],
  Banten: [-6.4058, 106.064],
  "DKI Jakarta": [-6.2088, 106.8456],
  "Jawa Barat": [-6.9175, 107.6191],
  "Jawa Tengah": [-7.151, 110.1403],
  "Daerah Istimewa Yogyakarta": [-7.7956, 110.3695],
  "DI Yogyakarta": [-7.7956, 110.3695],
  "Jawa Timur": [-7.5361, 112.2384],
  Bali: [-8.4095, 115.1889],
  "Nusa Tenggara Barat": [-8.6529, 117.3616],
  "Nusa Tenggara Timur": [-8.6574, 121.0794],
  "Kalimantan Barat": [-0.2788, 111.4753],
  "Kalimantan Tengah": [-1.6815, 113.3824],
  "Kalimantan Selatan": [-3.0926, 115.2838],
  "Kalimantan Timur": [0.5387, 116.4194],
  "Kalimantan Utara": [3.0731, 116.0414],
  "Sulawesi Utara": [0.6247, 123.975],
  Gorontalo: [0.6999, 122.4467],
  "Sulawesi Tengah": [-1.43, 121.4456],
  "Sulawesi Barat": [-2.8441, 119.2321],
  "Sulawesi Selatan": [-3.6688, 119.9741],
  "Sulawesi Tenggara": [-4.1449, 122.1746],
  Maluku: [-3.2385, 130.1453],
  "Maluku Utara": [1.5709, 127.8088],
  "Papua Barat Daya": [-1.3361, 131.2546],
  "Papua Barat": [-1.3361, 133.1747],
  "Papua Tengah": [-3.65, 136.45],
  "Papua Pegunungan": [-4.0836, 138.943],
  "Papua Selatan": [-7.423, 139.681],
  Papua: [-4.2699, 138.0804],
};

type CsvRecord = Record<string, string>;

export type DistributionSheetData = {
  provinces: ProvinceDistribution[];
  totalVillages: number;
  activeVillages: number;
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
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function recordsFromCsv(csv: string): CsvRecord[] {
  const [rawHeaders = [], ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const headers = rawHeaders.map((header) => header.trim());

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? "").trim()])),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusFromRow(row: CsvRecord): VillageStatus {
  const status = row["Ket Desber"]?.toLowerCase();
  if (status === "aktif") return "Aktif";
  if (status === "hibernasi") return "Hibernasi";
  if (status === "graduasi") return "Graduasi";
  return "Tidak diketahui";
}

function villageTypeFromRow(row: CsvRecord): VillageType {
  const type = row["Status Desber"]?.toLowerCase();
  if (type === "desber") return "Desber";
  if (type === "desbin") return "Desbin";
  if (type === "sister village") return "Sister Village";
  if (type === "desa kolaborasi") return "Desa Kolaborasi";
  return "Tidak diketahui";
}

function programsFromRow(row: CsvRecord) {
  const indicatorColumns = [
    "Capacity Building",
    "Bummas",
    "Kebun Gizi",
    "Desa Ramah Lansia",
    "Desa Bebas Stunting",
    "Rumah Literasi",
    "Rumah Vokasi",
    "Rumah Qur'an",
    "Bank Sampah",
    "Desa Lestari",
    "Destana",
    "Masjid Berdaya",
  ];
  const aliases: Record<string, string> = { CB: "Capacity Building", BUMMas: "Bummas", "2 BUMMas": "Bummas", "Ramah Lansia": "Desa Ramah Lansia", "Bebas Stunting": "Desa Bebas Stunting" };
  const listedPrograms = (row.Program ?? "")
    .split(",")
    .map((program) => aliases[program.trim()] ?? program.trim())
    .filter(Boolean);
  const indicatedPrograms = indicatorColumns.filter((column) => Boolean(row[column]));

  return [...new Set([...listedPrograms, ...indicatedPrograms])];
}

function stableOffset(seed: string, scale: number) {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return ((hash % 2001) / 1000 - 1) * scale;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
}

function toVillage(row: CsvRecord, index: number, center: [number, number]): VillageProfile {
  const province = row.Provinsi || "Provinsi tidak diketahui";
  const villageName = row.Desa || `Desa tanpa nama ${index + 1}`;
  const sourceId = row.ID_Desa_ || row.ID_Desa || String(index + 1);

  return {
    id: `${slugify(province)}-${sourceId}`,
    name: villageName,
    provinceId: slugify(province),
    regency: row["Kota/Kab"] || "-",
    district: row.Kecamatan || "-",
    address: [villageName, row.Kecamatan, row["Kota/Kab"], province].filter(Boolean).join(", "),
    branch: row.Cabang || "-",
    volunteer: {
      name: row["Nama RI"] || "Belum tersedia",
      role: "Relawan Inspirasi",
      phone: row["No Kontak"] || "Belum tersedia",
      since: 0,
    },
    programs: programsFromRow(row),
    participants: 0,
    status: statusFromRow(row),
    villageType: villageTypeFromRow(row),
    coordinates: [
      Number((center[0] + stableOffset(`${sourceId}-lat`, 0.35)).toFixed(5)),
      Number((center[1] + stableOffset(`${sourceId}-lng`, 0.45)).toFixed(5)),
    ],
    documentation: [],
    news: [],
  };
}

function aggregateByProvince(records: CsvRecord[]): ProvinceDistribution[] {
  const grouped = new Map<string, CsvRecord[]>();

  records.forEach((record) => {
    const province = record.Provinsi || "Provinsi tidak diketahui";
    grouped.set(province, [...(grouped.get(province) ?? []), record]);
  });

  return [...grouped.entries()]
    .map(([name, rows]) => {
      const center = provinceCenters[name] ?? [-2.5, 118];
      const villages = rows.map((row, index) => toVillage(row, index, center));

      return {
        id: slugify(name),
        name,
        center,
        count: villages.length,
        activeCount: villages.filter((village) => village.status === "Aktif").length,
        branch: mostCommon(rows.map((row) => row.Cabang)),
        villages,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export async function getDistributionFromGoogleSheets(): Promise<DistributionSheetData> {
  const { spreadsheetId, gid } = resolvedDataSource("distribution");
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const csv = await fetchGoogleSheetCsv(url);
  if (!csv.includes("ID_Desa_") || !csv.includes("Provinsi")) {
    throw new Error("Struktur kolom Google Sheets tidak sesuai dengan format data Desa Berdaya.");
  }

  const records = recordsFromCsv(csv).filter((record) => record.Desa || record.Provinsi);
  const provinces = aggregateByProvince(records);

  return {
    provinces,
    totalVillages: records.length,
    activeVillages: records.filter((record) => statusFromRow(record) === "Aktif").length,
    updatedAt: new Date().toISOString(),
    source: "Google Sheets",
  };
}
