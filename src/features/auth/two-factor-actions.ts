"use server";

import QRCode from "qrcode";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { auth, unstable_update } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { homePathForRole } from "@/lib/auth/access";
import { isTwoFactorMandatory } from "@/lib/auth/policy";
import { generateTotpSecret, openTotpSecret, sealTotpSecret, totpUri, verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

import { twoFactorCodeSchema } from "./schemas";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

async function context(rawLocale: string) {
  const locale = resolveLocale(rawLocale);
  const [session, validation, errors] = await Promise.all([
    auth(),
    getTranslations({ locale, namespace: "Validation" }),
    getTranslations({ locale, namespace: "Security.errors" }),
  ]);
  const user = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, role: true, passwordHash: true, is2FAEnabled: true, twoFactorSecret: true },
      })
    : null;
  return { locale, user, validation, errors };
}

type Context = Awaited<ReturnType<typeof context>>;

/** Validates the 6-digit code against the signed-in user's secret (rate limited). */
async function verifyUserCode(ctx: Context, input: unknown): Promise<ActionResult<NonNullable<Context["user"]>>> {
  const { user, validation, errors } = ctx;
  if (!user) return fail(errors("unauthorized"), 401);

  const parsed = twoFactorCodeSchema(validation).safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, errors("invalidCode"));

  const limit = await rateLimit("twoFactor", user.id);
  if (!limit.success) return fail(errors("rateLimited"), 429);

  const secret = user.twoFactorSecret ? openTotpSecret(user.twoFactorSecret, user.id) : null;
  if (!secret) return fail(errors("setupNotStarted"), 409);
  if (!verifyTotp(secret, parsed.data.code)) {
    return fail(errors("invalidCode"), 400, { code: [errors("invalidCode")] });
  }
  return ok(user);
}

export type TwoFactorSetup = { qrCodeDataUrl: string; secret: string };

/** Creates a new pending secret. It only takes effect after `enableTwoFactorAction`. */
export async function startTwoFactorSetupAction(rawLocale: string): Promise<ActionResult<TwoFactorSetup>> {
  const { user, errors } = await context(rawLocale);
  if (!user) return fail(errors("unauthorized"), 401);
  if (user.is2FAEnabled) return fail(errors("alreadyEnabled"), 409);
  // OAuth sign-ins skip the TOTP step, so 2FA is tied to password logins.
  if (!user.passwordHash) return fail(errors("passwordRequired"), 409);

  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: sealTotpSecret(secret, user.id) } });

  const qrCodeDataUrl = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220 });
  return ok({ qrCodeDataUrl, secret });
}

export async function enableTwoFactorAction(
  rawLocale: string,
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const ctx = await context(rawLocale);
  if (ctx.user?.is2FAEnabled) return fail(ctx.errors("alreadyEnabled"), 409);

  const checked = await verifyUserCode(ctx, input);
  if (!checked.success) return checked;
  const user = checked.data;

  await db.user.update({ where: { id: user.id }, data: { is2FAEnabled: true } });
  await unstable_update({}); // re-issue the token without the "needs 2FA setup" flag

  return ok({ redirectTo: getPathname({ href: homePathForRole(user.role), locale: ctx.locale }) });
}

export async function disableTwoFactorAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const ctx = await context(rawLocale);
  if (ctx.user && isTwoFactorMandatory(ctx.user.role)) return fail(ctx.errors("mandatoryForRole"), 403);
  if (ctx.user && !ctx.user.is2FAEnabled) return fail(ctx.errors("notEnabled"), 409);

  const checked = await verifyUserCode(ctx, input);
  if (!checked.success) return checked;

  await db.user.update({ where: { id: checked.data.id }, data: { is2FAEnabled: false, twoFactorSecret: null } });
  await unstable_update({});
  return ok(undefined);
}
