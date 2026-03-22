import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";
import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";
import type { RankedValue, TeamQuickStats } from "@/lib/ftc";
import type { TeamSnapshot } from "@/lib/team-analysis";

export type EventSearchResult = {
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  location: string | null;
};

export type ActualEventMatch = {
  key: string;
  matchNumber: number;
  label: string;
  redAlliance: EventSimulationTeam[];
  blueAlliance: EventSimulationTeam[];
  predictedRedScore: number;
  predictedBlueScore: number;
  redWinProbability: number;
  blueWinProbability: number;
  actualRedScore: number | null;
  actualBlueScore: number | null;
  status: "played" | "upcoming";
};

export type EventSimulationTeam = {
  teamNumber: number;
  name: string | null;
  strength: number;
};

export type ActualEventStanding = {
  teamNumber: number;
  name: string | null;
  strength: number;
  averageSeed: number;
  expectedWins: number;
  expectedLosses: number;
  expectedTies: number;
  firstSeedProbability: number;
  topFourProbability: number;
  averageScoreFor: number;
  lockedWins: number;
  lockedLosses: number;
  lockedTies: number;
};

export type ActualEventSimulationResult = {
  season: number;
  event: EventSearchResult;
  teams: TeamSnapshot[];
  matches: ActualEventMatch[];
  standings: ActualEventStanding[];
  simulations: number;
  totalQualMatches: number;
  playedQualMatches: number;
  remainingQualMatches: number;
};

type TeamProfile = {
  teamNumber: number;
  name: string | null;
  organization: string | null;
  rookieYear: number | null;
  location: string | null;
};

type WorkingStanding = {
  teamNumber: number;
  wins: number;
  losses: number;
  ties: number;
  scoreFor: number;
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

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatLocation(parts: Array<string | null | undefined>) {
  const filtered = parts.filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return filtered.length > 0 ? filtered.join(", ") : null;
}

function normalizeEvent(raw: unknown): EventSearchResult | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const code = pickString(obj, ["code", "eventCode"]);
  if (!code) return null;

  return {
    code,
    name: pickString(obj, ["name", "eventName"]) ?? code,
    start: pickString(obj, ["dateStart", "start", "startDate"]),
    end: pickString(obj, ["dateEnd", "end", "endDate"]),
    location: formatLocation([
      pickString(obj, ["venue"]),
      pickString(obj, ["city"]),
      pickString(obj, ["stateprov", "stateProv"]),
      pickString(obj, ["country"]),
    ]),
  };
}

function normalizeTeam(raw: unknown): TeamProfile | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const teamNumber = pickNumber(obj, ["teamNumber", "number"]);
  if (teamNumber === null) return null;

  const nameShort = pickString(obj, ["nameShort", "teamName"]);
  const nameFull = pickString(obj, ["nameFull"]);
  const schoolName = pickString(obj, ["schoolName"]);

  return {
    teamNumber,
    name: nameShort ?? nameFull ?? schoolName ?? null,
    organization:
      (nameFull && nameFull !== nameShort ? nameFull : null) ?? schoolName ?? null,
    rookieYear: pickNumber(obj, ["rookieYear"]),
    location:
      pickString(obj, ["displayLocation"]) ??
      formatLocation([
        pickString(obj, ["city"]),
        pickString(obj, ["stateProv", "stateprov"]),
        pickString(obj, ["country"]),
      ]),
  };
}

function formatPercentile(rank: number | null, count: number | null) {
  if (!rank || !count || count <= 0) return null;
  return round(((count - rank) / count) * 100, 2);
}

function normalizeRankedValue(
  raw: Record<string, unknown> | null,
  count: number | null,
): RankedValue {
  const value = raw ? asNumber(raw.value) : null;
  const rank = raw ? asNumber(raw.rank) : null;

  return {
    value: value === null ? null : round(value),
    rank,
    percentile: formatPercentile(rank, count),
  };
}

function normalizeQuickStats(raw: unknown): TeamQuickStats | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const comparedAgainst = asNumber(obj.count);
  return {
    total: normalizeRankedValue(asObject(obj.tot), comparedAgainst),
    auto: normalizeRankedValue(asObject(obj.auto), comparedAgainst),
    teleop: normalizeRankedValue(asObject(obj.dc), comparedAgainst),
    endgame: normalizeRankedValue(asObject(obj.eg), comparedAgainst),
    comparedAgainst,
  };
}

