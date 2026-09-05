const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function fetchGoogleSheetCsv(url: string, attempts = 3) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response.text();
      lastError = new Error(`Google Sheets merespons dengan status ${response.status}.`);
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Google Sheets tidak dapat dihubungi.");
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw lastError ?? new Error("Google Sheets tidak dapat dihubungi.");
}
