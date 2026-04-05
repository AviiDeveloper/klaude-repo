interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request is allowed, false if it should be blocked.
 * @param key    Typically the client IP address
 * @param max    Maximum requests per window (default 5)
 * @param windowMs  Window size in ms (default 60 000)
 */
export function checkRateLimit(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();

  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
