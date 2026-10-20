"use server";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { PayoutStatus } from "@/generated/prisma/enums";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { broadcast, signal } from "@/lib/realtime/server";

import { adminErrors, getStaffActor, writeAudit } from "./server";

const PATH = "/admin/payouts";
const noteSchema = z.string().trim().max(500);
const referenceSchema = z.string().trim().min(3).max(120);

type Move = { from: readonly PayoutStatus[]; to: PayoutStatus };

/**
 * Shared shape of every finance decision: conditional status move (so two
 * reviewers can't both act), side effect, booster notification, audit row.
 */
async function decide(
  rawLocale: string,
  requestId: string,
  move: Move,
  action: string,
  effect: (tx: Prisma.TransactionClient, request: { boosterId: string; amount: Prisma.Decimal }) => Promise<void>,
  extra: { adminNote?: string; details?: Record<string, string> } = {},
): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(requestId).success) return fail(t("notFound"), 404);

  let outcome: { boosterId: string; amount: number } | "stale" | "missing" | "duplicate";
  try {
    outcome = await db.$transaction(async (tx) => {
      const request = await tx.payoutRequest.findUnique({ where: { id: requestId }, select: { boosterId: true, amount: true } });
      if (!request) return "missing" as const;
      const { count } = await tx.payoutRequest.updateMany({
        where: { id: requestId, status: { in: [...move.from] } },
        data: { status: move.to, reviewedById: actor.id, reviewedAt: new Date(), ...(extra.adminNote ? { adminNote: extra.adminNote } : {}) },
      });
      if (count !== 1) return "stale" as const;
      await effect(tx, request);
      const amount = request.amount.toNumber();
      await tx.notification.create({
        data: { userId: request.boosterId, type: "PAYOUT_UPDATE", data: { amount, status: move.to }, link: "/booster/payouts" },
      });
      await writeAudit(tx, {
        adminId: actor.id,
        action,
        targetType: "PayoutRequest",
        targetId: requestId,
        details: { amount, ...extra.details },
      });
      return { boosterId: request.boosterId, amount };
    });
  } catch (error) {
    // (gateway, reference) is unique: the same bank reference can't settle two payouts.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") outcome = "duplicate";
    else throw error;
  }

  if (outcome === "missing") return fail(t("notFound"), 404);
  if (outcome === "stale") return fail(t("stale"), 409);
  if (outcome === "duplicate") return fail(t("duplicateReference"), 409);
  broadcast(signal.notification(outcome.boosterId));
  return ok(undefined);
}

export async function approvePayoutAction(rawLocale: string, requestId: string): Promise<ActionResult> {
  return decide(rawLocale, requestId, { from: ["PENDING"], to: "APPROVED" }, "payout.approve", async () => {});
}

/** Rejecting returns the held amount to the booster's wallet. */
export async function rejectPayoutAction(rawLocale: string, requestId: string, rawNote: string): Promise<ActionResult> {
  const note = noteSchema.safeParse(rawNote);
  if (!note.success || !note.data) return fail((await adminErrors(rawLocale))("noteRequired"), 400);
  return decide(
    rawLocale,
    requestId,
    { from: ["PENDING", "APPROVED"], to: "REJECTED" },
    "payout.reject",
    async (tx, request) => {
      await tx.user.update({ where: { id: request.boosterId }, data: { balance: { increment: request.amount } } });
    },
    { adminNote: note.data, details: { note: note.data } },
  );
}

/** After the transfer went out: records it in the ledger with the bank / blockchain reference. */
export async function markPayoutPaidAction(rawLocale: string, requestId: string, rawReference: string): Promise<ActionResult> {
  const reference = referenceSchema.safeParse(rawReference);
  if (!reference.success) return fail((await adminErrors(rawLocale))("referenceRequired"), 400);
  return decide(
    rawLocale,
    requestId,
    { from: ["APPROVED"], to: "PAID" },
    "payout.mark_paid",
    async (tx, request) => {
      await tx.transaction.create({
        data: {
          userId: request.boosterId,
          payoutRequestId: requestId,
          type: "PAYOUT",
          amount: request.amount,
          currency: "USD",
          gateway: "MANUAL",
          gatewayTransactionId: reference.data,
          status: "COMPLETED",
        },
      });
    },
    { details: { reference: reference.data } },
  );
}
