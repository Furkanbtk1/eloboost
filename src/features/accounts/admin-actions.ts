"use server";

import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";
import { z } from "zod";

import { adminErrors, getStaffActor, writeAudit } from "@/features/admin/server";
import { AccountKind } from "@/generated/prisma/enums";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

import { ACCOUNTS_CACHE_TAG, credentialContext } from "./queries";
import { MAX_STOCK_LINES, parseStockLines } from "./stock-format";

const PATH = "/admin/accounts";
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const productSchema = z.object({
  gameSlug: z.string().max(64),
  kind: z.enum(AccountKind),
  serverCode: z.string().max(16),
  tier: z.string().trim().min(2).max(60),
  level: z.number().int().min(1).max(2000).nullable(),
  championCount: z.number().int().min(0).max(2000),
  hasMailAccess: z.boolean(),
  price: z.number().min(1).max(5000).refine(twoDecimals),
});

export type ProductInput = z.input<typeof productSchema>;

export async function createProductAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fail(t("invalid"), 400, typeof field === "string" ? { [field]: [t("invalid")] } : undefined);
  }
  const { gameSlug, ...product } = parsed.data;

  const game = await db.game.findUnique({ where: { slug: gameSlug }, select: { id: true, servers: { select: { code: true } } } });
  if (!game) return fail(t("notFound"), 404);
  if (!game.servers.some((server) => server.code === product.serverCode)) return fail(t("invalid"), 400, { serverCode: [t("invalid")] });

  await db.$transaction(async (tx) => {
    const created = await tx.accountProduct.create({ data: { ...product, gameId: game.id } });
    await writeAudit(tx, { adminId: actor.id, action: "account.product_create", targetType: "AccountProduct", targetId: created.id, details: { gameSlug, ...product } });
  });
  updateTag(ACCOUNTS_CACHE_TAG);
  return ok(undefined);
}

const updateSchema = z.object({ price: z.number().min(1).max(5000).refine(twoDecimals), isActive: z.boolean() });

export async function updateProductAction(rawLocale: string, productId: string, input: unknown): Promise<ActionResult> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(productId).success) return fail(t("notFound"), 404);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(t("invalid"), 400);

  const updated = await db.$transaction(async (tx) => {
    const before = await tx.accountProduct.findUnique({ where: { id: productId }, select: { price: true, isActive: true, tier: true } });
    if (!before) return false;
    await tx.accountProduct.update({ where: { id: productId }, data: parsed.data });
    await writeAudit(tx, {
      adminId: actor.id,
      action: "account.product_update",
      targetType: "AccountProduct",
      targetId: productId,
      details: { tier: before.tier, price: { from: before.price.toString(), to: String(parsed.data.price) }, isActive: { from: before.isActive, to: parsed.data.isActive } },
    });
    return true;
  });
  if (!updated) return fail(t("notFound"), 404);
  updateTag(ACCOUNTS_CACHE_TAG);
  return ok(undefined);
}

export async function addStockAction(rawLocale: string, productId: string, rawText: string): Promise<ActionResult<{ added: number }>> {
  const t = await adminErrors(rawLocale);
  const actor = await getStaffActor(PATH);
  if (!actor) return fail(t("forbidden"), 403);
  if (!z.uuid().safeParse(productId).success) return fail(t("notFound"), 404);
  const rows = parseStockLines(String(rawText));
  if (!rows) return fail(t("stockFormat", { max: MAX_STOCK_LINES }), 400);

  const product = await db.accountProduct.findUnique({ where: { id: productId }, select: { id: true, tier: true } });
  if (!product) return fail(t("notFound"), 404);

  await db.$transaction(async (tx) => {
    await tx.accountStock.createMany({
      data: rows.map((credentials) => {
        // The row id is part of the encryption context, so a login can't be moved to another row.
        const id = randomUUID();
        return { id, productId, credentials: encrypt(JSON.stringify(credentials), credentialContext(id)) };
      }),
    });
    await writeAudit(tx, { adminId: actor.id, action: "account.stock_add", targetType: "AccountProduct", targetId: productId, details: { tier: product.tier, added: rows.length } });
  });
  updateTag(ACCOUNTS_CACHE_TAG);
  return ok({ added: rows.length });
}
