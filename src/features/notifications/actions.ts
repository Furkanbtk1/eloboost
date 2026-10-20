"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

import { countUnreadNotifications, getNotifications, type NotificationItem } from "./queries";

export type NotificationFeed = { unread: number; items: NotificationItem[] };

export async function getNotificationFeedAction(): Promise<ActionResult<NotificationFeed>> {
  const user = await getCurrentUser();
  if (!user) return fail("Unauthorized", 401);

  const limit = await rateLimit("realtimeSync", user.id);
  if (!limit.success) return fail("Too many requests", 429);

  const [unread, items] = await Promise.all([countUnreadNotifications(user.id), getNotifications(user.id)]);
  return ok({ unread, items });
}

const idsSchema = z.array(z.uuid()).max(50);

/** Marks the given notifications, or all of them when `ids` is omitted, as read. */
export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult<{ unread: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = idsSchema.optional().safeParse(ids);
  if (!parsed.success) return fail("Invalid request", 400);

  await db.notification.updateMany({
    where: { userId: user.id, isRead: false, ...(parsed.data ? { id: { in: parsed.data } } : {}) },
    data: { isRead: true },
  });
  return ok({ unread: await countUnreadNotifications(user.id) });
}
