import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";

export type AchievementAnalysis = { target: number; achievement: number; history: number; achievementRate: number; growthRate: number };
export type ParticipantAnalysisRow = { program: string; pp: AchievementAnalysis; plp: AchievementAnalysis };
export type ParticipantDivisionAnalysisRow = { division: string; divisionLabel: string; pp: AchievementAnalysis; plp: AchievementAnalysis };
export type ParticipantMonthlyPoint = {
  year: number;
  monthIndex: number;
  month: string;
  target: number;
  achievement: number;
  history: number;
  achievementRate: number;
  growthRate: number;
  accumulatedTargetRate: number;
  accumulatedGrowthRate: number;
};
export type ParticipantMonthlyGroup = { key: string; label: string; points: ParticipantMonthlyPoint[] };
export type ParticipantAnalysisData = {
  rows: ParticipantAnalysisRow[];
  divisions: ParticipantDivisionAnalysisRow[];
  totals: { pp: AchievementAnalysis; plp: AchievementAnalysis };
  monthlyReference: { pp: Pick<AchievementAnalysis, "achievementRate" | "growthRate"> };
  monthly: {
    programs: ParticipantMonthlyGroup[];
    divisions: ParticipantMonthlyGroup[];
    latestMonthIndex: number;
    programSourceUrl: string;
    divisionSourceUrl: string;
  };
  year: number;
  updatedAt: string;
  source: "Google Sheets";
  sourceUrl: string;
};

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTH_ALIASES: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3,
  mei: 4, jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agustus: 7,
  sep: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10, des: 11, desember: 11,
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

