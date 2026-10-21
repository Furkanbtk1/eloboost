"use server";

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { adminErrors, getStaffActor, writeAudit } from "@/features/admin/server";
import { findChatOrder, getChatViewer } from "@/features/chat/access";
import { moderate } from "@/features/chat/moderation";
import { Prisma } from "@/generated/prisma/client";
import { DisputeResolution } from "@/generated/prisma/enums";
import { routing } from "@/i18n/routing";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { broadcast, signal } from "@/lib/realtime/server";

import { DISPUTABLE_STATUSES, partialBoosterShareUsdCents, planResolution } from "./rules";

const reasonSchema = z.string().trim().min(20).max(1000);

const orderLink = (orderNumber: string, side: "customer" | "booster" | "staff") =>
  side === "customer" ? `/dashboard/orders/${orderNumber}` : side === "booster" ? `/booster/orders/${orderNumber}` : `/admin/orders/${orderNumber}`;

/** The order's customer or current booster freezes it and asks support to decide. */
export async function openDisputeAction(rawLocale: string, orderNumber: string, rawReason: string): Promise<ActionResult> {
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Disputes.errors" });

  const viewer = await getChatViewer();
  const access = viewer ? await findChatOrder(viewer, { orderNumber }) : null;
  if (!viewer || !access || access.role === "staff") return fail(t("notFound"), 404);
  const { order, role } = access;

  const reason = reasonSchema.safeParse(rawReason);
  if (!reason.success) return fail(t("reason"), 400, { reason: [t("reason")] });
  const limit = await rateLimit("openDispute", viewer.id);
  if (!limit.success) return fail(t("rateLimited"), 429);

  const staff = await db.user.findMany({ where: { role: "ADMIN", isBanned: false }, select: { id: true } });
  const other = role === "customer" ? order.boosterId : order.customerId;

  const opened = await db.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: [...DISPUTABLE_STATUSES] } },
      data: { status: "DISPUTED" },
    });
    if (count !== 1) return false;
    await tx.dispute.create({
      data: { orderId: order.id, openedById: viewer.id, reason: moderate(reason.data).text, previousStatus: order.status },
    });
    const data = { orderNumber, status: "OPEN" };
    await tx.notification.createMany({
      data: [
        ...(other ? [{ userId: other, link: orderLink(orderNumber, role === "customer" ? "booster" : "customer") }] : []),
        ...staff.map(({ id }) => ({ userId: id, link: orderLink(orderNumber, "staff") })),
      ].map((entry) => ({ ...entry, type: "DISPUTE_UPDATE" as const, data })),
    });
    return true;
  });
  if (!opened) return fail(t("notDisputable"), 409);

  broadcast(
    signal.orderUpdated(orderNumber),
    ...[other, ...staff.map(({ id }) => id)].filter((id) => id !== null).map((id) => signal.notification(id)),
  );
  return ok(undefined);
}

const resolveSchema = z.object({
  resolution: z.enum(DisputeResolution),
  note: z.string().trim().min(5).max(1000),
  /** In the order's currency; partial refunds only. */
  refundAmount: z.number().positive().optional(),
});

