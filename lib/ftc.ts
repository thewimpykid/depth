import "server-only";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";

export type RankedValue = {
  value: number | null;
  rank: number | null;
  percentile: number | null;
};

export type TeamQuickStats = {
  total: RankedValue;
  auto: RankedValue;
  teleop: RankedValue;
  endgame: RankedValue;
  comparedAgainst: number | null;
};

export type TeamMatchSide = {
  teamNumber: number;
  teamName: string | null;
};

export type TeamMatch = {
  key: string;
  description: string;
  tournamentLevel: string;
  matchNumber: number;
  start: string | null;
  field: string | null;
  alliance: "red" | "blue" | null;
  redAlliance: TeamMatchSide[];
  blueAlliance: TeamMatchSide[];
  redScore: number | null;
  blueScore: number | null;
  won: boolean | null;
  predictedRedScore: number | null;
  predictedBlueScore: number | null;
  redWinProbability: number | null;
  blueWinProbability: number | null;
  winProbability: number | null;
  predictionSampleSize: number;
};

export type OprBreakdown = {
  total: number | null;
  auto: number | null;
  teleop: number | null;
  endgame: number | null;
};

export type OprTrendPoint = {
  sequence: number;
  label: string;
  total: number | null;
  auto: number | null;
  teleop: number | null;
  endgame: number | null;
};

export type TeamEventDetails = {
  eventCode: string;
  awards: string[];
  currentOpr: OprBreakdown | null;
  oprTrend: OprTrendPoint[];
  matches: TeamMatch[];
};

export type TeamEventSummary = {
  eventCode: string;
  eventName: string;
  start: string | null;
  end: string | null;
  location: string | null;
  record: string | null;
  rank: number | null;
  rp: number | null;
  npAverage: number | null;
  npOpr: number | null;
  statsAvailable: boolean;
};

export type TeamProfile = {
  teamNumber: number;
  name: string | null;
  organization: string | null;
  robotName: string | null;
  rookieYear: number | null;
  location: string | null;
};

export type TeamPageResult = {
  teamNumber: number;
  season: number;
  seasonLabel: string;
  currentSeason: number;
  team: TeamProfile | null;
  quickStats: TeamQuickStats | null;
  availableSeasons: number[];
  events: TeamEventSummary[];
};

type EventSummary = {
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  location: string | null;
};

type TeamEventStats = {
  record: string | null;
  rank: number | null;
  rp: number | null;
  npAverage: number | null;
  npOpr: number | null;
  statsAvailable: boolean;
};

type AllianceBreakdown = {
  total: number | null;
  auto: number | null;
  teleop: number | null;
  endgame: number | null;
  foulCommitted: number | null;
};

type PlayedQualMatch = {
  matchKey: string;
  description: string;
  tournamentLevel: string;
  matchNumber: number;
  start: string | null;
  field: string | null;
  redAlliance: TeamMatchSide[];
  blueAlliance: TeamMatchSide[];
  redTeamNumbers: number[];
  blueTeamNumbers: number[];
  red: AllianceBreakdown;
  blue: AllianceBreakdown;
};

