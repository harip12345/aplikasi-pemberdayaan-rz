import { resolvedDataSource } from "@/lib/data-catalog";
import { fetchGoogleSheetCsv } from "@/lib/google-sheets-fetch";
import { getParticipantSheetData, PARTICIPANT_MONTHS } from "@/lib/participant-sheets";

export type ParticipantAnalysisRow = {
  program: string;
  annualTarget: number;
  annualAchievement: number;
  annualHistory: number;
  annualAchievementRate: number;
  annualGrowthRate: number;
  runningTarget: number;
  runningAchievement: number;
  comparableHistory: number;
  runningAchievementRate: number;
  runningGrowthRate: number;
};

export type ParticipantAnalysisTotals = Omit<ParticipantAnalysisRow, "program">;

export type ParticipantDivisionAnalysisRow = ParticipantAnalysisTotals & { division: string };

export type ParticipantAnalysisData = {
  rows: ParticipantAnalysisRow[];
  divisions: ParticipantDivisionAnalysisRow[];
  totals: ParticipantAnalysisTotals;
  startMonthIndex: number;
  endMonthIndex: number;
  periodMatched: boolean;
  year: number;
  months: readonly string[];
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

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? ((numerator - denominator) / denominator) * 100 : 0;
}

function achievementRate(achievement: number, target: number) {
  return target > 0 ? (achievement / target) * 100 : 0;
}

function totals(rows: ParticipantAnalysisRow[]): ParticipantAnalysisTotals {
  const summed = rows.reduce((result, row) => ({
    annualTarget: result.annualTarget + row.annualTarget,
    annualAchievement: result.annualAchievement + row.annualAchievement,
    annualHistory: result.annualHistory + row.annualHistory,
    runningTarget: result.runningTarget + row.runningTarget,
    runningAchievement: result.runningAchievement + row.runningAchievement,
    comparableHistory: result.comparableHistory + row.comparableHistory,
  }), { annualTarget: 0, annualAchievement: 0, annualHistory: 0, runningTarget: 0, runningAchievement: 0, comparableHistory: 0 });
  return {
    ...summed,
    annualAchievementRate: achievementRate(summed.annualAchievement, summed.annualTarget),
    annualGrowthRate: ratio(summed.annualAchievement, summed.annualHistory),
    runningAchievementRate: achievementRate(summed.runningAchievement, summed.runningTarget),
    runningGrowthRate: ratio(summed.runningAchievement, summed.comparableHistory),
  };
}

export async function getParticipantAnalysisData(): Promise<ParticipantAnalysisData> {
  const { spreadsheetId, gid } = resolvedDataSource("participant-analysis");
  const sourceUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=${gid}#gid=${gid}`;
  const [csv, participants] = await Promise.all([
    fetchGoogleSheetCsv(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`),
    getParticipantSheetData(),
  ]);
  const [, ...rawRows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const rows = rawRows.flatMap((row): ParticipantAnalysisRow[] => {
    const program = (row[0] ?? "").trim();
    if (!program || !row.slice(1, 11).some(Boolean)) return [];
    const annualTarget = numberValue(row[1] ?? "");
    const annualAchievement = numberValue(row[2] ?? "");
    const annualHistory = numberValue(row[4] ?? "");
    const runningTarget = numberValue(row[6] ?? "");
    const runningAchievement = numberValue(row[7] ?? "");
    const comparableHistory = numberValue(row[9] ?? "");
    return [{
      program,
      annualTarget,
      annualAchievement,
      annualHistory,
      annualAchievementRate: achievementRate(annualAchievement, annualTarget),
      annualGrowthRate: ratio(annualAchievement, annualHistory),
      runningTarget,
      runningAchievement,
      comparableHistory,
      runningAchievementRate: achievementRate(runningAchievement, runningTarget),
      runningGrowthRate: ratio(runningAchievement, comparableHistory),
    }];
  });
  if (!rows.length) throw new Error("Struktur sheet Analisa Capaian Peserta Program tidak dikenali.");

  const divisions = rawRows.flatMap((row): ParticipantDivisionAnalysisRow[] => {
    const division = (row[17] ?? "").trim();
    if (!division || !row.slice(18, 28).some(Boolean)) return [];
    const annualTarget = numberValue(row[18] ?? "");
    const annualAchievement = numberValue(row[19] ?? "");
    const annualHistory = numberValue(row[21] ?? "");
    const runningTarget = numberValue(row[23] ?? "");
    const runningAchievement = numberValue(row[24] ?? "");
    const comparableHistory = numberValue(row[26] ?? "");
    return [{
      division,
      annualTarget,
      annualAchievement,
      annualHistory,
      annualAchievementRate: achievementRate(annualAchievement, annualTarget),
      annualGrowthRate: ratio(annualAchievement, annualHistory),
      runningTarget,
      runningAchievement,
      comparableHistory,
      runningAchievementRate: achievementRate(runningAchievement, runningTarget),
      runningGrowthRate: ratio(runningAchievement, comparableHistory),
    }];
  });

  const summary = totals(rows);
  const participantMonthTotals = Array.from({ length: 12 }, (_, endMonthIndex) => participants.rows
    .filter((row) => row.year === participants.year && row.monthIndex <= endMonthIndex)
    .reduce((sum, row) => sum + row.total, 0));
  const exactMonthIndex = participantMonthTotals.findIndex((value) => value === summary.runningAchievement);
  const endMonthIndex = exactMonthIndex >= 0 ? exactMonthIndex : participants.latestMonthIndex;

  return {
    rows,
    divisions,
    totals: summary,
    startMonthIndex: 0,
    endMonthIndex,
    periodMatched: exactMonthIndex >= 0,
    year: participants.year,
    months: PARTICIPANT_MONTHS,
    updatedAt: new Date().toISOString(),
    source: "Google Sheets",
    sourceUrl,
  };
}
