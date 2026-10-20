import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

import { CURRENCIES, type ExchangeRates } from "./currency";

/**
 * USD-based exchange rates, shared through Redis so every instance prices an
 * order with the same rates. Falls back to the admin-editable
 * "fallback_exchange_rates_usd" setting if the provider is unreachable.
 */

const PROVIDER_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "eloboost:fx:usd:v1";
const TTL_SECONDS = 60 * 60;

const ratesSchema = z.object({ USD: z.number(), EUR: z.number().positive(), GBP: z.number().positive(), TRY: z.number().positive() });
const providerSchema = z.object({ result: z.literal("success"), rates: z.record(z.string(), z.number().positive()) });

const HARD_FALLBACK: ExchangeRates = { USD: 1, EUR: 1.08, GBP: 1.27, TRY: 0.029 };

// Process-local cache when Redis is not configured.
let memory: { rates: ExchangeRates; expiresAt: number } | null = null;

async function fetchFromProvider(): Promise<ExchangeRates> {
  const response = await fetch(PROVIDER_URL, { signal: AbortSignal.timeout(5000) });
  const { rates } = providerSchema.parse(await response.json());
  // Provider gives units per 1 USD; we store USD per 1 unit.
  const entries = CURRENCIES.map((currency) => {
    const perUsd = currency === "USD" ? 1 : rates[currency];
    if (!perUsd) throw new Error(`Missing rate for ${currency}`);
    return [currency, Number((1 / perUsd).toFixed(8))] as const;
  });
  return ratesSchema.parse(Object.fromEntries(entries));
}

async function fallbackRates(): Promise<ExchangeRates> {
  const setting = await db.setting.findUnique({ where: { key: "fallback_exchange_rates_usd" } });
  const parsed = ratesSchema.safeParse(setting?.value);
  return parsed.success ? parsed.data : HARD_FALLBACK;
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  if (redis) {
    const cached = ratesSchema.safeParse(await redis.get(CACHE_KEY));
    if (cached.success) return cached.data;
  } else if (memory && memory.expiresAt > Date.now()) {
    return memory.rates;
  }

  let rates: ExchangeRates;
  try {
    rates = await fetchFromProvider();
  } catch (error) {
    console.warn("[exchange-rates] provider unavailable, using fallback rates", error);
    return fallbackRates(); // not cached, so the provider is retried next time
  }

  if (redis) await redis.set(CACHE_KEY, rates, { ex: TTL_SECONDS });
  else memory = { rates, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  return rates;
}
