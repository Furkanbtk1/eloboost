"use server";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getRequestCountry } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";

import { applyPaymentUpdate } from "./process";
import { sandboxEnabled } from "./providers/sandbox";
import { availableProviders, getProvider } from "./registry";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

const absolute = (path: string) => new URL(path, env.NEXT_PUBLIC_APP_URL).toString();

async function currentCustomer() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findFirst({
    where: { id: session.user.id, role: "CUSTOMER", isBanned: false },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
}

/** Creates a hosted payment with the chosen provider and returns where to send the customer. */
export async function startPaymentAction(
  rawLocale: string,
  orderNumber: string,
  providerId: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Payments.errors" });

  const customer = await currentCustomer();
  if (!customer) return fail(t("unauthorized"), 401);

  const limit = await rateLimit("startPayment", customer.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const order = await db.order.findFirst({
    where: { orderNumber, customerId: customer.id },
    include: { game: { select: { name: true } } },
  });
  if (!order) return fail(t("notFound"), 404);
  if (order.status !== "AWAITING_PAYMENT") return fail(t("alreadyPaid"), 409);

  // Offer check happens on the server too: a hidden method can't be forced.
  const provider = getProvider(providerId);
  if (!provider || !availableProviders(order.currency, await getRequestCountry()).includes(provider.id)) {
    return fail(t("unavailable"), 400);
  }

  const checkoutPath = getPathname({ href: `/checkout/${order.orderNumber}`, locale });
  const returnQuery = new URLSearchParams({ order: order.orderNumber, locale });
  const totalCents = order.totalAmount.times(100).toNumber();

  let created;
  try {
    created = await provider.createPayment({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents,
        currency: order.currency,
        description: order.game.name,
        customer,
      },
      successUrl: absolute(`/api/payments/return?${returnQuery}`),
      cancelUrl: absolute(`${checkoutPath}?payment=cancelled`),
      locale,
    });
  } catch (error) {
    console.error(`[payments] ${provider.id} createPayment failed for ${order.orderNumber}`, error);
    return fail(t("providerError"), 502);
  }

  await db.transaction.create({
    data: {
      orderId: order.id,
      userId: customer.id,
      type: "PAYMENT",
      amount: order.totalAmount,
      currency: order.currency,
      gateway: provider.gateway,
      gatewayTransactionId: created.reference,
      status: "PENDING",
    },
  });

  return ok({ redirectUrl: created.redirectUrl });
}

export type SandboxOutcome = "paid" | "failed" | "expired";

/** Development only: plays the provider and reports the chosen outcome. */
export async function sandboxPaymentAction(
  rawLocale: string,
  reference: string,
  outcome: SandboxOutcome,
): Promise<ActionResult<{ redirectTo: string }>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Payments.errors" });
  if (!sandboxEnabled) return fail(t("unavailable"), 404);

  const customer = await currentCustomer();
  if (!customer) return fail(t("unauthorized"), 401);

  const payment = await db.transaction.findFirst({
    where: { gateway: "SANDBOX", gatewayTransactionId: reference, userId: customer.id },
    include: { order: { select: { orderNumber: true, totalAmount: true, currency: true } } },
  });
  if (!payment?.order) return fail(t("notFound"), 404);

  await applyPaymentUpdate("SANDBOX", {
    reference,
    outcome,
    amountCents: payment.order.totalAmount.times(100).toNumber(),
    currency: payment.order.currency,
  });

  const checkoutPath = getPathname({ href: `/checkout/${payment.order.orderNumber}`, locale });
  const result = { paid: "success", failed: "failed", expired: "cancelled" }[outcome];
  return ok({ redirectTo: `${checkoutPath}?payment=${result}` });
}
