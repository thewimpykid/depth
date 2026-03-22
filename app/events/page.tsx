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
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[14px] border border-white/10 bg-[#090909] p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">Events</div>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.08em] text-white sm:text-5xl">
            events
          </h1>
          <p className="mt-3 max-w-3xl text-base text-white/58 sm:text-lg">
            Search official FTC events by code, name, city, or venue, then jump into matches or simulation.
          </p>

          <EventSearchForm
            initialQuery={eventQuery}
            initialSeason={season}
            seasonOptions={seasonOptions}
            submitLabel="Search"
            basePath="/events"
          />
        </section>

        {!eventQuery ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-white/52">
            Start typing an event name or event code to browse events.
          </section>
        ) : results.length === 0 ? (
          <section className="mt-6 rounded-[14px] border border-white/10 bg-[#090909] p-8 text-base text-[#ff9c9c]">
            No published events matched that search.
          </section>
        ) : (
          <section className="mt-6 grid gap-4 xl:grid-cols-2">
            {results.map((event) => (
              <article key={event.code} className="rounded-[14px] border border-white/10 bg-[#090909] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}`}
                      className="group w-fit"
                    >
                      <div className="text-3xl font-medium tracking-[-0.05em] text-white underline-offset-4 group-hover:underline">
                        {event.name}
                      </div>
                    </Link>
                    <div className="mt-2 text-sm uppercase tracking-[0.14em] text-white/38">
                      {event.code}
                    </div>
                  </div>
                  <div className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72">
                    {season}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Date</div>
                    <div className="mt-2 text-base text-white/84">{fmtDateRange(event.start, event.end)}</div>
                  </div>
                  <div className="rounded-[10px] border border-white/10 bg-[#101010] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-white/36">Location</div>
                    <div className="mt-2 text-base text-white/84">{event.location ?? "Location unavailable"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/matches?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}`}
                    className="rounded-[10px] border border-white/10 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-black"
                  >
                    Open matches
                  </Link>
                  <Link
                    href={`/simulate?season=${season}&eventCode=${encodeURIComponent(event.code)}&eventQuery=${encodeURIComponent(event.name)}&runs=300`}
                    className="rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/78"
                  >
                    Simulate event
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
