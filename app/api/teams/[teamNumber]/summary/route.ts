import { NextResponse } from "next/server";

import { getTeamSummaryData } from "@/lib/ftc";

function isValidTeamNumber(value: string) {
  return /^\d{1,5}$/.test(value);
}

export async function GET(
  request: Request,
  props: RouteContext<"/api/teams/[teamNumber]/summary">,
) {
  const { teamNumber } = await props.params;
  const url = new URL(request.url);
  const seasonParam = url.searchParams.get("season");
  const season =
    seasonParam && /^\d{4}$/.test(seasonParam) ? Number(seasonParam) : undefined;

  if (!isValidTeamNumber(teamNumber)) {
    return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
  }

  const summary = await getTeamSummaryData(Number(teamNumber), season);
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}
