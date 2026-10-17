/**
 * Best-effort, per-instance attempt limiter for the access form. Serverless instances do not share
 * memory, so this slows brute force rather than guaranteeing a global cap; the codes themselves
 * (144-bit random) are what make guessing infeasible.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= MAX_ATTEMPTS,
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
