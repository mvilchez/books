export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

const stores = new Map<string, number[]>();

export function checkRateLimit(
  identifier: string,
  { maxAttempts, windowMs }: { maxAttempts: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  let timestamps = stores.get(identifier) ?? [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  const allowed = timestamps.length < maxAttempts;
  if (allowed) {
    timestamps.push(now);
    stores.set(identifier, timestamps);
  }

  const remaining = Math.max(0, maxAttempts - timestamps.length);
  const resetAfterMs =
    timestamps.length > 0
      ? Math.max(0, windowMs - (now - timestamps[0]))
      : 0;

  return { allowed, remaining, resetAfterMs };
}