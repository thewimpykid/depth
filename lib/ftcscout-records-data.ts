import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";

const FTCSCOUT_WEB_BASE =
  process.env.FTCSCOUT_WEB_BASE_URL?.replace(/\/+$/, "") ?? "https://ftcscout.org";

export type SeasonRecordsView = "teams" | "matches";
export type SeasonRankMode = "best" | "all";

export type TeamSeasonRecordRow = {
  kind: "team";
  rankBest: number | null;
  rankBestSkip: number;
  rankAll: number | null;
  rankAllSkip: number;
  teamNumber: number | null;
  teamName: string | null;
  eventCode: string | null;
  eventName: string;
  eventStart: string | null;
  eventEnd: string | null;
  npOpr: number | null;
  autoOpr: number | null;
  teleopOpr: number | null;
  npAverage: number | null;
  eventRank: number | null;
  record: string | null;
};

export type MatchSeasonRecordRow = {
  kind: "match";
  rankBest: number | null;
  rankBestSkip: number;
  rankAll: number | null;
  rankAllSkip: number;
  eventCode: string | null;
  eventName: string;
  eventStart: string | null;
  eventEnd: string | null;
  matchLabel: string;
  tournamentLevel: string | null;
  alliance: "Red" | "Blue" | null;
  totalNp: number | null;
  autoPoints: number | null;
  teleopPoints: number | null;
  teamOneNumber: number | null;
  teamOneName: string | null;
  teamTwoNumber: number | null;
  teamTwoName: string | null;
};

