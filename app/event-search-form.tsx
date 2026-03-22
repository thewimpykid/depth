"use client";

import { FormEvent, startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SmartSearchInput from "./smart-search-input";

export default function EventSearchForm({
  initialQuery,
  initialCode,
  initialSeason,
  seasonOptions,
  submitLabel = "Open",
  basePath,
}: {
  initialQuery: string;
  initialCode?: string;
  initialSeason: number;
  seasonOptions: number[];
  submitLabel?: string;
  basePath: "/events" | "/matches";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [eventCode, setEventCode] = useState(initialCode ?? "");
  const [season, setSeason] = useState(String(initialSeason));
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const currentUrl = useMemo(() => {
    const queryString = searchParams?.toString();
    return `${pathname}${queryString ? `?${queryString}` : ""}`;
  }, [pathname, searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter an event name or event code.");
      return;
    }

    const nextUrl = `${basePath}?season=${encodeURIComponent(season)}&eventQuery=${encodeURIComponent(trimmed)}${eventCode ? `&eventCode=${encodeURIComponent(eventCode)}` : ""}`;
    setError(null);
    setIsPending(true);

    if (nextUrl === currentUrl) {
      setIsPending(false);
      return;
    }

    startTransition(() => {
      router.push(nextUrl);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_12rem_auto] xl:items-end">
        <label className="block">
          <div className="mb-2 text-sm text-white/64">Event Search</div>
          <SmartSearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setEventCode("");
              if (error) setError(null);
            }}
            onPick={(suggestion) => {
              setQuery(suggestion.title);
              setEventCode(suggestion.eventCode ?? "");
              if (error) setError(null);
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
              setEventCode("");
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

        <button
          suppressHydrationWarning
          type="submit"
          disabled={isPending}
          className="h-12 rounded-[10px] border border-white/10 bg-white px-5 text-sm font-medium uppercase tracking-[0.18em] text-black disabled:opacity-60"
        >
          {isPending ? "Loading" : submitLabel}
        </button>
      </div>

      {error ? <div className="text-sm text-[#ff9c9c]">{error}</div> : null}
    </form>
  );
}
