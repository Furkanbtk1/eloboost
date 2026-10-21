import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { RankSystem } from "@/generated/prisma/client";
import { isBoostType, type OrderType } from "@/features/pricing/engine";
import { db } from "@/lib/db";

/** Cache tag to invalidate when games or their prices change in the admin panel. */
export const GAMES_CACHE_TAG = "games";

export type GameSummary = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  rankSystem: RankSystem;
  supportedOrderTypes: OrderType[];
  /** Cheapest division step (DIVISION) or 100-point band (RATING), in USD. */
  startingPrice: number | null;
};

export async function getActiveGames(): Promise<GameSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(GAMES_CACHE_TAG);

  const games = await db.game.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      rankSystem: true,
      supportedOrderTypes: true,
      rankSteps: {
        where: { divisionPrice: { not: null } },
        orderBy: { divisionPrice: "asc" },
        take: 1,
        select: { divisionPrice: true },
      },
      ratingBrackets: {
        orderBy: { pricePer100: "asc" },
        take: 1,
        select: { pricePer100: true },
      },
    },
  });

  // Plain objects only: Prisma Decimals are not serializable across the cache boundary.
  return games.map(({ rankSteps, ratingBrackets, ...game }) => {
    const cheapest = rankSteps[0]?.divisionPrice ?? ratingBrackets[0]?.pricePer100 ?? null;
    return {
      ...game,
      supportedOrderTypes: game.supportedOrderTypes.filter(isBoostType),
      startingPrice: cheapest ? cheapest.toNumber() : null,
    };
  });
}
