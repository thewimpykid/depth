import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type GlobalWithSupabase = typeof globalThis & {
  __supabaseClient?: SupabaseClient;
};

function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const g = globalThis as GlobalWithSupabase;
  if (!g.__supabaseClient) {
    g.__supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return g.__supabaseClient;
}

type RemoteCacheHit<T> = { data: T; remainingTtl: number };

export async function getFromSupabase<T>(
  cacheKey: string,
): Promise<RemoteCacheHit<T> | null> {
  try {
    const client = getClient();
    if (!client) return null;

    const { data, error } = await client
      .from("cache_entries")
      .select("data, created_at, ttl_seconds")
      .eq("cache_key", cacheKey)
      .single();

    if (error || !data) return null;

    const ageSeconds = (Date.now() - new Date(data.created_at as string).getTime()) / 1000;
    const remainingTtl = (data.ttl_seconds as number) - ageSeconds;
    if (remainingTtl <= 0) return null;

    return { data: data.data as T, remainingTtl: Math.floor(remainingTtl) };
  } catch {
    return null;
  }
}

export function setInSupabase(
  cacheKey: string,
  data: unknown,
  ttlSeconds: number,
): void {
  const client = getClient();
  if (!client) return;

  void (async () => {
    try {
      await client.from("cache_entries").upsert(
        {
          cache_key: cacheKey,
          data,
          created_at: new Date().toISOString(),
          ttl_seconds: ttlSeconds,
        },
        { onConflict: "cache_key" },
      );
    } catch {
      // Best-effort — cache writes never fail the caller
    }
  })();
}
