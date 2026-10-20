import "server-only";

import type { UserRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { storageEnabled } from "@/lib/storage";

import { findChatOrder, getChatViewer } from "./access";
import { chatClosedReason, type ChatClosedReason, type ChatRole } from "./rules";

/** Senders appear by role only, so customers stay anonymous to boosters. */
export type ChatAuthor = "me" | ChatRole;

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  content: string;
  hasAttachment: boolean;
  /** Words were masked by the filter. */
  isFlagged: boolean;
  /** For own messages: the other side has seen it. */
  isRead: boolean;
  createdAt: Date;
};

const HISTORY_SIZE = 100;

const authorFor = (role: UserRole): ChatRole =>
  role === "CUSTOMER" ? "customer" : role === "BOOSTER" ? "booster" : "staff";

/** Latest messages of an order, oldest first, as seen by `viewerId`. */
export async function listMessages(orderId: string, viewerId: string): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: { orderId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HISTORY_SIZE,
    select: {
      id: true,
      senderId: true,
      content: true,
      attachmentKey: true,
      isFlagged: true,
      isRead: true,
      createdAt: true,
      sender: { select: { role: true } },
    },
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    author: row.senderId === viewerId ? "me" : authorFor(row.sender.role),
    content: row.content,
    hasAttachment: row.attachmentKey !== null,
    isFlagged: row.isFlagged,
    isRead: row.isRead,
    createdAt: row.createdAt,
  }));
}

export type ChatState = {
  orderNumber: string;
  role: ChatRole;
  closedReason: ChatClosedReason | null;
  uploadsEnabled: boolean;
  messages: ChatMessage[];
};

/** Everything the chat panel needs, or null when the viewer has no part in this order's chat. */
export async function getChatState(orderNumber: string): Promise<ChatState | null> {
  const viewer = await getChatViewer();
  const access = viewer ? await findChatOrder(viewer, { orderNumber }) : null;
  if (!viewer || !access) return null;

  return {
    orderNumber,
    role: access.role,
    closedReason: chatClosedReason(access.role, access.order),
    uploadsEnabled: storageEnabled,
    messages: await listMessages(access.order.id, viewer.id),
  };
}
