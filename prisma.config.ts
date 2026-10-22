import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // The CLI (migrate, studio) bypasses PgBouncer and talks to Postgres directly.
  // The application runtime uses DATABASE_URL through the driver adapter.
  // `prisma generate` (run by postinstall on CI/Vercel) never connects, so the URL must not be
  // required there; the placeholder only makes a missing value fail loudly in migrate.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://missing-database-url",
  },
});
