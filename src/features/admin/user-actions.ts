"use server";

import { z } from "zod";

import { BoosterStatus, UserRole } from "@/generated/prisma/enums";
import { ACTIVE_STATUSES } from "@/features/orders/workflow";
import { getPricingCatalog } from "@/features/pricing/catalog";
import { maxRating, stepLabel } from "@/features/pricing/engine";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { broadcast, signal } from "@/lib/realtime/server";

import { adminErrors, getStaffActor, writeAudit } from "./server";

const PATH = "/admin/users";
const idSchema = z.uuid();

/** Common checks: allowed admin, valid id, not acting on their own account. */
async function prepare(rawLocale: string, userId: string) {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return { error: fail(t("forbidden"), 403) } as const;
  if (!idSchema.safeParse(userId).success) return { error: fail(t("notFound"), 404) } as const;
  if (userId === actor.id) return { error: fail(t("self"), 409) } as const;
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isBanned: true, boosterProfile: { select: { status: true } } },
  });
  if (!target) return { error: fail(t("notFound"), 404) } as const;
  return { t, actor, target } as const;
}

export async function setUserBanAction(rawLocale: string, userId: string, banned: boolean): Promise<ActionResult> {
  const ctx = await prepare(rawLocale, userId);
  if (ctx.error) return ctx.error;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isBanned: banned === true } });
    await writeAudit(tx, {
      adminId: ctx.actor.id,
      action: banned ? "user.ban" : "user.unban",
      targetType: "User",
      targetId: userId,
    });
  });
  return ok(undefined);
}

export async function setUserRoleAction(rawLocale: string, userId: string, rawRole: string): Promise<ActionResult> {
  const ctx = await prepare(rawLocale, userId);
  if (ctx.error) return ctx.error;
  const role = z.enum(UserRole).safeParse(rawRole);
  if (!role.success) return fail(ctx.t("invalid"), 400);
  if (role.data === ctx.target.role) return ok(undefined);

  if (ctx.target.role === "BOOSTER") {
    const active = await db.order.count({ where: { boosterId: userId, status: { in: [...ACTIVE_STATUSES] } } });
    if (active > 0) return fail(ctx.t("hasActiveOrders"), 409);
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: role.data } });
    // New boosters start unapproved, with games and ranks to be set by an admin.
    if (role.data === "BOOSTER" && !ctx.target.boosterProfile) {
      await tx.boosterProfile.create({ data: { userId } });
    }
    await writeAudit(tx, {
      adminId: ctx.actor.id,
      action: "user.role",
      targetType: "User",
      targetId: userId,
      details: { from: ctx.target.role, to: role.data },
    });
  });
  return ok(undefined);
}

/** For a lost phone: the user sets 2FA up again at next sign-in (mandatory for staff and boosters). */
export async function resetTwoFactorAction(rawLocale: string, userId: string): Promise<ActionResult> {
  const ctx = await prepare(rawLocale, userId);
  if (ctx.error) return ctx.error;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { is2FAEnabled: false, twoFactorSecret: null } });
    await writeAudit(tx, { adminId: ctx.actor.id, action: "user.reset_2fa", targetType: "User", targetId: userId });
  });
  return ok(undefined);
}

const boosterProfileSchema = z.object({
  status: z.enum(BoosterStatus),
  games: z.array(z.string().max(64)).max(20),
  /** Per selected game: a ladder position (tiered games) or a rating. */
  ranks: z.record(z.string(), z.object({ position: z.number().int().optional(), rating: z.number().int().optional() })),
});

export type BoosterProfileInput = z.input<typeof boosterProfileSchema>;

export async function saveBoosterProfileAction(rawLocale: string, userId: string, input: unknown): Promise<ActionResult> {
  const ctx = await prepare(rawLocale, userId);
  if (ctx.error) return ctx.error;
  const { t, actor, target } = ctx;
  if (target.role !== "BOOSTER" || !target.boosterProfile) return fail(t("notBooster"), 409);

  const parsed = boosterProfileSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalid"), 400);
  const { status, games, ranks } = parsed.data;

  // Every rank must exist on that game's ladder, so pool eligibility stays meaningful.
  const currentRanks: Record<string, { position?: number; rating?: number; label?: string }> = {};
  for (const slug of new Set(games)) {
    const catalog = await getPricingCatalog(slug);
    if (!catalog) return fail(t("invalid"), 400);
    const rank = ranks[slug];
    if (catalog.rankSystem === "DIVISION") {
      const step = catalog.steps.find((entry) => entry.position === rank?.position);
      if (!step) return fail(t("rankRequired"), 400);
      currentRanks[slug] = { position: step.position, label: stepLabel(step) };
    } else {
      if (rank?.rating === undefined || rank.rating < 0 || rank.rating > maxRating(catalog)) return fail(t("rankRequired"), 400);
      currentRanks[slug] = { rating: rank.rating };
    }
  }
  if (status === "ACTIVE" && games.length === 0) return fail(t("gamesRequired"), 400);

  const previous = target.boosterProfile.status;
  await db.$transaction(async (tx) => {
    await tx.boosterProfile.update({
      where: { userId },
      data: {
        status,
        currentRanks,
        acceptedGames: { set: [...new Set(games)].map((slug) => ({ slug })) },
      },
    });
    if (status !== previous) {
      await tx.notification.create({
        data: { userId, type: "SYSTEM", data: { event: "booster_status", status }, link: "/booster" },
      });
    }
    await writeAudit(tx, {
      adminId: actor.id,
      action: status === previous ? "booster.update" : status === "ACTIVE" ? "booster.approve" : `booster.${status.toLowerCase()}`,
      targetType: "User",
      targetId: userId,
      details: { status: { from: previous, to: status }, games, ranks: currentRanks },
    });
  });
  if (status !== previous) broadcast(signal.notification(userId));
  return ok(undefined);
}
