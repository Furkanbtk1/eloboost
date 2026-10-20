import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { UserRole, type BoosterStatus, type Currency, type OrderStatus, type TransactionStatus, type TransactionType } from "@/generated/prisma/enums";
import { boosterRanksSchema, type RankSnapshot } from "@/features/orders/workflow";
import { db } from "@/lib/db";

export const USERS_PAGE_SIZE = 25;

export const userFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  role: z.enum(UserRole).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type UserFilters = z.infer<typeof userFiltersSchema>;

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isBanned: boolean;
  is2FAEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  boosterStatus: BoosterStatus | null;
};

export async function listUsers(filters: UserFilters): Promise<{ rows: AdminUserRow[]; total: number }> {
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.q
      ? {
          OR: [
            { email: { contains: filters.q, mode: "insensitive" } },
            { name: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBanned: true,
        is2FAEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        boosterProfile: { select: { status: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    rows: rows.map(({ boosterProfile, ...row }) => ({ ...row, boosterStatus: boosterProfile?.status ?? null })),
    total,
  };
}

/** Booster accounts waiting for approval, oldest first. */
export async function listBoosterApplications() {
  return db.user.findMany({
    where: { role: "BOOSTER", boosterProfile: { status: "PENDING_APPROVAL" } },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export type AdminUserDetail = AdminUserRow & {
  balance: number;
  hasPassword: boolean;
  booster: {
    status: BoosterStatus;
    gameSlugs: string[];
    ranks: Record<string, RankSnapshot>;
    completedOrders: number;
    rating: number;
    ratingCount: number;
    totalEarnings: number;
    bio: string | null;
  } | null;
  orders: { orderNumber: string; status: OrderStatus; role: "customer" | "booster"; createdAt: Date }[];
  transactions: {
    id: string;
    type: TransactionType;
    amount: number;
    currency: Currency;
    status: TransactionStatus;
    createdAt: Date;
  }[];
};

export async function getAdminUser(id: string): Promise<AdminUserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      boosterProfile: { include: { acceptedGames: { select: { slug: true } } } },
      customerOrders: { orderBy: { createdAt: "desc" }, take: 10, select: { orderNumber: true, status: true, createdAt: true } },
      boosterOrders: { orderBy: { createdAt: "desc" }, take: 10, select: { orderNumber: true, status: true, createdAt: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, type: true, amount: true, currency: true, status: true, createdAt: true },
      },
    },
  });
  if (!user) return null;
  const profile = user.boosterProfile;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isBanned: user.isBanned,
    is2FAEnabled: user.is2FAEnabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    boosterStatus: profile?.status ?? null,
    balance: user.balance.toNumber(),
    hasPassword: user.passwordHash !== null,
    booster: profile
      ? {
          status: profile.status,
          gameSlugs: profile.acceptedGames.map((game) => game.slug),
          ranks: boosterRanksSchema.safeParse(profile.currentRanks).data ?? {},
          completedOrders: profile.completedOrders,
          rating: profile.rating.toNumber(),
          ratingCount: profile.ratingCount,
          totalEarnings: profile.totalEarnings.toNumber(),
          bio: profile.bio,
        }
      : null,
    orders: [
      ...user.customerOrders.map((order) => ({ ...order, role: "customer" as const })),
      ...user.boosterOrders.map((order) => ({ ...order, role: "booster" as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    transactions: user.transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toNumber(),
    })),
  };
}
