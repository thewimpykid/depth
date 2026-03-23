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
}: {
  row: ActualEventStanding;
  season: number;
  index: number;
  showPlayoffs: boolean;
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

function MatchCard({ match, isRandom }: { match: ActualEventMatch; isRandom: boolean }) {
  const played = !isRandom && match.status === "played";
  return (
    <article className="rounded-[10px] border border-white/10 bg-[#0c0c0c] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-white">{match.label}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/32">
            {isRandom ? "sample" : played ? "played" : "upcoming"}
          </span>
        </div>
        {played && match.actualRedScore !== null && match.actualBlueScore !== null ? (
          <span className="text-xs tabular-nums text-white/50">
            <span className="text-[#f0b9b9]">{match.actualRedScore}</span>
            <span className="text-white/24 mx-1">–</span>
            <span className="text-[#bdd5ff]">{match.actualBlueScore}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {(["red", "blue"] as const).map((tone) => {
          const teams = tone === "red" ? match.redAlliance : match.blueAlliance;
          const prob = tone === "red" ? match.redWinProbability : match.blueWinProbability;
          const proj = tone === "red" ? match.predictedRedScore : match.predictedBlueScore;
          return (
            <div
              key={tone}
              className={[
                "rounded-[8px] border px-3 py-2.5",
                tone === "red" ? "border-[#552222]/60 bg-[#140a0a]" : "border-[#1e3a5f]/60 bg-[#0a1018]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={["text-[10px] uppercase tracking-[0.1em]", tone === "red" ? "text-[#f0b9b9]/70" : "text-[#bdd5ff]/70"].join(" ")}>
                  {tone === "red" ? "Red" : "Blue"}
                </span>
                <span className="text-[10px] tabular-nums text-white/46">{formatProbability(prob)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {teams.map((t) => (
                  <span key={t.teamNumber} className="text-xs text-white/72">{t.teamNumber}</span>
                ))}
              </div>
              <div className="mt-1.5 text-xs text-white/38">
                Proj {formatValue(proj)}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default async function SimulatePage(props: PageProps<"/simulate">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();

  const rawEventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery : "";
  const rawEventCode = typeof searchParams.eventCode === "string" ? searchParams.eventCode : "";
  const rawMode = typeof searchParams.mode === "string" ? searchParams.mode : "api";
  const scheduleMode: "api" | "random" = rawMode === "random" ? "random" : "api";
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
      ? await simulateRandomScheduleEvent(season, eventCode, simulations)
      : await simulateActualEvent(season, eventCode, simulations)
    : null;

  const isRandom = selectedSimulation?.scheduleMode === "random";
  const showPlayoffs = (selectedSimulation?.teams.length ?? 0) >= 4;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Simulate</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            simulate an event
          </h1>
          <p className="mt-3 max-w-3xl text-base text-white/58 sm:text-lg">
            Pick an FTC event and simulate qualification matches and playoffs using current season team strength.
          </p>
          <SimulateControls
            key={`simulate-controls:${season}:${eventQuery}:${eventCode}:${simulations}:${scheduleMode}`}
            initialEventQuery={eventQuery}
            initialSeason={season}
            initialRuns={simulations}
            initialMode={scheduleMode}
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
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <TeamStrengthChart rows={selectedSimulation.standings} />
                        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
                          <div className="text-base font-medium text-white">Model notes</div>
                          <div className="mt-2 space-y-1.5 text-xs text-white/54">
                            <div>Strength = current season Total NP from FTC match data.</div>
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
                      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {selectedSimulation.matches.map((match) => (
                          <MatchCard key={match.key} match={match} isRandom={isRandom} />
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
