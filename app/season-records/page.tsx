import { notFound } from "next/navigation";

import Link from "next/link";

import { ftcApiClient } from "@/lib/ftc-api-client";
import {
  getSeasonRecords,
  type MatchSeasonRecordRow,
  type SeasonRankMode,
  type SeasonRecordsView,
  type TeamSeasonRecordRow,
} from "@/lib/ftcscout-records-data";

export const dynamic = "force-dynamic";

type EventMeta = {
  regionCode: string | null;
  typeName: string | null;
};

type TeamSort = "npOpr" | "autoOpr" | "teleopOpr" | "npAverage";
type MatchSort = "totalNp" | "autoPoints" | "teleopPoints";

const SEASON_NAMES: Record<number, string> = {
  2025: "Decode",
  2024: "Into the Deep",
  2023: "Centerstage",
  2022: "Power Play",
  2021: "Freight Frenzy",
  2020: "Ultimate Goal",
  2019: "Skystone",
};

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

function formatSeasonLabel(season: number) {
  return `${season} ${SEASON_NAMES[season] ?? ""}`.trim();
}

function formatNumber(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function formatEventDate(start: string | null, end: string | null) {
  if (!start) return "No date";

  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  const startText = startDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!endDate || start === end) return startText;

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })} - ${endDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return `${startText} - ${endDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatOrdinal(rank: number | null) {
  if (!rank) return "";
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

function buildSeasonOptions(currentSeason: number) {
  const seasons: number[] = [];
  for (let season = currentSeason; season >= 2019; season -= 1) {
    seasons.push(season);
  }
  return seasons;
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

const PAGE_SIZE = 50;

function createQueryString(
  season: number,
  view: SeasonRecordsView,
  rankMode: SeasonRankMode,
  region: string,
  eventType: string,
  startDate: string,
  endDate: string,
  sort: string,
  page?: number,
) {
  const params = new URLSearchParams();
  params.set("season", String(season));
  params.set("view", view);
  params.set("rank", rankMode);
  if (region) params.set("region", region);
  if (eventType) params.set("eventType", eventType);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (sort) params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  return params.toString();
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function TeamRecordRow({ row, rank }: { row: TeamSeasonRecordRow; rank: number }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_5rem_5rem_5rem_5rem_4rem] items-center gap-x-4 rounded-[8px] border border-white/8 bg-[#101010] px-3 py-2.5 text-sm">
      <span className="tabular-nums text-white/40">{formatOrdinal(rank)}</span>
      <div className="min-w-0">
        <Link href={`/teams?q=${row.teamNumber}`} className="font-medium text-white hover:text-white/80">
          {row.teamNumber}
        </Link>
        <div className="truncate text-xs text-white/46 italic">{row.teamName ?? "—"}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-white/62">{row.eventName}</div>
        <div className="text-[10px] text-white/32">{formatEventDate(row.eventStart, row.eventEnd)}</div>
      </div>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.npOpr)}</span>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.autoOpr)}</span>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.teleopOpr)}</span>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.npAverage)}</span>
      <span className="tabular-nums text-right text-white/44">{formatOrdinal(row.eventRank) || "—"}</span>
    </div>
  );
}

function MatchRecordRow({ row, rank }: { row: MatchSeasonRecordRow; rank: number }) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.6fr)_5rem_5rem_5rem_minmax(0,1fr)] items-center gap-x-4 rounded-[8px] border border-white/8 bg-[#101010] px-3 py-2.5 text-sm">
      <span className="tabular-nums text-white/40">{formatOrdinal(rank)}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-white">{row.matchLabel}</span>
          {row.alliance ? (
            <span className={["text-[10px] font-semibold uppercase", row.alliance === "Red" ? "text-red-400/70" : "text-sky-400/70"].join(" ")}>
              {row.alliance}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[10px] text-white/32">{formatEventDate(row.eventStart, row.eventEnd)}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-white/62">{row.eventName}</div>
      </div>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.totalNp)}</span>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.autoPoints)}</span>
      <span className="tabular-nums text-right text-white/72">{formatNumber(row.teleopPoints)}</span>
      <div className="min-w-0 text-xs text-white/46 truncate">
        {[row.teamOneNumber, row.teamTwoNumber].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <div className={`grid items-center gap-x-4 px-3 pb-1.5 text-[10px] uppercase tracking-[0.1em] text-white/28 ${cols.length === 8 ? "grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_5rem_5rem_5rem_5rem_4rem]" : "grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.6fr)_5rem_5rem_5rem_minmax(0,1fr)]"}`}>
      {cols.map((col) => (
        <span key={col} className={col !== "Rank" && col !== "Team" && col !== "Event" && col !== "Match" && col !== "Teams" ? "text-right" : ""}>{col}</span>
      ))}
    </div>
  );
}

function TeamRecordsTable({ rows, pageOffset }: { rows: TeamSeasonRecordRow[]; pageOffset: number }) {
  return (
    <div>
      <TableHeader cols={["Rank", "Team", "Event", "np OPR", "Auto", "Teleop", "np Avg", "Ev Rank"]} />
      {rows.length === 0 ? (
        <div className="rounded-[8px] border border-white/8 bg-[#101010] px-4 py-6 text-center text-sm text-white/40">
          No records matched these filters.
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((row, index) => (
            <TeamRecordRow
              key={`${row.eventCode ?? "event"}:${row.teamNumber ?? "team"}:${index}`}
              row={row}
              rank={pageOffset + index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRecordsTable({ rows, pageOffset }: { rows: MatchSeasonRecordRow[]; pageOffset: number }) {
  return (
    <div>
      <TableHeader cols={["Rank", "Match", "Event", "Total NP", "Auto", "Teleop", "Teams"]} />
      {rows.length === 0 ? (
        <div className="rounded-[8px] border border-white/8 bg-[#101010] px-4 py-6 text-center text-sm text-white/40">
          No records matched these filters.
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map((row, index) => (
            <MatchRecordRow
              key={`${row.eventCode ?? "event"}:${row.matchLabel}:${row.alliance ?? "alliance"}:${index}`}
              row={row}
              rank={pageOffset + index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}


export default function SeasonRecordsPage() {
  notFound();
}