type OprBundle = {
  total: Map<number, number>;
  auto: Map<number, number>;
  teleop: Map<number, number>;
  endgame: Map<number, number>;
  marginStdDev: number | null;
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

function unique(strings: string[]) {
  return [...new Set(strings)];
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

function normalizeEvent(raw: unknown): EventSummary | null {
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

  const name = pickString(obj, ["nameShort", "teamName", "nameFull", "schoolName"]);
  const nameFull = pickString(obj, ["nameFull"]);
  const nameShort = pickString(obj, ["nameShort", "teamName"]);
  const schoolName = pickString(obj, ["schoolName"]);

  const organization =
    (nameFull && nameFull !== nameShort ? nameFull : null) ?? schoolName ?? null;

  return {
    teamNumber,
    name,
    organization,
    robotName: pickString(obj, ["robotName"]) ?? null,
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

function normalizeTeamEventStats(raw: unknown): { eventCode: string; stats: TeamEventStats } | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const eventCode = pickString(obj, ["eventCode"]);
  if (!eventCode) return null;

  const statsObj = asObject(obj.stats);
  const oprObj = statsObj ? asObject(statsObj.opr) : null;
  const avgObj = statsObj ? asObject(statsObj.avg) : null;

  const wins = statsObj ? pickNumber(statsObj, ["wins"]) : null;
  const losses = statsObj ? pickNumber(statsObj, ["losses"]) : null;
  const ties = statsObj ? pickNumber(statsObj, ["ties"]) : null;

  return {
    eventCode,
    stats: {
      record:
        wins !== null && losses !== null && ties !== null
          ? `${wins}-${losses}-${ties}`
          : null,
      rank: statsObj ? pickNumber(statsObj, ["rank"]) : null,
      rp: statsObj ? pickNumber(statsObj, ["rp"]) : null,
      npAverage:
        (avgObj ? pickNumber(avgObj, ["totalPointsNp"]) : null) ??
        (statsObj ? pickNumber(statsObj, ["tb1"]) : null),
      npOpr: oprObj ? pickNumber(oprObj, ["totalPointsNp"]) : null,
      statsAvailable: statsObj !== null,
    },
  };
}

function sortByDateDescending<T extends { start?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = a.start ? new Date(a.start).getTime() : 0;
    const bTime = b.start ? new Date(b.start).getTime() : 0;
    return bTime - aTime;
  });
}

function createAvailableSeasons(
  rookieYear: number | null,
  selectedSeason: number,
  currentSeason: number,
) {
  const startSeason =
    rookieYear && rookieYear <= currentSeason ? rookieYear : selectedSeason;

  const seasons: number[] = [];
  for (let season = currentSeason; season >= startSeason; season -= 1) {
    seasons.push(season);
  }

  if (!seasons.includes(selectedSeason)) {
    seasons.push(selectedSeason);
  }

  return seasons.sort((a, b) => b - a);
}

function parseAwards(rawAwards: unknown[]) {
  return unique(
    rawAwards
      .map((rawAward) => {
        const award = asObject(rawAward);
        if (!award) return null;
        return pickString(award, ["name", "awardName"]);
      })
      .filter((awardName): awardName is string => Boolean(awardName)),
  );
}

function parseDisplayMatch(raw: unknown, teamNumber: number): TeamMatch | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const matchNumber = pickNumber(obj, ["matchNumber", "number"]);
  if (matchNumber === null) return null;

  const { redAlliance, blueAlliance } = getAllianceTeams(asArray(obj.teams));

  if (
    !redAlliance.some((team) => team.teamNumber === teamNumber) &&
    !blueAlliance.some((team) => team.teamNumber === teamNumber)
  ) {
    return null;
  }

  const alliance = redAlliance.some((team) => team.teamNumber === teamNumber)
    ? "red"
    : blueAlliance.some((team) => team.teamNumber === teamNumber)
      ? "blue"
      : null;

  const redScore = pickNumber(obj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]);
  const blueScore = pickNumber(obj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]);

  let won: boolean | null = null;
  if (
    alliance &&
    typeof redScore === "number" &&
    typeof blueScore === "number" &&
    redScore !== blueScore
  ) {
    won = alliance === "red" ? redScore > blueScore : blueScore > redScore;
  }

  return {
    key: buildDisplayMatchKey(obj, redAlliance, blueAlliance),
    description:
      pickString(obj, ["description"]) ??
      `${pickString(obj, ["tournamentLevel", "matchLevel"]) ?? "Match"} ${matchNumber}`,
    tournamentLevel: pickString(obj, ["tournamentLevel", "matchLevel"]) ?? "MATCH",
    matchNumber,
    start:
      pickString(obj, ["actualStartTime", "startTime", "scheduledStartTime", "postResultTime"]) ??
      null,
    field: pickString(obj, ["field"]) ?? null,
    alliance,
    redAlliance,
    blueAlliance,
    redScore,
    blueScore,
    won,
    predictedRedScore: null,
    predictedBlueScore: null,
    redWinProbability: null,
    blueWinProbability: null,
    winProbability: null,
    predictionSampleSize: 0,
  };
}

