import "server-only";

import type { Prisma } from "@/generated/prisma/client";

type AccountOrder = { id: string; orderNumber: string; customerId: string; totalAmount: Prisma.Decimal; extraOptions: Prisma.JsonValue };

const productIdOf = (extraOptions: Prisma.JsonValue): string | null => {
  if (extraOptions && typeof extraOptions === "object" && !Array.isArray(extraOptions)) {
    const value = extraOptions.accountProductId;
    return typeof value === "string" ? value : null;
  }
  return null;
};

/**
 * Called inside the payment transaction. Takes one unsold account of the
 * product (row-locked, so parallel payments never get the same one) and
 * completes the order. If the shelf is empty after all, the order is cancelled
 * and the money goes back to the customer's wallet: nobody pays for nothing.
 */
export async function fulfilAccountOrder(tx: Prisma.TransactionClient, order: AccountOrder): Promise<"delivered" | "refunded"> {
  const productId = productIdOf(order.extraOptions);
  const picked = productId
    ? await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "AccountStock"
        WHERE "productId" = ${productId}::uuid AND "orderId" IS NULL
        ORDER BY "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED`
    : [];

  const now = new Date();
  const stockId = picked[0]?.id;
  if (stockId) {
    await tx.accountStock.update({ where: { id: stockId }, data: { orderId: order.id, soldAt: now } });
    await tx.order.update({ where: { id: order.id }, data: { status: "COMPLETED", paidAt: now, completedAt: now } });
    await tx.notification.create({
      data: {
        userId: order.customerId,
        type: "ORDER_UPDATE",
        data: { orderNumber: order.orderNumber, status: "COMPLETED" },
        link: `/dashboard/orders/${order.orderNumber}`,
      },
    });
    return "delivered";
  }

  await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", paidAt: now, cancelledAt: now } });
  await tx.user.update({ where: { id: order.customerId }, data: { balance: { increment: order.totalAmount } } });
  await tx.transaction.create({
    data: {
      orderId: order.id,
      userId: order.customerId,
      type: "REFUND",
      amount: order.totalAmount,
      currency: "USD",
      gateway: "WALLET",
      status: "COMPLETED",
      metadata: { reason: "out_of_stock" },
    },
  });
  await tx.notification.create({
    data: {
      userId: order.customerId,
      type: "ORDER_UPDATE",
      data: { orderNumber: order.orderNumber, event: "refunded", amount: order.totalAmount.toNumber() },
      link: `/dashboard/orders/${order.orderNumber}`,
    },
  });
  return "refunded";
}
