import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";

export const PARTICIPANT_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;

export const ASNAF_FIELDS = [
  ["fakir", "Fakir"],
  ["miskin", "Miskin"],
  ["amil", "Amil"],
  ["ibnuSabil", "Ibnu Sabil"],
  ["fiiSabilillah", "Fii Sabilillah"],
  ["gharimin", "Gharimin"],
  ["muallaf", "Muallaf"],
  ["hambaSahaya", "Hamba Sahaya"],
  ["nonAsnaf", "Non Asnaf"],
] as const;

export type AsnafField = typeof ASNAF_FIELDS[number][0];

export type ParticipantRow = Record<AsnafField, number> & {
  sourceRow: number;
  monthIndex: number;
  year: number;
  province: string;
  secondaryProvince: string;
  city: string;
  branch: string;
  program: string;
  subProgram: string;
  total: number;
};

export type ParticipantSheetData = {
  rows: ParticipantRow[];
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

function numberValue(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthParts(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  return { monthIndex: month - 1, year };
}

export async function getParticipantSheetData(): Promise<ParticipantSheetData> {
  const { spreadsheetId, gid } = resolvedDataSource("participants");
  const csv = await fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
  const [, ...rawRows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const rows = rawRows.flatMap((row, index): ParticipantRow[] => {
    const period = monthParts(row[0] ?? "");
    const program = (row[6] ?? "").trim();
    if (!period || !program) return [];

    return [{
      sourceRow: index + 2,
      ...period,
      province: row[1] ?? "",
      secondaryProvince: row[2] ?? "",
      city: row[3] ?? "",
      branch: row[4] ?? "",
      program,
      subProgram: row[7] ?? "",
      fakir: numberValue(row[8] ?? ""),
      miskin: numberValue(row[9] ?? ""),
      amil: numberValue(row[10] ?? ""),
      ibnuSabil: numberValue(row[11] ?? ""),
      fiiSabilillah: numberValue(row[12] ?? ""),
      gharimin: numberValue(row[13] ?? ""),
      muallaf: numberValue(row[14] ?? ""),
      hambaSahaya: numberValue(row[15] ?? ""),
      nonAsnaf: numberValue(row[16] ?? ""),
      total: numberValue(row[17] ?? ""),
    }];
  });

  if (rows.length === 0) throw new Error("Struktur sheet Peserta Program tidak dikenali.");
  const latestMonthIndex = Math.max(...rows.map((row) => row.monthIndex));
  const year = Math.max(...rows.map((row) => row.year));

  return { rows, months: PARTICIPANT_MONTHS, latestMonthIndex, year, updatedAt: new Date().toISOString(), source: "Google Sheets" };
}
