import "server-only";

import { fulfilAccountOrder } from "@/features/accounts/fulfil";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderType } from "@/generated/prisma/enums";
import type { PaymentGateway } from "@/generated/prisma/enums";
import { revalidateTag } from "next/cache";

import { ACCOUNTS_CACHE_TAG } from "@/features/accounts/queries";
import { db } from "@/lib/db";
import { broadcast, signal } from "@/lib/realtime/server";

import { getProviderByGateway } from "./registry";
import type { PaymentUpdate } from "./types";

export type ApplyResult =
  /** Order moved to PENDING (booster pool). */
  | "paid"
  /** Tip credited to the booster. */
  | "tip_paid"
  /** Wallet top-up credited to the customer. */
  | "deposit_paid"
  /** Failure / expiry recorded on the transaction. */
  | "recorded"
  /** Nothing to do: still pending, or this update was already applied. */
  | "ignored"
  /** We don't know this payment reference. */
  | "unknown_payment"
  /** Money arrived but the order can't take it (amount mismatch, already paid, cancelled): manual review/refund. */
  | "needs_review";

type PaidOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  promoCodeId: string | null;
  orderType: OrderType;
  totalAmount: Prisma.Decimal;
  extraOptions: Prisma.JsonValue;
};

/** What a confirmed payment did to the order. */
export type PaidOutcome = false | "pool" | "delivered" | "refunded";

/**
 * Settles an order that just got paid. Boost orders enter the booster pool
 * (promo use counted, customer told). Shop accounts are delivered on the spot.
 * False when the order was no longer waiting for payment.
 */
export async function markOrderPaid(tx: Prisma.TransactionClient, order: PaidOrder): Promise<PaidOutcome> {
  if (order.orderType === "ACCOUNT") {
    // Claim the order first so a duplicate payment can't take a second account.
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "AWAITING_PAYMENT" },
      data: { status: "PENDING" },
    });
    return claimed.count === 0 ? false : fulfilAccountOrder(tx, order);
  }

  const moved = await tx.order.updateMany({
    where: { id: order.id, status: "AWAITING_PAYMENT" },
    data: { status: "PENDING", paidAt: new Date() },
  });
  if (moved.count === 0) return false;

  // Usage counts at payment time. If the limit was reached meanwhile, the
  // customer has still paid the discounted price, so the order stands.
  if (order.promoCodeId) {
    await tx.$executeRaw`
      UPDATE "PromoCode" SET "currentUses" = "currentUses" + 1
      WHERE "id" = ${order.promoCodeId}::uuid AND ("maxUses" IS NULL OR "currentUses" < "maxUses")`;
  }

  await tx.notification.create({
    data: {
      userId: order.customerId,
      type: "ORDER_UPDATE",
      data: { orderNumber: order.orderNumber, status: "PENDING" },
      link: `/dashboard/orders/${order.orderNumber}`,
    },
  });
  return "pool";
}

export const orderPaidSignals = (order: { orderNumber: string; customerId: string }, outcome: PaidOutcome = "pool") => [
  signal.orderUpdated(order.orderNumber),
  // Only boost orders appear in the pool.
  ...(outcome === "pool" ? [signal.poolChanged()] : []),
  signal.notification(order.customerId),
];

/** Tips go to the booster in full, in USD (wallet currency). Returns who was credited. */
export async function creditTip(
  tx: Prisma.TransactionClient,
  order: { id: string; orderNumber: string; boosterId: string | null },
  amountUsd: Prisma.Decimal,
  sourceTransactionId: string,
): Promise<string | null> {
  if (!order.boosterId) return null;
  await tx.user.update({ where: { id: order.boosterId }, data: { balance: { increment: amountUsd } } });
  await tx.boosterProfile.update({ where: { userId: order.boosterId }, data: { totalEarnings: { increment: amountUsd } } });
  await tx.transaction.create({
    data: {
      orderId: order.id,
      userId: order.boosterId,
      type: "TIP",
      amount: amountUsd,
      currency: "USD",
      gateway: "WALLET",
      status: "COMPLETED",
      metadata: { fromTransactionId: sourceTransactionId },
    },
  });
  await tx.notification.create({
    data: {
      userId: order.boosterId,
      type: "ORDER_UPDATE",
      data: { orderNumber: order.orderNumber, event: "tip_received", amount: amountUsd.toNumber() },
      link: `/booster/orders/${order.orderNumber}`,
    },
  });
  return order.boosterId;
}

/**
 * Single entry point for every provider's webhook, return-URL reconciliation
 * and the sandbox, for order payments and tips. Idempotent: replays and
 * concurrent deliveries of the same update change nothing after the first.
 */
