"use server";

import bcrypt from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import {
  enabledOAuthProviders,
  signIn,
  SignInRateLimited,
  SIGN_IN_ERROR,
  type OAuthProviderId,
} from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { fail, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { homePathForRole, safeCallbackPath } from "@/lib/auth/access";
import { db } from "@/lib/db";
import { actionEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

import { issueEmailToken, verifyIdentifier, VERIFY_TTL_MS } from "./email-tokens";
import { loginSchema, registerSchema } from "./schemas";

// Root params are unavailable in Server Actions, so the client passes its locale.
function resolveLocale(locale: string): AppLocale {
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

async function translators(locale: AppLocale) {
  const [validation, errors] = await Promise.all([
    getTranslations({ locale, namespace: "Validation" }),
    getTranslations({ locale, namespace: "Auth.errors" }),
  ]);
  return { validation, errors };
}

const toMinutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

/** Where to send the user after signing in: a safe callbackUrl or the role's panel. */
async function landingPath(email: string, locale: AppLocale, callbackUrl: string | null | undefined) {
  const safe = safeCallbackPath(callbackUrl);
  if (safe) return safe;
  const user = await db.user.findUnique({ where: { email }, select: { role: true } });
  return getPathname({ href: homePathForRole(user?.role ?? "CUSTOMER"), locale });
}

export type LoginResult = { status: "signed_in"; redirectTo: string } | { status: "two_factor_required" };

export async function loginAction(
  rawLocale: string,
  input: unknown,
  callbackUrl?: string | null,
): Promise<ActionResult<LoginResult>> {
  const locale = resolveLocale(rawLocale);
  const t = await translators(locale);

  const parsed = loginSchema(t.validation).safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, t.errors("invalidInput"));
  const { email, password, code } = parsed.data;

  // Rate limiting happens inside `authorize`, which also guards the REST endpoint.
  try {
    await signIn("credentials", { email, password, code: code ?? "", redirect: false });
  } catch (error) {
    if (error instanceof SignInRateLimited) {
      return fail(t.errors("rateLimited", { minutes: toMinutes(error.retryAfterSeconds) }), 429);
    }
    if (!(error instanceof CredentialsSignin)) {
      console.error("[loginAction]", error);
      return fail(t.errors("generic"), 500);
    }
    switch (error.code) {
      case SIGN_IN_ERROR.twoFactorRequired:
        return ok({ status: "two_factor_required" });
      case SIGN_IN_ERROR.invalidTwoFactorCode:
        return fail(t.errors("invalidTwoFactorCode"), 401, { code: [t.errors("invalidTwoFactorCode")] });
      case SIGN_IN_ERROR.accountBanned:
        return fail(t.errors("accountBanned"), 403);
      default:
        return fail(t.errors("invalidCredentials"), 401);
    }
  }

  return ok({ status: "signed_in", redirectTo: await landingPath(email, locale, callbackUrl) });
}

export async function registerAction(rawLocale: string, input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const locale = resolveLocale(rawLocale);
  const t = await translators(locale);

  const parsed = registerSchema(t.validation).safeParse(input);
  if (!parsed.success) return failValidation(parsed.error, t.errors("invalidInput"));
  const { name, email, password } = parsed.data;

  const limit = await rateLimit("register", await getClientIp());
  if (!limit.success) return fail(t.errors("rateLimited", { minutes: toMinutes(limit.retryAfterSeconds) }), 429);

  const emailTaken = () => fail(t.errors("emailTaken"), 409, { email: [t.errors("emailTaken")] });
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return emailTaken();

  let userId: string;
  try {
    ({ id: userId } = await db.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "CUSTOMER" },
      select: { id: true },
    }));
  } catch (error) {
    // Lost a race against a parallel registration with the same email.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return emailTaken();
    console.error("[registerAction]", error);
    return fail(t.errors("generic"), 500);
  }

  // Best effort: a mail problem must not block sign-up (the dashboard offers "resend").
  await sendVerification(userId, email, name, locale);

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    console.error("[registerAction] auto sign-in failed", error);
    return ok({ redirectTo: getPathname({ href: "/login", locale }) });
  }
  return ok({ redirectTo: getPathname({ href: "/dashboard", locale }) });
}

async function sendVerification(userId: string, email: string, name: string, locale: AppLocale) {
  try {
    const token = await issueEmailToken(verifyIdentifier(userId), VERIFY_TTL_MS);
    const t = await getTranslations({ locale, namespace: "Emails" });
    const url = new URL(`${getPathname({ href: "/verify-email", locale })}?token=${encodeURIComponent(token)}`, env.NEXT_PUBLIC_APP_URL).toString();
    const content = actionEmail({
      greeting: t("greeting", { name }),
      body: t("verify.body"),
      button: t("verify.button"),
      url,
      footer: t("verify.footer"),
    });
    await sendEmail({ to: email, subject: t("verify.subject"), ...content });
  } catch (error) {
    console.error("[registerAction] verification email failed", error);
  }
}

export async function oauthSignInAction(
  provider: OAuthProviderId,
  rawLocale: string,
  callbackUrl?: string | null,
): Promise<void> {
  if (!enabledOAuthProviders.includes(provider)) return;
  const locale = resolveLocale(rawLocale);
  // The proxy forwards signed-in users from the dashboard to their own panel.
  const redirectTo = safeCallbackPath(callbackUrl) ?? getPathname({ href: "/dashboard", locale });
  await signIn(provider, { redirectTo });
}
