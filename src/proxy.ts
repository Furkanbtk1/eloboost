import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";

import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import {
  findArea,
  homePathForRole,
  isAuthPage,
  LOGIN_PATH,
  TWO_FACTOR_SETUP_PATH,
} from "@/lib/auth/access";

const handleI18nRouting = createMiddleware(routing);

/** "/tr/admin/x" -> { locale: "tr", path: "/admin/x" }; unprefixed paths keep locale null. */
function splitLocale(pathname: string) {
  const [, first = "", ...rest] = pathname.split("/");
  return hasLocale(routing.locales, first)
    ? { locale: first, path: `/${rest.join("/")}` }
    : { locale: null, path: pathname };
}

function redirectTo(request: NextRequest, locale: string | null, path: string, search?: Record<string, string>) {
  const prefix = locale && locale !== routing.defaultLocale ? `/${locale}` : "";
  const url = new URL(`${prefix}${path}`, request.url);
  for (const [key, value] of Object.entries(search ?? {})) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/**
 * Optimistic access control from the session token (re-validated against the
 * database every few minutes in the jwt callback). Pages repeat the check
 * against the database before rendering anything.
 */
export default auth((request) => {
  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const user = request.auth?.user;

  // `?error` means a page rejected this session (e.g. account banned since the
  // token was issued); bouncing back to the panel would loop until the token refreshes.
  if (user && isAuthPage(path) && !request.nextUrl.searchParams.has("error")) {
    return redirectTo(request, locale, homePathForRole(user.role));
  }

  const area = findArea(path);
  if (area) {
    if (!user) {
      const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;
      return redirectTo(request, locale, LOGIN_PATH, { callbackUrl });
    }
    if (!area.roles.includes(user.role)) {
      return redirectTo(request, locale, homePathForRole(user.role));
    }
    if (area.requiresTwoFactor && user.needsTwoFactorSetup) {
      return redirectTo(request, locale, TWO_FACTOR_SETUP_PATH);
    }
  }

  return handleI18nRouting(request);
});

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
