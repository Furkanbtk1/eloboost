import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import type { PricingCatalog } from "./engine";

/** Cache tag to invalidate when any game's prices change in the admin panel. */
export const PRICING_CACHE_TAG = "pricing";
export const SETTINGS_CACHE_TAG = "settings";

const toCents = (value: Prisma.Decimal) => value.times(100).toNumber();
const toBasisPoints = (percent: Prisma.Decimal) => percent.times(100).toNumber();

/** Price data of one active game, as plain serializable numbers. */
export async function getPricingCatalog(slug: string): Promise<PricingCatalog | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(PRICING_CACHE_TAG, `${PRICING_CACHE_TAG}:${slug}`, "games");

  const game = await db.game.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      rankSteps: { orderBy: { position: "asc" } },
      ratingBrackets: { orderBy: { minRating: "asc" } },
      servers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      modifiers: { where: { isActive: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!game) return null;

  return {
    slug: game.slug,
    name: game.name,
    rankSystem: game.rankSystem,
    orderTypes: game.supportedOrderTypes,
    basePriceCents: toCents(game.basePrice),
    coachingHourlyCents: game.coachingHourlyRate ? toCents(game.coachingHourlyRate) : null,
    steps: game.rankSteps.map((step) => ({
      position: step.position,
      tier: step.tier,
      division: step.division,
      divisionPriceCents: step.divisionPrice ? toCents(step.divisionPrice) : null,
      winPriceCents: toCents(step.winPrice),
      placementPriceCents: toCents(step.placementPrice),
    })),
    brackets: game.ratingBrackets.map((bracket) => ({
      minRating: bracket.minRating,
      maxRating: bracket.maxRating,
      pricePer100Cents: toCents(bracket.pricePer100),
      winPriceCents: toCents(bracket.winPrice),
    })),
    servers: game.servers.map((server) => ({
      code: server.code,
      name: server.name,
      region: server.region,
      percentBp: toBasisPoints(server.priceModifier),
    })),
    modifiers: game.modifiers.map((modifier) => ({
      key: modifier.key,
      label: modifier.label,
      description: modifier.description,
      category: modifier.category,
      percentBp: toBasisPoints(modifier.percentage),
      orderTypes: modifier.orderTypes,
      isDefault: modifier.isDefault,
    })),
  };
}

export async function getActiveGameSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("games");
  const games = await db.game.findMany({ where: { status: "ACTIVE" }, select: { slug: true } });
  return games.map((game) => game.slug);
}

const commissionSchema = z.number().gt(0).lt(1);

/** Share of each order paid to the booster (Setting "booster_commission_rate"), in basis points. */
export async function getBoosterShareBp(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_CACHE_TAG);
  const setting = await db.setting.findUnique({ where: { key: "booster_commission_rate" } });
  const parsed = commissionSchema.safeParse(setting?.value);
  // Fall back to the documented 60/40 split rather than failing checkout.
  return Math.round((parsed.success ? parsed.data : 0.6) * 10000);
}
