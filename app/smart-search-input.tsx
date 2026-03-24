"use client";

import { useEffect, useRef, useState } from "react";

import type { SearchScope, SearchSuggestion } from "@/lib/smart-search";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <circle cx="7.5" cy="7.5" r="5" />
      <line x1="11.5" y1="11.5" x2="16" y2="16" />
    </svg>
  );
}

function TypeBadge({ type }: { type: "team" | "event" }) {
  return (
    <span
      className={[
        "shrink-0 self-start rounded-[5px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]",
        type === "team"
          ? "bg-sky-950/70 text-sky-400/70"
          : "bg-violet-950/70 text-violet-400/70",
      ].join(" ")}
    >
      {type}
    </span>
  );
}

export default function SmartSearchInput({
  value,
  onChange,
  onPick,
  onSuggestionsChange,
  scope,
  season,
  placeholder,
  inputMode,
  containerClassName,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (suggestion: SearchSuggestion) => void;
  onSuggestionsChange?: (suggestions: SearchSuggestion[]) => void;
  scope: SearchScope;
  season: number;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  containerClassName: string;
  id?: string;
}) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedValue = useDebouncedValue(value.trim(), 140);

  useEffect(() => {
    if (!debouncedValue) {
      setSearched(false);
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;

    fetch(
      `/api/search?q=${encodeURIComponent(debouncedValue)}&scope=${encodeURIComponent(scope)}&season=${encodeURIComponent(String(season))}&limit=8`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Search failed");
        return (await response.json()) as { suggestions?: SearchSuggestion[] };
      })
      .then((payload) => {
        if (requestId.current !== currentRequest) return;
        const next = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        setSuggestions(next);
        onSuggestionsChange?.(next);
        setOpen(true);
        setActiveIndex(next.length > 0 ? 0 : -1);
        setSearched(true);
      })
      .catch(() => {
        if (requestId.current !== currentRequest) return;
        setSuggestions([]);
        setOpen(true);
        setSearched(true);
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue, scope, season]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function applySuggestion(suggestion: SearchSuggestion) {
    onPick(suggestion);
    setOpen(false);
  }

  const showDropdown = open && value.trim().length > 0 && (suggestions.length > 0 || (searched && !loading));

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      {/* Visual shell */}
      <div
        className={[
          "relative flex items-center transition-colors",
          containerClassName,
        ].join(" ")}
      >
        {/* Search icon */}
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
          <SearchIcon />
        </span>

        <input
          suppressHydrationWarning
          ref={inputRef}
          id={id}
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          onFocus={() => {
            if (suggestions.length > 0 || (searched && value.trim())) setOpen(true);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            if (!nextValue.trim()) {
              setSuggestions([]);
              setOpen(false);
              setLoading(false);
              setActiveIndex(-1);
              setSearched(false);
            } else {
              setLoading(true);
              setOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) { setOpen(true); return; }
              setActiveIndex((c) => (c + 1) % Math.max(suggestions.length, 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((c) => (c <= 0 ? suggestions.length - 1 : c - 1));
            } else if (
              (event.key === "Tab" || event.key === "Enter") &&
              open &&
              activeIndex >= 0 &&
              activeIndex < suggestions.length
            ) {
              event.preventDefault();
              applySuggestion(suggestions[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="h-full w-full bg-transparent pl-10 pr-9 text-white outline-none placeholder:text-white/28"
        />

        {/* Right indicator */}
        {loading ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-white/55" />
          </span>
        ) : value ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/8 hover:text-white/65"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setSuggestions([]);
              setOpen(false);
              setSearched(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-2.5 w-2.5">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[12px] border border-white/10 bg-[#0c0c0c] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
          {suggestions.length > 0 ? (
            <div className="grid gap-0.5 max-h-[320px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={[
                    "flex w-full items-center gap-3 rounded-[9px] border px-3 py-2.5 text-left transition-colors",
                    index === activeIndex
                      ? "border-white/10 bg-[#181818]"
                      : "border-transparent hover:bg-[#141414]",
                  ].join(" ")}
                >
                  {suggestion.type === "team" && suggestion.teamNumber ? (
                    <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-white/70">
                      {suggestion.teamNumber}
                    </span>
                  ) : (
                    <TypeBadge type={suggestion.type} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm leading-snug text-white/90">
                      {suggestion.title}
                    </div>
                    {suggestion.subtitle ? (
                      <div className="mt-0.5 truncate text-xs leading-snug text-white/38">
                        {suggestion.subtitle}
                      </div>
                    ) : null}
                  </div>
                  {suggestion.type === "event" && suggestion.eventCode ? (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-white/35">
                      {suggestion.eventCode}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-white/38">
              No results for &ldquo;{value.trim()}&rdquo;
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
