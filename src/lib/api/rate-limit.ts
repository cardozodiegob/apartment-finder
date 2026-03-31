/**
 * Simple in-memory rate limiter for API routes.
 * 100 req/min for public routes, 300 req/min for authenticated routes.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const PUBLIC_LIMIT = 100;
const AUTH_LIMIT = 300;

export function rateLimit(ip: string, isAuthenticated = false): { allowed: boolean; remaining: number } {
  const limit = isAuthenticated ? AUTH_LIMIT : PUBLIC_LIMIT;
  const now = Date.now();
  const key = `${ip}:${isAuthenticated ? "auth" : "public"}`;

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60000);
