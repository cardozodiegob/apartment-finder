/**
 * Feature-flag evaluation service.
 *
 * - `isFeatureEnabled(name, userId?)` — server-side check.
 * - Deterministic per (flag, userId): the same input always yields the same
 *   boolean, so the same user sees a stable rollout decision.
 *
 * Caches flag docs in-memory for 30s to avoid hitting Mongo on every request.
 */

import dbConnect from "@/lib/db/connection";
import FeatureFlag from "@/lib/db/models/FeatureFlag";

interface CachedFlag {
  enabled: boolean;
  percent: number;
  expiresAt: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, CachedFlag>();

/**
 * Stable 32-bit FNV-1a hash of `input`. Used to derive a deterministic
 * rollout bucket per (flag, user).
 */
export function hashToBucket(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100; // 0–99
}

async function fetchFlag(name: string): Promise<CachedFlag> {
  const now = Date.now();
  const cached = cache.get(name);
  if (cached && cached.expiresAt > now) return cached;

  await dbConnect();
  const doc = await FeatureFlag.findOne({ name }).lean<{ enabled?: boolean; percent?: number }>();
  const entry: CachedFlag = {
    enabled: Boolean(doc?.enabled),
    percent: typeof doc?.percent === "number" ? doc.percent : 0,
    expiresAt: now + TTL_MS,
  };
  cache.set(name, entry);
  return entry;
}

export async function isFeatureEnabled(name: string, userId?: string): Promise<boolean> {
  try {
    const flag = await fetchFlag(name);
    if (!flag.enabled) return false;
    if (flag.percent >= 100) return true;
    if (flag.percent <= 0) return false;
    if (!userId) return flag.percent >= 100;
    const bucket = hashToBucket(`${name}:${userId}`);
    return bucket < flag.percent;
  } catch {
    return false;
  }
}

/** Clear the cache — useful for tests. */
export function _clearFeatureFlagCache() {
  cache.clear();
}
