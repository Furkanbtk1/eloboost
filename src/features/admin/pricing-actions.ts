"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { GAMES_CACHE_TAG } from "@/features/games/queries";
import { PRICING_CACHE_TAG, SETTINGS_CACHE_TAG } from "@/features/pricing/catalog";
import type { Prisma } from "@/generated/prisma/client";
import { GameStatus } from "@/generated/prisma/enums";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";

import { adminErrors, getStaffActor, writeAudit } from "./server";

const PATH = "/admin/pricing";

const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
const money = z.number().min(0).max(100_000).refine(twoDecimals);
const percent = z.number().min(-90).max(500).refine(twoDecimals);

type Change = { key: string; from: unknown; to: unknown };
type Rejection = "invalid" | "needServer" | "defaultModifier";

/** Thrown inside the transaction so rows already updated roll back with it. */
class Rejected extends Error {
  constructor(readonly key: Rejection) {
    super(key);
  }
}

/** Admin check, game lookup, then one transaction that applies the rows and logs what changed. */
async function editGame(
  rawLocale: string,
  slug: string,
  action: string,
  apply: (tx: Prisma.TransactionClient, gameId: string) => Promise<Change[] | Rejection>,
): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  const game = await db.game.findUnique({ where: { slug }, select: { id: true } });
  if (!game) return fail(t("notFound"), 404);

  try {
    await db.$transaction(async (tx) => {
      const changes = await apply(tx, game.id);
      if (typeof changes === "string") throw new Rejected(changes);
      if (changes.length === 0) return;
      await writeAudit(tx, {
        adminId: actor.id,
        action,
        targetType: "Game",
        targetId: slug,
        details: { changes: changes.map((change) => ({ ...change, from: String(change.from), to: String(change.to) })) },
      });
    });
  } catch (error) {
    if (error instanceof Rejected) return fail(t(error.key), 400);
    throw error;
  }

  // Prices are cached per game and in the game list (starting prices).
  updateTag(PRICING_CACHE_TAG);
  updateTag(`${PRICING_CACHE_TAG}:${slug}`);
  updateTag(GAMES_CACHE_TAG);
  return ok(undefined);
}

const same = (a: Prisma.Decimal | null, b: number | null) => (a === null || b === null ? a === b : a.equals(b));

const gameSchema = z.object({ basePrice: money, coachingHourlyRate: money.nullable(), status: z.enum(GameStatus) });

export async function saveGamePricingAction(rawLocale: string, slug: string, input: unknown): Promise<ActionResult> {
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return fail((await adminErrors(rawLocale))("invalid"), 400);
  const next = parsed.data;
  return editGame(rawLocale, slug, "pricing.game", async (tx, gameId) => {
    const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });
    const changes: Change[] = [];
    if (!game.basePrice.equals(next.basePrice)) changes.push({ key: "basePrice", from: game.basePrice, to: next.basePrice });
    if (!same(game.coachingHourlyRate, next.coachingHourlyRate)) {
      changes.push({ key: "coachingHourlyRate", from: game.coachingHourlyRate, to: next.coachingHourlyRate });
    }
    if (game.status !== next.status) changes.push({ key: "status", from: game.status, to: next.status });
    await tx.game.update({ where: { id: gameId }, data: next });
    return changes;
  });
}

const stepsSchema = z
  .array(z.object({ position: z.number().int(), divisionPrice: money.nullable(), winPrice: money, placementPrice: money }))
  .max(200);

export async function saveRankStepsAction(rawLocale: string, slug: string, input: unknown): Promise<ActionResult> {
  const parsed = stepsSchema.safeParse(input);
  if (!parsed.success) return fail((await adminErrors(rawLocale))("invalid"), 400);
  return editGame(rawLocale, slug, "pricing.rank_steps", async (tx, gameId) => {
    const steps = await tx.rankStep.findMany({ where: { gameId }, orderBy: { position: "asc" } });
    const top = steps.at(-1)?.position;
    const changes: Change[] = [];
    for (const row of parsed.data) {
      const step = steps.find((entry) => entry.position === row.position);
      if (!step) return "invalid";
      // The top rung has no "next division" to price; every other rung needs a positive price.
      if ((row.position === top) !== (row.divisionPrice === null) || row.divisionPrice === 0) return "invalid";
      const label = step.division ? `${step.tier} ${step.division}` : step.tier;
      if (!same(step.divisionPrice, row.divisionPrice)) changes.push({ key: `${label}.division`, from: step.divisionPrice, to: row.divisionPrice });
      if (!step.winPrice.equals(row.winPrice)) changes.push({ key: `${label}.win`, from: step.winPrice, to: row.winPrice });
      if (!step.placementPrice.equals(row.placementPrice)) {
        changes.push({ key: `${label}.placement`, from: step.placementPrice, to: row.placementPrice });
      }
      await tx.rankStep.update({
        where: { id: step.id },
        data: { divisionPrice: row.divisionPrice, winPrice: row.winPrice, placementPrice: row.placementPrice },
      });
    }
    return changes;
  });
}

const bracketsSchema = z.array(z.object({ minRating: z.number().int(), pricePer100: money, winPrice: money })).max(100);

