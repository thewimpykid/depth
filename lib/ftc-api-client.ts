import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";

const API_BASE =
  `${process.env.FTC_API_BASE_URL?.replace(/\/+$/, "") ?? "https://ftc-api.firstinspires.org"}/v2.0`;

type FetchOptions = {
  bypassCache?: boolean;
  cacheTTL?: number;
};

export type ApiIndexResponse = {
  currentSeason?: number;
  maxSeason?: number;
};

export type TeamListResponse = {
  teams?: unknown[];
  teamCountTotal?: number;
  pageCurrent?: number;
  pageTotal?: number;
};

export type EventListResponse = {
  events?: unknown[];
  eventCount?: number;
};

export type SeasonSummaryResponse = {
  eventCount?: number;
  gameName?: string | null;
  kickoff?: string | null;
  rookieStart?: number;
  teamCount?: number;
};

export type ScheduleResponse = {
  schedule?: unknown[];
};

export type MatchResultsResponse = {
  matches?: unknown[];
};

export type ScoreDetailsResponse = {
  matchScores?: unknown[];
};

export type AwardsResponse = {
  awards?: unknown[];
};

function getAuthHeader() {
  const username = process.env.FTC_API_USERNAME;
  const key = process.env.FTC_API_AUTHORIZATION_KEY;

  if (!username || !key) {
    throw new Error(
      "Missing FTC API credentials. Set FTC_API_USERNAME and FTC_API_AUTHORIZATION_KEY in .env.local",
    );
  }

  return `Basic ${Buffer.from(`${username}:${key}`, "utf8").toString("base64")}`;
}

class FTCApiClient {
  private pendingRequests = new Map<string, Promise<unknown>>();

  private async getRequestedSeason(season?: number) {
    return season ?? (await this.getCurrentSeason());
  }

  private async fetchWithCache<T>(
    path: string,
    namespace: string,
    identifier: string,
    ttl: number,
    options?: FetchOptions,
  ): Promise<T> {
    const requestKey = `${namespace}:${identifier}`;

    if (!options?.bypassCache) {
      const cached = cacheManager.get<T>(namespace, identifier);
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
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `FTC API ${response.status} for ${path}: ${text || response.statusText}`,
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

  async getApiIndex(options?: FetchOptions) {
    return this.fetchWithCache<ApiIndexResponse>("/", "meta", "index", CACHE_TTL.METADATA, options);
  }

  async getTeam(teamNumber: number, season?: number, options?: FetchOptions) {
    const requestedSeason = await this.getRequestedSeason(season);
    return this.fetchWithCache<TeamListResponse>(
      `/${requestedSeason}/teams?teamNumber=${teamNumber}`,
      "teams",
      `team-${teamNumber}-${requestedSeason}`,
      CACHE_TTL.TEAMS,
      options,
    );
  }

  async getTeamEvents(teamNumber: number, season?: number, options?: FetchOptions) {
    const requestedSeason = await this.getRequestedSeason(season);
    return this.fetchWithCache<EventListResponse>(
      `/${requestedSeason}/events?teamNumber=${teamNumber}`,
      "events",
      `team-${teamNumber}-${requestedSeason}`,
      CACHE_TTL.EVENTS,
      options,
    );
  }

  async getEventTeams(eventCode: string, season?: number, options?: FetchOptions) {
    const requestedSeason = await this.getRequestedSeason(season);
    const firstPage = await this.fetchWithCache<TeamListResponse>(
      `/${requestedSeason}/teams?eventCode=${encodeURIComponent(eventCode)}&page=1`,
      "teams",
      `event-${eventCode}-${requestedSeason}-page-1`,
      CACHE_TTL.EVENTS,
      options,
    );

    const teams = [...(firstPage.teams ?? [])];
    const pageTotal = firstPage.pageTotal ?? 1;

    if (pageTotal > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: pageTotal - 1 }, (_, index) => index + 2).map((page) =>
          this.fetchWithCache<TeamListResponse>(
            `/${requestedSeason}/teams?eventCode=${encodeURIComponent(eventCode)}&page=${page}`,
            "teams",
            `event-${eventCode}-${requestedSeason}-page-${page}`,
            CACHE_TTL.EVENTS,
            options,
          ),
        ),
      );

      for (const page of remainingPages) {
        teams.push(...(page.teams ?? []));
      }
    }

