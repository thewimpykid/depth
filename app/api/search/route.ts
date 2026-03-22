import { NextResponse } from "next/server";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { getSearchSuggestions, type SearchScope } from "@/lib/smart-search";

function isScope(value: string | null): value is SearchScope {
  return value === "teams" || value === "events" || value === "mixed";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const scope = isScope(url.searchParams.get("scope")) ? (url.searchParams.get("scope") as SearchScope) : "mixed";
  const currentSeason = await ftcApiClient.getCurrentSeason();
  const seasonParam = url.searchParams.get("season");
  const season =
    seasonParam && /^\d{4}$/.test(seasonParam) ? Number(seasonParam) : currentSeason;
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam && /^\d+$/.test(limitParam) ? Math.min(12, Math.max(1, Number(limitParam))) : 8;

  const suggestions = q ? await getSearchSuggestions(q, scope, season, limit) : [];

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
