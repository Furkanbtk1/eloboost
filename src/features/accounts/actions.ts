"use server";

import { randomInt } from "node:crypto";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** "Buy now": prices come from the database, never from the browser. Payment happens at checkout. */
export async function buyAccountAction(rawLocale: string, rawProductId: string): Promise<ActionResult<{ redirectTo: string }>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Shop.errors" });

  const user = await getCurrentUser();
  if (!user) return fail(t("signInRequired"), 401);
  if (user.role !== "CUSTOMER") return fail(t("customersOnly"), 403);
  if (!z.uuid().safeParse(rawProductId).success) return fail(t("unavailable"), 404);

  const limit = await rateLimit("createOrder", user.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const product = await db.accountProduct.findFirst({
    where: { id: rawProductId, isActive: true, game: { status: "ACTIVE" } },
    include: { game: { select: { id: true } }, _count: { select: { stock: { where: { orderId: null } } } } },
  });
  if (!product) return fail(t("unavailable"), 404);
  if (product._count.stock === 0) return fail(t("soldOut"), 409);

  const server = await db.gameServer.findFirst({ where: { gameId: product.gameId, code: product.serverCode }, select: { region: true } });
  const total = product.price.toFixed(2);

  for (let attempt = 0; ; attempt++) {
    const orderNumber = `ELO-${randomInt(100_000, 1_000_000)}`;
    try {
      await db.order.create({
        data: {
          orderNumber,
          customerId: user.id,
          gameId: product.gameId,
          orderType: "ACCOUNT",
          startRank: {},
          desiredRank: {},
          server: product.serverCode,
          region: server?.region ?? "",
          subtotal: total,
          discountAmount: 0,
          totalAmount: total,
          // No booster works on a shop account: the whole price is the platform's.
          boosterCutAmount: 0,
          platformCutAmount: total,
          currency: "USD",
          exchangeRate: 1,
          status: "AWAITING_PAYMENT",
          extraOptions: {
            accountProductId: product.id,
            kind: product.kind,
            tier: product.tier,
            championCount: product.championCount,
            hasMailAccess: product.hasMailAccess,
          },
        },
      });
      return ok({ redirectTo: getPathname({ href: `/checkout/${orderNumber}`, locale }) });
    } catch (error) {
      const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!collision || attempt >= 4) throw error;
    }
  }
}
