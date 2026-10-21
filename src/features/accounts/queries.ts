import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { AccountKind } from "@/generated/prisma/enums";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

/** Invalidated when stock changes or products are edited. */
export const ACCOUNTS_CACHE_TAG = "accounts";

export type ShopProduct = {
  id: string;
  gameSlug: string;
  kind: AccountKind;
  serverCode: string;
  tier: string;
  level: number | null;
  championCount: number;
  hasMailAccess: boolean;
  price: number;
  stock: number;
};

export type ShopServer = { gameSlug: string; kind: AccountKind; code: string; name: string; stock: number; fromPrice: number | null };

export type ShopCatalog = {
  products: ShopProduct[];
  /** Servers of games that sell accounts, with their total stock and cheapest price. */
  servers: ShopServer[];
  games: { slug: string; name: string }[];
};

/** Everything the shop section needs; public and cached (the real stock check happens at purchase). */
export async function getShopCatalog(): Promise<ShopCatalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ACCOUNTS_CACHE_TAG);

  const rows = await db.accountProduct.findMany({
    where: { isActive: true, game: { status: "ACTIVE" } },
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    include: {
      game: { select: { slug: true, name: true, servers: { select: { code: true, name: true } } } },
      _count: { select: { stock: { where: { orderId: null } } } },
    },
  });

  const products = rows.map<ShopProduct>((row) => ({
    id: row.id,
    gameSlug: row.game.slug,
    kind: row.kind,
    serverCode: row.serverCode,
    tier: row.tier,
    level: row.level,
    championCount: row.championCount,
    hasMailAccess: row.hasMailAccess,
    price: row.price.toNumber(),
    stock: row._count.stock,
  }));

  const serverNames = new Map(rows.flatMap((row) => row.game.servers.map((server) => [`${row.game.slug}:${server.code}`, server.name] as const)));
  const servers = new Map<string, ShopServer>();
  for (const product of products) {
    const key = `${product.gameSlug}:${product.kind}:${product.serverCode}`;
    const current = servers.get(key) ?? {
      gameSlug: product.gameSlug,
      kind: product.kind,
      code: product.serverCode,
      name: serverNames.get(`${product.gameSlug}:${product.serverCode}`) ?? product.serverCode,
      stock: 0,
      fromPrice: null,
    };
    current.stock += product.stock;
    if (product.stock > 0) current.fromPrice = current.fromPrice === null ? product.price : Math.min(current.fromPrice, product.price);
    servers.set(key, current);
  }

  return {
    products,
    servers: [...servers.values()],
    games: [...new Map(rows.map((row) => [row.game.slug, { slug: row.game.slug, name: row.game.name }])).values()],
  };
}

export type DeliveredAccount = {
  tier: string;
  serverCode: string;
  championCount: number;
  hasMailAccess: boolean;
  username: string;
  password: string;
  email: string | null;
  emailPassword: string | null;
};

type StoredCredentials = { username: string; password: string; email?: string; emailPassword?: string };

export const credentialContext = (stockId: string) => `account-stock:${stockId}`;

/** The account delivered for this order, only for its customer. */
export async function getDeliveredAccount(orderNumber: string, customerId: string): Promise<DeliveredAccount | null> {
  const stock = await db.accountStock.findFirst({
    where: { order: { orderNumber, customerId, status: "COMPLETED" } },
    include: { product: true },
  });
  if (!stock) return null;
  const credentials = JSON.parse(decrypt(stock.credentials, credentialContext(stock.id))) as StoredCredentials;
  return {
    tier: stock.product.tier,
    serverCode: stock.product.serverCode,
    championCount: stock.product.championCount,
    hasMailAccess: stock.product.hasMailAccess,
    username: credentials.username,
    password: credentials.password,
    email: credentials.email ?? null,
    emailPassword: credentials.emailPassword ?? null,
  };
}