function mergeScheduleWithResults(scheduleRows: unknown[], resultRows: unknown[]) {
  // Keyed by tournamentLevel:series:matchNumber so playoff rounds don't clobber each other
  const resultByMatch = new Map<string, Record<string, unknown>>();

  for (const raw of resultRows) {
    const obj = asObject(raw);
    if (!obj) continue;

    const matchNumber = pickNumber(obj, ["matchNumber", "number"]);
    if (matchNumber === null) continue;

    const key = getMatchIdentityKey(
      pickString(obj, ["tournamentLevel", "matchLevel"]),
      pickNumber(obj, ["series"]),
      matchNumber,
    );
    resultByMatch.set(key, obj);
  }

  return scheduleRows.map((raw) => {
    const scheduleObj = asObject(raw);
    if (!scheduleObj) return raw;

    const matchNumber = pickNumber(scheduleObj, ["matchNumber", "number"]);
    if (matchNumber === null) return raw;

    const key = getMatchIdentityKey(
      pickString(scheduleObj, ["tournamentLevel", "matchLevel"]),
      pickNumber(scheduleObj, ["series"]),
      matchNumber,
    );
    const resultObj = resultByMatch.get(key);
    if (!resultObj) return raw;

    return {
      ...scheduleObj,
      scoreRedFinal:
        pickNumber(resultObj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]) ??
        pickNumber(scheduleObj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]),
      scoreBlueFinal:
        pickNumber(resultObj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]) ??
        pickNumber(scheduleObj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]),
    };
  });
}

function getMatchIdentityKey(
  tournamentLevel: string | null,
  series: number | null,
  matchNumber: number | null,
) {
  return `${(tournamentLevel ?? "MATCH").toUpperCase()}:${series ?? 0}:${matchNumber ?? 0}`;
}

function buildDisplayMatchKey(
  obj: Record<string, unknown>,
  redAlliance: TeamMatchSide[],
  blueAlliance: TeamMatchSide[],
) {
  const tournamentLevel = pickString(obj, ["tournamentLevel", "matchLevel"]) ?? "MATCH";
  const matchNumber = pickNumber(obj, ["matchNumber", "number"]) ?? 0;
  const field = pickString(obj, ["field"]) ?? "field";
  const start =
    pickString(obj, ["actualStartTime", "startTime", "scheduledStartTime", "postResultTime"]) ??
    "nostart";
  const redIds = redAlliance.map((team) => team.teamNumber).join("-");
  const blueIds = blueAlliance.map((team) => team.teamNumber).join("-");
  return `${tournamentLevel}-${matchNumber}-${field}-${start}-${redIds}-${blueIds}`;
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
    .map(({ teamNumber, teamName }) => ({ teamNumber, teamName }));
  const blueAlliance = teams
    .filter((team) => team.station.startsWith("blue"))
    .map(({ teamNumber, teamName }) => ({ teamNumber, teamName }));

  return {
    redAlliance,
    blueAlliance,
    redTeamNumbers: redAlliance.map((team) => team.teamNumber),
    blueTeamNumbers: blueAlliance.map((team) => team.teamNumber),
  };
}