/** SuperAdmin decision. Support staff can read disputes but not resolve them. */
export async function resolveDisputeAction(rawLocale: string, disputeId: string, input: unknown): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor("/admin/disputes");
  if (!actor || actor.role !== "ADMIN") return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(disputeId).success) return fail(t("notFound"), 404);
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalid"), 400);
  const { resolution, note } = parsed.data;

  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute) return fail(t("notFound"), 404);
  if (dispute.status !== "OPEN") return fail(t("stale"), 409);
  const { order } = dispute;
  const plan = planResolution(resolution, dispute.previousStatus);

  // Refund in the order's currency, then in USD for the wallet.
  let refund = new Prisma.Decimal(0);
  if (plan.refund === "full") refund = order.totalAmount;
  if (plan.refund === "partial") {
    const amount = new Prisma.Decimal(parsed.data.refundAmount ?? 0).toDecimalPlaces(2);
    if (amount.lte(0) || amount.gte(order.totalAmount)) return fail(t("refundRange"), 400);
    refund = amount;
  }
  const refundUsd = refund.times(order.exchangeRate).toDecimalPlaces(2);
  const boosterUsd =
    plan.payBooster && order.boosterId
      ? new Prisma.Decimal(
          partialBoosterShareUsdCents({
            totalCents: order.totalAmount.times(100).toNumber(),
            boosterCutCents: order.boosterCutAmount.times(100).toNumber(),
            refundCents: refund.times(100).toNumber(),
            exchangeRate: order.exchangeRate.toNumber(),
          }),
        ).div(100)
      : new Prisma.Decimal(0);

  const now = new Date();
  const resolved = await db.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: { status: "RESOLVED", resolution, adminNote: note, resolvedById: actor.id, resolvedAt: now },
    });
    if (claimed.count !== 1) return false;

    const moved = await tx.order.updateMany({
      where: { id: order.id, status: "DISPUTED" },
      data: {
        status: plan.orderStatus,
        ...(plan.orderStatus === "CANCELLED" ? { cancelledAt: now } : {}),
        ...(plan.orderStatus === "COMPLETED" ? { completedAt: now } : {}),
        ...(plan.releaseBooster ? { boosterId: null, assignedAt: null, startedAt: null } : {}),
        ...(plan.wipeCredentials ? { accountUsername: null, accountPassword: null } : {}),
      },
    });
    if (moved.count !== 1) throw new Error(`order ${order.orderNumber} left DISPUTED during resolution`);

    if (refundUsd.gt(0)) {
      await tx.user.update({ where: { id: order.customerId }, data: { balance: { increment: refundUsd } } });
      await tx.transaction.create({
        data: {
          orderId: order.id,
          userId: order.customerId,
          type: "REFUND",
          amount: refundUsd,
          currency: "USD",
          gateway: "WALLET",
          status: "COMPLETED",
          metadata: { disputeId, orderCurrency: order.currency, orderCurrencyAmount: refund.toString() },
        },
      });
    }
    if (boosterUsd.gt(0) && order.boosterId) {
      await tx.user.update({ where: { id: order.boosterId }, data: { balance: { increment: boosterUsd } } });
      await tx.boosterProfile.update({
        where: { userId: order.boosterId },
        data: { totalEarnings: { increment: boosterUsd }, completedOrders: { increment: 1 } },
      });
      await tx.transaction.create({
        data: {
          orderId: order.id,
          userId: order.boosterId,
          type: "EARNING",
          amount: boosterUsd,
          currency: "USD",
          gateway: "WALLET",
          status: "COMPLETED",
          metadata: { disputeId },
        },
      });
    }

    const data = { orderNumber: order.orderNumber, status: "RESOLVED", resolution };
    await tx.notification.createMany({
      data: [
        { userId: order.customerId, type: "DISPUTE_UPDATE" as const, data, link: orderLink(order.orderNumber, "customer") },
        ...(order.boosterId
          ? [{ userId: order.boosterId, type: "DISPUTE_UPDATE" as const, data, link: orderLink(order.orderNumber, "booster") }]
          : []),
        ...(refundUsd.gt(0)
          ? [
              {
                userId: order.customerId,
                type: "ORDER_UPDATE" as const,
                data: { orderNumber: order.orderNumber, event: "refunded", amount: refundUsd.toNumber() },
                link: orderLink(order.orderNumber, "customer"),
              },
            ]
          : []),
      ],
    });
    await writeAudit(tx, {
      adminId: actor.id,
      action: "dispute.resolve",
      targetType: "Order",
      targetId: order.id,
      details: {
        orderNumber: order.orderNumber,
        resolution,
        note,
        refundUsd: refundUsd.toString(),
        boosterUsd: boosterUsd.toString(),
      },
    });
    return true;
  });
  if (!resolved) return fail(t("stale"), 409);

  broadcast(
    signal.orderUpdated(order.orderNumber),
    signal.notification(order.customerId),
    ...(order.boosterId ? [signal.notification(order.boosterId)] : []),
    ...(plan.releaseBooster ? [signal.poolChanged()] : []),
  );
  return ok(undefined);
}
