export const ASSISTANT_ACTION_TARGETS = ["/", "/ikhtisar-pp-plp", "/peta-sebaran", "/analisa-capaian-pp", "/dampak-program"] as const;
export const ASSISTANT_ACTION_HIGHLIGHTS = ["summary", "filters", "results", "map", "ranking", "trend"] as const;

export type AssistantActionTarget = (typeof ASSISTANT_ACTION_TARGETS)[number];
export type AssistantActionHighlight = (typeof ASSISTANT_ACTION_HIGHLIGHTS)[number];
export type AssistantViewAction = {
  target: AssistantActionTarget;
  filters?: {
    startMonthIndex?: number;
    endMonthIndex?: number;
    province?: string[];
    city?: string[];
    district?: string[];
    village?: string[];
    branch?: string[];
    program?: string[];
    subProgram?: string[];
    status?: string[];
    villageType?: string[];
  };
  highlight?: AssistantActionHighlight;
};

const FILTER_KEYS: Record<AssistantActionTarget, readonly string[]> = {
  "/": ["startMonthIndex", "endMonthIndex"],
  "/ikhtisar-pp-plp": ["startMonthIndex", "endMonthIndex", "province", "city", "branch", "program", "subProgram"],
  "/peta-sebaran": ["province", "city", "district", "village", "branch", "program", "status", "villageType"],
  "/analisa-capaian-pp": [],
  "/dampak-program": [],
};

const HIGHLIGHTS: Record<AssistantActionTarget, readonly AssistantActionHighlight[]> = {
  "/": ["summary", "filters", "results"],
  "/ikhtisar-pp-plp": ["summary", "filters", "results"],
  "/peta-sebaran": ["summary", "filters", "map", "results"],
  "/analisa-capaian-pp": ["summary", "ranking", "trend", "results"],
  "/dampak-program": ["summary", "results"],
};

export function validAssistantViewAction(value: unknown): value is AssistantViewAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (Object.keys(action).some((key) => !["target", "filters", "highlight"].includes(key))) return false;
  if (!ASSISTANT_ACTION_TARGETS.includes(action.target as AssistantActionTarget)) return false;
  const target = action.target as AssistantActionTarget;
  if (action.highlight !== undefined && !HIGHLIGHTS[target].includes(action.highlight as AssistantActionHighlight)) return false;
  if (action.filters === undefined) return true;
  if (!action.filters || typeof action.filters !== "object" || Array.isArray(action.filters)) return false;
  const filters = action.filters as Record<string, unknown>;
  if (Object.keys(filters).some((key) => !FILTER_KEYS[target].includes(key))) return false;
  for (const [key, item] of Object.entries(filters)) {
    if (key === "startMonthIndex" || key === "endMonthIndex") {
      if (!Number.isInteger(item) || (item as number) < 0 || (item as number) > 11) return false;
    } else if (!Array.isArray(item) || item.length > 5 || item.some((part) => typeof part !== "string" || !part.trim() || part.length > 80)) return false;
  }
  if (filters.startMonthIndex !== undefined && filters.endMonthIndex !== undefined && (filters.startMonthIndex as number) > (filters.endMonthIndex as number)) return false;
  return true;
}

export function resolveActionValues(requested: string[] | undefined, options: string[], label: string) {
  const resolved: string[] = [];
  for (const value of requested ?? []) {
    const normalized = value.trim().toLocaleLowerCase("id-ID");
    const exact = options.find((option) => option.toLocaleLowerCase("id-ID") === normalized);
    const candidates = exact ? [exact] : options.filter((option) => option.toLocaleLowerCase("id-ID").includes(normalized));
    if (candidates.length !== 1) throw new Error(`${label} “${value}” ${candidates.length ? "ambigu" : "tidak ditemukan"} pada data halaman.`);
    if (!resolved.includes(candidates[0])) resolved.push(candidates[0]);
  }
  return resolved;
}
