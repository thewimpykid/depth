"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export type ScatterTeam = {
  teamNumber: number;
  teamName: string | null;
  npOpr: number;
  autoOpr: number;
  teleopOpr: number;
};

const W = 1000;
const H = 480;
const ML = 52;
const MR = 16;
const MT = 20;
const MB = 44;
const CW = W - ML - MR;
const CH = H - MT - MB;

function niceStep(range: number, targetCount: number): number {
  const rough = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const candidates = [1, 2, 5, 10].map((f) => f * mag);
  return candidates.find((c) => range / c <= targetCount * 1.5) ?? candidates[candidates.length - 1];
}

function axisTicks(max: number, step: number): number[] {
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v));
  return ticks;
}

function niceMax(val: number, step: number): number {
  return Math.ceil(val / step) * step;
}

export default function OprScatter({
  teams,
  season,
}: {
  teams: ScatterTeam[];
  season: number;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<{ team: ScatterTeam; px: number; py: number } | null>(null);
  const handleLeave = useCallback(() => setHovered(null), []);

  // Deduplicate by team number (keep highest npOpr), then filter invalid
  const seen = new Map<number, ScatterTeam>();
  for (const t of teams) {
    const existing = seen.get(t.teamNumber);
    if (!existing || t.npOpr > existing.npOpr) seen.set(t.teamNumber, t);
  }
  const filtered = Array.from(seen.values()).filter((t) => t.autoOpr >= 0 && t.teleopOpr >= 0);
  if (filtered.length === 0) return null;

  const rawAutoMax = Math.max(...filtered.map((t) => t.autoOpr));
  const rawTeleopMax = Math.max(...filtered.map((t) => t.teleopOpr));

  const autoStep = niceStep(rawAutoMax * 1.1, 16);
  const teleopStep = niceStep(rawTeleopMax * 1.1, 12);
  const autoMax = niceMax(rawAutoMax * 1.1, autoStep);
  const teleopMax = niceMax(rawTeleopMax * 1.1, teleopStep);

  const autoTickVals = axisTicks(autoMax, autoStep);
  const teleopTickVals = axisTicks(teleopMax, teleopStep);

  function toXY(autoOpr: number, teleopOpr: number): [number, number] {
    const x = ML + (autoOpr / autoMax) * CW;
    const y = MT + CH - (teleopOpr / teleopMax) * CH;
    return [x, y];
  }

  // Diagonal iso-NP lines: auto + teleop = K (approximate NP OPR contours)
  const npIsoMax = rawAutoMax + rawTeleopMax;
  const isoStep = niceStep(npIsoMax, 8);
  const isoLines: number[] = [];
  for (let v = isoStep; v < npIsoMax * 1.05; v += isoStep) {
    isoLines.push(Math.round(v));
  }

  // Top 80 teams by NP OPR get labels
  const sorted = [...filtered].sort((a, b) => b.npOpr - a.npOpr);
  const labelSet = new Set(sorted.slice(0, 80).map((t) => t.teamNumber));

  return (
    <div className="rounded-[12px] border border-white/8 bg-[#090909] p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-medium tracking-[-0.03em] text-white">
            OPR Distribution
          </div>
          <div className="mt-0.5 text-xs text-white/40">
            {season} season · {filtered.length} teams · auto vs teleop · diagonals = NP OPR
          </div>
        </div>
        {hovered ? (
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums text-white">
              {hovered.team.teamNumber}
            </div>
            {hovered.team.teamName ? (
              <div className="text-xs text-white/50 truncate max-w-[160px]">
                {hovered.team.teamName}
              </div>
            ) : null}
            <div className="mt-0.5 font-mono text-[10px] text-white/40">
              NP {hovered.team.npOpr.toFixed(1)} · A {hovered.team.autoOpr.toFixed(1)} · T {hovered.team.teleopOpr.toFixed(1)}
            </div>
          </div>
        ) : (
          <div className="shrink-0 text-xs text-white/22">hover · click to open team</div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={handleLeave}
        style={{ cursor: hovered ? "pointer" : "default" }}
      >
        <defs>
          <clipPath id="opr-plot-area">
            <rect x={ML} y={MT} width={CW} height={CH} />
          </clipPath>
        </defs>

        {/* Diagonal iso-NP reference lines (auto + teleop = K) */}
        <g clipPath="url(#opr-plot-area)">
          {isoLines.map((k) => {
            const autoStart = Math.min(k, autoMax);
            const teleopStart = k - autoStart;
            const autoEnd = Math.max(0, k - teleopMax);
            const teleopEnd = Math.min(k, teleopMax);
            const [x1, y1] = toXY(autoStart, teleopStart);
            const [x2, y2] = toXY(autoEnd, teleopEnd);
            return (
              <line
                key={`iso-${k}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
            );
          })}
        </g>

        {/* Grid lines */}
        {autoTickVals.map((tick) => {
          const [x] = toXY(tick, 0);
          return (
            <line
              key={`vg-${tick}`}
              x1={x} y1={MT} x2={x} y2={MT + CH}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
          );
        })}
        {teleopTickVals.map((tick) => {
          const [, y] = toXY(0, tick);
          return (
            <line
              key={`hg-${tick}`}
              x1={ML} y1={y} x2={ML + CW} y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* X ticks */}
        {autoTickVals.map((tick) => {
          const [x] = toXY(tick, 0);
          return (
            <g key={`xt-${tick}`}>
              <line x1={x} y1={MT + CH} x2={x} y2={MT + CH + 3} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
              <text x={x} y={MT + CH + 14} textAnchor="middle" fill="rgba(255,255,255,0.24)" fontSize="9.5">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Y ticks */}
        {teleopTickVals.slice(1).map((tick) => {
          const [, y] = toXY(0, tick);
          return (
            <g key={`yt-${tick}`}>
              <line x1={ML - 3} y1={y} x2={ML} y2={y} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
              <text x={ML - 6} y={y + 3.5} textAnchor="end" fill="rgba(255,255,255,0.24)" fontSize="9.5">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Axis names */}
        <text x={ML + CW / 2} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="10.5" fontWeight="500">
          Auto OPR
        </text>
        <text
          x={12}
          y={MT + CH / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.22)"
          fontSize="10.5"
          fontWeight="500"
          transform={`rotate(-90,12,${MT + CH / 2})`}
        >
          Teleop OPR
        </text>

        {/* Data points */}
        <g clipPath="url(#opr-plot-area)">
          {filtered.map((team) => {
            const [px, py] = toXY(team.autoOpr, team.teleopOpr);
            const isHov = hovered?.team.teamNumber === team.teamNumber;
            const isTop = labelSet.has(team.teamNumber);
            return (
              <circle
                key={team.teamNumber}
                cx={px}
                cy={py}
                r={isHov ? 5 : isTop ? 3 : 2.5}
                fill="#38bdf8"
                fillOpacity={isHov ? 1 : isTop ? 0.82 : 0.52}
                onMouseEnter={() => setHovered({ team, px, py })}
                onClick={() => router.push(`/teams?q=${team.teamNumber}&season=${season}`)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
        </g>

        {/* Team number labels for top 80 teams */}
        <g clipPath="url(#opr-plot-area)" pointerEvents="none">
          {sorted.slice(0, 80).map((team) => {
            const [px, py] = toXY(team.autoOpr, team.teleopOpr);
            const isHov = hovered?.team.teamNumber === team.teamNumber;
            return (
              <text
                key={`lbl-${team.teamNumber}`}
                x={px + 4}
                y={py - 4}
                fill={isHov ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.38)"}
                fontSize="8"
                fontFamily="monospace"
              >
                {team.teamNumber}
              </text>
            );
          })}
        </g>

        {/* Hover tooltip */}
        {hovered && (() => {
          const { team, px, py } = hovered;
          const tw = 152;
          const th = team.teamName ? 68 : 52;
          const tx = px + 14 > W - tw - 4 ? px - tw - 10 : px + 10;
          const ty = py - 8 < MT ? py + 6 : py - th + 6;
          const label = team.teamName ? (team.teamName.length > 22 ? team.teamName.slice(0, 22) + "…" : team.teamName) : null;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tw} height={th} rx="6" fill="rgba(6,6,6,0.94)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              <text x={tx + 10} y={ty + 18} fill="rgba(255,255,255,0.92)" fontSize="12" fontWeight="600">{team.teamNumber}</text>
              {label && <text x={tx + 10} y={ty + 32} fill="rgba(255,255,255,0.50)" fontSize="10">{label}</text>}
              <text x={tx + 10} y={ty + (label ? 50 : 36)} fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="monospace">
                {`NP ${team.npOpr.toFixed(1)}  A ${team.autoOpr.toFixed(1)}  T ${team.teleopOpr.toFixed(1)}`}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
