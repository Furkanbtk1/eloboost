import "server-only";

import { hashSecret, newEmailToken } from "@/lib/auth/secrets";
import { db } from "@/lib/db";

export const RESET_TTL_MS = 60 * 60 * 1000;
export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export const resetIdentifier = (userId: string) => `reset:${userId}`;
export const verifyIdentifier = (userId: string) => `verify:${userId}`;

/** Replaces any older link for the same purpose; returns the value to email. */
export async function issueEmailToken(identifier: string, ttlMs: number): Promise<string> {
  const raw = newEmailToken();
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier } }),
    db.verificationToken.create({ data: { identifier, token: hashSecret(raw), expires: new Date(Date.now() + ttlMs) } }),
  ]);
  return raw;
}

/**
 * Spends a link: it is deleted first, so a second click (or an email scanner
 * that opened it) can't reuse it. Returns the user id when it was valid.
 */
export async function consumeEmailToken(prefix: "reset" | "verify", raw: string): Promise<string | null> {
  if (raw.length < 20 || raw.length > 100) return null;
  const token = hashSecret(raw);
  const row = await db.verificationToken.findUnique({ where: { token } });
  if (!row) return null;
  const { count } = await db.verificationToken.deleteMany({ where: { token } });
  if (count !== 1 || row.expires <= new Date() || !row.identifier.startsWith(`${prefix}:`)) return null;
  return row.identifier.slice(prefix.length + 1);
}
