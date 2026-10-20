"use server";

import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { getPricingCatalog } from "@/features/pricing/catalog";
import { maxPosition, maxRating, stepLabel } from "@/features/pricing/engine";
import {
  ACTIVE_STATUSES,
  BOOSTER_TRANSITION_KEYS,
  BOOSTER_TRANSITIONS,
  CREDENTIAL_STATUSES,
  MAX_ACTIVE_ORDERS,
  parseRank,
} from "@/features/orders/workflow";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";
import { clientIpFrom } from "@/lib/request";

import { getBoosterContext, isEligible, type BoosterContext } from "./queries";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

async function translator(rawLocale: string) {
  const locale = resolveLocale(rawLocale);
  return { locale, t: await getTranslations({ locale, namespace: "Booster.errors" }) };
}

/** Signed-in, approved booster with 2FA in place — checked here, not only by the proxy. */
async function currentBooster(): Promise<BoosterContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isBanned: true, is2FAEnabled: true },
  });
  if (!user || user.isBanned || user.role !== "BOOSTER" || needsTwoFactorSetup(user.role, user.is2FAEnabled)) return null;
  const booster = await getBoosterContext(session.user.id);
  return booster?.status === "ACTIVE" ? booster : null;
}

function notifyCustomer(tx: Prisma.TransactionClient, customerId: string, orderNumber: string, status: OrderStatus) {
  return tx.notification.create({
    data: { userId: customerId, type: "ORDER_UPDATE", data: { orderNumber, status }, link: `/dashboard/orders/${orderNumber}` },
  });
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export async function claimOrderAction(rawLocale: string, orderNumber: string): Promise<ActionResult<{ redirectTo: string }>> {
  const { locale, t } = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const limit = await rateLimit("boosterAction", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const order = await db.order.findFirst({
    where: { orderNumber, status: "PENDING", boosterId: null },
    include: { game: { select: { id: true, name: true, slug: true, logoUrl: true, rankSystem: true } } },
  });
  if (!order) return fail(t("alreadyTaken"), 409);
  if (!(await isEligible(booster, order))) return fail(t("notEligible"), 403);

  const active = await db.order.count({ where: { boosterId: booster.userId, status: { in: [...ACTIVE_STATUSES] } } });
  if (active >= MAX_ACTIVE_ORDERS) return fail(t("tooManyActive", { max: MAX_ACTIVE_ORDERS }), 409);

  // Conditional update: when two boosters claim at once, exactly one wins.
  const claimed = await db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING", boosterId: null },
      data: { status: "ASSIGNED", boosterId: booster.userId, assignedAt: new Date() },
    });
    if (count === 1) await notifyCustomer(tx, order.customerId, orderNumber, "ASSIGNED");
    return count === 1;
  });
  if (!claimed) return fail(t("alreadyTaken"), 409);
  broadcast(signal.orderUpdated(orderNumber), signal.poolChanged(), signal.notification(order.customerId));

  return ok({ redirectTo: getPathname({ href: `/booster/orders/${orderNumber}`, locale }) });
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

const transitionSchema = z.enum(BOOSTER_TRANSITION_KEYS);

