import "server-only";

import type { DiscountType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type AdminPromoRow = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  currentUses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  minOrderAmount: number | null;
  isActive: boolean;
  expired: boolean;
  usedUp: boolean;
};

export async function listPromos(): Promise<AdminPromoRow[]> {
  const promos = await db.promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const now = new Date();
  return promos.map((promo) => ({
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue.toNumber(),
    currentUses: promo.currentUses,
    maxUses: promo.maxUses,
    expiresAt: promo.expiresAt,
    minOrderAmount: promo.minOrderAmount?.toNumber() ?? null,
    isActive: promo.isActive,
    expired: promo.expiresAt !== null && promo.expiresAt <= now,
    usedUp: promo.maxUses !== null && promo.currentUses >= promo.maxUses,
  }));
}
