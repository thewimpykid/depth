"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SmartSearchInput from "../smart-search-input";
import type { EventSearchResult } from "@/lib/event-simulation";

function fmtDateRange(start: string | null, end: string | null) {
  if (!start) return "Date unavailable";

  const startDate = new Date(start);
  const startText = startDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!end || end === start) return startText;

  const endDate = new Date(end);
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

export default function SimulateControls({
  initialEventQuery,
  initialSeason,
  initialRuns,
  initialMode = "api",
  seasonOptions,
  matchedEvents,
  selectedEventCode,
}: {
  initialEventQuery: string;
  initialSeason: number;
  initialRuns: number;
  initialMode?: "api" | "random";
  seasonOptions: number[];
  matchedEvents: EventSearchResult[];
  selectedEventCode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [eventQuery, setEventQuery] = useState(initialEventQuery);
  const [season, setSeason] = useState(String(initialSeason));
  const [runs, setRuns] = useState(String(initialRuns));
  const [mode, setMode] = useState<"api" | "random">(initialMode);
  const [isSearchPending, startSearchTransition] = useTransition();
  const [isSelectPending, startSelectTransition] = useTransition();
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(selectedEventCode || null);

  const currentUrl = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  function buildUrl(overrides: { eventCode?: string; mode?: "api" | "random" } = {}) {
    const resolvedMode = overrides.mode ?? mode;
    const resolvedEventCode = overrides.eventCode ?? selectedCode ?? "";
    const base = `/simulate?season=${encodeURIComponent(season)}&eventQuery=${encodeURIComponent(eventQuery.trim())}&runs=${encodeURIComponent(runs || "300")}&mode=${resolvedMode}`;
    return resolvedEventCode ? `${base}&eventCode=${encodeURIComponent(resolvedEventCode)}` : base;
  }

  function goTo(url: string, kind: "search" | "select", eventCode?: string) {
    if (url === currentUrl) return;

    if (kind === "select") {
      setPendingEventCode(eventCode ?? null);
      startSelectTransition(() => {
        router.push(url);
      });
    } else {
      startSearchTransition(() => {
        router.push(url);
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = eventQuery.trim();
    if (!query) return;
    goTo(buildUrl(), "search", selectedCode ?? undefined);
  }

  function handleModeChange(nextMode: "api" | "random") {
    setMode(nextMode);
    if (!selectedCode) return;
    const url = buildUrl({ mode: nextMode });
    if (url !== currentUrl) {
      startSearchTransition(() => {
        router.push(url);
      });
    }
  }

  return (
    <>
      {/* Mode toggle */}
      <div className="mt-5 flex items-center gap-1 rounded-[10px] border border-white/10 bg-[#0b0b0b] p-1 w-fit">
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => handleModeChange("api")}
          className={[
            "rounded-[8px] px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors",
            mode === "api"
              ? "bg-white text-black font-semibold"
              : "text-white/52 hover:text-white/80",
          ].join(" ")}
        >
          API Schedule
        </button>
        <button
          suppressHydrationWarning
          type="button"
          onClick={() => handleModeChange("random")}
          className={[
            "rounded-[8px] px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors",
            mode === "random"
              ? "bg-white text-black font-semibold"
              : "text-white/52 hover:text-white/80",
          ].join(" ")}
        >
          Random Schedule
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.8fr)_12rem_12rem_auto] 2xl:items-end">
          <label className="block">
            <div className="mb-2 text-sm text-white/64">Event Search</div>
            <SmartSearchInput
              value={eventQuery}
              onChange={(value) => {
                setEventQuery(value);
                setSelectedCode(null);
              }}
              onPick={(suggestion) => {
                setEventQuery(suggestion.title);
                setSelectedCode(suggestion.eventCode ?? null);
              }}
              scope="events"
              season={Number(season)}
              placeholder="Event code, name, city, or venue"
              containerClassName="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] text-base focus-within:border-white/25"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-white/64">Season</div>
            <select
              suppressHydrationWarning
              value={season}
              onChange={(event) => {
                setSeason(event.target.value);
                setSelectedCode(null);
              }}
              className="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] px-4 text-base text-white outline-none"
            >
              {seasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-white/64">Simulation Runs</div>
            <input
              suppressHydrationWarning
              type="number"
              min={50}
              max={2000}
              step={50}
              value={runs}
              onChange={(event) => setRuns(event.target.value.replace(/[^\d]/g, ""))}
              className="h-12 w-full rounded-[10px] border border-white/10 bg-[#111111] px-4 text-base text-white outline-none"
            />
          </label>

          <button
            suppressHydrationWarning
            type="submit"
            disabled={isSearchPending || isSelectPending}
            className="h-12 rounded-[10px] border border-white/10 bg-white px-5 text-sm font-medium uppercase tracking-[0.18em] text-black disabled:opacity-60"
          >
            {isSearchPending ? "Searching" : "Search"}
          </button>
        </div>

        <div className="text-sm text-white/42">
          {mode === "api"
            ? "Simulates the published qualification schedule using FTC match data."
            : "Generates a random schedule each run — shows expected outcomes independent of draw."}
        </div>
      </form>

      {matchedEvents.length > 0 ? (
        <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-2xl font-medium tracking-[-0.04em] text-white">
              Matching Events
            </div>
            <div className="text-sm text-white/46">
              Pick one to simulate
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {matchedEvents.map((event) => {
              const isSelected = selectedEventCode === event.code.toUpperCase();
              const isPendingSelection =
                isSelectPending && pendingEventCode === event.code.toUpperCase();

              return (
                <article
                  key={event.code}
                  className={[
                    "rounded-[12px] border p-5",
                    isSelected ? "border-white/18 bg-[#111111]" : "border-white/10 bg-[#101010]",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-2xl font-medium tracking-[-0.04em] text-white">
                        {event.name}
                      </div>
                      <div className="mt-2 text-sm uppercase tracking-[0.14em] text-white/38">
                        {event.code}
                      </div>
                      <div className="mt-3 text-base text-white/74">
                        {fmtDateRange(event.start, event.end)}
                      </div>
                      <div className="mt-1 text-sm italic text-white/48">
                        {event.location ?? "Location unavailable"}
                      </div>
                    </div>

                    <button
                      suppressHydrationWarning
                      type="button"
                      disabled={isSearchPending || isSelectPending}
                      onClick={() =>
                        goTo(
                          buildUrl({ eventCode: event.code }),
                          "select",
                          event.code.toUpperCase(),
                        )
                      }
                      className={[
                        "h-11 rounded-[10px] border px-4 text-[11px] uppercase tracking-[0.18em] disabled:opacity-60",
                        isSelected
                          ? "border-white/18 bg-white text-black"
                          : "border-white/10 bg-[#111111] text-white/78",
                      ].join(" ")}
                    >
                      {isPendingSelection
                        ? "Simulating"
                        : isSelected
                          ? "Selected"
                          : "Select Event"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
