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

function createQueryString(
  season: number,
  view: SeasonRecordsView,
  rankMode: SeasonRankMode,
  region: string,
  eventType: string,
  startDate: string,
  endDate: string,
  sort: string,
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
  return params.toString();
}

function displayRank(
  row: TeamSeasonRecordRow | MatchSeasonRecordRow,
  rankMode: SeasonRankMode,
) {
  const rank = rankMode === "best" ? row.rankBest : row.rankAll;
  const skip = rankMode === "best" ? row.rankBestSkip : row.rankAllSkip;
  return skip > 0 ? "" : formatOrdinal(rank);
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className="mt-2 text-base text-white/88">{value}</div>
    </div>
  );
}

function TeamRowCard({
  row,
  rankMode,
}: {
  row: TeamSeasonRecordRow;
  rankMode: SeasonRankMode;
}) {
  const display = displayRank(row, rankMode);

  return (
    <article className="rounded-[12px] border border-white/10 bg-[#101010] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {display ? (
              <div className="rounded-[8px] border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm uppercase tracking-[0.12em] text-white/72">
                {display}
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                {row.teamNumber ?? "N/A"}
              </div>
              <div className="truncate text-base italic text-white/72">
                {row.teamName ?? "Unknown team"}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-base text-white">{row.eventName}</div>
            <div className="mt-1 text-sm italic text-white/48">
              {formatEventDate(row.eventStart, row.eventEnd)}
            </div>
          </div>
        </div>

        <div className="rounded-[10px] border border-white/10 bg-[#0b0b0b] px-4 py-3 lg:min-w-[11rem]">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Record</div>
          <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
            {row.record ?? "N/A"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="np OPR" value={formatNumber(row.npOpr)} />
        <MetricCard label="Auto OPR" value={formatNumber(row.autoOpr)} />
        <MetricCard label="Teleop OPR" value={formatNumber(row.teleopOpr)} />
        <MetricCard label="np AVG" value={formatNumber(row.npAverage)} />
        <MetricCard label="Event Rank" value={formatOrdinal(row.eventRank) || "N/A"} />
      </div>
    </article>
  );
}

function MatchRowCard({
  row,
  rankMode,
}: {
  row: MatchSeasonRecordRow;
  rankMode: SeasonRankMode;
}) {
  const display = displayRank(row, rankMode);

  return (
    <article className="rounded-[12px] border border-white/10 bg-[#101010] p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {display ? (
              <div className="rounded-[8px] border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm uppercase tracking-[0.12em] text-white/72">
                {display}
              </div>
            ) : null}
            <div className="rounded-[8px] border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm uppercase tracking-[0.12em] text-white/72">
              {row.matchLabel}
            </div>
            {row.alliance ? (
              <div className="rounded-[8px] border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm uppercase tracking-[0.12em] text-white/72">
                {row.alliance}
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="text-base text-white">{row.eventName}</div>
            <div className="mt-1 text-sm italic text-white/48">
              {formatEventDate(row.eventStart, row.eventEnd)}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total NP" value={formatNumber(row.totalNp)} />
          <MetricCard label="Auto" value={formatNumber(row.autoPoints)} />
          <MetricCard label="Teleop" value={formatNumber(row.teleopPoints)} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Team 1</div>
            <div className="mt-2 text-lg text-white">{row.teamOneNumber ?? "N/A"}</div>
            <div className="text-base italic text-white/72">{row.teamOneName ?? "Unknown team"}</div>
          </div>
          <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Team 2</div>
            <div className="mt-2 text-lg text-white">{row.teamTwoNumber ?? "N/A"}</div>
            <div className="text-base italic text-white/72">{row.teamTwoName ?? "Unknown team"}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TeamRecordsTable({
  rows,
  rankMode,
}: {
  rows: TeamSeasonRecordRow[];
  rankMode: SeasonRankMode;
}) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-white/10 bg-[#101010] px-4 py-8 text-center text-base text-white/52">
          No team records matched these filters.
        </div>
      ) : (
        rows.map((row, index) => (
          <TeamRowCard
            key={`${row.eventCode ?? "event"}:${row.teamNumber ?? "team"}:${index}`}
            row={row}
            rankMode={rankMode}
          />
        ))
      )}
    </div>
  );
}

function MatchRecordsTable({
  rows,
  rankMode,
}: {
  rows: MatchSeasonRecordRow[];
  rankMode: SeasonRankMode;
}) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-white/10 bg-[#101010] px-4 py-8 text-center text-base text-white/52">
          No match records matched these filters.
        </div>
      ) : (
        rows.map((row, index) => (
          <MatchRowCard
            key={`${row.eventCode ?? "event"}:${row.matchLabel}:${row.alliance ?? "alliance"}:${index}`}
            row={row}
            rankMode={rankMode}
          />
        ))
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
  const hydrationSafeProps = { suppressHydrationWarning: true };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Season Records</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            {heading}
          </h1>

          <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              Showing {sortedRows.length} of {records.count.toLocaleString()} rows
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

          <div className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] p-3">
            {view === "teams" ? (
              <TeamRecordsTable rows={sortedRows as TeamSeasonRecordRow[]} rankMode={rankMode} />
            ) : (
              <MatchRecordsTable rows={sortedRows as MatchSeasonRecordRow[]} rankMode={rankMode} />
            )}
          </div>
        </section>

        <section className="mt-4 text-sm text-white/42">
          FTC data for {requestedSeason} {selectedSeasonSummary.gameName ?? formatSeasonLabel(requestedSeason)}.
        </section>
      </div>
    </main>
  );
}
