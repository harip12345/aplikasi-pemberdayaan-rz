"use client";

const DATABASE_NAME = "rz-pemberdayaan-cache";
const STORE_NAME = "api-data";
const DATABASE_VERSION = 1;
const memoryCache = new Map<string, unknown>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const refreshedAfterBrowserReload = new Set<string>();
const browserReloadStartedAt = isBrowserReload() ? Date.now() : null;
const BROWSER_RELOAD_REFRESH_WINDOW_MS = 2_000;

type CacheRecord<T> = { key: string; value: T; storedAt: string };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readPersistentCache<T>(key: string) {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as CacheRecord<T> | undefined)?.value ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writePersistentCache<T>(key: string, value: T) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ key, value, storedAt: new Date().toISOString() } satisfies CacheRecord<T>);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

function isBrowserReload() {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === "reload";
}

function isInitialBrowserReloadPhase() {
  return browserReloadStartedAt !== null && Date.now() - browserReloadStartedAt <= BROWSER_RELOAD_REFRESH_WINDOW_MS;
}

function refreshUrl(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_refresh=1`;
}

export function getCachedJsonSnapshot<T>(key: string): T | null {
  return (memoryCache.get(key) as T | undefined) ?? null;
}

export async function fetchCachedJson<T>(key: string, url: string, forceRefresh = false): Promise<T> {
  const refreshAfterReload = !forceRefresh && isInitialBrowserReloadPhase() && !refreshedAfterBrowserReload.has(key);
  const shouldRefresh = forceRefresh || refreshAfterReload;

  if (refreshAfterReload) refreshedAfterBrowserReload.add(key);

  const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  if (!shouldRefresh) {
    if (memoryCache.has(key)) return memoryCache.get(key) as T;
    try {
      const cached = await readPersistentCache<T>(key);
      if (cached) { memoryCache.set(key, cached); return cached; }
    } catch {
      // IndexedDB dapat tidak tersedia pada mode browser tertentu; lanjutkan ke jaringan.
    }
  }

  const pendingRequest = inFlightRequests.get(key) as Promise<T> | undefined;
  if (pendingRequest) return pendingRequest;

  const request = fetch(shouldRefresh ? refreshUrl(url) : url, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Data tidak dapat dimuat.");
      memoryCache.set(key, payload);
      try { await writePersistentCache(key, payload); } catch { /* Cache persisten bersifat optimasi. */ }
      return payload as T;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, request);
  return request;
}
