import Link from "next/link";

import TeamLookupForm from "./team-lookup";
import { ftcApiClient } from "@/lib/ftc-api-client";
import {
  getSeasonRecords,
  type MatchSeasonRecordRow,
} from "@/lib/ftcscout-records-data";

export const dynamic = "force-dynamic";

type ParsedEvent = {
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  location: string | null;
};

type AllianceTeam = {
  teamNumber: number | null;
  teamName: string | null;
};

type WorldRecordMatch = {
  eventCode: string | null;
  eventName: string;
  matchLabel: string;
  stage: string | null;
  redScore: number | null;
  blueScore: number | null;
  redAlliance: AllianceTeam[];
  blueAlliance: AllianceTeam[];
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

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function formatLocation(parts: Array<string | null | undefined>) {
  const filtered = parts.filter(
    (part): part is string => typeof part === "string" && part.trim() !== "",
  );
  return filtered.length > 0 ? filtered.join(", ") : null;
}

function normalizeEvent(raw: unknown): ParsedEvent | null {
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

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractDateKey(value: string | null) {
  if (!value) return null;
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function isEventOnDate(event: ParsedEvent, dateKey: string) {
  const start = extractDateKey(event.start);
  const end = extractDateKey(event.end) ?? start;
  if (!start || !end) return false;
  return start <= dateKey && dateKey <= end;
}

function formatHomeDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatScore(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2).replace(/\.00$/, "");
}

function normalizeStage(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.toUpperCase() === normalized ? normalized.toLowerCase() : normalized;
}

function buildWorldRecord(rows: MatchSeasonRecordRow[]) {
  const primary = rows[0];
  if (!primary) return null;

  const counterpart =
    rows.find(
      (row, index) =>
        index !== 0 &&
        row.eventCode === primary.eventCode &&
        row.matchLabel === primary.matchLabel &&
        row.alliance !== primary.alliance,
    ) ?? null;

  const redRow =
    primary.alliance === "Red"
      ? primary
      : counterpart?.alliance === "Red"
        ? counterpart
        : null;
  const blueRow =
    primary.alliance === "Blue"
      ? primary
      : counterpart?.alliance === "Blue"
        ? counterpart
        : null;

  return {
    eventCode: primary.eventCode,
    eventName: primary.eventName,
    matchLabel: primary.matchLabel,
    stage: normalizeStage(primary.tournamentLevel),
    redScore: redRow?.totalNp ?? null,
    blueScore: blueRow?.totalNp ?? null,
    redAlliance: [
      {
        teamNumber: redRow?.teamOneNumber ?? null,
        teamName: redRow?.teamOneName ?? null,
      },
      {
        teamNumber: redRow?.teamTwoNumber ?? null,
        teamName: redRow?.teamTwoName ?? null,
      },
    ].filter((team) => team.teamNumber !== null || team.teamName !== null),
    blueAlliance: [
      {
        teamNumber: blueRow?.teamOneNumber ?? null,
        teamName: blueRow?.teamOneName ?? null,
      },
      {
        teamNumber: blueRow?.teamTwoNumber ?? null,
        teamName: blueRow?.teamTwoName ?? null,
      },
    ].filter((team) => team.teamNumber !== null || team.teamName !== null),
  } satisfies WorldRecordMatch;
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

  return {
    redAlliance: teams
      .filter((team) => team.station.startsWith("red"))
      .map(({ teamNumber, teamName }) => ({ teamNumber, teamName })),
    blueAlliance: teams
      .filter((team) => team.station.startsWith("blue"))
      .map(({ teamNumber, teamName }) => ({ teamNumber, teamName })),
  };
}

function parseWorldRecordScheduleMatch(
  rawRows: unknown[],
  worldRecord: WorldRecordMatch,
) {
  for (const rawRow of rawRows) {
    const obj = asObject(rawRow);
    if (!obj) continue;

    if ((pickString(obj, ["description"]) ?? "") !== worldRecord.matchLabel) {
      continue;
    }

    const { redAlliance, blueAlliance } = getAllianceTeams(asArray(obj.teams));
    return {
      redScore: pickNumber(obj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]),
      blueScore: pickNumber(obj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]),
      redAlliance,
      blueAlliance,
    };
  }

  return null;
}