function parseAllianceBreakdown(
  allianceObj: Record<string, unknown> | null,
  opponentObj: Record<string, unknown> | null,
  scheduleObj: Record<string, unknown> | null,
  color: "red" | "blue",
): AllianceBreakdown {
  const prefix = color === "red" ? "Red" : "Blue";

  const totalFromDetail = allianceObj ? pickNumber(allianceObj, ["totalPoints"]) : null;
  const totalFromSchedule = scheduleObj
    ? pickNumber(scheduleObj, [`score${prefix}Final`, `${color}ScoreFinal`, `score${prefix}`])
    : null;
  const total = totalFromDetail ?? totalFromSchedule;

  const autoFromDetail = allianceObj ? pickNumber(allianceObj, ["autoPoints"]) : null;
  const autoFromSchedule = scheduleObj
    ? pickNumber(scheduleObj, [`score${prefix}Auto`, `${color}ScoreAuto`])
    : null;
  const auto = autoFromDetail ?? autoFromSchedule;

  const foulCommitted =
    (allianceObj ? pickNumber(allianceObj, ["foulPointsCommitted"]) : null) ??
    (scheduleObj ? pickNumber(scheduleObj, [`score${prefix}Foul`, `${color}ScoreFoul`]) : null);

  const benefitedFouls = opponentObj ? pickNumber(opponentObj, ["foulPointsCommitted"]) : null;

  const endgameRaw =
    (allianceObj
      ? pickNumber(allianceObj, ["endgamePoints", "teleopBasePoints", "basePoints"])
      : null) ??
    (scheduleObj ? pickNumber(scheduleObj, [`score${prefix}Endgame`, `${color}ScoreEndgame`]) : null);

  const teleopRaw =
    (allianceObj
      ? pickNumber(allianceObj, ["teleopPoints", "driveControlledPoints"])
      : null) ??
    (scheduleObj
      ? pickNumber(scheduleObj, [
          `score${prefix}DriveControlled`,
          `${color}ScoreDriveControlled`,
          `score${prefix}Teleop`,
          `${color}ScoreTeleop`,
        ])
      : null);

  const endgame = endgameRaw !== null ? Math.max(0, endgameRaw) : null;
  const teleop =
    teleopRaw !== null
      ? Math.max(0, teleopRaw - (endgame ?? 0))
      : null;
  const totalWithoutPenalties =
    total !== null ? total - (benefitedFouls ?? 0) : null;

  return {
    total: totalWithoutPenalties !== null ? round(totalWithoutPenalties) : null,
    auto: auto !== null ? round(auto) : null,
    teleop: teleop !== null ? round(teleop) : null,
    endgame: endgame !== null ? round(endgame) : null,
    foulCommitted,
  };
}

function createScoreDetailIndex(rawScores: unknown[]) {
  const index = new Map<string, Record<string, unknown>>();

  for (const rawScore of rawScores) {
    const obj = asObject(rawScore);
    if (!obj) continue;

    const key = getMatchIdentityKey(
      pickString(obj, ["matchLevel", "tournamentLevel"]),
      pickNumber(obj, ["matchSeries", "series"]),
      pickNumber(obj, ["matchNumber", "number"]),
    );

    index.set(key, obj);
  }

  return index;
}

function getAllianceObjectByColor(
  scoreDetail: Record<string, unknown> | null,
  color: "red" | "blue",
) {
  if (!scoreDetail) return null;

  return (
    asArray(scoreDetail.alliances)
      .map(asObject)
      .find((alliance) => {
        if (!alliance) return false;
        const allianceName = pickString(alliance, ["alliance"]);
        return allianceName?.toLowerCase() === color;
      }) ?? null
  );
}

