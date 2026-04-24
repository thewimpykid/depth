"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SmartSearchInput from "../smart-search-input";
import type { EventSearchResult } from "@/lib/event-simulation";
import type { FeaturedEvent } from "./page";

function fmtShortDate(iso: string | null) {
  if (!iso) return "";
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateRange(start: string | null, end: string | null) {
  if (!start) return "Date unavailable";
  const s = fmtShortDate(start);
  if (!end || end === start) return s;
  const e = fmtShortDate(end);
  return `${s} – ${e}`;
}

function isLive(event: FeaturedEvent) {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const start = event.start?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const end = (event.end ?? event.start)?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  if (!start || !end) return false;
  return start <= todayKey && todayKey <= end;
}

function typeLabel(typeName: string) {
  const t = typeName.toLowerCase();
  if (t.includes("first championship") && t.includes("division")) return "FIRST Champs Division";
  if (t.includes("first championship")) return "FIRST Championship";
  if (t.includes("regional championship")) return "Regional Championship";
  if (t.includes("championship")) return "Championship";
  if (t === "super qualifier") return "Super Qualifier";
  return typeName;
}

export default function ScoutingControls({
  initialEventQuery,
  season,
  matchedEvents,
  selectedEventCode,
  featuredEvents,
}: {
  initialEventQuery: string;
  season: number;
  matchedEvents: EventSearchResult[];
  selectedEventCode: string;
  featuredEvents: FeaturedEvent[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [eventQuery, setEventQuery] = useState(initialEventQuery);
  const [isSearchPending, startSearchTransition] = useTransition();
  const [isSelectPending, startSelectTransition] = useTransition();
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(selectedEventCode || null);

  const currentUrl = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  function buildUrl(overrides: { eventCode?: string; eventQuery?: string } = {}) {
    const resolvedEventCode = overrides.eventCode ?? selectedCode ?? "";
    const resolvedQuery = overrides.eventQuery ?? eventQuery.trim();
    const base = `/scouting?eventQuery=${encodeURIComponent(resolvedQuery)}`;
    return resolvedEventCode ? `${base}&eventCode=${encodeURIComponent(resolvedEventCode)}` : base;
  }

  function goTo(url: string, kind: "search" | "select", eventCode?: string) {
    if (url === currentUrl) return;
    if (kind === "select") {
      setPendingEventCode(eventCode ?? null);
      startSelectTransition(() => router.push(url));
    } else {
      startSearchTransition(() => router.push(url));
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventQuery.trim()) return;
    goTo(buildUrl(), "search");
  }

  function handleFeaturedPick(fe: FeaturedEvent) {
    setEventQuery(fe.name);
    setSelectedCode(fe.code.toUpperCase());
    const url = buildUrl({ eventCode: fe.code, eventQuery: fe.name });
    goTo(url, "select", fe.code.toUpperCase());
  }

  return (
    <>
      {/* Featured events */}
      {featuredEvents.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-white/36">Featured Events</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {featuredEvents.map((fe) => {
              const live = isLive(fe);
              const selected = selectedEventCode === fe.code.toUpperCase();
              const pending = isSelectPending && pendingEventCode === fe.code.toUpperCase();
              return (
                <button
                  suppressHydrationWarning
                  key={fe.code}
                  type="button"
                  disabled={isSearchPending || isSelectPending}
                  onClick={() => handleFeaturedPick(fe)}
                  className={[
                    "rounded-[10px] border p-3 text-left transition-colors disabled:opacity-60 w-full",
                    selected
                      ? "border-white/20 bg-[#1a1a1a]"
                      : live
                        ? "border-[#1a3a00]/60 bg-[#0a1400] hover:border-[#1a3a00]"
                        : "border-white/8 bg-[#0d0d0d] hover:border-white/16",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {live ? (
                      <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#8be800]" />
                    ) : null}
                    <span className={["text-[9px] uppercase tracking-[0.14em] truncate", live ? "text-[#8be800]/70" : "text-white/32"].join(" ")}>
                      {live ? "Live · " : ""}{typeLabel(fe.typeName)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white leading-tight line-clamp-2">
                    {pending ? "Loading…" : fe.name}
                  </div>
                  <div className="mt-1 text-[10px] text-white/40">
                    {fe.code} · {fmtDateRange(fe.start, fe.end)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex gap-3 items-end">
          <label className="block flex-1">
            <div className="mb-2 text-sm text-white/60">Event Search</div>
            <SmartSearchInput
              value={eventQuery}
              onChange={(value) => { setEventQuery(value); setSelectedCode(null); }}
              onPick={(suggestion) => { setEventQuery(suggestion.title); setSelectedCode(suggestion.eventCode ?? null); }}
              scope="events"
              season={season}
              placeholder="Event name, code, city…"
              containerClassName="h-11 w-full rounded-[10px] border border-white/10 bg-[#111111] text-sm focus-within:border-white/25"
            />
          </label>
          <button
            suppressHydrationWarning
            type="submit"
            disabled={isSearchPending || isSelectPending}
            className="h-11 rounded-[10px] border border-white/10 bg-white px-5 text-sm font-medium uppercase tracking-[0.16em] text-black disabled:opacity-60"
          >
            {isSearchPending ? "…" : "Search"}
          </button>
        </div>
      </form>

      {/* Matched events */}
      {matchedEvents.length > 0 ? (
        <div className="mt-5 rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-base font-medium text-white">Matching Events</div>
            <div className="text-xs text-white/40">pick one to scout</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {matchedEvents.map((event) => {
              const isSelected = selectedEventCode === event.code.toUpperCase();
              const isPending = isSelectPending && pendingEventCode === event.code.toUpperCase();
              return (
                <article
                  key={event.code}
                  className={["rounded-[10px] border p-3", isSelected ? "border-white/18 bg-[#111111]" : "border-white/8 bg-[#0d0d0d]"].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white leading-snug">{event.name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/36">{event.code}</div>
                      <div className="mt-0.5 text-xs text-white/48">{fmtDateRange(event.start, event.end)}</div>
                    </div>
                    <button
                      suppressHydrationWarning
                      type="button"
                      disabled={isSearchPending || isSelectPending}
                      onClick={() => goTo(buildUrl({ eventCode: event.code }), "select", event.code.toUpperCase())}
                      className={["shrink-0 rounded-[8px] border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] disabled:opacity-60", isSelected ? "border-white/18 bg-white text-black" : "border-white/10 bg-[#111111] text-white/60 hover:text-white"].join(" ")}
                    >
                      {isPending ? "…" : isSelected ? "✓" : "Select"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
