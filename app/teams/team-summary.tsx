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

      <TeamEvents teamNumber={data.teamNumber} season={data.season} events={data.events} />
    </>
  );
}
