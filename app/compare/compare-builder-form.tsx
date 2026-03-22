"use client";

import { FormEvent, startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SmartSearchInput from "../smart-search-input";

const MAX_TEAM_SLOTS = 6;
const MIN_VISIBLE_SLOTS = 4;

function normalizeTeamNumber(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 5);
}

function buildInitialSlots(initialTeams: number[]) {
  const seeded = initialTeams.slice(0, MAX_TEAM_SLOTS).map((team) => String(team));
  const targetLength = Math.max(MIN_VISIBLE_SLOTS, seeded.length || MIN_VISIBLE_SLOTS);
  const slots = [...seeded];

  while (slots.length < targetLength && slots.length < MAX_TEAM_SLOTS) {
    slots.push("");
  }

  return slots;
}

export default function CompareBuilderForm({
  initialTeams,
  initialSeason,
  seasonOptions,
}: {
  initialTeams: number[];
  initialSeason: number;
  seasonOptions: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [teams, setTeams] = useState<string[]>(() => buildInitialSlots(initialTeams));
  const [season, setSeason] = useState(String(initialSeason));
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const currentUrl = useMemo(() => {
    const query = searchParams?.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  const validTeamCount = useMemo(() => {
    const values = teams
      .map((team) => normalizeTeamNumber(team))
      .filter(Boolean);
    return new Set(values).size;
  }, [teams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const values = teams
      .map((team) => normalizeTeamNumber(team))
      .filter(Boolean);
    const uniqueTeams = [...new Set(values)];

    if (uniqueTeams.length < 2) {
      setError("Enter at least two valid team numbers.");
      return;
    }

    setError(null);
    setIsPending(true);

    const nextUrl = `/compare?season=${encodeURIComponent(season)}&teams=${encodeURIComponent(uniqueTeams.join(","))}`;
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
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {teams.map((team, index) => (
          <label key={`compare-slot-${index}`} className="block">
            <div className="mb-2 text-sm text-white/64">Team {index + 1}</div>
            <div className="flex items-center gap-2">
              <SmartSearchInput
                value={team}
                onChange={(event) => {
                  const next = [...teams];
                  next[index] = event;
                  setTeams(next);
                  if (error) setError(null);
                }}
                onPick={(suggestion) => {
                  const next = [...teams];
                  next[index] = suggestion.teamNumber ? String(suggestion.teamNumber) : team;
                  setTeams(next);
                  if (error) setError(null);
                }}
                scope="teams"
                season={Number(season)}
                inputMode="numeric"
                placeholder="Team number or name"
                containerClassName="h-12 min-w-0 flex-1 rounded-[10px] border border-white/10 bg-[#111111] text-base focus-within:border-white/25"
              />
              {teams.length > MIN_VISIBLE_SLOTS ? (
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => {
                    setTeams(teams.filter((_, slotIndex) => slotIndex !== index));
                    if (error) setError(null);
                  }}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-white/10 bg-[#111111] text-sm uppercase tracking-[0.12em] text-white/62"
                  aria-label={`Remove team slot ${index + 1}`}
                >
                  x
                </button>
              ) : null}
            </div>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,14rem)_auto_auto_1fr] md:items-end">
        <label className="block">
          <div className="mb-2 text-sm text-white/64">Season</div>
          <select
            suppressHydrationWarning
            value={season}
            onChange={(event) => setSeason(event.target.value)}
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
          type="button"
          onClick={() => {
            if (teams.length >= MAX_TEAM_SLOTS) return;
            setTeams([...teams, ""]);
          }}
          className="h-12 rounded-[10px] border border-white/10 bg-[#111111] px-4 text-sm uppercase tracking-[0.18em] text-white/72"
        >
          Add Team
        </button>

        <button
          suppressHydrationWarning
          type="submit"
          disabled={isPending}
          className="h-12 rounded-[10px] border border-white/10 bg-white px-5 text-sm font-medium uppercase tracking-[0.18em] text-black disabled:opacity-60"
        >
          {isPending ? "Comparing" : "Compare"}
        </button>

        <div className="text-sm text-white/42 md:text-right">
          {validTeamCount} valid team{validTeamCount === 1 ? "" : "s"} selected
        </div>
      </div>

      {error ? <div className="text-sm text-[#ff9c9c]">{error}</div> : null}
    </form>
  );
}
