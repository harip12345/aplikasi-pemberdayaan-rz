import { getParticipantAnalysisData, type AchievementAnalysis, type ParticipantMonthlyGroup } from "@/lib/participant-analysis";
import { getProgramImpactData, type ProgramImpactIndicator, type ProgramImpactLocationDetail } from "@/lib/program-impact-sheets";
import { DASHBOARD_MONTHS } from "@/lib/dashboard-sheets";
import { matchesDataTerm, normalizeDataTerm } from "@/lib/metric-dictionary";
import { getServerCachedData } from "@/lib/server-data-cache";

type ParticipantPerformanceQuery = {
  scope?: "program" | "division";
  participantType?: "PP" | "PLP";
  entity?: string;
  startMonthIndex?: number;
  endMonthIndex?: number;
  orderBy?: "achievement" | "targetRate" | "growthRate" | "periodTargetRate" | "periodGrowthRate";
  direction?: "asc" | "desc";
  includeMonthly?: boolean;
  limit?: number;
};

type ProgramImpactQuery = {
  indicator?: ProgramImpactIndicator["id"];
  province?: string;
  city?: string;
  branch?: string;
  groupBy?: "province" | "city" | "branch" | "program";
  includeDetails?: boolean;
  limit?: number;
};

function sumMetric(points: ParticipantMonthlyGroup["points"], startMonthIndex: number, endMonthIndex: number): AchievementAnalysis {
  const selected = points.filter((point) => point.monthIndex >= startMonthIndex && point.monthIndex <= endMonthIndex);
  const target = selected.reduce((sum, point) => sum + point.target, 0);
  const achievement = selected.reduce((sum, point) => sum + point.achievement, 0);
  const history = selected.reduce((sum, point) => sum + point.history, 0);
  return {
    target,
    achievement,
    history,
    achievementRate: target > 0 ? achievement / target * 100 : 0,
    growthRate: history > 0 ? (achievement - history) / history * 100 : 0,
  };
}

function compactMetric(metric: AchievementAnalysis) {
  return {
    target: metric.target,
    achievement: metric.achievement,
    history: metric.history,
    targetRate: metric.achievementRate,
    growthRate: metric.growthRate,
  };
}

export async function queryParticipantPerformance(input: ParticipantPerformanceQuery, forceRefresh = false) {
  const data = await getServerCachedData("ai-participant-performance-v1", getParticipantAnalysisData, forceRefresh);
  const scope = input.scope ?? "program";
  const participantType = input.participantType ?? "PP";
  const startMonthIndex = Math.max(0, Math.min(data.monthly.latestMonthIndex, input.startMonthIndex ?? 0));
  const endMonthIndex = Math.max(startMonthIndex, Math.min(data.monthly.latestMonthIndex, input.endMonthIndex ?? data.monthly.latestMonthIndex));
  const summaries = scope === "program"
    ? data.rows.map((row) => ({ key: row.program, label: row.program, metric: participantType === "PP" ? row.pp : row.plp }))
    : data.divisions.map((row) => ({ key: row.division, label: row.divisionLabel, metric: participantType === "PP" ? row.pp : row.plp }));
  const monthlyGroups = scope === "program" ? data.monthly.programs : data.monthly.divisions;
  const rows = summaries
    .filter((row) => !input.entity || matchesDataTerm(row.label, input.entity) || matchesDataTerm(row.key, input.entity))
    .map((row) => {
      const monthlyGroup = monthlyGroups.find((group) => group.label === row.label);
      const periodMetric = participantType === "PP" && monthlyGroup ? sumMetric(monthlyGroup.points, startMonthIndex, endMonthIndex) : null;
      const snapshot = monthlyGroup?.points.find((point) => point.monthIndex === endMonthIndex)
        ?? monthlyGroup?.points.filter((point) => point.monthIndex <= endMonthIndex).at(-1);
      return {
        key: row.key,
        name: row.label,
        annual: compactMetric(row.metric),
        contributionRate: (participantType === "PP" ? data.totals.pp.achievement : data.totals.plp.achievement) > 0
          ? row.metric.achievement / (participantType === "PP" ? data.totals.pp.achievement : data.totals.plp.achievement) * 100 : 0,
        period: periodMetric ? compactMetric(periodMetric) : null,
        snapshot: participantType === "PP" && snapshot ? {
          month: snapshot.month,
          accumulatedTargetRate: snapshot.accumulatedTargetRate,
          accumulatedGrowthRate: snapshot.accumulatedGrowthRate,
          yearlyTargetRate: snapshot.yearlyTargetRate,
          yearlyGrowthRate: snapshot.yearlyGrowthRate,
        } : null,
        monthly: input.includeMonthly && participantType === "PP" && monthlyGroup
          ? monthlyGroup.points.filter((point) => point.monthIndex >= startMonthIndex && point.monthIndex <= endMonthIndex)
            .map((point) => ({ month: point.month, target: point.target, achievement: point.achievement, history: point.history, targetRate: point.achievementRate, growthRate: point.growthRate }))
          : undefined,
      };
    });
  const orderBy = input.orderBy ?? "achievement";
  const direction = input.direction ?? "desc";
  const value = (row: typeof rows[number]) => orderBy === "targetRate" ? row.annual.targetRate
    : orderBy === "growthRate" ? row.annual.growthRate
      : orderBy === "periodTargetRate" ? row.period?.targetRate ?? Number.NEGATIVE_INFINITY
        : orderBy === "periodGrowthRate" ? row.period?.growthRate ?? Number.NEGATIVE_INFINITY
          : row.annual.achievement;
  rows.sort((a, b) => (value(a) - value(b)) * (direction === "asc" ? 1 : -1));
  const limit = Math.max(1, Math.min(100, input.limit ?? rows.length));
  return {
    source: "participant-performance" as const,
    scope,
    participantType,
    period: participantType === "PP" ? { startMonthIndex, endMonthIndex, startMonth: DASHBOARD_MONTHS[startMonthIndex], endMonth: DASHBOARD_MONTHS[endMonthIndex], year: data.year } : null,
    overall: compactMetric(participantType === "PP" ? data.totals.pp : data.totals.plp),
    rows: rows.slice(0, limit),
    calculation: participantType === "PP"
      ? "Nilai periode dijumlahkan dari target, capaian, dan history setiap bulan; kolom akumulasi tidak dijumlahkan. Persentase tahunan dan akumulasi memakai snapshot bulan akhir."
      : "Kinerja PLP menggunakan target, capaian, dan history keseluruhan pada sheet ringkasan karena sumber bulanan PLP belum tersedia.",
    quality: { isValid: rows.length > 0, rowsRead: summaries.length, rowsAccepted: rows.length, rowsRejected: summaries.length - rows.length, checkedAt: data.updatedAt, issues: rows.length ? [] : ["Entitas yang diminta tidak ditemukan."] },
    provenance: {
      summary: { sourceLabel: "Analisa Capaian Peserta Program", sheetUrl: data.sourceUrl, updatedAt: data.updatedAt },
      ...(participantType === "PP" ? { monthly: { sourceLabel: scope === "program" ? "Analisa Bulanan PP per Program" : "Analisa Bulanan PP per Divisi", sheetUrl: scope === "program" ? data.monthly.programSourceUrl : data.monthly.divisionSourceUrl, updatedAt: data.updatedAt } } : {}),
    },
  };
}

