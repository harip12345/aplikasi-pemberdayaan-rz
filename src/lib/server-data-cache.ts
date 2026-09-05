type ServerCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const serverCache = new Map<string, ServerCacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export async function getServerCachedData<T>(
  key: string,
  loader: () => Promise<T>,
  forceRefresh = false,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = serverCache.get(key) as ServerCacheEntry<T> | undefined;
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  const request = loader()
    .then((value) => {
      serverCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, request);
  return request;
}

export function isForcedDataRefresh(request: Request) {
  return new URL(request.url).searchParams.get("_refresh") === "1";
}
