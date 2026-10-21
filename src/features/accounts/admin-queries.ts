import "server-only";

import type { AccountKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type AdminProductRow = {
  id: string;
  gameName: string;
  kind: AccountKind;
  serverCode: string;
  tier: string;
  level: number | null;
  championCount: number;
  hasMailAccess: boolean;
  price: number;
  isActive: boolean;
  available: number;
  sold: number;
};

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.accountProduct.findMany({
    orderBy: [{ game: { sortOrder: "asc" } }, { kind: "asc" }, { serverCode: "asc" }, { price: "asc" }],
    include: {
      game: { select: { name: true } },
      _count: { select: { stock: true } },
    },
  });
  const available = await db.accountStock.groupBy({ by: ["productId"], where: { orderId: null }, _count: { _all: true } });
  const availableBy = new Map(available.map((row) => [row.productId, row._count._all]));

  return rows.map((row) => ({
    id: row.id,
    gameName: row.game.name,
    kind: row.kind,
    serverCode: row.serverCode,
    tier: row.tier,
    level: row.level,
    championCount: row.championCount,
    hasMailAccess: row.hasMailAccess,
    price: row.price.toNumber(),
    isActive: row.isActive,
    available: availableBy.get(row.id) ?? 0,
    sold: row._count.stock - (availableBy.get(row.id) ?? 0),
  }));
}

/** Games with their servers, for the "new product" form. */
export function listGamesWithServers() {
  return db.game.findMany({
    where: { status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, servers: { orderBy: { sortOrder: "asc" }, select: { code: true, name: true } } },
  });
}
