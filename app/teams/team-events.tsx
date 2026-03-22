"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";

import type {
  OprBreakdown,
  OprTrendPoint,
  TeamEventDetails,
  TeamEventSummary,
  TeamMatch,
  TeamMatchSide,
} from "@/lib/ftc";

const EVENT_DETAILS_SCHEMA_VERSION = "7";
const eventDetailsCache = new Map<string, TeamEventDetails>();

function fmtDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "No date";

  const startText = new Date(start).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!end || start === end) return startText;

  const endDate = new Date(end);
  const startDate = new Date(start);

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

function fmtNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(2);
}

function fmtPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${Math.round(value)}%`;
}

function renderAllianceTeams(teams: TeamMatchSide[], highlight: boolean) {
  if (teams.length === 0) {
    return <div className="text-white/35">No teams listed</div>;
  }

  return (
    <div className="space-y-1">
      {teams.map((team) => (
        <Link
          key={`${team.teamNumber}-${team.teamName ?? "team"}`}
          href={`/teams?q=${team.teamNumber}`}
          className={[
            "block break-words leading-relaxed underline-offset-2 hover:underline",
            highlight ? "font-medium text-white" : "text-white/78",
          ].join(" ")}
        >
          {team.teamNumber}
          {team.teamName ? ` / ${team.teamName}` : ""}
        </Link>
      ))}
    </div>
  );
}

function MatchList({ matches }: { matches: TeamMatch[] }) {
  return (
    <div className="mt-5">
      {matches.length === 0 ? (
        <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-6 text-center text-base text-white/72">
          This event has not yet begun.
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match, index) => {
            const hasPrediction =
              match.winProbability !== null &&
              match.predictedRedScore !== null &&
              match.predictedBlueScore !== null;

            return (
              <article
                key={`${match.key}:${index}`}
                className="rounded-[12px] border border-white/10 bg-[#101010]"
              >
                <div className="grid gap-3 border-b border-white/10 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-medium text-white">{match.description}</div>
                      {match.alliance ? (
                        <div
                          className={[
                            "rounded-[6px] border px-2 py-1 text-[11px] uppercase tracking-[0.12em]",
                            match.alliance === "red"
                              ? "border-[#5a2424] bg-[#211010] text-[#f1b0b0]"
                              : "border-[#22436e] bg-[#101d30] text-[#a9c7ff]",
                          ].join(" ")}
                        >
                          Team on {match.alliance}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.12em] text-white/38">
                      {match.tournamentLevel}
                    </div>
                    <div className="mt-2 text-sm text-white/50">
                      {match.start ? new Date(match.start).toLocaleString() : "TBD"}
                      {match.field ? ` / Field ${match.field}` : ""}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[10px] border border-white/10 bg-[#0b0b0b] px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-white/38">
                        Actual score
                      </div>
                      <div className="mt-2 text-lg font-medium text-white">
                        {match.redScore ?? "N/A"} - {match.blueScore ?? "N/A"}
                      </div>
                      <div
                        className={[
                          "mt-2 inline-flex rounded-[6px] border px-2 py-1 text-[11px] uppercase tracking-[0.12em]",
                          match.won === null
                            ? "border-white/10 text-white/45"
                            : match.won
                              ? "border-[#244d2b] bg-[#0f1d12] text-[#9bd3a6]"
                              : "border-[#5a2424] bg-[#211010] text-[#e1a3a3]",
                        ].join(" ")}
                      >
                        {match.won === null ? "No result" : match.won ? "Win" : "Loss"}
                      </div>
                    </div>

                    <div className="rounded-[10px] border border-white/10 bg-[#0b0b0b] px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] uppercase tracking-[0.12em] text-white/38">
                          Predicted score
                        </div>
                        <div
                          className={[
                            "inline-flex rounded-[6px] border px-2 py-1 text-[11px] uppercase tracking-[0.12em]",
                            match.winProbability === null
                              ? "border-white/10 text-white/45"
                              : match.winProbability >= 60
                                ? "border-[#244d2b] bg-[#0f1d12] text-[#9bd3a6]"
                                : match.winProbability >= 45
                                  ? "border-white/10 bg-[#141414] text-white/72"
                                  : "border-[#5a2424] bg-[#211010] text-[#e1a3a3]",
                          ].join(" ")}
                        >
                          {fmtPercent(match.winProbability)}
                        </div>
                      </div>
                      <div className="mt-2 text-lg font-medium text-white">
                        {hasPrediction
                          ? `${fmtNumber(match.predictedRedScore)} - ${fmtNumber(match.predictedBlueScore)}`
                          : "Unavailable"}
                      </div>
                      <div className="mt-2 text-xs text-white/46">
                        {hasPrediction
                          ? "Based on current event OPR"
                          : match.predictionSampleSize > 0
                            ? "Prediction unavailable"
                            : "No played qualification data yet"}
                      </div>
                      {match.alliance ? (
                        <div className="mt-2 text-xs text-white/46">
                          {match.alliance === "red" ? "Red" : "Blue"} alliance perspective
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 lg:grid-cols-2">
                  <div className="bg-[#341515] px-4 py-4">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#efc3c3]">
                      Red Alliance
                    </div>
                    {renderAllianceTeams(match.redAlliance, match.alliance === "red")}
                  </div>
                  <div className="bg-[#162c4c] px-4 py-4">
                    <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#bfd4ff]">
                      Blue Alliance
                    </div>
                    {renderAllianceTeams(match.blueAlliance, match.alliance === "blue")}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OprChips({ currentOpr }: { currentOpr: OprBreakdown | null }) {
  if (!currentOpr) return null;

  const items: Array<{ label: string; value: number | null; tone: string }> = [
    { label: "Total NP", value: currentOpr.total, tone: "text-white bg-[#101010]" },
    { label: "Auto", value: currentOpr.auto, tone: "text-[#8dc3ff] bg-[#0e1621]" },
    { label: "Teleop", value: currentOpr.teleop, tone: "text-[#ffb36b] bg-[#20140b]" },
    { label: "Endgame", value: currentOpr.endgame, tone: "text-[#8be0a4] bg-[#0d1c12]" },
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-sm">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-[8px] border border-white/10 px-3 py-2 ${item.tone}`}
        >
          <span className="text-white/52">{item.label}</span>
          <span className="ml-2 font-medium text-current">{fmtNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function buildChartCoordinates(points: OprTrendPoint[], metric: keyof OprBreakdown) {
  const values = points.map((point) => point[metric]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;

  const width = 720;
  const height = 220;
  const left = 18;
  const right = 18;
  const top = 12;
  const bottom = 24;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coordinates = points.map((point, index) => {
    const rawValue = point[metric];
    const value = typeof rawValue === "number" ? rawValue : min;
    const x =
      left +
      (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const y = top + (1 - (value - min) / range) * chartHeight;
    return { x, y, value, label: point.label };
  });

  return {
    width,
    height,
    left,
    top,
    bottom,
    chartHeight,
    min,
    max,
    coordinates,
    line: coordinates.map((point) => `${point.x},${point.y}`).join(" "),
    area: `${coordinates.map((point) => `${point.x},${point.y}`).join(" ")} ${coordinates[coordinates.length - 1]?.x},${height - bottom} ${coordinates[0]?.x},${height - bottom}`,
  };
}

function OprTrendChart({ points }: { points: OprTrendPoint[] }) {
  const [metric, setMetric] = useState<keyof OprBreakdown>("total");

  if (points.length === 0) {
    return (
      <div className="mt-5 rounded-[10px] border border-white/10 bg-[#101010] px-4 py-5 text-sm text-white/45">
        Not enough played qualification matches for an OPR trend yet.
      </div>
    );
  }

  const chart = buildChartCoordinates(points, metric);
  if (!chart) {
    return null;
  }

  const metricOptions: Array<{ key: keyof OprBreakdown; label: string }> = [
    { key: "total", label: "Total NP" },
    { key: "auto", label: "Auto" },
    { key: "teleop", label: "Teleop" },
    { key: "endgame", label: "Endgame" },
  ];

  return (
    <div className="mt-5 rounded-[10px] border border-white/10 bg-[#101010] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-white/42">
            OPR Over Time
          </div>
          <div className="mt-1 text-sm text-white/52">
            Recomputed after each played qualification match for this team.
          </div>
        </div>

        <label className="sr-only" htmlFor={`opr-metric-${points[0]?.label ?? "event"}`}>
          OPR metric
        </label>
        <select
          id={`opr-metric-${points[0]?.label ?? "event"}`}
          value={metric}
          onChange={(event) => setMetric(event.target.value as keyof OprBreakdown)}
          className="h-10 rounded-[8px] border border-white/10 bg-[#090909] px-3 text-sm text-white outline-none"
        >
          {metricOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label={`OPR over time for ${metric}`}
        >
          <line
            x1={chart.left}
            y1={chart.height - chart.bottom}
            x2={chart.width - chart.left}
            y2={chart.height - chart.bottom}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          <polyline
            points={chart.area}
            fill="rgba(88, 128, 255, 0.12)"
            stroke="none"
          />
          <polyline
            points={chart.line}
            fill="none"
            stroke="#90a3ff"
            strokeWidth="2"
          />
          {chart.coordinates.map((point, index) => {
            const labelStep = Math.max(1, Math.ceil(chart.coordinates.length / 8));
            const showLabel =
              index === 0 ||
              index === chart.coordinates.length - 1 ||
              index % labelStep === 0;

            return (
              <g key={`${point.label}-${point.x}`}>
                <circle cx={point.x} cy={point.y} r="3.5" fill="#dce2ff" />
                {showLabel ? (
                  <text
                    x={point.x}
                    y={chart.height - 6}
                    fill="rgba(255,255,255,0.48)"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          <text x={chart.left} y={chart.top + 8} fill="rgba(255,255,255,0.38)" fontSize="11">
            {fmtNumber(chart.max)}
          </text>
          <text
            x={chart.left}
            y={chart.height - chart.bottom - 6}
            fill="rgba(255,255,255,0.38)"
            fontSize="11"
          >
            {fmtNumber(chart.min)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function EventStatsRow({ event }: { event: TeamEventSummary }) {
  if (!event.statsAvailable) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-sm">
      {event.rank !== null ? (
        <div className="rounded-[8px] border border-white/10 bg-[#101010] px-3 py-2 text-white/78">
          Rank {event.rank}
        </div>
      ) : null}
      {event.record ? (
        <div className="rounded-[8px] border border-white/10 bg-[#101010] px-3 py-2 text-white/78">
          Record {event.record}
        </div>
      ) : null}
      {event.rp !== null ? (
        <div className="rounded-[8px] border border-white/10 bg-[#101010] px-3 py-2 text-white/78">
          RP {fmtNumber(event.rp)}
        </div>
      ) : null}
      {event.npOpr !== null ? (
        <div className="rounded-[8px] border border-white/10 bg-[#101010] px-3 py-2 text-white/78">
          NP OPR {fmtNumber(event.npOpr)}
        </div>
      ) : null}
      {event.npAverage !== null ? (
        <div className="rounded-[8px] border border-white/10 bg-[#101010] px-3 py-2 text-white/78">
          NP AVG {fmtNumber(event.npAverage)}
        </div>
      ) : null}
    </div>
  );
}

function LoadingMatches() {
  return (
    <div className="mt-5 rounded-[10px] border border-white/10 bg-[#101010] px-4 py-5 text-sm text-white/45">
      Loading matches...
    </div>
  );
}

type EventState = {
  loading: boolean;
  data: TeamEventDetails | null;
  error: string | null;
};

export default function TeamEvents({
  teamNumber,
  season,
  events,
}: {
  teamNumber: number;
  season: number;
  events: TeamEventSummary[];
}) {
  const initialState = new Map<string, EventState>();
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const stateRef = useRef<Record<string, EventState>>({});

  for (const event of events) {
    initialState.set(event.eventCode, {
      loading: false,
      data:
        eventDetailsCache.get(
          `${EVENT_DETAILS_SCHEMA_VERSION}:${teamNumber}:${season}:${event.eventCode}`,
        ) ?? null,
      error: null,
    });
  }

  const [state, setState] = useState<Record<string, EventState>>(
    Object.fromEntries(initialState.entries()),
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const ensureEventLoaded = useEffectEvent(async (eventCode: string) => {
    const cacheKey = `${EVENT_DETAILS_SCHEMA_VERSION}:${teamNumber}:${season}:${eventCode}`;
    const cached = eventDetailsCache.get(cacheKey);
    const current = stateRef.current[eventCode];

    if (!current) return;

    if (cached && !current.data) {
      setState((previous) => ({
        ...previous,
        [eventCode]: {
          ...previous[eventCode],
          data: cached,
        },
      }));
      return;
    }

    if (current.loading || current.data) {
      return;
    }

    setState((previous) => ({
      ...previous,
      [eventCode]: {
        ...previous[eventCode],
        loading: true,
        error: null,
      },
    }));

    try {
      const response = await fetch(
        `/api/teams/${teamNumber}/events/${eventCode}?season=${season}&schema=${EVENT_DETAILS_SCHEMA_VERSION}`,
        {
          cache: "force-cache",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load event details");
      }

      const data = (await response.json()) as TeamEventDetails;
      eventDetailsCache.set(cacheKey, data);

      setState((previous) => ({
        ...previous,
        [eventCode]: {
          ...previous[eventCode],
          loading: false,
          data,
          error: null,
        },
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        [eventCode]: {
          ...previous[eventCode],
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load event details",
        },
      }));
    }
  });

  useEffect(() => {
    if (events.length === 0) return;

    void ensureEventLoaded(events[0].eventCode);
  }, [events]);

  useEffect(() => {
    if (events.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const eventCode = entry.target.getAttribute("data-event-code");
          if (eventCode) {
            void ensureEventLoaded(eventCode);
          }
        }
      },
      { rootMargin: "320px 0px" },
    );

    for (const event of events) {
      const node = sectionRefs.current[event.eventCode];
      if (node) {
        observer.observe(node);
      }
    }

    return () => observer.disconnect();
  }, [events]);

  if (events.length === 0) {
    return (
      <section className="mt-6 rounded-[12px] border border-white/10 bg-[#090909] p-6 text-base text-white/55">
        No published events found for {season}.
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {events.map((event) => {
        const eventState = state[event.eventCode];

        return (
          <section
            key={`${event.eventCode}-${event.start ?? "none"}`}
            ref={(node) => {
              sectionRefs.current[event.eventCode] = node;
            }}
            data-event-code={event.eventCode}
            className="rounded-[12px] border border-white/10 bg-[#090909] p-5 sm:p-6"
          >
            <div className="flex flex-col gap-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/34">
                {event.eventCode}
              </div>
              <Link
                href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.eventCode)}&eventQuery=${encodeURIComponent(event.eventName)}`}
                className="group w-fit"
              >
                <h2 className="text-3xl font-medium tracking-[-0.05em] text-white underline-offset-4 group-hover:underline sm:text-[2rem]">
                  {event.eventName}
                </h2>
              </Link>
              <div className="text-base text-white/76">{fmtDateRange(event.start, event.end)}</div>
              {event.location ? (
                <div className="break-words text-base text-[#98a2ff]">{event.location}</div>
              ) : null}
            </div>

            <EventStatsRow event={event} />
            <OprChips currentOpr={eventState?.data?.currentOpr ?? null} />

            {eventState?.data?.awards.length ? (
              <div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/84">
                {eventState.data.awards.join(", ")}
              </div>
            ) : null}

            {eventState?.loading ? (
              <LoadingMatches />
            ) : eventState?.error ? (
              <div className="mt-5 rounded-[10px] border border-white/10 bg-[#101010] p-4 text-sm text-[#ff8f8f]">
                {eventState.error}
              </div>
            ) : eventState?.data ? (
              <>
                <OprTrendChart points={eventState.data.oprTrend} />
                <MatchList matches={eventState.data.matches} />
              </>
            ) : (
              <LoadingMatches />
            )}
          </section>
        );
      })}
    </div>
  );
}
