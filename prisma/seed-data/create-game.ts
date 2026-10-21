import type { OrderType, PrismaClient } from "../../src/generated/prisma/client";

import { COMMON_ADD_ONS, type GameSeed } from "./catalog";

/** Creates one game with its ladder, servers and price options. Shared by the seed and add-games. */
export async function createGame(prisma: PrismaClient, game: GameSeed, sortOrder: number) {
  return prisma.game.create({
    data: {
      name: game.name,
      slug: game.slug,
      logoUrl: game.logoUrl,
      rankSystem: game.rankSystem,
      supportedOrderTypes: game.supportedOrderTypes,
      basePrice: game.basePrice,
      coachingHourlyRate: game.coachingHourlyRate,
      sortOrder,
      rankSteps: game.rankSteps ? { create: game.rankSteps } : undefined,
      ratingBrackets: game.ratingBrackets ? { create: game.ratingBrackets } : undefined,
      servers: { create: game.servers.map((server, order) => ({ ...server, sortOrder: order })) },
      modifiers: {
        create: [
          ...(game.lpGain ?? []).map((option, order) => ({
            category: "LP_GAIN" as const,
            key: option.key,
            label: option.label,
            percentage: option.percentage,
            isDefault: option.isDefault ?? false,
            orderTypes: ["DIVISION"] satisfies OrderType[],
            sortOrder: order,
          })),
          ...COMMON_ADD_ONS.map((addOn, order) => ({
            category: "ADD_ON" as const,
            key: addOn.key,
            label: addOn.key === "specific_role" ? game.specificRoleLabel : addOn.label,
            description: addOn.description,
            percentage: addOn.percentage,
            // Coaching is priced per hour; only the stream add-on makes sense there.
            orderTypes:
              addOn.key === "live_stream" ? [] : game.supportedOrderTypes.filter((type) => type !== "COACHING"),
            sortOrder: order,
          })),
        ],
      },
    },
  });
}
