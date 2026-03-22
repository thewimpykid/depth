import EventSearchForm from "../event-search-form";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import { getSeasonEventByCode, searchSeasonEvents } from "@/lib/event-simulation";
import { ftcApiClient } from "@/lib/ftc-api-client";

export const dynamic = "force-dynamic";

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
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Matches</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            matches
          </h1>
          <p className="mt-3 max-w-3xl text-base text-white/58 sm:text-lg">
            Search an event, pick it, and browse the published qualification schedule and scores.
          </p>

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
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
            Search for an event to view published matches.
          </section>
        ) : results.length === 0 && !event ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <>
            {results.length > 0 && !event ? (
              <section className="mt-6 grid gap-4 xl:grid-cols-2">
                {results.map((result) => (
                  <article key={result.code} className="rounded-[14px] border border-white/10 bg-[#090909] p-5">
                    <div className="text-2xl font-medium tracking-[-0.04em] text-white">{result.name}</div>
                    <div className="mt-2 text-sm uppercase tracking-[0.14em] text-white/38">{result.code}</div>
                    <div className="mt-3 text-base text-white/74">{fmtDateRange(result.start, result.end)}</div>
                    <div className="mt-1 text-sm italic text-white/48">{result.location ?? "Location unavailable"}</div>
                    <a
                      href={`/matches?season=${season}&eventCode=${encodeURIComponent(result.code)}&eventQuery=${encodeURIComponent(result.name)}`}
                      className="mt-4 inline-flex rounded-[10px] border border-white/10 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-black"
                    >
                      Open event
                    </a>
                  </article>
                ))}
              </section>
            ) : null}

            {event ? (
              <>
                <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/34">Selected Event</div>
                      <div className="mt-3 text-3xl font-medium tracking-[-0.06em] text-white sm:text-4xl">
                        {event.name}
                      </div>
                      <div className="mt-3 text-base text-white/74">{fmtDateRange(event.start, event.end)}</div>
                      <div className="mt-1 text-sm italic text-white/48">{event.location ?? "Location unavailable"}</div>
                    </div>
                    <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-3 text-sm text-white/72">
                      Event code {event.code}
                    </div>
                  </div>
                </section>

                {matches.length === 0 ? (
                  <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
                    No published qualification matches yet for this event.
                  </section>
                ) : (
                  <section className="mt-6 grid gap-4 2xl:grid-cols-2">
                    {matches.map((match) => (
                      <article key={match.key} className="rounded-[14px] border border-white/10 bg-[#090909] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.14em] text-white/36">Qualification Match</div>
                            <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">{match.description}</div>
                          </div>
                          <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-sm text-white/76">
                            {match.start ? new Date(match.start).toLocaleString() : "TBD"}
                          </div>
                        </div>

                        <div className="mt-4 rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
                          <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Score</div>
                          <div className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white">
                            {match.redScore ?? "N/A"} - {match.blueScore ?? "N/A"}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-[10px] border border-[#552222] bg-[#170d0d] px-4 py-4">
                            <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#f0b9b9]">Red Alliance</div>
                            <div className="space-y-2">
                              {match.redAlliance.map((team) => (
                                <div key={`red-${match.key}-${team.teamNumber}`} className="rounded-[8px] border border-white/10 bg-black/15 px-3 py-3">
                                  <div className="text-base font-medium text-white">{team.teamNumber}</div>
                                  <div className="text-sm text-white/72">{team.name ?? "Unknown team"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-[10px] border border-[#1e3a5f] bg-[#0d1520] px-4 py-4">
                            <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[#bdd5ff]">Blue Alliance</div>
                            <div className="space-y-2">
                              {match.blueAlliance.map((team) => (
                                <div key={`blue-${match.key}-${team.teamNumber}`} className="rounded-[8px] border border-white/10 bg-black/15 px-3 py-3">
                                  <div className="text-base font-medium text-white">{team.teamNumber}</div>
                                  <div className="text-sm text-white/72">{team.name ?? "Unknown team"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
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
