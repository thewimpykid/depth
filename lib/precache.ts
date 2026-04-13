import "server-only";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";
import {
  getSeasonRecordsTopN,
  getSeasonRecordsSpread,
} from "@/lib/ftcscout-records-data";
import { getScatterTeams } from "@/lib/scatter-data";
import { getSearchSuggestions } from "@/lib/smart-search";

export type StepResult =
  | { status: "ok"; count?: number }
  | { status: "error"; error: string };

export type PrecacheResult = {
  season: number;
  durationMs: number;
  steps: Record<string, StepResult>;
};

/** Run tasks with at most `concurrency` in flight at once. */
async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>,
): Promise<{ ok: number; failed: number }> {
  let idx = 0;
  let ok = 0;
  let failed = 0;

  async function worker() {
    while (idx < items.length) {
      const item = items[idx++];
      try {
        await fn(item);
        ok++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { ok, failed };
}

async function runStep<T>(
  steps: Record<string, StepResult>,
  name: string,
  fn: () => Promise<T>,
  countFn?: (result: T) => number,
): Promise<T | null> {
  try {
    const result = await fn();
    steps[name] = { status: "ok", count: countFn ? countFn(result) : undefined };
    return result;
  } catch (e) {
    steps[name] = { status: "error", error: String(e) };
    return null;
  }
}

/**
 * Pre-warms Supabase with all high-value data for the current FTC season.
 * Fetches search indices, season records, scatter OPR data, and quick stats
 * for top teams — so first-visit users get fast responses from cache.
 */
export async function precacheCurrentSeason(): Promise<PrecacheResult> {
  const start = Date.now();
  const steps: Record<string, StepResult> = {};

  // Step 1: resolve current season (everything else depends on this)
  const season = await runStep(steps, "season", () => ftcApiClient.getCurrentSeason());
  if (season === null) {
    return { season: 0, durationMs: Date.now() - start, steps };
  }

  // Steps 2–8: fully independent, run in parallel
  const [scatterResult] = await Promise.all([
    // FTCScout OPR scatter (top 500 teams — the most expensive fetch: 20+ GraphQL calls)
    runStep(steps, "scatter-opr", () => getScatterTeams(season, 500), (r) => r.length),

    // Season records — teams view, top 500 (HTML scraping, paginated)
    runStep(steps, "records-teams-top500", () => getSeasonRecordsTopN(season, "teams", 500), (r) => r.rows.length),

    // Season records — matches view, top 500
    runStep(steps, "records-matches-top500", () => getSeasonRecordsTopN(season, "matches", 500), (r) => r.rows.length),

    // Season records — full spread sample for scatter plot
    runStep(steps, "records-teams-spread", () => getSeasonRecordsSpread(season, "teams", 500), (r) => r.rows.length),

    // FTCScout team search index (compact JSON, 1 call)
    runStep(steps, "ftcscout-search-index", () => ftcScoutApiClient.getTeamSearchIndex()),

    // FTC team search index — triggers full paginated build across all FTC teams
    runStep(steps, "ftc-team-index", () => getSearchSuggestions("a", "teams", season), (r) => r.length),

    // FTC season events list
    runStep(steps, "season-events", () => ftcApiClient.getSeasonEvents(season)),
  ]);

  // Step 9: quick stats for top 200 teams by OPR
  // Uses scatter data already in Supabase — no extra API call to get team numbers
  const topTeams = scatterResult?.slice(0, 200) ?? [];
  if (topTeams.length > 0) {
    const { ok, failed } = await mapConcurrent(topTeams, 10, (team) =>
      ftcScoutApiClient.getTeamQuickStats(team.teamNumber, season),
    );
    steps["quick-stats"] = { status: "ok", count: ok };
    if (failed > 0) {
      steps["quick-stats-failures"] = { status: "error", error: `${failed} teams failed` };
    }
  }

  return { season, durationMs: Date.now() - start, steps };
}
