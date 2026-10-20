import "server-only";

import type { DisputeResolution, DisputeStatus, OrderStatus, UserRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type DisputeRow = {
  id: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  reason: string;
  adminNote: string | null;
  previousStatus: OrderStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  openedBy: { name: string; role: UserRole };
  resolvedBy: string | null;
  order: { orderNumber: string; status: OrderStatus; game: string };
};

const include = {
  openedBy: { select: { name: true, email: true, role: true } },
  resolvedBy: { select: { name: true, email: true } },
  order: { select: { orderNumber: true, status: true, game: { select: { name: true } } } },
} as const;

type Row = {
  id: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  reason: string;
  adminNote: string | null;
  previousStatus: OrderStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  openedBy: { name: string | null; email: string; role: UserRole };
  resolvedBy: { name: string | null; email: string } | null;
  order: { orderNumber: string; status: OrderStatus; game: { name: string } };
};

const toRow = (row: Row): DisputeRow => ({
  id: row.id,
  status: row.status,
  resolution: row.resolution,
  reason: row.reason,
  adminNote: row.adminNote,
  previousStatus: row.previousStatus,
  createdAt: row.createdAt,
  resolvedAt: row.resolvedAt,
  openedBy: { name: row.openedBy.name ?? row.openedBy.email, role: row.openedBy.role },
  resolvedBy: row.resolvedBy ? (row.resolvedBy.name ?? row.resolvedBy.email) : null,
  order: { orderNumber: row.order.orderNumber, status: row.order.status, game: row.order.game.name },
});

export async function listDisputes(status: DisputeStatus): Promise<DisputeRow[]> {
  const rows = await db.dispute.findMany({
    where: { status },
    orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
    take: 100,
    include,
  });
  return rows.map(toRow);
}

export async function getOrderDisputes(orderId: string): Promise<DisputeRow[]> {
  const rows = await db.dispute.findMany({ where: { orderId }, orderBy: { createdAt: "desc" }, include });
  return rows.map(toRow);
}

/** What the customer / booster sees while their order is frozen. */
export async function getOpenDispute(orderNumber: string): Promise<{ reason: string; createdAt: Date; byRole: UserRole } | null> {
  const dispute = await db.dispute.findFirst({
    where: { order: { orderNumber }, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { reason: true, createdAt: true, openedBy: { select: { role: true } } },
  });
  return dispute ? { reason: dispute.reason, createdAt: dispute.createdAt, byRole: dispute.openedBy.role } : null;
}