function parsePlayedQualificationMatch(raw: unknown, scoreIndex: Map<string, Record<string, unknown>>) {
  const obj = asObject(raw);
  if (!obj) return null;

  const matchNumber = pickNumber(obj, ["matchNumber", "number"]);
  if (matchNumber === null) return null;

  const { redAlliance, blueAlliance, redTeamNumbers, blueTeamNumbers } = getAllianceTeams(
    asArray(obj.teams),
  );

  if (redTeamNumbers.length === 0 || blueTeamNumbers.length === 0) {
    return null;
  }

  const scoreDetail = scoreIndex.get(
    getMatchIdentityKey(
      pickString(obj, ["tournamentLevel", "matchLevel"]),
      pickNumber(obj, ["series", "matchSeries"]),
      matchNumber,
    ),
  );

  const red = parseAllianceBreakdown(
    getAllianceObjectByColor(scoreDetail ?? null, "red"),
    getAllianceObjectByColor(scoreDetail ?? null, "blue"),
    obj,
    "red",
  );
  const blue = parseAllianceBreakdown(
    getAllianceObjectByColor(scoreDetail ?? null, "blue"),
    getAllianceObjectByColor(scoreDetail ?? null, "red"),
    obj,
    "blue",
  );

  if (red.total === null || blue.total === null) {
    return null;
  }

  return {
    matchKey: buildDisplayMatchKey(obj, redAlliance, blueAlliance),
    description:
      pickString(obj, ["description"]) ??
      `${pickString(obj, ["tournamentLevel", "matchLevel"]) ?? "Qualification"} ${matchNumber}`,
    tournamentLevel: pickString(obj, ["tournamentLevel", "matchLevel"]) ?? "QUALIFICATION",
    matchNumber,
    start:
      pickString(obj, ["actualStartTime", "startTime", "scheduledStartTime", "postResultTime"]) ??
      null,
    field: pickString(obj, ["field"]) ?? null,
    redAlliance,
    blueAlliance,
    redTeamNumbers,
    blueTeamNumbers,
    red,
    blue,
  } satisfies PlayedQualMatch;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = matrix.length;
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(a[maxRow][pivot]) < 1e-9) {
      continue;
    }

    if (maxRow !== pivot) {
      [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];
      [b[pivot], b[maxRow]] = [b[maxRow], b[pivot]];
    }

    const divisor = a[pivot][pivot];
    for (let column = pivot; column < size; column += 1) {
      a[pivot][column] /= divisor;
    }
    b[pivot] /= divisor;

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      if (Math.abs(factor) < 1e-9) continue;

      for (let column = pivot; column < size; column += 1) {
        a[row][column] -= factor * a[pivot][column];
      }
      b[row] -= factor * b[pivot];
    }
  }

  return b.map((value) => (Number.isFinite(value) ? value : 0));
}

function buildTeamIndex(matches: PlayedQualMatch[]) {
  const teamNumbers = unique(
    matches.flatMap((match) => [...match.redTeamNumbers, ...match.blueTeamNumbers].map(String)),
  )
    .map((team) => Number(team))
    .sort((a, b) => a - b);

  const indexByTeam = new Map<number, number>();
  teamNumbers.forEach((teamNumber, index) => {
    indexByTeam.set(teamNumber, index);
  });

  const matrix = Array.from({ length: teamNumbers.length }, () =>
    Array.from({ length: teamNumbers.length }, () => 0),
  );

  for (const match of matches) {
    for (const alliance of [match.redTeamNumbers, match.blueTeamNumbers]) {
      for (const rowTeam of alliance) {
        const rowIndex = indexByTeam.get(rowTeam);
        if (rowIndex === undefined) continue;
        for (const colTeam of alliance) {
          const colIndex = indexByTeam.get(colTeam);
          if (colIndex === undefined) continue;
          matrix[rowIndex][colIndex] += 1;
        }
      }
    }
  }

  for (let index = 0; index < matrix.length; index += 1) {
    matrix[index][index] += 1e-6;
  }

  return { teamNumbers, indexByTeam, matrix };
}

function solveComponentOpr(
  matches: PlayedQualMatch[],
  teamNumbers: number[],
  indexByTeam: Map<number, number>,
  matrix: number[][],
  selector: (breakdown: AllianceBreakdown) => number | null,
) {
  const vector = Array.from({ length: teamNumbers.length }, () => 0);

  for (const match of matches) {
    const alliances: Array<[number[], AllianceBreakdown]> = [
      [match.redTeamNumbers, match.red],
      [match.blueTeamNumbers, match.blue],
    ];

    for (const [allianceTeams, breakdown] of alliances) {
      const score = selector(breakdown);
      if (score === null) continue;

      for (const teamNumber of allianceTeams) {
        const index = indexByTeam.get(teamNumber);
        if (index !== undefined) {
          vector[index] += score;
        }
      }
    }
  }

  const solved = solveLinearSystem(matrix, vector);
  return new Map<number, number>(
    teamNumbers.map((teamNumber, index) => [teamNumber, round(solved[index])]),
  );
}

