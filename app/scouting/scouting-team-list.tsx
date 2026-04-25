"use client";

import { useMemo, useState } from "react";
import type { ScoutReport } from "@/lib/scout-db";
import type { OprBreakdown } from "@/lib/ftc";

type Team = { teamNumber: number; name: string | null };

type FormState = {
  autoClose: boolean;
  autoFar: boolean;
  artifactsAutoClose: number;
  artifactsAutoFar: number;
  closeSide: boolean;
  farSide: boolean;
  artifactsTeleopClose: number;
  artifactsTeleopCloseMax: number;
  artifactsTeleopFar: number;
  artifactsTeleopFarMax: number;
  fullPark: boolean;
  lift: boolean;
  preferredSide: "close" | "far" | "";
  closeRating: number;
  farRating: number;
  scoringAbility: number;
  defenseRating: number;
  estimatedSoloPoints: number;
  notes: string;
};

function defaultForm(): FormState {
  return {
    autoClose: false, autoFar: false,
    artifactsAutoClose: 0, artifactsAutoFar: 0,
    closeSide: false, farSide: false,
    artifactsTeleopClose: 0, artifactsTeleopCloseMax: 0,
    artifactsTeleopFar: 0, artifactsTeleopFarMax: 0,
    fullPark: false, lift: false,
    preferredSide: "",
    closeRating: 0, farRating: 0,
    scoringAbility: 0, defenseRating: 0,
    estimatedSoloPoints: 0,
    notes: "",
  };
}

function formFromReport(r: ScoutReport): FormState {
  return {
    autoClose: r.auto_close, autoFar: r.auto_far,
    artifactsAutoClose: r.artifacts_auto_close, artifactsAutoFar: r.artifacts_auto_far,
    closeSide: r.close_side, farSide: r.far_side,
    artifactsTeleopClose: r.artifacts_teleop_close,
    artifactsTeleopCloseMax: r.artifacts_teleop_close_max,
    artifactsTeleopFar: r.artifacts_teleop_far,
    artifactsTeleopFarMax: r.artifacts_teleop_far_max,
    fullPark: r.full_park, lift: r.lift,
    preferredSide: r.preferred_side ?? "",
    closeRating: r.close_rating, farRating: r.far_rating,
    scoringAbility: r.scoring_ability, defenseRating: r.defense_rating,
    estimatedSoloPoints: r.estimated_solo_points,
    notes: r.notes ?? "",
  };
}

/* ──────────────────── Primitive components ──────────────────── */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors w-full",
        checked ? "border-[#8be800]/30 bg-[#8be800]/8" : "border-white/8 bg-[#0a0a0a] hover:border-white/14",
      ].join(" ")}
    >
      <div className={[
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked ? "border-[#8be800]/60 bg-[#8be800]/25" : "border-white/18",
      ].join(" ")}>
        {checked ? (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3 5.5L8 1" stroke="#8be800" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
      <span className={["text-sm transition-colors", checked ? "text-white" : "text-white/52"].join(" ")}>{label}</span>
    </button>
  );
}

function Stepper({ label, value, onChange, step = 5, max = 300 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5">
      <span className="text-sm text-white/55">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(Math.max(0, value - step))}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/10 bg-[#161616] text-white/70 hover:bg-[#222] hover:text-white active:scale-95 transition-transform">−</button>
        <span className="w-8 text-center text-sm font-medium tabular-nums text-white">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/10 bg-[#161616] text-white/70 hover:bg-[#222] hover:text-white active:scale-95 transition-transform">+</button>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5">
      <span className="text-sm text-white/55">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(isNaN(n) ? 0 : Math.max(0, n));
        }}
        className="w-14 rounded-[7px] border border-white/10 bg-[#161616] px-2 py-1 text-center text-sm font-medium tabular-nums text-white outline-none focus:border-white/28 placeholder:text-white/20"
      />
    </div>
  );
}

