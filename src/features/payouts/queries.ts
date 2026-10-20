import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { SETTINGS_CACHE_TAG } from "@/features/pricing/catalog";
import type { PayoutMethod, PayoutStatus } from "@/generated/prisma/enums";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

import { formatPayoutDetails, maskPayoutDetails, payoutContext, payoutDetailsSchema, type PayoutDetails } from "./details";

/** Statuses that hold the booster's money: no second request while one is open. */
export const OPEN_PAYOUT_STATUSES = ["PENDING", "APPROVED"] as const satisfies readonly PayoutStatus[];

/** Setting "min_payout_amount_usd" (spec example: $50). */
export async function getMinPayoutUsd(): Promise<number> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_CACHE_TAG);
  const setting = await db.setting.findUnique({ where: { key: "min_payout_amount_usd" } });
  return z.number().nonnegative().safeParse(setting?.value).data ?? 50;
}

/** Null when unset or unreadable (e.g. rows written before the current format), never throws. */
export function readPayoutDetails(ciphertext: string | null, boosterId: string): PayoutDetails | null {
  if (!ciphertext) return null;
  try {
    return payoutDetailsSchema.safeParse(JSON.parse(decrypt(ciphertext, payoutContext(boosterId)))).data ?? null;
  } catch {
    return null;
  }
}

export type PayoutRow = {
  id: string;
  amount: number;
  method: PayoutMethod;
  status: PayoutStatus;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reference: string | null;
};

export type BoosterPayouts = {
  balance: number;
  minPayout: number;
  /** Masked, for display; null until the booster saves details. */
  details: { masked: string; method: PayoutMethod } | null;
  open: PayoutRow | null;
  history: PayoutRow[];
};

export async function getBoosterPayouts(boosterId: string): Promise<BoosterPayouts> {
  const [user, minPayout, requests] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: boosterId },
      select: { balance: true, boosterProfile: { select: { payoutDetails: true } } },
    }),
    getMinPayoutUsd(),
    db.payoutRequest.findMany({
      where: { boosterId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { transaction: { select: { gatewayTransactionId: true } } },
    }),
  ]);
  const details = readPayoutDetails(user.boosterProfile?.payoutDetails ?? null, boosterId);
  const history = requests.map((request) => ({
    id: request.id,
    amount: request.amount.toNumber(),
    method: request.method,
    status: request.status,
    adminNote: request.adminNote,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reference: request.transaction?.gatewayTransactionId ?? null,
  }));

  return {
    balance: user.balance.toNumber(),
    minPayout,
    details: details ? { masked: maskPayoutDetails(details), method: details.method } : null,
    open: history.find((row) => (OPEN_PAYOUT_STATUSES as readonly string[]).includes(row.status)) ?? null,
    history,
  };
}

export type AdminPayoutRow = PayoutRow & {
  booster: { id: string; name: string; email: string };
  /** Full destination (decrypted snapshot taken at request time). */
  destination: string;
};

export async function getAdminPayouts(statuses: readonly PayoutStatus[]): Promise<AdminPayoutRow[]> {
  const requests = await db.payoutRequest.findMany({
    where: { status: { in: [...statuses] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      booster: { select: { id: true, name: true, email: true } },
      transaction: { select: { gatewayTransactionId: true } },
    },
  });
  return requests.map((request) => {
    const details = readPayoutDetails(request.destination, request.boosterId);
    return {
      id: request.id,
      amount: request.amount.toNumber(),
      method: request.method,
      status: request.status,
      adminNote: request.adminNote,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reference: request.transaction?.gatewayTransactionId ?? null,
      booster: { id: request.booster.id, name: request.booster.name ?? request.booster.email, email: request.booster.email },
      destination: details ? formatPayoutDetails(details) : "—",
    };
  });
}
