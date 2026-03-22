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

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—");
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return collapseWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/?(?:span|strong|em|i|b)[^>]*>/gi, "")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function extractFirstHref(value: string) {
  const match = value.match(/href=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function parseOrdinal(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseTeamText(value: string) {
  const match = value.match(/^(\d{1,5})\s+(.+)$/);
  if (!match) {
    return {
      teamNumber: parseOrdinal(value),
      teamName: value || null,
    };
  }

  return {
    teamNumber: Number(match[1]),
    teamName: collapseWhitespace(match[2]) || null,
  };
}

function extractEventCodeFromHref(href: string | null) {
  if (!href) return null;
  const match = href.match(/\/events\/\d{4}\/([^/?#]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_INDEX = new Map(
  MONTH_NAMES.map((month, index) => [month.toLowerCase(), index + 1]),
);

function toIsoDate(year: number, monthName: string, day: number) {
  const month = MONTH_INDEX.get(monthName.toLowerCase());
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseHumanEventDate(text: string) {
  const normalized = collapseWhitespace(text.replace(/[–—]/g, "-"));

  let match = normalized.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    const iso = toIsoDate(Number(year), month, Number(day));
    return { eventStart: iso, eventEnd: iso };
  }

  match = normalized.match(/^([A-Za-z]+) (\d{1,2}) - (\d{1,2}), (\d{4})$/);
  if (match) {
    const [, month, startDay, endDay, year] = match;
    return {
      eventStart: toIsoDate(Number(year), month, Number(startDay)),
      eventEnd: toIsoDate(Number(year), month, Number(endDay)),
    };
  }

  match = normalized.match(/^([A-Za-z]+) (\d{1,2}) - ([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (match) {
    const [, startMonth, startDay, endMonth, endDay, year] = match;
    return {
      eventStart: toIsoDate(Number(year), startMonth, Number(startDay)),
      eventEnd: toIsoDate(Number(year), endMonth, Number(endDay)),
    };
  }

  return { eventStart: null, eventEnd: null };
}

function parseEventText(value: string) {
  const monthPattern =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i;
  const match = monthPattern.exec(value);

  if (!match || match.index === undefined) {
    return {
      eventName: collapseWhitespace(value) || "Unknown event",
      eventStart: null,
      eventEnd: null,
    };
  }

  const eventName = collapseWhitespace(value.slice(0, match.index)) || "Unknown event";
  const dateText = collapseWhitespace(value.slice(match.index));
  return {
    eventName,
    ...parseHumanEventDate(dateText),
  };
}

function extractTableRows(html: string) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((tableMatch) =>
    [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((rowMatch) =>
      [...rowMatch[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cellMatch) => ({
        html: cellMatch[1],
        text: stripHtml(cellMatch[1]),
      })),
    ),
  );
}

function findColumnIndex(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function extractVisibleCount(html: string, fallback: number) {
  const stripped = stripHtml(html);
  const matches = [...stripped.matchAll(/\/\s*(\d{1,6})/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= fallback);

  return matches.length > 0 ? Math.max(...matches) : fallback;
}

function findRecordsPayload(value: unknown): { rows: unknown[]; count: number } | null {
  const obj = asObject(value);
  if (!obj) return null;

  if (Array.isArray(obj.rows) && typeof obj.count === "number") {
    return {
      rows: obj.rows,
      count: obj.count,
    };
  }

  for (const child of Object.values(obj)) {
    const nested = findRecordsPayload(child);
    if (nested) return nested;
  }

  return null;
}

function extractRecordsPayload(html: string) {
  const scriptPattern =
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;

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

function extractRowsFromRenderedTable(html: string, view: SeasonRecordsView): SeasonRecordsDataset | null {
  const tables = extractTableRows(html);

  for (const rows of tables) {
    if (rows.length < 2) continue;
    const headers = rows[0].map((cell) => cell.text.toLowerCase());

    if (view === "teams") {
      const teamIndex = findColumnIndex(headers, [/^team$/i]);
      const npOprIndex = findColumnIndex(headers, [/np\s*opr/i]);
      const autoIndex = findColumnIndex(headers, [/auto\s*opr/i]);
      const teleopIndex = findColumnIndex(headers, [/teleop\s*opr/i]);
      const avgIndex = findColumnIndex(headers, [/np\s*avg/i]);
      const rankIndex = findColumnIndex(headers, [/^rank$/i]);
      const eventIndex = findColumnIndex(headers, [/^event$/i]);
      const recordIndex = findColumnIndex(headers, [/^record$/i]);

      if (
        teamIndex === -1 ||
        npOprIndex === -1 ||
        autoIndex === -1 ||
        teleopIndex === -1 ||
        avgIndex === -1 ||
        rankIndex === -1 ||
        eventIndex === -1 ||
        recordIndex === -1
      ) {
        continue;
      }

      const parsedRows = rows
        .slice(1)
        .map((cells) => {
          if (cells.length <= recordIndex) return null;

          const team = parseTeamText(cells[teamIndex]?.text ?? "");
          const event = parseEventText(cells[eventIndex]?.text ?? "");

          return {
            kind: "team" as const,
            rankBest: parseOrdinal(cells[0]?.text ?? ""),
            rankBestSkip: 0,
            rankAll: parseOrdinal(cells[0]?.text ?? ""),
            rankAllSkip: 0,
            teamNumber: team.teamNumber,
            teamName: team.teamName,
            eventCode: extractEventCodeFromHref(extractFirstHref(cells[eventIndex]?.html ?? "")),
            eventName: event.eventName,
            eventStart: event.eventStart,
            eventEnd: event.eventEnd,
            npOpr: round(asNumber(cells[npOprIndex]?.text)),
            autoOpr: round(asNumber(cells[autoIndex]?.text)),
            teleopOpr: round(asNumber(cells[teleopIndex]?.text)),
            npAverage: round(asNumber(cells[avgIndex]?.text)),
            eventRank: parseOrdinal(cells[rankIndex]?.text ?? ""),
            record: collapseWhitespace(cells[recordIndex]?.text ?? "") || null,
          } satisfies TeamSeasonRecordRow;
        })
        .filter((row): row is TeamSeasonRecordRow => row !== null);

      if (parsedRows.length > 0) {
        return {
          count: extractVisibleCount(html, parsedRows.length),
          rows: parsedRows,
        };
      }
    } else {
      const totalIndex = findColumnIndex(headers, [/^total(\s*np)?$/i]);
      const autoIndex = findColumnIndex(headers, [/^auto$/i]);
      const teleopIndex = findColumnIndex(headers, [/^(teleop|dc)$/i]);
      const teamOneIndex = findColumnIndex(headers, [/team\s*1/i]);
      const teamTwoIndex = findColumnIndex(headers, [/team\s*2/i]);
      const eventIndex = findColumnIndex(headers, [/^event$/i]);
      const matchIndex = findColumnIndex(headers, [/match/i]);
      const allianceIndex = findColumnIndex(headers, [/alliance/i]);

      if (
        totalIndex === -1 ||
        autoIndex === -1 ||
        teleopIndex === -1 ||
        teamOneIndex === -1 ||
        teamTwoIndex === -1 ||
        eventIndex === -1 ||
        matchIndex === -1 ||
        allianceIndex === -1
      ) {
        continue;
      }

      const parsedRows = rows
        .slice(1)
        .map((cells) => {
          if (cells.length <= allianceIndex) return null;

          const teamOne = parseTeamText(cells[teamOneIndex]?.text ?? "");
          const teamTwo = parseTeamText(cells[teamTwoIndex]?.text ?? "");
          const event = parseEventText(cells[eventIndex]?.text ?? "");
          const matchLabel = collapseWhitespace(cells[matchIndex]?.text ?? "") || "Match";
          const tournamentLevel = matchLabel.includes("-") ? matchLabel.split("-")[0] : null;

          return {
            kind: "match" as const,
            rankBest: parseOrdinal(cells[0]?.text ?? ""),
            rankBestSkip: 0,
            rankAll: parseOrdinal(cells[0]?.text ?? ""),
            rankAllSkip: 0,
            eventCode: extractEventCodeFromHref(extractFirstHref(cells[eventIndex]?.html ?? "")),
            eventName: event.eventName,
            eventStart: event.eventStart,
            eventEnd: event.eventEnd,
            matchLabel,
            tournamentLevel,
            alliance:
              /red/i.test(cells[allianceIndex]?.text ?? "")
                ? "Red"
                : /blue/i.test(cells[allianceIndex]?.text ?? "")
                  ? "Blue"
                  : null,
            totalNp: round(asNumber(cells[totalIndex]?.text)),
            autoPoints: round(asNumber(cells[autoIndex]?.text)),
            teleopPoints: round(asNumber(cells[teleopIndex]?.text)),
            teamOneNumber: teamOne.teamNumber,
            teamOneName: teamOne.teamName,
            teamTwoNumber: teamTwo.teamNumber,
            teamTwoName: teamTwo.teamName,
          } satisfies MatchSeasonRecordRow;
        })
        .filter((row): row is MatchSeasonRecordRow => row !== null);

      if (parsedRows.length > 0) {
        return {
          count: extractVisibleCount(html, parsedRows.length),
          rows: parsedRows,
        };
      }
    }
  }

  return null;
}

function normalizeRankSkip(value: number | null) {
  return value ?? 0;
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

export async function getSeasonRecords(season: number, view: SeasonRecordsView) {
  const cacheKey = `${season}:${view}`;
  const cached = cacheManager.get<SeasonRecordsDataset>("ftcscout-records", cacheKey);
  if (cached) {
    return cached;
  }

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
  let dataset: SeasonRecordsDataset | null = null;

  try {
    const parsed = extractRecordsPayload(html);
    dataset = {
      count: parsed.count,
      rows: normalizeRows(view, parsed.rows),
    };
  } catch {
    dataset = extractRowsFromRenderedTable(html, view);
  }

  if (!dataset) {
    dataset = {
      count: 0,
      rows: [],
    };
  }

  cacheManager.set("ftcscout-records", cacheKey, dataset, CACHE_TTL.EVENTS);
  return dataset;
}