function RangeInput({ label, min, max, onMinChange, onMaxChange }: {
  label: string; min: number; max: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  function parseVal(raw: string, fallback: number) {
    const n = parseInt(raw, 10);
    return isNaN(n) ? fallback : Math.max(0, n);
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5">
      <span className="text-sm text-white/55">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={min === 0 ? "" : min}
          placeholder="0"
          onChange={(e) => onMinChange(parseVal(e.target.value, 0))}
          className="w-12 rounded-[7px] border border-white/10 bg-[#161616] px-1.5 py-1 text-center text-sm font-medium tabular-nums text-white outline-none focus:border-white/28 placeholder:text-white/20"
        />
        <span className="text-sm text-white/28">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={max === 0 ? "" : max}
          placeholder="0"
          onChange={(e) => onMaxChange(parseVal(e.target.value, 0))}
          className="w-12 rounded-[7px] border border-white/10 bg-[#161616] px-1.5 py-1 text-center text-sm font-medium tabular-nums text-white outline-none focus:border-white/28 placeholder:text-white/20"
        />
      </div>
    </div>
  );
}

function Stars({ label, value, onChange, color = "#fbbf24" }: {
  label: string; value: number; onChange: (v: number) => void; color?: string;
}) {
  return (
    <div className="rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white/55">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(value === star ? 0 : star)}
              className="flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors hover:bg-white/6 active:scale-90"
              style={{ color: star <= value ? color : "rgba(255,255,255,0.18)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l1.854 3.756 4.146.603-3 2.923.708 4.128L8 10.25l-3.708 1.16.708-4.128-3-2.923 4.146-.603L8 1z"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Summary display ──────────────────── */

function StarDisplay({ value, color = "#fbbf24" }: { value: number; color?: string }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="10" height="10" viewBox="0 0 16 16" fill="currentColor"
          style={{ color: s <= value ? color : "rgba(255,255,255,0.15)" }}>
          <path d="M8 1l1.854 3.756 4.146.603-3 2.923.708 4.128L8 10.25l-3.708 1.16.708-4.128-3-2.923 4.146-.603L8 1z"/>
        </svg>
      ))}
    </span>
  );
}

function Chip({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#8be800]/25 bg-[#8be800]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#8be800]">
      ✓ {label}
    </span>
  );
}