function AllianceList({
  teams,
  tone,
}: {
  teams: AllianceTeam[];
  tone: "red" | "blue";
}) {
  return (
    <div
      className={[
        "min-h-0 px-4 py-4",
        tone === "red" ? "bg-[#1b1010]" : "bg-[#0f1826]",
      ].join(" ")}
    >
      <div
        className={[
          "mb-3 text-[11px] uppercase tracking-[0.12em]",
          tone === "red" ? "text-[#efc3c3]" : "text-[#bfd4ff]",
        ].join(" ")}
      >
        {tone === "red" ? "Red Alliance" : "Blue Alliance"}
      </div>
      <div className="space-y-2">
        {teams.length > 0 ? (
          teams.map((team) => (
            <div key={`${tone}-${team.teamNumber ?? "team"}-${team.teamName ?? "name"}`}>
              <div className="text-lg font-medium text-white">
                {team.teamNumber ?? "N/A"}
              </div>
              <div className="text-base italic text-white/78">
                {team.teamName ?? "Unknown team"}
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-white/55">No teams listed</div>
        )}
      </div>
    </div>
  );
}

export default async function Home() {
  const today = new Date();
  const todayKey = toDateKey(today);
  const season = await ftcApiClient.getCurrentSeason();

  const [seasonSummary, seasonEventsResponse, matchRecords] = await Promise.all([
    ftcApiClient.getSeasonSummary(),
    ftcApiClient.getSeasonEvents().catch(() => ({ events: [] })),
          getSeasonRecords(season, "matches").catch(() => null),
  ]);

  const requestedSeason = season;
  const events = asArray(seasonEventsResponse.events)
    .map(normalizeEvent)
    .filter((event): event is ParsedEvent => event !== null);
  const todaysEvents = events
    .filter((event) => isEventOnDate(event, todayKey))
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 6);

  let worldRecord = matchRecords ? buildWorldRecord(matchRecords.rows as MatchSeasonRecordRow[]) : null;

  if (
    worldRecord &&
    worldRecord.eventCode &&
    (worldRecord.redAlliance.length === 0 ||
      worldRecord.blueAlliance.length === 0 ||
      worldRecord.redScore === null ||
      worldRecord.blueScore === null)
  ) {
    const schedule = await ftcApiClient
      .getHybridSchedule(
        worldRecord.eventCode,
        worldRecord.stage?.toLowerCase().includes("play") ? "playoff" : "qual",
        { season: requestedSeason },
      )
      .catch(() => null);

    const parsedScheduleMatch = schedule
      ? parseWorldRecordScheduleMatch(asArray(schedule.schedule), worldRecord)
      : null;

    if (parsedScheduleMatch) {
      worldRecord = {
        ...worldRecord,
        redScore: parsedScheduleMatch.redScore ?? worldRecord.redScore,
        blueScore: parsedScheduleMatch.blueScore ?? worldRecord.blueScore,
        redAlliance:
          parsedScheduleMatch.redAlliance.length > 0
            ? parsedScheduleMatch.redAlliance
            : worldRecord.redAlliance,
        blueAlliance:
          parsedScheduleMatch.blueAlliance.length > 0
            ? parsedScheduleMatch.blueAlliance
            : worldRecord.blueAlliance,
      };
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">

          {/* ── Hero ── */}
          <section className="relative overflow-hidden rounded-[14px] border border-white/8 bg-[#090909] px-6 py-12 text-center sm:px-10 sm:py-18">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-3xl" />

            <div className="relative">
              <h1 className="font-[family:var(--font-display)] text-6xl font-medium tracking-[-0.08em] text-white sm:text-7xl">
                depth
              </h1>

              <p className="mx-auto mt-4 max-w-xs text-base text-white/46 sm:max-w-sm">
                Win probabilities. Team analytics. Every FTC record.
              </p>

              {/* Win probability preview */}
              <div className="mx-auto mt-7 flex max-w-[15rem] overflow-hidden rounded-[10px] border border-white/8 bg-[#0d0d0d]">
                <div className="flex-1 px-4 py-3 text-center">
                  <div className="text-2xl font-medium tracking-[-0.04em] text-red-300/75">67%</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-white/24">Red</div>
                </div>
                <div className="w-px bg-white/8" />
                <div className="flex-1 px-4 py-3 text-center">
                  <div className="text-2xl font-medium tracking-[-0.04em] text-sky-300/65">33%</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-white/24">Blue</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/20">
                per-match win probability
              </div>

              <div className="mx-auto mt-7 max-w-lg">
                <TeamLookupForm buttonLabel="Open" compact season={season} scope="mixed" />
              </div>

              {(seasonSummary.teamCount || matchRecords) ? (
                <div className="mt-6 flex items-center justify-center gap-3 text-[12px] text-white/28">
                  {seasonSummary.teamCount ? (
                    <span>{seasonSummary.teamCount.toLocaleString()} teams this season</span>
                  ) : null}
                  {seasonSummary.teamCount && matchRecords ? (
                    <span className="h-3 w-px bg-white/14" />
                  ) : null}
                  {matchRecords ? (
                    <span>{matchRecords.count.toLocaleString()} match records</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Features ── */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Link
              href="/simulate"
              className="group rounded-[14px] border border-white/8 bg-[#090909] p-5 transition-colors hover:border-white/16 hover:bg-[#0b0b0b] sm:p-6"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28 transition-colors group-hover:text-white/44">
                Simulate
              </div>
              <div className="mt-3 text-base font-medium leading-snug tracking-[-0.03em] text-white">
                Win probabilities for every matchup
              </div>
              <div className="mt-2 text-sm leading-relaxed text-white/40">
                Pick any real FTC event and get per-match win percentages, forecasted scores, and predicted final standings.
              </div>
              <div className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/22 transition-colors group-hover:text-white/46">
                Run a simulation →
              </div>
            </Link>

            <Link
              href="/compare"
              className="group rounded-[14px] border border-white/8 bg-[#090909] p-5 transition-colors hover:border-white/16 hover:bg-[#0b0b0b] sm:p-6"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28 transition-colors group-hover:text-white/44">
                Compare
              </div>
              <div className="mt-3 text-base font-medium leading-snug tracking-[-0.03em] text-white">
                Stack up to 6 teams side by side
              </div>
              <div className="mt-2 text-sm leading-relaxed text-white/40">
                Compare any combination across auto, teleop, endgame, and total normalized points.
              </div>
              <div className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/22 transition-colors group-hover:text-white/46">
                Compare teams →
              </div>
            </Link>

            <Link
              href={`/season-records?season=${requestedSeason}&view=matches&rank=best&sort=totalNp`}
              className="group rounded-[14px] border border-white/8 bg-[#090909] p-5 transition-colors hover:border-white/16 hover:bg-[#0b0b0b] sm:p-6"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/28 transition-colors group-hover:text-white/44">
                Records
              </div>
              <div className="mt-3 text-base font-medium leading-snug tracking-[-0.03em] text-white">
                All-time rankings, every season
              </div>
              <div className="mt-2 text-sm leading-relaxed text-white/40">
                Leaderboards for highest match scores, top OPRs, and peak performances by season.
              </div>
              <div className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/22 transition-colors group-hover:text-white/46">
                View records →
              </div>
            </Link>
          </div>

          {/* ── Today's Events ── */}
          <section className="mt-3 rounded-[14px] border border-white/8 bg-[#090909] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div className="text-xl font-medium tracking-[-0.04em] text-white">
                Today&apos;s Events
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">
                {formatHomeDate(today)}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {todaysEvents.length > 0 ? (
                todaysEvents.map((event) => (
                  <article key={`${event.code}-${event.start ?? "date"}`} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">{event.name}</div>
                      <div className="mt-0.5 text-sm italic text-white/44">
                        {event.location ?? "Location unavailable"}
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5 font-mono text-xs text-white/22">{event.code}</div>
                  </article>
                ))
              ) : (
                <div className="py-2 text-sm text-white/40">
                  No published events are active on {formatHomeDate(today)}.
                </div>
              )}
            </div>
          </section>

          {/* ── World Record ── */}
          <section className="mt-3 rounded-[14px] border border-white/8 bg-[#090909] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div className="text-xl font-medium tracking-[-0.04em] text-white">
                World Record
              </div>
              <Link
                href={`/season-records?season=${requestedSeason}&view=matches&rank=best&sort=totalNp`}
                className="rounded-[10px] border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/42 transition-colors hover:text-white"
              >
                open records
              </Link>
            </div>

            {worldRecord ? (
              <div className="mt-4 rounded-[10px] border border-white/10 bg-[#101010]">
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="text-base font-medium text-white">{worldRecord.eventName}</div>
                </div>

                <div className="hidden grid-cols-[8rem_9rem_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-white/10 text-center md:grid">
                  <div className="bg-[#111111] px-4 py-3 text-base font-medium text-white">Match</div>
                  <div className="bg-[#111111] px-4 py-3 text-base font-medium text-white">Score</div>
                  <div className="bg-[#1b1010] px-4 py-3 text-base font-medium text-white">Red Alliance</div>
                  <div className="bg-[#0f1826] px-4 py-3 text-base font-medium text-white">Blue Alliance</div>
                </div>

                <div className="grid gap-px bg-white/10 md:grid-cols-[8rem_9rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="bg-[#111111] px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/40 md:hidden">
                      Match
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      {worldRecord.matchLabel}
                    </div>
                    {worldRecord.stage ? (
                      <div className="mt-2 inline-flex rounded-[8px] border border-white/10 bg-[#1a1a1a] px-3 py-1 text-sm text-white/70">
                        {worldRecord.stage}
                      </div>
                    ) : null}
                  </div>

                  <div className="bg-[#111111] px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/40 md:hidden">
                      Score
                    </div>
                    <div className="mt-2 text-2xl font-medium text-white">
                      {formatScore(worldRecord.redScore)} – {formatScore(worldRecord.blueScore)}
                    </div>
                  </div>

                  <AllianceList teams={worldRecord.redAlliance} tone="red" />
                  <AllianceList teams={worldRecord.blueAlliance} tone="blue" />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[10px] border border-white/10 bg-[#101010] px-4 py-8 text-sm text-white/42">
                World-record data is unavailable right now.
              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
