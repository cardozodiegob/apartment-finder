/**
 * Persistent rate limiter with MongoDB storage and in-memory fallback.
 */

import RateLimit from "@/lib/db/models/RateLimit";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

const AUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/auth/login": { windowMs: 60000, maxRequests: 10 },
  "/api/auth/register": { windowMs: 60000, maxRequests: 5 },
  "/api/auth/reset-password": { windowMs: 60000, maxRequests: 3 },
};

const DEFAULT_CONFIG: RateLimitConfig = { windowMs: 60000, maxRequests: 100 };

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getConfig(route: string): RateLimitConfig {
  return AUTH_RATE_LIMITS[route] ?? DEFAULT_CONFIG;
}

async function checkRateLimitMongo(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.windowMs);

  const doc = await RateLimit.findOneAndUpdate(
    { key, expiresAt: { $gt: now } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (!doc) {
    await RateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, expiresAt } },
      { upsert: true, new: true }
    );
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  if (doc.count > config.maxRequests) {
    const retryAfterSeconds = Math.ceil(
      (doc.expiresAt.getTime() - now.getTime()) / 1000
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: config.maxRequests - doc.count };
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }

  entry.count += 1;
  if (entry.count > config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, remaining: config.maxRequests - entry.count };
}

export async function checkRateLimit(
  ip: string,
  route: string
): Promise<RateLimitResult> {
  const config = getConfig(route);
  const key = `${ip}:${route}`;

  try {
    return await checkRateLimitMongo(key, config);
  } catch (error) {
    console.warn("Rate limiter falling back to in-memory store:", error);
    return checkRateLimitMemory(key, config);
  }
}

// Cleanup in-memory fallback periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}, 60000);
