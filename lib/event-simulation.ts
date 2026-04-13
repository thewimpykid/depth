import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";
import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";
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
  championProbability: number;
  finalistProbability: number;
  semifinalistProbability: number;
  /** True in pre-event mode when the team had no prior-season match data. */
  isFirstEvent: boolean;
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
  scheduleMode: "api" | "random";
  /**
   * How team strength was derived:
   *   season    – best per-event OPR across all the team's events this season
   *   pre-event – OPR from the team's most recent event that ended before this event
   *   post-event – OPR computed from this event's own match results
   */
  dataMode: "season" | "pre-event" | "post-event";
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
  /** FTC tiebreaker: sum of the losing alliance's score in each match played. */
  tbp: number;
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
      tbp: 0,
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
  // FTC tiebreaker: sum of the losing alliance's score in each match played.
  const loserScore = Math.min(scoreFor, scoreAgainst);

  for (const team of teams) {
    const row = standings.get(team.teamNumber);
    if (!row) continue;

    row.scoreFor += scoreFor;
    row.tbp += loserScore;
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
    if (b.tbp !== a.tbp) return b.tbp - a.tbp;
    return a.teamNumber - b.teamNumber;
  });
}

function buildRandomQualPairings(
  teams: TeamSnapshot[],
  rounds: number,
  rng: () => number,
): Array<{ red: TeamSnapshot[]; blue: TeamSnapshot[] }> {
  const matches: Array<{ red: TeamSnapshot[]; blue: TeamSnapshot[] }> = [];
  for (let round = 0; round < rounds; round++) {
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i + 3 < shuffled.length; i += 4) {
      matches.push({ red: [shuffled[i], shuffled[i + 1]], blue: [shuffled[i + 2], shuffled[i + 3]] });
    }
  }
  return matches;
}

function simulatePlayoffs(
  ordered: WorkingStanding[],
  strengthByTeam: Map<number, TeamSnapshot>,
  fallbackStrength: number,
  gaussian: (mean: number, stdDev: number) => number,
  scoreStdDev: number,
): Map<number, "champion" | "finalist" | "semifinalist"> {
  if (ordered.length < 4) return new Map();

  const captainNums = ordered.slice(0, 4).map((r) => r.teamNumber);
  const pickedSet = new Set(captainNums);

  const available = ordered
    .slice(4)
    .slice()
    .sort((a, b) => {
      const sa = strengthByTeam.get(a.teamNumber)?.strength ?? fallbackStrength;
      const sb = strengthByTeam.get(b.teamNumber)?.strength ?? fallbackStrength;
      return sb - sa;
    });

  const alliances: Array<{ teams: number[]; strength: number }> = captainNums.map((num) => ({
    teams: [num],
    strength: strengthByTeam.get(num)?.strength ?? fallbackStrength,
  }));

  let pickIdx = 0;
  for (const alliance of alliances) {
    while (pickIdx < available.length && pickedSet.has(available[pickIdx].teamNumber)) pickIdx++;
    if (pickIdx < available.length) {
      const partner = available[pickIdx++];
      alliance.teams.push(partner.teamNumber);
      alliance.strength += strengthByTeam.get(partner.teamNumber)?.strength ?? fallbackStrength;
    }
  }

  // Best-of-3 series (FTC playoff format)
  function playSeries(aIdx: number, bIdx: number) {
    let winsA = 0;
    let winsB = 0;
    while (winsA < 2 && winsB < 2) {
      const aScore = Math.max(0, gaussian(alliances[aIdx].strength, scoreStdDev));
      const bScore = Math.max(0, gaussian(alliances[bIdx].strength, scoreStdDev));
      if (aScore >= bScore) winsA++; else winsB++;
    }
    return winsA >= winsB ? aIdx : bIdx;
  }

  const semi1Winner = playSeries(0, 3);
  const semi1Loser = semi1Winner === 0 ? 3 : 0;
  const semi2Winner = playSeries(1, 2);
  const semi2Loser = semi2Winner === 1 ? 2 : 1;
  const finalsWinner = playSeries(semi1Winner, semi2Winner);
  const finalsLoser = finalsWinner === semi1Winner ? semi2Winner : semi1Winner;

  const results = new Map<number, "champion" | "finalist" | "semifinalist">();
  for (const n of alliances[finalsWinner].teams) results.set(n, "champion");
  for (const n of alliances[finalsLoser].teams) results.set(n, "finalist");
  for (const li of [semi1Loser, semi2Loser]) {
    for (const n of alliances[li].teams) results.set(n, "semifinalist");
  }
  return results;
}