function computeMarginStdDev(matches: PlayedQualMatch[], totalMap: Map<number, number>) {
  const residuals: number[] = [];

  for (const match of matches) {
    const predictedRed = match.redTeamNumbers.reduce(
      (sum, teamNumber) => sum + (totalMap.get(teamNumber) ?? 0),
      0,
    );
    const predictedBlue = match.blueTeamNumbers.reduce(
      (sum, teamNumber) => sum + (totalMap.get(teamNumber) ?? 0),
      0,
    );

    if (match.red.total === null || match.blue.total === null) {
      continue;
    }

    const actualMargin = match.red.total - match.blue.total;
    const predictedMargin = predictedRed - predictedBlue;
    residuals.push(actualMargin - predictedMargin);
  }

  if (residuals.length === 0) return null;
  const variance =
    residuals.reduce((sum, residual) => sum + residual * residual, 0) / residuals.length;
  return Math.sqrt(variance);
}

function computeOprBundle(matches: PlayedQualMatch[]): OprBundle {
  if (matches.length === 0) {
    return {
      total: new Map(),
      auto: new Map(),
      teleop: new Map(),
      endgame: new Map(),
      marginStdDev: null,
    };
  }

  const { teamNumbers, indexByTeam, matrix } = buildTeamIndex(matches);
  const total = solveComponentOpr(matches, teamNumbers, indexByTeam, matrix, (breakdown) => breakdown.total);
  const auto = solveComponentOpr(matches, teamNumbers, indexByTeam, matrix, (breakdown) => breakdown.auto);
  const teleop = solveComponentOpr(
    matches,
    teamNumbers,
    indexByTeam,
    matrix,
    (breakdown) => breakdown.teleop,
  );
  const endgame = solveComponentOpr(
    matches,
    teamNumbers,
    indexByTeam,
    matrix,
    (breakdown) => breakdown.endgame,
  );

  return {
    total,
    auto,
    teleop,
    endgame,
    marginStdDev: computeMarginStdDev(matches, total),
  };
}

function mapToBreakdown(bundle: OprBundle, teamNumber: number): OprBreakdown | null {
  const total = bundle.total.get(teamNumber) ?? null;
  const auto = bundle.auto.get(teamNumber) ?? null;
  const teleop = bundle.teleop.get(teamNumber) ?? null;
  const endgame = bundle.endgame.get(teamNumber) ?? null;

  if (total === null && auto === null && teleop === null && endgame === null) {
    return null;
  }

  return { total, auto, teleop, endgame };
}

function buildOprTrend(matches: PlayedQualMatch[], teamNumber: number) {
  const trend: OprTrendPoint[] = [];

  matches.forEach((match, index) => {
    if (
      !match.redTeamNumbers.includes(teamNumber) &&
      !match.blueTeamNumbers.includes(teamNumber)
    ) {
      return;
    }

    const bundle = computeOprBundle(matches.slice(0, index + 1));
    const current = mapToBreakdown(bundle, teamNumber);
    if (!current) return;

    trend.push({
      sequence: trend.length + 1,
      label: `Q${match.matchNumber}`,
      total: current.total,
      auto: current.auto,
      teleop: current.teleop,
      endgame: current.endgame,
    });
  });

  return trend;
}

function sumAlliancePrediction(alliance: TeamMatchSide[], values: Map<number, number>) {
  if (alliance.length === 0) return null;

  let total = 0;

  for (const team of alliance) {
    const value = values.get(team.teamNumber);
    if (value === undefined) return null;
    total += value;
  }

  return round(total);
}

function probabilityFromMargin(margin: number, scale: number) {
  return 1 / (1 + Math.exp(-margin / scale));
}

function addPredictionsToMatches(
  matches: TeamMatch[],
  bundle: OprBundle,
  sampleSize: number,
) {
  const scale = Math.max(12, bundle.marginStdDev ?? 18);
  return matches.map((match) => {
    const predictedRedScore = sumAlliancePrediction(match.redAlliance, bundle.total);
    const predictedBlueScore = sumAlliancePrediction(match.blueAlliance, bundle.total);

    let redWinProbability: number | null = null;
    let blueWinProbability: number | null = null;
    let winProbability: number | null = null;

    if (predictedRedScore !== null && predictedBlueScore !== null) {
      const redProbability = probabilityFromMargin(predictedRedScore - predictedBlueScore, scale);
      redWinProbability = round(redProbability * 100, 1);
      blueWinProbability = round((1 - redProbability) * 100, 1);

      if (match.alliance !== null) {
        winProbability = match.alliance === "red" ? redWinProbability : blueWinProbability;
      }
    }

    return {
      ...match,
      predictedRedScore,
      predictedBlueScore,
      redWinProbability,
      blueWinProbability,
      winProbability,
      predictionSampleSize: sampleSize,
    };
  });
}

