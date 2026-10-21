import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("src/lib/env.ts holds server secrets and must not be imported in the browser.");
}

const base64Key32 = z
  .string()
  .refine((value) => Buffer.from(value, "base64").length === 32, {
    message: "must be 32 random bytes encoded as base64",
  });

/** Empty strings count as "not set", so blank lines in .env don't enable a feature. */
const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const booleanFlag = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === "true"));

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    ENCRYPTION_KEY: base64Key32,
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

    AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    // OAuth providers are enabled only when both values are present.
    AUTH_DISCORD_ID: optional,
    AUTH_DISCORD_SECRET: optional,
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    AUTH_TWITCH_ID: optional,
    AUTH_TWITCH_SECRET: optional,
    /** Staff and booster accounts must enable 2FA before using their panels. */
    REQUIRE_STAFF_2FA: booleanFlag(true),

    // Upstash Redis (rate limiting, caching). Falls back to in-memory when unset.
    UPSTASH_REDIS_REST_URL: optional,
    UPSTASH_REDIS_REST_TOKEN: optional,

    // Payment providers: each is offered only when all of its values are set.
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    COINBASE_COMMERCE_API_KEY: optional,
    COINBASE_COMMERCE_WEBHOOK_SECRET: optional,
    /** Simulated "test payment" method. Never offered when NODE_ENV is production. */
    PAYMENTS_SANDBOX: booleanFlag(true),

    // Transactional email (Resend). Without a key, links are printed to the server console in
    // development and emails are skipped (with a warning) in production.
    RESEND_API_KEY: optional,
    /** Verified sender, e.g. "EloBoost <no-reply@yourdomain.com>". */
    EMAIL_FROM: z.string().default("EloBoost <onboarding@resend.dev>"),

    // Realtime (Pusher, or Soketi locally). Without it, chat and live updates need a page refresh.
    PUSHER_APP_ID: optional,
    PUSHER_KEY: optional,
    PUSHER_SECRET: optional,
    PUSHER_CLUSTER: z.string().default("mt1"),
    /** Self-hosted (Soketi) only; leave empty for Pusher. Used by the server and the browser. */
    PUSHER_HOST: optional,
    PUSHER_PORT: optional.transform((value) => (value ? Number(value) : undefined)).pipe(z.number().int().positive().optional()),
    PUSHER_USE_TLS: booleanFlag(true),

    // S3-compatible storage for chat attachments (RustFS locally, R2 / S3 in production).
    // Uploads are turned off when unset.
    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    /** Needed by RustFS / MinIO; R2 and S3 work with virtual-hosted URLs. */
    S3_FORCE_PATH_STYLE: booleanFlag(false),
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example.`);
  }
  return result.data;
}

export const env = parseEnv();
