import "server-only";

import { Secret, TOTP } from "otpauth";

import { decrypt, encrypt } from "@/lib/crypto";

const ISSUER = "EloBoost";

function createTotp(secretBase32: string, label = "") {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

/** otpauth:// URI that authenticator apps read from the QR code. */
export function totpUri(secretBase32: string, accountLabel: string): string {
  return createTotp(secretBase32, accountLabel).toString();
}

/** Accepts the current code and one 30-second step either side (clock drift). */
export function verifyTotp(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return createTotp(secretBase32).validate({ token: code, window: 1 }) !== null;
}

// The secret is stored encrypted and bound to its user id.
export const sealTotpSecret = (secretBase32: string, userId: string) => encrypt(secretBase32, userId);
export const openTotpSecret = (sealed: string, userId: string) => decrypt(sealed, userId);