export async function saveRatingBracketsAction(rawLocale: string, slug: string, input: unknown): Promise<ActionResult> {
  const parsed = bracketsSchema.safeParse(input);
  if (!parsed.success) return fail((await adminErrors(rawLocale))("invalid"), 400);
  return editGame(rawLocale, slug, "pricing.rating_brackets", async (tx, gameId) => {
    const brackets = await tx.ratingBracket.findMany({ where: { gameId } });
    const changes: Change[] = [];
    for (const row of parsed.data) {
      const bracket = brackets.find((entry) => entry.minRating === row.minRating);
      if (!bracket || row.pricePer100 === 0) return "invalid";
      const label = `${bracket.minRating}-${bracket.maxRating}`;
      if (!bracket.pricePer100.equals(row.pricePer100)) changes.push({ key: `${label}.per100`, from: bracket.pricePer100, to: row.pricePer100 });
      if (!bracket.winPrice.equals(row.winPrice)) changes.push({ key: `${label}.win`, from: bracket.winPrice, to: row.winPrice });
      await tx.ratingBracket.update({ where: { id: bracket.id }, data: { pricePer100: row.pricePer100, winPrice: row.winPrice } });
    }
    return changes;
  });
}

const serversSchema = z.array(z.object({ code: z.string().max(16), priceModifier: percent, isActive: z.boolean() })).max(50);

export async function saveServersAction(rawLocale: string, slug: string, input: unknown): Promise<ActionResult> {
  const parsed = serversSchema.safeParse(input);
  if (!parsed.success) return fail((await adminErrors(rawLocale))("invalid"), 400);
  return editGame(rawLocale, slug, "pricing.servers", async (tx, gameId) => {
    const servers = await tx.gameServer.findMany({ where: { gameId } });
    const changes: Change[] = [];
    for (const row of parsed.data) {
      const server = servers.find((entry) => entry.code === row.code);
      if (!server) return "invalid";
      if (!server.priceModifier.equals(row.priceModifier)) changes.push({ key: `${row.code}.percent`, from: server.priceModifier, to: row.priceModifier });
      if (server.isActive !== row.isActive) changes.push({ key: `${row.code}.active`, from: server.isActive, to: row.isActive });
      await tx.gameServer.update({ where: { id: server.id }, data: { priceModifier: row.priceModifier, isActive: row.isActive } });
    }
    // The calculator needs a server to price against.
    if ((await tx.gameServer.count({ where: { gameId, isActive: true } })) === 0) return "needServer";
    return changes;
  });
}

const modifiersSchema = z.array(z.object({ key: z.string().max(64), percentage: percent, isActive: z.boolean() })).max(100);

export async function saveModifiersAction(rawLocale: string, slug: string, input: unknown): Promise<ActionResult> {
  const parsed = modifiersSchema.safeParse(input);
  if (!parsed.success) return fail((await adminErrors(rawLocale))("invalid"), 400);
  return editGame(rawLocale, slug, "pricing.modifiers", async (tx, gameId) => {
    const modifiers = await tx.priceModifier.findMany({ where: { gameId } });
    const changes: Change[] = [];
    for (const row of parsed.data) {
      const modifier = modifiers.find((entry) => entry.key === row.key);
      if (!modifier) return "invalid";
      // The pre-selected LP option is what the calculator falls back to.
      if (modifier.isDefault && !row.isActive) return "defaultModifier";
      if (!modifier.percentage.equals(row.percentage)) changes.push({ key: `${row.key}.percent`, from: modifier.percentage, to: row.percentage });
      if (modifier.isActive !== row.isActive) changes.push({ key: `${row.key}.active`, from: modifier.isActive, to: row.isActive });
      await tx.priceModifier.update({ where: { id: modifier.id }, data: { percentage: row.percentage, isActive: row.isActive } });
    }
    return changes;
  });
}

const settingsSchema = z.object({
  /** Booster's share of each order, percent (spec example: 60 / 40). */
  boosterSharePercent: z.number().min(1).max(99).refine(twoDecimals),
  minPayoutUsd: money,
});

/** Applies to new orders only: existing orders keep the split stored at checkout. */
export async function savePlatformSettingsAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalid"), 400);
  const share = Math.round(parsed.data.boosterSharePercent * 100) / 10_000;

  await db.$transaction(async (tx) => {
    const before = await tx.setting.findMany({ where: { key: { in: ["booster_commission_rate", "min_payout_amount_usd"] } } });
    await tx.setting.upsert({
      where: { key: "booster_commission_rate" },
      create: { key: "booster_commission_rate", value: share },
      update: { value: share },
    });
    await tx.setting.upsert({
      where: { key: "min_payout_amount_usd" },
      create: { key: "min_payout_amount_usd", value: parsed.data.minPayoutUsd },
      update: { value: parsed.data.minPayoutUsd },
    });
    await writeAudit(tx, {
      adminId: actor.id,
      action: "settings.update",
      targetType: "Setting",
      targetId: "platform",
      details: {
        before: Object.fromEntries(before.map((setting) => [setting.key, String(setting.value)])),
        after: { booster_commission_rate: String(share), min_payout_amount_usd: String(parsed.data.minPayoutUsd) },
      },
    });
  });
  updateTag(SETTINGS_CACHE_TAG);
  return ok(undefined);
}
