import "server-only";

import type { OrderStatus } from "@/generated/prisma/enums";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { chatRole, type ChatRole, type ChatViewer } from "./rules";

/** The signed-in, non-banned user as the chat rules see them. */
export async function getChatViewer(): Promise<ChatViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    boosterStatus: user.boosterStatus,
    twoFactorReady: !needsTwoFactorSetup(user.role, user.is2FAEnabled),
  };
}

const chatOrderSelect = { id: true, orderNumber: true, customerId: true, boosterId: true, status: true } as const;

export type ChatOrderRow = {
  id: string;
  orderNumber: string;
  customerId: string;
  boosterId: string | null;
  status: OrderStatus;
};

/** The order and the viewer's part in its chat, or null when they have none. */
export async function findChatOrder(
  viewer: ChatViewer,
  where: { orderNumber: string } | { id: string },
): Promise<{ order: ChatOrderRow; role: ChatRole } | null> {
  const order = await db.order.findUnique({ where, select: chatOrderSelect });
  const role = order ? chatRole(viewer, order) : null;
  return order && role ? { order, role } : null;
}
