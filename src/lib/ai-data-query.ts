import { getDashboardSheetData, DASHBOARD_MONTHS } from "@/lib/dashboard-sheets";
import { getParticipantSheetData, ASNAF_FIELDS } from "@/lib/participant-sheets";
import { getMetricDetailData } from "@/lib/metric-detail-sheets";
import { getDistributionFromGoogleSheets } from "@/lib/google-sheets";
import { getServerCachedData } from "@/lib/server-data-cache";
import { normalizeDashboardData, normalizeMetricDetailData, normalizeMunfikData, normalizeParticipantData, type DetailMetricId } from "@/lib/ai-data-normalizers";
import { dataSearchTokens, findMetricDefinition, matchesDataTerm, normalizeDataTerm, normalizeSearchText } from "@/lib/metric-dictionary";
import { resolvedDataSource } from "@/lib/data-catalog";

type CommonPeriod = { startMonthIndex?: number; endMonthIndex?: number };
export type DashboardDataQuery = CommonPeriod & { source: "dashboard"; metricId?: string };
export type ParticipantGroup = "program" | "subProgram" | "province" | "city" | "branch" | "month" | "asnaf";
export type ParticipantDataQuery = CommonPeriod & {
  source: "participants";
  year?: number;
  province?: string;
  city?: string;
  branch?: string;
  program?: string;
  subProgram?: string;
  asnaf?: string;
  search?: string;
  groupBy?: ParticipantGroup;
  limit?: number;
};
export type MunfikGroup = "source" | "month" | "office" | "city" | "province" | "program";
export type MunfikDataQuery = CommonPeriod & {
  source: "munfik";
  sourceType?: "Empowerment" | "Progdis" | "Dakwah";
  office?: string;
  city?: string;
  province?: string;
  program?: string;
  groupBy?: MunfikGroup;
  limit?: number;
};
export type DetailGroup = "month" | "province" | "city" | "branch" | "program" | "status" | "businessField" | "gender" | "asnaf" | "village" | "source";
export type DetailDataQuery = CommonPeriod & {
  source: "details";
  metricId: DetailMetricId;
  province?: string;
  city?: string;
  branch?: string;
  program?: string;
  status?: string;
  businessField?: string;
  gender?: string;
  asnaf?: string;
  village?: string;
  search?: string;
  groupBy?: DetailGroup;
  aggregation?: "count" | "sum" | "average";
  valueColumn?: string;
  limit?: number;
};
export type DistributionDataQuery = {
  source: "distribution";
  province?: string;
  city?: string;
  district?: string;
  branch?: string;
  status?: string;
  villageType?: string;
  program?: string;
  search?: string;
  includeVillages?: boolean;
  groupBy?: "province" | "city" | "district" | "branch" | "status" | "villageType" | "program";
  limit?: number;
};
export type AiDataQuery = DashboardDataQuery | ParticipantDataQuery | MunfikDataQuery | DetailDataQuery | DistributionDataQuery;

function period(input: CommonPeriod, latestMonthIndex: number) {
  const startMonthIndex = Math.max(0, Math.min(11, input.startMonthIndex ?? 0));
  const endMonthIndex = Math.max(startMonthIndex, Math.min(11, input.endMonthIndex ?? latestMonthIndex));
  return { startMonthIndex, endMonthIndex };
}

function equals(value: string, expected?: string) {
  if (!expected) return true;
  return matchesDataTerm(value, expected);
}

function createDimensionMatcher(expected: string | undefined, candidates: string[]) {
  if (!expected) return (_value: string) => true;
  const normalizedExpected = normalizeSearchText(expected);
  const hasExactMatch = candidates.some((candidate) => normalizeSearchText(candidate) === normalizedExpected);
  return hasExactMatch
    ? (value: string) => normalizeSearchText(value) === normalizedExpected
    : (value: string) => equals(value, expected);
}

