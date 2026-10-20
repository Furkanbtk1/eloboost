import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Field-level encryption for secrets stored in the database (game account
 * credentials, 2FA secrets, payout details).
 *
 * AES-256-GCM with a random 96-bit IV per value. Output format:
 *   v1:<iv>:<authTag>:<ciphertext>   (base64url parts)
 *
 * The version prefix leaves room for key rotation. Pass `context` (e.g. the
 * order id) to bind a ciphertext to its record: copying it into another row
 * makes decryption fail instead of leaking the value.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION = "v1";

const key = Buffer.from(env.ENCRYPTION_KEY, "base64");

export function encrypt(plaintext: string, context?: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  if (context) cipher.setAAD(Buffer.from(context, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decrypt(payload: string, context?: string): string {
  const [version, iv, authTag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !authTag || !ciphertext) {
    throw new Error("Malformed encrypted payload");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  if (context) decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
