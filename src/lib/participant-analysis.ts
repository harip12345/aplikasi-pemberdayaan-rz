import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";

export type AchievementAnalysis = { target: number; achievement: number; history: number; achievementRate: number; growthRate: number };
export type ParticipantAnalysisRow = { program: string; pp: AchievementAnalysis; plp: AchievementAnalysis };
export type ParticipantDivisionAnalysisRow = { division: string; divisionLabel: string; pp: AchievementAnalysis; plp: AchievementAnalysis };
export type ParticipantAnalysisData = {
  rows: ParticipantAnalysisRow[];
  divisions: ParticipantDivisionAnalysisRow[];
  totals: { pp: AchievementAnalysis; plp: AchievementAnalysis };
  year: number;
  updatedAt: string;
  source: "Google Sheets";
  sourceUrl: string;
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

export async function getParticipantAnalysisData(): Promise<ParticipantAnalysisData> {
  const { spreadsheetId, gid } = resolvedDataSource("participant-analysis");
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${gid}#gid=${gid}`;
  const csv = await fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
  const [header = [], ...rawRows] = parseCsv(csv.replace(/^\uFEFF/, ""));

  // Kolom biru muda (6-10 dan 23-27) sengaja tidak dibaca.
  const rows = rawRows.flatMap((row): ParticipantAnalysisRow[] => {
    const program = (row[0] ?? "").trim();
    if (!program || !row.slice(1, 6).some(Boolean)) return [];
    return [{ program, pp: metric(row[1] ?? "", row[2] ?? "", row[4] ?? ""), plp: metric(row[11] ?? "", row[12] ?? "", row[14] ?? "") }];
  });
  const divisions = rawRows.flatMap((row): ParticipantDivisionAnalysisRow[] => {
    const division = (row[17] ?? "").trim();
    if (!division || !row.slice(18, 23).some(Boolean)) return [];
    return [{ division, divisionLabel: expandedDivisionLabel(division), pp: metric(row[18] ?? "", row[19] ?? "", row[21] ?? ""), plp: metric(row[28] ?? "", row[29] ?? "", row[31] ?? "") }];
  });
  if (!rows.length || !divisions.length) throw new Error("Struktur sheet Analisa Capaian PP dan PLP tidak dikenali.");
  const year = Number(header.join(" ").match(/\b(20\d{2})\b/)?.[1]) || new Date().getFullYear();
  return {
    rows,
    divisions,
    totals: { pp: totalMetric(rows.map((row) => row.pp)), plp: totalMetric(rows.map((row) => row.plp)) },
    year,
    updatedAt: new Date().toISOString(),
    source: "Google Sheets",
    sourceUrl,
  };
}
