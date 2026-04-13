import "server-only";

import { cacheManager, CACHE_TTL } from "@/lib/cache-manager";
import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";
import type { RankedValue, TeamQuickStats } from "@/lib/ftc";

const MIN_SUPPORTED_SEASON = 2019;

export type TeamSnapshot = {
  teamNumber: number;
  season: number;
  name: string | null;
  organization: string | null;
  rookieYear: number | null;
  location: string | null;
  eventCount: number;
  quickStats: TeamQuickStats | null;
  strength: number | null;
  /** True when pre-event mode was used and the team had no prior season matches. */
  isFirstEvent?: boolean;
};

export type SimulationTeamSide = {
  teamNumber: number;
  name: string | null;
  strength: number;
};

export type SimulatedQualificationMatch = {
  key: string;
  matchNumber: number;
  label: string;
  redAlliance: SimulationTeamSide[];
  blueAlliance: SimulationTeamSide[];
  predictedRedScore: number;
  predictedBlueScore: number;
  redWinProbability: number;
  blueWinProbability: number;
  favoredAlliance: "red" | "blue" | "even";
};

export type SimulatedStanding = {
  teamNumber: number;
  name: string | null;
  strength: number;
  averageSeed: number;
  expectedWins: number;
  expectedLosses: number;
  firstSeedProbability: number;
  topFourProbability: number;
  averageScoreFor: number;
};

