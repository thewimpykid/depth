"use client";

import { FormEvent, startTransition, useMemo, useState } from "react";
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
  seasonOptions,
  matchedEvents,
  selectedEventCode,
}: {
  initialEventQuery: string;
  initialSeason: number;
  initialRuns: number;
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
  const [pendingMode, setPendingMode] = useState<"search" | "select" | null>(null);
  const [pendingEventCode, setPendingEventCode] = useState<string | null>(selectedEventCode || null);
  const [selectedCode, setSelectedCode] = useState<string | null>(selectedEventCode || null);

  const currentUrl = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  function goTo(url: string, mode: "search" | "select", eventCode?: string) {
    if (url === currentUrl) {
      setPendingMode(null);
      setPendingEventCode(null);
      return;
    }

    setPendingMode(mode);
    setPendingEventCode(eventCode ?? null);
    startTransition(() => {
      router.push(url);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = eventQuery.trim();
    if (!query) {
      return;
    }

    goTo(
      `/simulate?season=${encodeURIComponent(season)}&eventQuery=${encodeURIComponent(query)}&runs=${encodeURIComponent(runs || "300")}${selectedCode ? `&eventCode=${encodeURIComponent(selectedCode)}` : ""}`,
      "search",
      selectedCode ?? undefined,
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            disabled={pendingMode !== null}
            className="h-12 rounded-[10px] border border-white/10 bg-white px-5 text-sm font-medium uppercase tracking-[0.18em] text-black disabled:opacity-60"
          >
            {pendingMode === "search" ? "Searching" : "Search"}
          </button>
        </div>

        <div className="text-sm text-white/42">
          Search first, then pick a real event from the results below.
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
                pendingMode === "select" && pendingEventCode === event.code.toUpperCase();

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
                      disabled={pendingMode !== null}
                      onClick={() =>
                        goTo(
                          `/simulate?season=${encodeURIComponent(season)}&eventQuery=${encodeURIComponent(eventQuery.trim())}&eventCode=${encodeURIComponent(event.code)}&runs=${encodeURIComponent(runs || "300")}`,
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