export async function applyPaymentUpdate(gateway: PaymentGateway, update: PaymentUpdate): Promise<ApplyResult> {
  if (update.outcome === "pending") return "ignored";

  const signals: ReturnType<typeof signal.orderUpdated>[] = [];
  const result = await db.$transaction(async (tx): Promise<ApplyResult> => {
    const payment = await tx.transaction.findUnique({
      where: { gateway_gatewayTransactionId: { gateway, gatewayTransactionId: update.reference } },
      include: { order: true },
    });
    if (!payment) return "unknown_payment";
    const { order } = payment;
    // Order payments and tips belong to an order; a top-up belongs to the user alone.
    const isDeposit = payment.type === "DEPOSIT";
    if (!isDeposit && ((payment.type !== "PAYMENT" && payment.type !== "TIP") || !order)) return "unknown_payment";

    if (update.outcome === "failed" || update.outcome === "expired") {
      const { count } = await tx.transaction.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: update.outcome === "failed" ? "FAILED" : "CANCELLED" },
      });
      return count > 0 ? "recorded" : "ignored";
    }

    // outcome === "paid". Claim the transaction first: only one delivery wins.
    const expectedCents = payment.amount.times(100).toNumber();
    const amountMatches =
      (update.amountCents === null || update.amountCents === expectedCents) &&
      (update.currency === null || update.currency === payment.currency);
    const claimed = await tx.transaction.updateMany({
      where: { id: payment.id, status: { not: "COMPLETED" } },
      data: {
        status: "COMPLETED",
        metadata: {
          providerPaymentId: update.providerPaymentId ?? null,
          ...(amountMatches ? {} : { amountMismatch: { receivedCents: update.amountCents, currency: update.currency } }),
        },
      },
    });
    if (claimed.count === 0) return "ignored";

    if (!amountMatches) {
      console.error(`[payments] amount mismatch on ${order?.orderNumber ?? "top-up"} (${gateway} ${update.reference})`);
      return "needs_review";
    }

    if (isDeposit) {
      // Wallet currency is USD, so the charged amount is the credit.
      await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: "PAYOUT_UPDATE",
          data: { event: "deposit", amount: payment.amount.toNumber() },
          link: "/dashboard",
        },
      });
      signals.push(signal.notification(payment.userId));
      return "deposit_paid";
    }
    if (!order) return "unknown_payment";

    if (payment.type === "TIP") {
      const booster = await creditTip(tx, order, payment.amount.times(order.exchangeRate).toDecimalPlaces(2), payment.id);
      if (!booster) return "needs_review";
      signals.push(signal.orderUpdated(order.orderNumber), signal.notification(booster));
      return "tip_paid";
    }

    // Only an order still waiting for payment moves on; anything else (paid twice
    // through two providers, cancelled meanwhile) is kept for a refund.
    const settled = await markOrderPaid(tx, order);
    if (!settled) {
      await tx.transaction.update({
        where: { id: payment.id },
        data: { metadata: { providerPaymentId: update.providerPaymentId ?? null, needsRefund: order.status } },
      });
      console.error(`[payments] ${order.orderNumber} paid again while ${order.status}: refund needed`);
      return "needs_review";
    }
    signals.push(...orderPaidSignals(order, settled));
    if (order.orderType === "ACCOUNT") revalidateTag(ACCOUNTS_CACHE_TAG, "max");
    return "paid";
  });

  broadcast(...signals);
  return result;
}

/** Asks providers about a customer's open top-ups (their return URL has no order to look up). */
export async function reconcileUserDeposits(userId: string): Promise<void> {
  const open = await db.transaction.findMany({
    where: { userId, type: "DEPOSIT", status: "PENDING", gatewayTransactionId: { not: null } },
    select: { gateway: true, gatewayTransactionId: true },
  });
  await Promise.all(
    open.map(async ({ gateway, gatewayTransactionId }) => {
      const provider = getProviderByGateway(gateway);
      if (!provider || !gatewayTransactionId) return;
      try {
        await applyPaymentUpdate(gateway, await provider.fetchStatus(gatewayTransactionId));
      } catch (error) {
        console.error(`[payments] reconcile deposit ${gateway} ${gatewayTransactionId} failed`, error);
      }
    }),
  );
}

/**
 * Asks providers about this order's open payments and tips. Covers customers who
 * come back from the hosted page before the webhook arrives (or when it never does).
 */
export async function reconcileOrderPayments(orderId: string): Promise<void> {
  const open = await db.transaction.findMany({
    where: { orderId, type: { in: ["PAYMENT", "TIP"] }, status: "PENDING", gatewayTransactionId: { not: null } },
    select: { gateway: true, gatewayTransactionId: true },
  });

  await Promise.all(
    open.map(async ({ gateway, gatewayTransactionId }) => {
      const provider = getProviderByGateway(gateway);
      if (!provider || !gatewayTransactionId) return;
      try {
        await applyPaymentUpdate(gateway, await provider.fetchStatus(gatewayTransactionId));
      } catch (error) {
        console.error(`[payments] reconcile ${gateway} ${gatewayTransactionId} failed`, error);
      }
    }),
  );
}
