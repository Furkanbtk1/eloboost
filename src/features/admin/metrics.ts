import "server-only";

import type { OrderStatus, PayoutStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Figures for the admin overview. Money is USD (order totals × their checkout exchange rate). */
export type AdminMetrics = {
  revenue30d: number;
  platform30d: number;
  paidOrders30d: number;
  newCustomers30d: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  activeBoosters: number;
  pendingBoosters: number;
  openDisputes: number;
  flaggedMessages7d: number;
  payouts: Partial<Record<PayoutStatus, { count: number; amount: number }>>;
  paidOut30d: number;
  /** What boosters could still request: the sum of their wallet balances. */
  boosterBalances: number;
  /** Last 14 days, oldest first (UTC days). */
  dailyRevenue: { day: string; amount: number; orders: number }[];
};

type Decimalish = { toNumber(): number } | number | string | null;
const num = (value: Decimalish) =>
  value === null ? 0 : typeof value === "object" ? value.toNumber() : Number(value);

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [windows, daily, statuses, boosters, openDisputes, payoutGroups, balances] = await Promise.all([
    db.$queryRaw<
      { revenue: Decimalish; platform: Decimalish; paid: bigint; customers: bigint; flagged: bigint; paidOut: Decimalish }[]
    >`
      SELECT
        (SELECT COALESCE(SUM("totalAmount" * "exchangeRate"), 0) FROM "Order" WHERE "paidAt" >= now() - interval '30 days') AS revenue,
        (SELECT COALESCE(SUM("platformCutAmount" * "exchangeRate"), 0) FROM "Order" WHERE "paidAt" >= now() - interval '30 days') AS platform,
        (SELECT COUNT(*) FROM "Order" WHERE "paidAt" >= now() - interval '30 days') AS paid,
        (SELECT COUNT(*) FROM "User" WHERE "role" = 'CUSTOMER' AND "createdAt" >= now() - interval '30 days') AS customers,
        (SELECT COUNT(*) FROM "Message" WHERE "isFlagged" AND "createdAt" >= now() - interval '7 days') AS flagged,
        (SELECT COALESCE(SUM("amount"), 0) FROM "PayoutRequest" WHERE "status" = 'PAID' AND "reviewedAt" >= now() - interval '30 days') AS "paidOut"`,
    db.$queryRaw<{ day: string; amount: Decimalish; orders: bigint }[]>`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(o."totalAmount" * o."exchangeRate"), 0) AS amount,
             COUNT(o."id") AS orders
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
      LEFT JOIN "Order" o ON date_trunc('day', o."paidAt") = d.day
      GROUP BY d.day
      ORDER BY d.day`,
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.boosterProfile.groupBy({ by: ["status"], _count: { _all: true } }),
    db.dispute.count({ where: { status: "OPEN" } }),
    db.payoutRequest.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
    db.user.aggregate({ where: { role: "BOOSTER" }, _sum: { balance: true } }),
  ]);

  const window = windows[0];
  return {
    revenue30d: num(window.revenue),
    platform30d: num(window.platform),
    paidOrders30d: Number(window.paid),
    newCustomers30d: Number(window.customers),
    flaggedMessages7d: Number(window.flagged),
    paidOut30d: num(window.paidOut),
    ordersByStatus: Object.fromEntries(statuses.map((row) => [row.status, row._count._all])),
    activeBoosters: boosters.find((row) => row.status === "ACTIVE")?._count._all ?? 0,
    pendingBoosters: boosters.find((row) => row.status === "PENDING_APPROVAL")?._count._all ?? 0,
    openDisputes,
    payouts: Object.fromEntries(
      payoutGroups.map((row) => [row.status, { count: row._count._all, amount: num(row._sum.amount) }]),
    ),
    boosterBalances: num(balances._sum.balance),
    dailyRevenue: daily.map((row) => ({ day: row.day, amount: num(row.amount), orders: Number(row.orders) })),
  };
}

export type AuditEntryRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
  admin: string;
};

export async function getAuditLog(take: number, action?: string): Promise<AuditEntryRow[]> {
  const rows = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: { admin: { select: { name: true, email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    details: row.details,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    admin: row.admin.name ?? row.admin.email,
  }));
}
