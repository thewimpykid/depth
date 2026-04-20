import Link from "next/link";

import SimulateControls from "./simulate-controls";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import {
  simulateActualEvent,
  simulateRandomScheduleEvent,
  type ActualEventMatch,
  type ActualEventStanding,
  searchSeasonEvents,
} from "@/lib/event-simulation";

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
    <article className="rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/36">{label}</div>
      <div className="mt-1.5 text-2xl font-medium tracking-[-0.04em] text-white">{value}</div>
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

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "gold" | "green";
}) {
  return (
    <div
      className={[
        "rounded-[8px] border px-3 py-2",
        highlight === "gold"
          ? "border-[#3a2800]/50 bg-[#160f00]"
          : highlight === "green"
            ? "border-[#1a3a00]/50 bg-[#0a1400]"
            : "border-white/8 bg-[#111111]",
      ].join(" ")}
    >
      <div className="text-[9px] uppercase tracking-[0.12em] text-white/34">{label}</div>
      <div
        className={[
          "mt-1 text-sm font-medium",
          highlight === "gold"
            ? "text-[#ffd84d]/85"
            : highlight === "green"
              ? "text-[#8be800]/85"
              : "text-white/80",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function StandingCard({
  row,
  season,
  index,
  showPlayoffs,
  dataMode,
}: {
  row: ActualEventStanding;
  season: number;
  index: number;
  showPlayoffs: boolean;
  dataMode: "season" | "pre-event" | "post-event";
}) {
  return (
    <article className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 rounded-[6px] border border-white/10 bg-[#0b0b0b] px-2 py-1 text-xs tabular-nums text-white/54">
            #{index + 1}
          </span>
          <div className="min-w-0">
            <span className="text-base font-medium text-white">{row.teamNumber}</span>
            {row.name ? (
              <span className="ml-2 truncate text-sm text-white/52">{row.name}</span>
            ) : null}
            {(dataMode === "pre-event" || dataMode === "season") && row.isFirstEvent ? (
              <span className="ml-2 rounded-[4px] border border-yellow-500/25 bg-yellow-500/8 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-yellow-300/60">
                No prior data
              </span>
            ) : null}
          </div>
        </div>
        <Link
          href={`/teams?q=${row.teamNumber}&season=${season}`}
          className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/36 hover:text-white/60"
        >
          Team page →
        </Link>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <StatPill label="Exp W-L" value={`${row.expectedWins.toFixed(1)}-${row.expectedLosses.toFixed(1)}`} />
        <StatPill label="Avg seed" value={row.averageSeed.toFixed(1)} />
        <StatPill label="1st seed" value={formatProbability(row.firstSeedProbability)} />
        <StatPill label="Top 4" value={formatProbability(row.topFourProbability)} />
        {showPlayoffs ? (
          <>
            <StatPill label="Semifinal" value={formatProbability(row.semifinalistProbability + row.finalistProbability + row.championProbability)} />
            <StatPill label="Finalist" value={formatProbability(row.finalistProbability + row.championProbability)} highlight="gold" />
            <StatPill label="Champion" value={formatProbability(row.championProbability)} highlight="green" />
          </>
        ) : (
          <>
            <StatPill label="Locked" value={`${row.lockedWins}-${row.lockedLosses}-${row.lockedTies}`} />
            <StatPill label="Avg score" value={formatValue(row.averageScoreFor)} />
          </>
        )}
      </div>
    </article>
  );
}

function MatchRow({ match, isRandom }: { match: ActualEventMatch; isRandom: boolean }) {
  const played = !isRandom && match.status === "played";
  const hasActual = played && match.actualRedScore !== null && match.actualBlueScore !== null;
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-3 py-2 text-xs">
      <span className="w-28 shrink-0 truncate font-medium text-white/50">{match.label}</span>

      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
      <span className="min-w-0 flex-1 truncate tabular-nums text-white/72">
        {match.redAlliance.map((t) => t.teamNumber).join(" · ")}
      </span>
      <span className="shrink-0 tabular-nums text-white/34">{match.redWinProbability.toFixed(0)}%</span>

      <span className="shrink-0 text-white/18">vs</span>

      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/50" />
      <span className="min-w-0 flex-1 truncate tabular-nums text-white/72">
        {match.blueAlliance.map((t) => t.teamNumber).join(" · ")}
      </span>
      <span className="shrink-0 tabular-nums text-white/34">{match.blueWinProbability.toFixed(0)}%</span>

      {hasActual ? (
        <span className="shrink-0 tabular-nums">
          <span className="text-red-300/60">{match.actualRedScore}</span>
          <span className="text-white/20">–</span>
          <span className="text-sky-300/60">{match.actualBlueScore}</span>
        </span>
      ) : (
        <span className="shrink-0 tabular-nums text-white/22">
          {match.predictedRedScore.toFixed(0)}–{match.predictedBlueScore.toFixed(0)}
        </span>
      )}
    </div>
  );
}

export default async function SimulatePage(props: PageProps<"/simulate">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();

  const rawEventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery : "";
  const rawEventCode = typeof searchParams.eventCode === "string" ? searchParams.eventCode : "";
  const rawMode = typeof searchParams.mode === "string" ? searchParams.mode : "api";
  const rawDataMode = typeof searchParams.dataMode === "string" ? searchParams.dataMode : "season";
  const scheduleMode: "api" | "random" = rawMode === "random" ? "random" : "api";
  const dataMode: "season" | "pre-event" | "post-event" =
    rawDataMode === "pre-event" ? "pre-event" : rawDataMode === "post-event" ? "post-event" : "season";
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
    ? scheduleMode === "random"
      ? await simulateRandomScheduleEvent(season, eventCode, simulations, dataMode)
      : await simulateActualEvent(season, eventCode, simulations, dataMode)
    : null;

  const isRandom = selectedSimulation?.scheduleMode === "random";
  const showPlayoffs = (selectedSimulation?.teams.length ?? 0) >= 4;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Simulate Event</h1>
            <Link href="/methodology" className="text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-white/60 shrink-0">
              Methodology →
            </Link>
          </div>
          <SimulateControls
            key={`simulate-controls:${season}:${eventQuery}:${eventCode}:${simulations}:${scheduleMode}:${dataMode}`}
            initialEventQuery={eventQuery}
            initialSeason={season}
            initialRuns={simulations}
            initialMode={scheduleMode}
            initialDataMode={dataMode}
            seasonOptions={seasonOptions}
            matchedEvents={eventMatches}
            selectedEventCode={eventCode}
          />
        </section>

        {!eventQuery ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
            Search for an FTC event by name or event code to start.
          </section>
        ) : eventMatches.length === 0 && !selectedSimulation ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <>
            {eventCode && !selectedSimulation ? (
              <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
                That event could not be loaded for simulation.
              </section>
            ) : null}

            {selectedSimulation ? (
              <>
                <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xl font-medium tracking-[-0.03em] text-white">
                        {selectedSimulation.event.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-white/48">
                        <span>{fmtDateRange(selectedSimulation.event.start, selectedSimulation.event.end)}</span>
                        {selectedSimulation.event.location ? <span className="italic">{selectedSimulation.event.location}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-[8px] border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-white/60">
                        {selectedSimulation.event.code}
                      </span>
                      <span className={[
                        "rounded-[8px] border px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]",
                        isRandom
                          ? "border-violet-500/25 bg-violet-950/30 text-violet-300/70"
                          : "border-sky-500/25 bg-sky-950/30 text-sky-300/70",
                      ].join(" ")}>
                        {isRandom ? "Random" : "Published"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryCard label="Teams" value={String(selectedSimulation.teams.length)} />
                  <SummaryCard
                    label={isRandom ? "Sample quals" : "Published quals"}
                    value={String(selectedSimulation.totalQualMatches)}
                  />
                  {isRandom ? (
                    <>
                      <SummaryCard label="Runs" value={selectedSimulation.simulations.toLocaleString()} />
                      <SummaryCard label="Schedule" value="Random" />
                    </>
                  ) : (
                    <>
                      <SummaryCard label="Played" value={String(selectedSimulation.playedQualMatches)} />
                      <SummaryCard label="Remaining" value={String(selectedSimulation.remainingQualMatches)} />
                    </>
                  )}
                </section>

                {!isRandom && selectedSimulation.totalQualMatches === 0 ? (
                  <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
                    No published schedule yet — switch to <span className="text-violet-300">Random Schedule</span> mode to simulate with a randomly generated schedule.
                  </section>
                ) : null}

                {(isRandom || selectedSimulation.totalQualMatches > 0) ? (
                  <>
                    {selectedSimulation.dataMode === "season" ? (
                      <section className="mt-4 rounded-[10px] border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-200/60">
                        <strong className="text-yellow-200/80">Season Best OPR.</strong>{" "}
                        Strength is each team&apos;s best per-event OPR across the full season, which may include events{" "}
                        <em>after</em> this one. Switch to{" "}
                        <strong className="text-yellow-200/70">Pre-Event</strong> for historically accurate predictions.
                      </section>
                    ) : selectedSimulation.dataMode === "pre-event" ? (
                      <section className="mt-4 rounded-[10px] border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-200/60">
                        <strong className="text-sky-200/80">Pre-event mode.</strong>{" "}
                        Strength uses OPR from each team&apos;s most recent event that ended before this one.
                        Teams with <span className="rounded border border-yellow-500/25 bg-yellow-500/8 px-1 text-yellow-300/70 text-xs">No prior data</span>{" "}
                        had no prior-season matches and are assigned the event average.
                      </section>
                    ) : (
                      <section className="mt-4 rounded-[10px] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/60">
                        <strong className="text-emerald-200/80">Post-event mode.</strong>{" "}
                        Strength is OPR computed from this event&apos;s own match results. Only meaningful after the event has played matches.
                      </section>
                    )}
                    <section className="mt-4 grid gap-4 2xl:grid-cols-[1.2fr_0.9fr]">
                      <div className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="text-lg font-medium tracking-[-0.03em] text-white">
                            Projected Standings
                          </div>
                          <div className="text-xs text-white/40">
                            {selectedSimulation.simulations.toLocaleString()} runs
                          </div>
                        </div>
                        <div className="space-y-2">
                          {selectedSimulation.standings.map((row, index) => (
                            <StandingCard
                              key={`standing-${row.teamNumber}`}
                              row={row}
                              season={season}
                              index={index}
                              showPlayoffs={showPlayoffs}
                              dataMode={selectedSimulation.dataMode}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <TeamStrengthChart rows={selectedSimulation.standings} />
                        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-base font-medium text-white">Model notes</div>
                            <Link
                              href="/methodology"
                              className="text-[10px] uppercase tracking-[0.14em] text-white/30 hover:text-white/60"
                            >
                              Full methodology →
                            </Link>
                          </div>
                          <div className="mt-2 space-y-1.5 text-xs text-white/54">
                            {selectedSimulation.dataMode === "season" ? (
                              <div>Strength = best per-event OPR across the full season. May include events after this one.</div>
                            ) : selectedSimulation.dataMode === "pre-event" ? (
                              <div>Strength = OPR from the team&apos;s most recent event before this one. No future data.</div>
                            ) : (
                              <div>Strength = OPR computed from this event&apos;s own match results.</div>
                            )}
                            {isRandom ? (
                              <div className="text-violet-300/70">Each run uses a freshly shuffled schedule — no draw bias. Matches shown are one sample for reference.</div>
                            ) : (
                              <div>Played quals stay fixed; remaining use the published FTC schedule.</div>
                            )}
                            {showPlayoffs && (
                              <div>Playoffs: top 4 seeds pick partners (greedy), semis 1v4 &amp; 2v3, then finals — all best-of-3.</div>
                            )}
                          </div>
                        </section>
                      </div>
                    </section>

                    <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="text-lg font-medium tracking-[-0.03em] text-white">
                          {isRandom ? "Sample Schedule" : "Qualification Matches"}
                        </div>
                        <div className="text-xs text-white/40">
                          {isRandom ? "One possible draw" : "Played + projected remaining"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {selectedSimulation.matches.map((match) => (
                          <MatchRow key={match.key} match={match} isRandom={isRandom} />
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
