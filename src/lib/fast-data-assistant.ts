import {
  queryDetailData,
  queryDistributionData,
  queryMunfikData,
  queryParticipantData,
  type DetailGroup,
  type ParticipantGroup,
} from "@/lib/ai-data-query";
import { DASHBOARD_MONTHS } from "@/lib/dashboard-sheets";
import type { DetailMetricId } from "@/lib/ai-data-normalizers";
import type { ReportingPeriod } from "@/lib/reporting-period";

type SourceLink = { label: string; url: string; updatedAt: string };
export type FastAssistantResult = {
  message: string;
  provider: string;
  model: string;
  usedTools: string[];
  sources: SourceLink[];
};

type MetricRoute =
  | { kind: "participants"; id: "peserta-program"; label: "Peserta Program (PP)"; unit: "peserta" }
  | { kind: "distribution"; id: "desa-berdaya"; label: "Desa Berdaya"; unit: "desa" }
  | { kind: "munfik"; id: "munfik"; label: "Munfik"; unit: "orang" }
  | { kind: "details"; id: DetailMetricId; label: string; unit: string };

const ROUTES: Array<{ pattern: RegExp; route: MetricRoute }> = [
  { pattern: /\b(desber|desa berdaya|desa binaan|desbin)\b/i, route: { kind: "distribution", id: "desa-berdaya", label: "Desa Berdaya", unit: "desa" } },
  { pattern: /\b(munfik|munfiq)\b/i, route: { kind: "munfik", id: "munfik", label: "Munfik", unit: "orang" } },
  { pattern: /\b(muzaki|muzzaki|muzakki)\b/i, route: { kind: "details", id: "muzzaki", label: "Muzaki", unit: "orang" } },
  { pattern: /\b(mualaf|muallaf)\b/i, route: { kind: "details", id: "mualaf", label: "Mualaf", unit: "orang" } },
  { pattern: /\b(bummas|unit bisnis)\b/i, route: { kind: "details", id: "bummas", label: "BUMMas", unit: "unit" } },
  { pattern: /\b(pp terbina|pm terbina|peserta program terbina|peserta terbina)\b/i, route: { kind: "details", id: "pp-terbina", label: "Peserta Program Terbina", unit: "peserta" } },
  { pattern: /\b(gk|garis kemiskinan|keluar kemiskinan)\b/i, route: { kind: "details", id: "garis-kemiskinan", label: "Peserta Keluar Garis Kemiskinan", unit: "peserta" } },
  { pattern: /\b(pp|pm|peserta program|penerima manfaat|peserta)\b/i, route: { kind: "participants", id: "peserta-program", label: "Peserta Program (PP)", unit: "peserta" } },
];

const NUMBER_FORMAT = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const FAST_INTENT = /\b(berapa|jumlah|total|ada|terbanyak|terbesar|tertinggi|urutkan|urutan|top|mana|daftar|lampirkan|sebutkan|tampilkan)\b/i;
const ANALYTICAL_INTENT = /\b(mengapa|kenapa|bagaimana|gimana|analisis|insight|narasi|rekomendasi|tren|trend|growth|pertumbuhan|banding|perbandingan|cocok|valid|akurasi)\b/i;
const PLACE_STOP = /\b(berapa|ada|jumlah(?:nya)?|total|periode|bulan|tahun|sampai|dengan|aktif|titik|program|desa|orang|peserta|mana)\b/i;