export async function getTeamSummaryData(
  teamNumber: number,
  requestedSeason?: number,
): Promise<TeamPageResult> {
  const currentSeason = await ftcApiClient.getCurrentSeason();
  const season = requestedSeason ?? currentSeason;

  const [
    seasonSummary,
    selectedTeamResponse,
    eventsResponse,
    quickStatsResponse,
    scoutEventsResponse,
  ] = await Promise.all([
    ftcApiClient.getSeasonSummary(season),
    ftcApiClient.getTeam(teamNumber, season),
    ftcApiClient.getTeamEvents(teamNumber, season),
    ftcScoutApiClient.getTeamQuickStats(teamNumber, season).catch(() => null),
    ftcScoutApiClient.getTeamEvents(teamNumber, season).catch(() => null),
  ]);

  let team =
    asArray(selectedTeamResponse.teams)
      .map(normalizeTeam)
      .find((value): value is TeamProfile => value !== null) ?? null;

  if (!team && season !== currentSeason) {
    const fallbackTeam = await ftcApiClient.getTeam(teamNumber, currentSeason).catch(() => null);
    team =
      asArray(fallbackTeam?.teams)
        .map(normalizeTeam)
        .find((value): value is TeamProfile => value !== null) ?? null;
  }

  const scoutEventStatsByCode = new Map<string, TeamEventStats>();
  for (const rawScoutEvent of asArray(scoutEventsResponse?.value)) {
    const parsed = normalizeTeamEventStats(rawScoutEvent);
    if (parsed) {
      scoutEventStatsByCode.set(parsed.eventCode.toUpperCase(), parsed.stats);
    }
  }

  const events = sortByDateDescending(
    asArray(eventsResponse.events)
      .map(normalizeEvent)
      .filter((event): event is EventSummary => event !== null),
  ).map((event) => {
    const stats = scoutEventStatsByCode.get(event.code.toUpperCase());

    return {
      eventCode: event.code,
      eventName: event.name,
      start: event.start,
      end: event.end,
      location: event.location,
      record: stats?.record ?? null,
      rank: stats?.rank ?? null,
      rp: typeof stats?.rp === "number" ? round(stats.rp, 2) : null,
      npAverage: typeof stats?.npAverage === "number" ? round(stats.npAverage) : null,
      npOpr: typeof stats?.npOpr === "number" ? round(stats.npOpr) : null,
      statsAvailable: stats?.statsAvailable ?? false,
    };
  });

  const comparedAgainst = quickStatsResponse?.count ?? null;
  const quickStats = quickStatsResponse
    ? {
        total: normalizeRankedValue(asObject(quickStatsResponse.tot) ?? null, comparedAgainst),
        auto: normalizeRankedValue(asObject(quickStatsResponse.auto) ?? null, comparedAgainst),
        teleop: normalizeRankedValue(asObject(quickStatsResponse.dc) ?? null, comparedAgainst),
        endgame: normalizeRankedValue(asObject(quickStatsResponse.eg) ?? null, comparedAgainst),
        comparedAgainst,
      }
    : null;

  return {
    teamNumber,
    season,
    seasonLabel: [season, seasonSummary.gameName].filter(Boolean).join(" "),
    currentSeason,
    team,
    quickStats,
    availableSeasons: createAvailableSeasons(team?.rookieYear ?? null, season, currentSeason),
    events,
  };
}

