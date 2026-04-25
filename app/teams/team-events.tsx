"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";

import type {
  OprBreakdown,
  OprTrendPoint,
  ScheduleStrength,
  TeamEventDetails,
  TeamEventSummary,
  TeamMatch,
} from "@/lib/ftc";
import type { ScoutReport } from "@/lib/scout-db";

const EVENT_DETAILS_SCHEMA_VERSION = "8";
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



function MatchRow({ match }: { match: TeamMatch }) {
  const hasPrediction =
    match.winProbability !== null &&
    match.predictedRedScore !== null &&
    match.predictedBlueScore !== null;

  const hasActual = match.redScore !== null && match.blueScore !== null;

  const winPct = match.winProbability;
  const winPctColor =
    winPct === null ? "text-white/40"
    : winPct >= 65 ? "text-emerald-400"
    : winPct >= 50 ? "text-emerald-300/80"
    : winPct >= 35 ? "text-rose-300/80"
    : "text-rose-400";

  return (
    <div className="overflow-hidden rounded-[10px] border border-white/10 bg-[#0b0b0b]">

      {/* Header bar: match label + result */}
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-white/75">{match.description}</span>
          <span className="text-[10px] uppercase tracking-widest text-white/25">{match.tournamentLevel}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {winPct !== null ? (
            <span className={["text-base font-bold tabular-nums", winPctColor].join(" ")}>
              {fmtPercent(winPct)}
            </span>
          ) : null}
          {match.won !== null ? (
            <span className={[
              "rounded-[6px] border px-2.5 py-0.5 text-xs font-semibold",
              match.won
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/35 bg-rose-500/10 text-rose-400",
            ].join(" ")}>
              {match.won ? "Win" : "Loss"}
            </span>
          ) : null}
        </div>
      </div>

      {/* Alliance panels */}
      <div className="grid grid-cols-2 divide-x divide-white/8">

        {/* Red */}
        <div className="bg-red-500/[0.055] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
            <div className="flex min-w-0 flex-wrap gap-x-2.5">
              {match.redAlliance.map((t) => (
                <Link
                  key={t.teamNumber}
                  href={`/teams?q=${t.teamNumber}`}
                  className={[
                    "text-sm tabular-nums underline-offset-2 hover:underline",
                    match.alliance === "red" ? "font-bold text-red-200" : "font-normal text-white/60",
                  ].join(" ")}
                >
                  {t.teamNumber}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-2.5 pl-[18px]">
            <span className="text-xl font-bold tabular-nums tracking-tight text-red-300">
              {hasActual ? match.redScore : hasPrediction ? `~${fmtNumber(match.predictedRedScore)}` : "—"}
            </span>
            {hasActual && hasPrediction ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-white/35">Predicted</span>
                <span className="text-sm font-semibold tabular-nums text-red-400/60">
                  {fmtNumber(match.predictedRedScore)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Blue */}
        <div className="bg-sky-400/[0.055] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
            <div className="flex min-w-0 flex-wrap gap-x-2.5">
              {match.blueAlliance.map((t) => (
                <Link
                  key={t.teamNumber}
                  href={`/teams?q=${t.teamNumber}`}
                  className={[
                    "text-sm tabular-nums underline-offset-2 hover:underline",
                    match.alliance === "blue" ? "font-bold text-sky-200" : "font-normal text-white/60",
                  ].join(" ")}
                >
                  {t.teamNumber}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-2.5 pl-[18px]">
            <span className="text-xl font-bold tabular-nums tracking-tight text-sky-300">
              {hasActual ? match.blueScore : hasPrediction ? `~${fmtNumber(match.predictedBlueScore)}` : "—"}
            </span>
            {hasActual && hasPrediction ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-white/35">Predicted</span>
                <span className="text-sm font-semibold tabular-nums text-sky-400/60">
                  {fmtNumber(match.predictedBlueScore)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}

function MatchList({ matches }: { matches: TeamMatch[] }) {
  return (
    <div className="mt-5">
      {matches.length === 0 ? (
        <div className="rounded-[8px] border border-white/8 bg-[#0d0d0d] px-4 py-3 text-sm text-white/50 text-center">
          This event has not yet begun.
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((match, index) => (
            <MatchRow key={`${match.key}:${index}`} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

function OprChips({ currentOpr }: { currentOpr: OprBreakdown | null }) {
  if (!currentOpr) return null;

  const items: Array<{ label: string; value: number | null; tone: string; valTone: string }> = [
    { label: "Total NP", value: currentOpr.total, tone: "bg-white/[0.04] border-white/12", valTone: "text-white" },
    { label: "Auto", value: currentOpr.auto, tone: "bg-sky-500/10 border-sky-500/20", valTone: "text-sky-300" },
    { label: "Teleop", value: currentOpr.teleop, tone: "bg-orange-400/10 border-orange-400/20", valTone: "text-orange-300" },
    { label: "Endgame", value: currentOpr.endgame, tone: "bg-emerald-500/10 border-emerald-500/20", valTone: "text-emerald-300" },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-[7px] border px-3 py-1.5 ${item.tone}`}
        >
          <span className="text-white/45">{item.label}</span>
          <span className={`ml-2 font-semibold ${item.valTone}`}>{fmtNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function buildChartCoordinates(points: OprTrendPoint[], metric: keyof OprBreakdown) {
  const values = points.map((point) => point[metric]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return null;

  const width = 720;
  const height = 180;
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
      <div className="mt-3 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-3 py-2 text-xs text-white/40">
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
    <div className="mt-4 rounded-[10px] border border-white/8 bg-[#0d0d0d] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-[0.1em] text-white/40">OPR Over Time</div>

        <label className="sr-only" htmlFor={`opr-metric-${points[0]?.label ?? "event"}`}>
          OPR metric
        </label>
        <select
          id={`opr-metric-${points[0]?.label ?? "event"}`}
          value={metric}
          onChange={(event) => setMetric(event.target.value as keyof OprBreakdown)}
          className="h-7 rounded-[6px] border border-white/10 bg-[#090909] px-2 text-xs text-white outline-none"
        >
          {metricOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[180px] w-full"
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
            fill="rgba(99, 102, 241, 0.15)"
            stroke="none"
          />
          <polyline
            points={chart.line}
            fill="none"
            stroke="#818cf8"
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

const STRENGTH_STYLE: Record<ScheduleStrength["label"], { chip: string; text: string }> = {
  Easy:        { chip: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400" },
  Average:     { chip: "bg-sky-500/10 border-sky-500/20",         text: "text-sky-300"     },
  Competitive: { chip: "bg-amber-400/10 border-amber-400/20",     text: "text-amber-300"   },
  Tough:       { chip: "bg-red-500/10 border-red-500/20",         text: "text-red-400"     },
};

function ScheduleStrengthBadge({ ss }: { ss: ScheduleStrength | null }) {
  if (!ss) return null;
  const style = STRENGTH_STYLE[ss.label];
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <div className={`inline-flex items-center rounded-[7px] border px-3 py-1.5 ${style.chip}`}>
        <span className="text-white/45">Schedule Strength</span>
        <span className={`ml-2 font-semibold ${style.text}`}>{ss.label}</span>
        <span className="ml-1.5 text-white/30">· {fmtNumber(ss.avgOpponentOpr)} avg opp OPR</span>
      </div>
    </div>
  );
}

function EventStatsRow({ event }: { event: TeamEventSummary }) {
  if (!event.statsAvailable) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {event.rank !== null ? (
        <div className="rounded-[6px] border border-white/10 bg-[#101010] px-2.5 py-1.5 text-white/70">
          Rank {event.rank}
        </div>
      ) : null}
      {event.record ? (
        <div className="rounded-[6px] border border-white/10 bg-[#101010] px-2.5 py-1.5 text-white/70">
          {event.record}
        </div>
      ) : null}
      {event.rp !== null ? (
        <div className="rounded-[6px] border border-white/10 bg-[#101010] px-2.5 py-1.5 text-white/70">
          RP {fmtNumber(event.rp)}
        </div>
      ) : null}
      {event.npOpr !== null ? (
        <div className="rounded-[6px] border border-white/10 bg-[#101010] px-2.5 py-1.5 text-white/70">
          NP OPR {fmtNumber(event.npOpr)}
        </div>
      ) : null}
      {event.npAverage !== null ? (
        <div className="rounded-[6px] border border-white/10 bg-[#101010] px-2.5 py-1.5 text-white/70">
          NP AVG {fmtNumber(event.npAverage)}
        </div>
      ) : null}
    </div>
  );
}

function LoadingMatches() {
  return (
    <div className="mt-3 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-3 py-2 text-xs text-white/40">
      Loading matches...
    </div>
  );
}

function ScoutStars({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-flex gap-px">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < value ? color : "text-white/15"}>★</span>
      ))}
    </span>
  );
}

function ScoutReportBadge({ report }: { report: ScoutReport }) {
  const caps = [
    report.close_side && "Close",
    report.far_side && "Far",
    report.auto_close && "Auto Close",
    report.auto_far && "Auto Far",
    report.full_park && "Full Park",
    report.lift && "Lift",
  ].filter((v): v is string => Boolean(v));

  const hasTeleopRange =
    (report.close_side && (report.artifacts_teleop_close > 0 || report.artifacts_teleop_close_max > 0)) ||
    (report.far_side && (report.artifacts_teleop_far > 0 || report.artifacts_teleop_far_max > 0));

  const hasAutoArtifacts =
    (report.auto_close && report.artifacts_auto_close > 0) ||
    (report.auto_far && report.artifacts_auto_far > 0);

  const hasRatings = report.scoring_ability > 0 || report.defense_rating > 0 || report.close_rating > 0 || report.far_rating > 0;

  return (
    <div className="mt-3 rounded-[10px] border border-[#8be800]/15 bg-[#0a1400] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#8be800]/60">Scout Report · Self-Reported</div>

      {caps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {caps.map((c) => (
            <span key={c} className="rounded-[6px] border border-white/10 bg-white/6 px-2 py-0.5 text-xs text-white/65">{c}</span>
          ))}
          {report.preferred_side ? (
            <span className="rounded-[6px] border border-indigo-400/20 bg-indigo-400/8 px-2 py-0.5 text-xs text-indigo-300/70">
              Prefers {report.preferred_side}
            </span>
          ) : null}
        </div>
      )}

      {hasAutoArtifacts && (
        <div className="mb-1 text-xs text-white/48">
          Auto:{" "}
          {report.auto_close && report.artifacts_auto_close > 0 ? `Close ×${report.artifacts_auto_close}` : null}
          {report.auto_close && report.artifacts_auto_close > 0 && report.auto_far && report.artifacts_auto_far > 0 ? ", " : null}
          {report.auto_far && report.artifacts_auto_far > 0 ? `Far ×${report.artifacts_auto_far}` : null}
        </div>
      )}

      {hasTeleopRange && (
        <div className="mb-1 text-xs text-white/48">
          Teleop:{" "}
          {report.close_side && (report.artifacts_teleop_close > 0 || report.artifacts_teleop_close_max > 0)
            ? `Close ${report.artifacts_teleop_close}–${report.artifacts_teleop_close_max}`
            : null}
          {report.close_side && report.far_side ? ", " : null}
          {report.far_side && (report.artifacts_teleop_far > 0 || report.artifacts_teleop_far_max > 0)
            ? `Far ${report.artifacts_teleop_far}–${report.artifacts_teleop_far_max}`
            : null}
        </div>
      )}

      {hasRatings && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50 mb-1">
          {report.scoring_ability > 0 && (
            <span className="flex items-center gap-1">Scoring <ScoutStars value={report.scoring_ability} color="text-yellow-400" /></span>
          )}
          {report.defense_rating > 0 && (
            <span className="flex items-center gap-1">Defense <ScoutStars value={report.defense_rating} color="text-red-400" /></span>
          )}
          {report.close_rating > 0 && (
            <span className="flex items-center gap-1">Close <ScoutStars value={report.close_rating} color="text-blue-400" /></span>
          )}
          {report.far_rating > 0 && (
            <span className="flex items-center gap-1">Far <ScoutStars value={report.far_rating} color="text-purple-400" /></span>
          )}
          {report.estimated_solo_points > 0 && (
            <span>Est. {report.estimated_solo_points} pts</span>
          )}
        </div>
      )}

      {report.notes && (
        <div className="mt-1 text-xs text-white/40 italic">&ldquo;{report.notes}&rdquo;</div>
      )}
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
  scoutReports = {},
}: {
  teamNumber: number;
  season: number;
  events: TeamEventSummary[];
  scoutReports?: Record<string, ScoutReport>;
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
      <section className="mt-4 rounded-[12px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/55">
        No published events found for {season}.
      </section>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {events.map((event) => {
        const eventState = state[event.eventCode];

        return (
          <section
            key={`${event.eventCode}-${event.start ?? "none"}`}
            ref={(node) => {
              sectionRefs.current[event.eventCode] = node;
            }}
            data-event-code={event.eventCode}
            className="rounded-[12px] border border-white/10 bg-[#090909] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.eventCode)}&eventQuery=${encodeURIComponent(event.eventName)}`}
                  className="group"
                >
                  <h2 className="text-xl font-medium tracking-[-0.04em] text-white underline-offset-3 group-hover:underline">
                    {event.eventName}
                  </h2>
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/48">
                  <span className="uppercase tracking-[0.1em] text-white/30">{event.eventCode}</span>
                  <span>{fmtDateRange(event.start, event.end)}</span>
                  {event.location ? <span className="text-[#98a2ff]/80">{event.location}</span> : null}
                </div>
              </div>
            </div>

            <EventStatsRow event={event} />
            {scoutReports[event.eventCode] ? (
              <ScoutReportBadge report={scoutReports[event.eventCode]} />
            ) : null}
            <OprChips currentOpr={eventState?.data?.currentOpr ?? null} />
            <ScheduleStrengthBadge ss={eventState?.data?.scheduleStrength ?? null} />

            {eventState?.data?.awards.length ? (
              <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/70">
                {eventState.data.awards.join(", ")}
              </div>
            ) : null}

            {eventState?.loading ? (
              <LoadingMatches />
            ) : eventState?.error ? (
              <div className="mt-4 rounded-[8px] border border-white/10 bg-[#101010] p-3 text-sm text-[#ff8f8f]">
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
