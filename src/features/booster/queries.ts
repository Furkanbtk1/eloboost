import "server-only";

import { getLocale } from "next-intl/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { BoosterStatus, OrderStatus, OrderType } from "@/generated/prisma/enums";
import { getPricingCatalog } from "@/features/pricing/catalog";
import { maxPosition } from "@/features/pricing/engine";
import { boosterRanksSchema, canBoosterTake, parseRank, type RankSnapshot } from "@/features/orders/workflow";
import type { OrderGame } from "@/features/orders/queries";
import { redirect } from "@/i18n/navigation";
import { requireArea } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type BoosterContext = {
  userId: string;
  name: string;
  status: BoosterStatus;
  games: { id: string; slug: string; name: string }[];
  ranks: Record<string, RankSnapshot>;
  /** Wallet balance and lifetime earnings, USD. */
  balance: number;
  totalEarnings: number;
  completedOrders: number;
  rating: number;
};

/** Booster profile of a user, or null if they have none. */
export async function getBoosterContext(userId: string): Promise<BoosterContext | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      balance: true,
      boosterProfile: {
        select: {
          status: true,
          currentRanks: true,
          totalEarnings: true,
          completedOrders: true,
          rating: true,
          acceptedGames: { select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  const profile = user?.boosterProfile;
  if (!user || !profile) return null;

  return {
    userId,
    name: user.name ?? user.email,
    status: profile.status,
    games: profile.acceptedGames,
    ranks: boosterRanksSchema.safeParse(profile.currentRanks).data ?? {},
    balance: user.balance.toNumber(),
    totalEarnings: profile.totalEarnings.toNumber(),
    completedOrders: profile.completedOrders,
    rating: profile.rating.toNumber(),
  };
}

/** Booster pages that need an approved (ACTIVE) profile; others go back to /booster. */
export async function requireActiveBooster(path: string): Promise<BoosterContext> {
  const user = await requireArea(path);
  const booster = await getBoosterContext(user.id);
  if (booster?.status === "ACTIVE") return booster;
  return redirect({ href: "/booster", locale: await getLocale() });
}

export type BoosterOrderSummary = {
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  game: OrderGame;
  startRank: RankSnapshot;
  desiredRank: RankSnapshot;
  currentRank: RankSnapshot | null;
  quantity: number | null;
  server: string;
  region: string;
  addOns: string[];
  lpGain: string | null;
  /** What the booster earns, converted to USD. */
  payoutUsd: number;
  createdAt: Date;
};

const extraSchema = z.object({ addOns: z.array(z.string()).optional(), lpGain: z.string().nullish() });

const orderInclude = { game: { select: { id: true, name: true, slug: true, logoUrl: true, rankSystem: true } } } as const;

type Row = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toBoosterSummary(order: Row): BoosterOrderSummary {
  const extra = extraSchema.safeParse(order.extraOptions).data;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    game: { name: order.game.name, slug: order.game.slug, logoUrl: order.game.logoUrl },
    startRank: parseRank(order.startRank),
    desiredRank: parseRank(order.desiredRank),
    currentRank: order.currentRank ? parseRank(order.currentRank) : null,
    quantity: order.quantity,
    server: order.server,
    region: order.region,
    addOns: extra?.addOns ?? [],
    lpGain: extra?.lpGain ?? null,
    payoutUsd: order.boosterCutAmount.times(order.exchangeRate).toDecimalPlaces(2).toNumber(),
    createdAt: order.createdAt,
  };
}

/** Whether the booster's rank in the order's game is high enough for it. */
export async function isEligible(booster: BoosterContext, order: Row): Promise<boolean> {
  if (!booster.games.some((game) => game.id === order.game.id)) return false;
  const catalog = await getPricingCatalog(order.game.slug);
  return canBoosterTake(booster.ranks[order.game.slug], {
    orderType: order.orderType,
    rankSystem: order.game.rankSystem,
    startRank: parseRank(order.startRank),
    desiredRank: parseRank(order.desiredRank),
    maxPosition: catalog ? maxPosition(catalog) : 0,
  });
}

/** Paid, unclaimed orders this booster may take, oldest first. */
export async function getOrderPool(booster: BoosterContext): Promise<BoosterOrderSummary[]> {
  const orders = await db.order.findMany({
    where: { status: "PENDING", boosterId: null, gameId: { in: booster.games.map((game) => game.id) } },
    orderBy: { paidAt: "asc" },
    take: 100,
    include: orderInclude,
  });
  const eligible = await Promise.all(orders.map((order) => isEligible(booster, order)));
  return orders.filter((_, index) => eligible[index]).map(toBoosterSummary);
}

export async function getBoosterOrders(boosterId: string): Promise<BoosterOrderSummary[]> {
  const orders = await db.order.findMany({
    where: { boosterId },
    orderBy: [{ completedAt: { sort: "desc", nulls: "first" } }, { assignedAt: "desc" }],
    take: 50,
    include: orderInclude,
  });
  return orders.map(toBoosterSummary);
}

export type BoosterOrderDetail = BoosterOrderSummary & {
  notes: string | null;
  hasCredentials: boolean;
  accessLog: { vpnLocation: string; at: Date }[];
};

/** An order assigned to this booster, or null. */
export async function getBoosterOrder(orderNumber: string, boosterId: string): Promise<BoosterOrderDetail | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, boosterId },
    include: {
      ...orderInclude,
      credentialAccessLogs: {
        where: { boosterId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { vpnLocation: true, createdAt: true },
      },
    },
  });
  if (!order) return null;
  return {
    ...toBoosterSummary(order),
    notes: order.notes,
    hasCredentials: order.accountUsername !== null && order.accountPassword !== null,
    accessLog: order.credentialAccessLogs.map((log) => ({ vpnLocation: log.vpnLocation, at: log.createdAt })),
  };
}
