import { NextRequest, NextResponse } from "next/server";
import { upsertScoutReport, getTeamScoutReports } from "@/lib/scout-db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamNumber = Number(searchParams.get("teamNumber"));
  const season = Number(searchParams.get("season"));

  if (!teamNumber || !season) {
    return NextResponse.json({ error: "teamNumber and season required" }, { status: 400 });
  }

  const reports = await getTeamScoutReports(season, teamNumber);
  return NextResponse.json(reports, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const season = typeof b.season === "number" ? b.season : null;
  const eventCode = typeof b.eventCode === "string" ? b.eventCode.trim() : null;
  const teamNumber = typeof b.teamNumber === "number" ? b.teamNumber : null;

  if (!season || !eventCode || !teamNumber) {
    return NextResponse.json(
      { error: "season, eventCode, and teamNumber are required" },
      { status: 400 },
    );
  }

  const clampArtifacts = (v: unknown) =>
    typeof v === "number" ? Math.max(0, Math.round(v)) : 0;
  const clampStars = (v: unknown) =>
    typeof v === "number" ? Math.max(0, Math.min(5, Math.round(v))) : 0;
  const clampPoints = (v: unknown) =>
    typeof v === "number" ? Math.max(0, Math.min(500, Math.round(v))) : 0;

  const result = await upsertScoutReport({
    season,
    event_code: eventCode,
    team_number: teamNumber,
    auto_close: b.autoClose === true,
    auto_far: b.autoFar === true,
    artifacts_auto_close: clampArtifacts(b.artifactsAutoClose),
    artifacts_auto_far: clampArtifacts(b.artifactsAutoFar),
    close_side: b.closeSide === true,
    far_side: b.farSide === true,
    artifacts_teleop_close: clampArtifacts(b.artifactsTeleopClose),
    artifacts_teleop_close_max: clampArtifacts(b.artifactsTeleopCloseMax),
    artifacts_teleop_far: clampArtifacts(b.artifactsTeleopFar),
    artifacts_teleop_far_max: clampArtifacts(b.artifactsTeleopFarMax),
    full_park: b.fullPark === true,
    lift: b.lift === true,
    preferred_side:
      b.preferredSide === "close" ? "close" : b.preferredSide === "far" ? "far" : null,
    close_rating: clampStars(b.closeRating),
    far_rating: clampStars(b.farRating),
    scoring_ability: clampStars(b.scoringAbility),
    defense_rating: clampStars(b.defenseRating),
    estimated_solo_points: clampPoints(b.estimatedSoloPoints),
    notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 1000) || null : null,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