function detailMatches(detail: ProgramImpactLocationDetail, input: ProgramImpactQuery) {
  return (!input.province || matchesDataTerm(detail.province, input.province))
    && (!input.city || matchesDataTerm(detail.regency, input.city))
    && (!input.branch || matchesDataTerm(detail.branch, input.branch));
}

export async function queryProgramImpacts(input: ProgramImpactQuery, forceRefresh = false) {
  const data = await getServerCachedData("ai-program-impact-v1", () => getProgramImpactData(forceRefresh), forceRefresh);
  const selected = data.indicators.filter((indicator) => !input.indicator || indicator.id === input.indicator);
  const filtersActive = Boolean(input.province || input.city || input.branch);
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const indicators = selected.map((indicator) => {
    const filteredDetails = indicator.details?.filter((detail) => detailMatches(detail, input));
    const filterAvailable = !filtersActive || Boolean(indicator.details);
    const achievement = filtersActive ? filteredDetails?.length ?? null : indicator.achievement;
    const groups = new Map<string, number>();
    if (input.groupBy && filteredDetails) filteredDetails.forEach((detail) => {
      const key = input.groupBy === "province" ? detail.province
        : input.groupBy === "city" ? detail.regency
          : input.groupBy === "branch" ? detail.branch : detail.program ?? indicator.id;
      const normalized = normalizeDataTerm(key) || "Tidak terisi";
      groups.set(normalized, (groups.get(normalized) ?? 0) + 1);
    });
    return {
      id: indicator.id,
      achievement,
      dataThrough: indicator.dataThrough,
      filterAvailable,
      groups: [...groups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit),
      details: input.includeDetails && filteredDetails ? filteredDetails.slice(0, limit) : undefined,
      detailsTruncated: Boolean(input.includeDetails && filteredDetails && filteredDetails.length > limit),
      sourceLabel: indicator.sourceLabel,
      sourceUrl: indicator.sourceUrl,
    };
  });
  return {
    source: "program-impacts" as const,
    year: data.year,
    filters: { indicator: input.indicator, province: input.province, city: input.city, branch: input.branch },
    indicators,
    calculation: "Terserap kerja dan berwirausaha dihitung dari status hasil peserta vokasi; Hafidz dihitung dari peserta dengan capaian 30 juz; Bank Sampah, Mangrove, Masjid Berdaya, dan PP Terbina dihitung dari baris detail valid pada sumber masing-masing.",
    quality: { isValid: selected.length > 0 && indicators.every((indicator) => indicator.filterAvailable), rowsRead: data.quality.vocation.rowsRead + data.quality.hafidz.rowsRead + data.quality.environment.rowsRead + data.quality.masjidBerdaya.rowsRead + data.quality.ppTerbina.rowsRead, rowsAccepted: indicators.reduce((sum, indicator) => sum + (indicator.achievement ?? 0), 0), rowsRejected: 0, checkedAt: data.updatedAt, issues: indicators.filter((indicator) => !indicator.filterAvailable).map((indicator) => `Filter wilayah belum tersedia untuk ${indicator.id}.`) },
    provenance: Object.fromEntries(indicators.map((indicator) => [indicator.id, { sourceLabel: indicator.sourceLabel, sheetUrl: indicator.sourceUrl, updatedAt: data.updatedAt }])),
  };
}
