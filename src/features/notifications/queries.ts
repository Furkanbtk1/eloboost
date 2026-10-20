import "server-only";

import { z } from "zod";

import { OrderStatus, type NotificationType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Known payload fields; anything else in `data` is ignored. */
const dataSchema = z.object({
  orderNumber: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  event: z.string().optional().catch(undefined),
  from: z.string().nullish().catch(undefined),
  amount: z.number().optional().catch(undefined),
});

export type NotificationItem = {
  id: string;
  type: NotificationType;
  /** Locale-free path, e.g. "/dashboard/orders/ELO-123456". */
  link: string | null;
  isRead: boolean;
  createdAt: Date;
  orderNumber: string | null;
  /** Order status for ORDER_UPDATE, payout / dispute status otherwise. */
  orderStatus: OrderStatus | null;
  status: string | null;
  event: string | null;
  from: string | null;
  amount: number | null;
};

const orderStatuses = new Set<string>(Object.values(OrderStatus));

export async function getNotifications(userId: string, take = 15): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, data: true, link: true, isRead: true, createdAt: true },
  });
  return rows.map((row) => {
    const data = dataSchema.safeParse(row.data).data ?? {};
    return {
      id: row.id,
      type: row.type,
      link: row.link?.startsWith("/") ? row.link : null,
      isRead: row.isRead,
      createdAt: row.createdAt,
      orderNumber: data.orderNumber ?? null,
      orderStatus:
        row.type === "ORDER_UPDATE" && data.status && orderStatuses.has(data.status) ? (data.status as OrderStatus) : null,
      status: data.status ?? null,
      event: data.event ?? null,
      from: data.from ?? null,
      amount: data.amount ?? null,
    };
  });
}

export function countUnreadNotifications(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, isRead: false } });
}
