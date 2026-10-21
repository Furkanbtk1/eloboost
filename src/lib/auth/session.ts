import "server-only";

import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { cache } from "react";

import { auth } from "@/auth";
import type { BoosterStatus, UserRole } from "@/generated/prisma/enums";
import { redirect } from "@/i18n/navigation";
import { findArea, homePathForRole, LOGIN_PATH, TWO_FACTOR_SETUP_PATH } from "@/lib/auth/access";
import { needsTwoFactorSetup } from "@/lib/auth/policy";
import { db } from "@/lib/db";

/**
 * Data Access Layer for the signed-in user. Every protected page goes through
 * here, so authorization is decided from the database, not only the token.
 * Call it inside a <Suspense> boundary: it reads the request cookies.
 */

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  avatarUrl: string | null;
  is2FAEnabled: boolean;
  hasPassword: boolean;
  emailVerified: boolean;
  boosterStatus: BoosterStatus | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth.js checks token expiry with the clock, which a runtime prefetch would otherwise freeze.
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      isBanned: true,
      is2FAEnabled: true,
      passwordHash: true,
      emailVerified: true,
      boosterProfile: { select: { status: true } },
    },
  });
  if (!user || user.isBanned) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    is2FAEnabled: user.is2FAEnabled,
    hasPassword: user.passwordHash !== null,
    emailVerified: user.emailVerified !== null,
    boosterStatus: user.boosterProfile?.status ?? null,
  };
});

async function redirectLocalized(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  // A token that no longer maps to an active user (banned or deleted since sign-in).
  const hasStaleSession = Boolean((await auth())?.user);
  return redirectLocalized(hasStaleSession ? `${LOGIN_PATH}?error=AccountBanned` : LOGIN_PATH);
}

/**
 * Enforces the access rule of the area that contains `path` (see access.ts):
 * signed in, allowed role, and 2FA enabled where the area demands it.
 */
export async function requireArea(path: string): Promise<CurrentUser> {
  const user = await requireUser();
  const area = findArea(path);
  if (!area) return user;

  if (!area.roles.includes(user.role)) return redirectLocalized(homePathForRole(user.role));
  if (area.requiresTwoFactor && needsTwoFactorSetup(user.role, user.is2FAEnabled)) {
    return redirectLocalized(TWO_FACTOR_SETUP_PATH);
  }
  return user;
}