export type EventSimulationResult = {
  season: number;
  teams: TeamSnapshot[];
  matches: SimulatedQualificationMatch[];
  standings: SimulatedStanding[];
  qualificationMatches: number;
  simulations: number;
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

function shuffle<T>(items: T[], rng: () => number) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function getPairKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function getStrength(snapshot: TeamSnapshot, fallback: number) {
  return snapshot.strength ?? fallback;
}

function buildSeasonOptions(currentSeason: number) {
  const seasons: number[] = [];
  for (let season = currentSeason; season >= MIN_SUPPORTED_SEASON; season -= 1) {
    seasons.push(season);
  }
  return seasons;
}

async function fetchTeamSnapshot(
  teamNumber: number,
  season: number,
  currentSeason: number,
): Promise<TeamSnapshot> {
  const cacheKey = `snapshot:${season}:${teamNumber}`;
  const cached = await cacheManager.get<TeamSnapshot>("analysis", cacheKey);
  if (cached) {
    return cached;
  }

  const [teamResponse, eventsResponse, quickStatsResponse] = await Promise.all([
    ftcApiClient.getTeam(teamNumber, season).catch(() => ({ teams: [] })),
    ftcApiClient.getTeamEvents(teamNumber, season).catch(() => ({ events: [] })),
    ftcScoutApiClient.getTeamQuickStats(teamNumber, season).catch(() => null),
  ]);

  let team =
    asArray(teamResponse.teams)
      .map(normalizeTeam)
      .find((value): value is TeamProfile => value !== null) ?? null;

  if (!team && season !== currentSeason) {
    const fallbackTeam = await ftcApiClient.getTeam(teamNumber, currentSeason).catch(() => null);
    team =
      asArray(fallbackTeam?.teams)
        .map(normalizeTeam)
        .find((value): value is TeamProfile => value !== null) ?? null;
  }

  const quickStats = normalizeQuickStats(quickStatsResponse);
  const snapshot: TeamSnapshot = {
    teamNumber,
    season,
    name: team?.name ?? null,
    organization: team?.organization ?? null,
    rookieYear: team?.rookieYear ?? null,
    location: team?.location ?? null,
    eventCount: asArray(eventsResponse.events).length,
    quickStats,
    strength: quickStats?.total.value ?? null,
  };

  cacheManager.set("analysis", cacheKey, snapshot, CACHE_TTL.TEAMS);
  return snapshot;
}

function pickMatchTeams(teams: TeamSnapshot[], appearances: Map<number, number>, rng: () => number) {
  const shuffled = shuffle(teams, rng);
  shuffled.sort((a, b) => {
    const appearanceDiff =
      (appearances.get(a.teamNumber) ?? 0) - (appearances.get(b.teamNumber) ?? 0);
    if (appearanceDiff !== 0) return appearanceDiff;

    const strengthDiff = (b.strength ?? 0) - (a.strength ?? 0);
    if (strengthDiff !== 0) return strengthDiff;

    return a.teamNumber - b.teamNumber;
  });

  return shuffled.slice(0, 4);
}

function chooseAllianceSplit(
  teams: TeamSnapshot[],
  partnerCounts: Map<string, number>,
  opponentCounts: Map<string, number>,
  fallbackStrength: number,
  rng: () => number,
) {
  const pairings = [
    { red: [teams[0], teams[1]], blue: [teams[2], teams[3]] },
    { red: [teams[0], teams[2]], blue: [teams[1], teams[3]] },
    { red: [teams[0], teams[3]], blue: [teams[1], teams[2]] },
  ];

  const scored = pairings.map((pairing, index) => {
    const partnerPenalty =
      (partnerCounts.get(getPairKey(pairing.red[0].teamNumber, pairing.red[1].teamNumber)) ?? 0) +
      (partnerCounts.get(getPairKey(pairing.blue[0].teamNumber, pairing.blue[1].teamNumber)) ?? 0);

    const opponentPenalty =
      pairing.red.reduce((sum, redTeam) => {
        return (
          sum +
          pairing.blue.reduce((inner, blueTeam) => {
            return inner + (opponentCounts.get(getPairKey(redTeam.teamNumber, blueTeam.teamNumber)) ?? 0);
          }, 0)
        );
      }, 0);

    const redStrength = pairing.red.reduce(
      (sum, team) => sum + getStrength(team, fallbackStrength),
      0,
    );
    const blueStrength = pairing.blue.reduce(
      (sum, team) => sum + getStrength(team, fallbackStrength),
      0,
    );

    return {
      index,
      pairing,
      score: partnerPenalty * 4 + opponentPenalty * 1.5 + Math.abs(redStrength - blueStrength) * 0.08,
    };
  });

  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  const bestScore = scored[0]?.score ?? 0;
  const finalists = scored.filter((item) => Math.abs(item.score - bestScore) < 1e-6);
  return finalists[Math.floor(rng() * finalists.length)]?.pairing ?? pairings[0];
}

function buildQualificationSchedule(
  teams: TeamSnapshot[],
  qualificationMatches: number,
  fallbackStrength: number,
  rng: () => number,
) {
  const appearances = new Map<number, number>();
  const partnerCounts = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const matches: SimulatedQualificationMatch[] = [];
  const probabilityScale = Math.max(14, fallbackStrength * 0.28);

  for (const team of teams) {
    appearances.set(team.teamNumber, 0);
  }

  for (let matchNumber = 1; matchNumber <= qualificationMatches; matchNumber += 1) {
    const selected = pickMatchTeams(teams, appearances, rng);
    const pairing = chooseAllianceSplit(
      selected,
      partnerCounts,
      opponentCounts,
      fallbackStrength,
      rng,
    );

    const redAlliance = pairing.red.map((team) => ({
      teamNumber: team.teamNumber,
      name: team.name,
      strength: getStrength(team, fallbackStrength),
    }));
    const blueAlliance = pairing.blue.map((team) => ({
      teamNumber: team.teamNumber,
      name: team.name,
      strength: getStrength(team, fallbackStrength),
    }));

    const predictedRedScore = round(
      redAlliance.reduce((sum, team) => sum + team.strength, 0),
    );
    const predictedBlueScore = round(
      blueAlliance.reduce((sum, team) => sum + team.strength, 0),
    );
    const redProbability =
      1 / (1 + Math.exp(-(predictedRedScore - predictedBlueScore) / probabilityScale));

    matches.push({
      key: `Q-${matchNumber}-${redAlliance.map((team) => team.teamNumber).join("-")}-${blueAlliance
        .map((team) => team.teamNumber)
        .join("-")}`,
      matchNumber,
      label: `Qual ${matchNumber}`,
      redAlliance,
      blueAlliance,
      predictedRedScore,
      predictedBlueScore,
      redWinProbability: round(redProbability * 100, 1),
      blueWinProbability: round((1 - redProbability) * 100, 1),
      favoredAlliance:
        Math.abs(predictedRedScore - predictedBlueScore) < 0.01
          ? "even"
          : predictedRedScore > predictedBlueScore
            ? "red"
            : "blue",
    });

    for (const team of selected) {
      appearances.set(team.teamNumber, (appearances.get(team.teamNumber) ?? 0) + 1);
    }

    partnerCounts.set(
      getPairKey(redAlliance[0].teamNumber, redAlliance[1].teamNumber),
      (partnerCounts.get(getPairKey(redAlliance[0].teamNumber, redAlliance[1].teamNumber)) ?? 0) + 1,
    );
    partnerCounts.set(
      getPairKey(blueAlliance[0].teamNumber, blueAlliance[1].teamNumber),
      (partnerCounts.get(getPairKey(blueAlliance[0].teamNumber, blueAlliance[1].teamNumber)) ?? 0) + 1,
    );

    for (const redTeam of redAlliance) {
      for (const blueTeam of blueAlliance) {
        const key = getPairKey(redTeam.teamNumber, blueTeam.teamNumber);
        opponentCounts.set(key, (opponentCounts.get(key) ?? 0) + 1);
      }
    }
  }

  return matches;
}

function runSimulation(
  teams: TeamSnapshot[],
  matches: SimulatedQualificationMatch[],
  simulations: number,
  fallbackStrength: number,
  seedText: string,
) {
  const standings = new Map<number, SimulatedStanding>();
  const playCutoff = Math.min(4, teams.length);

  for (const team of teams) {
    standings.set(team.teamNumber, {
      teamNumber: team.teamNumber,
      name: team.name,
      strength: getStrength(team, fallbackStrength),
      averageSeed: 0,
      expectedWins: 0,
      expectedLosses: 0,
      firstSeedProbability: 0,
      topFourProbability: 0,
      averageScoreFor: 0,
    });
  }

  for (let run = 0; run < simulations; run += 1) {
    const rng = createRng(`${seedText}:run:${run}`);
    const gaussian = createGaussianSampler(rng);
    const scoreStdDev = Math.max(8, fallbackStrength * 0.16);
    const runStandings = new Map<number, WorkingStanding>();

    for (const team of teams) {
      runStandings.set(team.teamNumber, {
        teamNumber: team.teamNumber,
        wins: 0,
        losses: 0,
        scoreFor: 0,
      });
    }

    for (const match of matches) {
      const sampledRedScore = Math.max(0, gaussian(match.predictedRedScore, scoreStdDev));
      const sampledBlueScore = Math.max(0, gaussian(match.predictedBlueScore, scoreStdDev));

      const redWon = sampledRedScore > sampledBlueScore;

      for (const redTeam of match.redAlliance) {
        const row = runStandings.get(redTeam.teamNumber);
        if (!row) continue;
        row.scoreFor += sampledRedScore;
        if (redWon) {
          row.wins += 1;
        } else {
          row.losses += 1;
        }
      }

      for (const blueTeam of match.blueAlliance) {
        const row = runStandings.get(blueTeam.teamNumber);
        if (!row) continue;
        row.scoreFor += sampledBlueScore;
        if (redWon) {
          row.losses += 1;
        } else {
          row.wins += 1;
        }
      }
    }

    const ordered = [...runStandings.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
      return a.teamNumber - b.teamNumber;
    });

    ordered.forEach((row, index) => {
      const summary = standings.get(row.teamNumber);
      if (!summary) return;

      summary.averageSeed += index + 1;
      summary.expectedWins += row.wins;
      summary.expectedLosses += row.losses;
      summary.averageScoreFor += row.scoreFor;

      if (index === 0) {
        summary.firstSeedProbability += 1;
      }
      if (index < playCutoff) {
        summary.topFourProbability += 1;
      }
    });
  }

  return [...standings.values()]
    .map((row) => ({
      ...row,
      averageSeed: round(row.averageSeed / simulations, 2),
      expectedWins: round(row.expectedWins / simulations, 2),
      expectedLosses: round(row.expectedLosses / simulations, 2),
      firstSeedProbability: round((row.firstSeedProbability / simulations) * 100, 1),
      topFourProbability: round((row.topFourProbability / simulations) * 100, 1),
      averageScoreFor: round(row.averageScoreFor / simulations, 2),
    }))
    .sort((a, b) => {
      if (a.averageSeed !== b.averageSeed) return a.averageSeed - b.averageSeed;
      if (b.expectedWins !== a.expectedWins) return b.expectedWins - a.expectedWins;
      return a.teamNumber - b.teamNumber;
    });
}

