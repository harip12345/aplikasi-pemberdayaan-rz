export type AiProviderId = "codex" | "groq" | "openrouter" | "9router" | "custom";

export type ResolvedHttpAiProvider = {
  provider: Exclude<AiProviderId, "codex">;
  label: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const PROVIDER_PRESETS = {
  groq: { label: "Groq", key: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", baseUrlEnv: null, model: "openai/gpt-oss-120b", modelEnv: "GROQ_MODEL" },
  openrouter: { label: "OpenRouter", key: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1", baseUrlEnv: null, model: "google/gemini-2.5-flash", modelEnv: "OPENROUTER_MODEL" },
  "9router": { label: "9Router", key: "NINEROUTER_API_KEY", baseUrl: "", baseUrlEnv: "NINEROUTER_BASE_URL", model: "", modelEnv: "NINEROUTER_MODEL" },
  custom: { label: "Provider AI", key: "CUSTOM_AI_API_KEY", baseUrl: "", baseUrlEnv: "CUSTOM_AI_BASE_URL", model: "", modelEnv: "CUSTOM_AI_MODEL" },
} as const;

export function configuredAiProvider(): AiProviderId {
  const value = (process.env.AI_PROVIDER || "codex").trim().toLowerCase();
  if (["codex", "groq", "openrouter", "9router", "custom"].includes(value)) return value as AiProviderId;
  throw new Error("AI_PROVIDER tidak dikenali. Gunakan codex, groq, openrouter, 9router, atau custom.");
}

export function aiProviderLabel(provider = configuredAiProvider()) {
  return provider === "codex" ? "Codex · ChatGPT Subscription" : PROVIDER_PRESETS[provider].label;
}

export function configuredCodexModel() {
  return process.env.CODEX_MODEL?.trim() || "gpt-6-luna";
}

function validateBaseUrl(value: string) {
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Base URL provider harus menggunakan HTTP atau HTTPS.");
  if (parsed.username || parsed.password) throw new Error("Base URL tidak boleh memuat kredensial.");
  const privateHost = parsed.hostname === "localhost" || parsed.hostname === "::1" || /^127\./.test(parsed.hostname) || /^10\./.test(parsed.hostname) || /^192\.168\./.test(parsed.hostname) || /^169\.254\./.test(parsed.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") throw new Error("Base URL provider pada production harus menggunakan HTTPS.");
  if (process.env.NODE_ENV === "production" && privateHost && process.env.AI_ALLOW_PRIVATE_ENDPOINTS !== "1") throw new Error("Endpoint jaringan privat tidak diizinkan pada production.");
  return parsed.toString().replace(/\/$/, "").replace(/\/(chat\/completions|models)$/i, "");
}

export function resolveHttpAiProvider(): ResolvedHttpAiProvider {
  const provider = configuredAiProvider();
  if (provider === "codex") throw new Error("Provider Codex menggunakan App Server, bukan endpoint HTTP.");
  const preset = PROVIDER_PRESETS[provider];
  const apiKey = process.env[preset.key]?.trim() || "";
  const baseUrl = (preset.baseUrlEnv ? process.env[preset.baseUrlEnv]?.trim() : "") || preset.baseUrl;
  const model = process.env[preset.modelEnv]?.trim() || preset.model;
  if (!apiKey) throw new Error(`API key ${preset.label} belum tersedia di environment server.`);
  if (!baseUrl) throw new Error(`Base URL ${preset.label} belum tersedia di environment server.`);
  if (!model) throw new Error(`Model ${preset.label} belum tersedia di environment server.`);
  return { provider, label: preset.label, apiKey, baseUrl: validateBaseUrl(baseUrl), model };
}

export function providerEndpoint(provider: ResolvedHttpAiProvider, path: "chat/completions" | "models") {
  const suffix = `/${path}`;
  return provider.baseUrl.endsWith(suffix) ? provider.baseUrl : `${provider.baseUrl}${suffix}`;
}

export function providerHeaders(provider: ResolvedHttpAiProvider) {
  const headers: Record<string, string> = { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" };
  if (provider.provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    headers["X-OpenRouter-Title"] = "Laporan Pemberdayaan Rumah Zakat";
  }
  return headers;
}
