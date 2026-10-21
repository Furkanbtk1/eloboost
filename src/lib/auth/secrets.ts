import { createHash, randomBytes, randomInt } from "node:crypto";

/** Pure helpers for email tokens and 2FA recovery codes (unit tested). */

export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");

/** 256-bit URL-safe value for email links; only its hash is stored. */
export const newEmailToken = () => randomBytes(32).toString("base64url");

// No 0/o/1/l/i: codes are read off a screen and typed by hand.
const BACKUP_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const BACKUP_CODE_COUNT = 8;

/** "k3m9x-q7w2a": 10 characters (~50 bits), shown once. */
export function newBackupCode(): string {
  const chars = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

const BACKUP_FORMAT = /^[a-z0-9]{5}[\s-]?[a-z0-9]{5}$/i;

export const looksLikeBackupCode = (value: string) => BACKUP_FORMAT.test(value.trim());

/** Case, spaces and the dash don't matter when typing a code. */
export const normalizeBackupCode = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const hashBackupCode = (value: string) => hashSecret(normalizeBackupCode(value));
