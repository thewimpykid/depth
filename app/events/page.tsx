import Link from "next/link";

import EventSearchForm from "../event-search-form";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import { searchSeasonEvents } from "@/lib/event-simulation";

export const dynamic = "force-dynamic";

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
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

export default async function EventsPage(props: PageProps<"/events">) {
  const searchParams = await props.searchParams;
  const { currentSeason, seasonOptions } = await getCurrentSeasonWithOptions();
  const season =
    typeof searchParams.season === "string" && isSeason(searchParams.season)
      ? Number(searchParams.season)
      : currentSeason;
  const eventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery.trim() : "";
  const results = eventQuery ? await searchSeasonEvents(season, eventQuery, 24) : [];

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Events</h1>
          <EventSearchForm
            initialQuery={eventQuery}
            initialSeason={season}
            seasonOptions={seasonOptions}
            submitLabel="Search"
            basePath="/events"
          />
        </section>

        {!eventQuery ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
            Start typing an event name or event code to browse events.
          </section>
        ) : results.length === 0 ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <section className="mt-4 grid gap-3 xl:grid-cols-2">
            {results.map((event) => (
              <article key={event.code} className="rounded-[10px] border border-white/10 bg-[#090909] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}`}
                      className="text-base font-medium text-white hover:text-white/80"
                    >
                      {event.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/42">
                      <span className="uppercase tracking-[0.1em]">{event.code}</span>
                      <span>{fmtDateRange(event.start, event.end)}</span>
                      {event.location ? <span className="italic">{event.location}</span> : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[6px] border border-white/10 bg-[#111111] px-2 py-1 text-[10px] text-white/50">{season}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}`}
                    className="rounded-[8px] border border-white/10 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-black"
                  >
                    Matches
                  </Link>
                  <Link
                    href={`/simulate?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}&runs=300`}
                    className="rounded-[8px] border border-white/10 bg-[#111111] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/70"
                  >
                    Simulate
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
