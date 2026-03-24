import Link from "next/link";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { getSeasonRecords, type MatchSeasonRecordRow } from "@/lib/ftcscout-records-data";
import { getScatterTeams } from "@/lib/scatter-data";
import OprScatter from "./opr-scatter";
import TeamLookupForm from "./team-lookup";

export const dynamic = "force-dynamic";

type ParsedEvent = {
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  location: string | null;
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

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function formatLocation(parts: Array<string | null | undefined>) {
  return parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(", ") || null;
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function Home() {
  const today = new Date();
  const todayKey = toDateKey(today);
  const season = await ftcApiClient.getCurrentSeason();

  const [seasonSummary, seasonEventsResponse, matchRecords, scatterTeams] = await Promise.all([
    ftcApiClient.getSeasonSummary().catch(() => ({ teamCount: null as number | null })),
    ftcApiClient.getSeasonEvents().catch(() => ({ events: [] })),
    getSeasonRecords(season, "matches").catch(() => null),
    getScatterTeams(season, 500).catch(() => []),
  ]);

  const events = asArray(seasonEventsResponse.events)
    .map(normalizeEvent)
    .filter((e): e is ParsedEvent => e !== null);

  const todaysEvents = events
    .filter((e) => isEventOnDate(e, todayKey))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, 8);

  // Top match score
  const topMatch = matchRecords?.rows[0] as MatchSeasonRecordRow | undefined;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-[14px] border border-white/8 bg-[#090909] px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-3xl" />
          <div className="relative">
            <h1 className="font-[family:var(--font-display)] text-6xl font-medium tracking-[-0.08em] text-white sm:text-7xl">
              depth
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-base text-white/46 sm:max-w-sm">
              Win probabilities. Team analytics. Every FTC record.
            </p>
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

        {/* Scatter plot — top 1000 teams */}
        <div className="mt-4">
          {scatterTeams.length > 0 ? (
            <OprScatter teams={scatterTeams} season={season} />
          ) : (
            <div className="rounded-[12px] border border-white/8 bg-[#090909] px-5 py-8 text-sm text-white/36 text-center">
              OPR distribution unavailable — season data not yet loaded.
            </div>
          )}
        </div>

        {/* Main row — today's events + sidebar */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">

          {/* Today's Events */}
          <section className="rounded-[12px] border border-white/8 bg-[#090909] p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
              <div className="text-base font-medium tracking-[-0.03em] text-white">Today&apos;s Events</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">
                {formatHomeDate(today)}
              </div>
            </div>
            <div className="mt-4">
              {todaysEvents.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {todaysEvents.map((event) => (
                    <Link
                      key={event.code}
                      href={`/matches?eventCode=${encodeURIComponent(event.code)}&season=${season}&eventQuery=${encodeURIComponent(event.name)}`}
                      className="group rounded-[10px] border border-white/8 bg-[#0d0d0d] px-3 py-2.5 transition-colors hover:border-white/14"
                    >
                      <div className="text-sm font-medium text-white/88 group-hover:text-white">{event.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-white/38">
                        <span className="font-mono">{event.code}</span>
                        {event.location ? <span className="truncate italic">{event.location}</span> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-sm text-white/40">No published events active today.</p>
              )}
            </div>
          </section>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Quick links */}
            <nav className="rounded-[12px] border border-white/8 bg-[#090909] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-white/36 mb-3">Explore</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { href: "/simulate", label: "Simulate", desc: "Match predictions" },
                  { href: "/compare", label: "Compare", desc: "Side-by-side OPR" },
                  { href: `/season-records?season=${season}&view=teams&rank=best&sort=npOpr`, label: "Rankings", desc: "Top OPR leaderboard" },
                  { href: "/events", label: "Events", desc: "Season schedule" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-[10px] border border-white/8 bg-[#0d0d0d] px-3 py-2.5 transition-colors hover:border-white/14"
                  >
                    <div className="text-sm font-medium text-white/80 group-hover:text-white">{item.label}</div>
                    <div className="mt-0.5 text-xs text-white/36">{item.desc}</div>
                  </Link>
                ))}
              </div>
            </nav>

            {/* High score */}
            {topMatch ? (
              <section className="rounded-[12px] border border-white/8 bg-[#090909] p-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/8 pb-3">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-white/36">Season High Score</div>
                  <Link
                    href={`/season-records?season=${season}&view=matches&rank=best&sort=totalNp`}
                    className="text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-white/60"
                  >
                    all records →
                  </Link>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-semibold tracking-[-0.04em] text-white">
                    {topMatch.totalNp?.toFixed(0) ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-white/50">{topMatch.eventName}</div>
                  <div className="mt-0.5 text-xs text-white/34">{topMatch.matchLabel}</div>
                  {(topMatch.teamOneNumber || topMatch.teamTwoNumber) ? (
                    <div className="mt-2 flex gap-2 text-sm font-medium text-white/70">
                      {topMatch.teamOneNumber ? <span>{topMatch.teamOneNumber}</span> : null}
                      {topMatch.teamTwoNumber ? <span>{topMatch.teamTwoNumber}</span> : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>

      </div>
    </main>
  );
}
