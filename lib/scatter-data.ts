import "server-only";

import { ftcApiClient } from "@/lib/ftc-api-client";
import { ftcScoutApiClient } from "@/lib/ftcscout-api-client";
import { cacheManager } from "@/lib/cache-manager";
import type { ScatterTeam } from "@/app/opr-scatter";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function pickNumber(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const v = asNumber(obj[key]);
    if (v !== null) return v;
  }
  return null;
}

function pickString(obj: Record<string, unknown> | null, keys: string[]): string | null {
  if (!obj) return null;
  for (const key of keys) {
    if (typeof obj[key] === "string") return obj[key] as string;
  }
  return null;
}

type TeamEntry = { number: number; name: string | null };

async function getAllSeasonTeamNumbers(season: number): Promise<TeamEntry[]> {
  const cacheKey = `all-teams-${season}`;
  const cached = cacheManager.get<TeamEntry[]>("scatter", cacheKey);
  if (cached) return cached;

  const firstPage = await ftcApiClient.getTeamIndexPage(season, 1);
  const allRaw: unknown[] = [...asArray(firstPage.teams)];
  const pageTotal = Math.min(firstPage.pageTotal ?? 1, 300);

  if (pageTotal > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pageTotal - 1 }, (_, i) => i + 2).map((p) =>
        ftcApiClient
          .getTeamIndexPage(season, p)
          .then((r) => asArray(r.teams))
          .catch(() => [] as unknown[]),
      ),
    );
    for (const page of remaining) allRaw.push(...page);
  }

  const result: TeamEntry[] = allRaw
    .map(asObject)
    .filter((t): t is Record<string, unknown> => t !== null)
    .map((t) => ({
      number: pickNumber(t, ["teamNumber", "number"]) ?? 0,
      name: pickString(t, ["nameShort", "name", "schoolName"]),
    }))
    .filter((t) => t.number > 0);

  cacheManager.set("scatter", cacheKey, result, 3600);
  return result;
}

export async function getScatterTeams(season: number, target: number): Promise<ScatterTeam[]> {
  const cacheKey = `scatter-data-${season}-${target}`;
  const cached = cacheManager.get<ScatterTeam[]>("scatter", cacheKey);
  if (cached) return cached;

  const allTeams = await getAllSeasonTeamNumbers(season);
  if (allTeams.length === 0) return [];

  // Uniform sample across the full team list
  const sample: TeamEntry[] = [];
  const step = Math.max(1, allTeams.length / target);
  for (let i = 0; i < target; i++) {
    const idx = Math.round(i * step);
    if (idx >= allTeams.length) break;
    sample.push(allTeams[idx]);
  }

  // Batch-fetch quick stats 50 at a time
  const BATCH = 50;
  const scatterTeams: ScatterTeam[] = [];

  for (let i = 0; i < sample.length; i += BATCH) {
    const batch = sample.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((t) => ftcScoutApiClient.getTeamQuickStats(t.number, season)),
    );

    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status !== "fulfilled") continue;
      const stats = r.value;
      const npOpr = stats.tot?.value;
      const autoOpr = stats.auto?.value;
      const teleopOpr = stats.dc?.value;
      if (npOpr == null || autoOpr == null || teleopOpr == null) continue;
      scatterTeams.push({
        teamNumber: batch[j].number,
        teamName: batch[j].name,
        npOpr,
        autoOpr,
        teleopOpr,
      });
    }
  }

  cacheManager.set("scatter", cacheKey, scatterTeams, 1800);
  return scatterTeams;
}
