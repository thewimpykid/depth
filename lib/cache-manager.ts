import "server-only";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type GlobalWithDepthCache = typeof globalThis & {
  __depthCache?: Map<string, CacheEntry<unknown>>;
};

const globalCache = globalThis as GlobalWithDepthCache;
const memoryCache = globalCache.__depthCache ?? new Map<string, CacheEntry<unknown>>();

if (!globalCache.__depthCache) {
  globalCache.__depthCache = memoryCache;
}

export const CACHE_TTL = {
  METADATA: 300,
  EVENTS: 300,
  TEAMS: 600,
  SCHEDULE: 30,
  SCORES: 30,
} as const;

function getCacheKey(namespace: string, identifier: string) {
  return `depth:${namespace}:${identifier}`;
}

function isValid(entry: CacheEntry<unknown>) {
  return (Date.now() - entry.timestamp) / 1000 < entry.ttl;
}

function cleanupExpired() {
  for (const [key, entry] of memoryCache.entries()) {
    if (!isValid(entry)) {
      memoryCache.delete(key);
    }
  }
}

export const cacheManager = {
  get<T>(namespace: string, identifier: string): T | null {
    cleanupExpired();

    const cached = memoryCache.get(getCacheKey(namespace, identifier));
    if (!cached || !isValid(cached)) return null;

    return cached.data as T;
  },

  set<T>(namespace: string, identifier: string, data: T, ttl: number) {
    memoryCache.set(getCacheKey(namespace, identifier), {
      data,
      timestamp: Date.now(),
      ttl,
    });
  },

  invalidate(namespace: string, identifier: string) {
    memoryCache.delete(getCacheKey(namespace, identifier));
  },
};