export async function boosterTransitionAction(
  rawLocale: string,
  orderNumber: string,
  rawTransition: string,
): Promise<ActionResult> {
  const { t } = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const transition = transitionSchema.safeParse(rawTransition);
  if (!transition.success) return fail(t("invalidTransition"), 400);
  const rule = BOOSTER_TRANSITIONS[transition.data];

  const limit = await rateLimit("boosterAction", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const order = await db.order.findFirst({ where: { orderNumber, boosterId: booster.userId } });
  if (!order) return fail(t("notFound"), 404);
  if (!(rule.from as readonly OrderStatus[]).includes(order.status)) return fail(t("invalidTransition"), 409);
  if (transition.data === "start" && order.orderType !== "COACHING" && !(order.accountUsername && order.accountPassword)) {
    return fail(t("noCredentials"), 409);
  }

  const now = new Date();
  const applied = await db.$transaction(async (tx) => {
    // Re-checked inside the update so a concurrent change can't be overwritten.
    const where = { id: order.id, boosterId: booster.userId, status: { in: [...rule.from] } };

    switch (transition.data) {
      case "release": {
        const { count } = await tx.order.updateMany({
          where,
          data: { status: "PENDING", boosterId: null, assignedAt: null },
        });
        if (count === 1) await notifyCustomer(tx, order.customerId, orderNumber, "PENDING");
        return count === 1;
      }
      case "complete": {
        const desired = parseRank(order.desiredRank);
        const { count } = await tx.order.updateMany({
          where,
          data: {
            status: "COMPLETED",
            completedAt: now,
            // A finished division boost ends on the desired rank.
            ...(order.orderType === "DIVISION" ? { currentRank: desired } : {}),
            // Data minimisation: the login is no longer needed.
            accountUsername: null,
            accountPassword: null,
          },
        });
        if (count !== 1) return false;

        // Booster's share, converted to USD (wallet currency).
        const earnedUsd = order.boosterCutAmount.times(order.exchangeRate).toDecimalPlaces(2);
        await tx.user.update({ where: { id: booster.userId }, data: { balance: { increment: earnedUsd } } });
        await tx.boosterProfile.update({
          where: { userId: booster.userId },
          data: { totalEarnings: { increment: earnedUsd }, completedOrders: { increment: 1 } },
        });
        await tx.transaction.create({
          data: {
            orderId: order.id,
            userId: booster.userId,
            type: "EARNING",
            amount: earnedUsd,
            currency: "USD",
            gateway: "WALLET",
            status: "COMPLETED",
          },
        });
        await notifyCustomer(tx, order.customerId, orderNumber, "COMPLETED");
        return true;
      }
      default: {
        const { count } = await tx.order.updateMany({
          where,
          data: {
            status: rule.to,
            ...(transition.data === "start" && !order.startedAt ? { startedAt: now } : {}),
          },
        });
        if (count === 1) await notifyCustomer(tx, order.customerId, orderNumber, rule.to);
        return count === 1;
      }
    }
  });

  if (!applied) return fail(t("invalidTransition"), 409);
  broadcast(
    signal.orderUpdated(orderNumber),
    signal.notification(order.customerId),
    ...(transition.data === "release" ? [signal.poolChanged()] : []),
  );
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export async function reportProgressAction(rawLocale: string, orderNumber: string, rawValue: unknown): Promise<ActionResult> {
  const { t } = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const value = z.number().int().min(0).safeParse(rawValue);
  if (!value.success) return fail(t("invalidProgress"), 400);

  const limit = await rateLimit("boosterAction", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const order = await db.order.findFirst({
    where: { orderNumber, boosterId: booster.userId, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    include: { game: { select: { slug: true, rankSystem: true } } },
  });
  if (!order) return fail(t("invalidTransition"), 409);

  let currentRank: Prisma.InputJsonObject;
  if (order.orderType === "DIVISION") {
    const catalog = await getPricingCatalog(order.game.slug);
    if (!catalog) return fail(t("generic"), 500);
    if (order.game.rankSystem === "DIVISION") {
      // Anything from a demotion below the start up to the desired rank.
      const ceiling = parseRank(order.desiredRank).position ?? maxPosition(catalog);
      const step = catalog.steps[value.data];
      if (!step || value.data > ceiling) return fail(t("invalidProgress"), 400);
      currentRank = { position: value.data, label: stepLabel(step) };
    } else {
      if (value.data > maxRating(catalog)) return fail(t("invalidProgress"), 400);
      currentRank = { rating: value.data };
    }
  } else {
    // Wins, placement games or coaching hours done so far.
    if (value.data > (order.quantity ?? 0)) return fail(t("invalidProgress"), 400);
    currentRank = { done: value.data };
  }

  await db.order.update({ where: { id: order.id }, data: { currentRank } });
  broadcast(signal.orderUpdated(orderNumber));
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

const vpnSchema = z.string().trim().min(2).max(100);

/**
 * "Show password": only the assigned booster, only while the order is active,
 * only after reporting the VPN location. Every reveal is logged and shown to
 * the customer.
 */
export async function revealCredentialsAction(
  rawLocale: string,
  orderNumber: string,
  rawVpnLocation: string,
): Promise<ActionResult<{ username: string; password: string }>> {
  const { t } = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const vpnLocation = vpnSchema.safeParse(rawVpnLocation);
  if (!vpnLocation.success) return fail(t("vpnRequired"), 400, { vpnLocation: [t("vpnRequired")] });

  const order = await db.order.findFirst({
    where: { orderNumber, boosterId: booster.userId, status: { in: [...CREDENTIAL_STATUSES] } },
    select: { id: true, accountUsername: true, accountPassword: true },
  });
  if (!order) return fail(t("notFound"), 404);
  if (!order.accountUsername || !order.accountPassword) return fail(t("noCredentialsYet"), 409);

  const limit = await rateLimit("revealCredentials", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const requestHeaders = await headers();
  await db.credentialAccessLog.create({
    data: {
      orderId: order.id,
      boosterId: booster.userId,
      vpnLocation: vpnLocation.data,
      ipAddress: clientIpFrom(requestHeaders),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  // The customer's access log updates live.
  broadcast(signal.orderUpdated(orderNumber));

  return ok({
    username: decrypt(order.accountUsername, order.id),
    password: decrypt(order.accountPassword, order.id),
  });
}
