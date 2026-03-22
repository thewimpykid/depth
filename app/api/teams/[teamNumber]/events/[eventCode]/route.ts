import { NextResponse } from "next/server";

import { getTeamEventDetails } from "@/lib/ftc";

function isValidTeamNumber(value: string) {
  return /^\d{1,5}$/.test(value);
}

export async function GET(
  request: Request,
  props: RouteContext<"/api/teams/[teamNumber]/events/[eventCode]">,
) {
  const { teamNumber, eventCode } = await props.params;
  const url = new URL(request.url);
  const seasonParam = url.searchParams.get("season");
  const season =
    seasonParam && /^\d{4}$/.test(seasonParam) ? Number(seasonParam) : undefined;

  if (!isValidTeamNumber(teamNumber)) {
    return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
  }

  const details = await getTeamEventDetails(Number(teamNumber), eventCode, season);

  if (!details) {
    return NextResponse.json({ error: "Event not found for team" }, { status: 404 });
  }

  return NextResponse.json(details, {
    headers: {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=300",
    },
  });
}