function matchesFreeText(values: string[], search?: string) {
  if (!search?.trim()) return true;
  const haystack = normalizeSearchText(values.join(" "));
  const tokens = dataSearchTokens(search);
  return tokens.length > 0 ? tokens.every((token) => haystack.includes(token)) : haystack.includes(normalizeSearchText(search));
}

function sortedGroups(values: Map<string, number>, limit = 50) {
  return [...values].map(([name, value]) => ({ name: name || "Tidak terisi", value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "id")).slice(0, Math.max(1, Math.min(200, limit)));
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

export async function queryDashboardData(input: DashboardDataQuery, forceRefresh = false) {
  const { sourceData, dataset } = await getServerCachedData("ai-prepared-dashboard", async () => {
    const freshSourceData = await getServerCachedData("dashboard", getDashboardSheetData, forceRefresh);
    return { sourceData: freshSourceData, dataset: normalizeDashboardData(freshSourceData) };
  }, forceRefresh);
  const selectedPeriod = period(input, sourceData.latestMonthIndex);
  const requestedMetricId = input.metricId ? findMetricDefinition(input.metricId)?.id ?? input.metricId : undefined;
  const records = dataset.records.filter((row) => row.monthIndex >= selectedPeriod.startMonthIndex && row.monthIndex <= selectedPeriod.endMonthIndex && (!requestedMetricId || row.indicatorId === requestedMetricId));
  const grouped = new Map<string, number>();
  records.forEach((row) => grouped.set(row.indicatorId, (grouped.get(row.indicatorId) ?? 0) + row.value));
  const targets = new Map(sourceData.metrics.map((metric) => [metric.id, metric.target]));
  return {
    source: "dashboard" as const,
    period: { ...selectedPeriod, startMonth: DASHBOARD_MONTHS[selectedPeriod.startMonthIndex], endMonth: DASHBOARD_MONTHS[selectedPeriod.endMonthIndex], year: sourceData.year },
    metrics: [...grouped].map(([metricId, achievement]) => ({ metricId, target: targets.get(metricId) ?? null, achievement })),
    calculation: "Target diambil satu kali sebagai target tahunan; capaian dijumlahkan dari nilai bulanan pada periode terpilih.",
    quality: dataset.quality,
    provenance: dataset.provenance,
  };
}

export async function queryParticipantData(input: ParticipantDataQuery, forceRefresh = false) {
  const { sourceData, dataset } = await getServerCachedData("ai-prepared-participants", async () => {
    const freshSourceData = await getServerCachedData("participants", getParticipantSheetData, forceRefresh);
    return { sourceData: freshSourceData, dataset: normalizeParticipantData(freshSourceData) };
  }, forceRefresh);
  const selectedPeriod = period(input, sourceData.latestMonthIndex);
  const genericAsnaf = input.asnaf ? ["mustahik", "pm", "pp", "peserta program"].includes(normalizeSearchText(input.asnaf)) : false;
  const asnafDefinition = input.asnaf && !genericAsnaf ? ASNAF_FIELDS.find(([, label]) => equals(label, input.asnaf)) : undefined;
  if (input.asnaf && !genericAsnaf && !asnafDefinition) throw new Error(`Asnaf ${input.asnaf} tidak dikenali.`);
  const genericProgram = input.program ? ["mustahik", "pm", "pp", "peserta program"].includes(normalizeSearchText(input.program)) : false;
  const dimensionValues = {
    province: dataset.records.map((row) => row.province), city: dataset.records.map((row) => row.city), branch: dataset.records.map((row) => row.branch),
    program: dataset.records.flatMap((row) => [row.program, row.subProgram]), subProgram: dataset.records.flatMap((row) => [row.subProgram, row.program]),
  };
  const matchProvince = createDimensionMatcher(input.province, dimensionValues.province);
  const matchCity = createDimensionMatcher(input.city, dimensionValues.city);
  const matchBranch = createDimensionMatcher(input.branch, dimensionValues.branch);
  const matchProgram = createDimensionMatcher(input.program, dimensionValues.program);
  const matchSubProgram = createDimensionMatcher(input.subProgram, dimensionValues.subProgram);
  const records = dataset.records.filter((row) => row.year === (input.year ?? sourceData.year)
    && row.monthIndex >= selectedPeriod.startMonthIndex && row.monthIndex <= selectedPeriod.endMonthIndex
    && matchProvince(row.province) && matchCity(row.city) && matchBranch(row.branch)
    && (!input.program || genericProgram || matchProgram(row.program) || matchProgram(row.subProgram))
    && (!input.subProgram || matchSubProgram(row.subProgram) || matchSubProgram(row.program))
    && matchesFreeText([row.province, row.city, row.branch, row.program, row.subProgram], input.search));
  const recordValue = (row: typeof records[number]) => asnafDefinition ? row.asnaf[asnafDefinition[1]] ?? 0 : row.value;
  const groups = new Map<string, number>();
  if (input.groupBy === "asnaf") {
    ASNAF_FIELDS.forEach(([, label]) => groups.set(label, records.reduce((sum, row) => sum + (row.asnaf[label] ?? 0), 0)));
  } else if (input.groupBy) {
    records.forEach((row) => {
      const key = input.groupBy === "month" ? DASHBOARD_MONTHS[row.monthIndex]
        : input.groupBy === "subProgram" ? row.subProgram
          : input.groupBy === "province" ? row.province
            : input.groupBy === "city" ? row.city
              : input.groupBy === "branch" ? row.branch : row.program;
      if (key.trim()) groups.set(key, (groups.get(key) ?? 0) + recordValue(row));
    });
  }
  const total = records.reduce((sum, row) => sum + recordValue(row), 0);
  const asnafTotal = records.reduce((sum, row) => sum + Object.values(row.asnaf).reduce((rowTotal, value) => rowTotal + value, 0), 0);
  return {
    source: "participants" as const,
    period: { ...selectedPeriod, startMonth: DASHBOARD_MONTHS[selectedPeriod.startMonthIndex], endMonth: DASHBOARD_MONTHS[selectedPeriod.endMonthIndex], year: input.year ?? sourceData.year },
    filters: { province: input.province, city: input.city, branch: input.branch, program: input.program, subProgram: input.subProgram, asnaf: asnafDefinition?.[1], search: input.search },
    resolvedFilters: { province: input.province ? uniqueValues(records.map((row) => row.province)) : [], city: input.city ? uniqueValues(records.map((row) => row.city)) : [], branch: input.branch ? uniqueValues(records.map((row) => row.branch)) : [], program: input.program ? uniqueValues(records.map((row) => row.program)) : [], subProgram: input.subProgram ? uniqueValues(records.map((row) => row.subProgram)) : [] },
    total,
    matchedRows: records.length,
    groups: input.groupBy ? sortedGroups(groups, input.limit) : [],
    reconciliation: { participantTotal: records.reduce((sum, row) => sum + row.value, 0), asnafTotal, difference: records.reduce((sum, row) => sum + row.value, 0) - asnafTotal },
    calculation: asnafDefinition ? `SUM kategori asnaf ${asnafDefinition[1]} pada baris yang sesuai filter.` : "SUM kolom JUMLAH pada baris yang sesuai filter; bukan hitung nama unik.",
    quality: dataset.quality,
    provenance: dataset.provenance,
  };
}

export async function queryMunfikData(input: MunfikDataQuery, forceRefresh = false) {
  const { sourceData, dataset } = await getServerCachedData("ai-prepared-munfik", async () => {
    const freshSourceData = await getServerCachedData("metric-detail-munfik", () => getMetricDetailData("munfik"), forceRefresh);
    return { sourceData: freshSourceData, dataset: normalizeMunfikData(freshSourceData) };
  }, forceRefresh);
  const latestMonthIndex = dataset.records.reduce((latest, row) => Math.max(latest, row.monthIndex), 0);
  const selectedPeriod = period(input, latestMonthIndex);
  const dimensionValues = {
    office: dataset.records.map((row) => row.office), city: dataset.records.map((row) => row.city), province: dataset.records.map((row) => row.province), program: dataset.records.map((row) => row.program),
  };
  const matchOffice = createDimensionMatcher(input.office, dimensionValues.office);
  const matchCity = createDimensionMatcher(input.city, dimensionValues.city);
  const matchProvince = createDimensionMatcher(input.province, dimensionValues.province);
  const matchProgram = createDimensionMatcher(input.program, dimensionValues.program);
  const records = dataset.records.filter((row) => row.monthIndex >= selectedPeriod.startMonthIndex && row.monthIndex <= selectedPeriod.endMonthIndex
    && (!input.sourceType || row.sourceType === input.sourceType) && matchOffice(row.office) && matchCity(row.city)
    && matchProvince(row.province) && matchProgram(row.program));
  const groups = new Map<string, number>();
  if (input.groupBy) records.forEach((row) => {
    const key = input.groupBy === "source" ? row.sourceType
      : input.groupBy === "month" ? DASHBOARD_MONTHS[row.monthIndex]
        : input.groupBy === "office" ? row.office
          : input.groupBy === "city" ? row.city
            : input.groupBy === "province" ? row.province : row.program;
    if (key.trim()) groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  return {
    source: "munfik" as const,
    period: { ...selectedPeriod, startMonth: DASHBOARD_MONTHS[selectedPeriod.startMonthIndex], endMonth: DASHBOARD_MONTHS[selectedPeriod.endMonthIndex] },
    filters: { sourceType: input.sourceType, office: input.office, city: input.city, province: input.province, program: input.program },
    resolvedFilters: { office: input.office ? uniqueValues(records.map((row) => row.office)) : [], city: input.city ? uniqueValues(records.map((row) => row.city)) : [], province: input.province ? uniqueValues(records.map((row) => row.province)) : [], program: input.program ? uniqueValues(records.map((row) => row.program)) : [] },
    total: records.length,
    nominalAvailable: records.filter((row) => row.nominal !== null).length,
    nominalTotal: records.reduce((sum, row) => sum + (row.nominal ?? 0), 0),
    groups: input.groupBy ? sortedGroups(groups, input.limit) : [],
    calculation: "COUNT seluruh baris valid dari blok Empowerment, Progdis, dan Dakwah setelah dinormalisasi; nama tidak dibuat unik dan nominal tidak digunakan sebagai capaian.",
    quality: dataset.quality,
    provenance: dataset.provenance,
  };
}

const DETAIL_FIELD_COLUMNS: Record<DetailGroup, readonly string[]> = {
  month: ["Bulan", "Bulan Informasi", "Bulan Awal Program"],
  province: ["Provinsi", "Propinsi"],
  city: ["Kab/Kota", "Kota/Kab"],
  branch: ["Cabang", "Cabang/Kantor"],
  program: ["Nama Program", "Base Program", "Bidang Usaha/Program", "Program"],
  status: ["Status BUMMas", "Status"],
  businessField: ["Bidang Usaha/Program", "Jenis Usaha"],
  gender: ["Jenis Kelamin"],
  asnaf: ["Asnaf"],
  village: ["Nama Desa", "Desa"],
  source: ["Sumber", "Divisi"],
};

function detailColumn(values: Record<string, string>, field: DetailGroup) {
  const candidates = DETAIL_FIELD_COLUMNS[field];
  return Object.keys(values).find((name) => candidates.some((candidate) => normalizeSearchText(candidate) === normalizeSearchText(name)));
}

function numericValue(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function queryDetailData(input: DetailDataQuery, forceRefresh = false) {
  const loaderMetricId = input.metricId === "garis-kemiskinan-recap" ? "garis-kemiskinan" : input.metricId;
  const { sourceData, dataset } = await getServerCachedData(`ai-prepared-detail-${input.metricId}`, async () => {
    const freshSourceData = await getServerCachedData(`metric-detail-${loaderMetricId}`, () => getMetricDetailData(loaderMetricId), forceRefresh);
    return { sourceData: freshSourceData, dataset: normalizeMetricDetailData(input.metricId, freshSourceData) };
  }, forceRefresh);
  const monthsAvailable = dataset.records.flatMap((row) => row.monthIndex === null ? [] : [row.monthIndex]);
  const latestMonthIndex = monthsAvailable.length ? Math.max(...monthsAvailable) : null;
  const selectedPeriod = latestMonthIndex === null ? null : period(input, latestMonthIndex);
  const filterPairs: Array<[DetailGroup, string | undefined]> = [
    ["province", input.province], ["city", input.city], ["branch", input.branch], ["program", input.program], ["status", input.status],
    ["businessField", input.businessField], ["gender", input.gender], ["asnaf", input.asnaf], ["village", input.village],
  ];
  const sampleValues = dataset.records[0]?.values ?? {};
  const columnByField = new Map((Object.keys(DETAIL_FIELD_COLUMNS) as DetailGroup[]).map((field) => [field, detailColumn(sampleValues, field)]));
  const readField = (values: Record<string, string>, field: DetailGroup) => {
    const column = columnByField.get(field);
    return column ? values[column] ?? "" : "";
  };
  const activeFilterPairs = filterPairs.filter((pair): pair is [DetailGroup, string] => Boolean(pair[1]?.trim()));
  const dimensionMatchers = new Map(activeFilterPairs.map(([field, expected]) => [field, createDimensionMatcher(expected, dataset.records.map((row) => readField(row.values, field)))]));
  const records = dataset.records.filter((row) => (!selectedPeriod || (row.monthIndex !== null && row.monthIndex >= selectedPeriod.startMonthIndex && row.monthIndex <= selectedPeriod.endMonthIndex))
    && activeFilterPairs.every(([field]) => dimensionMatchers.get(field)!(readField(row.values, field)))
    && matchesFreeText(Object.values(row.values), input.search));
  const aggregation = input.aggregation ?? "count";
  const valueColumn = input.valueColumn ? Object.keys(records[0]?.values ?? dataset.records[0]?.values ?? {}).find((column) => matchesDataTerm(column, input.valueColumn)) : undefined;
  if (aggregation !== "count" && !valueColumn) throw new Error("valueColumn wajib diisi dan harus cocok dengan kolom numerik untuk SUM atau rata-rata.");
  const recordMeasure = (row: typeof records[number]) => aggregation === "count" ? 1 : numericValue(row.values[valueColumn!] ?? "");
  const totalMeasure = records.reduce((sum, row) => sum + recordMeasure(row), 0);
  const total = aggregation === "average" && records.length > 0 ? totalMeasure / records.length : totalMeasure;
  const groups = new Map<string, { value: number; rows: number }>();
  if (input.groupBy) records.forEach((row) => {
    const key = input.groupBy === "month" && row.monthIndex !== null ? DASHBOARD_MONTHS[row.monthIndex] : normalizeDataTerm(readField(row.values, input.groupBy!));
    if (!key.trim()) return;
    const current = groups.get(key) ?? { value: 0, rows: 0 };
    current.value += recordMeasure(row); current.rows += 1; groups.set(key, current);
  });
  const groupResults = [...groups].map(([name, result]) => ({ name, value: aggregation === "average" && result.rows > 0 ? result.value / result.rows : result.value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "id")).slice(0, Math.max(1, Math.min(200, input.limit ?? 50)));
  const missingGroupValue = input.groupBy && input.groupBy !== "month"
    ? records.filter((row) => !readField(row.values, input.groupBy!).trim()).reduce((sum, row) => sum + recordMeasure(row), 0)
    : 0;
  return {
    source: "details" as const, metricId: input.metricId,
    period: selectedPeriod ? { ...selectedPeriod, startMonth: DASHBOARD_MONTHS[selectedPeriod.startMonthIndex], endMonth: DASHBOARD_MONTHS[selectedPeriod.endMonthIndex] } : null,
    filters: Object.fromEntries(activeFilterPairs.map(([field, value]) => [field, value])),
    resolvedFilters: Object.fromEntries(activeFilterPairs.map(([field]) => [field, uniqueValues(records.map((row) => readField(row.values, field)))])), search: input.search,
    aggregation, valueColumn: valueColumn ?? null, total, matchedRows: records.length, groups: input.groupBy ? groupResults : [], missingGroupValue,
    availableColumns: Object.keys(dataset.records[0]?.values ?? {}),
    calculation: aggregation === "count" ? `COUNT baris valid menurut aturan ${input.metricId}.` : `${aggregation === "sum" ? "SUM" : "AVERAGE"} kolom ${valueColumn} pada baris valid yang sesuai filter.`,
    quality: dataset.quality, provenance: dataset.provenance,
  };
}

export async function queryDistributionData(input: DistributionDataQuery, forceRefresh = false) {
  const sourceData = await getServerCachedData("distribution-ai-v2", getDistributionFromGoogleSheets, forceRefresh);
  const villages = sourceData.provinces.flatMap((province) => province.villages.map((village) => ({ ...village, province: province.name })));
  const matchProvince = createDimensionMatcher(input.province, villages.map((village) => village.province));
  const matchCity = createDimensionMatcher(input.city, villages.map((village) => village.regency));
  const matchDistrict = createDimensionMatcher(input.district, villages.map((village) => village.district));
  const matchBranch = createDimensionMatcher(input.branch, villages.map((village) => village.branch));
  const matchStatus = createDimensionMatcher(input.status, villages.map((village) => village.status));
  const matchVillageType = createDimensionMatcher(input.villageType, villages.map((village) => village.villageType));
  const matchProgram = createDimensionMatcher(input.program, villages.flatMap((village) => village.programs));
  const records = villages.filter((village) => matchProvince(village.province) && matchCity(village.regency) && matchDistrict(village.district)
    && matchBranch(village.branch) && matchStatus(village.status) && matchVillageType(village.villageType)
    && (!input.program || village.programs.some((programName) => matchProgram(programName)))
    && matchesFreeText([village.name, village.province, village.regency, village.district, village.branch, village.status, village.villageType, ...village.programs], input.search));
  const groups = new Map<string, number>();
  if (input.groupBy) records.forEach((village) => {
    const keys = input.groupBy === "program" ? village.programs : [input.groupBy === "province" ? village.province : input.groupBy === "city" ? village.regency : input.groupBy === "district" ? village.district : input.groupBy === "branch" ? village.branch : input.groupBy === "status" ? village.status : village.villageType];
    keys.forEach((key) => {
      const normalizedKey = normalizeDataTerm(key) || "Tidak terisi";
      const units = input.groupBy === "program" ? village.programUnits?.[key] ?? 1 : 1;
      groups.set(normalizedKey, (groups.get(normalizedKey) ?? 0) + units);
    });
  });
  const source = resolvedDataSource("distribution");
  const resultLimit = Math.max(1, Math.min(200, input.limit ?? 50));
  const villageResults = input.includeVillages ? records.slice(0, resultLimit).map((village) => ({
    name: village.name,
    province: village.province,
    city: village.regency,
    district: village.district,
    branch: village.branch,
    status: village.status,
    villageType: village.villageType,
    programs: village.programs,
  })) : [];
  return {
    source: "distribution" as const, totalVillages: records.length, activeVillages: records.filter((village) => village.status === "Aktif").length,
    programPoints: records.reduce((sum, village) => sum + village.programs.reduce((programTotal, program) => programTotal + (village.programUnits?.[program] ?? 1), 0), 0), groups: input.groupBy ? sortedGroups(groups, input.limit) : [],
    villages: villageResults, returnedVillages: villageResults.length, villagesTruncated: input.includeVillages ? records.length > villageResults.length : false,
    filters: { province: input.province, city: input.city, district: input.district, branch: input.branch, status: input.status, villageType: input.villageType, program: input.program, search: input.search },
    resolvedFilters: {
      province: input.province ? uniqueValues(records.map((village) => village.province)) : [], city: input.city ? uniqueValues(records.map((village) => village.regency)) : [],
      district: input.district ? uniqueValues(records.map((village) => village.district)) : [], branch: input.branch ? uniqueValues(records.map((village) => village.branch)) : [],
      status: input.status ? uniqueValues(records.map((village) => village.status)) : [], villageType: input.villageType ? uniqueValues(records.map((village) => village.villageType)) : [],
      program: input.program ? uniqueValues(records.flatMap((village) => village.programs.filter((programName) => matchProgram(programName)))) : [],
    },
    calculation: input.groupBy === "program" ? "Setiap relasi desa-program dihitung menurut jumlah unit pada sumber; nilai seperti 2 BUMMas dihitung sebagai dua titik program." : input.includeVillages ? "Setiap desa yang sesuai filter dihitung satu kali dan detail desa dikembalikan sesuai batas hasil." : "Setiap desa yang sesuai filter dihitung satu kali.",
    quality: { isValid: true, rowsRead: villages.length, rowsAccepted: records.length, rowsRejected: villages.length - records.length, checkedAt: new Date().toISOString(), issues: [] },
    provenance: { sourceId: "distribution", sourceLabel: source.label, spreadsheetId: source.spreadsheetId, gid: source.gid, sheetUrl: source.sheetUrl, updatedAt: sourceData.updatedAt },
  };
}

export function queryAiData(input: AiDataQuery, forceRefresh = false) {
  if (input.source === "dashboard") return queryDashboardData(input, forceRefresh);
  if (input.source === "participants") return queryParticipantData(input, forceRefresh);
  if (input.source === "munfik") return queryMunfikData(input, forceRefresh);
  if (input.source === "distribution") return queryDistributionData(input, forceRefresh);
  return queryDetailData(input, forceRefresh);
}

export async function reconcileAiDataSources(input: CommonPeriod = {}, forceRefresh = false) {
  let [dashboard, participants, munfik] = await Promise.all([
    queryDashboardData({ source: "dashboard", ...input }, forceRefresh),
    queryParticipantData({ source: "participants", ...input }, forceRefresh),
    queryMunfikData({ source: "munfik", ...input }, forceRefresh),
  ]);
  if (input.endMonthIndex === undefined) {
    const commonEndMonthIndex = Math.min(dashboard.period.endMonthIndex, participants.period.endMonthIndex, munfik.period.endMonthIndex);
    [dashboard, participants, munfik] = await Promise.all([
      queryDashboardData({ source: "dashboard", ...input, endMonthIndex: commonEndMonthIndex }),
      queryParticipantData({ source: "participants", ...input, endMonthIndex: commonEndMonthIndex }),
      queryMunfikData({ source: "munfik", ...input, endMonthIndex: commonEndMonthIndex }),
    ]);
  }
  const dashboardParticipant = dashboard.metrics.find((metric) => metric.metricId === "peserta-program")?.achievement ?? null;
  const dashboardMunfik = dashboard.metrics.find((metric) => metric.metricId === "munfik")?.achievement ?? null;
  const sharedPeriod = { startMonthIndex: dashboard.period.startMonthIndex, endMonthIndex: dashboard.period.endMonthIndex };
  const [muzzaki, mualaf] = await Promise.all([
    queryDetailData({ source: "details", metricId: "muzzaki", ...sharedPeriod }, forceRefresh),
    queryDetailData({ source: "details", metricId: "mualaf", ...sharedPeriod }, forceRefresh),
  ]);
  const [ppTerbina, bummas] = await Promise.all([
    queryDetailData({ source: "details", metricId: "pp-terbina", ...sharedPeriod }, forceRefresh),
    queryDetailData({ source: "details", metricId: "bummas" }, forceRefresh),
  ]);
  const [povertyRecap, distribution] = await Promise.all([
    queryDetailData({ source: "details", metricId: "garis-kemiskinan-recap", ...sharedPeriod, aggregation: "sum", valueColumn: `Capaian GK ${dashboard.period.year}` }, forceRefresh),
    queryDistributionData({ source: "distribution" }, forceRefresh),
  ]);
  const dashboardValue = (metricId: string) => dashboard.metrics.find((metric) => metric.metricId === metricId)?.achievement ?? null;
  const comparison = (id: string, label: string, summaryValue: number | null, detailValue: number) => ({
    id, label, summaryValue, detailValue, difference: summaryValue === null ? null : summaryValue - detailValue,
    status: summaryValue !== null && summaryValue === detailValue ? "passed" as const : "failed" as const,
  });
  const checks = [
    {
      id: "dashboard-vs-participant-detail",
      label: "Peserta Program Dashboard vs detail",
      summaryValue: dashboardParticipant,
      detailValue: participants.total,
      difference: dashboardParticipant === null ? null : dashboardParticipant - participants.total,
      status: dashboardParticipant !== null && dashboardParticipant === participants.total ? "passed" : "failed",
    },
    {
      id: "dashboard-vs-munfik-detail",
      label: "Munfik Dashboard vs tiga blok detail",
      summaryValue: dashboardMunfik,
      detailValue: munfik.total,
      difference: dashboardMunfik === null ? null : dashboardMunfik - munfik.total,
      status: dashboardMunfik !== null && dashboardMunfik === munfik.total ? "passed" : "failed",
    },
    {
      id: "participant-total-vs-asnaf",
      label: "JUMLAH Peserta Program vs jumlah seluruh asnaf",
      summaryValue: participants.reconciliation.participantTotal,
      detailValue: participants.reconciliation.asnafTotal,
      difference: participants.reconciliation.difference,
      status: participants.reconciliation.difference === 0 ? "passed" : "failed",
    },
    comparison("dashboard-vs-muzzaki-detail", "Muzaki Dashboard vs detail", dashboardValue("muzzaki"), muzzaki.total),
    comparison("dashboard-vs-mualaf-detail", "Mualaf Dashboard vs Nama PM terisi", dashboardValue("mualaf"), mualaf.total),
    comparison("dashboard-vs-pp-terbina-detail", "PP Terbina Dashboard vs detail", dashboardValue("pp-terbina"), ppTerbina.total),
    comparison("dashboard-vs-bummas-detail", "BUMMas Dashboard vs bidang usaha terisi", dashboardValue("bummas"), bummas.total),
    comparison("dashboard-vs-gk-recap", "GK Dashboard vs rekap bulanan", dashboardValue("garis-kemiskinan"), povertyRecap.total),
    comparison("dashboard-vs-distribution", "Desa Berdaya Dashboard vs sebaran", dashboardValue("desa-berdaya"), distribution.totalVillages),
  ];
  return {
    isValid: checks.every((check) => check.status === "passed") && [dashboard, participants, munfik, muzzaki, mualaf, ppTerbina, bummas, povertyRecap, distribution].every((result) => result.quality.isValid),
    period: dashboard.period,
    comparedThroughCommonMonth: dashboard.period.endMonth,
    checks,
    quality: { dashboard: dashboard.quality, participants: participants.quality, munfik: munfik.quality, muzzaki: muzzaki.quality, mualaf: mualaf.quality, ppTerbina: ppTerbina.quality, bummas: bummas.quality, povertyRecap: povertyRecap.quality, distribution: distribution.quality },
    provenance: { dashboard: dashboard.provenance, participants: participants.provenance, munfik: munfik.provenance, muzzaki: muzzaki.provenance, mualaf: mualaf.provenance, ppTerbina: ppTerbina.provenance, bummas: bummas.provenance, povertyRecap: povertyRecap.provenance, distribution: distribution.provenance },
    checkedAt: new Date().toISOString(),
  };
}
