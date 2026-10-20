"use server";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/auth";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";

import { EDITABLE_STATUSES } from "./workflow";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

const detailsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  /** Empty = keep the saved password. */
  password: z.string().max(128),
  notes: z.string().trim().max(500),
});

export type OrderDetailsInput = z.input<typeof detailsSchema>;

/**
 * Saves the game login (AES-256-GCM, bound to the order id) and notes for the
 * booster. The password is write-only: it is never sent back to the browser.
 */
export async function saveOrderDetailsAction(
  rawLocale: string,
  orderNumber: string,
  input: unknown,
): Promise<ActionResult> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Orders.errors" });

  const session = await auth();
  const customer = session?.user?.id
    ? await db.user.findFirst({ where: { id: session.user.id, role: "CUSTOMER", isBanned: false }, select: { id: true } })
    : null;
  if (!customer) return fail(t("unauthorized"), 401);

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, t("invalid"));
  const { username, password, notes } = parsed.data;

  const limit = await rateLimit("saveCredentials", customer.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const order = await db.order.findFirst({
    where: { orderNumber, customerId: customer.id },
    select: { id: true, status: true, accountPassword: true, boosterId: true },
  });
  if (!order) return fail(t("notFound"), 404);
  // Unpaid orders don't store logins; finished ones have them wiped.
  if (!(EDITABLE_STATUSES as readonly string[]).includes(order.status)) return fail(t("notEditable"), 409);
  if (!password && !order.accountPassword) {
    return fail(t("passwordRequired"), 400, { password: [t("passwordRequired")] });
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      accountUsername: encrypt(username, order.id),
      ...(password ? { accountPassword: encrypt(password, order.id) } : {}),
      notes: notes || null,
    },
  });

  if (order.boosterId) {
    await db.notification.create({
      data: {
        userId: order.boosterId,
        type: "ORDER_UPDATE",
        data: { orderNumber, event: "details_updated" },
        link: `/booster/orders/${orderNumber}`,
      },
    });
  }
  broadcast(signal.orderUpdated(orderNumber), ...(order.boosterId ? [signal.notification(order.boosterId)] : []));
  return ok(undefined);
}
