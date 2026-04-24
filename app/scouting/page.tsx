import QRCode from "qrcode";

import ScoutingControls from "./scouting-controls";
import ScoutingTeamList from "./scouting-team-list";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";
import { searchSeasonEvents, getSeasonEventByCode } from "@/lib/event-simulation";
import { ftcApiClient } from "@/lib/ftc-api-client";
import { getScoutReports } from "@/lib/scout-db";

const PROD_BASE = "https://depthftc.vercel.app";

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = asString(obj[k]);
    if (v !== null) return v;
  }
  return null;
}

function formatLocation(parts: Array<string | null | undefined>) {
  return parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(", ") || null;
}

export type FeaturedEvent = {
  code: string;
  name: string;
  typeName: string;
  start: string | null;
  end: string | null;
  location: string | null;
};

function isFeaturedType(typeName: string | null): boolean {
  if (!typeName) return false;
  const t = typeName.toLowerCase();
  return t.includes("championship") || t === "super qualifier";
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractDateKey(v: string | null) {
  if (!v) return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function parseFeaturedEvent(raw: unknown): FeaturedEvent | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const code = pickString(obj, ["code", "eventCode"]);
  if (!code) return null;
  const typeName = pickString(obj, ["typeName", "type"]) ?? "";
  if (!isFeaturedType(typeName)) return null;
  return {
    code,
    name: pickString(obj, ["name", "eventName"]) ?? code,
    typeName,
    start: pickString(obj, ["dateStart", "start", "startDate"]),
    end: pickString(obj, ["dateEnd", "end", "endDate"]),
    location: formatLocation([
      pickString(obj, ["venue"]),
      pickString(obj, ["city"]),
      pickString(obj, ["stateprov", "stateProv"]),
      pickString(obj, ["country"]),
    ]),
  };
}

async function getFeaturedEvents(season: number): Promise<FeaturedEvent[]> {
  try {
    const response = await ftcApiClient.getSeasonEvents(season).catch(() => ({ events: [] }));
    const today = new Date();
    const todayKey = toDateKey(today);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(today.getDate() + 45);
    const cutoffKey = toDateKey(cutoffDate);
    const pastCutoff = new Date(today);
    pastCutoff.setDate(today.getDate() - 3);
    const pastCutoffKey = toDateKey(pastCutoff);

    function featuredPriority(typeName: string): number {
      const t = typeName.toLowerCase();
      if (t.includes("first championship") && !t.includes("division")) return 0;
      if (t.includes("first championship") && t.includes("division")) return 1;
      if (t.includes("regional championship")) return 2;
      if (t.includes("championship")) return 3;
      return 4;
    }

    const featured = (response.events ?? [])
      .map(parseFeaturedEvent)
      .filter((e): e is FeaturedEvent => e !== null)
      .filter((e) => {
        const end = extractDateKey(e.end) ?? extractDateKey(e.start);
        const start = extractDateKey(e.start);
        if (!start) return false;
        return end !== null && end >= pastCutoffKey && start <= cutoffKey;
      })
      .sort((a, b) => {
        const pa = featuredPriority(a.typeName);
        const pb = featuredPriority(b.typeName);
        if (pa !== pb) return pa - pb;
        return (a.start ?? "").localeCompare(b.start ?? "");
      });

    return featured;
  } catch {
    return [];
  }
}

export default async function ScoutingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { currentSeason } = await getCurrentSeasonWithOptions();

  const rawEventQuery = typeof searchParams.eventQuery === "string" ? searchParams.eventQuery : "";
  const rawEventCode = typeof searchParams.eventCode === "string" ? searchParams.eventCode : "";
  const season = currentSeason;

  const eventQuery = rawEventQuery.trim();
  const eventCode = rawEventCode.trim().toUpperCase();

  const [eventMatches, featuredEvents] = await Promise.all([
    eventQuery ? searchSeasonEvents(season, eventQuery, 12) : Promise.resolve([]),
    getFeaturedEvents(season),
  ]);

  let event = null;
  let teams: { teamNumber: number; name: string | null }[] = [];
  let reports: Awaited<ReturnType<typeof getScoutReports>> = [];
  let qrDataUrl = "";
  let qrUrl = "";

  if (eventCode) {
    const [eventResult, teamsResult, reportsResult] = await Promise.all([
      getSeasonEventByCode(season, eventCode),
      ftcApiClient.getEventTeams(eventCode, season).catch(() => ({
        teams: [],
        teamCountTotal: 0,
        pageCurrent: 1,
        pageTotal: 1,
      })),
      getScoutReports(season, eventCode),
    ]);

    event = eventResult;

    teams = (teamsResult.teams ?? [])
      .flatMap((raw) => {
        const obj = asObject(raw);
        if (!obj) return [];
        const teamNumber = asNumber(obj.teamNumber);
        if (!teamNumber) return [];
        const name = asString(obj.nameShort) ?? asString(obj.nameFull) ?? null;
        return [{ teamNumber, name }];
      })
      .sort((a, b) => a.teamNumber - b.teamNumber);

    reports = reportsResult;

    qrUrl = `${PROD_BASE}/scouting?eventCode=${encodeURIComponent(eventCode)}&season=${season}`;
    qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#ffffff", light: "#0d0d0d" },
    });
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8 sm:py-6">
        <section className="rounded-[12px] border border-white/10 bg-[#090909] p-4 sm:p-5">
          <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Scout</h1>
          <ScoutingControls
            key={`scouting-controls:${season}:${eventQuery}:${eventCode}`}
            initialEventQuery={eventQuery}
            season={season}
            matchedEvents={eventMatches}
            selectedEventCode={eventCode}
            featuredEvents={featuredEvents}
          />
        </section>

        {!eventQuery && !eventCode ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
            Search for an FTC event above, or pick a featured event to start scouting.
          </section>
        ) : eventQuery && eventMatches.length === 0 && !event ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
            No events matched that search.
          </section>
        ) : null}

        {eventCode && !event && eventQuery ? (
          <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-[#ff9c9c]">
            That event could not be found.
          </section>
        ) : null}

        {event && eventCode ? (
          teams.length === 0 ? (
            <section className="mt-4 rounded-[10px] border border-white/10 bg-[#090909] px-4 py-3 text-sm text-white/52">
              No teams registered for this event yet.
            </section>
          ) : (
            <ScoutingTeamList
              key={`scouting-team-list:${season}:${eventCode}`}
              teams={teams}
              initialReports={reports}
              eventCode={eventCode}
              season={season}
              qrDataUrl={qrDataUrl}
              qrUrl={qrUrl}
              eventName={event.name}
            />
          )
        ) : null}
      </div>
    </main>
  );
}
