"use server";

import bcrypt from "bcryptjs";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { actionEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

import { consumeEmailToken, issueEmailToken, resetIdentifier, RESET_TTL_MS, verifyIdentifier, VERIFY_TTL_MS } from "./email-tokens";
import { emailOnlySchema, resetPasswordSchema } from "./schemas";

function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

const linkTo = (path: string, locale: AppLocale, token: string) =>
  new URL(`${getPathname({ href: path, locale })}?token=${encodeURIComponent(token)}`, env.NEXT_PUBLIC_APP_URL).toString();

async function sendLinkEmail(kind: "reset" | "verify", to: string, name: string | null, locale: AppLocale, token: string) {
  const t = await getTranslations({ locale, namespace: "Emails" });
  const path = kind === "reset" ? "/reset-password" : "/verify-email";
  const content = actionEmail({
    greeting: t("greeting", { name: name ?? "" }),
    body: t(`${kind}.body`),
    button: t(`${kind}.button`),
    url: linkTo(path, locale, token),
    footer: t(`${kind}.footer`),
  });
  return sendEmail({ to, subject: t(`${kind}.subject`), ...content });
}

/**
 * Always answers the same way, so it can't be used to find out which emails
 * have accounts. Accounts without a password (social login only) get no email.
 */
export async function requestPasswordResetAction(rawLocale: string, input: unknown): Promise<ActionResult> {
  const locale = resolveLocale(rawLocale);
  const [validation, t] = await Promise.all([
    getTranslations({ locale, namespace: "Validation" }),
    getTranslations({ locale, namespace: "Auth.errors" }),
  ]);
  const parsed = emailOnlySchema(validation).safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, t("invalidInput"));
  const { email } = parsed.data;

  const [byIp, byEmail] = await Promise.all([
    rateLimit("passwordResetIp", await getClientIp()),
    rateLimit("passwordResetEmail", email),
  ]);
  if (!byIp.success) return fail(t("rateLimited", { minutes: minutes(byIp.retryAfterSeconds) }), 429);
  // Over the per-address limit: stay silent rather than reveal the address exists.
  if (!byEmail.success) return ok(undefined);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, passwordHash: true, isBanned: true } });
  if (user?.passwordHash && !user.isBanned) {
    const token = await issueEmailToken(resetIdentifier(user.id), RESET_TTL_MS);
    await sendLinkEmail("reset", email, user.name, locale, token);
  }
  return ok(undefined);
}

export async function resetPasswordAction(
  rawLocale: string,
  token: string,
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  const locale = resolveLocale(rawLocale);
  const [validation, t] = await Promise.all([
    getTranslations({ locale, namespace: "Validation" }),
    getTranslations({ locale, namespace: "Auth.errors" }),
  ]);
  const parsed = resetPasswordSchema(validation).safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, t("invalidInput"));

  const limit = await rateLimit("passwordResetIp", await getClientIp());
  if (!limit.success) return fail(t("rateLimited", { minutes: minutes(limit.retryAfterSeconds) }), 429);

  const userId = await consumeEmailToken("reset", String(token));
  if (!userId) return fail(t("linkInvalid"), 400);

  // Reaching the mailbox proves ownership of the address, so it counts as verified too.
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), emailVerified: new Date() },
  });
  return ok({ redirectTo: getPathname({ href: "/login", locale }) });
}

/** For the signed-in user whose email isn't verified yet. */
export async function sendVerificationEmailAction(rawLocale: string): Promise<ActionResult> {
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth.errors" });
  const user = await getCurrentUser();
  if (!user) return fail(t("generic"), 401);
  if (user.emailVerified) return ok(undefined);

  const limit = await rateLimit("verificationEmail", user.id);
  if (!limit.success) return fail(t("rateLimited", { minutes: minutes(limit.retryAfterSeconds) }), 429);

  const token = await issueEmailToken(verifyIdentifier(user.id), VERIFY_TTL_MS);
  const sent = await sendLinkEmail("verify", user.email, user.name, locale, token);
  return sent ? ok(undefined) : fail(t("emailFailed"), 502);
}

export async function verifyEmailAction(rawLocale: string, token: string): Promise<ActionResult> {
  const t = await getTranslations({ locale: resolveLocale(rawLocale), namespace: "Auth.errors" });
  const userId = await consumeEmailToken("verify", String(token));
  if (!userId) return fail(t("linkInvalid"), 400);
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return ok(undefined);
}