function eventSearchScore(event: EventSearchResult, query: string) {
  const haystack = [event.code, event.name, event.location ?? ""].join(" ").toLowerCase();
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    if (event.code.toLowerCase() === token) {
      score += 12;
    } else if (event.code.toLowerCase().startsWith(token)) {
      score += 8;
    } else if (event.name.toLowerCase().includes(token)) {
      score += 5;
    } else if (haystack.includes(token)) {
      score += 2;
    } else {
      return -1;
    }
  }

  return score;
}

function hashString(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seedText: string) {
  let seed = hashString(seedText);

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createGaussianSampler(rng: () => number) {
  let spare: number | null = null;

  return (mean = 0, stdDev = 1) => {
    if (spare !== null) {
      const next = spare;
      spare = null;
      return mean + next * stdDev;
    }

    let u = 0;
    let v = 0;
    let s = 0;

    while (s === 0 || s >= 1) {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    }

    const multiplier = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * multiplier;
    return mean + u * multiplier * stdDev;
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function getAllianceTeams(rawTeams: unknown[]) {
  const teams = rawTeams
    .map((rawTeam) => {
      const teamObj = asObject(rawTeam);
      if (!teamObj) return null;

      const teamNumber = pickNumber(teamObj, ["teamNumber", "team", "number"]);
      if (teamNumber === null) return null;

      return {
        teamNumber,
        teamName: pickString(teamObj, ["teamName", "nameShort", "nameFull"]),
        station: (pickString(teamObj, ["station", "alliance"]) ?? "").toLowerCase(),
      };
    })
    .filter(
      (
        team,
      ): team is {
        teamNumber: number;
        teamName: string | null;
        station: string;
      } => team !== null,
    );

  const redAlliance = teams
    .filter((team) => team.station.startsWith("red"))
    .map(({ teamNumber, teamName }) => ({ teamNumber, name: teamName }));
  const blueAlliance = teams
    .filter((team) => team.station.startsWith("blue"))
    .map(({ teamNumber, teamName }) => ({ teamNumber, name: teamName }));

  return { redAlliance, blueAlliance };
}

function buildPrediction(
  redAlliance: EventSimulationTeam[],
  blueAlliance: EventSimulationTeam[],
  scale: number,
) {
  const predictedRedScore = round(redAlliance.reduce((sum, team) => sum + team.strength, 0));
  const predictedBlueScore = round(blueAlliance.reduce((sum, team) => sum + team.strength, 0));
  const redProbability =
    1 / (1 + Math.exp(-(predictedRedScore - predictedBlueScore) / scale));

  return {
    predictedRedScore,
    predictedBlueScore,
    redWinProbability: round(redProbability * 100, 1),
    blueWinProbability: round((1 - redProbability) * 100, 1),
  };
}

function createWorkingStandings(teams: TeamSnapshot[]) {
  const standings = new Map<number, WorkingStanding>();

  for (const team of teams) {
    standings.set(team.teamNumber, {
      teamNumber: team.teamNumber,
      wins: 0,
      losses: 0,
      ties: 0,
      scoreFor: 0,
    });
  }

  return standings;
}

function applyResult(
  standings: Map<number, WorkingStanding>,
  teams: EventSimulationTeam[],
  scoreFor: number,
  scoreAgainst: number,
) {
  const won = scoreFor > scoreAgainst;
  const lost = scoreFor < scoreAgainst;

  for (const team of teams) {
    const row = standings.get(team.teamNumber);
    if (!row) continue;

    row.scoreFor += scoreFor;
    if (won) {
      row.wins += 1;
    } else if (lost) {
      row.losses += 1;
    } else {
      row.ties += 1;
    }
  }
}

function sortStandings(rows: WorkingStanding[]) {
  return [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.ties !== a.ties) return b.ties - a.ties;
    if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
    return a.teamNumber - b.teamNumber;
  });
}

async function getEventTeamSnapshots(eventCode: string, season: number) {
  const cacheKey = `event-roster:${season}:${eventCode.toUpperCase()}`;
  const cached = cacheManager.get<TeamSnapshot[]>("analysis", cacheKey);
  if (cached) {
    return cached;
  }

  const eventTeamsResponse = await ftcApiClient.getEventTeams(eventCode, season);
  const teams = asArray(eventTeamsResponse.teams)
    .map(normalizeTeam)
    .filter((team): team is TeamProfile => team !== null)
    .sort((a, b) => a.teamNumber - b.teamNumber);

  const snapshots = await mapWithConcurrency(teams, 6, async (team) => {
    const quickStatsResponse = await ftcScoutApiClient
      .getTeamQuickStats(team.teamNumber, season)
      .catch(() => null);
    const quickStats = normalizeQuickStats(quickStatsResponse);

    return {
      teamNumber: team.teamNumber,
      season,
      name: team.name,
      organization: team.organization,
      rookieYear: team.rookieYear,
      location: team.location,
      eventCount: 0,
      quickStats,
      strength: quickStats?.total.value ?? null,
    } satisfies TeamSnapshot;
  });

  cacheManager.set("analysis", cacheKey, snapshots, CACHE_TTL.EVENTS);
  return snapshots;
}

function parseActualEventMatches(
  rawRows: unknown[],
  strengthByTeam: Map<number, TeamSnapshot>,
  fallbackStrength: number,
) {
  const probabilityScale = Math.max(14, fallbackStrength * 0.28);

  return rawRows
    .map((rawRow) => {
      const obj = asObject(rawRow);
      if (!obj) return null;

      const matchNumber = pickNumber(obj, ["matchNumber", "number"]);
      if (matchNumber === null) return null;

      const alliances = getAllianceTeams(asArray(obj.teams));
      if (alliances.redAlliance.length < 2 || alliances.blueAlliance.length < 2) {
        return null;
      }

      const redAlliance = alliances.redAlliance.map((team) => ({
        teamNumber: team.teamNumber,
        name: team.name ?? strengthByTeam.get(team.teamNumber)?.name ?? null,
        strength: strengthByTeam.get(team.teamNumber)?.strength ?? fallbackStrength,
      }));
      const blueAlliance = alliances.blueAlliance.map((team) => ({
        teamNumber: team.teamNumber,
        name: team.name ?? strengthByTeam.get(team.teamNumber)?.name ?? null,
        strength: strengthByTeam.get(team.teamNumber)?.strength ?? fallbackStrength,
      }));

      const prediction = buildPrediction(redAlliance, blueAlliance, probabilityScale);
      const actualRedScore = pickNumber(obj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]);
      const actualBlueScore = pickNumber(obj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]);

      return {
        key: `qual-${matchNumber}-${redAlliance.map((team) => team.teamNumber).join("-")}-${blueAlliance
          .map((team) => team.teamNumber)
          .join("-")}`,
        matchNumber,
        label:
          pickString(obj, ["description"]) ??
          `Qual ${matchNumber}`,
        redAlliance,
        blueAlliance,
        ...prediction,
        actualRedScore,
        actualBlueScore,
        status:
          actualRedScore !== null && actualBlueScore !== null ? "played" : "upcoming",
      } satisfies ActualEventMatch;
    })
    .filter((row): row is ActualEventMatch => row !== null)
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