export async function getTeamEventDetails(
  teamNumber: number,
  eventCode: string,
  season?: number,
): Promise<TeamEventDetails | null> {
  const requestedSeason = season ?? (await ftcApiClient.getCurrentSeason());
  const eventsResponse = await ftcApiClient.getTeamEvents(teamNumber, requestedSeason);
  const eventExists = asArray(eventsResponse.events)
    .map(normalizeEvent)
    .filter((item): item is EventSummary => item !== null)
    .some((item) => item.code.toUpperCase() === eventCode.toUpperCase());

  if (!eventExists) {
    return null;
  }

  const [
    hybridQualificationSchedule,
    qualificationScores,
    qualSchedule,
    qualResults,
    playoffSchedule,
    playoffResults,
    awardsResponse,
  ] =
    await Promise.all([
      ftcApiClient
        .getHybridSchedule(eventCode, "qual", {
          season: requestedSeason,
        })
        .catch(() => ({ schedule: [] })),
      ftcApiClient
        .getScoreDetails(eventCode, "qual", {
          season: requestedSeason,
        })
        .catch(() => ({ matchScores: [] })),
      ftcApiClient.getSchedule(eventCode, "qual", {
        teamNumber,
        season: requestedSeason,
      }),
      ftcApiClient
        .getMatches(eventCode, "qual", {
          teamNumber,
          season: requestedSeason,
        })
        .catch(() => ({ matches: [] })),
      ftcApiClient
        .getSchedule(eventCode, "playoff", {
          teamNumber,
          season: requestedSeason,
        })
        .catch(() => ({ schedule: [] })),
      ftcApiClient
        .getMatches(eventCode, "playoff", {
          teamNumber,
          season: requestedSeason,
        })
        .catch(() => ({ matches: [] })),
      ftcApiClient
        .getTeamAwardsAtEvent(teamNumber, eventCode, requestedSeason)
        .catch(() => ({ awards: [] })),
    ]);

  const scoreIndex = createScoreDetailIndex(asArray(qualificationScores.matchScores));
  const playedQualificationMatches = asArray(hybridQualificationSchedule.schedule)
    .map((row) => parsePlayedQualificationMatch(row, scoreIndex))
    .filter((match): match is PlayedQualMatch => match !== null)
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.matchNumber - b.matchNumber;
    });

  const currentBundle = computeOprBundle(playedQualificationMatches);
  const currentOpr = mapToBreakdown(currentBundle, teamNumber);
  const oprTrend = buildOprTrend(playedQualificationMatches, teamNumber);

  const qualDisplayRows = mergeScheduleWithResults(
    asArray(qualSchedule.schedule),
    asArray(qualResults.matches),
  );

  // Index playoff results by description — the description (e.g. "Upper Bracket  Round 2 Match 3")
  // is unique per match and identical between the schedule and matches endpoints.
  // matchNumber alone is NOT unique (every match in this bracket is matchNumber=1).
  const playoffResultByDesc = new Map<string, Record<string, unknown>>();
  for (const raw of asArray(playoffResults.matches)) {
    const obj = asObject(raw);
    if (!obj) continue;
    const desc = pickString(obj, ["description"]);
    if (desc) playoffResultByDesc.set(desc.toLowerCase(), obj);
  }

  // Merge schedule rows (have team names) with result rows (have correct scores).
  const playoffDisplayRows = asArray(playoffSchedule.schedule).map((raw) => {
    const obj = asObject(raw);
    if (!obj) return raw;
    const desc = pickString(obj, ["description"]);
    if (!desc) return raw;
    const resultObj = playoffResultByDesc.get(desc.toLowerCase());
    if (!resultObj) return raw; // unplayed — no scores yet
    return {
      ...obj,
      scoreRedFinal: pickNumber(resultObj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]),
      scoreBlueFinal: pickNumber(resultObj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]),
      actualStartTime: pickString(resultObj, ["actualStartTime"]),
      postResultTime: pickString(resultObj, ["postResultTime"]),
    };
  });

  const matches = [...qualDisplayRows, ...playoffDisplayRows]
    .map((row) => parseDisplayMatch(row, teamNumber))
    .filter((match): match is TeamMatch => match !== null)
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.matchNumber - b.matchNumber;
    });

  return {
    eventCode,
    awards: parseAwards(asArray(awardsResponse.awards)),
    currentOpr,
    oprTrend,
    matches: addPredictionsToMatches(matches, currentBundle, playedQualificationMatches.length),
  };
}
