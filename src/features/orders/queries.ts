import "server-only";

import { z } from "zod";

import type { Currency, OrderStatus, OrderType } from "@/generated/prisma/enums";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

import { parseRank, type RankSnapshot } from "./workflow";

export type { RankSnapshot };

const extraOptionsSchema = z.object({
  lpGain: z.string().nullish(),
  addOns: z.array(z.string()).optional(),
  promoCode: z.string().nullish(),
});

const gameSelect = { select: { name: true, slug: true, logoUrl: true } } as const;

export type OrderGame = { name: string; slug: string; logoUrl: string | null };

/** Fields every order view needs to describe the service. */
export type OrderSummary = {
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  game: OrderGame;
  startRank: RankSnapshot;
  desiredRank: RankSnapshot;
  currentRank: RankSnapshot | null;
  quantity: number | null;
  currency: Currency;
  total: number;
  createdAt: Date;
};

export type CustomerOrder = OrderSummary & {
  server: string;
  lpGain: string | null;
  addOns: string[];
  promoCode: string | null;
  subtotal: number;
  discount: number;
};

type OrderRow = {
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  game: OrderGame;
  startRank: unknown;
  desiredRank: unknown;
  currentRank: unknown;
  quantity: number | null;
  currency: Currency;
  totalAmount: { toNumber(): number };
  createdAt: Date;
};

function toSummary(order: OrderRow): OrderSummary {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    game: order.game,
    startRank: parseRank(order.startRank),
    desiredRank: parseRank(order.desiredRank),
    currentRank: order.currentRank ? parseRank(order.currentRank) : null,
    quantity: order.quantity,
    currency: order.currency,
    total: order.totalAmount.toNumber(),
    createdAt: order.createdAt,
  };
}

type CustomerOrderRow = OrderRow & {
  server: string;
  extraOptions: unknown;
  subtotal: { toNumber(): number };
  discountAmount: { toNumber(): number };
};

function toCustomerOrder(order: CustomerOrderRow): CustomerOrder {
  const extra = extraOptionsSchema.safeParse(order.extraOptions);
  return {
    ...toSummary(order),
    server: order.server,
    lpGain: extra.data?.lpGain ?? null,
    addOns: extra.data?.addOns ?? [],
    promoCode: extra.data?.promoCode ?? null,
    subtotal: order.subtotal.toNumber(),
    discount: order.discountAmount.toNumber(),
  };
}

/** An order of this customer, or null — never another customer's order. */
export async function getCustomerOrder(orderNumber: string, customerId: string): Promise<CustomerOrder | null> {
  const order = await db.order.findFirst({ where: { orderNumber, customerId }, include: { game: gameSelect } });
  return order ? toCustomerOrder(order) : null;
}

export async function getCustomerOrders(customerId: string): Promise<OrderSummary[]> {
  const orders = await db.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { game: gameSelect },
  });
  return orders.map(toSummary);
}

export type CustomerOrderDetail = CustomerOrder & {
  notes: string | null;
  booster: { name: string; rating: number; completedOrders: number } | null;
  /** Saved login name (shown to its owner); the password is never sent back. */
  credentials: { username: string; hasPassword: boolean } | null;
  /** Latest credential reveals by the booster, for transparency. */
  accessLog: { vpnLocation: string; at: Date }[];
  timeline: { paidAt: Date | null; assignedAt: Date | null; startedAt: Date | null; completedAt: Date | null };
};

export async function getCustomerOrderDetail(orderNumber: string, customerId: string): Promise<CustomerOrderDetail | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, customerId },
    include: {
      game: gameSelect,
      booster: { select: { name: true, boosterProfile: { select: { rating: true, completedOrders: true } } } },
      credentialAccessLogs: { orderBy: { createdAt: "desc" }, take: 5, select: { vpnLocation: true, createdAt: true } },
    },
  });
  if (!order) return null;

  return {
    ...toCustomerOrder(order),
    notes: order.notes,
    booster: order.booster
      ? {
          name: order.booster.name ?? "Booster",
          rating: order.booster.boosterProfile?.rating.toNumber() ?? 0,
          completedOrders: order.booster.boosterProfile?.completedOrders ?? 0,
        }
      : null,
    credentials: order.accountUsername
      ? { username: decrypt(order.accountUsername, order.id), hasPassword: order.accountPassword !== null }
      : null,
    accessLog: order.credentialAccessLogs.map((log) => ({ vpnLocation: log.vpnLocation, at: log.createdAt })),
    timeline: {
      paidAt: order.paidAt,
      assignedAt: order.assignedAt,
      startedAt: order.startedAt,
      completedAt: order.completedAt,
    },
  };
}
