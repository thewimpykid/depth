import "server-only";

import { getFromSupabase, setInSupabase } from "./supabase-cache";

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

// Namespaces that survive server restarts via Supabase.
// Excludes live data (schedule, scores) with short TTLs.
const PERSISTENT_NAMESPACES = new Set([
  "scatter",
  "ftcscout-records",
  "search-index",
  "meta",
  "ftcscout",
  "events",
  "teams",
  "teams-index",
]);

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
  async get<T>(namespace: string, identifier: string): Promise<T | null> {
    cleanupExpired();

    const key = getCacheKey(namespace, identifier);
    const cached = memoryCache.get(key);
    if (cached && isValid(cached)) return cached.data as T;

    if (PERSISTENT_NAMESPACES.has(namespace)) {
      const remote = await getFromSupabase<T>(key);
      if (remote !== null) {
        memoryCache.set(key, {
          data: remote.data,
          timestamp: Date.now(),
          ttl: remote.remainingTtl,
        });
        return remote.data;
      }
    }

    return null;
  },

  set<T>(namespace: string, identifier: string, data: T, ttl: number) {
    const key = getCacheKey(namespace, identifier);
    memoryCache.set(key, { data, timestamp: Date.now(), ttl });

    if (PERSISTENT_NAMESPACES.has(namespace)) {
      setInSupabase(key, data, ttl);
    }
  },

  invalidate(namespace: string, identifier: string) {
    memoryCache.delete(getCacheKey(namespace, identifier));
  },
};
