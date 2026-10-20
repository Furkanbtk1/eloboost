import "server-only";

import type { PromoTerms } from "@/features/pricing/engine";
import { db } from "@/lib/db";

/**
 * Looks up a promo code that can be used right now. Usage is counted when the
 * order is paid (Sprint 4), so unpaid orders don't burn a limited code.
 */
export async function findUsablePromo(code: string): Promise<{ id: string; terms: PromoTerms } | null> {
  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.isActive) return null;
  if (promo.expiresAt && promo.expiresAt <= new Date()) return null;
  if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) return null;

  return {
    id: promo.id,
    terms: {
      code: promo.code,
      discountType: promo.discountType,
      // PERCENTAGE: 10.00% -> 1000 bp; FIXED: $5.00 -> 500 cents
      value: promo.discountValue.times(100).toNumber(),
      minSubtotalCents: promo.minOrderAmount ? promo.minOrderAmount.times(100).toNumber() : null,
    },
  };
}
