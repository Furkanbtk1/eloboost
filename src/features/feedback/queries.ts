import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Currency } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import { publicReviewerName, TIP_PERCENTS, tipCents, type TipPercent } from "./rules";

/** Invalidated when a review is written or its visibility changes. */
export const REVIEWS_CACHE_TAG = "reviews";

export type FeedbackState = {
  review: { rating: number; comment: string | null; isPublic: boolean; createdAt: Date } | null;
  /** Completed tip, in the currency it was paid in. */
  tip: { amount: number; currency: Currency } | null;
  tipOptions: { percent: TipPercent; amount: number }[];
  currency: Currency;
  walletUsd: number;
  /** USD needed for each tip option when paying from the wallet. */
  exchangeRate: number;
};

/** What a customer sees under a completed order: their review and tip, or the forms to give them. */
export async function getFeedbackState(orderNumber: string, customerId: string): Promise<FeedbackState | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, customerId, status: "COMPLETED", boosterId: { not: null } },
    select: {
      id: true,
      totalAmount: true,
      currency: true,
      exchangeRate: true,
      review: { select: { rating: true, comment: true, isPublic: true, createdAt: true } },
      customer: { select: { balance: true } },
      transactions: {
        where: { type: "TIP", userId: customerId, status: "COMPLETED" },
        select: { amount: true, currency: true },
        take: 1,
      },
    },
  });
  if (!order) return null;
  const totalCents = order.totalAmount.times(100).toNumber();
  const tip = order.transactions[0];

  return {
    review: order.review,
    tip: tip ? { amount: tip.amount.toNumber(), currency: tip.currency } : null,
    tipOptions: TIP_PERCENTS.map((percent) => ({ percent, amount: tipCents(totalCents, percent) / 100 })),
    currency: order.currency,
    walletUsd: order.customer.balance.toNumber(),
    exchangeRate: order.exchangeRate.toNumber(),
  };
}

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer: string | null;
  booster: string;
  game: string;
  createdAt: Date;
};

/** Latest public reviews with a comment, for the home page. */
export async function getPublicReviews(take = 6): Promise<PublicReview[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(REVIEWS_CACHE_TAG);

  const rows = await db.review.findMany({
    where: { isPublic: true, comment: { not: null } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      customer: { select: { name: true } },
      booster: { select: { name: true } },
      order: { select: { game: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    reviewer: publicReviewerName(row.customer.name),
    booster: row.booster.name ?? "Booster",
    game: row.order.game.name,
    createdAt: row.createdAt,
  }));
}

export type AdminReviewRow = PublicReview & { orderNumber: string; isPublic: boolean; customerEmail: string };

export async function getAdminReviews(): Promise<AdminReviewRow[]> {
  const rows = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      rating: true,
      comment: true,
      isPublic: true,
      createdAt: true,
      customer: { select: { name: true, email: true } },
      booster: { select: { name: true } },
      order: { select: { orderNumber: true, game: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    isPublic: row.isPublic,
    reviewer: publicReviewerName(row.customer.name),
    customerEmail: row.customer.email,
    booster: row.booster.name ?? "Booster",
    game: row.order.game.name,
    orderNumber: row.order.orderNumber,
    createdAt: row.createdAt,
  }));
}
