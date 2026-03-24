import TeamLookupForm from "../team-lookup";
import TeamSummary from "./team-summary";

export const dynamic = "force-dynamic";

function isValidTeamNumber(value: string) {
  return /^\d{1,5}$/.test(value);
}

function isValidSeason(value: string) {
  return /^\d{4}$/.test(value);
}

export default async function TeamsPage(props: PageProps<"/teams">) {
  const searchParams = await props.searchParams;
  const rawQuery = typeof searchParams.q === "string" ? searchParams.q : "";
  const rawSeason = typeof searchParams.season === "string" ? searchParams.season : "";
  const query = rawQuery.trim();
  const validQuery = isValidTeamNumber(query) ? query : "";
  const validSeason = isValidSeason(rawSeason.trim()) ? Number(rawSeason.trim()) : undefined;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">
                Teams
              </h1>
            </div>
            <div className="w-full max-w-2xl">
              <TeamLookupForm
                initialValue={query}
                compact
                buttonLabel="Search"
                season={validSeason}
                scope="teams"
              />
            </div>
          </div>

          {query && !validQuery ? (
            <p className="mt-3 text-sm text-[#ff8f8f]">Enter a numeric FTC team number.</p>
          ) : null}
        </section>

        {!validQuery ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
            Search for a team to load its events, matches, team names, and OPR values.
          </section>
        ) : (
          <TeamSummary
            key={`${validQuery}-${validSeason ?? "current"}`}
            teamNumber={Number(validQuery)}
            requestedSeason={validSeason}
          />
        )}
      </div>
    </main>
  );
}