function titleCase(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

function cleanPlace(value: string) {
  return titleCase(value.split(PLACE_STOP)[0].replace(/[?!,;]+$/g, "").trim());
}

function explicitCity(question: string) {
  const matches = [...question.matchAll(/\b(kota|kab(?:upaten)?\.?)\s+([\p{L}]+(?:[ -]+[\p{L}]+){0,4})/giu)];
  if (matches.length !== 1) return null;
  const place = cleanPlace(matches[0][2]);
  if (!place) return null;
  return /^kota$/i.test(matches[0][1]) ? `Kota ${place}` : `Kab ${place}`;
}

function genericCity(question: string, route: MetricRoute) {
  const afterDi = question.match(/\bdi\s+(.+?)(?:\s+(?:berapa|ada|jumlah(?:nya)?|total|periode|bulan|tahun|sampai)\b|[?!]|$)/i)?.[1];
  if (afterDi) {
    const place = cleanPlace(afterDi);
    if (place && !/^(mana|wilayah|kota|kabupaten|provinsi)$/i.test(place)) return place;
  }
  const withoutMetric = ROUTES.reduce((value, item) => value.replace(item.pattern, " "), question)
    .replace(/\b(berapa|jumlahnya|jumlah|total|ada|di|yang|untuk|periode|bulan|tahun|orang|peserta|desa|per|sumber|sampai|hingga|dengan)\b/gi, " ")
    .replace(/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/gi, " ")
    .replace(/\b20\d{2}\b/g, " ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const tokens = withoutMetric.split(" ").filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 4 && route.kind !== "details") return titleCase(withoutMetric);
  return null;
}

function selectedPeriod(question: string) {
  const normalized = question.toLocaleLowerCase("id-ID");
  const found = DASHBOARD_MONTHS.flatMap((month, index) => normalized.includes(month.toLocaleLowerCase("id-ID")) ? [index] : []);
  if (!found.length) return {};
  const startMonthIndex = /\b(sampai|hingga|s d)\b/i.test(question) && found.length === 1 ? 0 : Math.min(...found);
  return { startMonthIndex, endMonthIndex: Math.max(...found) };
}

function requestedGroup(question: string): ParticipantGroup | DetailGroup | "source" | null {
  if (/\b(kota|kab|kabupaten)\b/i.test(question)) return "city";
  if (/\bprovinsi\b/i.test(question)) return "province";
  if (/\b(cabang|kantor)\b/i.test(question)) return "branch";
  if (/\bsub\s*program\b/i.test(question)) return "subProgram";
  if (/\bprogram\b/i.test(question)) return "program";
  if (/\bstatus\b/i.test(question)) return "status";
  if (/\b(asnaf)\b/i.test(question)) return "asnaf";
  if (/\b(sumber)\b/i.test(question)) return "source";
  if (/\bbulan\b/i.test(question)) return "month";
  return null;
}

function requestedLimit(question: string, ranked: boolean) {
  if (!ranked) return undefined;
  const value = Number(question.match(/\b(?:top|urutkan)?\s*(\d{1,2})\b/i)?.[1]);
  return Number.isInteger(value) && value > 0 ? Math.min(20, value) : 5;
}

function periodText(period: unknown) {
  if (!period || typeof period !== "object") return "snapshot data terbaru";
  const value = period as Record<string, unknown>;
  const start = typeof value.startMonth === "string" ? value.startMonth : "";
  const end = typeof value.endMonth === "string" ? value.endMonth : "";
  const year = typeof value.year === "number" ? ` ${value.year}` : "";
  if (!start || !end) return "snapshot data terbaru";
  return start === end ? `${start}${year}` : `${start}–${end}${year}`;
}

function sourceLink(provenance: unknown): SourceLink[] {
  if (!provenance || typeof provenance !== "object") return [];
  const value = provenance as Record<string, unknown>;
  if (typeof value.sourceLabel !== "string" || typeof value.sheetUrl !== "string") return [];
  return [{ label: value.sourceLabel, url: value.sheetUrl, updatedAt: String(value.updatedAt ?? "") }];
}

function placeSuffix(city: string | null) {
  return city ? ` di **${city}**` : "";
}

const PROVINCES = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi", "Sumatera Selatan", "Kepulauan Bangka Belitung", "Bengkulu", "Lampung",
  "Banten", "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Daerah Istimewa Yogyakarta", "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur",
  "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah",
  "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tenggara", "Maluku", "Maluku Utara", "Papua Barat Daya", "Papua Barat", "Papua Tengah", "Papua Pegunungan", "Papua Selatan", "Papua",
] as const;

function broadProvince(place: string | null) {
  if (!place) return null;
  const normalized = place.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
  if (normalized === "jakarta") return "DKI Jakarta";
  if (normalized === "yogyakarta" || normalized === "diy") return "Daerah Istimewa Yogyakarta";
  return PROVINCES.find((province) => province.toLocaleLowerCase("id-ID") === normalized) ?? null;
}

function groupLabel(group: string | null) {
  if (group === "city") return "kota/kab";
  if (group === "branch") return "cabang";
  if (group === "subProgram") return "subprogram";
  return String(group);
}

function resolvedLocation(result: object, fallback: string | null) {
  if (!("resolvedFilters" in result) || !result.resolvedFilters || typeof result.resolvedFilters !== "object") return fallback;
  const filters = result.resolvedFilters as Record<string, unknown>;
  const values = [filters.province, filters.city].flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []);
  if (!values.length) return fallback;
  return values.length === 1 ? values[0] : values.slice(0, -1).join(", ") + " dan " + values.at(-1);
}

