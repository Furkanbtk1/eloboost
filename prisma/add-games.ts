/**
 * Adds catalog games that are missing from an existing database (matched by slug)
 * without touching anything else: no truncate, no user data. Usage: npm run db:add-games
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import { GAMES } from "./seed-data/catalog";
import { createGame } from "./seed-data/create-game";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const existing = new Set((await prisma.game.findMany({ select: { slug: true } })).map((game) => game.slug));
  let sortOrder = await prisma.game.count();
  for (const game of GAMES) {
    if (existing.has(game.slug)) continue;
    await createGame(prisma, game, sortOrder++);
    console.log(`added ${game.name}`);
  }
  console.log("games up to date");
}

main().finally(() => prisma.$disconnect());
