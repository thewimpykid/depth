import Link from "next/link";

import SimulateControls from "./simulate-controls";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import {
  simulateActualEvent,
  type ActualEventMatch,
  type ActualEventStanding,
  searchSeasonEvents,
} from "@/lib/event-simulation";

export const dynamic = "force-dynamic";

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}

function fmtDateRange(start: string | null, end: string | null) {
  if (!start) return "Date unavailable";

  const startDate = new Date(start);
  const startText = startDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!end || end === start) return startText;

  const endDate = new Date(end);
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

function formatValue(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function formatProbability(value: number) {
  return `${value.toFixed(1)}%`;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[12px] border border-white/10 bg-[#090909] p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">{label}</div>
      <div className="mt-3 text-4xl font-medium tracking-[-0.06em] text-white">{value}</div>
    </article>
  );
}

function TeamStrengthChart({
  rows,
}: {
  rows: ActualEventStanding[];
}) {
  const items = rows.slice(0, 10);
  const max = Math.max(...items.map((row) => row.strength), 1);
  const width = 720;
  const left = 118;
  const right = 16;
  const barHeight = 26;
  const gap = 12;
  const top = 16;
  const bottom = 18;
  const height = top + bottom + items.length * barHeight + Math.max(0, items.length - 1) * gap;
  const chartWidth = width - left - right;

  return (
    <div className="rounded-[12px] border border-white/10 bg-[#101010] p-4">
      <div className="mb-4 text-lg font-medium text-white">Top Strengths</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Team strength comparison">
        {items.map((row, index) => {
          const y = top + index * (barHeight + gap);
          const barWidth = (row.strength / max) * chartWidth;
          const insideLabel = barWidth > 150;

          return (
            <g key={`strength-${row.teamNumber}`}>
              <text x={left - 10} y={y + 17} textAnchor="end" fill="rgba(255,255,255,0.66)" fontSize="12">
                {row.teamNumber}
              </text>
              <rect x={left} y={y} width={chartWidth} height={barHeight} rx="7" fill="rgba(255,255,255,0.06)" />
              <rect x={left} y={y} width={barWidth} height={barHeight} rx="7" fill="#8ea3ff" />
              <text
                x={left + 10}
                y={y + 17}
                fill={insideLabel ? "#050505" : "rgba(255,255,255,0.88)"}
                fontSize="12"
                fontWeight="600"
              >
                {row.name ?? `Team ${row.teamNumber}`}
              </text>
              <text
                x={Math.max(left + 10, left + barWidth - 10)}
                y={y + 17}
                textAnchor="end"
                fill={barWidth > 110 ? "#050505" : "rgba(255,255,255,0.88)"}
                fontSize="12"
                fontWeight="600"
              >
                {formatValue(row.strength)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StandingCard({
  row,
  season,
  index,
}: {
  row: ActualEventStanding;
  season: number;
  index: number;
}) {
  return (
    <article className="rounded-[12px] border border-white/10 bg-[#101010] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-[8px] border border-white/10 bg-[#0b0b0b] px-3 py-2 text-sm uppercase tracking-[0.12em] text-white/72">
              #{index + 1}
            </div>
            <div>
              <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                {row.teamNumber}
                {row.name ? ` - ${row.name}` : ""}
              </div>
            </div>
          </div>
        </div>

        <Link
          href={`/teams?q=${row.teamNumber}&season=${season}`}
          className="rounded-[10px] border border-white/10 bg-[#0b0b0b] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72"
        >
          Open team
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Expected Record</div>
          <div className="mt-2 text-base text-white/86">
            {row.expectedWins.toFixed(2)} - {row.expectedLosses.toFixed(2)} - {row.expectedTies.toFixed(2)}
          </div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Locked Record</div>
          <div className="mt-2 text-base text-white/86">
            {row.lockedWins} - {row.lockedLosses} - {row.lockedTies}
          </div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Average Seed</div>
          <div className="mt-2 text-base text-white/86">{row.averageSeed.toFixed(2)}</div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">1 Seed Chance</div>
          <div className="mt-2 text-base text-white/86">{formatProbability(row.firstSeedProbability)}</div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Top 4 Chance</div>
          <div className="mt-2 text-base text-white/86">{formatProbability(row.topFourProbability)}</div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Avg Score For</div>
          <div className="mt-2 text-base text-white/86">{formatValue(row.averageScoreFor)}</div>
        </div>
      </div>
    </article>
  );
}

function AlliancePanel({
  tone,
  winProbability,
  predictedScore,
  actualScore,
  teams,
}: {
  tone: "red" | "blue";
  winProbability: number;
  predictedScore: number;
  actualScore: number | null;
  teams: ActualEventMatch["redAlliance"];
}) {
  return (
    <div
      className={[
        "rounded-[10px] border px-4 py-4",
        tone === "red" ? "border-[#552222] bg-[#170d0d]" : "border-[#1e3a5f] bg-[#0d1520]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={[
            "text-[11px] uppercase tracking-[0.12em]",
            tone === "red" ? "text-[#f0b9b9]" : "text-[#bdd5ff]",
          ].join(" ")}
        >
          {tone === "red" ? "Red Alliance" : "Blue Alliance"}
        </div>
        <div className="rounded-[8px] border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/76">
          {formatProbability(winProbability)}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Projected</div>
          <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
            {formatValue(predictedScore)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Actual</div>
          <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
            {actualScore === null ? "TBD" : String(actualScore)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {teams.map((team) => (
          <div key={`${tone}-${team.teamNumber}`} className="rounded-[8px] border border-white/10 bg-black/15 px-3 py-3">
            <div className="text-base font-medium text-white">{team.teamNumber}</div>
            <div className="text-sm text-white/72">{team.name ?? "Unknown team"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: ActualEventMatch }) {
  return (
    <article className="rounded-[12px] border border-white/10 bg-[#090909] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">
            {match.status === "played" ? "Played Match" : "Upcoming Match"}
          </div>
          <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
            {match.label}
          </div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-sm text-white/76">
          {match.status === "played" ? "Locked result" : "Simulated outlook"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <AlliancePanel
          tone="red"
          winProbability={match.redWinProbability}
          predictedScore={match.predictedRedScore}
          actualScore={match.actualRedScore}
          teams={match.redAlliance}
        />
        <AlliancePanel
          tone="blue"
          winProbability={match.blueWinProbability}
          predictedScore={match.predictedBlueScore}
          actualScore={match.actualBlueScore}
          teams={match.blueAlliance}
        />
      </div>
    </article>
  );
}

export default async function SimulatePage(props: PageProps<"/simulate">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();

  const rawEventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery : "";
  const rawEventCode = typeof searchParams.eventCode === "string" ? searchParams.eventCode : "";
  const season =
    typeof searchParams.season === "string" && isSeason(searchParams.season)
      ? Number(searchParams.season)
      : currentSeason;
  const simulations = parseInteger(
    typeof searchParams.runs === "string" ? searchParams.runs : undefined,
    300,
    50,
    2000,
  );

  const eventQuery = rawEventQuery.trim();
  const eventCode = rawEventCode.trim().toUpperCase();
  const eventMatches = eventQuery ? await searchSeasonEvents(season, eventQuery, 12) : [];
  const selectedSimulation = eventCode
    ? await simulateActualEvent(season, eventCode, simulations)
    : null;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Simulate</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            simulate an event
          </h1>
          <p className="mt-3 max-w-3xl text-base text-white/58 sm:text-lg">
            Search a real FTC event, pick it, and simulate the published qualification schedule with current season team strength.
          </p>
          <SimulateControls
            key={`simulate-controls:${season}:${eventQuery}:${eventCode}:${simulations}`}
            initialEventQuery={eventQuery}
            initialSeason={season}
            initialRuns={simulations}
            seasonOptions={seasonOptions}
            matchedEvents={eventMatches}
            selectedEventCode={eventCode}
          />
        </section>

        {!eventQuery ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
            Search for an FTC event by name or event code to start.
          </section>
        ) : eventMatches.length === 0 && !selectedSimulation ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <>
            {eventCode && !selectedSimulation ? (
              <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-[#ff9c9c]">
                That event could not be loaded for simulation.
              </section>
            ) : null}

            {selectedSimulation ? (
              <>
                <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/34">Selected Event</div>
                      <div className="mt-3 text-3xl font-medium tracking-[-0.06em] text-white sm:text-4xl">
                        {selectedSimulation.event.name}
                      </div>
                      <div className="mt-3 text-base text-white/74">
                        {fmtDateRange(selectedSimulation.event.start, selectedSimulation.event.end)}
                      </div>
                      <div className="mt-1 text-sm italic text-white/48">
                        {selectedSimulation.event.location ?? "Location unavailable"}
                      </div>
                    </div>

                    <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white/72">
                      Event code {selectedSimulation.event.code}
                    </div>
                  </div>
                </section>

                <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Teams" value={String(selectedSimulation.teams.length)} />
                  <SummaryCard label="Published Quals" value={String(selectedSimulation.totalQualMatches)} />
                  <SummaryCard label="Played Quals" value={String(selectedSimulation.playedQualMatches)} />
                  <SummaryCard label="Remaining Quals" value={String(selectedSimulation.remainingQualMatches)} />
                </section>

                {selectedSimulation.totalQualMatches === 0 ? (
                  <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
                    This event does not have a published qualification schedule yet, so there is nothing to simulate right now.
                  </section>
                ) : null}

                {selectedSimulation.totalQualMatches > 0 ? (
                  <>
                    <section className="mt-6 grid gap-4 2xl:grid-cols-[1.2fr_0.9fr]">
                      <div className="rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                            Projected Standings
                          </div>
                          <div className="text-sm text-white/46">
                            {selectedSimulation.simulations.toLocaleString()} runs
                          </div>
                        </div>
                        <div className="mt-4 space-y-3">
                          {selectedSimulation.standings.map((row, index) => (
                            <StandingCard
                              key={`standing-${row.teamNumber}`}
                              row={row}
                              season={season}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <TeamStrengthChart rows={selectedSimulation.standings} />
                        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-5">
                          <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                            Model Notes
                          </div>
                          <div className="mt-4 space-y-3 text-sm text-white/68">
                            <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-4">
                              Strength comes from current season Total NP quick stats when published.
                            </div>
                            <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-4">
                              Already-played qualification matches stay fixed in every run.
                            </div>
                            <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-4">
                              Remaining qualification matches are simulated from the real published event schedule.
                            </div>
                          </div>
                        </section>
                      </div>
                    </section>

                    <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                          Qualification Matches
                        </div>
                        <div className="text-sm text-white/46">
                          Played results plus projected outlook for the remaining schedule
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                        {selectedSimulation.matches.map((match) => (
                          <MatchCard key={match.key} match={match} />
                        ))}
                      </div>
                    </section>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