export async function tryFastDataAssistant(question: string, previousQuestion = "", defaultPeriod?: ReportingPeriod): Promise<FastAssistantResult | null> {
  const explicitVillageList = /\bdesa\b/i.test(question) && /\b(mana(?:\s+saja|\s+aja)?|apa(?:\s+saja|\s+aja)?|daftar|lampirkan|sebutkan|tampilkan|nama(?:-nama)?|rincian)\b/i.test(question);
  const directRoute = ROUTES.find((item) => item.pattern.test(question))?.route ?? (explicitVillageList ? ROUTES[0].route : undefined);
  const contextualBreakdown = !directRoute && /\b(detail|rincian|pecah|sebaran)(?:nya)?\b/i.test(question) && /\b(kota|kab|kabupaten|provinsi|cabang|program|status|bulan|asnaf|sumber)\b/i.test(question);
  if ((!FAST_INTENT.test(question) && !contextualBreakdown) || ANALYTICAL_INTENT.test(question)) return null;
  const route = directRoute ?? (contextualBreakdown ? ROUTES.find((item) => item.pattern.test(previousQuestion))?.route : undefined);
  if (!route) return null;
  const listVillages = route.kind === "distribution" && /\b(mana(?:\s+saja|\s+aja)?|apa(?:\s+saja|\s+aja)?|daftar|lampirkan|sebutkan|tampilkan|nama(?:-nama)?|rincian)\b/i.test(question);
  const ranked = /\b(terbanyak|terbesar|tertinggi|urutkan|urutan|top)\b/i.test(question);
  const breakdown = contextualBreakdown || /\bper\s+(kota|kab|kabupaten|provinsi|cabang|kantor|sub\s*program|program|status|asnaf|sumber|bulan)\b/i.test(question);
  const groupBy = ranked || breakdown ? requestedGroup(question) : null;
  if ((ranked || breakdown) && !groupBy) return null;
  const contextualCity = contextualBreakdown ? explicitCity(previousQuestion) ?? genericCity(previousQuestion, route) : null;
  const parsedCity = contextualCity ?? (ranked || breakdown ? null : explicitCity(question) ?? genericCity(question, route));
  const province = broadProvince(parsedCity);
  const city = province ? null : parsedCity;
  const locationLabel = province ?? city;
  const periodQuestion = contextualBreakdown ? previousQuestion : question;
  const explicitPeriod = selectedPeriod(periodQuestion);
  const period = Object.keys(explicitPeriod).length > 0
    ? explicitPeriod
    : defaultPeriod ? { startMonthIndex: defaultPeriod.startMonthIndex, endMonthIndex: defaultPeriod.endMonthIndex } : {};
  const limit = requestedLimit(question, ranked) ?? (breakdown ? 50 : undefined);

  let result: Awaited<ReturnType<typeof queryParticipantData>> | Awaited<ReturnType<typeof queryDistributionData>> | Awaited<ReturnType<typeof queryMunfikData>> | Awaited<ReturnType<typeof queryDetailData>>;
  let toolName = "";
  if (route.kind === "participants") {
    if (groupBy && !["program", "subProgram", "province", "city", "branch", "month", "asnaf"].includes(groupBy)) return null;
    const explicitYear = Number(periodQuestion.match(/\b(20\d{2})\b/)?.[1]);
    const year = Number.isInteger(explicitYear) ? explicitYear : defaultPeriod?.year;
    result = await queryParticipantData({ source: "participants", ...period, ...(year ? { year } : {}), ...(province ? { province } : {}), ...(city ? { city } : {}), ...(groupBy ? { groupBy: groupBy as ParticipantGroup, limit } : {}) });
    toolName = "fast:query_participants";
  } else if (route.kind === "distribution") {
    if (groupBy && !["program", "province", "city", "branch", "status"].includes(groupBy)) return null;
    result = await queryDistributionData({ source: "distribution", ...(province ? { province } : {}), ...(city ? { city } : {}), ...(listVillages ? { includeVillages: true, limit: 50 } : {}), ...(groupBy ? { groupBy: groupBy as "program" | "province" | "city" | "branch" | "status", limit } : {}) });
    toolName = "fast:query_distribution";
  } else if (route.kind === "munfik") {
    const munfikGroup = groupBy === "branch" ? "office" : groupBy;
    if (munfikGroup && !["program", "province", "city", "office", "month", "source"].includes(munfikGroup)) return null;
    result = await queryMunfikData({ source: "munfik", ...period, ...(province ? { province } : {}), ...(city ? { city } : {}), ...(munfikGroup ? { groupBy: munfikGroup as "program" | "province" | "city" | "office" | "month" | "source", limit } : {}) });
    toolName = "fast:query_munfik";
  } else {
    if (groupBy && !["program", "province", "city", "branch", "month", "status", "asnaf"].includes(groupBy)) return null;
    result = await queryDetailData({ source: "details", metricId: route.id, ...period, ...(province ? { province } : {}), ...(city ? { city } : {}), ...(groupBy ? { groupBy: groupBy as DetailGroup, limit } : {}) });
    toolName = "fast:query_metric_details";
  }

  if (!result.quality.isValid) return null;
  if (listVillages && result.source === "distribution") {
    if (!result.villages.length) return null;
    const rows = result.villages.map((village, index) => {
      const area = [village.district && village.district !== "-" ? `Kec. ${village.district}` : "", village.city && village.city !== "-" ? village.city : ""].filter(Boolean).join(", ");
      const details = [area, village.status, village.villageType].filter(Boolean).join(" · ");
      return `${index + 1}. **${village.name}**${details ? ` — ${details}` : ""}`;
    }).join("\n");
    const omitted = result.villagesTruncated ? `\n\nDitampilkan ${NUMBER_FORMAT.format(result.returnedVillages)} dari ${NUMBER_FORMAT.format(result.totalVillages)} desa.` : "";
    return {
      message: `Daftar **Desa Berdaya**${placeSuffix(resolvedLocation(result, locationLabel))} (${NUMBER_FORMAT.format(result.totalVillages)} desa):\n\n${rows}${omitted}\n\nPeriode: **snapshot data terbaru**\nSumber: **${result.provenance.sourceLabel}**.`,
      provider: "RZ Fast Data", model: "deterministik", usedTools: [toolName], sources: sourceLink(result.provenance),
    };
  }
  const groups = "groups" in result ? result.groups : [];
  if ((ranked || breakdown) && groups.length) {
    const rows = groups.slice(0, limit).map((item, index) => `${index + 1}. **${item.name}** — ${NUMBER_FORMAT.format(item.value)} ${route.unit}`).join("\n");
    const missingGroupValue = "missingGroupValue" in result && typeof result.missingGroupValue === "number" ? result.missingGroupValue : 0;
    const missingLine = missingGroupValue > 0 ? `\n\nBelum memiliki data ${groupLabel(groupBy)}: **${NUMBER_FORMAT.format(missingGroupValue)} ${route.unit}**.` : "";
    const scope = locationLabel ? ` di **${locationLabel}**` : "";
    const heading = ranked ? `${limit} ${groupLabel(groupBy)} dengan ${route.label} terbanyak` : `${route.label} per ${groupLabel(groupBy)}${scope}`;
    return {
      message: `${heading}:\n\n${rows}${missingLine}\n\nPeriode: **${periodText("period" in result ? result.period : null)}**\nSumber: **${result.provenance.sourceLabel}**.`,
      provider: "RZ Fast Data", model: "deterministik", usedTools: [toolName], sources: sourceLink(result.provenance),
    };
  }
  if (ranked || breakdown) return null;

  const total = route.kind === "distribution" && "totalVillages" in result ? result.totalVillages : "total" in result ? result.total : 0;
  if (locationLabel && total === 0) return null;
  const displayedLocation = resolvedLocation(result, locationLabel);
  const extra = route.kind === "distribution" && "activeVillages" in result
    ? `\n- Desa aktif: **${NUMBER_FORMAT.format(result.activeVillages)}**\n- Titik program: **${NUMBER_FORMAT.format(result.programPoints)}**`
    : "";
  const snapshotPeriod = route.kind === "distribution" ? "snapshot data terbaru" : periodText("period" in result ? result.period : null);
  return {
    message: `Jumlah **${route.label}**${placeSuffix(displayedLocation)}: **${NUMBER_FORMAT.format(total)} ${route.unit}**.${extra}\n\nPeriode: **${snapshotPeriod}**\nSumber: **${result.provenance.sourceLabel}**.`,
    provider: "RZ Fast Data", model: "deterministik", usedTools: [toolName], sources: sourceLink(result.provenance),
  };
}