type StrengthResult = { strength: number | null; isFirstEvent: boolean };

type FtcScoutEventEntry = {
  eventCode: string;
  npOpr: number | null;
};

/**
 * Parse the FTCScout /teams/{n}/events/{season} response.
 * Response is a plain array: [{ eventCode, stats: { opr: { totalPointsNp } } }]
 */
function parseFtcScoutTeamEvents(raw: unknown): FtcScoutEventEntry[] {
  const items = Array.isArray(raw) ? raw : asArray(asObject(raw)?.value ?? []);
  return items
    .map((item) => {
      const entry = asObject(item);
      if (!entry) return null;
      const code = pickString(entry, ["eventCode", "code"]);
      if (!code) return null;
      const stats = asObject(entry.stats);
      const opr = asObject(stats?.opr);
      return {
        eventCode: code,
        npOpr: opr ? pickNumber(opr, ["totalPointsNp"]) : null,
      };
    })
    .filter((e): e is FtcScoutEventEntry => e !== null);
}

/**
 * Fetch per-event NP OPR for a team from FTCScout, keyed by event code (uppercase).
 * Returns an empty map on failure.
 */
async function getFtcScoutOprByEvent(
  teamNumber: number,
  season: number,
): Promise<Map<string, number>> {
  const resp = await ftcScoutApiClient.getTeamEvents(teamNumber, season).catch(() => null);
  const entries = parseFtcScoutTeamEvents(resp);
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.npOpr !== null) map.set(e.eventCode.toUpperCase(), e.npOpr);
  }
  return map;
}

/** Pre-event: OPR from the team's most recent event ending before `beforeDate`. */
async function computePreEventStrengths(
  teams: TeamProfile[],
  season: number,
  beforeDate: string,
): Promise<Map<number, StrengthResult>> {
  const beforeTime = new Date(beforeDate).getTime();
  const results = new Map<number, StrengthResult>();

  await mapWithConcurrency(teams, 8, async (team) => {
    // FTC API provides event dates; FTCScout provides per-event OPR.
    const [ftcResp, oprByEvent] = await Promise.all([
      ftcApiClient.getTeamEvents(team.teamNumber, season).catch(() => ({ events: [] })),
      getFtcScoutOprByEvent(team.teamNumber, season),
    ]);

    const priorEvents = asArray(ftcResp.events)
      .map(normalizeEvent)
      .filter((e): e is EventSearchResult => e !== null)
      .filter((e) => {
        const end = e.end ?? e.start;
        return end !== null && new Date(end).getTime() < beforeTime;
      })
      .sort((a, b) =>
        new Date(b.end ?? b.start ?? "").getTime() - new Date(a.end ?? a.start ?? "").getTime(),
      );

    const mostRecent = priorEvents.find((e) => oprByEvent.has(e.code.toUpperCase())) ?? null;
    results.set(team.teamNumber, {
      strength: mostRecent ? (oprByEvent.get(mostRecent.code.toUpperCase()) ?? null) : null,
      isFirstEvent: mostRecent === null,
    });
  });
  return results;
}

/** Post-event: NP OPR from this event's own results, as computed by FTCScout. */
async function computePostEventStrengths(
  eventCode: string,
  season: number,
  teams: TeamProfile[],
): Promise<Map<number, StrengthResult>> {
  const upperCode = eventCode.toUpperCase();
  const results = new Map<number, StrengthResult>();
  await mapWithConcurrency(teams, 8, async (team) => {
    const oprByEvent = await getFtcScoutOprByEvent(team.teamNumber, season);
    results.set(team.teamNumber, {
      strength: oprByEvent.get(upperCode) ?? null,
      isFirstEvent: false,
    });
  });
  return results;
}

/** Season best: highest per-event NP OPR across all events the team played this season. */
async function computeFullSeasonBestStrengths(
  teams: TeamProfile[],
  season: number,
): Promise<Map<number, StrengthResult>> {
  const results = new Map<number, StrengthResult>();
  await mapWithConcurrency(teams, 8, async (team) => {
    const oprByEvent = await getFtcScoutOprByEvent(team.teamNumber, season);
    let best: number | null = null;
    for (const opr of oprByEvent.values()) {
      if (best === null || opr > best) best = opr;
    }
    results.set(team.teamNumber, {
      strength: best,
      isFirstEvent: best === null,
    });
  });
  return results;
}

