import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";

const API_BASE =
  process.env.FTCSCOUT_API_BASE_URL?.replace(/\/+$/, "") ??
  "https://api.ftcscout.org/rest/v1";

type FetchOptions = {
  bypassCache?: boolean;
  cacheTTL?: number;
};

export type ScoutQuickStatsResponse = {
  season?: number;
  number?: number;
  tot?: { value?: number; rank?: number };
  auto?: { value?: number; rank?: number };
  dc?: { value?: number; rank?: number };
  eg?: { value?: number; rank?: number };
  count?: number;
};

export type ScoutTeamEventsResponse = {
  value?: unknown[];
  Count?: number;
};

export type ScoutTeamsSearchResponse = {
  value?: unknown[];
};

class FTCScoutApiClient {
  private pendingRequests = new Map<string, Promise<unknown>>();

  private async fetchWithCache<T>(
    path: string,
    namespace: string,
    identifier: string,
    ttl: number,
    options?: FetchOptions,
  ): Promise<T> {
    const requestKey = `${namespace}:${identifier}`;

    if (!options?.bypassCache) {
      const cached = await cacheManager.get<T>(namespace, identifier);
      if (cached !== null) {
        return cached;
      }
    }

    const pending = this.pendingRequests.get(requestKey);
    if (pending) {
      return pending as Promise<T>;
    }

    const request = (async () => {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `FTCScout API ${response.status} for ${path}: ${text || response.statusText}`,
        );
      }

      const data = (await response.json()) as T;
      cacheManager.set(namespace, identifier, data, options?.cacheTTL ?? ttl);
      return data;
    })().finally(() => {
      this.pendingRequests.delete(requestKey);
    });

    this.pendingRequests.set(requestKey, request);
    return request;
  }

  async getTeamQuickStats(
    teamNumber: number,
    season: number,
    options?: FetchOptions,
  ) {
    return this.fetchWithCache<ScoutQuickStatsResponse>(
      `/teams/${teamNumber}/quick-stats?season=${season}`,
      "ftcscout",
      `team-${teamNumber}-quick-stats-${season}`,
      CACHE_TTL.EVENTS,
      options,
    );
  }

  async getTeamEvents(
    teamNumber: number,
    season: number,
    options?: FetchOptions,
  ) {
    return this.fetchWithCache<ScoutTeamEventsResponse>(
      `/teams/${teamNumber}/events/${season}`,
      "ftcscout",
      `team-${teamNumber}-events-${season}`,
      CACHE_TTL.EVENTS,
      options,
    );
  }

  async getTeamSearchIndex(options?: FetchOptions) {
    return this.fetchWithCache<ScoutTeamsSearchResponse>(
      "/teams/search",
      "ftcscout",
      "teams-search-index",
      3600,
      options,
    );
  }
}

export const ftcScoutApiClient = new FTCScoutApiClient();
