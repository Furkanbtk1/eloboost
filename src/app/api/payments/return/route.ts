import { hasLocale } from "next-intl";

import { reconcileOrderPayments } from "@/features/payments/process";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { clientIpFrom } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Where providers send the customer after paying. Asks the provider about the
 * order's open payments (in case the webhook is late or blocked), then shows
 * the checkout page, or the order page for tips (`kind=tip`). It only reads
 * provider state, so it needs no session.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get("order") ?? "";
  const rawLocale = url.searchParams.get("locale") ?? "";
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const isTip = url.searchParams.get("kind") === "tip";

  const limit = await rateLimit("paymentReturn", clientIpFrom(request.headers));
  const order = /^ELO-\d{5,6}$/.test(orderNumber)
    ? await db.order.findUnique({ where: { orderNumber }, select: { id: true, status: true } })
    : null;

  if (order && limit.success && (isTip || order.status === "AWAITING_PAYMENT")) {
    await reconcileOrderPayments(order.id);
  }

  const path = !order
    ? getPathname({ href: "/dashboard", locale })
    : isTip
      ? getPathname({ href: { pathname: `/dashboard/orders/${orderNumber}`, query: { tip: "success" } }, locale })
      : getPathname({ href: { pathname: `/checkout/${orderNumber}`, query: { payment: "success" } }, locale });
  return Response.redirect(new URL(path, url), 303);
}
