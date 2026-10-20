import "server-only";

import type { PaymentGateway } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { getProviderByGateway } from "./registry";
import type { PaymentUpdate } from "./types";

export type ApplyResult =
  /** Order moved to PENDING (booster pool). */
  | "paid"
  /** Failure / expiry recorded on the transaction. */
  | "recorded"
  /** Nothing to do: still pending, or this update was already applied. */
  | "ignored"
  /** We don't know this payment reference. */
  | "unknown_payment"
  /** Money arrived but the order can't take it (amount mismatch, already paid, cancelled): manual review/refund. */
  | "needs_review";

/**
 * Single entry point for every provider's webhook, return-URL reconciliation
 * and the sandbox. Idempotent: replays and concurrent deliveries of the same
 * update change nothing after the first.
 */
export async function applyPaymentUpdate(gateway: PaymentGateway, update: PaymentUpdate): Promise<ApplyResult> {
  if (update.outcome === "pending") return "ignored";

  return db.$transaction(async (tx) => {
    const payment = await tx.transaction.findUnique({
      where: { gateway_gatewayTransactionId: { gateway, gatewayTransactionId: update.reference } },
      include: { order: true },
    });
    if (!payment || payment.type !== "PAYMENT" || !payment.order) return "unknown_payment";
    const { order } = payment;

    if (update.outcome === "failed" || update.outcome === "expired") {
      const { count } = await tx.transaction.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: update.outcome === "failed" ? "FAILED" : "CANCELLED" },
      });
      return count > 0 ? "recorded" : "ignored";
    }

    // outcome === "paid". Claim the transaction first: only one delivery wins.
    const expectedCents = order.totalAmount.times(100).toNumber();
    const amountMatches =
      (update.amountCents === null || update.amountCents === expectedCents) &&
      (update.currency === null || update.currency === order.currency);
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
      console.error(`[payments] amount mismatch on ${order.orderNumber} (${gateway} ${update.reference})`);
      return "needs_review";
    }

    // Only an order still waiting for payment moves on; anything else (paid twice
    // through two providers, cancelled meanwhile) is kept for a refund.
    const moved = await tx.order.updateMany({
      where: { id: order.id, status: "AWAITING_PAYMENT" },
      data: { status: "PENDING", paidAt: new Date() },
    });
    if (moved.count === 0) {
      await tx.transaction.update({
        where: { id: payment.id },
        data: { metadata: { providerPaymentId: update.providerPaymentId ?? null, needsRefund: order.status } },
      });
      console.error(`[payments] ${order.orderNumber} paid again while ${order.status}: refund needed`);
      return "needs_review";
    }

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
    return "paid";
  });
}

/**
 * Asks providers about this order's open payments. Covers customers who come
 * back from the hosted page before the webhook arrives (or when it never does).
 */
export async function reconcileOrderPayments(orderId: string): Promise<void> {
  const open = await db.transaction.findMany({
    where: { orderId, type: "PAYMENT", status: "PENDING", gatewayTransactionId: { not: null } },
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
