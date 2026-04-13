import "server-only";

import { cacheManager } from "@/lib/cache-manager";
import type { ScatterTeam } from "@/app/opr-scatter";

const FTCSCOUT_GRAPHQL =
  process.env.FTCSCOUT_GRAPHQL_URL?.replace(/\/+$/, "") ??
  "https://api.ftcscout.org/graphql";

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Fetch one page (50 records max) of TEP records sorted by NP OPR desc. */
async function fetchTepPage(
  season: number,
  skip: number,
  statsType: string,
): Promise<ScatterTeam[]> {
  const query = `{
    tepRecords(season: ${season}, skip: ${skip}, take: 50, sortBy: "opr.totalPointsNp", sortDir: Desc) {
      data {
        data {
          teamNumber
          team { name }
          stats {
            ... on ${statsType} {
              opr { totalPointsNp autoPoints dcPoints }
            }
          }
        }
      }
    }
  }`;

  const resp = await fetch(FTCSCOUT_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });

  if (!resp.ok) return [];

  const json = asObject(await resp.json());
  const tepData = asObject(json?.data);
  const tepRecords = asObject(tepData?.tepRecords);
  const rows = Array.isArray(tepRecords?.data) ? (tepRecords.data as unknown[]) : [];

  const teams: ScatterTeam[] = [];
  for (const row of rows) {
    const rowObj = asObject(row);
    const d = asObject(rowObj?.data);
    if (!d) continue;

    const teamNumber = asNumber(d.teamNumber);
    if (teamNumber === null) continue;

    const teamObj = asObject(d.team);
    const teamName = asString(teamObj?.name);

    const statsObj = asObject(d.stats);
    const oprObj = asObject(statsObj?.opr);
    if (!oprObj) continue;

    const npOpr = asNumber(oprObj.totalPointsNp);
    const autoOpr = asNumber(oprObj.autoPoints);
    const teleopOpr = asNumber(oprObj.dcPoints);
    if (npOpr === null || autoOpr === null || teleopOpr === null) continue;

    teams.push({ teamNumber, teamName, npOpr, autoOpr, teleopOpr });
  }

  return teams;
}

/** Run async tasks with at most `concurrency` in flight at once. */
async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<ScatterTeam[]>,
): Promise<ScatterTeam[][]> {
  const results: ScatterTeam[][] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = [];
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

/**
 * Fetch the top `target` teams by NP OPR for `season` from FTCScout.
 *
 * FTCScout caps each tepRecords request at 50 records, so we paginate.
 * Top teams appear once per event they competed in, so we oversample by 8×
 * to collect enough unique teams, then deduplicate keeping the best NP OPR
 * per team and return the top `target`.
 */
async function fetchTopTeamsByOpr(
  season: number,
  target: number,
): Promise<ScatterTeam[]> {
  const statsType = `TeamEventStats${season}`;
  const totalRecords = Math.min(target * 8, 4000);
  const pageCount = Math.ceil(totalRecords / 50);
  const skips = Array.from({ length: pageCount }, (_, i) => i * 50);

  // Fetch pages with concurrency=10 to avoid hammering FTCScout.
  const pages = await mapConcurrent(skips, 10, (skip) =>
    fetchTepPage(season, skip, statsType),
  );

  // Deduplicate by team number, keeping highest NP OPR.
  const best = new Map<number, ScatterTeam>();
  for (const page of pages) {
    for (const team of page) {
      const existing = best.get(team.teamNumber);
      if (!existing || team.npOpr > existing.npOpr) {
        best.set(team.teamNumber, team);
      }
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.npOpr - a.npOpr)
    .slice(0, target);
}

export async function getScatterTeams(season: number, target: number): Promise<ScatterTeam[]> {
  // Cache key version suffix forces a fresh fetch when logic changes.
  const cacheKey = `scatter-v3-${season}-${target}`;
  const cached = await cacheManager.get<ScatterTeam[]>("scatter", cacheKey);
  if (cached) return cached;

  const result = await fetchTopTeamsByOpr(season, target);
  cacheManager.set("scatter", cacheKey, result, 1800);
  return result;
}
