/**
 * DEMO DATA for local development: a few account-shop products with fake logins
 * ("demo_*"), so the shop can be tried end to end. Safe to re-run (skips what exists).
 * Never run it against production: real stock is added from /admin/accounts.
 * Usage: npm run db:add-demo-accounts
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { encrypt } from "../src/lib/crypto";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to add demo accounts in production.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Demo = { game: string; kind: "ACCOUNT" | "SMURF"; servers: string[]; tier: string; level: number; champions: number; mail: boolean; price: number; stock: number };

const DEMOS: Demo[] = [
  { game: "league-of-legends", kind: "ACCOUNT", servers: ["TR", "EUW", "NA"], tier: "Hand-Leveled Rookie", level: 30, champions: 20, mail: false, price: 8, stock: 4 },
  { game: "league-of-legends", kind: "ACCOUNT", servers: ["TR", "EUW", "NA"], tier: "Advanced", level: 30, champions: 60, mail: true, price: 16, stock: 3 },
  { game: "league-of-legends", kind: "ACCOUNT", servers: ["TR", "EUW", "NA"], tier: "Superior", level: 30, champions: 120, mail: true, price: 29, stock: 2 },
  { game: "league-of-legends", kind: "SMURF", servers: ["EUW", "NA"], tier: "Ranked-Ready Smurf", level: 30, champions: 40, mail: true, price: 12, stock: 3 },
  { game: "valorant", kind: "ACCOUNT", servers: ["EU"], tier: "Unranked Starter", level: 20, champions: 12, mail: true, price: 10, stock: 3 },
];

async function main() {
  for (const demo of DEMOS) {
    const game = await prisma.game.findUnique({ where: { slug: demo.game }, select: { id: true, servers: { select: { code: true } } } });
    if (!game) continue;
    for (const [serverIndex, serverCode] of demo.servers.entries()) {
      if (!game.servers.some((server) => server.code === serverCode)) continue;
      const existing = await prisma.accountProduct.findFirst({ where: { gameId: game.id, kind: demo.kind, serverCode, tier: demo.tier } });
      const product =
        existing ??
        (await prisma.accountProduct.create({
          data: {
            gameId: game.id,
            kind: demo.kind,
            serverCode,
            tier: demo.tier,
            level: demo.level,
            championCount: demo.champions,
            hasMailAccess: demo.mail,
            // A little spread between servers, like real price lists.
            price: demo.price + serverIndex * 2,
            sortOrder: Math.round(demo.price),
          },
        }));
      if ((await prisma.accountStock.count({ where: { productId: product.id } })) > 0) continue;
      for (let n = 1; n <= demo.stock; n++) {
        const id = randomUUID();
        const credentials = {
          username: `demo_${serverCode.toLowerCase()}_${demo.tier.replace(/\W+/g, "").toLowerCase()}_${n}`,
          password: `Demo-pass-${n}${serverCode}`,
          ...(demo.mail ? { email: `demo${n}.${serverCode.toLowerCase()}@example.test`, emailPassword: `Mail-pass-${n}` } : {}),
        };
        await prisma.accountStock.create({ data: { id, productId: product.id, credentials: encrypt(JSON.stringify(credentials), `account-stock:${id}`) } });
      }
      console.log(`${demo.game} ${serverCode} ${demo.tier}: ${demo.stock} demo accounts`);
    }
  }
}

main().finally(() => prisma.$disconnect());
