import { z } from "zod";

/** Where a booster's payouts go. Stored encrypted; pure so it can be unit tested. */

export const CRYPTO_NETWORKS = ["USDT_TRC20", "USDT_ERC20", "BTC", "ETH"] as const;

/** ISO 13616 check: move the first four characters to the end, letters to numbers, mod 97 must be 1. */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export const payoutDetailsSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("CRYPTO"),
    network: z.enum(CRYPTO_NETWORKS),
    address: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{25,100}$/),
  }),
  z.object({
    method: z.literal("BANK_TRANSFER"),
    accountHolder: z.string().trim().min(2).max(100),
    iban: z
      .string()
      .transform((value) => value.replace(/\s+/g, "").toUpperCase())
      .refine(isValidIban),
  }),
]);

export type PayoutDetails = z.infer<typeof payoutDetailsSchema>;

/** Safe to show on screen: "USDT_TRC20 · TXabc…wxyz" / "TR33 **** 1326". */
export function maskPayoutDetails(details: PayoutDetails): string {
  if (details.method === "CRYPTO") {
    return `${details.network} · ${details.address.slice(0, 5)}…${details.address.slice(-4)}`;
  }
  return `${details.iban.slice(0, 4)} **** ${details.iban.slice(-4)}`;
}

/** Full destination for the finance team, IBAN grouped in fours. */
export function formatPayoutDetails(details: PayoutDetails): string {
  if (details.method === "CRYPTO") return `${details.network}: ${details.address}`;
  return `${details.accountHolder} · ${details.iban.replace(/(.{4})/g, "$1 ").trim()}`;
}

/** Encryption context: details can't be moved to another booster's row. */
export const payoutContext = (boosterId: string) => `payout:${boosterId}`;

/** Amounts are USD with at most two decimals. */
export const payoutAmountSchema = z
  .number()
  .positive()
  .max(1_000_000)
  // Float-tolerant: 0.29 * 100 is 28.999999999999996.
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6);