    return {
      teams,
      teamCountTotal: firstPage.teamCountTotal ?? teams.length,
      pageCurrent: 1,
      pageTotal,
    } satisfies TeamListResponse;
  }

  async getSeasonSummary(season?: number, options?: FetchOptions) {
    const requestedSeason = await this.getRequestedSeason(season);
    return this.fetchWithCache<SeasonSummaryResponse>(
      `/${requestedSeason}`,
      "meta",
      `season-${requestedSeason}`,
      CACHE_TTL.METADATA,
      options,
    );
  }

  async getSeasonEvents(season?: number, options?: FetchOptions) {
    const requestedSeason = await this.getRequestedSeason(season);
    return this.fetchWithCache<EventListResponse>(
      `/${requestedSeason}/events`,
      "events",
      `season-${requestedSeason}`,
      CACHE_TTL.EVENTS,
      options,
    );
  }

  async getHybridSchedule(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual",
    options?: FetchOptions & { season?: number },
  ) {
    const season = await this.getRequestedSeason(options?.season);
    return this.fetchWithCache<ScheduleResponse>(
      `/${season}/schedule/${encodeURIComponent(eventCode)}/${tournamentLevel}/hybrid`,
      "schedule",
      `${season}-${eventCode}-${tournamentLevel}-hybrid`,
      CACHE_TTL.SCHEDULE,
      options,
    );
  }

  async getMatches(
    eventCode: string,
    tournamentLevel: "qual" | "playoff",
    options?: FetchOptions & { teamNumber?: number; season?: number },
  ) {
    const season = await this.getRequestedSeason(options?.season);
    const params = new URLSearchParams({ tournamentLevel });
    if (options?.teamNumber) {
      params.set("teamNumber", String(options.teamNumber));
    }

    return this.fetchWithCache<MatchResultsResponse>(
      `/${season}/matches/${encodeURIComponent(eventCode)}?${params.toString()}`,
      "matches",
      `${season}-${eventCode}-${params.toString()}`,
      CACHE_TTL.SCHEDULE,
      options,
    );
  }

  async getSchedule(
    eventCode: string,
    tournamentLevel: "qual" | "playoff",
    options?: FetchOptions & { teamNumber?: number; season?: number },
  ) {
    const season = await this.getRequestedSeason(options?.season);
    const params = new URLSearchParams({ tournamentLevel });
    if (options?.teamNumber) {
      params.set("teamNumber", String(options.teamNumber));
    }

    return this.fetchWithCache<ScheduleResponse>(
      `/${season}/schedule/${encodeURIComponent(eventCode)}?${params.toString()}`,
      "schedule",
      `${season}-${eventCode}-${params.toString()}`,
      CACHE_TTL.SCHEDULE,
      options,
    );
  }

  async getScoreDetails(
    eventCode: string,
    tournamentLevel: "qual" | "playoff" = "qual",
    options?: FetchOptions & { season?: number },
  ) {
    const season = await this.getRequestedSeason(options?.season);
    return this.fetchWithCache<ScoreDetailsResponse>(
      `/${season}/scores/${encodeURIComponent(eventCode)}/${tournamentLevel}`,
      "scores",
      `${season}-${eventCode}-${tournamentLevel}`,
      CACHE_TTL.SCORES,
      options,
    );
  }

  async getTeamAwardsAtEvent(
    teamNumber: number,
    eventCode: string,
    season?: number,
    options?: FetchOptions,
  ) {
    const requestedSeason = await this.getRequestedSeason(season);
    return this.fetchWithCache<AwardsResponse>(
      `/${requestedSeason}/awards/${encodeURIComponent(eventCode)}/${teamNumber}`,
      "awards",
      `${requestedSeason}-${eventCode}-${teamNumber}`,
      CACHE_TTL.EVENTS,
      options,
    );
  }

  async getCurrentSeason() {
    const index = await this.getApiIndex();
    if (!index.currentSeason) {
      throw new Error("FTC API did not return currentSeason.");
    }
    return index.currentSeason;
  }
}

export const ftcApiClient = new FTCApiClient();
