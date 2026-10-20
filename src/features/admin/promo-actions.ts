"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { DiscountType } from "@/generated/prisma/enums";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";

import { adminErrors, getStaffActor, writeAudit } from "./server";

const PATH = "/admin/promos";

const promoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/)),
    discountType: z.enum(DiscountType),
    discountValue: z.number().positive(),
    maxUses: z.number().int().min(1).max(1_000_000).nullable(),
    /** "YYYY-MM-DD": valid through the end of that day (UTC). */
    expiresOn: z.iso.date().nullable(),
    minOrderAmount: z.number().min(0).max(100_000).nullable(),
  })
  .refine((promo) => (promo.discountType === "PERCENTAGE" ? promo.discountValue <= 90 : promo.discountValue <= 1000), {
    path: ["discountValue"],
  });

export type PromoInput = z.input<typeof promoSchema>;

export async function createPromoAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(t("invalid"), 400, typeof field === "string" ? { [field]: [t("invalid")] } : undefined);
  }
  const promo = parsed.data;
  const expiresAt = promo.expiresOn ? new Date(`${promo.expiresOn}T23:59:59.999Z`) : null;
  if (expiresAt && expiresAt <= new Date()) return fail(t("pastDate"), 400, { expiresOn: [t("pastDate")] });

  try {
    await db.$transaction(async (tx) => {
      const created = await tx.promoCode.create({
        data: {
          code: promo.code,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          maxUses: promo.maxUses,
          expiresAt,
          minOrderAmount: promo.minOrderAmount,
        },
      });
      await writeAudit(tx, {
        adminId: actor.id,
        action: "promo.create",
        targetType: "PromoCode",
        targetId: promo.code,
        details: { id: created.id, ...promo, expiresAt: expiresAt?.toISOString() ?? null },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(t("codeExists"), 409, { code: [t("codeExists")] });
    }
    throw error;
  }
  return ok(undefined);
}

export async function setPromoActiveAction(rawLocale: string, promoId: string, isActive: boolean): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(promoId).success) return fail(t("notFound"), 404);

  const updated = await db.$transaction(async (tx) => {
    const promo = await tx.promoCode.findUnique({ where: { id: promoId }, select: { code: true } });
    if (!promo) return false;
    await tx.promoCode.update({ where: { id: promoId }, data: { isActive: isActive === true } });
    await writeAudit(tx, {
      adminId: actor.id,
      action: isActive ? "promo.enable" : "promo.disable",
      targetType: "PromoCode",
      targetId: promo.code,
    });
    return true;
  });
  return updated ? ok(undefined) : fail(t("notFound"), 404);
}
