export type AssistantViewContextData = {
  page: string;
  filters?: Record<string, string | string[]>;
  selection?: string;
  summary?: string[];
  visibleSections?: string[];
};

export type AssistantViewContext = AssistantViewContextData & { pathname: string };

const ALLOWED_PATHS = new Set([
  "/", "/ikhtisar-pp-plp", "/analisa-capaian-pp", "/peta-sebaran", "/dampak-program",
  "/peserta-layanan-program", "/muzzaki", "/munfik", "/mualaf", "/bummas",
  "/garis-kemiskinan", "/pp-terbina",
]);

export function validAssistantViewContext(value: unknown): value is AssistantViewContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const context = value as Record<string, unknown>;
  if (typeof context.pathname !== "string" || !ALLOWED_PATHS.has(context.pathname)) return false;
  if (typeof context.page !== "string" || context.page.length > 100) return false;
  if (context.selection !== undefined && (typeof context.selection !== "string" || context.selection.length > 160)) return false;
  if (context.summary !== undefined && (!Array.isArray(context.summary) || context.summary.length > 8 || context.summary.some((item) => typeof item !== "string" || item.length > 180))) return false;
  if (context.visibleSections !== undefined && (!Array.isArray(context.visibleSections) || context.visibleSections.length > 6 || context.visibleSections.some((item) => typeof item !== "string" || item.length > 120))) return false;
  if (context.filters !== undefined) {
    if (!context.filters || typeof context.filters !== "object" || Array.isArray(context.filters)) return false;
    const entries = Object.entries(context.filters);
    if (entries.length > 12 || entries.some(([key, item]) => key.length > 50 || !(typeof item === "string" && item.length <= 160 || Array.isArray(item) && item.length <= 12 && item.every((part) => typeof part === "string" && part.length <= 100)))) return false;
  }
  return true;
}
