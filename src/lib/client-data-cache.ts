"use client";

const DATABASE_NAME = "rz-pemberdayaan-cache";
const STORE_NAME = "api-data";
const DATABASE_VERSION = 1;
const REVALIDATE_AFTER_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const memoryCache = new Map<string, CacheRecord<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const subscribers = new Map<string, Set<(value: unknown) => void>>();

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
  return new Promise<CacheRecord<T> | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as CacheRecord<T> | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writePersistentCache<T>(record: CacheRecord<T>) {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

function refreshUrl(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_refresh=1`;
}

export function getCachedJsonSnapshot<T>(key: string): T | null {
  return (memoryCache.get(key)?.value as T | undefined) ?? null;
}

function isStale(record: CacheRecord<unknown>) {
  const storedAt = Date.parse(record.storedAt);
  return !Number.isFinite(storedAt) || Date.now() - storedAt >= REVALIDATE_AFTER_MS;
}

function requestFreshJson<T>(key: string, url: string, forceRefresh: boolean): Promise<T> {
  const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;
  const request = fetch(forceRefresh ? refreshUrl(url) : url, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Data tidak dapat dimuat.");
      const record = { key, value: payload as T, storedAt: new Date().toISOString() };
      memoryCache.set(key, record);
      subscribers.get(key)?.forEach((callback) => callback(payload));
      try { await writePersistentCache(record); } catch { /* Cache persisten bersifat optimasi. */ }
      return payload as T;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, request);
  return request;
}

export async function fetchCachedJson<T>(key: string, url: string, forceRefresh = false): Promise<T> {
  if (forceRefresh) return requestFreshJson<T>(key, url, true);

  let cached = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (!cached) {
    try {
      cached = await readPersistentCache<T>(key) ?? undefined;
      if (cached) memoryCache.set(key, cached);
    } catch {
      // IndexedDB dapat tidak tersedia pada mode browser tertentu; lanjutkan ke jaringan.
    }
  }

  if (cached) {
    if (isStale(cached)) void requestFreshJson<T>(key, url, false).catch(() => undefined);
    return cached.value;
  }
  return requestFreshJson<T>(key, url, false);
}

export function subscribeCachedJson<T>(key: string, url: string, onUpdate: (value: T) => void) {
  const callbacks = subscribers.get(key) ?? new Set<(value: unknown) => void>();
  const callback = onUpdate as (value: unknown) => void;
  callbacks.add(callback);
  subscribers.set(key, callbacks);

  const revalidateIfVisible = () => {
    if (document.visibilityState === "visible") void fetchCachedJson<T>(key, url).catch(() => undefined);
  };
  const timer = window.setInterval(revalidateIfVisible, CHECK_INTERVAL_MS);
  window.addEventListener("focus", revalidateIfVisible);
  document.addEventListener("visibilitychange", revalidateIfVisible);

  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) subscribers.delete(key);
    window.clearInterval(timer);
    window.removeEventListener("focus", revalidateIfVisible);
    document.removeEventListener("visibilitychange", revalidateIfVisible);
  };
}
