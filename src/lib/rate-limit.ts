import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { env } from "@/lib/env";
import { redis } from "@/lib/redis";

/**
 * Fixed set of limiters so limits live in one place. Keys passed to
 * `rateLimit` should identify the caller (IP, user id, email...).
 */
const LIMITS = {
  /** Failed logins per IP + email: slows password guessing on one account. Reset on success. */
  login: { requests: 5, windowSeconds: 15 * 60 },
  /** Failed logins per IP: caps credential stuffing across many accounts. */
  loginIp: { requests: 30, windowSeconds: 15 * 60 },
  register: { requests: 5, windowSeconds: 60 * 60 },
  /** Per user: TOTP verification while setting up or disabling 2FA. */
  twoFactor: { requests: 10, windowSeconds: 15 * 60 },
  /** Per user: new orders created from the calculator. */
  createOrder: { requests: 20, windowSeconds: 60 * 60 },
  /** Per IP: promo code lookups, so codes can't be enumerated. */
  promoCheck: { requests: 20, windowSeconds: 10 * 60 },
  /** Per user: hosted payment sessions created at checkout. */
  startPayment: { requests: 20, windowSeconds: 10 * 60 },
  /** Per IP: return-from-provider reconciliations (each one calls the provider's API). */
  paymentReturn: { requests: 30, windowSeconds: 10 * 60 },
  /** Per customer: saving game credentials / notes. */
  saveCredentials: { requests: 20, windowSeconds: 60 * 60 },
  /** Per booster: revealing a customer's game credentials. */
  revealCredentials: { requests: 10, windowSeconds: 60 * 60 },
  /** Per booster: claims, status changes and progress reports. */
  boosterAction: { requests: 60, windowSeconds: 10 * 60 },
  /** Per user: chat messages sent. */
  chatMessage: { requests: 30, windowSeconds: 60 },
  /** Per user: screenshots uploaded to chat. */
  chatAttachment: { requests: 20, windowSeconds: 60 * 60 },
  /** Per user: chat / notification reloads triggered by realtime signals. */
  realtimeSync: { requests: 240, windowSeconds: 60 },
} as const;

export type RateLimitName = keyof typeof LIMITS;

export type RateLimitResult = { success: true } | { success: false; retryAfterSeconds: number };

let warnedAboutMemory = false;

/** Warns once, on first use, when production runs without shared limits. */
function warnIfMemoryInProduction() {
  if (warnedAboutMemory || redis || env.NODE_ENV !== "production") return;
  warnedAboutMemory = true;
  console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set: using in-memory limits, which are per instance only.");
}

function createLimiters(client: NonNullable<typeof redis>) {
  return Object.fromEntries(
    Object.entries(LIMITS).map(([name, { requests, windowSeconds }]) => [
      name,
      new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
        prefix: `eloboost:rl:${name}`,
      }),
    ]),
  ) as Record<RateLimitName, Ratelimit>;
}

const upstashLimiters = redis ? createLimiters(redis) : null;

// In-memory fixed window for local development. Survives hot reloads.
const globalForMemory = globalThis as unknown as { rateLimitHits?: Map<string, { count: number; resetAt: number }> };
const memoryHits = (globalForMemory.rateLimitHits ??= new Map());

function memoryLimit(name: RateLimitName, key: string): RateLimitResult {
  warnIfMemoryInProduction();
  const { requests, windowSeconds } = LIMITS[name];
  const now = Date.now();
  const id = `${name}:${key}`;
  const entry = memoryHits.get(id);

  if (!entry || entry.resetAt <= now) {
    memoryHits.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true };
  }
  if (entry.count >= requests) {
    return { success: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { success: true };
}

/** Clears a key's counter, e.g. after a successful login. */
export async function resetRateLimit(name: RateLimitName, key: string): Promise<void> {
  if (upstashLimiters) await upstashLimiters[name].resetUsedTokens(key);
  else memoryHits.delete(`${name}:${key}`);
}

/**
 * Checks a limit without using it up. Pair with `rateLimit` on failure only,
 * so that limits count failed attempts rather than every request.
 */
export async function peekRateLimit(name: RateLimitName, key: string): Promise<RateLimitResult> {
  if (upstashLimiters) {
    const { remaining, reset } = await upstashLimiters[name].getRemaining(key);
    return remaining > 0
      ? { success: true }
      : { success: false, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
  }

  const entry = memoryHits.get(`${name}:${key}`);
  const now = Date.now();
  if (entry && entry.resetAt > now && entry.count >= LIMITS[name].requests) {
    return { success: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { success: true };
}

/** Counts one request against the limit and reports whether it was allowed. */
export async function rateLimit(name: RateLimitName, key: string): Promise<RateLimitResult> {
  if (!upstashLimiters) return memoryLimit(name, key);

  const { success, reset } = await upstashLimiters[name].limit(key);
  return success
    ? { success: true }
    : { success: false, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
}
