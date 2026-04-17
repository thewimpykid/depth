"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TeamEvents from "./team-events";
import { PosterButton } from "./team-poster";
import type { RankedValue, TeamPageResult } from "@/lib/ftc";

const summaryCache = new Map<string, TeamPageResult>();
const TEAM_SUMMARY_SCHEMA_VERSION = "2";

function formatValue(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function formatRankedValue(value: RankedValue) {
  return formatValue(value.value);
}

function formatRankPercentile(value: RankedValue) {
  if (value.rank === null || value.percentile === null) return "N/A";
  return `${value.rank}th / ${value.percentile.toFixed(2)}%`;
}

function formatSeasonOption(season: number, selectedSeason: number, selectedLabel: string) {
  if (season !== selectedSeason) return String(season);
  return selectedLabel;
}

function SummaryItem({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-[#101010] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className={accent ? "mt-1 text-sm font-medium text-indigo-300" : "mt-1 text-sm text-white/86"}>
        {value}
      </div>
    </div>
  );
}

function QuickStatCard({
  label,
  value,
  rankText,
}: {
  label: string;
  value: RankedValue;
  rankText: string;
}) {
  return (
    <article className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/36">{label}</div>
      <div className="mt-1.5 text-xl font-bold tracking-[-0.04em] text-white">
        {formatRankedValue(value)}
      </div>
      <div className="mt-1.5 text-xs text-indigo-300/70">{rankText}</div>
    </article>
  );
}

function LoadingState() {
  return (
    <>
      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-4">
        <div className="h-7 w-64 bg-white/8" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-40 bg-white/8" />
          <div className="h-3 w-32 bg-white/8" />
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-4">
        <div className="h-9 w-full bg-white/8" />
      </section>

      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-4">
        <div className="h-5 w-32 bg-white/8" />
        <div className="mt-4 h-20 w-full bg-white/8" />
      </section>
    </>
  );
}

/* ── consistency score ── */

type ConsistencyData = {
  score: number;
  stdDev: number;
  eventCount: number;
  oprs: number[];   // chronological (oldest → newest)
  trend: "up" | "down" | "stable";
};

function calcConsistency(events: TeamPageResult["events"]): ConsistencyData | null {
  const oprs = [...events]
    .reverse()
    .map((e) => e.npOpr)
    .filter((v): v is number => v !== null);
  if (oprs.length < 2) return null;

  const mean = oprs.reduce((a, b) => a + b, 0) / oprs.length;
  const variance = oprs.reduce((s, v) => s + (v - mean) ** 2, 0) / oprs.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 100;
  const score = Math.round(Math.max(0, Math.min(100, 100 - cv * 1.5)));

  // Trend: compare first-half avg vs second-half avg
  const mid = Math.floor(oprs.length / 2);
  const firstHalf = oprs.slice(0, mid);
  const secondHalf = oprs.slice(oprs.length - mid);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trend = avgSecond > avgFirst * 1.05 ? "up" : avgSecond < avgFirst * 0.95 ? "down" : "stable";

  return { score, stdDev: Math.round(stdDev * 10) / 10, eventCount: oprs.length, oprs, trend };
}

function consistencyTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: "Elite",         color: "#6ee7b7", bg: "rgba(110,231,183,0.12)" };
  if (score >= 70) return { label: "Reliable",      color: "#7dd3fc", bg: "rgba(125,211,252,0.12)" };
  if (score >= 50) return { label: "Variable",      color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  };
  return              { label: "Unpredictable", color: "#f87171", bg: "rgba(248,113,113,0.12)" };
}

function OprSparkline({ oprs, color }: { oprs: number[]; color: string }) {
  const W = 200;
  const H = 44;
  const pad = 3;
  const yMin = Math.min(...oprs);
  const yMax = Math.max(...oprs);
  const range = yMax - yMin || 1;

  const pts = oprs.map((v, i) => ({
    x: pad + (i / (oprs.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - yMin) / range) * (H - pad * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44 }} aria-hidden="true">
      <defs>
        <linearGradient id="csFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#csFill)" />
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" opacity="0.85" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.9" />
      ))}
    </svg>
  );
}