function numberValue(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentageValue(value: string) {
  if (!value || value.startsWith("#")) return 0;
  return numberValue(value.replace("%", ""));
}

function metric(target: string, achievement: string, history: string): AchievementAnalysis {
  const targetValue = numberValue(target);
  const achievementValue = numberValue(achievement);
  const historyValue = numberValue(history);
  return {
    target: targetValue,
    achievement: achievementValue,
    history: historyValue,
    achievementRate: targetValue > 0 ? (achievementValue / targetValue) * 100 : 0,
    growthRate: historyValue > 0 ? ((achievementValue - historyValue) / historyValue) * 100 : 0,
  };
}

function totalMetric(metrics: AchievementAnalysis[]): AchievementAnalysis {
  const target = metrics.reduce((sum, item) => sum + item.target, 0);
  const achievement = metrics.reduce((sum, item) => sum + item.achievement, 0);
  const history = metrics.reduce((sum, item) => sum + item.history, 0);
  return {
    target,
    achievement,
    history,
    achievementRate: target > 0 ? (achievement / target) * 100 : 0,
    growthRate: history > 0 ? ((achievement - history) / history) * 100 : 0,
  };
}

function expandedDivisionLabel(value: string) {
  if (/^dist\s*div$/i.test(value)) return "Distribution Division";
  if (/^empo\s*div$/i.test(value)) return "Empowerment Division";
  if (/^dakwah\s*div$/i.test(value)) return "Dakwah Division";
  if (/^project\s*div$/i.test(value)) return "Project Division";
  if (/^humdiv$/i.test(value)) return "Humanitarian Division";
  return value;
}

function normalizedDivisionLabel(value: string) {
  if (/^distribution$/i.test(value)) return "Distribution Division";
  if (/^empowerment$/i.test(value)) return "Empowerment Division";
  if (/^dakwah$/i.test(value)) return "Dakwah Division";
  if (/^humanitarian$/i.test(value)) return "Humanitarian Division";
  if (/^project$/i.test(value)) return "Project Division";
  return value;
}

function parseMonthlyGroups(csv: string, keyColumn: number, label: (value: string) => string) {
  const [, ...rawRows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const grouped = new Map<string, ParticipantMonthlyPoint[]>();
  rawRows.forEach((row) => {
    const key = (row[keyColumn] ?? "").trim();
    const monthIndex = MONTH_ALIASES[(row[1] ?? "").trim().toLocaleLowerCase("id-ID")];
    if (!key || monthIndex === undefined) return;
    const target = numberValue(row[2] ?? "");
    const achievement = numberValue(row[3] ?? "");
    const history = numberValue(row[5] ?? "");
    const point: ParticipantMonthlyPoint = {
      year: numberValue(row[0] ?? ""),
      monthIndex,
      month: MONTHS[monthIndex],
      target,
      achievement,
      history,
      achievementRate: target > 0 ? (achievement / target) * 100 : 0,
      growthRate: history > 0 ? ((achievement - history) / history) * 100 : 0,
      // Hanya dua kolom akumulasi ini yang digunakan. Nilai diambil sebagai snapshot bulan akhir.
      accumulatedTargetRate: percentageValue(row[10] ?? ""),
      accumulatedGrowthRate: percentageValue(row[11] ?? ""),
    };
    grouped.set(key, [...(grouped.get(key) ?? []), point]);
  });
  return Array.from(grouped, ([key, points]) => ({ key, label: label(key), points: points.sort((a, b) => a.monthIndex - b.monthIndex) }));
}

export async function getParticipantAnalysisData(): Promise<ParticipantAnalysisData> {
  const { spreadsheetId, gid } = resolvedDataSource("participant-analysis");
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${gid}#gid=${gid}`;
  const programMonthlyGid = process.env.GOOGLE_SHEETS_PP_ANALYSIS_PROGRAM_MONTHLY_GID || "431216403";
  const divisionMonthlyGid = process.env.GOOGLE_SHEETS_PP_ANALYSIS_DIVISION_MONTHLY_GID || "550193821";
  const [csv, programMonthlyCsv, divisionMonthlyCsv] = await Promise.all([
    fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`),
    fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${programMonthlyGid}`),
    fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${divisionMonthlyGid}`),
  ]);
  const [header = [], ...rawRows] = parseCsv(csv.replace(/^\uFEFF/, ""));

  // Kolom biru muda (6-10 dan 23-27) sengaja tidak dibaca.
  const grandTotalRow = rawRows.find((row) => /^grand\s*total$/i.test((row[0] ?? "").trim()));
  const rows = rawRows.flatMap((row): ParticipantAnalysisRow[] => {
    const program = (row[0] ?? "").trim();
    if (!program || /^grand\s*total$/i.test(program) || !row.slice(1, 6).some(Boolean)) return [];
    return [{ program, pp: metric(row[1] ?? "", row[2] ?? "", row[4] ?? ""), plp: metric(row[11] ?? "", row[12] ?? "", row[14] ?? "") }];
  });
  const ppMonthlyReference = {
    achievementRate: percentageValue(grandTotalRow?.[8] ?? ""),
    growthRate: percentageValue(grandTotalRow?.[10] ?? ""),
  };
  const divisions = rawRows.flatMap((row): ParticipantDivisionAnalysisRow[] => {
    const division = (row[17] ?? "").trim();
    if (!division || !row.slice(18, 23).some(Boolean)) return [];
    return [{ division, divisionLabel: expandedDivisionLabel(division), pp: metric(row[18] ?? "", row[19] ?? "", row[21] ?? ""), plp: metric(row[28] ?? "", row[29] ?? "", row[31] ?? "") }];
  });
  if (!rows.length || !divisions.length) throw new Error("Struktur sheet Analisa Capaian PP dan PLP tidak dikenali.");
  const year = Number(header.join(" ").match(/\b(20\d{2})\b/)?.[1]) || new Date().getFullYear();
  const monthlyPrograms = parseMonthlyGroups(programMonthlyCsv, 12, (value) => value);
  const monthlyDivisions = parseMonthlyGroups(divisionMonthlyCsv, 12, normalizedDivisionLabel);
  if (!monthlyPrograms.length || !monthlyDivisions.length) throw new Error("Struktur sheet analisa bulanan per Program atau Divisi tidak dikenali.");
  const latestMonthIndex = Math.max(0, ...[...monthlyPrograms, ...monthlyDivisions]
    .flatMap((group) => group.points)
    .filter((point) => point.achievement !== 0)
    .map((point) => point.monthIndex));
  return {
    rows,
    divisions,
    totals: { pp: totalMetric(rows.map((row) => row.pp)), plp: totalMetric(rows.map((row) => row.plp)) },
    monthlyReference: { pp: ppMonthlyReference },
    monthly: {
      programs: monthlyPrograms,
      divisions: monthlyDivisions,
      latestMonthIndex,
      programSourceUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${programMonthlyGid}#gid=${programMonthlyGid}`,
      divisionSourceUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${divisionMonthlyGid}#gid=${divisionMonthlyGid}`,
    },
    year,
    updatedAt: new Date().toISOString(),
    source: "Google Sheets",
    sourceUrl,
  };
}
