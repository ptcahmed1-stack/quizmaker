import "server-only";

// Lightweight in-memory limiter (per server instance). It protects login, password-reset and quiz-start
// endpoints from brute force and spam. For multi-instance deployments, put a shared limiter in front.
interface Entry {
  count: number;
  resetAt: number;
}

const g = globalThis as typeof globalThis & { __quizMakerRate?: Map<string, Entry> };
const store: Map<string, Entry> = (g.__quizMakerRate ??= new Map());
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of store) if (entry.resetAt <= now) store.delete(key);
}

/** Records one hit and returns the new count inside the window. */
export function hit(key: string, windowMs: number): number {
  const now = Date.now();
  sweep(now);
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

/** Whether the key already reached `limit` hits (does not record a hit). */
export function isBlocked(key: string, limit: number): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now || entry.count < limit) return { blocked: false, retryAfterSeconds: 0 };
  return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

export function reset(key: string): void {
  store.delete(key);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}

export function waitText(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