function ConsistencySection({ events }: { events: TeamPageResult["events"] }) {
  const cs = calcConsistency(events);
  if (!cs) return null;

  const tier = consistencyTier(cs.score);
  const trendIcon = cs.trend === "up" ? "↑" : cs.trend === "down" ? "↓" : "→";
  const trendColor = cs.trend === "up" ? "#6ee7b7" : cs.trend === "down" ? "#f87171" : "rgba(255,255,255,0.36)";

  return (
    <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-base font-medium text-white">Consistency</div>
        <div className="text-xs uppercase tracking-[0.14em] text-white/38">
          {cs.eventCount} event{cs.eventCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="mt-4 border-t border-white/12 pt-4">
        <div className="flex items-start gap-5">
          {/* Score */}
          <div className="shrink-0">
            <div className="text-3xl font-bold tracking-[-0.04em] text-white">{cs.score}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/30">/100</div>
          </div>

          {/* Tier + stats */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-[5px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: tier.color, background: tier.bg }}
              >
                {tier.label}
              </span>
              <span className="text-xs text-white/36">±{cs.stdDev} std dev</span>
              <span className="text-xs font-medium" style={{ color: trendColor }}>
                {trendIcon} {cs.trend === "up" ? "Improving" : cs.trend === "down" ? "Declining" : "Stable"}
              </span>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-white/28">
                OPR across events
              </div>
              <OprSparkline oprs={cs.oprs} color={tier.color} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStatsTable({ data }: { data: TeamPageResult["quickStats"] }) {
  if (!data) {
    return (
      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-4">
        <div className="text-base font-medium text-white">Quick Stats</div>
        <div className="mt-3 text-sm text-white/45">No published season stats yet.</div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-base font-medium text-white">Quick Stats</div>
        {data.comparedAgainst ? (
          <div className="text-xs uppercase tracking-[0.14em] text-white/38">
            {data.comparedAgainst} teams
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/12 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickStatCard label="Total NP" value={data.total} rankText={formatRankPercentile(data.total)} />
        <QuickStatCard label="Auto" value={data.auto} rankText={formatRankPercentile(data.auto)} />
        <QuickStatCard
          label="Teleop"
          value={data.teleop}
          rankText={formatRankPercentile(data.teleop)}
        />
        <QuickStatCard
          label="Endgame"
          value={data.endgame}
          rankText={formatRankPercentile(data.endgame)}
        />
      </div>
    </section>
  );
}

export default function TeamSummary({
  teamNumber,
  requestedSeason,
}: {
  teamNumber: number;
  requestedSeason?: number;
}) {
  const router = useRouter();
  const cacheKey = `${TEAM_SUMMARY_SCHEMA_VERSION}:${teamNumber}:${requestedSeason ?? "current"}`;
  const [data, setData] = useState<TeamPageResult | null>(() => summaryCache.get(cacheKey) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = summaryCache.get(cacheKey);

    if (cached) {
      return () => {
        cancelled = true;
      };
    }

    const params = new URLSearchParams();
    params.set("schema", TEAM_SUMMARY_SCHEMA_VERSION);
    if (requestedSeason) {
      params.set("season", String(requestedSeason));
    }

    fetch(`/api/teams/${teamNumber}/summary${params.size ? `?${params}` : ""}`, {
      cache: "force-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load team data");
        }
        return (await response.json()) as TeamPageResult;
      })
      .then((payload) => {
        if (!cancelled) {
          summaryCache.set(cacheKey, payload);
          setData(payload);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error ? fetchError.message : "Failed to load team data",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, requestedSeason, teamNumber]);

  if (error) {
    return (
      <section className="mt-6 rounded-[12px] border border-white/10 bg-[#090909] p-6 text-sm text-[#ff8f8f]">
        {error}
      </section>
    );
  }

  if (!data) {
    return <LoadingState />;
  }

  const availableSeasons =
    Array.isArray(data.availableSeasons) && data.availableSeasons.length > 0
      ? data.availableSeasons
      : [data.season];
  const seasonLabel = data.seasonLabel ?? String(data.season);

  return (
    <>
      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.8fr)]">
          <div>
            <div className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">
              {data.teamNumber} - {data.team?.name ?? `Team ${data.teamNumber}`}
            </div>
            {data.team?.organization ? (
              <div className="mt-1 text-sm text-white/70">{data.team.organization}</div>
            ) : null}
            <div className="mt-3">
              <PosterButton data={data} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {data.team?.location ? (
              <SummaryItem label="Location" value={data.team.location} accent />
            ) : null}
            {data.team?.rookieYear ? (
              <SummaryItem label="Rookie Year" value={String(data.team.rookieYear)} />
            ) : null}
            <SummaryItem label="Source" value="FIRST" />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] p-2">
        <label className="sr-only" htmlFor="season-select">
          Season
        </label>
        <select
          id="season-select"
          value={String(data.season)}
          onChange={(event) => {
            const nextSeason = event.target.value;
            router.push(`/teams?q=${data.teamNumber}&season=${nextSeason}`);
          }}
          className="h-9 w-full rounded-[8px] border border-transparent bg-[#111111] px-3 text-sm text-white outline-none"
        >
          {availableSeasons.map((season) => (
            <option key={season} value={season}>
              {formatSeasonOption(season, data.season, seasonLabel)}
            </option>
          ))}
        </select>
      </section>

      <QuickStatsTable data={data.quickStats ?? null} />

      <ConsistencySection events={data.events} />

      <TeamEvents teamNumber={data.teamNumber} season={data.season} events={data.events} />
    </>
  );
}