async function getEventTeamSnapshots(
  eventCode: string,
  season: number,
  mode: "season" | "pre-event" | "post-event" = "season",
  priorToDate?: string | null,
): Promise<TeamSnapshot[]> {
  const cacheKey = `event-roster-${mode}:${season}:${eventCode.toUpperCase()}`;
  const cached = await cacheManager.get<TeamSnapshot[]>("analysis", cacheKey);
  if (cached) return cached;

  const eventTeamsResponse = await ftcApiClient.getEventTeams(eventCode, season);
  const teams = asArray(eventTeamsResponse.teams)
    .map(normalizeTeam)
    .filter((team): team is TeamProfile => team !== null)
    .sort((a, b) => a.teamNumber - b.teamNumber);

  let strengthMap: Map<number, StrengthResult>;

  if (mode === "pre-event" && priorToDate) {
    strengthMap = await computePreEventStrengths(teams, season, priorToDate);
  } else if (mode === "post-event") {
    strengthMap = await computePostEventStrengths(eventCode, season, teams);
  } else {
    strengthMap = await computeFullSeasonBestStrengths(teams, season);
  }

  const snapshots: TeamSnapshot[] = teams.map((team) => {
    const data = strengthMap.get(team.teamNumber);
    return {
      teamNumber: team.teamNumber,
      season,
      name: team.name,
      organization: team.organization,
      rookieYear: team.rookieYear,
      location: team.location,
      eventCount: 0,
      quickStats: null,
      strength: data?.strength ?? null,
      isFirstEvent: data?.isFirstEvent ?? false,
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
  dataMode: "season" | "pre-event" | "post-event" = "season",
): Promise<ActualEventSimulationResult | null> {
  const [event, hybridSchedule] = await Promise.all([
    getSeasonEventByCode(season, eventCode),
    ftcApiClient
      .getHybridSchedule(eventCode, "qual", { season })
      .catch(() => ({ schedule: [] })),
  ]);

  if (!event) return null;

  const teams = await getEventTeamSnapshots(
    eventCode,
    season,
    dataMode,
    dataMode === "pre-event" ? (event.start ?? undefined) : undefined,
  );

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
      championProbability: 0,
      finalistProbability: 0,
      semifinalistProbability: 0,
      isFirstEvent: (team as TeamSnapshot).isFirstEvent ?? false,
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
      row.tbp = locked.tbp;
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

    if (teams.length >= 4) {
      const playoffResults = simulatePlayoffs(ordered, strengthByTeam, fallbackStrength, gaussian, scoreStdDev);
      for (const [teamNumber, result] of playoffResults) {
        const summary = summaries.get(teamNumber);
        if (!summary) continue;
        if (result === "champion") summary.championProbability += 1;
        else if (result === "finalist") summary.finalistProbability += 1;
        else if (result === "semifinalist") summary.semifinalistProbability += 1;
      }
    }

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
      championProbability: round((summary.championProbability / simulations) * 100, 1),
      finalistProbability: round((summary.finalistProbability / simulations) * 100, 1),
      semifinalistProbability: round((summary.semifinalistProbability / simulations) * 100, 1),
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
    scheduleMode: "api",
    dataMode,
  };
}

export async function simulateRandomScheduleEvent(
  season: number,
  eventCode: string,
  simulations: number,
  dataMode: "season" | "pre-event" | "post-event" = "season",
): Promise<ActualEventSimulationResult | null> {
  const event = await getSeasonEventByCode(season, eventCode);
  if (!event) return null;

  const teams = await getEventTeamSnapshots(
    eventCode,
    season,
    dataMode,
    dataMode === "pre-event" ? (event.start ?? undefined) : undefined,
  );

  if (teams.length < 4) return null;

  const strengths = teams
    .map((t) => t.strength)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const fallbackStrength =
    strengths.length > 0 ? round(strengths.reduce((s, v) => s + v, 0) / strengths.length, 2) : 80;

  const strengthByTeam = new Map<number, TeamSnapshot>(teams.map((t) => [t.teamNumber, t]));
  const probabilityScale = Math.max(14, fallbackStrength * 0.28);
  const scoreStdDev = Math.max(8, fallbackStrength * 0.16);

  const matchesPerRound = Math.floor(teams.length / 4);
  const rounds = matchesPerRound > 0 ? Math.ceil((teams.length * 5) / (matchesPerRound * 4)) : 5;

  // Build a sample schedule for display (deterministic seed)
  const sampleRng = createRng(`${season}:${eventCode}:random-sample`);
  const samplePairings = buildRandomQualPairings(teams, rounds, sampleRng);
  const sampleMatches: ActualEventMatch[] = samplePairings.map((pairing, idx) => {
    const redAlliance = pairing.red.map((t) => ({
      teamNumber: t.teamNumber,
      name: t.name ?? null,
      strength: t.strength ?? fallbackStrength,
    }));
    const blueAlliance = pairing.blue.map((t) => ({
      teamNumber: t.teamNumber,
      name: t.name ?? null,
      strength: t.strength ?? fallbackStrength,
    }));
    const prediction = buildPrediction(redAlliance, blueAlliance, probabilityScale);
    return {
      key: `random-${idx + 1}`,
      matchNumber: idx + 1,
      label: `Qual ${idx + 1}`,
      redAlliance,
      blueAlliance,
      ...prediction,
      actualRedScore: null,
      actualBlueScore: null,
      status: "upcoming",
    } satisfies ActualEventMatch;
  });

  const summaries = new Map<number, ActualEventStanding>();
  for (const team of teams) {
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
      lockedWins: 0,
      lockedLosses: 0,
      lockedTies: 0,
      championProbability: 0,
      finalistProbability: 0,
      semifinalistProbability: 0,
      isFirstEvent: (team as TeamSnapshot).isFirstEvent ?? false,
    });
  }

  const playCutoff = Math.min(4, teams.length);

  for (let run = 0; run < simulations; run++) {
    const rng = createRng(`${season}:${eventCode}:random:run:${run}`);
    const gaussian = createGaussianSampler(rng);
    const runStandings = createWorkingStandings(teams);

    const runPairings = buildRandomQualPairings(teams, rounds, rng);
    for (const pairing of runPairings) {
      const redAlliance = pairing.red.map((t) => ({
        teamNumber: t.teamNumber,
        name: t.name ?? null,
        strength: t.strength ?? fallbackStrength,
      }));
      const blueAlliance = pairing.blue.map((t) => ({
        teamNumber: t.teamNumber,
        name: t.name ?? null,
        strength: t.strength ?? fallbackStrength,
      }));
      const redScore = Math.max(
        0,
        gaussian(redAlliance.reduce((s, t) => s + t.strength, 0), scoreStdDev),
      );
      const blueScore = Math.max(
        0,
        gaussian(blueAlliance.reduce((s, t) => s + t.strength, 0), scoreStdDev),
      );
      applyResult(runStandings, redAlliance, round(redScore), round(blueScore));
      applyResult(runStandings, blueAlliance, round(blueScore), round(redScore));
    }

    const ordered = sortStandings([...runStandings.values()]);

    if (teams.length >= 4) {
      const playoffResults = simulatePlayoffs(ordered, strengthByTeam, fallbackStrength, gaussian, scoreStdDev);
      for (const [teamNumber, result] of playoffResults) {
        const summary = summaries.get(teamNumber);
        if (!summary) continue;
        if (result === "champion") summary.championProbability += 1;
        else if (result === "finalist") summary.finalistProbability += 1;
        else if (result === "semifinalist") summary.semifinalistProbability += 1;
      }
    }

    ordered.forEach((row, index) => {
      const summary = summaries.get(row.teamNumber);
      if (!summary) return;
      summary.averageSeed += index + 1;
      summary.expectedWins += row.wins;
      summary.expectedLosses += row.losses;
      summary.expectedTies += row.ties;
      summary.averageScoreFor += row.scoreFor;
      if (index === 0) summary.firstSeedProbability += 1;
      if (index < playCutoff) summary.topFourProbability += 1;
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
      championProbability: round((summary.championProbability / simulations) * 100, 1),
      finalistProbability: round((summary.finalistProbability / simulations) * 100, 1),
      semifinalistProbability: round((summary.semifinalistProbability / simulations) * 100, 1),
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
    matches: sampleMatches,
    standings,
    simulations,
    totalQualMatches: sampleMatches.length,
    playedQualMatches: 0,
    remainingQualMatches: sampleMatches.length,
    scheduleMode: "random",
    dataMode,
  };
}