function ScoutDataDisplay({ report }: { report: ScoutReport }) {
  const hasClose = report.auto_close || report.close_side;
  const hasFar = report.auto_far || report.far_side;
  return (
    <div className="mt-3 space-y-2.5">
      {/* Capability chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Auto close" active={report.auto_close} />
        <Chip label="Auto far" active={report.auto_far} />
        <Chip label="Teleop close" active={report.close_side} />
        <Chip label="Teleop far" active={report.far_side} />
        <Chip label="Full park" active={report.full_park} />
        <Chip label="Lift" active={report.lift} />
        {report.preferred_side ? (
          <span className="inline-flex items-center rounded-full border border-[#8ea3ff]/25 bg-[#8ea3ff]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#8ea3ff]">
            Prefers {report.preferred_side}
          </span>
        ) : null}
      </div>

      {/* Artifact counts */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/42">
        {report.auto_close ? <span>Auto close <span className="text-white font-medium">{report.artifacts_auto_close}</span></span> : null}
        {report.auto_far ? <span>Auto far <span className="text-white font-medium">{report.artifacts_auto_far}</span></span> : null}
        {report.close_side ? (
          <span>Teleop close <span className="text-white font-medium">
            {report.artifacts_teleop_close_max > report.artifacts_teleop_close
              ? `${report.artifacts_teleop_close}–${report.artifacts_teleop_close_max}`
              : report.artifacts_teleop_close}
          </span></span>
        ) : null}
        {report.far_side ? (
          <span>Teleop far <span className="text-white font-medium">
            {report.artifacts_teleop_far_max > report.artifacts_teleop_far
              ? `${report.artifacts_teleop_far}–${report.artifacts_teleop_far_max}`
              : report.artifacts_teleop_far}
          </span></span>
        ) : null}
        {report.estimated_solo_points > 0 ? <span>Solo pts <span className="text-white font-medium">{report.estimated_solo_points}</span></span> : null}
      </div>

      {/* Notes */}
      {report.notes ? (
        <div className="rounded-[8px] border border-white/6 bg-[#0d0d0d] px-3 py-2 text-xs text-white/50 leading-relaxed">
          {report.notes}
        </div>
      ) : null}

      {/* Ratings row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
        {report.scoring_ability > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>Scoring</span>
            <StarDisplay value={report.scoring_ability} color="#fbbf24" />
          </div>
        ) : null}
        {report.defense_rating > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>Defense</span>
            <StarDisplay value={report.defense_rating} color="#f87171" />
          </div>
        ) : null}
        {hasClose && report.close_rating > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>Close</span>
            <StarDisplay value={report.close_rating} color="#60a5fa" />
          </div>
        ) : null}
        {hasFar && report.far_rating > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span>Far</span>
            <StarDisplay value={report.far_rating} color="#a78bfa" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────── Scout form ──────────────────── */

function ScoutForm({
  teamNumber, eventCode, season, initialForm, onSubmitted, onCancel,
}: {
  teamNumber: number; eventCode: string; season: number;
  initialForm?: FormState;
  onSubmitted: (report: ScoutReport) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialForm ?? defaultForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season, eventCode, teamNumber,
          autoClose: form.autoClose, autoFar: form.autoFar,
          artifactsAutoClose: form.artifactsAutoClose, artifactsAutoFar: form.artifactsAutoFar,
          closeSide: form.closeSide, farSide: form.farSide,
          artifactsTeleopClose: form.artifactsTeleopClose, artifactsTeleopCloseMax: form.artifactsTeleopCloseMax,
          artifactsTeleopFar: form.artifactsTeleopFar, artifactsTeleopFarMax: form.artifactsTeleopFarMax,
          fullPark: form.fullPark, lift: form.lift,
          preferredSide: form.preferredSide || null,
          closeRating: form.closeRating, farRating: form.farRating,
          scoringAbility: form.scoringAbility, defenseRating: form.defenseRating,
          estimatedSoloPoints: form.estimatedSoloPoints,
          notes: form.notes || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Failed to save"); return; }
      onSubmitted({
        id: 0, season, event_code: eventCode, team_number: teamNumber,
        auto_close: form.autoClose, auto_far: form.autoFar,
        artifacts_auto_close: form.artifactsAutoClose, artifacts_auto_far: form.artifactsAutoFar,
        close_side: form.closeSide, far_side: form.farSide,
        artifacts_teleop_close: form.artifactsTeleopClose,
        artifacts_teleop_close_max: form.artifactsTeleopCloseMax,
        artifacts_teleop_far: form.artifactsTeleopFar,
        artifacts_teleop_far_max: form.artifactsTeleopFarMax,
        full_park: form.fullPark, lift: form.lift,
        preferred_side: form.preferredSide || null,
        close_rating: form.closeRating, far_rating: form.farRating,
        scoring_ability: form.scoringAbility, defense_rating: form.defenseRating,
        estimated_solo_points: form.estimatedSoloPoints,
        notes: form.notes || null,
        submitted_at: new Date().toISOString(),
      });
    } catch { setError("Network error — check connection"); }
    finally { setSubmitting(false); }
  }

  const showCloseRating = form.autoClose || form.closeSide;
  const showFarRating = form.autoFar || form.farSide;

  return (
    <div className="mt-3 rounded-[12px] border border-white/10 bg-[#080808] p-4 space-y-4">

      {/* ── Auto ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Auto</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Close side" checked={form.autoClose} onChange={(v) => set("autoClose", v)} />
          <Toggle label="Far side" checked={form.autoFar} onChange={(v) => set("autoFar", v)} />
        </div>
        {(form.autoClose || form.autoFar) ? (
          <div className="mt-2 space-y-2">
            {form.autoClose ? (
              <NumberInput label="Artifacts close" value={form.artifactsAutoClose} onChange={(v) => set("artifactsAutoClose", v)} />
            ) : null}
            {form.autoFar ? (
              <NumberInput label="Artifacts far" value={form.artifactsAutoFar} onChange={(v) => set("artifactsAutoFar", v)} />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Teleop ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Teleop</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Close side" checked={form.closeSide} onChange={(v) => set("closeSide", v)} />
          <Toggle label="Far side" checked={form.farSide} onChange={(v) => set("farSide", v)} />
        </div>
        {(form.closeSide || form.farSide) ? (
          <div className="mt-2 space-y-2">
            {form.closeSide ? (
              <RangeInput
                label="Artifacts close"
                min={form.artifactsTeleopClose}
                max={form.artifactsTeleopCloseMax}
                onMinChange={(v) => set("artifactsTeleopClose", v)}
                onMaxChange={(v) => set("artifactsTeleopCloseMax", v)}
              />
            ) : null}
            {form.farSide ? (
              <RangeInput
                label="Artifacts far"
                min={form.artifactsTeleopFar}
                max={form.artifactsTeleopFarMax}
                onMinChange={(v) => set("artifactsTeleopFar", v)}
                onMaxChange={(v) => set("artifactsTeleopFarMax", v)}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Ratings ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Ratings</div>
        <div className="space-y-2">
          <Stars label="Scoring ability" value={form.scoringAbility} onChange={(v) => set("scoringAbility", v)} color="#fbbf24" />
          <Stars label="Defense rating" value={form.defenseRating} onChange={(v) => set("defenseRating", v)} color="#f87171" />
          {showCloseRating ? (
            <Stars label="Close side rating" value={form.closeRating} onChange={(v) => set("closeRating", v)} color="#60a5fa" />
          ) : null}
          {showFarRating ? (
            <Stars label="Far side rating" value={form.farRating} onChange={(v) => set("farRating", v)} color="#a78bfa" />
          ) : null}
        </div>
      </div>

      {/* ── Endgame ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Endgame</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Full park" checked={form.fullPark} onChange={(v) => set("fullPark", v)} />
          <Toggle label="Lift" checked={form.lift} onChange={(v) => set("lift", v)} />
        </div>
      </div>

      {/* ── Other ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Other</div>
        <div className="space-y-2">
          <Stepper label="Est. solo points" value={form.estimatedSoloPoints} onChange={(v) => set("estimatedSoloPoints", v)} step={5} max={300} />
          <div className="rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5">
            <div className="mb-2 text-sm text-white/55">Preferred side</div>
            <div className="flex gap-2">
              {(["close", "far"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => set("preferredSide", form.preferredSide === side ? "" : side)}
                  className={[
                    "flex-1 rounded-[8px] border py-2 text-sm font-medium transition-colors",
                    form.preferredSide === side
                      ? "border-[#8ea3ff]/40 bg-[#8ea3ff]/12 text-[#8ea3ff]"
                      : "border-white/8 text-white/36 hover:text-white/60",
                  ].join(" ")}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Notes</div>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Anything else worth noting…"
          rows={3}
          maxLength={1000}
          className="w-full rounded-[10px] border border-white/8 bg-[#0a0a0a] px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/20 resize-none"
        />
      </div>

      {error ? (
        <div className="rounded-[8px] border border-[#ff6b6b]/25 bg-[#ff6b6b]/8 px-3 py-2 text-sm text-[#ff9c9c]">{error}</div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="flex-1 rounded-[10px] border border-white/10 bg-white py-3 text-sm font-semibold text-black disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {submitting ? "Saving…" : "Save Report"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] border border-white/8 bg-[#0d0d0d] px-5 py-3 text-sm text-white/36 hover:text-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ──────────────────── CSV export ──────────────────── */

function exportCsv(teams: Team[], reports: ScoutReport[], eventCode: string) {
  const reportMap = new Map(reports.map((r) => [r.team_number, r]));
  const headers = [
    "team_number", "team_name",
    "auto_close", "auto_far", "artifacts_auto_close", "artifacts_auto_far",
    "teleop_close", "teleop_far",
    "artifacts_teleop_close_min", "artifacts_teleop_close_max",
    "artifacts_teleop_far_min", "artifacts_teleop_far_max",
    "full_park", "lift", "preferred_side",
    "scoring_ability", "defense_rating", "close_rating", "far_rating",
    "estimated_solo_points", "notes",
  ];
  const rows = teams.map((t) => {
    const r = reportMap.get(t.teamNumber);
    if (!r) return [t.teamNumber, t.name ?? "", ...Array(headers.length - 2).fill("")];
    return [
      r.team_number, t.name ?? "",
      r.auto_close, r.auto_far, r.artifacts_auto_close, r.artifacts_auto_far,
      r.close_side, r.far_side,
      r.artifacts_teleop_close, r.artifacts_teleop_close_max,
      r.artifacts_teleop_far, r.artifacts_teleop_far_max,
      r.full_park, r.lift, r.preferred_side ?? "",
      r.scoring_ability, r.defense_rating, r.close_rating, r.far_rating,
      r.estimated_solo_points, (r.notes ?? "").replace(/"/g, '""'),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => (String(v).includes(",") || String(v).includes('"') || String(v).includes("\n") ? `"${v}"` : v)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scout-${eventCode}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ──────────────────── Main export ──────────────────── */

function OprChips({ opr }: { opr: OprBreakdown }) {
  const fmt = (v: number | null) => (v == null ? null : v.toFixed(1));
  const chips = [
    { label: "NP", value: fmt(opr.total), color: "text-white/70" },
    { label: "Auto", value: fmt(opr.auto), color: "text-indigo-300/70" },
    { label: "DC", value: fmt(opr.teleop), color: "text-indigo-300/60" },
    { label: "EG", value: fmt(opr.endgame), color: "text-indigo-300/50" },
  ].filter((c) => c.value != null);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1">
      {chips.map((c) => (
        <span key={c.label} className="flex items-center gap-1 text-[10px] tabular-nums">
          <span className="text-white/22 uppercase tracking-[0.08em]">{c.label}</span>
          <span className={c.color}>{c.value}</span>
        </span>
      ))}
    </div>
  );
}

export default function ScoutingTeamList({
  teams, initialReports, eventCode, season, qrDataUrl, eventName, qrUrl, oprMap = {},
}: {
  teams: Team[]; initialReports: ScoutReport[]; eventCode: string;
  season: number; qrDataUrl: string; eventName: string; qrUrl: string;
  oprMap?: Record<number, OprBreakdown>;
}) {
  const [reports, setReports] = useState<ScoutReport[]>(initialReports);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  function reportForTeam(n: number) {
    return reports.find((r) => r.team_number === n) ?? null;
  }

  function handleSubmitted(report: ScoutReport) {
    setReports((prev) => [...prev.filter((r) => r.team_number !== report.team_number), report]);
    setExpandedTeam(null);
  }

  const q = search.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!q) return teams;
    return teams.filter(
      (t) => String(t.teamNumber).startsWith(q) || (t.name ?? "").toLowerCase().includes(q)
    );
  }, [teams, q]);

  const withData = filteredTeams.filter((t) => reportForTeam(t.teamNumber));
  const withoutData = filteredTeams.filter((t) => !reportForTeam(t.teamNumber));

  return (
    <div className="mt-4 space-y-3">

      {/* Event header + QR */}
      <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xl font-semibold tracking-[-0.03em] text-white">{eventName}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/30">{eventCode}</div>
            <div className="mt-3 text-sm text-white/44 leading-relaxed">
              Teams scan to self-report. Share the link or QR code.
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-3 py-2">
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-white/36">{qrUrl}</span>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(qrUrl)}
                className="shrink-0 rounded-[6px] border border-white/10 bg-[#111111] px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-white/44 hover:text-white/80"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code for scouting ${eventCode}`}
              className="h-32 w-32 rounded-[10px] border border-white/10 sm:h-36 sm:w-36" />
            <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">Scan to report</span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="flex flex-wrap items-stretch gap-2">
        {[
          { label: "Teams", value: teams.length, color: "text-white" },
          { label: "Reported", value: reports.length, color: "text-[#8be800]" },
          { label: "Remaining", value: teams.length - reports.length, color: "text-white/36" },
        ].map((s) => (
          <div key={s.label} className="flex-1 min-w-[80px] rounded-[10px] border border-white/8 bg-[#090909] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/28">{s.label}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums tracking-[-0.04em] sm:text-2xl ${s.color}`}>{s.value}</div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => exportCsv(teams, reports, eventCode)}
          disabled={reports.length === 0}
          className="rounded-[10px] border border-white/8 bg-[#090909] px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-white/44 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV
        </button>
      </section>

      {/* Disclaimer */}
      <section className="rounded-[10px] border border-yellow-500/18 bg-yellow-500/5 px-4 py-3 text-xs text-yellow-200/52 leading-relaxed">
        <span className="font-semibold text-yellow-200/70">All scouting data is self-reported by teams.</span>{" "}
        If anything looks incorrect, reach out to{" "}
        <span className="font-medium text-yellow-200/70">meer @ makeminds</span> on Discord.{" "}
        <span className="font-semibold text-yellow-200/70">Please do not edit another team&apos;s report.</span>
      </section>

      {/* Team search */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/24" width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${teams.length} teams…`}
          className="h-10 w-full rounded-[10px] border border-white/10 bg-[#0d0d0d] pl-9 pr-9 text-sm text-white placeholder:text-white/24 outline-none focus:border-white/20"
        />
        {search ? (
          <button type="button" onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-white/28 hover:text-white/60">
            ×
          </button>
        ) : null}
      </div>

      {q && filteredTeams.length === 0 ? (
        <div className="rounded-[10px] border border-white/8 bg-[#090909] px-4 py-3 text-sm text-white/36">
          No teams match &ldquo;{search}&rdquo;
        </div>
      ) : null}

      {/* Teams with data */}
      {withData.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8be800]/55">Reported</span>
            <span className="rounded-full bg-[#8be800]/8 px-2 py-0.5 text-[10px] tabular-nums text-[#8be800]/44">{withData.length}</span>
          </div>
          <div className="space-y-1.5">
            {withData.map((team) => {
              const report = reportForTeam(team.teamNumber)!;
              const isExpanded = expandedTeam === team.teamNumber;
              return (
                <article key={team.teamNumber} className="rounded-[10px] border border-[#1a3a00]/35 bg-[#080f05]">
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
                    onClick={() => setExpandedTeam(isExpanded ? null : team.teamNumber)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-white">{team.teamNumber}</span>
                        {team.name ? <span className="truncate text-sm text-white/40">{team.name}</span> : null}
                      </div>
                      {oprMap[team.teamNumber] ? <OprChips opr={oprMap[team.teamNumber]} /> : null}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/22 hover:text-white/50">
                      {isExpanded ? "Close" : "Edit"}
                    </span>
                  </div>
                  {isExpanded ? (
                    <div className="px-3 pb-3">
                      <ScoutForm teamNumber={team.teamNumber} eventCode={eventCode} season={season}
                        initialForm={formFromReport(report)} onSubmitted={handleSubmitted}
                        onCancel={() => setExpandedTeam(null)} />
                    </div>
                  ) : (
                    <div className="px-4 pb-3">
                      <ScoutDataDisplay report={report} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Teams without data */}
      {withoutData.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/28">No report yet</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-white/24">{withoutData.length}</span>
          </div>
          <div className="space-y-1.5">
            {withoutData.map((team) => (
              <article key={team.teamNumber} className="rounded-[10px] border border-white/8 bg-[#0d0d0d]">
                <div
                  className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
                  onClick={() => setExpandedTeam(expandedTeam === team.teamNumber ? null : team.teamNumber)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">{team.teamNumber}</span>
                      {team.name ? <span className="truncate text-sm text-white/40">{team.name}</span> : null}
                    </div>
                    {oprMap[team.teamNumber] ? <OprChips opr={oprMap[team.teamNumber]} /> : null}
                  </div>
                  <span className={["shrink-0 text-[10px] uppercase tracking-[0.1em]", expandedTeam === team.teamNumber ? "text-white/24" : "text-white/44"].join(" ")}>
                    {expandedTeam === team.teamNumber ? "Cancel" : "+ Add"}
                  </span>
                </div>
                {expandedTeam === team.teamNumber ? (
                  <div className="px-3 pb-3">
                    <ScoutForm teamNumber={team.teamNumber} eventCode={eventCode} season={season}
                      onSubmitted={handleSubmitted} onCancel={() => setExpandedTeam(null)} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}


    </div>
  );
}
