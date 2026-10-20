import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // The CLI (migrate, studio) bypasses PgBouncer and talks to Postgres directly.
  // The application runtime uses DATABASE_URL through the driver adapter.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
