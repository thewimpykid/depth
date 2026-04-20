import EventSearchForm from "../event-search-form";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import { getSeasonEventByCode, searchSeasonEvents } from "@/lib/event-simulation";
import { ftcApiClient } from "@/lib/ftc-api-client";

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value !== null) return value;
  }
  return null;
}

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

function getAllianceTeams(rawTeams: unknown[]) {
  const teams = rawTeams
    .map((rawTeam) => {
      const obj = asObject(rawTeam);
      if (!obj) return null;
      const teamNumber = pickNumber(obj, ["teamNumber", "team", "number"]);
      if (teamNumber === null) return null;
      return {
        teamNumber,
        name: pickString(obj, ["teamName", "nameShort", "nameFull"]),
        station: (pickString(obj, ["station", "alliance"]) ?? "").toLowerCase(),
      };
    })
    .filter(
      (
        team,
      ): team is {
        teamNumber: number;
        name: string | null;
        station: string;
      } => team !== null,
    );

  return {
    redAlliance: teams.filter((team) => team.station.startsWith("red")),
    blueAlliance: teams.filter((team) => team.station.startsWith("blue")),
  };
}

function parseMatches(rawRows: unknown[]) {
  return rawRows
    .map((rawRow) => {
      const obj = asObject(rawRow);
      if (!obj) return null;
      const matchNumber = pickNumber(obj, ["matchNumber", "number"]);
      if (matchNumber === null) return null;
      const { redAlliance, blueAlliance } = getAllianceTeams(asArray(obj.teams));

      return {
        key: `${pickString(obj, ["description"]) ?? "qual"}-${matchNumber}`,
        description: pickString(obj, ["description"]) ?? `Qual ${matchNumber}`,
        start:
          pickString(obj, ["actualStartTime", "startTime", "scheduledStartTime", "postResultTime"]) ??
          null,
        redScore: pickNumber(obj, ["scoreRedFinal", "redScoreFinal", "scoreRed"]),
        blueScore: pickNumber(obj, ["scoreBlueFinal", "blueScoreFinal", "scoreBlue"]),
        redAlliance,
        blueAlliance,
      };
    })
    .filter(
      (
        match,
      ): match is {
        key: string;
        description: string;
        start: string | null;
        redScore: number | null;
        blueScore: number | null;
        redAlliance: Array<{ teamNumber: number; name: string | null; station: string }>;
        blueAlliance: Array<{ teamNumber: number; name: string | null; station: string }>;
      } => match !== null,
    )
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.description.localeCompare(b.description);
    });
}

export default async function MatchesPage(props: PageProps<"/matches">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();
  const season =
    typeof searchParams.season === "string" && isSeason(searchParams.season)
      ? Number(searchParams.season)
      : currentSeason;
  const eventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery.trim() : "";
  const eventCode = typeof searchParams.eventCode === "string" ? searchParams.eventCode.trim().toUpperCase() : "";

  const [results, event, hybridSchedule] = await Promise.all([
    eventQuery ? searchSeasonEvents(season, eventQuery, 12) : Promise.resolve([]),
    eventCode ? getSeasonEventByCode(season, eventCode) : Promise.resolve(null),
    eventCode
      ? ftcApiClient.getHybridSchedule(eventCode, "qual", { season }).catch(() => ({ schedule: [] }))
      : Promise.resolve({ schedule: [] }),
  ]);

  const matches = parseMatches(asArray(hybridSchedule.schedule));

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Matches</h1>
          <EventSearchForm
            initialQuery={eventQuery}
            initialCode={eventCode}
            initialSeason={season}
            seasonOptions={seasonOptions}
            submitLabel="Open"
            basePath="/matches"
          />
        </section>

        {!eventQuery ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
            Search for an event to view published matches.
          </section>
        ) : results.length === 0 && !event ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <>
            {results.length > 0 && !event ? (
              <section className="mt-4 grid gap-3 xl:grid-cols-2">
                {results.map((result) => (
                  <article key={result.code} className="rounded-[10px] border border-white/10 bg-[#090909] p-4">
                    <div className="text-base font-medium text-white">{result.name}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/42">
                      <span className="uppercase tracking-[0.1em]">{result.code}</span>
                      <span>{fmtDateRange(result.start, result.end)}</span>
                      {result.location ? <span className="italic">{result.location}</span> : null}
                    </div>
                    <a
                      href={`/matches?season=${season}&eventCode=${encodeURIComponent(result.code)}&eventQuery=${encodeURIComponent(result.name)}`}
                      className="mt-3 inline-flex rounded-[8px] border border-white/10 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-black"
                    >
                      Open event
                    </a>
                  </article>
                ))}
              </section>
            ) : null}

            {event ? (
              <>
                <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-medium text-white">{event.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/42">
                        <span>{fmtDateRange(event.start, event.end)}</span>
                        {event.location ? <span className="italic">{event.location}</span> : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-[6px] border border-white/10 bg-[#111111] px-2 py-1 text-xs text-white/50">{event.code}</span>
                  </div>
                </section>

                {matches.length === 0 ? (
                  <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
                    No published qualification matches yet for this event.
                  </section>
                ) : (
                  <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] p-3">
                    <div className="space-y-1">
                      {matches.map((match) => {
                        const played = match.redScore !== null || match.blueScore !== null;
                        return (
                          <div key={match.key} className="flex items-center gap-2 rounded-[8px] border border-white/8 bg-[#0d0d0d] px-3 py-2 text-xs">
                            <span className="w-16 shrink-0 font-medium tabular-nums text-white/60">{match.description}</span>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/50" />
                            <span className="min-w-0 flex-1 truncate text-white/70">
                              {match.redAlliance.map((t) => t.teamNumber).join(" · ")}
                            </span>
                            <span className="shrink-0 text-white/18">vs</span>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/50" />
                            <span className="min-w-0 flex-1 truncate text-white/70">
                              {match.blueAlliance.map((t) => t.teamNumber).join(" · ")}
                            </span>
                            {played ? (
                              <span className="shrink-0 tabular-nums">
                                <span className="text-red-300/60">{match.redScore ?? "?"}</span>
                                <span className="text-white/20">–</span>
                                <span className="text-sky-300/60">{match.blueScore ?? "?"}</span>
                              </span>
                            ) : (
                              <span className="shrink-0 text-white/22">
                                {match.start ? new Date(match.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBD"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
