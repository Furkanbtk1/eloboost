"use server";

import { randomInt } from "node:crypto";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { getBoosterShareBp, getPricingCatalog } from "@/features/pricing/catalog";
import {
  applyPromo,
  calculateQuote,
  convertCents,
  stepLabel,
  type PricingCatalog,
  type PromoTerms,
} from "@/features/pricing/engine";
import { getExchangeRates } from "@/features/pricing/exchange-rates";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

import { findUsablePromo } from "./promo";
import { createOrderSchema, promoCodeSchema } from "./schemas";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** Smallest chargeable order (card providers reject tiny amounts; a 100% promo can't create a free order). */
const MIN_ORDER_USD_CENTS = 100;

const formatUsd = (cents: number, locale: AppLocale) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);

/** Snapshot stored on the order, readable even if the ladder changes later. */
function rankSnapshot(catalog: PricingCatalog, value: number): Prisma.InputJsonObject {
  if (catalog.rankSystem === "RATING") return { rating: value };
  const step = catalog.steps[value];
  return { position: value, label: step ? stepLabel(step) : String(value) };
}

/** Human-friendly unique reference such as ELO-482913. */
async function createWithOrderNumber(data: Omit<Prisma.OrderUncheckedCreateInput, "orderNumber">) {
  for (let attempt = 0; ; attempt++) {
    const orderNumber = `ELO-${randomInt(100_000, 1_000_000)}`;
    try {
      return await db.order.create({ data: { ...data, orderNumber }, select: { orderNumber: true } });
    } catch (error) {
      const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!collision || attempt >= 4) throw error;
    }
  }
}

export async function checkPromoAction(rawLocale: string, rawCode: string): Promise<ActionResult<PromoTerms>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Calculator.errors" });

  const limit = await rateLimit("promoCheck", await getClientIp());
  if (!limit.success) return fail(t("rateLimited"), 429);

  const code = promoCodeSchema.safeParse(rawCode);
  const promo = code.success ? await findUsablePromo(code.data) : null;
  return promo ? ok(promo.terms) : fail(t("promoInvalid"), 404);
}

export type CreateOrderResult = { orderNumber: string; redirectTo: string };

export async function createOrderAction(rawLocale: string, input: unknown): Promise<ActionResult<CreateOrderResult>> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Calculator.errors" });

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalidSelection"), 400);
  const { gameSlug, config, currency, promoCode, expectedTotalCents } = parsed.data;

  // Who is ordering --------------------------------------------------------
  const session = await auth();
  const customer = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, isBanned: true } })
    : null;
  if (!customer || customer.isBanned) return fail(t("signInRequired"), 401);
  if (customer.role !== "CUSTOMER") return fail(t("customersOnly"), 403);

  const limit = await rateLimit("createOrder", customer.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  // Price it again, from scratch, on the server -------------------------------
  const catalog = await getPricingCatalog(gameSlug);
  if (!catalog) return fail(t("gameUnavailable"), 404);

  const priced = calculateQuote(catalog, config);
  if (!priced.ok) return fail(t(`quote.${priced.error}`), 400);
  const { quote } = priced;

  const promo = promoCode ? await findUsablePromo(promoCode) : null;
  if (promoCode && !promo) return fail(t("promoInvalid"), 400);
  const discounted = applyPromo(quote.subtotalCents, promo?.terms ?? null);
  if (!discounted.ok) {
    return fail(t("promoMinAmount", { amount: formatUsd(discounted.minSubtotalCents, locale) }), 400);
  }
  if (discounted.totalCents < MIN_ORDER_USD_CENTS) {
    return fail(t("belowMinimum", { amount: formatUsd(MIN_ORDER_USD_CENTS, locale) }), 400);
  }

  const [rates, boosterShareBp, game] = await Promise.all([
    getExchangeRates(),
    getBoosterShareBp(),
    db.game.findUniqueOrThrow({ where: { slug: catalog.slug }, select: { id: true } }),
  ]);
  const usdPerUnit = rates[currency];
  const subtotal = convertCents(quote.subtotalCents, usdPerUnit);
  const total = convertCents(discounted.totalCents, usdPerUnit);

  // The browser computed the same price; a difference means stale data or tampering.
  if (total !== expectedTotalCents) return fail(t("priceChanged"), 409);

  const boosterCut = Math.round((total * boosterShareBp) / 10000);
  const server = catalog.servers.find((entry) => entry.code === config.server);
  const usesRanks = config.orderType !== "COACHING";
  const startRank = usesRanks ? rankSnapshot(catalog, config.current) : {};

  const order = await createWithOrderNumber({
    customerId: customer.id,
    gameId: game.id,
    orderType: config.orderType,
    startRank,
    desiredRank: config.orderType === "DIVISION" ? rankSnapshot(catalog, config.target) : startRank,
    quantity: config.orderType === "DIVISION" ? null : config.quantity,
    server: config.server,
    region: server?.region ?? "",
    subtotal: (subtotal / 100).toFixed(2),
    discountAmount: ((subtotal - total) / 100).toFixed(2),
    totalAmount: (total / 100).toFixed(2),
    boosterCutAmount: (boosterCut / 100).toFixed(2),
    platformCutAmount: ((total - boosterCut) / 100).toFixed(2),
    currency,
    exchangeRate: usdPerUnit,
    status: "AWAITING_PAYMENT",
    vpnRequired: quote.applied.addOns.includes("vpn"),
    promoCodeId: promo?.id ?? null,
    extraOptions: {
      lpGain: quote.applied.lpGain,
      addOns: quote.applied.addOns,
      currentPoints: config.orderType === "DIVISION" && catalog.rankSystem === "DIVISION" ? config.currentPoints : null,
      promoCode: promo?.terms.code ?? null,
      // Server-side price breakdown in USD cents, kept for support and disputes.
      pricingUsd: {
        serviceCents: quote.serviceCents,
        flatFeeCents: quote.flatFeeCents,
        baseCents: quote.baseCents,
        modifiers: quote.modifiers,
        subtotalCents: quote.subtotalCents,
        discountCents: discounted.discountCents,
        totalCents: discounted.totalCents,
      },
    },
  });

  return ok({
    orderNumber: order.orderNumber,
    redirectTo: getPathname({ href: `/checkout/${order.orderNumber}`, locale }),
  });
}