export function parseTeamNumbersInput(raw: string, limit = 12) {
  const matches = raw.match(/\d{1,5}/g) ?? [];
  const uniqueNumbers: number[] = [];

  for (const match of matches) {
    const teamNumber = Number(match);
    if (!Number.isInteger(teamNumber) || teamNumber <= 0) continue;
    if (!uniqueNumbers.includes(teamNumber)) {
      uniqueNumbers.push(teamNumber);
    }
    if (uniqueNumbers.length >= limit) {
      break;
    }
  }

  return uniqueNumbers;
}

export async function getCurrentSeasonWithOptions() {
  const currentSeason = await ftcApiClient.getCurrentSeason();
  return {
    currentSeason,
    seasonOptions: buildSeasonOptions(currentSeason),
  };
}

export async function getTeamSnapshots(teamNumbers: number[], season: number) {
  const currentSeason = await ftcApiClient.getCurrentSeason();
  return Promise.all(
    teamNumbers.map((teamNumber) => fetchTeamSnapshot(teamNumber, season, currentSeason)),
  );
}

export async function simulateSyntheticEvent(
  teamNumbers: number[],
  season: number,
  qualificationMatches: number,
  simulations: number,
): Promise<EventSimulationResult> {
  const teams = await getTeamSnapshots(teamNumbers, season);
  const strengths = teams
    .map((team) => team.strength)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const fallbackStrength =
    strengths.length > 0
      ? round(strengths.reduce((sum, value) => sum + value, 0) / strengths.length, 2)
      : 80;

  const seedText = `${season}:${teamNumbers.join("-")}:${qualificationMatches}:${simulations}`;
  const scheduleRng = createRng(`${seedText}:schedule`);
  const matches = buildQualificationSchedule(
    teams,
    qualificationMatches,
    fallbackStrength,
    scheduleRng,
  );
  const standings = runSimulation(teams, matches, simulations, fallbackStrength, seedText);

  return {
    season,
    teams,
    matches,
    standings,
    qualificationMatches,
    simulations,
  };
}
