"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

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

/* ── main draw function ── */

async function drawPoster(canvas: HTMLCanvasElement, data: TeamPageResult) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = 840;
  const H = 440;
  const DPR = window.devicePixelRatio ?? 1;

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

  /* Indigo glow behind team number */
  const glow = ctx.createRadialGradient(160, 110, 10, 160, 110, 220);
  glow.addColorStop(0, "rgba(99,102,241,0.12)");
  glow.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 380, 300);

  /* Left accent bar */
  const accentBar = ctx.createLinearGradient(0, 0, 0, H);
  accentBar.addColorStop(0, "#6366f1");
  accentBar.addColorStop(1, "#0ea5e9");
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, 5, H);

  /* Centre divider */
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(408, 28, 1, H - 56);

  /* ── LEFT SECTION ── */
  const lx = 28;

  ctx.font = `500 9px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(129,140,248,0.72)";
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

  /* Underline */
  const ul = ctx.createLinearGradient(lx, 0, lx + 92, 0);
  ul.addColorStop(0, "#6366f1");
  ul.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = ul;
  ctx.fillRect(lx, 175, 92, 2);

  /* Team name */
  const teamName = data.team?.name ?? `Team ${data.teamNumber}`;
  ctx.font = `600 20px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.fillText(fit(ctx, teamName, 348), lx, 210);

  /* Organization */
  if (data.team?.organization) {
    ctx.font = `400 13px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.50)";
    ctx.fillText(fit(ctx, data.team.organization, 348), lx, 232);
  }

  /* Location */
  if (data.team?.location) {
    ctx.font = `400 12px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#a5b4fc";
    ctx.fillText(data.team.location, lx, 252);
  }

  /* Rookie year */
  if (data.team?.rookieYear) {
    ctx.font = `400 11px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText(`Est. ${data.team.rookieYear}`, lx, 272);
  }

  /* QR code */
  try {
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, `https://depthftc.vercel.app/teams?q=${data.teamNumber}`, {
      width: 72,
      margin: 1,
      color: { dark: "#ffffff", light: "#111111" },
    });
    rrect(ctx, lx - 3, 283, 78, 78, 6);
    ctx.fillStyle = "#111111";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.drawImage(qrCanvas, lx, 286);
  } catch {
    /* QR generation failed — skip silently */
  }

  /* Record summary */
  if (data.events.length > 0) {
    const eventsWithRecord = data.events.filter((e) => e.record !== null);
    const wins = eventsWithRecord.reduce(
      (s, e) => s + (parseInt(e.record!.split("-")[0], 10) || 0), 0,
    );
    const losses = eventsWithRecord.reduce(
      (s, e) => s + (parseInt(e.record!.split("-")[1], 10) || 0), 0,
    );
    const recordStr = eventsWithRecord.length > 0 ? `  ·  ${wins}W – ${losses}L` : "";
    ctx.font = `500 11px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillText(
      `${data.events.length} event${data.events.length !== 1 ? "s" : ""}${recordStr}`,
      lx, 395,
    );
  }

  /* ── RIGHT SECTION ── */
  const rx = 426;
  const rw = W - rx - 18;

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

    /* Top events by OPR */
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

  /* Bottom gradient bar */
  const botBar = ctx.createLinearGradient(0, 0, W, 0);
  botBar.addColorStop(0, "rgba(99,102,241,0)");
  botBar.addColorStop(0.25, "rgba(99,102,241,0.75)");
  botBar.addColorStop(0.65, "rgba(14,165,233,0.75)");
  botBar.addColorStop(1, "rgba(14,165,233,0)");
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

export function PosterButton({ data }: { data: TeamPageResult }) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && canvasRef.current) {
      void drawPoster(canvasRef.current, data);
    }
  }, [open, data]);

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="flex w-full max-w-3xl flex-col gap-4 rounded-[14px] border border-white/10 bg-[#0a0a0a] p-5">
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

            <div className="overflow-hidden rounded-[10px]">
              <canvas
                ref={canvasRef}
                className="block w-full"
                style={{ aspectRatio: "840 / 440" }}
              />
            </div>

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
