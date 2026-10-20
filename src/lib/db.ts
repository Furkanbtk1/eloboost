import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

function createPrismaClient() {
  // node-postgres pool per app instance; in deployment DATABASE_URL points at
  // PgBouncer, so many instances still share a small number of DB connections.
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
  });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type Client = ReturnType<typeof createPrismaClient>;

// Reuse one client across hot reloads in development. After `prisma generate`
// the reload brings a new PrismaClient class, so the stale client is replaced
// instead of rejecting new enum values or fields until a restart.
const globalForPrisma = globalThis as unknown as { prisma?: Client; prismaClass?: typeof PrismaClient };

const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
if (!cached && globalForPrisma.prisma) void globalForPrisma.prisma.$disconnect();

export const db = cached ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}
