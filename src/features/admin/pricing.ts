import "server-only";

import type { GameStatus, ModifierCategory, RankSystem } from "@/generated/prisma/enums";
import { getBoosterShareBp } from "@/features/pricing/catalog";
import { getMinPayoutUsd } from "@/features/payouts/queries";
import { db } from "@/lib/db";

/** Everything the pricing editor shows for one game, including inactive rows. Money is USD. */
export type AdminPricing = {
  slug: string;
  name: string;
  status: GameStatus;
  rankSystem: RankSystem;
  basePrice: number;
  coachingHourlyRate: number | null;
  steps: { position: number; label: string; divisionPrice: number | null; winPrice: number; placementPrice: number }[];
  brackets: { minRating: number; maxRating: number; pricePer100: number; winPrice: number }[];
  servers: { code: string; name: string; region: string; priceModifier: number; isActive: boolean }[];
  modifiers: { key: string; label: string; category: ModifierCategory; percentage: number; isActive: boolean; isDefault: boolean }[];
};

export async function listPricingGames(): Promise<{ slug: string; name: string; status: GameStatus }[]> {
  return db.game.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, status: true } });
}

export async function getAdminPricing(slug: string): Promise<AdminPricing | null> {
  const game = await db.game.findUnique({
    where: { slug },
    include: {
      rankSteps: { orderBy: { position: "asc" } },
      ratingBrackets: { orderBy: { minRating: "asc" } },
      servers: { orderBy: { sortOrder: "asc" } },
      modifiers: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!game) return null;
  return {
    slug: game.slug,
    name: game.name,
    status: game.status,
    rankSystem: game.rankSystem,
    basePrice: game.basePrice.toNumber(),
    coachingHourlyRate: game.coachingHourlyRate?.toNumber() ?? null,
    steps: game.rankSteps.map((step) => ({
      position: step.position,
      label: step.division ? `${step.tier} ${step.division}` : step.tier,
      divisionPrice: step.divisionPrice?.toNumber() ?? null,
      winPrice: step.winPrice.toNumber(),
      placementPrice: step.placementPrice.toNumber(),
    })),
    brackets: game.ratingBrackets.map((bracket) => ({
      minRating: bracket.minRating,
      maxRating: bracket.maxRating,
      pricePer100: bracket.pricePer100.toNumber(),
      winPrice: bracket.winPrice.toNumber(),
    })),
    servers: game.servers.map((server) => ({
      code: server.code,
      name: server.name,
      region: server.region,
      priceModifier: server.priceModifier.toNumber(),
      isActive: server.isActive,
    })),
    modifiers: game.modifiers.map((modifier) => ({
      key: modifier.key,
      label: modifier.label,
      category: modifier.category,
      percentage: modifier.percentage.toNumber(),
      isActive: modifier.isActive,
      isDefault: modifier.isDefault,
    })),
  };
}

export async function getPlatformSettings(): Promise<{ boosterSharePercent: number; minPayoutUsd: number }> {
  const [shareBp, minPayoutUsd] = await Promise.all([getBoosterShareBp(), getMinPayoutUsd()]);
  return { boosterSharePercent: shareBp / 100, minPayoutUsd };
}
