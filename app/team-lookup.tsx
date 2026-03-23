"use client";

import { FormEvent, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SmartSearchInput from "./smart-search-input";
import type { SearchScope, SearchSuggestion } from "@/lib/smart-search";

function normalizeTeamNumber(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 5);
}

export default function TeamLookupForm({
  initialValue = "",
  buttonLabel = "Search",
  compact = false,
  season,
  scope = "teams",
}: {
  initialValue?: string;
  buttonLabel?: string;
  compact?: boolean;
  season?: number;
  scope?: SearchScope;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialValue);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SearchSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentUrl = useMemo(() => {
    const queryString = searchParams?.toString();
    return `${pathname}${queryString ? `?${queryString}` : ""}`;
  }, [pathname, searchParams]);

  function navigateTo(suggestion: SearchSuggestion | null, rawQuery: string) {
    if (suggestion?.type === "team" && suggestion.teamNumber) {
      return `/teams?q=${suggestion.teamNumber}${season ? `&season=${season}` : ""}`;
    }

    if (suggestion?.type === "event" && suggestion.eventCode) {
      const eventSeason = suggestion.season ?? season;
      return `/matches?eventCode=${encodeURIComponent(suggestion.eventCode)}${eventSeason ? `&season=${eventSeason}` : ""}&eventQuery=${encodeURIComponent(suggestion.title)}`;
    }

    const normalized = normalizeTeamNumber(rawQuery);
    if (normalized) {
      return `/teams?q=${normalized}${season ? `&season=${season}` : ""}`;
    }

    return null;
  }

  function goTo(url: string) {
    setError(null);
    if (url === currentUrl) return;
    startTransition(() => router.push(url));
  }

  function handlePick(suggestion: SearchSuggestion) {
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.title);
    if (error) setError(null);
    const url = navigateTo(suggestion, suggestion.title);
    if (url) goTo(url);
  }

  // Auto-navigate when the typed query is an exact team number match
  const prevAutoQuery = useRef("");
  function handleSuggestionsChange(next: SearchSuggestion[]) {
    setSuggestions(next);
    if (
      scope === "teams" &&
      /^\d{4,5}$/.test(query.trim()) &&
      query.trim() !== prevAutoQuery.current &&
      next.length > 0 &&
      next[0].type === "team" &&
      next[0].teamNumber === Number(query.trim())
    ) {
      prevAutoQuery.current = query.trim();
      const url = navigateTo(next[0], query.trim());
      if (url) goTo(url);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // If no suggestion selected but there's exactly one result, auto-pick it
    const activeSuggestion = selectedSuggestion ?? (suggestions.length === 1 ? suggestions[0] : null);

    const nextUrl = navigateTo(activeSuggestion, query);
    if (!nextUrl) {
      setError(scope === "mixed" ? "Choose a team or event from the suggestions." : "Enter a team number or pick a team from the suggestions.");
      return;
    }

    goTo(nextUrl);
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "w-full" : "max-w-2xl"}>
      <div
        className={
          compact
            ? "grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-3"
            : "flex flex-col gap-3 sm:flex-row"
        }
      >
        <label className="sr-only" htmlFor="smart-search">
          Search
        </label>
        <SmartSearchInput
          id="smart-search"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setSelectedSuggestion(null);
            if (error) setError(null);
          }}
          onPick={handlePick}
          onSuggestionsChange={handleSuggestionsChange}
          scope={scope}
          season={season ?? new Date().getFullYear()}
          placeholder={
            scope === "mixed"
              ? compact
                ? "Team or event"
                : "Search teams or events"
              : compact
                ? "Team number or name"
                : "Search FTC team number or name"
          }
          containerClassName={[
            "rounded-[10px] border border-white/10 bg-[#111111] tracking-[0.02em] focus-within:border-white/25",
            compact ? "h-12 text-[15px] sm:text-base" : "h-14 text-lg",
          ].join(" ")}
        />
        <button
          suppressHydrationWarning
          type="submit"
          disabled={isPending}
          className={[
            "rounded-[10px] border border-white/10 bg-white text-sm font-medium uppercase tracking-[0.18em] text-black disabled:cursor-not-allowed disabled:opacity-60",
            compact ? "h-12 min-w-[7.5rem] px-4 sm:px-5" : "h-14 px-6",
          ].join(" ")}
        >
          {isPending ? "Loading" : buttonLabel}
        </button>
      </div>

      {!compact ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/42">
          <span>{scope === "mixed" ? "Search teams or events." : "Search by team number or team name."}</span>
          <span className="rounded-[8px] border border-white/10 px-3 py-1">events</span>
          <span className="rounded-[8px] border border-white/10 px-3 py-1">matches</span>
          <span className="rounded-[8px] border border-white/10 px-3 py-1">opr</span>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#ff8f8f]">{error}</p> : null}
    </form>
  );
}
