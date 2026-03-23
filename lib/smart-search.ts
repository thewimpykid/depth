import "server-only";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { cacheManager } from "@/lib/cache-manager";

export type SearchScope = "teams" | "events" | "mixed";

export type SearchSuggestion = {
  type: "team" | "event";
  key: string;
  title: string;
  subtitle: string | null;
  season: number;
  teamNumber?: number;
  eventCode?: string;
};

type TeamIndexEntry = {
  teamNumber: number;
  title: string;
  subtitle: string | null;
  haystack: string;
};

type EventIndexEntry = {
  eventCode: string;
  season: number;
  title: string;
  subtitle: string | null;
  haystack: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function compactText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ");
}

function formatLocation(parts: Array<string | null | undefined>) {
  const filtered = parts.filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return filtered.length > 0 ? filtered.join(", ") : null;
}

function normalizeEvent(raw: unknown, season: number): EventIndexEntry | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const eventCode = pickString(obj, ["code", "eventCode"]);
  if (!eventCode) return null;

  const title = pickString(obj, ["name", "eventName"]) ?? eventCode;
  const subtitle = formatLocation([
    pickString(obj, ["venue"]),
    pickString(obj, ["city"]),
    pickString(obj, ["stateprov", "stateProv"]),
    pickString(obj, ["country"]),
  ]);

  return {
    eventCode,
    season,
    title,
    subtitle,
    haystack: compactText([eventCode, title, subtitle]).toLowerCase(),
  };
}

function normalizeTeam(raw: unknown): TeamIndexEntry | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const teamNumber = pickNumber(obj, ["number", "teamNumber"]);
  if (teamNumber === null) return null;

  const title = pickString(obj, ["name", "nameShort", "schoolName"]) ?? `Team ${teamNumber}`;
  const subtitle = formatLocation([
    pickString(obj, ["schoolName"]),
    pickString(obj, ["city"]),
    pickString(obj, ["state", "stateProv"]),
    pickString(obj, ["country"]),
  ]);

  return {
    teamNumber,
    title,
    subtitle,
    haystack: compactText([String(teamNumber), title, subtitle]).toLowerCase(),
  };
}

function scoreEntry(haystack: string, exactKey: string, query: string, secondaryKey?: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return -1;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const words = haystack.split(/\s+/);
  let score = 0;

  for (const token of tokens) {
    if (exactKey === token) {
      score += 14;
    } else if (exactKey.startsWith(token)) {
      score += 10;
    } else if (secondaryKey && secondaryKey === token) {
      score += 12;
    } else if (secondaryKey && secondaryKey.startsWith(token)) {
      score += 8;
    } else if (haystack.includes(token)) {
      score += 3;
      // Extra boost when token matches the start of any word in the haystack
      if (words.some((word) => word.startsWith(token))) {
        score += 3;
      }
    } else {
      return -1;
    }
  }

  if (haystack.startsWith(normalized)) {
    score += 6;
  }

  return score;
}

async function getTeamIndex(season: number): Promise<TeamIndexEntry[]> {
  const cacheKey = `team-index-${season}`;
  const cached = cacheManager.get<TeamIndexEntry[]>("search-index", cacheKey);
  if (cached !== null) return cached;

  const firstPage = await ftcApiClient.getTeamIndexPage(season, 1);
  const allTeams: unknown[] = [...asArray(firstPage.teams)];
  const pageTotal = Math.min(firstPage.pageTotal ?? 1, 200);

  if (pageTotal > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pageTotal - 1 }, (_, i) => i + 2).map((p) =>
        ftcApiClient.getTeamIndexPage(season, p).then((r) => asArray(r.teams)).catch(() => [] as unknown[]),
      ),
    );
    for (const teams of remaining) allTeams.push(...teams);
  }

  const index = allTeams.map(normalizeTeam).filter((t): t is TeamIndexEntry => t !== null);
  cacheManager.set("search-index", cacheKey, index, 3600);
  return index;
}

async function getEventIndex(season: number) {
  const response = await ftcApiClient.getSeasonEvents(season);
  return asArray(response.events)
    .map((event) => normalizeEvent(event, season))
    .filter((event): event is EventIndexEntry => event !== null);
}

export async function getSearchSuggestions(
  query: string,
  scope: SearchScope,
  season: number,
  limit = 8,
): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: Array<SearchSuggestion & { score: number }> = [];

  if (scope === "teams" || scope === "mixed") {
    const teams = await getTeamIndex(season);
    for (const team of teams) {
      const score = scoreEntry(team.haystack, String(team.teamNumber), trimmed, team.title.toLowerCase());
      if (score < 0) continue;

      results.push({
        type: "team",
        key: `team-${team.teamNumber}`,
        title: team.title,
        subtitle: team.subtitle,
        season,
        teamNumber: team.teamNumber,
        score,
      });
    }
  }

  if (scope === "events" || scope === "mixed") {
    const events = await getEventIndex(season);
    for (const event of events) {
      const score = scoreEntry(event.haystack, event.eventCode.toLowerCase(), trimmed);
      if (score < 0) continue;

      results.push({
        type: "event",
        key: `event-${event.eventCode}`,
        title: event.title,
        subtitle: event.subtitle,
        season: event.season,
        eventCode: event.eventCode,
        score,
      });
    }
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map((entry) => {
      const { score, ...suggestion } = entry;
      void score;
      return suggestion;
    });
}
