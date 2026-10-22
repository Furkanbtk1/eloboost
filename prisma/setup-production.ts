/**
 * Production bootstrap. Safe to re-run: adds missing games, upserts platform settings and
 * creates the first admin. It never truncates and never creates demo users, orders or promo codes.
 *
 * Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run db:setup-production
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

import { GAMES } from "./seed-data/catalog";
import { createGame } from "./seed-data/create-game";

const BOOSTER_SHARE = 0.6;
const MIN_PAYOUT_USD = 50;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function addGames() {
  const existing = new Set((await prisma.game.findMany({ select: { slug: true } })).map((game) => game.slug));
  let sortOrder = await prisma.game.count();
  for (const game of GAMES) {
    if (existing.has(game.slug)) continue;
    await createGame(prisma, game, sortOrder++);
    console.log(`added ${game.name}`);
  }
}

async function upsertSettings() {
  const settings: Record<string, unknown> = {
    booster_commission_rate: BOOSTER_SHARE,
    min_payout_amount_usd: MIN_PAYOUT_USD,
    default_currency: "USD",
    supported_currencies: ["USD", "EUR", "GBP", "TRY"],
    fallback_exchange_rates_usd: { USD: 1, EUR: 1.08, GBP: 1.27, TRY: 0.029 },
  };
  for (const [key, value] of Object.entries(settings)) {
    // Existing values win: an admin may already have tuned them.
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: value as never } });
  }
}

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: skipped admin creation.");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.log(`${email} already exists: left untouched.`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
    },
  });
  console.log(`admin created: ${email} (enable 2FA at first login)`);
}

async function main() {
  await addGames();
  await upsertSettings();
  await createAdmin();
  console.log(`done: ${await prisma.game.count()} games.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
