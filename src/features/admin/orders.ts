import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import {
  OrderStatus,
  type Currency,
  type OrderType,
  type PaymentGateway,
  type TransactionStatus,
  type TransactionType,
} from "@/generated/prisma/enums";
import { parseRank, type RankSnapshot } from "@/features/orders/workflow";
import { db } from "@/lib/db";

export const ORDERS_PAGE_SIZE = 25;

export const orderFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(OrderStatus).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export type AdminOrderRow = {
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  game: string;
  customer: string;
  booster: string | null;
  total: number;
  currency: Currency;
  createdAt: Date;
};

export async function listAdminOrders(filters: OrderFilters): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const where: Prisma.OrderWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { orderNumber: { contains: filters.q.toUpperCase() } },
            { customer: { email: { contains: filters.q, mode: "insensitive" } } },
            { booster: { email: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * ORDERS_PAGE_SIZE,
      take: ORDERS_PAGE_SIZE,
      select: {
        orderNumber: true,
        status: true,
        orderType: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        game: { select: { name: true } },
        customer: { select: { email: true } },
        booster: { select: { name: true, email: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return {
    rows: rows.map((row) => ({
      orderNumber: row.orderNumber,
      status: row.status,
      orderType: row.orderType,
      game: row.game.name,
      customer: row.customer.email,
      booster: row.booster ? (row.booster.name ?? row.booster.email) : null,
      total: row.totalAmount.toNumber(),
      currency: row.currency,
      createdAt: row.createdAt,
    })),
    total,
  };
}

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  game: { name: string; slug: string; logoUrl: string | null };
  startRank: RankSnapshot;
  desiredRank: RankSnapshot;
  currentRank: RankSnapshot | null;
  quantity: number | null;
  server: string;
  currency: Currency;
  total: number;
  boosterCut: number;
  platformCut: number;
  exchangeRate: number;
  notes: string | null;
  hasCredentials: boolean;
  customer: { id: string; name: string; email: string };
  booster: { id: string; name: string; email: string } | null;
  timeline: { createdAt: Date; paidAt: Date | null; assignedAt: Date | null; startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null };
  transactions: {
    id: string;
    type: TransactionType;
    gateway: PaymentGateway;
    status: TransactionStatus;
    amount: number;
    currency: Currency;
    user: string;
    createdAt: Date;
  }[];
  accessLog: { booster: string; vpnLocation: string; ipAddress: string | null; at: Date }[];
};

export async function getAdminOrder(orderNumber: string): Promise<AdminOrderDetail | null> {
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      game: { select: { name: true, slug: true, logoUrl: true } },
      customer: { select: { id: true, name: true, email: true } },
      booster: { select: { id: true, name: true, email: true } },
      transactions: { orderBy: { createdAt: "asc" }, include: { user: { select: { email: true } } } },
      credentialAccessLogs: { orderBy: { createdAt: "desc" }, take: 50, include: { booster: { select: { name: true, email: true } } } },
    },
  });
  if (!order) return null;
  const person = (user: { id: string; name: string | null; email: string }) => ({ id: user.id, name: user.name ?? user.email, email: user.email });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    game: order.game,
    startRank: parseRank(order.startRank),
    desiredRank: parseRank(order.desiredRank),
    currentRank: order.currentRank ? parseRank(order.currentRank) : null,
    quantity: order.quantity,
    server: order.server,
    currency: order.currency,
    total: order.totalAmount.toNumber(),
    boosterCut: order.boosterCutAmount.toNumber(),
    platformCut: order.platformCutAmount.toNumber(),
    exchangeRate: order.exchangeRate.toNumber(),
    notes: order.notes,
    hasCredentials: order.accountUsername !== null,
    customer: person(order.customer),
    booster: order.booster ? person(order.booster) : null,
    timeline: {
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      assignedAt: order.assignedAt,
      startedAt: order.startedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
    },
    transactions: order.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      gateway: transaction.gateway,
      status: transaction.status,
      amount: transaction.amount.toNumber(),
      currency: transaction.currency,
      user: transaction.user.email,
      createdAt: transaction.createdAt,
    })),
    accessLog: order.credentialAccessLogs.map((log) => ({
      booster: log.booster.name ?? log.booster.email,
      vpnLocation: log.vpnLocation,
      ipAddress: log.ipAddress,
      at: log.createdAt,
    })),
  };
}