export async function searchSeasonEvents(season: number, query: string, limit = 12) {
  const seasonEvents = await ftcApiClient.getSeasonEvents(season);
  const normalizedEvents = asArray(seasonEvents.events)
    .map(normalizeEvent)
    .filter((event): event is EventSearchResult => event !== null);

  const trimmed = query.trim();
  if (!trimmed) {
    return [] as EventSearchResult[];
  }

  return normalizedEvents
    .map((event) => ({
      event,
      score: eventSearchScore(event, trimmed),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.event.start ? new Date(a.event.start).getTime() : 0;
      const bTime = b.event.start ? new Date(b.event.start).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit)
    .map((entry) => entry.event);
}

export async function getSeasonEventByCode(season: number, eventCode: string) {
  const seasonEvents = await ftcApiClient.getSeasonEvents(season);
  return (
    asArray(seasonEvents.events)
      .map(normalizeEvent)
      .filter((event): event is EventSearchResult => event !== null)
      .find((event) => event.code.toUpperCase() === eventCode.toUpperCase()) ?? null
  );
}

export async function simulateActualEvent(
  season: number,
  eventCode: string,
  simulations: number,
): Promise<ActualEventSimulationResult | null> {
  const [event, teams, hybridSchedule] = await Promise.all([
    getSeasonEventByCode(season, eventCode),
    getEventTeamSnapshots(eventCode, season),
    ftcApiClient
      .getHybridSchedule(eventCode, "qual", { season })
      .catch(() => ({ schedule: [] })),
  ]);

  if (!event) {
    return null;
  }

  const strengths = teams
    .map((team) => team.strength)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const fallbackStrength =
    strengths.length > 0
      ? round(strengths.reduce((sum, value) => sum + value, 0) / strengths.length, 2)
      : 80;

  const strengthByTeam = new Map<number, TeamSnapshot>(
    teams.map((team) => [team.teamNumber, team]),
  );

  const matches = parseActualEventMatches(asArray(hybridSchedule.schedule), strengthByTeam, fallbackStrength);
  const playedMatches = matches.filter((match) => match.status === "played");
  const remainingMatches = matches.filter((match) => match.status === "upcoming");

  const lockedStandings = createWorkingStandings(teams);
  for (const match of playedMatches) {
    applyResult(
      lockedStandings,
      match.redAlliance,
      match.actualRedScore ?? 0,
      match.actualBlueScore ?? 0,
    );
    applyResult(
      lockedStandings,
      match.blueAlliance,
      match.actualBlueScore ?? 0,
      match.actualRedScore ?? 0,
    );
  }

  const summaries = new Map<number, ActualEventStanding>();
  for (const team of teams) {
    const locked = lockedStandings.get(team.teamNumber);
    summaries.set(team.teamNumber, {
      teamNumber: team.teamNumber,
      name: team.name,
      strength: team.strength ?? fallbackStrength,
      averageSeed: 0,
      expectedWins: 0,
      expectedLosses: 0,
      expectedTies: 0,
      firstSeedProbability: 0,
      topFourProbability: 0,
      averageScoreFor: 0,
      lockedWins: locked?.wins ?? 0,
      lockedLosses: locked?.losses ?? 0,
      lockedTies: locked?.ties ?? 0,
    });
  }

  const playCutoff = Math.min(4, teams.length);
  for (let run = 0; run < simulations; run += 1) {
    const rng = createRng(`${season}:${eventCode}:run:${run}`);
    const gaussian = createGaussianSampler(rng);
    const scoreStdDev = Math.max(8, fallbackStrength * 0.16);
    const runStandings = createWorkingStandings(teams);

    for (const [teamNumber, locked] of lockedStandings.entries()) {
      const row = runStandings.get(teamNumber);
      if (!row) continue;
      row.wins = locked.wins;
      row.losses = locked.losses;
      row.ties = locked.ties;
      row.scoreFor = locked.scoreFor;
    }

    for (const match of remainingMatches) {
      const sampledRedScore = Math.max(0, gaussian(match.predictedRedScore, scoreStdDev));
      const sampledBlueScore = Math.max(0, gaussian(match.predictedBlueScore, scoreStdDev));
      const roundedRed = round(sampledRedScore);
      const roundedBlue = round(sampledBlueScore);

      applyResult(runStandings, match.redAlliance, roundedRed, roundedBlue);
      applyResult(runStandings, match.blueAlliance, roundedBlue, roundedRed);
    }

    const ordered = sortStandings([...runStandings.values()]);
    ordered.forEach((row, index) => {
      const summary = summaries.get(row.teamNumber);
      if (!summary) return;

      summary.averageSeed += index + 1;
      summary.expectedWins += row.wins;
      summary.expectedLosses += row.losses;
      summary.expectedTies += row.ties;
      summary.averageScoreFor += row.scoreFor;

      if (index === 0) {
        summary.firstSeedProbability += 1;
      }
      if (index < playCutoff) {
        summary.topFourProbability += 1;
      }
    });
  }

  const standings = [...summaries.values()]
    .map((summary) => ({
      ...summary,
      averageSeed: round(summary.averageSeed / simulations, 2),
      expectedWins: round(summary.expectedWins / simulations, 2),
      expectedLosses: round(summary.expectedLosses / simulations, 2),
      expectedTies: round(summary.expectedTies / simulations, 2),
      firstSeedProbability: round((summary.firstSeedProbability / simulations) * 100, 1),
      topFourProbability: round((summary.topFourProbability / simulations) * 100, 1),
      averageScoreFor: round(summary.averageScoreFor / simulations, 2),
    }))
    .sort((a, b) => {
      if (a.averageSeed !== b.averageSeed) return a.averageSeed - b.averageSeed;
      if (b.expectedWins !== a.expectedWins) return b.expectedWins - a.expectedWins;
      return a.teamNumber - b.teamNumber;
    });

  return {
    season,
    event,
    teams,
    matches,
    standings,
    simulations,
    totalQualMatches: matches.length,
    playedQualMatches: playedMatches.length,
    remainingQualMatches: remainingMatches.length,
  };
}
