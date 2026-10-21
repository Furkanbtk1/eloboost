import type { BoosterStatus, OrderStatus, UserRole } from "@/generated/prisma/enums";

/** Who may read or write an order's chat. Pure so it can be unit tested. */

export type ChatRole = "customer" | "booster" | "staff";

/** Statuses in which the customer and the booster can write to each other. */
export const CHAT_STATUSES = ["ASSIGNED", "IN_PROGRESS", "PAUSED", "DISPUTED"] as const satisfies readonly OrderStatus[];

export type ChatViewer = {
  id: string;
  role: UserRole;
  boosterStatus: BoosterStatus | null;
  /** 2FA is set up wherever policy demands it. */
  twoFactorReady: boolean;
};

export type ChatOrder = { customerId: string; boosterId: string | null; status: OrderStatus };

/**
 * The order's customer, its current booster, and support staff (read only,
 * for disputes). A booster who released the order loses access.
 */
export function chatRole(viewer: ChatViewer, order: Pick<ChatOrder, "customerId" | "boosterId">): ChatRole | null {
  if (viewer.role === "CUSTOMER") return order.customerId === viewer.id ? "customer" : null;
  if (!viewer.twoFactorReady) return null;
  if (viewer.role === "BOOSTER") {
    return viewer.boosterStatus === "ACTIVE" && order.boosterId === viewer.id ? "booster" : null;
  }
  if (viewer.role === "ADMIN") return "staff";
  return null;
}

export type ChatClosedReason = "waitingForBooster" | "closed" | "readOnly";

/** Why the viewer can't write right now, or null when they can. */
export function chatClosedReason(role: ChatRole, order: ChatOrder): ChatClosedReason | null {
  if (role === "staff") return "readOnly";
  if (!order.boosterId) return "waitingForBooster";
  return (CHAT_STATUSES as readonly OrderStatus[]).includes(order.status) ? null : "closed";
}

/** Approved boosters with 2FA may watch the live order pool. */
export function canWatchPool(viewer: ChatViewer): boolean {
  return viewer.role === "BOOSTER" && viewer.boosterStatus === "ACTIVE" && viewer.twoFactorReady;
}
