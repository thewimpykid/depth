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

export default async function SeasonRecordsPage(props: PageProps<"/season-records">) {
  const searchParams = await props.searchParams;
  const [currentSeason, seasonSummary] = await Promise.all([
    ftcApiClient.getCurrentSeason(),
    ftcApiClient.getSeasonSummary(),
  ]);

  const requestedSeason =
    typeof searchParams.season === "string" && /^\d{4}$/.test(searchParams.season)
      ? Number(searchParams.season)
      : currentSeason;
  const view =
    typeof searchParams.view === "string" && isView(searchParams.view)
      ? searchParams.view
      : "teams";
  const rankMode =
    typeof searchParams.rank === "string" && isRankMode(searchParams.rank)
      ? searchParams.rank
      : "best";
  const sort =
    typeof searchParams.sort === "string" &&
    (view === "teams" ? isTeamSort(searchParams.sort) : isMatchSort(searchParams.sort))
      ? searchParams.sort
      : view === "teams"
        ? "npOpr"
        : "totalNp";

  const region = typeof searchParams.region === "string" ? searchParams.region : "";
  const eventType = typeof searchParams.eventType === "string" ? searchParams.eventType : "";
  const startDate =
    typeof searchParams.startDate === "string" && isDateInput(searchParams.startDate)
      ? searchParams.startDate
      : "";
  const endDate =
    typeof searchParams.endDate === "string" && isDateInput(searchParams.endDate)
      ? searchParams.endDate
      : "";
  const page =
    typeof searchParams.page === "string" && /^\d+$/.test(searchParams.page)
      ? Math.max(1, Number(searchParams.page))
      : 1;

  const [records, eventsResponse, selectedSeasonSummary] = await Promise.all([
    getSeasonRecords(requestedSeason, view),
    ftcApiClient.getSeasonEvents(requestedSeason).catch(() => ({ events: [] })),
    requestedSeason === currentSeason
      ? Promise.resolve(seasonSummary)
      : ftcApiClient.getSeasonSummary(requestedSeason).catch(() => ({ gameName: null })),
  ]);

  const eventMetadata = buildEventMetadata(asArray(eventsResponse.events));

  const regionOptions = Array.from(
    new Set(
      Array.from(eventMetadata.values())
        .map((event) => event.regionCode)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const eventTypeOptions = Array.from(
    new Set(
      Array.from(eventMetadata.values())
        .map((event) => event.typeName)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));

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

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOffset = (safePage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageOffset, pageOffset + PAGE_SIZE);

  const seasonOptions = buildSeasonOptions(currentSeason);
  const heading = `${formatSeasonLabel(requestedSeason)} Season Records`;
  const queryString = createQueryString(
    requestedSeason,
    view,
    rankMode,
    region,
    eventType,
    startDate,
    endDate,
    sort,
  );

  function pageUrl(p: number) {
    return `/season-records?${createQueryString(requestedSeason, view, rankMode, region, eventType, startDate, endDate, sort, p)}`;
  }
  const hydrationSafeProps = { suppressHydrationWarning: true };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">
            {heading}
          </h1>

          <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="rank" value={rankMode} />
            <input type="hidden" name="sort" value={sort} />

            <label className="block">
              <div className="mb-2 text-sm text-white/82">Season</div>
              <select
                {...hydrationSafeProps}
                name="season"
                defaultValue={String(requestedSeason)}
                className="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] px-4 text-lg text-white outline-none"
              >
                {seasonOptions.map((season) => (
                  <option key={season} value={season}>
                    {formatSeasonLabel(season)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/82">Regions</div>
              <select
                {...hydrationSafeProps}
                name="region"
                defaultValue={region}
                className="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] px-4 text-lg text-white outline-none"
              >
                <option value="">All</option>
                {regionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/82">Event Types</div>
              <select
                {...hydrationSafeProps}
                name="eventType"
                defaultValue={eventType}
                className="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] px-4 text-lg text-white outline-none"
              >
                <option value="">All</option>
                {eventTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="sm:col-span-2 lg:col-span-3">
              <div className="mb-2 text-sm text-white/82">Date Range</div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
                <input
                  {...hydrationSafeProps}
                  name="startDate"
                  type="date"
                  defaultValue={startDate}
                  className="h-12 rounded-[10px] border border-white/10 bg-[#111111] px-4 text-lg text-white outline-none"
                />
                <div className="text-center text-lg text-white/72">to</div>
                <input
                  {...hydrationSafeProps}
                  name="endDate"
                  type="date"
                  defaultValue={endDate}
                  className="h-12 rounded-[10px] border border-white/10 bg-[#111111] px-4 text-lg text-white outline-none"
                />
                <button
                  {...hydrationSafeProps}
                  type="submit"
                  className="h-12 rounded-[10px] border border-white/10 bg-[#111111] px-5 text-sm uppercase tracking-[0.18em] text-white/78"
                >
                  Apply
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-2 text-2xl font-medium tracking-[-0.04em]">
              <Link
                href={`/season-records?${createQueryString(
                  requestedSeason,
                  "teams",
                  rankMode,
                  region,
                  eventType,
                  startDate,
                  endDate,
                  view === "teams" ? sort : "npOpr",
                )}`}
                className={[
                  "rounded-[10px] px-4 py-3",
                  view === "teams" ? "bg-[#1f1f1f] text-white" : "text-white/72",
                ].join(" ")}
              >
                # Teams
              </Link>
              <Link
                href={`/season-records?${createQueryString(
                  requestedSeason,
                  "matches",
                  rankMode,
                  region,
                  eventType,
                  startDate,
                  endDate,
                  view === "matches" ? sort : "totalNp",
                )}`}
                className={[
                  "rounded-[10px] px-4 py-3",
                  view === "matches" ? "bg-[#1f1f1f] text-white" : "text-white/72",
                ].join(" ")}
              >
                Matches
              </Link>
            </div>

            <div className="text-sm text-white/48">
              {sortedRows.length.toLocaleString()} results
            </div>
          </div>

          <form className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-[#111111] p-3">
            <input type="hidden" name="season" value={requestedSeason} />
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="region" value={region} />
            <input type="hidden" name="eventType" value={eventType} />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />

            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="sr-only">Statistics</span>
                <select
                  {...hydrationSafeProps}
                  name="sort"
                  defaultValue={sort}
                  className="h-11 rounded-[10px] border border-white/10 bg-[#0d0d0d] px-4 text-lg text-white outline-none"
                >
                  {view === "teams" ? (
                    <>
                      <option value="npOpr">np OPR</option>
                      <option value="autoOpr">Auto OPR</option>
                      <option value="teleopOpr">Teleop OPR</option>
                      <option value="npAverage">np AVG</option>
                    </>
                  ) : (
                    <>
                      <option value="totalNp">Total NP</option>
                      <option value="autoPoints">Auto</option>
                      <option value="teleopPoints">Teleop</option>
                    </>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="sr-only">Rank mode</span>
                <select
                  {...hydrationSafeProps}
                  name="rank"
                  defaultValue={rankMode}
                  className="h-11 rounded-[10px] border border-white/10 bg-[#0d0d0d] px-4 text-lg text-white outline-none"
                >
                  <option value="best">Rank Best Results</option>
                  <option value="all">Rank All Results</option>
                </select>
              </label>

              <button
                {...hydrationSafeProps}
                type="submit"
                className="h-11 rounded-[10px] border border-white/10 bg-[#0d0d0d] px-4 text-sm uppercase tracking-[0.18em] text-white/78"
              >
                Update
              </button>
            </div>

            <a
              href={`/api/season-records/export?${queryString}`}
              download
              className="inline-flex h-11 items-center rounded-[10px] border border-white/10 bg-[#0d0d0d] px-4 text-sm uppercase tracking-[0.18em] text-white/78"
            >
              Export CSV
            </a>
          </form>

          <div className="mt-4">
            {view === "teams" ? (
              <TeamRecordsTable rows={pagedRows as TeamSeasonRecordRow[]} pageOffset={pageOffset} />
            ) : (
              <MatchRecordsTable rows={pagedRows as MatchSeasonRecordRow[]} pageOffset={pageOffset} />
            )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-white/40">
                Page {safePage} of {totalPages} · {sortedRows.length.toLocaleString()} results
              </div>
              <div className="flex items-center gap-1">
                {safePage > 1 ? (
                  <Link
                    href={pageUrl(safePage - 1)}
                    className="rounded-[8px] border border-white/10 bg-[#111111] px-3 py-1.5 text-sm text-white/70 hover:text-white"
                  >
                    ← Prev
                  </Link>
                ) : null}
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (safePage <= 4) {
                    p = i + 1;
                  } else if (safePage >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = safePage - 3 + i;
                  }
                  return (
                    <Link
                      key={p}
                      href={pageUrl(p)}
                      className={[
                        "rounded-[8px] border px-3 py-1.5 text-sm tabular-nums",
                        p === safePage
                          ? "border-white/20 bg-white text-black font-medium"
                          : "border-white/10 bg-[#111111] text-white/60 hover:text-white",
                      ].join(" ")}
                    >
                      {p}
                    </Link>
                  );
                })}
                {safePage < totalPages ? (
                  <Link
                    href={pageUrl(safePage + 1)}
                    className="rounded-[8px] border border-white/10 bg-[#111111] px-3 py-1.5 text-sm text-white/70 hover:text-white"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 text-sm text-white/42">
          FTC data for {requestedSeason} {selectedSeasonSummary.gameName ?? formatSeasonLabel(requestedSeason)}.
        </section>
      </div>
    </main>
  );
}
