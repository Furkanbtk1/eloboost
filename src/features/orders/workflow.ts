import { z } from "zod";

import type { OrderStatus, OrderType, RankSystem } from "@/generated/prisma/enums";

/**
 * Order rules shared by the booster/customer panels and their server actions.
 * Pure so they can be unit tested and reused on both sides.
 */

// ---------------------------------------------------------------------------
// Rank snapshots (Order.startRank / desiredRank / currentRank, BoosterProfile.currentRanks)
// ---------------------------------------------------------------------------

export const rankSnapshotSchema = z.object({
  position: z.number().int().optional(),
  rating: z.number().int().optional(),
  label: z.string().optional(),
  /** Wins / games / hours done so far (WIN, PLACEMENT, COACHING progress). */
  done: z.number().int().optional(),
});
export type RankSnapshot = z.infer<typeof rankSnapshotSchema>;

export const parseRank = (value: unknown): RankSnapshot => rankSnapshotSchema.safeParse(value).data ?? {};

/** BoosterProfile.currentRanks: rank per game slug. */
export const boosterRanksSchema = z.record(z.string(), rankSnapshotSchema);

// ---------------------------------------------------------------------------
// Who may take an order
// ---------------------------------------------------------------------------

export type EligibilityOrder = {
  orderType: OrderType;
  rankSystem: RankSystem;
  startRank: RankSnapshot;
  desiredRank: RankSnapshot;
  /** Highest rung of the game's ladder (tiered games). */
  maxPosition: number;
};

/**
 * A booster must be ranked above the highest rank the order touches (e.g. only
 * Master+ boosters see Diamond orders). Top-of-ladder boosters can take
 * anything; coaching only needs a rank in the game.
 */
export function canBoosterTake(boosterRank: RankSnapshot | undefined, order: EligibilityOrder): boolean {
  if (!boosterRank) return false;
  if (order.orderType === "COACHING") return boosterRank.position !== undefined || boosterRank.rating !== undefined;

  // Division orders end at the desired rank; wins and placements are played at the start rank.
  const needed = order.orderType === "DIVISION" ? order.desiredRank : order.startRank;

  if (order.rankSystem === "DIVISION") {
    if (boosterRank.position === undefined || needed.position === undefined) return false;
    return boosterRank.position >= Math.min(needed.position + 1, order.maxPosition);
  }
  if (boosterRank.rating === undefined || needed.rating === undefined) return false;
  return boosterRank.rating > needed.rating;
}

/** Concurrent orders a booster may hold (ASSIGNED / IN_PROGRESS / PAUSED). */
export const MAX_ACTIVE_ORDERS = 3;
export const ACTIVE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "PAUSED"] as const satisfies readonly OrderStatus[];

// ---------------------------------------------------------------------------
// Booster status changes
// ---------------------------------------------------------------------------

export const BOOSTER_TRANSITIONS = {
  start: { from: ["ASSIGNED"], to: "IN_PROGRESS" },
  pause: { from: ["IN_PROGRESS"], to: "PAUSED" },
  resume: { from: ["PAUSED"], to: "IN_PROGRESS" },
  complete: { from: ["IN_PROGRESS"], to: "COMPLETED" },
  /** Give an order back to the pool before starting it. */
  release: { from: ["ASSIGNED"], to: "PENDING" },
} as const satisfies Record<string, { from: readonly OrderStatus[]; to: OrderStatus }>;

export type BoosterTransition = keyof typeof BOOSTER_TRANSITIONS;
export const BOOSTER_TRANSITION_KEYS = Object.keys(BOOSTER_TRANSITIONS) as [BoosterTransition, ...BoosterTransition[]];

export function allowedTransitions(status: OrderStatus): BoosterTransition[] {
  return BOOSTER_TRANSITION_KEYS.filter((key) => (BOOSTER_TRANSITIONS[key].from as readonly OrderStatus[]).includes(status));
}

/** Statuses in which the assigned booster may reveal the customer's credentials. */
export const CREDENTIAL_STATUSES = ["ASSIGNED", "IN_PROGRESS", "PAUSED"] as const satisfies readonly OrderStatus[];

/** Statuses in which the customer may still change credentials and notes. */
export const EDITABLE_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "PAUSED"] as const satisfies readonly OrderStatus[];

// ---------------------------------------------------------------------------
// Customer stepper
// ---------------------------------------------------------------------------

export const STEPS = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] as const;
export type Step = (typeof STEPS)[number];

/** Index of the current step; -1 before payment. PAUSED sits on "in progress". */
export function stepIndex(status: OrderStatus): number {
  switch (status) {
    case "AWAITING_PAYMENT":
      return -1;
    case "PENDING":
      return 0;
    case "ASSIGNED":
      return 1;
    case "IN_PROGRESS":
    case "PAUSED":
    case "DISPUTED":
      return 2;
    case "COMPLETED":
      return 3;
    case "CANCELLED":
      return -1;
  }
}
