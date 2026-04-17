import { NextResponse } from "next/server";

import { ftcApiClient } from "@/lib/ftc-api-client";

export const maxDuration = 60;
import {
  getSeasonRecords,
  type MatchSeasonRecordRow,
  type SeasonRankMode,
  type SeasonRecordsView,
  type TeamSeasonRecordRow,
} from "@/lib/ftcscout-records-data";

type EventMeta = {
  regionCode: string | null;
  typeName: string | null;
};

type TeamSort = "npOpr" | "autoOpr" | "teleopOpr" | "npAverage";
type MatchSort = "totalNp" | "autoPoints" | "teleopPoints";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function pickString(obj: Record<string, unknown> | null, keys: string[]) {
  if (!obj) return null;
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function isView(value: string): value is SeasonRecordsView {
  return value === "teams" || value === "matches";
}

function isRankMode(value: string): value is SeasonRankMode {
  return value === "best" || value === "all";
}

function isTeamSort(value: string): value is TeamSort {
  return value === "npOpr" || value === "autoOpr" || value === "teleopOpr" || value === "npAverage";
}

function isMatchSort(value: string): value is MatchSort {
  return value === "totalNp" || value === "autoPoints" || value === "teleopPoints";
}

function isDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildEventMetadata(events: unknown[]) {
  const metadata = new Map<string, EventMeta>();

  for (const rawEvent of events) {
    const event = asObject(rawEvent);
    if (!event) continue;
    const code = pickString(event, ["code", "eventCode"]);
    if (!code) continue;

    metadata.set(code.toUpperCase(), {
      regionCode: pickString(event, ["regionCode"]),
      typeName: pickString(event, ["typeName"]),
    });
  }

  return metadata;
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function csvEscape(value: string | number | null) {
  const stringValue = value === null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentSeason = await ftcApiClient.getCurrentSeason();

  const requestedSeason =
    /^\d{4}$/.test(url.searchParams.get("season") ?? "")
      ? Number(url.searchParams.get("season"))
      : currentSeason;
  const viewParam = url.searchParams.get("view") ?? "";
  const view = isView(viewParam) ? viewParam : "teams";
  const rankParam = url.searchParams.get("rank") ?? "";
  const rankMode = isRankMode(rankParam) ? rankParam : "best";
  const sortParam = url.searchParams.get("sort") ?? "";
  const sort =
    view === "teams"
      ? isTeamSort(sortParam)
        ? sortParam
        : "npOpr"
      : isMatchSort(sortParam)
        ? sortParam
        : "totalNp";

  const region = url.searchParams.get("region") ?? "";
  const eventType = url.searchParams.get("eventType") ?? "";
  const startDate = isDateInput(url.searchParams.get("startDate") ?? "")
    ? (url.searchParams.get("startDate") ?? "")
    : "";
  const endDate = isDateInput(url.searchParams.get("endDate") ?? "")
    ? (url.searchParams.get("endDate") ?? "")
    : "";

  const [records, eventsResponse] = await Promise.all([
    getSeasonRecords(requestedSeason, view),
    ftcApiClient.getSeasonEvents(requestedSeason).catch(() => ({ events: [] })),
  ]);

  const eventMetadata = buildEventMetadata(asArray(eventsResponse.events));

  const filteredRows = records.rows.filter((row) => {
    const meta = row.eventCode ? eventMetadata.get(row.eventCode.toUpperCase()) : undefined;
    if (region && meta?.regionCode !== region) return false;
    if (eventType && meta?.typeName !== eventType) return false;
    if (startDate && row.eventStart && row.eventStart < startDate) return false;
    if (endDate && row.eventEnd && row.eventEnd > endDate) return false;
    return true;
  });

  const sortedRows =
    view === "teams"
      ? [...filteredRows].sort((a, b) =>
          compareNullableNumbers(
            (a as TeamSeasonRecordRow)[sort as TeamSort],
            (b as TeamSeasonRecordRow)[sort as TeamSort],
          ),
        )
      : [...filteredRows].sort((a, b) =>
          compareNullableNumbers(
            (a as MatchSeasonRecordRow)[sort as MatchSort],
            (b as MatchSeasonRecordRow)[sort as MatchSort],
          ),
        );

  const lines =
    view === "teams"
      ? [
          [
            "rank_mode",
            "rank",
            "team_number",
            "team_name",
            "np_opr",
            "auto_opr",
            "teleop_opr",
            "np_avg",
            "event_rank",
            "event_name",
            "event_code",
            "event_start",
            "event_end",
            "record",
          ].join(","),
          ...sortedRows.map((rawRow) => {
            const row = rawRow as TeamSeasonRecordRow;
            const rank = rankMode === "best" ? row.rankBest : row.rankAll;
            return [
              csvEscape(rankMode),
              csvEscape(rank),
              csvEscape(row.teamNumber),
              csvEscape(row.teamName),
              csvEscape(row.npOpr),
              csvEscape(row.autoOpr),
              csvEscape(row.teleopOpr),
              csvEscape(row.npAverage),
              csvEscape(row.eventRank),
              csvEscape(row.eventName),
              csvEscape(row.eventCode),
              csvEscape(row.eventStart),
              csvEscape(row.eventEnd),
              csvEscape(row.record),
            ].join(",");
          }),
        ]
      : [
          [
            "rank_mode",
            "rank",
            "total_np",
            "auto_points",
            "teleop_points",
            "team_one_number",
            "team_one_name",
            "team_two_number",
            "team_two_name",
            "alliance",
            "match",
            "tournament_level",
            "event_name",
            "event_code",
            "event_start",
            "event_end",
          ].join(","),
          ...sortedRows.map((rawRow) => {
            const row = rawRow as MatchSeasonRecordRow;
            const rank = rankMode === "best" ? row.rankBest : row.rankAll;
            return [
              csvEscape(rankMode),
              csvEscape(rank),
              csvEscape(row.totalNp),
              csvEscape(row.autoPoints),
              csvEscape(row.teleopPoints),
              csvEscape(row.teamOneNumber),
              csvEscape(row.teamOneName),
              csvEscape(row.teamTwoNumber),
              csvEscape(row.teamTwoName),
              csvEscape(row.alliance),
              csvEscape(row.matchLabel),
              csvEscape(row.tournamentLevel),
              csvEscape(row.eventName),
              csvEscape(row.eventCode),
              csvEscape(row.eventStart),
              csvEscape(row.eventEnd),
            ].join(",");
          }),
        ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="depth-season-records-${requestedSeason}-${view}.csv"`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}
