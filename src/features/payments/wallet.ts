import "server-only";

import { db } from "@/lib/db";

/** Wallet balance (USD) and what this order costs in USD. */
export async function getWalletOffer(customerId: string, orderNumber: string): Promise<{ balanceUsd: number; neededUsd: number } | null> {
  const [user, order] = await Promise.all([
    db.user.findUnique({ where: { id: customerId }, select: { balance: true } }),
    db.order.findFirst({ where: { orderNumber, customerId }, select: { totalAmount: true, exchangeRate: true } }),
  ]);
  if (!user || !order) return null;
  return {
    balanceUsd: user.balance.toNumber(),
    neededUsd: order.totalAmount.times(order.exchangeRate).toDecimalPlaces(2).toNumber(),
  };
}
