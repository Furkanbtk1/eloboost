"use server";

import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { moderate } from "@/features/chat/moderation";
import { creditTip } from "@/features/payments/process";
import { availableProviders, getProvider } from "@/features/payments/registry";
import { Prisma } from "@/generated/prisma/client";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getRequestCountry } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";

import { REVIEWS_CACHE_TAG } from "./queries";
import { isTipPercent, tipCents } from "./rules";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** The customer's own completed order that still has its booster. */
async function completedOrder(orderNumber: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return null;
  const order = await db.order.findFirst({
    where: { orderNumber, customerId: user.id, status: "COMPLETED", boosterId: { not: null } },
    include: { game: { select: { name: true } }, customer: { select: { id: true, email: true, name: true, stripeCustomerId: true } } },
  });
  return order ? { user, order } : null;
}

/**
 * 5 / 10 / 20 % of the order total, from the wallet (instant) or through a
 * payment provider (credited by the webhook, like order payments). One tip per order.
 */
export async function startTipAction(
  rawLocale: string,
  orderNumber: string,
  rawPercent: unknown,
  method: string,
): Promise<ActionResult<{ redirectUrl: string | null }>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Feedback.errors" });

  const found = await completedOrder(orderNumber);
  if (!found) return fail(t("notFound"), 404);
  const { user, order } = found;
  if (!isTipPercent(rawPercent)) return fail(t("invalid"), 400);

  const limit = await rateLimit("feedback", user.id);
  if (!limit.success) return fail(t("rateLimited"), 429);
  const tipped = await db.transaction.count({ where: { orderId: order.id, userId: user.id, type: "TIP", status: "COMPLETED" } });
  if (tipped > 0) return fail(t("alreadyTipped"), 409);

  const amount = new Prisma.Decimal(tipCents(order.totalAmount.times(100).toNumber(), rawPercent)).div(100);
  const amountUsd = amount.times(order.exchangeRate).toDecimalPlaces(2);

  if (method === "wallet") {
    const booster = await db.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: amountUsd } },
        data: { balance: { decrement: amountUsd } },
      });
      if (count !== 1) return null;
      const payment = await tx.transaction.create({
        data: {
          orderId: order.id,
          userId: user.id,
          type: "TIP",
          amount: amountUsd,
          currency: "USD",
          gateway: "WALLET",
          gatewayTransactionId: `wallet_${randomUUID()}`,
          status: "COMPLETED",
        },
      });
      return creditTip(tx, order, amountUsd, payment.id);
    });
    if (!booster) return fail(t("walletInsufficient"), 409);
    broadcast(signal.notification(booster), signal.orderUpdated(orderNumber));
    return ok({ redirectUrl: null });
  }

  const provider = getProvider(method);
  if (!provider || !availableProviders(order.currency, await getRequestCountry()).includes(provider.id)) {
    return fail(t("unavailable"), 400);
  }
  const orderPath = getPathname({ href: `/dashboard/orders/${order.orderNumber}`, locale });
  let created;
  try {
    created = await provider.createPayment({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents: amount.times(100).toNumber(),
        currency: order.currency,
        description: `Tip · ${order.game.name}`,
        customer: order.customer,
      },
      successUrl: new URL(
        `/api/payments/return?${new URLSearchParams({ order: order.orderNumber, locale, kind: "tip" })}`,
        env.NEXT_PUBLIC_APP_URL,
      ).toString(),
      cancelUrl: new URL(`${orderPath}?tip=cancelled`, env.NEXT_PUBLIC_APP_URL).toString(),
      locale,
    });
  } catch (error) {
    console.error(`[tips] ${provider.id} createPayment failed for ${order.orderNumber}`, error);
    return fail(t("providerError"), 502);
  }
  await db.transaction.create({
    data: {
      orderId: order.id,
      userId: user.id,
      type: "TIP",
      amount,
      currency: order.currency,
      gateway: provider.gateway,
      gatewayTransactionId: created.reference,
      status: "PENDING",
    },
  });
  return ok({ redirectUrl: created.redirectUrl });
}

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000),
  isPublic: z.boolean(),
});

/** One review per completed order; the booster's average is recomputed in the same transaction. */
export async function submitReviewAction(rawLocale: string, orderNumber: string, input: unknown): Promise<ActionResult> {
  const t = await getTranslations({ locale: resolveLocale(rawLocale), namespace: "Feedback.errors" });
  const found = await completedOrder(orderNumber);
  if (!found) return fail(t("notFound"), 404);
  const { user, order } = found;
  const { boosterId } = order;
  if (!boosterId) return fail(t("notFound"), 404);

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalid"), 400);
  const limit = await rateLimit("feedback", user.id);
  if (!limit.success) return fail(t("rateLimited"), 429);
  const { rating, isPublic } = parsed.data;
  const comment = parsed.data.comment ? moderate(parsed.data.comment).text : null;

  try {
    await db.$transaction(async (tx) => {
      await tx.review.create({ data: { orderId: order.id, customerId: user.id, boosterId, rating, comment, isPublic } });
      const stats = await tx.review.aggregate({ where: { boosterId }, _avg: { rating: true }, _count: { _all: true } });
      await tx.boosterProfile.update({
        where: { userId: boosterId },
        data: {
          rating: new Prisma.Decimal(stats._avg.rating ?? 0).toDecimalPlaces(2),
          ratingCount: stats._count._all,
        },
      });
      await tx.notification.create({
        data: {
          userId: boosterId,
          type: "ORDER_UPDATE",
          data: { orderNumber, event: "review_received", rating },
          link: `/booster/orders/${orderNumber}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fail(t("alreadyReviewed"), 409);
    throw error;
  }

  if (isPublic && comment) updateTag(REVIEWS_CACHE_TAG);
  broadcast(signal.notification(boosterId));
  return ok(undefined);
}
