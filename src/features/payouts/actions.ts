"use server";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getBoosterContext } from "@/features/booster/queries";
import { routing } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { getCurrentUser } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";

import { payoutAmountSchema, payoutContext, payoutDetailsSchema } from "./details";
import { getMinPayoutUsd, OPEN_PAYOUT_STATUSES, readPayoutDetails } from "./queries";

function translator(rawLocale: string) {
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  return getTranslations({ locale, namespace: "Payouts.errors" });
}

/** Approved booster with 2FA, checked here and not only by the page. */
async function currentBooster() {
  const user = await getCurrentUser();
  if (!user || user.role !== "BOOSTER" || needsTwoFactorSetup(user.role, user.is2FAEnabled)) return null;
  const booster = await getBoosterContext(user.id);
  return booster?.status === "ACTIVE" ? booster : null;
}

async function notifyFinance(amount: number) {
  const staff = await db.user.findMany({
    where: { role: { in: ["FINANCE", "ADMIN"] }, isBanned: false },
    select: { id: true },
  });
  if (staff.length === 0) return [];
  await db.notification.createMany({
    data: staff.map(({ id }) => ({
      userId: id,
      type: "PAYOUT_UPDATE" as const,
      data: { amount, status: "PENDING" },
      link: "/admin/payouts",
    })),
  });
  return staff.map(({ id }) => signal.notification(id));
}

export async function savePayoutDetailsAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const t = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const parsed = payoutDetailsSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(t("invalidDetails"), 400, typeof field === "string" ? { [field]: [t("invalidDetails")] } : undefined);
  }
  const limit = await rateLimit("boosterAction", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  await db.boosterProfile.update({
    where: { userId: booster.userId },
    data: { payoutDetails: encrypt(JSON.stringify(parsed.data), payoutContext(booster.userId)) },
  });
  return ok(undefined);
}

/**
 * Moves the amount out of the wallet into a pending request, in one
 * transaction: the balance check and the deduction are a single conditional
 * update, so two requests at once can't overdraw it.
 */
export async function requestPayoutAction(rawLocale: string, rawAmount: unknown): Promise<ActionResult> {
  const t = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);

  const amount = payoutAmountSchema.safeParse(rawAmount);
  if (!amount.success) return fail(t("invalidAmount"), 400, { amount: [t("invalidAmount")] });
  const minPayout = await getMinPayoutUsd();
  if (amount.data < minPayout) return fail(t("belowMinimum", { min: minPayout }), 400, { amount: [t("belowMinimum", { min: minPayout })] });

  const limit = await rateLimit("boosterAction", booster.userId);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const profile = await db.boosterProfile.findUnique({ where: { userId: booster.userId }, select: { payoutDetails: true } });
  const destination = profile?.payoutDetails ?? null;
  const method = readPayoutDetails(destination, booster.userId)?.method;
  if (!destination || !method) return fail(t("noDetails"), 409);

  const result = await db.$transaction(async (tx) => {
    const open = await tx.payoutRequest.count({
      where: { boosterId: booster.userId, status: { in: [...OPEN_PAYOUT_STATUSES] } },
    });
    if (open > 0) return "open" as const;
    const { count } = await tx.user.updateMany({
      where: { id: booster.userId, balance: { gte: amount.data } },
      data: { balance: { decrement: amount.data } },
    });
    if (count !== 1) return "balance" as const;
    await tx.payoutRequest.create({
      data: { boosterId: booster.userId, amount: amount.data, method, destination },
    });
    return "created" as const;
  });
  if (result === "open") return fail(t("alreadyOpen"), 409);
  if (result === "balance") return fail(t("insufficient"), 409, { amount: [t("insufficient")] });

  broadcast(...(await notifyFinance(amount.data)));
  return ok(undefined);
}

/** A booster may withdraw a request finance hasn't approved yet; the money goes back to the wallet. */
export async function cancelPayoutAction(rawLocale: string, requestId: string): Promise<ActionResult> {
  const t = await translator(rawLocale);
  const booster = await currentBooster();
  if (!booster) return fail(t("notActive"), 403);
  if (!z.uuid().safeParse(requestId).success) return fail(t("notCancellable"), 409);

  const cancelled = await db.$transaction(async (tx) => {
    const request = await tx.payoutRequest.findFirst({
      where: { id: requestId, boosterId: booster.userId, status: "PENDING" },
      select: { amount: true },
    });
    if (!request) return false;
    const { count } = await tx.payoutRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", adminNote: "Cancelled by booster", reviewedAt: new Date() },
    });
    if (count !== 1) return false;
    await tx.user.update({ where: { id: booster.userId }, data: { balance: { increment: request.amount } } });
    return true;
  });
  return cancelled ? ok(undefined) : fail(t("notCancellable"), 409);
}
