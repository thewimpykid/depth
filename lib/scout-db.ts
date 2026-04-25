import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type GlobalWithScoutClient = typeof globalThis & {
  __scoutSupabaseClient?: SupabaseClient;
};

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const g = globalThis as GlobalWithScoutClient;
  if (!g.__scoutSupabaseClient) {
    g.__scoutSupabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return g.__scoutSupabaseClient;
}

export type ScoutReport = {
  id: number;
  season: number;
  event_code: string;
  team_number: number;
  auto_close: boolean;
  auto_far: boolean;
  artifacts_auto_close: number;
  artifacts_auto_far: number;
  close_side: boolean;
  far_side: boolean;
  artifacts_teleop_close: number;
  artifacts_teleop_close_max: number;
  artifacts_teleop_far: number;
  artifacts_teleop_far_max: number;
  full_park: boolean;
  lift: boolean;
  preferred_side: "close" | "far" | null;
  close_rating: number;
  far_rating: number;
  scoring_ability: number;
  defense_rating: number;
  estimated_solo_points: number;
  notes: string | null;
  submitted_at: string;
};

export async function getScoutReports(
  season: number,
  eventCode: string,
): Promise<ScoutReport[]> {
  try {
    const client = getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("scout_reports")
      .select("*")
      .eq("season", season)
      .eq("event_code", eventCode.toUpperCase());

    if (error || !data) return [];
    return data as ScoutReport[];
  } catch {
    return [];
  }
}

export async function getTeamScoutReports(
  season: number,
  teamNumber: number,
): Promise<ScoutReport[]> {
  try {
    const client = getClient();
    if (!client) return [];

    const { data, error } = await client
      .from("scout_reports")
      .select("*")
      .eq("season", season)
      .eq("team_number", teamNumber);

    if (error || !data) return [];
    return data as ScoutReport[];
  } catch {
    return [];
  }
}

export async function upsertScoutReport(
  report: Omit<ScoutReport, "id" | "submitted_at">,
): Promise<{ error: string | null }> {
  try {
    const client = getClient();
    if (!client) return { error: "Database not configured" };

    const { error } = await client.from("scout_reports").upsert(
      {
        ...report,
        event_code: report.event_code.toUpperCase(),
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "season,event_code,team_number" },
    );

    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