export type SeasonRecordsDataset = {
  count: number;
  rows: Array<TeamSeasonRecordRow | MatchSeasonRecordRow>;
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

function pickNumber(obj: Record<string, unknown> | null, keys: string[]) {
  if (!obj) return null;
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickString(obj: Record<string, unknown> | null, keys: string[]) {
  if (!obj) return null;
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function round(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

function normalizeRankSkip(value: number | null) {
  return value ?? 0;
}

function findRecordsPayload(value: unknown): { rows: unknown[]; count: number } | null {
  const obj = asObject(value);
  if (!obj) return null;

  const rows = Array.isArray(obj.rows)
    ? obj.rows
    : Array.isArray(obj.data)
      ? obj.data
      : null;
  const count = asNumber(obj.count);

  if (rows && count !== null) {
    return { rows, count };
  }

  for (const child of Object.values(obj)) {
    const nested = findRecordsPayload(child);
    if (nested) return nested;
  }

  return null;
}

function extractRecordsPayload(html: string) {
  const scriptPattern =
    /<script[^>]*type="application\/json"[^>]*data-sveltekit-fetched[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const scriptText = match[1]?.trim();
    if (!scriptText) continue;

    try {
      const outer = JSON.parse(scriptText) as { body?: string };
      if (typeof outer.body !== "string") continue;

      const inner = JSON.parse(outer.body) as { data?: unknown };
      const payload = findRecordsPayload(inner.data);
      if (payload) return payload;
    } catch {
      continue;
    }
  }

  throw new Error("Could not parse FTCScout records payload.");
}

function normalizeTeamRecordRow(raw: unknown): TeamSeasonRecordRow | null {
  const obj = asObject(raw);
  const data = asObject(obj?.data);
  const team = asObject(data?.team);
  const event = asObject(data?.event);
  const stats = asObject(data?.stats);
  const avg = asObject(stats?.avg);
  const opr = asObject(stats?.opr);

  if (!data || !team || !event || !stats) return null;

  const wins = pickNumber(stats, ["wins"]);
  const losses = pickNumber(stats, ["losses"]);
  const ties = pickNumber(stats, ["ties"]);

  return {
    kind: "team",
    rankBest: pickNumber(obj, ["filterRank"]),
    rankBestSkip: normalizeRankSkip(pickNumber(obj, ["filterSkipRank"])),
    rankAll: pickNumber(obj, ["noFilterRank"]),
    rankAllSkip: normalizeRankSkip(pickNumber(obj, ["noFilterSkipRank"])),
    teamNumber: pickNumber(data, ["teamNumber"]) ?? pickNumber(team, ["number"]),
    teamName: pickString(team, ["name"]),
    eventCode: pickString(data, ["eventCode"]) ?? pickString(event, ["code"]),
    eventName: pickString(event, ["name"]) ?? "Unknown event",
    eventStart: pickString(event, ["start"]),
    eventEnd: pickString(event, ["end"]),
    npOpr: round(pickNumber(opr, ["totalPointsNp"])),
    autoOpr: round(pickNumber(opr, ["autoPoints"])),
    teleopOpr: round(pickNumber(opr, ["dcPoints"])),
    npAverage: round(pickNumber(avg, ["totalPointsNp"]) ?? pickNumber(stats, ["tb1"])),
    eventRank: pickNumber(stats, ["rank"]),
    record:
      wins !== null && losses !== null && ties !== null ? `${wins}-${losses}-${ties}` : null,
  };
}

function normalizeMatchRecordRow(raw: unknown): MatchSeasonRecordRow | null {
  const obj = asObject(raw);
  const data = asObject(obj?.data);
  const match = asObject(data?.match);
  const event = asObject(match?.event);
  const scores = asObject(match?.scores);
  const allianceName = pickString(data, ["alliance"]);

  if (!data || !match || !event || !scores) return null;

  const selectedAlliance =
    allianceName?.toLowerCase() === "red"
      ? "Red"
      : allianceName?.toLowerCase() === "blue"
        ? "Blue"
        : null;

  const allianceScores = asObject(
    selectedAlliance === "Red" ? scores.red : selectedAlliance === "Blue" ? scores.blue : null,
  );

  const allianceTeams = asArray(match.teams)
    .map(asObject)
    .filter((team): team is Record<string, unknown> => team !== null)
    .filter((team) => pickString(team, ["alliance"]) === selectedAlliance)
    .sort((a, b) => {
      const aStation = pickString(a, ["station"]) ?? "";
      const bStation = pickString(b, ["station"]) ?? "";
      return aStation.localeCompare(bStation);
    });

  const teamOne = allianceTeams[0] ? asObject(allianceTeams[0].team) : null;
  const teamTwo = allianceTeams[1] ? asObject(allianceTeams[1].team) : null;

  return {
    kind: "match",
    rankBest: pickNumber(obj, ["filterRank"]),
    rankBestSkip: normalizeRankSkip(pickNumber(obj, ["filterSkipRank"])),
    rankAll: pickNumber(obj, ["noFilterRank"]),
    rankAllSkip: normalizeRankSkip(pickNumber(obj, ["noFilterSkipRank"])),
    eventCode: pickString(match, ["eventCode"]) ?? pickString(event, ["code"]),
    eventName: pickString(event, ["name"]) ?? "Unknown event",
    eventStart: pickString(event, ["start"]),
    eventEnd: pickString(event, ["end"]),
    matchLabel: pickString(match, ["description"]) ?? "Match",
    tournamentLevel: pickString(match, ["tournamentLevel"]),
    alliance: selectedAlliance,
    totalNp: round(pickNumber(allianceScores, ["totalPointsNp"])),
    autoPoints: round(pickNumber(allianceScores, ["autoPoints"])),
    teleopPoints: round(pickNumber(allianceScores, ["dcPoints"])),
    teamOneNumber:
      pickNumber(allianceTeams[0], ["teamNumber"]) ?? pickNumber(teamOne, ["number"]),
    teamOneName: pickString(teamOne, ["name"]),
    teamTwoNumber:
      pickNumber(allianceTeams[1], ["teamNumber"]) ?? pickNumber(teamTwo, ["number"]),
    teamTwoName: pickString(teamTwo, ["name"]),
  };
}

function normalizeRows(view: SeasonRecordsView, rows: unknown[]) {
  if (view === "teams") {
    return rows
      .map(normalizeTeamRecordRow)
      .filter((row): row is TeamSeasonRecordRow => row !== null);
  }

  return rows
    .map(normalizeMatchRecordRow)
    .filter((row): row is MatchSeasonRecordRow => row !== null);
}

async function fetchOnePage(
  season: number,
  view: SeasonRecordsView,
  skip: number,
): Promise<SeasonRecordsDataset | null> {
  const url = `${FTCSCOUT_WEB_BASE}/records/${season}/${view}${skip > 0 ? `?skip=${skip}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "depth/0.1 (+https://ftcscout.org)",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = await response.text();
  try {
    const parsed = extractRecordsPayload(html);
    return { count: parsed.count, rows: normalizeRows(view, parsed.rows) };
  } catch {
    return null;
  }
}

export async function getSeasonRecords(season: number, view: SeasonRecordsView) {
  const cacheKey = `v2:${season}:${view}`;
  const cached = await cacheManager.get<SeasonRecordsDataset>("ftcscout-records", cacheKey);
  if (cached) return cached;

  const response = await fetch(`${FTCSCOUT_WEB_BASE}/records/${season}/${view}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "depth/0.1 (+https://ftcscout.org)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FTCScout records request failed with ${response.status}.`);
  }

  const html = await response.text();
  const parsed = extractRecordsPayload(html);
  const dataset: SeasonRecordsDataset = {
    count: parsed.count,
    rows: normalizeRows(view, parsed.rows),
  };

  cacheManager.set("ftcscout-records", cacheKey, dataset, CACHE_TTL.EVENTS);
  return dataset;
}

export async function getSeasonRecordsTopN(
  season: number,
  view: SeasonRecordsView,
  target: number,
): Promise<SeasonRecordsDataset> {
  const cacheKey = `v2:top${target}:${season}:${view}`;
  const cached = await cacheManager.get<SeasonRecordsDataset>("ftcscout-records", cacheKey);
  if (cached) return cached;

  const first = await getSeasonRecords(season, view);
  const pageSize = first.rows.length;

  if (pageSize === 0 || pageSize >= target) {
    return first;
  }

  // Fetch remaining pages concurrently
  const totalNeeded = Math.min(target, first.count);
  const skips: number[] = [];
  for (let skip = pageSize; skip < totalNeeded; skip += pageSize) {
    skips.push(skip);
  }

  const pages = await Promise.all(skips.map((skip) => fetchOnePage(season, view, skip)));
  const allRows = [
    ...first.rows,
    ...pages.flatMap((p) => p?.rows ?? []),
  ].slice(0, target);

  const result: SeasonRecordsDataset = { count: first.count, rows: allRows };
  cacheManager.set("ftcscout-records", cacheKey, result, CACHE_TTL.EVENTS);
  return result;
}

/**
 * Fetches `target` team records sampled evenly across the full ranking range,
 * so the scatter plot shows the complete OPR distribution (not just top performers).
 */
export async function getSeasonRecordsSpread(
  season: number,
  view: SeasonRecordsView,
  target: number,
): Promise<SeasonRecordsDataset> {
  const cacheKey = `v2:spread${target}:${season}:${view}`;
  const cached = await cacheManager.get<SeasonRecordsDataset>("ftcscout-records", cacheKey);
  if (cached) return cached;

  // First page to learn page size + total count
  const first = await getSeasonRecords(season, view);
  const pageSize = first.rows.length;

  if (pageSize === 0) return first;

  const totalCount = first.count;

  // If we have fewer teams than target, just return everything
  if (totalCount <= target) {
    return getSeasonRecordsTopN(season, view, totalCount);
  }

  // Generate skip values spread evenly across [0, totalCount)
  const pagesNeeded = Math.ceil(target / pageSize);
  const totalPages = Math.ceil(totalCount / pageSize);
  const step = totalPages / pagesNeeded;

  const skips: number[] = [];
  for (let i = 0; i < pagesNeeded; i++) {
    const pageIndex = Math.round(i * step);
    const skip = pageIndex * pageSize;
    if (skip > 0 && skip < totalCount) skips.push(skip);
  }

  const pages = await Promise.all(skips.map((skip) => fetchOnePage(season, view, skip)));
  const allRows = [
    ...first.rows,
    ...pages.flatMap((p) => p?.rows ?? []),
  ].slice(0, target);

  const result: SeasonRecordsDataset = { count: totalCount, rows: allRows };
  cacheManager.set("ftcscout-records", cacheKey, result, CACHE_TTL.EVENTS);
  return result;
}
