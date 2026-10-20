import type { DisputeResolution, OrderStatus } from "@/generated/prisma/enums";

/** Dispute rules shared by the order pages and the admin center. Pure so they can be unit tested. */

/** Either side may freeze an order that is being worked on. */
export const DISPUTABLE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "PAUSED"] as const satisfies readonly OrderStatus[];

export const canOpenDispute = (status: OrderStatus) => (DISPUTABLE_STATUSES as readonly OrderStatus[]).includes(status);

export type ResolutionPlan = {
  orderStatus: OrderStatus;
  /** Refund to the customer's wallet: the whole total, an amount chosen by the admin, or nothing. */
  refund: "full" | "partial" | "none";
  /** Booster's share for the part that is not refunded (partial refund only). */
  payBooster: boolean;
  /** Back to the pool without the current booster. */
  releaseBooster: boolean;
  /** The order is over: the customer's game login is deleted. */
  wipeCredentials: boolean;
};

/**
 * REFUNDED: cancel and refund everything. PARTIAL_REFUND: refund part, close
 * the order and pay the booster pro rata. REASSIGNED: back to the pool for
 * another booster. CONTINUED: carry on where it was frozen.
 */
export function planResolution(resolution: DisputeResolution, previousStatus: OrderStatus): ResolutionPlan {
  switch (resolution) {
    case "REFUNDED":
      return { orderStatus: "CANCELLED", refund: "full", payBooster: false, releaseBooster: false, wipeCredentials: true };
    case "PARTIAL_REFUND":
      return { orderStatus: "COMPLETED", refund: "partial", payBooster: true, releaseBooster: false, wipeCredentials: true };
    case "REASSIGNED":
      return { orderStatus: "PENDING", refund: "none", payBooster: false, releaseBooster: true, wipeCredentials: false };
    case "CONTINUED":
      return { orderStatus: previousStatus, refund: "none", payBooster: false, releaseBooster: false, wipeCredentials: false };
  }
}

/**
 * Booster's pro-rata share in USD cents after a partial refund:
 * cut × (total − refund) / total, converted with the checkout exchange rate.
 */
export function partialBoosterShareUsdCents(input: {
  totalCents: number;
  boosterCutCents: number;
  refundCents: number;
  exchangeRate: number;
}): number {
  const { totalCents, boosterCutCents, refundCents, exchangeRate } = input;
  if (totalCents <= 0 || refundCents <= 0 || refundCents >= totalCents) throw new RangeError("refund must be inside (0, total)");
  return Math.round(((boosterCutCents * (totalCents - refundCents)) / totalCents) * exchangeRate);
}
