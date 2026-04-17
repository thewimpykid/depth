"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/* ── inline types (no server-only import) ── */
type RankedValue = { value: number | null; rank: number | null; percentile: number | null };
type TeamProfile = {
  name: string | null;
  organization: string | null;
  location: string | null;
  rookieYear: number | null;
};
type TeamEventSummary = {
  eventName: string;
  record: string | null;
  rank: number | null;
  npOpr: number | null;
};
type TeamQuickStats = {
  total: RankedValue;
  auto: RankedValue;
  teleop: RankedValue;
  endgame: RankedValue;
  comparedAgainst: number | null;
};
type TeamPageResult = {
  teamNumber: number;
  season: number;
  team: TeamProfile | null;
  quickStats: TeamQuickStats | null;
  events: TeamEventSummary[];
};

/* ── poster customisation types ── */

const COLOR_SCHEMES = {
  indigo:  { a: "#6366f1", b: "#0ea5e9", glow: "rgba(99,102,241,0.12)"  },
  crimson: { a: "#ef4444", b: "#f97316", glow: "rgba(239,68,68,0.12)"   },
  emerald: { a: "#10b981", b: "#06b6d4", glow: "rgba(16,185,129,0.12)"  },
  violet:  { a: "#8b5cf6", b: "#ec4899", glow: "rgba(139,92,246,0.12)"  },
  amber:   { a: "#f59e0b", b: "#fbbf24", glow: "rgba(245,158,11,0.12)"  },
} as const;

type ColorScheme = keyof typeof COLOR_SCHEMES;
type TeamSide = "none" | "far" | "close" | "hybrid";

interface PosterOptions {
  colorScheme: ColorScheme;
  teamSide: TeamSide;
  showOrg: boolean;
  showLocation: boolean;
  showRookieYear: boolean;
  showQR: boolean;
  showStats: boolean;
  showRecord: boolean;
}

const DEFAULT_OPTS: PosterOptions = {
  colorScheme: "indigo",
  teamSide: "none",
  showOrg: true,
  showLocation: true,
  showRookieYear: true,
  showQR: true,
  showStats: true,
  showRecord: true,
};

/* ── canvas helpers ── */

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (ctx.measureText(t + "…").width > maxW && t.length > 1) t = t.slice(0, -1);
  return t + "…";
}

interface CardOpts {
  label: string;
  labelColor: string;
  value: string;
  sub: string;
  barColor: string;
  valuePx: number;
}

function statCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  o: CardOpts,
) {
  rrect(ctx, x, y, w, h, 8);
  ctx.fillStyle = "#0d0d0d";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  rrect(ctx, x, y, w, h, 8);
  ctx.clip();
  ctx.fillStyle = o.barColor;
  ctx.fillRect(x, y, w, 4);
  ctx.restore();

  ctx.font = `500 9px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = o.labelColor;
  ctx.fillText(o.label, x + 12, y + 22);

  ctx.font = `700 ${o.valuePx}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(o.value, x + 12, y + Math.round(h * 0.62));

  if (o.sub) {
    ctx.font = `400 10px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(165,180,252,0.65)";
    ctx.fillText(o.sub, x + 12, y + h - 13);
  }
}

function drawSideBadge(ctx: CanvasRenderingContext2D, x: number, y: number, side: Exclude<TeamSide, "none">) {
  const configs = {
    far:    { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.35)",  text: "#fbbf24", dot: "#f59e0b", label: "FAR SIDE"   },
    close:  { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.35)",  text: "#a5b4fc", dot: "#6366f1", label: "CLOSE SIDE" },
    hybrid: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.35)", text: "#c4b5fd", dot: "#8b5cf6", label: "HYBRID"     },
  } as const;

  const c = configs[side];

  ctx.font = `600 9px system-ui, -apple-system, sans-serif`;
  const textW = ctx.measureText(c.label).width;
  const badgeW = textW + 26;
  const badgeH = 20;

  rrect(ctx, x, y, badgeW, badgeH, 4);
  ctx.fillStyle = c.bg;
  ctx.fill();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + 10, y + badgeH / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = c.dot;
  ctx.fill();

  ctx.fillStyle = c.text;
  ctx.fillText(c.label, x + 18, y + badgeH / 2 + 3.5);
}

/* ── main draw function ── */

async function drawPoster(canvas: HTMLCanvasElement, data: TeamPageResult, opts: PosterOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = 840;
  const H = 440;
  const DPR = window.devicePixelRatio ?? 1;
  const scheme = COLOR_SCHEMES[opts.colorScheme];

  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.scale(DPR, DPR);

  /* Background */
  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, W, H);

  /* Dot grid — right half */
  for (let gx = 432; gx < W - 10; gx += 48) {
    for (let gy = 24; gy < H - 10; gy += 48) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.042)";
      ctx.fill();
    }
  }

  /* Concentric arcs — top-right */
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(W + 24, -24, 90 + i * 64, Math.PI * 0.45, Math.PI * 1.15);
    ctx.strokeStyle = `rgba(255,255,255,${0.065 - i * 0.011})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* Scheme glow behind team number */
  const glow = ctx.createRadialGradient(160, 110, 10, 160, 110, 220);
  glow.addColorStop(0, scheme.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 380, 300);

  /* Left accent bar */
  const accentBar = ctx.createLinearGradient(0, 0, 0, H);
  accentBar.addColorStop(0, scheme.a);
  accentBar.addColorStop(1, scheme.b);
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, 5, H);

  /* Centre divider */
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(408, 28, 1, H - 56);

  /* ── LEFT SECTION ── */
  const lx = 28;

  /* Season tag */
  ctx.font = `500 9px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = scheme.a + "b8"; /* ~72% opacity hex */
  ctx.fillText(`FTC  ·  SEASON ${data.season}`, lx, 46);

  /* Faint watermark number */
  ctx.save();
  ctx.font = `700 190px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.022)";
  ctx.fillText(String(data.teamNumber), lx - 6, 248);
  ctx.restore();

  /* Hero team number */
  const numGrad = ctx.createLinearGradient(lx, 68, lx, 168);
  numGrad.addColorStop(0, "rgba(255,255,255,0.97)");
  numGrad.addColorStop(1, "rgba(255,255,255,0.48)");
  ctx.font = `700 88px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = numGrad;
  ctx.fillText(String(data.teamNumber), lx, 163);

  /* Underline — scheme colour */
  const ul = ctx.createLinearGradient(lx, 0, lx + 92, 0);
  ul.addColorStop(0, scheme.a);
  ul.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ul;
  ctx.fillRect(lx, 175, 92, 2);

  /* Team name (always shown) */
  const teamName = data.team?.name ?? `Team ${data.teamNumber}`;
  ctx.font = `600 20px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fillText(fit(ctx, teamName, 348), lx, 210);

  /* Dynamic info block — tracks Y position */
  let infoY = 232;

  if (opts.showOrg && data.team?.organization) {
    ctx.font = `400 13px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.50)";
    ctx.fillText(fit(ctx, data.team.organization, 348), lx, infoY);
    infoY += 22;
  }

  if (opts.showLocation && data.team?.location) {
    ctx.font = `400 12px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#a5b4fc";
    ctx.fillText(data.team.location, lx, infoY);
    infoY += 20;
  }

  if (opts.showRookieYear && data.team?.rookieYear) {
    ctx.font = `400 11px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText(`Est. ${data.team.rookieYear}`, lx, infoY);
    infoY += 18;
  }

  /* ── Bottom-left dynamic block ── */
  let dy = Math.max(infoY + 10, 286);

  /* QR code */
  if (opts.showQR) {
    try {
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, `https://depthftc.vercel.app/teams?q=${data.teamNumber}`, {
        width: 72,
        margin: 1,
        color: { dark: "#ffffff", light: "#111111" },
      });
      rrect(ctx, lx - 3, dy - 3, 78, 78, 6);
      ctx.fillStyle = "#111111";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(qrCanvas, lx, dy);
      dy += 84;
    } catch {
      /* skip */
    }
  }

  /* Team side badge */
  if (opts.teamSide !== "none") {
    drawSideBadge(ctx, lx, dy, opts.teamSide);
    dy += 30;
  }

  /* Record summary */
  if (opts.showRecord && data.events.length > 0) {
    const recY = Math.min(Math.max(dy + 8, 388), 410);
    const eventsWithRecord = data.events.filter((e) => e.record !== null);
    const wins = eventsWithRecord.reduce((s, e) => s + (parseInt(e.record!.split("-")[0], 10) || 0), 0);
    const losses = eventsWithRecord.reduce((s, e) => s + (parseInt(e.record!.split("-")[1], 10) || 0), 0);
    const recordStr = eventsWithRecord.length > 0 ? `  ·  ${wins}W – ${losses}L` : "";
    ctx.font = `500 11px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillText(
      `${data.events.length} event${data.events.length !== 1 ? "s" : ""}${recordStr}`,
      lx, recY,
    );
  }

  /* ── RIGHT SECTION ── */
  const rx = 426;
  const rw = W - rx - 18;

  if (opts.showStats) {
    ctx.font = `500 9px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText("QUICK STATS", rx, 46);

    if (!data.quickStats) {
      ctx.font = `400 13px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillText("No stats available this season.", rx, 90);
    } else {
      const qs = data.quickStats;
      const topY = 58;
      const topH = 120;
      const topGap = 10;
      const topW = Math.floor((rw - topGap) / 2);

      statCard(ctx, rx, topY, topW, topH, {
        label: "TOTAL NP OPR",
        labelColor: "rgba(248,250,252,0.70)",
        value: qs.total.value !== null ? qs.total.value.toFixed(2) : "—",
        sub: qs.total.rank !== null && qs.total.percentile !== null
          ? `#${qs.total.rank}  ·  top ${(100 - qs.total.percentile).toFixed(1)}%`
          : "",
        barColor: "rgba(255,255,255,0.28)",
        valuePx: 32,
      });

      statCard(ctx, rx + topW + topGap, topY, topW, topH, {
        label: "SEASON RANK",
        labelColor: "#c4b5fd",
        value: qs.total.rank !== null ? `#${qs.total.rank}` : "—",
        sub: qs.comparedAgainst ? `of ${qs.comparedAgainst} teams` : "",
        barColor: "rgba(196,181,253,0.40)",
        valuePx: 32,
      });

      const botY = topY + topH + 10;
      const botH = 130;
      const botGap = 10;
      const botW = Math.floor((rw - 2 * botGap) / 3);

      const botStats: Array<{ label: string; value: RankedValue; barColor: string; labelColor: string }> = [
        { label: "AUTO",    value: qs.auto,    barColor: "rgba(125,211,252,0.36)", labelColor: "#7dd3fc" },
        { label: "TELEOP",  value: qs.teleop,  barColor: "rgba(253,186,116,0.36)", labelColor: "#fdba74" },
        { label: "ENDGAME", value: qs.endgame, barColor: "rgba(110,231,183,0.36)", labelColor: "#6ee7b7" },
      ];

      botStats.forEach((s, i) => {
        statCard(ctx, rx + i * (botW + botGap), botY, botW, botH, {
          label: s.label,
          labelColor: s.labelColor,
          value: s.value.value !== null ? s.value.value.toFixed(2) : "—",
          sub: s.value.rank !== null ? `#${s.value.rank}` : "",
          barColor: s.barColor,
          valuePx: 26,
        });
      });

      /* Top events */
      const evY = botY + botH + 14;
      const topEvents = [...data.events]
        .filter((e) => e.npOpr !== null)
        .sort((a, b) => (b.npOpr ?? 0) - (a.npOpr ?? 0))
        .slice(0, 2);

      if (topEvents.length > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(rx, evY, rw, 1);

        ctx.font = `500 9px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.24)";
        ctx.fillText("TOP EVENTS BY OPR", rx, evY + 16);

        topEvents.forEach((e, i) => {
          const ey = evY + 32 + i * 20;
          ctx.font = `400 11px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.42)";
          ctx.fillText(fit(ctx, e.eventName, 215), rx, ey);
          if (e.record) {
            ctx.fillStyle = "#a5b4fc";
            ctx.fillText(e.record, rx + 224, ey);
          }
          if (e.rank) {
            ctx.fillStyle = "rgba(255,255,255,0.26)";
            ctx.fillText(`rank ${e.rank}`, rx + 270, ey);
          }
        });
      }
    }
  }

  /* Bottom gradient bar — scheme colours */
  const botBar = ctx.createLinearGradient(0, 0, W, 0);
  botBar.addColorStop(0, "rgba(0,0,0,0)");
  botBar.addColorStop(0.25, scheme.a + "bf"); /* ~75% opacity */
  botBar.addColorStop(0.65, scheme.b + "bf");
  botBar.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = botBar;
  ctx.fillRect(0, H - 3, W, 3);

  /* Footer */
  ctx.font = `400 10px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.textAlign = "right";
  ctx.fillText("depthftc.vercel.app", W - 20, H - 12);
  ctx.textAlign = "left";
}

/* ── React component ── */

const SCHEME_KEYS = Object.keys(COLOR_SCHEMES) as ColorScheme[];

const SIDE_OPTIONS: { value: TeamSide; label: string }[] = [
  { value: "none",   label: "None"       },
  { value: "far",    label: "Far Side"   },
  { value: "close",  label: "Close Side" },
  { value: "hybrid", label: "Hybrid"     },
];

const INFO_TOGGLES: { key: keyof PosterOptions; label: string }[] = [
  { key: "showOrg",        label: "Org"      },
  { key: "showLocation",   label: "Location" },
  { key: "showRookieYear", label: "Est. Year" },
  { key: "showQR",         label: "QR Code"  },
  { key: "showStats",      label: "Stats"    },
  { key: "showRecord",     label: "Record"   },
];

export function PosterButton({ data }: { data: TeamPageResult }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<PosterOptions>(DEFAULT_OPTS);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && canvasRef.current) {
      void drawPoster(canvasRef.current, data, opts);
    }
  }, [open, data, opts]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-${data.teamNumber}-depthscout.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, "image/png");
  }

  function setOpt<K extends keyof PosterOptions>(key: K, value: PosterOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[8px] border border-white/10 bg-[#111111] px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/8 hover:text-white/90"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 2.5V6M5.5 6h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Export Card
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="flex w-full max-w-3xl flex-col gap-3 rounded-[14px] border border-white/10 bg-[#0a0a0a] p-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">Team Card</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-[6px] p-1.5 text-white/40 transition-colors hover:bg-white/8 hover:text-white/70"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Canvas preview */}
            <div className="overflow-hidden rounded-[10px]">
              <canvas
                ref={canvasRef}
                className="block w-full"
                style={{ aspectRatio: "840 / 440" }}
              />
            </div>

            {/* Options panel */}
            <div className="space-y-4 rounded-[10px] border border-white/8 bg-[#0d0d0d] p-4">

              {/* Color scheme */}
              <div className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.12em] text-white/36">Color</span>
                <div className="flex gap-2">
                  {SCHEME_KEYS.map((scheme) => {
                    const s = COLOR_SCHEMES[scheme];
                    const active = opts.colorScheme === scheme;
                    return (
                      <button
                        key={scheme}
                        onClick={() => setOpt("colorScheme", scheme)}
                        title={scheme}
                        className={`h-6 w-6 rounded-full transition-all ${active ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-[#0d0d0d]" : "opacity-60 hover:opacity-90"}`}
                        style={{ background: `linear-gradient(135deg, ${s.a}, ${s.b})` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Team side */}
              <div className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.12em] text-white/36">Side</span>
                <div className="flex flex-wrap gap-1.5">
                  {SIDE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setOpt("teamSide", value)}
                      className={`rounded-[6px] px-2.5 py-1 text-xs transition-colors ${
                        opts.teamSide === value
                          ? "bg-white/12 text-white"
                          : "text-white/40 hover:bg-white/6 hover:text-white/60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show/hide toggles */}
              <div className="flex items-center gap-4">
                <span className="w-16 shrink-0 text-[10px] uppercase tracking-[0.12em] text-white/36">Show</span>
                <div className="flex flex-wrap gap-1.5">
                  {INFO_TOGGLES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setOpt(key, !opts[key] as PosterOptions[typeof key])}
                      className={`rounded-[6px] px-2.5 py-1 text-xs transition-colors ${
                        opts[key]
                          ? "bg-white/12 text-white"
                          : "text-white/36 hover:bg-white/6 hover:text-white/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-[8px] bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M8 1.5v9M5 8l3 3 3-3M2 11.5v1.5a1 1 0 001 1h10a1 1 0 001-1v-1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download PNG
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-white/10 px-4 py-2 text-sm text-white/52 transition-colors hover:bg-white/6 hover:text-white/70"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
