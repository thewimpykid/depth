import Link from "next/link";

import CompareBuilderForm from "./compare-builder-form";
import {
  getCurrentSeasonWithOptions,
  getTeamSnapshots,
  parseTeamNumbersInput,
  type TeamSnapshot,
} from "@/lib/team-analysis";

export const dynamic = "force-dynamic";

type MetricKey = "total" | "auto" | "teleop" | "endgame";

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "total", label: "Total NP" },
  { key: "auto", label: "Auto" },
  { key: "teleop", label: "Teleop" },
  { key: "endgame", label: "Endgame" },
];

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
}

function formatValue(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function formatRank(rank: number | null, percentile: number | null) {
  if (rank === null || percentile === null) return "N/A";
  return `${rank}th / ${percentile.toFixed(2)}%`;
}

function metricValue(snapshot: TeamSnapshot, key: MetricKey) {
  return snapshot.quickStats?.[key].value ?? null;
}

function leaderTeamNumbers(teams: TeamSnapshot[], key: MetricKey) {
  const values = teams
    .map((team) => ({ teamNumber: team.teamNumber, value: metricValue(team, key) }))
    .filter((team): team is { teamNumber: number; value: number } => typeof team.value === "number");

  if (values.length === 0) return new Set<number>();

  const best = Math.max(...values.map((team) => team.value));
  return new Set(
    values.filter((team) => Math.abs(team.value - best) < 1e-6).map((team) => team.teamNumber),
  );
}

function LeaderCard({
  label,
  value,
  teams,
}: {
  label: string;
  value: number | null;
  teams: TeamSnapshot[];
}) {
  return (
    <article className="rounded-[12px] border border-white/10 bg-[#101010] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">{label}</div>
      <div className="mt-3 text-3xl font-medium tracking-[-0.05em] text-white">
        {formatValue(value)}
      </div>
      <div className="mt-3 space-y-1 text-sm text-white/68">
        {teams.length > 0 ? (
          teams.map((team) => (
            <div key={`${label}-${team.teamNumber}`}>
              {team.teamNumber}
              {team.name ? ` / ${team.name}` : ""}
            </div>
          ))
        ) : (
          <div>No published value</div>
        )}
      </div>
    </article>
  );
}

function MetricBarChart({
  label,
  teams,
  metric,
}: {
  label: string;
  teams: TeamSnapshot[];
  metric: MetricKey;
}) {
  const rows = teams.map((team) => ({
    teamNumber: team.teamNumber,
    name: team.name,
    value: metricValue(team, metric) ?? 0,
  }));
  const max = Math.max(...rows.map((row) => row.value), 1);
  const width = 720;
  const left = 112;
  const right = 20;
  const barHeight = 24;
  const gap = 12;
  const top = 16;
  const bottom = 18;
  const height = top + bottom + rows.length * barHeight + Math.max(0, rows.length - 1) * gap;
  const chartWidth = width - left - right;

  return (
    <article className="rounded-[12px] border border-white/10 bg-[#101010] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-lg font-medium text-white">{label}</div>
        <div className="text-xs uppercase tracking-[0.14em] text-white/36">Comparison</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${label} comparison`}>
        {rows.map((row, index) => {
          const y = top + index * (barHeight + gap);
          const barWidth = (row.value / max) * chartWidth;
          const insideLabel = barWidth > 150;

          return (
            <g key={`${metric}-${row.teamNumber}`}>
              <text x={left - 10} y={y + 16} textAnchor="end" fill="rgba(255,255,255,0.66)" fontSize="12">
                {row.teamNumber}
              </text>
              <rect x={left} y={y} width={chartWidth} height={barHeight} rx="7" fill="rgba(255,255,255,0.06)" />
              <rect x={left} y={y} width={barWidth} height={barHeight} rx="7" fill="#8ea3ff" />
              <text
                x={left + 10}
                y={y + 16}
                fill={insideLabel ? "#050505" : "rgba(255,255,255,0.88)"}
                fontSize="12"
                fontWeight="600"
              >
                {row.name ?? `Team ${row.teamNumber}`}
              </text>
              <text
                x={Math.max(left + 10, left + barWidth - 10)}
                y={y + 16}
                textAnchor="end"
                fill={barWidth > 105 ? "#050505" : "rgba(255,255,255,0.88)"}
                fontSize="12"
                fontWeight="600"
              >
                {formatValue(row.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function SnapshotMetric({
  label,
  value,
  rankText,
  highlighted,
}: {
  label: string;
  value: number | null;
  rankText: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[10px] border p-3",
        highlighted ? "border-white/20 bg-[#151515]" : "border-white/10 bg-[#111111]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">{label}</div>
        {highlighted ? (
          <div className="rounded-[8px] border border-white/10 bg-[#0a0a0a] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/72">
            Best
          </div>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white">
        {formatValue(value)}
      </div>
      <div className="mt-2 text-sm text-white/52">{rankText}</div>
    </div>
  );
}

function TeamCard({
  team,
  leaders,
  season,
}: {
  team: TeamSnapshot;
  leaders: Record<MetricKey, Set<number>>;
  season: number;
}) {
  return (
    <article className="rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-3xl font-medium tracking-[-0.06em] text-white">
            {team.teamNumber}
            {team.name ? ` - ${team.name}` : ""}
          </div>
          {team.organization ? (
            <div className="mt-2 text-base text-white/76">{team.organization}</div>
          ) : null}
        </div>

        <Link
          href={`/teams?q=${team.teamNumber}&season=${season}`}
          className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72"
        >
          Open team
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Location</div>
          <div className="mt-2 text-base text-white/84">{team.location ?? "Unavailable"}</div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Season Events</div>
          <div className="mt-2 text-base text-white/84">{team.eventCount}</div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Rookie Year</div>
          <div className="mt-2 text-base text-white/84">
            {team.rookieYear ? String(team.rookieYear) : "Unavailable"}
          </div>
        </div>
        <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Strength</div>
          <div className="mt-2 text-base text-white/84">{formatValue(team.strength)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {METRICS.map((metric) => (
          <SnapshotMetric
            key={`${team.teamNumber}-${metric.key}`}
            label={metric.label}
            value={metricValue(team, metric.key)}
            rankText={formatRank(
              team.quickStats?.[metric.key].rank ?? null,
              team.quickStats?.[metric.key].percentile ?? null,
            )}
            highlighted={leaders[metric.key].has(team.teamNumber)}
          />
        ))}
      </div>
    </article>
  );
}

export default async function ComparePage(props: PageProps<"/compare">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();

  const rawTeams = typeof searchParams.teams === "string" ? searchParams.teams : "";
  const season =
    typeof searchParams.season === "string" && isSeason(searchParams.season)
      ? Number(searchParams.season)
      : currentSeason;
  const teamNumbers = parseTeamNumbersInput(rawTeams, 8);
  const hasQuery = rawTeams.trim().length > 0;

  const snapshots = teamNumbers.length >= 2 ? await getTeamSnapshots(teamNumbers, season) : [];

  const leaders: Record<MetricKey, Set<number>> = {
    total: leaderTeamNumbers(snapshots, "total"),
    auto: leaderTeamNumbers(snapshots, "auto"),
    teleop: leaderTeamNumbers(snapshots, "teleop"),
    endgame: leaderTeamNumbers(snapshots, "endgame"),
  };

  const leaderCards = METRICS.map((metric) => {
    const winningTeams = snapshots.filter((team) => leaders[metric.key].has(team.teamNumber));
    const value = winningTeams[0] ? metricValue(winningTeams[0], metric.key) : null;
    return {
      label: metric.label,
      value,
      teams: winningTeams,
    };
  });

  const totalEvents = snapshots.reduce((sum, team) => sum + team.eventCount, 0);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Compare</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            compare teams
          </h1>
          <p className="mt-3 max-w-3xl text-base text-white/58 sm:text-lg">
            Compare current season quick stats, event counts, and published team profile info side by side.
          </p>

          <CompareBuilderForm
            key={`compare-form:${season}:${teamNumbers.join("-")}`}
            initialTeams={teamNumbers}
            initialSeason={season}
            seasonOptions={seasonOptions}
          />
        </section>

        {!hasQuery ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
            Enter at least two FTC team numbers to compare their season snapshot.
          </section>
        ) : teamNumbers.length < 2 ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-[#ff9c9c]">
            Enter at least two valid FTC team numbers.
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-[12px] border border-white/10 bg-[#090909] p-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">Compared Teams</div>
                <div className="mt-3 text-4xl font-medium tracking-[-0.06em] text-white">
                  {snapshots.length}
                </div>
              </article>
              <article className="rounded-[12px] border border-white/10 bg-[#090909] p-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">Season</div>
                <div className="mt-3 text-4xl font-medium tracking-[-0.06em] text-white">
                  {season}
                </div>
              </article>
              <article className="rounded-[12px] border border-white/10 bg-[#090909] p-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">Combined Events</div>
                <div className="mt-3 text-4xl font-medium tracking-[-0.06em] text-white">
                  {totalEvents}
                </div>
              </article>
            </section>

            <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
              <div className="text-2xl font-medium tracking-[-0.04em] text-white">Leaders</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {leaderCards.map((card) => (
                  <LeaderCard key={card.label} label={card.label} value={card.value} teams={card.teams} />
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                  Metric Graphs
                </div>
                <div className="text-sm text-white/46">
                  Current season values across the comparison set
                </div>
              </div>
              <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                {METRICS.map((metric) => (
                  <MetricBarChart
                    key={`chart-${metric.key}`}
                    label={metric.label}
                    teams={snapshots}
                    metric={metric.key}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-4 2xl:grid-cols-2">
              {snapshots.map((team) => (
                <TeamCard key={`compare-${team.teamNumber}`} team={team} leaders={leaders} season={season} />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
